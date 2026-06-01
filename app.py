import os
import base64
import time
import html
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
from google.genai import types
from datetime import datetime, timedelta

load_dotenv()
from utils.helpers import detect_crisis, analyze_sentiment, generate_ai_response, strip_pii

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "super_secret_safeminds_key")

def get_db_connection():
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE, password TEXT)''')
    cursor.execute('''CREATE TABLE IF NOT EXISTS chat_logs (id SERIAL PRIMARY KEY, session_id TEXT, user_id INTEGER, user_message TEXT, bot_response TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    cursor.execute('''ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS reasoning TEXT;''')
    cursor.execute('''CREATE TABLE IF NOT EXISTS mood_logs (id SERIAL PRIMARY KEY, user_id INTEGER, mood TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    cursor.execute('''CREATE TABLE IF NOT EXISTS journals (id SERIAL PRIMARY KEY, user_id INTEGER, entry_text TEXT, ai_insight TEXT, emotion_tag TEXT DEFAULT 'Reflection', timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    cursor.execute('''ALTER TABLE journals ADD COLUMN IF NOT EXISTS emotion_tag TEXT DEFAULT 'Reflection';''')
    cursor.execute('''CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_logs(session_id);''')
    cursor.execute('''CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_logs(user_id);''')
    conn.commit()
    conn.close()
init_db()

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
    if not gemini_client: 
        return None
    try:
        # ✅ FIX: Updated to official correct embedding string
        response = gemini_client.models.embed_content(
            model="text-embedding-004",   
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
        
        results = pinecone_index.query(vector=vector, top_k=2, include_metadata=True)
        
        if results and results.get('matches'):
            past_messages = []
            for match in results['matches']:
                if match.get('score', 0) > 0.75 and 'text' in match['metadata']:
                    past_messages.append(match['metadata']['text'])
            return "\n".join(past_messages)
    except Exception as e:
        pass
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
    last_req = session.get('last_msg_time', 0)
    current_time = time.time()
    if current_time - last_req < 1.5:
        return jsonify({
            "response": "I'm still processing your last thought. Take a deep breath and try again in a moment.", 
            "sentiment": "neutral", "crisis": False, "emotions": [], "audio": None, "tool": None
        })
    session['last_msg_time'] = current_time

    data = request.json
    user_input = data.get('message')
    
    raw_history = data.get('history', [])
    chat_history = raw_history[-4:] if len(raw_history) > 4 else raw_history
    
    session_id = data.get('session_id')
    user_id = session.get('user_id')
    user_lang = data.get('language', 'en-US')[:2] 

    is_crisis = detect_crisis(user_input)
    sentiment = analyze_sentiment(user_input)
    
    past_memory = retrieve_past_context(user_input)
    augmented_input = f"[Recall from past: {past_memory}]\nUser says: {user_input}" if past_memory else user_input

    ai_response, reasoning, agentic_tool = generate_ai_response(augmented_input, chat_history, user_lang)

    clean_memory_text = strip_pii(user_input)

    if pinecone_index:
        try:
            vector = get_embedding(clean_memory_text)
            if vector:
                # ✅ FIX: Used len(raw_history) to stop overwriting previous memories in Pinecone
                pinecone_index.upsert(vectors=[{"id": f"{session_id}_{len(raw_history)}", "values": vector, "metadata": {"text": clean_memory_text}}])
        except Exception: pass

    audio_base64 = None
    try:
        lang_code = 'en' if user_lang not in ['ta', 'hi', 'en'] else user_lang
        tts = gTTS(text=ai_response, lang=lang_code, slow=False)
        fp = BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        audio_base64 = base64.b64encode(fp.read()).decode('utf-8')
    except Exception: pass

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO chat_logs (session_id, user_id, user_message, bot_response, reasoning) VALUES (%s, %s, %s, %s, %s) RETURNING id",
        (session_id, user_id, user_input, ai_response, reasoning)
    )
    chat_id = cursor.fetchone()[0]
    conn.commit()
    conn.close()

    return jsonify({
        "response": ai_response, 
        "sentiment": sentiment, 
        "crisis": is_crisis,
        "chat_id": chat_id, 
        "emotions": [],
        "audio": audio_base64,
        "tool": agentic_tool 
    })

@app.route('/save_journal', methods=['POST'])
@login_required
def save_journal():
    data = request.json
    entry_text = html.escape(data.get('entry', '')) 
    user_id = session.get('user_id')
    
    system_prompt = "You are a kind and supportive journal companion. Always respond warmly."
    insight_prompt = f"The user wrote: '{entry_text}'.\n\nTask: Identify the main emotion in ONE word. Then give one short comforting insight.\n\nReply exactly in this format:\nEmotion: [Word]\nInsight: [Short sentence]"
    
    emotion_tag = "Reflection"
    ai_insight = "Thank you for sharing your thoughts today."
    
    if gemini_client:
        max_retries = 3
        base_wait_time = 2
        import time
        
        for attempt in range(max_retries):
            try:
                # ✅ MAINTAINED: gemma-4-26b-a4b-it as requested
                response = gemini_client.models.generate_content(
                    model="gemma-4-26b-a4b-it", 
                    contents=insight_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=0.3,
                        max_output_tokens=80,
                        safety_settings=[
                            types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold=types.HarmBlockThreshold.BLOCK_NONE),
                            types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_HARASSMENT, threshold=types.HarmBlockThreshold.BLOCK_NONE),
                            types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold=types.HarmBlockThreshold.BLOCK_NONE),
                            types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold=types.HarmBlockThreshold.BLOCK_NONE)
                        ]
                    )
                )
                
                if response.text:
                    content = response.text.replace('*', '').strip() 
                    for line in content.split('\n'):
                        if line.lower().startswith('emotion:'):
                            emotion_tag = line.split(':', 1)[1].strip()
                        elif line.lower().startswith('insight:'):
                            ai_insight = line.split(':', 1)[1].strip()
                    print("✅ Journal tagged successfully.")
                    break 
                else:
                    print("⚠️ Journal AI Response blocked.")
                    break
                        
            except Exception as e:
                error_str = str(e)
                if "429" in error_str or "500" in error_str or "503" in error_str:
                    wait_time = base_wait_time * (2 ** attempt)
                    time.sleep(wait_time)
                else:
                    print(f"❌ Journal AI Error: {e}")
                    break

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO journals (user_id, entry_text, ai_insight, emotion_tag) VALUES (%s, %s, %s, %s)",
        (user_id, entry_text, ai_insight, emotion_tag)
    )
    conn.commit()
    conn.close()
    
    return jsonify({"status": "success", "insight": ai_insight, "emotion": emotion_tag})

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

@app.route('/get_dashboard_stats', methods=['GET'])
@login_required
def get_dashboard_stats():
    user_id = session.get('user_id')
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cursor.execute("SELECT COUNT(DISTINCT session_id) as total FROM chat_logs WHERE user_id = %s", (user_id,))
    total_sessions = cursor.fetchone()['total']

    crisis_keywords = ["die", "suicide", "kill", "end my life", "hopeless", "end it", "worthless", "give up", "dead"]
    query_conditions = " OR ".join(["user_message ILIKE %s" for _ in crisis_keywords])
    params = [f"%{kw}%" for kw in crisis_keywords]
    cursor.execute(f"SELECT COUNT(*) as alerts FROM chat_logs WHERE user_id = %s AND ({query_conditions})", [user_id] + params)
    crisis_alerts = cursor.fetchone()['alerts']

    cursor.execute("SELECT mood, timestamp FROM mood_logs WHERE user_id = %s ORDER BY timestamp DESC", (user_id,))
    moods = cursor.fetchall()

    streak = 0
    avg_sentiment = "Analyzing"

    if moods:
        unique_dates = sorted(list(set([m['timestamp'].date() for m in moods])), reverse=True)
        today = datetime.now().date()
        
        if unique_dates and (unique_dates[0] == today or unique_dates[0] == today - timedelta(days=1)):
            streak = 1
            for i in range(1, len(unique_dates)):
                if unique_dates[i-1] - unique_dates[i] == timedelta(days=1):
                    streak += 1
                else:
                    break
                    
        mood_scores = {'Happy': 4, 'Calm': 3, 'Sad': 2, 'Stressed': 1}
        recent_moods = moods[:5]
        score_sum = sum([mood_scores.get(m['mood'], 2.5) for m in recent_moods])
        avg_score = score_sum / len(recent_moods)
        
        if avg_score >= 3.5: avg_sentiment = "Joyful"
        elif avg_score >= 2.5: avg_sentiment = "Calm"
        elif avg_score >= 1.5: avg_sentiment = "Down"
        else: avg_sentiment = "Stressed"

    conn.close()

    return jsonify({
        "total_sessions": total_sessions,
        "streak": streak,
        "avg_sentiment": avg_sentiment,
        "crisis_alerts": crisis_alerts
    })

if __name__ == '__main__':
    app.run(debug=True)