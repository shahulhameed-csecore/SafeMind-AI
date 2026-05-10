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
from google.genai import types
from datetime import datetime, timedelta

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
    
    cursor.execute('''CREATE TABLE IF NOT EXISTS journals (id SERIAL PRIMARY KEY, user_id INTEGER, entry_text TEXT, ai_insight TEXT, emotion_tag TEXT DEFAULT 'Reflection', timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    cursor.execute('''ALTER TABLE journals ADD COLUMN IF NOT EXISTS emotion_tag TEXT DEFAULT 'Reflection';''')
    
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
        response = gemini_client.models.embed_content(
            model="gemini-embedding-001", # 👈 MUST BE EXACTLY THIS
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
            past_messages = [match['metadata']['text'] for match in results['matches'] if 'text' in match['metadata']]
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
    data = request.json
    user_input = data.get('message')
    chat_history = data.get('history', [])
    session_id = data.get('session_id')
    user_id = session.get('user_id')
    user_lang = data.get('language', 'en-US')[:2] 

    is_crisis = detect_crisis(user_input)
    sentiment = analyze_sentiment(user_input)
    deep_emotions = analyze_deep_emotion(user_input)
    
    past_memory = retrieve_past_context(user_input)
    
    if past_memory:
        augmented_input = f"[Recall from past: {past_memory}]\nUser says: {user_input}"
    else:
        augmented_input = user_input

    ai_response = generate_ai_response(augmented_input, chat_history, user_lang)

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
            pass

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
        pass

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO chat_logs (session_id, user_id, user_message, bot_response) VALUES (%s, %s, %s, %s) RETURNING id",
        (session_id, user_id, user_input, ai_response)
    )
    chat_id = cursor.fetchone()[0]
    conn.commit()
    conn.close()

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

# 🌟 ENHANCED JOURNAL SYSTEM (Using Google API)
@app.route('/save_journal', methods=['POST'])
@login_required
def save_journal():
    data = request.json
    entry_text = data.get('entry')
    user_id = session.get('user_id')
    
    system_prompt = "You are an empathetic journal assistant."
    insight_prompt = f"The user wrote this private journal entry: '{entry_text}'.\n\nTASK:\n1. Identify the core emotion in ONE word (e.g. Joy, Anxiety, Hope, Grief, Frustration, Calm, Overwhelmed).\n2. Write a single, comforting, 1-sentence insight or 'silver lining'.\n\nFORMAT YOUR RESPONSE EXACTLY LIKE THIS:\nEmotion: [Word]\nInsight: [Sentence]"
    
    emotion_tag = "Reflection"
    ai_insight = "Thank you for sharing your thoughts today."
    
    # 🚀 Connecting to Google AI Studio directly instead of OpenRouter
    # 🚀 Connecting to Google AI Studio directly
    if gemini_client:
        try:
            response = gemini_client.models.generate_content(
                model="gemma-4-26b-a4b-it", # 👈 CHANGED BACK TO GEMMA 4!
                contents=insight_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.6,
                    max_output_tokens=60
                )
            )
            content = response.text.replace('*', '').strip()
            
            for line in content.split('\n'):
                if line.lower().startswith('emotion:'):
                    emotion_tag = line.split(':', 1)[1].strip()
                elif line.lower().startswith('insight:'):
                    ai_insight = line.split(':', 1)[1].strip()
                    
        except Exception as e:
            print(f"Journal AI Error: {e}")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO journals (user_id, entry_text, ai_insight, emotion_tag) VALUES (%s, %s, %s, %s)",
        (user_id, entry_text, ai_insight, emotion_tag)
    )
    conn.commit()
    conn.close()
    
    return jsonify({"status": "success", "insight": ai_insight, "emotion": emotion_tag})

@app.route('/get_journals', methods=['GET'])
@login_required
def get_journals():
    user_id = session.get('user_id')
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute("SELECT id, entry_text, ai_insight, emotion_tag, timestamp FROM journals WHERE user_id = %s ORDER BY timestamp DESC", (user_id,))
    journals = cursor.fetchall()
    conn.close()
    
    return jsonify(journals)

@app.route('/delete_journal', methods=['POST'])
@login_required
def delete_journal():
    journal_id = request.json.get('id')
    user_id = session.get('user_id')
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM journals WHERE id = %s AND user_id = %s", (journal_id, user_id))
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})

@app.route('/export_report', methods=['GET'])
@login_required
def export_report():
    user_id = session.get('user_id')
    username = session.get('username', 'User')
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    thirty_days_ago = datetime.now() - timedelta(days=30)

    cursor.execute("SELECT mood, timestamp FROM mood_logs WHERE user_id = %s AND timestamp >= %s ORDER BY timestamp DESC", (user_id, thirty_days_ago))
    moods = cursor.fetchall()

    cursor.execute("SELECT entry_text, emotion_tag, timestamp FROM journals WHERE user_id = %s AND timestamp >= %s ORDER BY timestamp DESC", (user_id, thirty_days_ago))
    journals = cursor.fetchall()

    cursor.execute("SELECT COUNT(*) as msg_count FROM chat_logs WHERE user_id = %s AND timestamp >= %s", (user_id, thirty_days_ago))
    chat_count = cursor.fetchone()['msg_count']

    conn.close()

    report = f"====================================================\n"
    report += f"   SAFEMIND AI - 30-DAY CLINICAL SUMMARY REPORT     \n"
    report += f"====================================================\n\n"
    report += f"Patient/User: {username}\n"
    report += f"Generated On: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}\n"
    report += f"Reporting Period: Last 30 Days\n\n"
    
    report += f"--- 1. HIGH-LEVEL OVERVIEW ---\n"
    report += f"Total AI Therapy Messages Exchanged: {chat_count}\n"
    report += f"Total Mood Check-ins: {len(moods)}\n"
    report += f"Total Journal Reflections: {len(journals)}\n\n"

    report += f"--- 2. MOOD TRENDS ---\n"
    if moods:
        for m in moods:
            report += f"• {m['timestamp'].strftime('%b %d, %I:%M %p')}: {m['mood']}\n"
    else:
        report += "No moods logged in this period.\n"
    report += "\n"

    report += f"--- 3. JOURNAL REFLECTIONS & EMOTION TAGS ---\n"
    if journals:
        for j in journals:
            report += f"Date: {j['timestamp'].strftime('%b %d, %Y')}\n"
            report += f"Detected Emotion: [{j['emotion_tag']}]\n"
            report += f"Entry: \"{j['entry_text']}\"\n"
            report += f"- - - - - - - - - - - - - - - - - - - - - - - - -\n"
    else:
        report += "No journal entries in this period.\n"

    return report, 200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': f'attachment; filename="SafeMind_Clinical_Report_{username}.txt"'
    }

if __name__ == '__main__':
    app.run(debug=True)