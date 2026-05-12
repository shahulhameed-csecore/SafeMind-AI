import os
import time
import re
from textblob import TextBlob
from deep_translator import GoogleTranslator
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

# 🌟 100% PURE GEMINI/GEMMA VIA GOOGLE AI STUDIO (Free & Stable)
try:
    gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    print("✅ Google AI Studio Initialized")
except Exception as e:
    print(f"⚠️ Failed to initialize Google AI Studio: {e}")
    gemini_client = None

# 🛡️ PII STRIPPING (Data Anonymization)
def strip_pii(text):
    if not text: return text
    text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL REDACTED]', text)
    text = re.sub(r'\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b', '[PHONE REDACTED]', text)
    text = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '[SSN REDACTED]', text)
    return text

def analyze_deep_emotion(user_text):
    text = user_text.lower()
    emotions = {'joy': 0.1, 'surprise': 0.1, 'neutral': 0.5, 'sadness': 0.1, 'fear': 0.1, 'disgust': 0.1, 'anger': 0.1}
    sad_words = ['sad', 'down', 'depressed', 'demotivated', 'cry', 'lonely', 'tired', 'hopeless', 'bad', 'hurt', 'messed up', 'incompetent']
    joy_words = ['happy', 'good', 'great', 'joy', 'motivated', 'excited', 'awesome', 'love', 'smile']
    fear_words = ['scared', 'anxious', 'fear', 'terrified', 'nervous', 'panic', 'worry', 'stress', 'fired', 'trouble']
    anger_words = ['angry', 'mad', 'frustrated', 'hate', 'annoyed', 'furious', 'irritated']
    
    if any(w in text for w in sad_words): emotions['sadness'] += 0.8; emotions['neutral'] = 0.1
    if any(w in text for w in joy_words): emotions['joy'] += 0.8; emotions['neutral'] = 0.1
    if any(w in text for w in fear_words): emotions['fear'] += 0.8; emotions['neutral'] = 0.1
    if any(w in text for w in anger_words): emotions['anger'] += 0.8; emotions['neutral'] = 0.1

    total = sum(emotions.values())
    return [{"label": k, "score": v / total} for k, v in emotions.items()]

def detect_crisis(user_text):
    CRISIS_KEYWORDS = ["die", "suicide", "kill", "end my life", "hopeless", "end it", "worthless", "give up", "dead"]
    try:
        en_text = GoogleTranslator(source='auto', target='en').translate(user_text).lower()
        return any(k in en_text for k in CRISIS_KEYWORDS)
    except:
        return any(k in user_text.lower() for k in CRISIS_KEYWORDS)

def analyze_sentiment(text):
    try:
        en_text = GoogleTranslator(source='auto', target='en').translate(text)
        polarity = TextBlob(en_text).sentiment.polarity
        if polarity > 0.1: return "positive"
        elif polarity < -0.1: return "negative"
        else: return "neutral"
    except:
        return "neutral"

# 🧠 FEATURE 3: BACKGROUND CONTEXT COMPRESSION
def compress_session(chat_history):
    if len(chat_history) <= 4:
        return "\n".join([f"{msg['role']}: {msg['text']}" for msg in chat_history])
    
    # Extract older messages to summarize
    older_history = "\n".join([f"{msg['role']}: {msg['text']}" for msg in chat_history[:-2]])
    recent_history = "\n".join([f"{msg['role']}: {msg['text']}" for msg in chat_history[-2:]])
    
    try:
        summary_prompt = f"Summarize this clinical therapy session concisely in one brief paragraph, capturing the user's emotional state and core issues:\n{older_history}"
        response = gemini_client.models.generate_content(
            model='gemma-4-26b-a4b-it',
            contents=summary_prompt,
            config=types.GenerateContentConfig(temperature=0.2, max_output_tokens=100)
        )
        return f"[Clinical Session Summary: {response.text.strip()}]\n\n--- Recent Messages ---\n{recent_history}"
    except:
        # Fallback if summarization fails
        return older_history + "\n" + recent_history

def generate_ai_response(user_input, chat_history, user_lang='en'):
    if user_lang != 'en':
        try: english_input = GoogleTranslator(source='auto', target='en').translate(user_input)
        except: english_input = user_input
    else:
        english_input = user_input

    # Translate history to English for the model
    english_history = []
    for msg in chat_history:
        try: en_text = GoogleTranslator(source='auto', target='en').translate(msg['text'])
        except: en_text = msg['text']
        english_history.append({"role": msg['role'], "text": en_text})
        
    history_text = compress_session(english_history)
    
    # 🧠 FEATURES 1 & 2: CHAIN-OF-THOUGHT & AGENTIC TOOL CALLING
    system_prompt = """You are SafeMind AI, a highly empathetic, privacy-first mental health companion powered by Google Gemma 4. 

CORE DIRECTIVES:
1. CLINICAL CHAIN-OF-THOUGHT: You MUST strictly format your output into two blocks. First, a <reasoning> block where you assess the patient's state and plan your strategy. Second, a <response> block containing what you actually say to the user.
2. AGENTIC TOOL CALLING: If the user exhibits cognitive distortions, panic, acute stress, or needs assessment, append exactly ONE of these tags at the very end of your <response> block: [TOOL: CBT], [TOOL: BURN], or [TOOL: PHQ9].
   - Use [TOOL: CBT] for cognitive distortions, negative framing, or irrational thoughts.
   - Use [TOOL: BURN] for letting go of severe acute stress, pain, or intrusive thoughts.
   - Use [TOOL: PHQ9] if they mention long-term sadness, exhaustion, or depression symptoms.
3. Keep your <response> concise (Max 3 short sentences).

FEW-SHOT CLINICAL EXAMPLES:
User: "I failed my exam and I feel like a total failure in life."
SafeMind:
<reasoning>
The user is catastrophizing and displaying all-or-nothing thinking. I need to validate their pain and gently challenge the cognitive distortion. I will autonomously trigger the CBT tool.
</reasoning>
<response>
It sounds like you're carrying a heavy weight right now. Failing an exam hurts, but one test does not define your entire worth. Let's work through this thought together. [TOOL: CBT]
</response>
"""
    
    enforced_input = f"""
    Past Conversation:
    {history_text}
    
    User's New Message: "{english_input}"
    
    Task: Reply as SafeMind AI based on the CORE DIRECTIVES.
    """

    full_output = ""
    max_retries = 3
    base_wait_time = 2

    # 🚀 GOOGLE-APPROVED EXPONENTIAL BACKOFF
    for attempt in range(max_retries):
        try:
            if not gemini_client: raise ValueError("Client offline.")
            
            response = gemini_client.models.generate_content(
                model='gemma-4-26b-a4b-it', 
                contents=enforced_input,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.7,
                    max_output_tokens=200 # Increased to allow room for the <reasoning> block
                )
            )
            full_output = response.text.replace('*', '').strip()
            print("✅ Agentic Response generated successfully.")
            break 

        except Exception as e:
            if "429" in str(e) or "500" in str(e) or "503" in str(e):
                wait_time = base_wait_time * (2 ** attempt)
                time.sleep(wait_time)
            else:
                full_output = "<response>I am taking a deep breath right now. Could you please share that with me again?</response>"
                break
    else:
        full_output = "<response>The servers are taking a moment to process. Please take a deep breath and try sending that again.</response>"

    # 🧠 PARSE THE MODEL'S REASONING AND TOOL CALLS
    reasoning = "Standard empathy applied."
    clean_reply = full_output
    
    if "<reasoning>" in full_output and "</reasoning>" in full_output:
        reasoning = full_output.split("<reasoning>")[1].split("</reasoning>")[0].strip()
    
    if "<response>" in full_output and "</response>" in full_output:
        clean_reply = full_output.split("<response>")[1].split("</response>")[0].strip()
    elif "</reasoning>" in full_output: # Fallback if model forgets opening tag
        clean_reply = full_output.split("</reasoning>")[1].strip()

    # Extract Tool
    tool = None
    tool_match = re.search(r'\[TOOL:\s*(CBT|BURN|PHQ9)\]', clean_reply, re.IGNORECASE)
    if tool_match:
        tool = tool_match.group(1).upper()
        # Remove the tag from the text the user sees
        clean_reply = re.sub(r'\[TOOL:\s*(CBT|BURN|PHQ9)\]', '', clean_reply, flags=re.IGNORECASE).strip()
         
    if user_lang != 'en' and "deep breath" not in clean_reply:
        try: clean_reply = GoogleTranslator(source='en', target=user_lang).translate(clean_reply)
        except: pass
            
    return clean_reply, reasoning, tool