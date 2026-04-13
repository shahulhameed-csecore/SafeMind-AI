import os
from textblob import TextBlob
from deep_translator import GoogleTranslator
from google import genai
from google.genai import types
from langdetect import detect
from dotenv import load_dotenv

load_dotenv()

# 🌟 NEW: Initialize the Cloud AI (Gemini)
try:
    gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
except Exception as e:
    print(f"⚠️ Failed to initialize Gemini: {e}")
    gemini_client = None

def analyze_deep_emotion(user_text):
    # 🌟 100% OFFLINE EMOTION ENGINE (Perfect for free hosting)
    text = user_text.lower()
    
    emotions = {
        'joy': 0.1, 'surprise': 0.1, 'neutral': 0.5, 
        'sadness': 0.1, 'fear': 0.1, 'disgust': 0.1, 'anger': 0.1
    }
    
    sad_words = ['sad', 'down', 'depressed', 'demotivated', 'cry', 'lonely', 'tired', 'hopeless', 'bad', 'hurt']
    joy_words = ['happy', 'good', 'great', 'joy', 'motivated', 'excited', 'awesome', 'love', 'smile']
    fear_words = ['scared', 'anxious', 'fear', 'terrified', 'nervous', 'panic', 'worry', 'stress']
    anger_words = ['angry', 'mad', 'frustrated', 'hate', 'annoyed', 'furious', 'irritated']
    surprise_words = ['wow', 'omg', 'amazed', 'shocked', 'sudden', 'unexpected']
    disgust_words = ['gross', 'disgusting', 'sick', 'vile', 'awful']

    if any(w in text for w in sad_words): emotions['sadness'] += 0.8; emotions['neutral'] = 0.1
    if any(w in text for w in joy_words): emotions['joy'] += 0.8; emotions['neutral'] = 0.1
    if any(w in text for w in fear_words): emotions['fear'] += 0.8; emotions['neutral'] = 0.1
    if any(w in text for w in anger_words): emotions['anger'] += 0.8; emotions['neutral'] = 0.1
    if any(w in text for w in surprise_words): emotions['surprise'] += 0.8; emotions['neutral'] = 0.1
    if any(w in text for w in disgust_words): emotions['disgust'] += 0.8; emotions['neutral'] = 0.1

    total = sum(emotions.values())
    result = [{"label": k, "score": v / total} for k, v in emotions.items()]
    return result

CRISIS_KEYWORDS = ["die", "suicide", "kill", "end my life", "hopeless", "end it", "worthless", "give up", "dead"]

def detect_crisis(user_text):
    try:
        english_translation = GoogleTranslator(source='auto', target='en').translate(user_text)
        return any(keyword in english_translation.lower() for keyword in CRISIS_KEYWORDS)
    except:
        return any(keyword in user_text.lower() for keyword in CRISIS_KEYWORDS)

def analyze_sentiment(text):
    try:
        english_translation = GoogleTranslator(source='auto', target='en').translate(text)
        polarity = TextBlob(english_translation).sentiment.polarity
        if polarity > 0.1: return "positive"
        elif polarity < -0.1: return "negative"
        else: return "neutral"
    except:
        return "neutral"

def generate_ai_response(user_input, chat_history, user_lang='en'):
    # 1. Translate TO English so Gemini understands nuances perfectly
    if user_lang != 'en':
        try:
            english_input = GoogleTranslator(source=user_lang, target='en').translate(user_input)
        except:
            english_input = user_input
    else:
        english_input = user_input

    # 2. Format the chat history (Keep it to just the last 3 messages)
    history_text = "\n".join([f"{msg['role']}: {msg['text']}" for msg in chat_history[-3:]])

    # 3. Define the universal empathetic persona
    system_prompt = "You are SafeMinds, a warm, highly empathetic mental health and well-being companion."

    # 4. THE FIX: The Universal Guardrail Prompt
    enforced_input = f"""
    Past Conversation:
    {history_text}
    
    User's New Message: "{english_input}"
    
    Task: Reply as SafeMinds.
    
    STRICT BOUNDARY RULES:
    1. You ONLY discuss mental health, emotional well-being, personal struggles, and coping strategies.
    2. IF the user asks about trivia, coding, politics, math, or general knowledge, YOU MUST REFUSE nicely and pivot back to their feelings.
    3. Keep your reply under 2 short sentences (Max 25 words).
    """

    try:
        if not gemini_client:
            raise ValueError("Gemini Client not initialized. API Key is missing.")

        # 🌟 5. NEW: Get English reply from Google Cloud AI
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=enforced_input,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.7 # Keeps the bot feeling warm and human
            )
        )
        english_reply = response.text
        
        # 6. Clean up any weird AI formatting
        if english_reply:
             english_reply = english_reply.replace('*', '').strip()
        else:
             english_reply = "I am here for you. How are you feeling right now?"
        
        # 7. STRICT TRANSLATION: Force the reply back to the UI language
        if user_lang != 'en':
            return GoogleTranslator(source='en', target=user_lang).translate(english_reply)
        return english_reply
        
    except Exception as e:
        print(f"❌ Cloud AI failed: {e}")
        return "I am having a connection issue right now. Please remember you are not alone."