import os
import base64
from io import BytesIO
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from dotenv import load_dotenv
from gtts import gTTS
from langdetect import detect
import psycopg2
import psycopg2.extras
from pinecone import Pinecone
from google import genai

load_dotenv()
from utils.helpers import detect_crisis, analyze_sentiment, generate_ai_response, analyze_deep_emotion

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "super_secret_safeminds_key")

# 🌟 Connect to Neon.tech Cloud Database
def get_db_connection():
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    return conn

# 🌟 Initialize Postgres Tables
def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE, password TEXT)''')
    cursor.execute('''CREATE TABLE IF NOT EXISTS chat_logs (id SERIAL PRIMARY KEY, session_id TEXT, user_id INTEGER, user_message TEXT, bot_response TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    cursor.execute('''CREATE TABLE IF NOT EXISTS mood_logs (id SERIAL PRIMARY KEY, user_id INTEGER, mood TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    
    # Indexes for lightning-fast lookups
    cursor.execute('''CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_logs(session_id);''')
    cursor.execute('''CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_logs(user_id);''')
    
    conn.commit()
    conn.close()

init_db()

# 🌟 PRO MEMORY SYSTEM: Pinecone + Gemini API
try:
    pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
    pinecone_index = pc.Index("safemind")
    gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    print("✅ Pinecone & Gemini Vector Memory Initialized")
except Exception as e:
    print(f"⚠️ Pinecone/Gemini Memory Offline: {e}")
    pinecone_index = None
    gemini_client = None

def get_embedding(text):
    if not gemini_client: return None
    try:
        # 🚀 FIX: Updated to Google's active embedding model
        response = gemini_client.models.embed_content(
            model="gemini-embedding-001", 
            contents=text
        )
        return response.embeddings[0].values
    except Exception as e:
        print(f"Embedding error: {e}")
        return None

def retrieve_past_context(user_text):
    if not pinecone_index: return ""
    try:
        vector = get_embedding(user_text)
        if not vector: return ""
        
        # Search Pinecone for the 2 most emotionally relevant past messages
        results = pinecone_index.query(vector=vector, top_k=2, include_metadata=True)
        
        if results and results.get('matches'):
            past_messages = [match['metadata']['text'] for match in results['matches'] if 'text' in match['metadata']]
            return "\n".join(past_messages)
    except Exception as e:
        print(f"Pinecone retrieval error: {e}")
    return ""

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
        conn.close()

        if user and check_password_hash(user['password'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']
            return redirect(url_for('app_dashboard'))
        else:
            flash('Invalid username or password', 'error')
    return render_template('index.html', show_auth=True, auth_type='login')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        hashed_pw = generate_password_hash(password)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("INSERT INTO users (username, password) VALUES (%s, %s)", (username, hashed_pw))
            conn.commit()
            flash('Registration successful! Please log in.', 'success')
            return redirect(url_for('login'))
        except psycopg2.IntegrityError:
            conn.rollback()
            flash('Username already exists.', 'error')
        finally:
            conn.close()
    return render_template('index.html', show_auth=True, auth_type='register')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('landing_page'))

@app.route('/')
def landing_page():
    if 'user_id' in session:
        return redirect(url_for('app_dashboard'))
    return render_template('landing.html')

@app.route('/app')
@login_required
def app_dashboard():
    return render_template('index.html', show_auth=False)

@app.route('/analyze', methods=['POST'])
@login_required
def analyze():
    print("🚀 STEP 1: Message received from frontend!")
    data = request.json
    user_input = data.get('message')
    chat_history = data.get('history', [])
    session_id = data.get('session_id')
    user_id = session.get('user_id')
    user_lang = data.get('language', 'en-US')[:2] 

    print("🚀 STEP 2: Running offline emotional analysis...")
    is_crisis = detect_crisis(user_input)
    sentiment = analyze_sentiment(user_input)
    deep_emotions = analyze_deep_emotion(user_input)
    
    print("🚀 STEP 3: Querying Pinecone (Long-term memory)...")
    past_memory = retrieve_past_context(user_input)
    
    if past_memory:
        augmented_input = f"[Recall from past: {past_memory}]\nUser says: {user_input}"
    else:
        augmented_input = user_input

    print("🚀 STEP 4: Calling Main AI API...")
    ai_response = generate_ai_response(augmented_input, chat_history, user_lang)

    print("🚀 STEP 5: Adding new memory to Pinecone...")
    if pinecone_index:
        try:
            vector = get_embedding(user_input)
            if vector:
                pinecone_index.upsert(vectors=[{
                    "id": f"{session_id}_{len(chat_history)}", 
                    "values": vector, 
                    "metadata": {"text": user_input}
                }])
        except Exception as e:
            print(f"⚠️ Pinecone Save Failed: {e}")

    print("🚀 STEP 6: Generating Voice Audio (gTTS)...")
    audio_base64 = None
    try:
        lang_code = user_lang
        if lang_code not in ['ta', 'hi', 'en']:
            lang_code = 'en'
            
        tts = gTTS(text=ai_response, lang=lang_code, slow=False)
        fp = BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        audio_base64 = base64.b64encode(fp.read()).decode('utf-8')
    except Exception as e:
        print(f"⚠️ Audio Generation Failed: {e}")

    print("🚀 STEP 7: Saving to Postgres Database...")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO chat_logs (session_id, user_id, user_message, bot_response) VALUES (%s, %s, %s, %s) RETURNING id",
        (session_id, user_id, user_input, ai_response)
    )
    chat_id = cursor.fetchone()[0]
    conn.commit()
    conn.close()

    print("✅ STEP 8: Success! Sending reply back to frontend.")
    return jsonify({
        "response": ai_response, 
        "sentiment": sentiment, 
        "crisis": is_crisis,
        "chat_id": chat_id, 
        "emotions": deep_emotions,
        "audio": audio_base64
    })

@app.route('/get_sessions', methods=['GET'])
@login_required
def get_sessions():
    user_id = session.get('user_id')
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cursor.execute("""
        SELECT * FROM (
            SELECT DISTINCT ON (session_id) session_id, user_message, timestamp 
            FROM chat_logs 
            WHERE user_id = %s 
            ORDER BY session_id, timestamp DESC
        ) sub 
        ORDER BY timestamp DESC LIMIT 10
    """, (user_id,))
    
    sessions = cursor.fetchall()
    conn.close()
    
    session_list = [{"session_id": row["session_id"], "title": row["user_message"][:25] + "..."} for row in sessions]
    return jsonify(session_list)

@app.route('/get_chat/<session_id>', methods=['GET'])
@login_required
def get_chat(session_id):
    user_id = session.get('user_id')
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        "SELECT id, user_message, bot_response FROM chat_logs WHERE session_id = %s AND user_id = %s ORDER BY timestamp ASC",
        (session_id, user_id)
    )
    chats = cursor.fetchall()
    conn.close()
    return jsonify([{"id": row["id"], "user": row["user_message"], "bot": row["bot_response"]} for row in chats])

@app.route('/delete_session', methods=['POST'])
@login_required
def delete_session():
    session_id = request.json.get('session_id')
    user_id = session.get('user_id')
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_logs WHERE session_id = %s AND user_id = %s", (session_id, user_id))
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})

@app.route('/save_mood', methods=['POST'])
@login_required
def save_mood():
    mood = request.json.get('mood')
    user_id = session.get('user_id')
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO mood_logs (user_id, mood) VALUES (%s, %s)", (user_id, mood))
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})

@app.route('/get_moods', methods=['GET'])
@login_required
def get_moods():
    user_id = session.get('user_id')
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        "SELECT mood, timestamp FROM mood_logs WHERE user_id = %s ORDER BY timestamp DESC LIMIT 15",
        (user_id,)
    )
    moods = cursor.fetchall()
    conn.close()
    
    moods_list = [{"mood": row["mood"], "time": row["timestamp"]} for row in moods]
    moods_list.reverse()
    return jsonify(moods_list)

if __name__ == '__main__':
    app.run(debug=True)