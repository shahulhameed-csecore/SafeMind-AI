let sessionMemory = [];
let currentSessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
let isSpeaking = false;

// 🧠 EMOTIONALLY ADAPTIVE CHART COLOR ENGINE
function getThemeColors() {
    const mood = document.body.getAttribute('data-mood') || 'calm';
    const palettes = {
        'calm':      { text: '#2d4a48', grid: 'rgba(92, 184, 178, 0.2)', line: '#5cb8b2', bg: 'rgba(92, 184, 178, 0.2)', point: '#a3d9d2' },
        'anxious':   { text: '#2c3338', grid: 'rgba(108, 122, 137, 0.15)', line: '#6c7a89', bg: 'rgba(108, 122, 137, 0.15)', point: '#b4bcc4' },
        'motivated': { text: '#4a2c2a', grid: 'rgba(242, 139, 130, 0.2)', line: '#f28b82', bg: 'rgba(242, 139, 130, 0.25)', point: '#fce8b2' },
        'sleep':     { text: '#e8eaf6', grid: 'rgba(121, 134, 203, 0.15)', line: '#7986cb', bg: 'rgba(121, 134, 203, 0.15)', point: '#3f51b5' }
    };
    return palettes[mood] || palettes['calm'];
}

const icons = { trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>` };

document.addEventListener("DOMContentLoaded", async () => {
    // ✨ FIX: Load saved mood onto the body directly to ensure CSS cascades properly
    const savedMood = localStorage.getItem('safeminds_mood') || 'calm';
    document.body.setAttribute('data-mood', savedMood);
    const selector = document.getElementById('mood-selector');
    if(selector) selector.value = savedMood;

    if (document.getElementById("history-list")) {
        await loadSidebarSessions();
        await loadMoodChart();
    }
});

// 🧠 MOOD CHANGE TRIGGER
function changeMood(mood) {
    document.body.setAttribute('data-mood', mood);
    localStorage.setItem('safeminds_mood', mood);
    
    // Force Chart.js graphs to redraw with the new psychological colors
    setTimeout(() => {
        if(moodChartInstance) loadMoodChart(); 
        if(radarChartInstance && lastEmotionData) updateEmotionRadar(lastEmotionData);
    }, 300);
}

function getBestTherapistVoice(text = "") {
    const voices = window.speechSynthesis.getVoices();
    if (/[\u0B80-\u0BFF]/.test(text)) return voices.find(v => v.name.includes('Google') && v.lang.includes('ta')) || voices.find(v => v.lang.includes('ta'));
    if (/[\u0900-\u097F]/.test(text)) return voices.find(v => v.name.includes('Google') && v.lang.includes('hi')) || voices.find(v => v.lang.includes('hi'));
    
    let best = voices.find(v => v.name.includes('Natural') && (v.name.includes('Female') || v.name.includes('Jenny')));
    if (!best) best = voices.find(v => v.name.includes('Google US English'));
    if (!best) best = voices.find(v => v.name.includes('Google UK English Female'));
    return best || voices[0];
}

function speakText(text) {
    window.speechSynthesis.cancel();
    let smoothedText = text.replace(/ \. /g, '... ').replace(/,/g, ', ');
    const utterance = new SpeechSynthesisUtterance(smoothedText);
    utterance.voice = getBestTherapistVoice(text);
    utterance.rate = (/[\u0B80-\u0BFF]/.test(text) || /[\u0900-\u097F]/.test(text)) ? 0.85 : 1.05;
    utterance.pitch = 1.05; utterance.volume = 1.0;
    
    const stopBtn = document.getElementById('stop-audio-btn');
    utterance.onstart = () => { isSpeaking = true; if(stopBtn) stopBtn.style.display = 'flex'; };
    utterance.onend = () => { isSpeaking = false; if(stopBtn) stopBtn.style.display = 'none'; };
    
    if (utterance.voice || !(/[\u0B80-\u0BFF]/.test(text) || /[\u0900-\u097F]/.test(text))) window.speechSynthesis.speak(utterance);
}

let currentCloudAudio = null;
function playCloudAudio(base64Audio) {
    if (currentCloudAudio) { currentCloudAudio.pause(); currentCloudAudio.currentTime = 0; }
    window.speechSynthesis.cancel(); 
    currentCloudAudio = new Audio("data:audio/mp3;base64," + base64Audio);
    const stopBtn = document.getElementById('stop-audio-btn');
    currentCloudAudio.onplay = () => { isSpeaking = true; if(stopBtn) stopBtn.style.display = 'flex'; };
    currentCloudAudio.onended = () => { isSpeaking = false; if(stopBtn) stopBtn.style.display = 'none'; };
    currentCloudAudio.play();
}

function stopSpeech() {
    window.speechSynthesis.cancel(); 
    if (window.currentAudio) { window.currentAudio.pause(); window.currentAudio.currentTime = 0; }
    isSpeaking = false; 
    const stopBtn = document.getElementById('stop-audio-btn');
    if(stopBtn) stopBtn.style.display = 'none';
}

window.speechSynthesis.onvoiceschanged = getBestTherapistVoice;
function speakResponse(text) { speakText(text); }

let moodChartInstance = null;
const moodValues = { 'Stressed': 1, 'Sad': 2, 'Calm': 3, 'Happy': 4 };

async function loadMoodChart() {
    const canvas = document.getElementById('moodChart');
    if (!canvas) return;
    try {
        const response = await fetch('/get_moods');
        const data = await response.json();
        const labels = data.map(log => {
            const date = new Date(log.time);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        });
        const plotData = data.map(log => moodValues[log.mood] || 2);
        const ctx = canvas.getContext('2d');
        const theme = getThemeColors(); 

        if (moodChartInstance) moodChartInstance.destroy();
        moodChartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: labels, datasets: [{ 
                data: plotData, borderColor: theme.line, backgroundColor: theme.bg, 
                borderWidth: 2, tension: 0.4, fill: true, pointBackgroundColor: 'transparent', pointBorderColor: theme.point, pointBorderWidth: 2, pointRadius: 4 
            }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { min: 0.5, max: 4.5, ticks: { stepSize: 1, color: theme.text, font: {size: 10} }, grid: { color: theme.grid } } } }
        });
        
        if (data.length > 0) {
            const latestMood = data[data.length - 1].mood;
            const insightText = document.getElementById('mood-insight-text');
            if (latestMood === 'Happy') insightText.innerHTML = "You've been feeling <strong>positive</strong>. Keep up the great energy!";
            else if (latestMood === 'Calm') insightText.innerHTML = "Your mood is <strong>steady and calm</strong>. This is a great baseline.";
            else if (latestMood === 'Sad') insightText.innerHTML = "You've been feeling <strong>down</strong> lately. Be kind to yourself.";
            else if (latestMood === 'Stressed') insightText.innerHTML = "Your <strong>stress levels are high</strong>. Try the breathing tool.";
        }
    } catch (error) { console.error("Chart error:", error); }
}

function saveMood(mood) {
    fetch("/save_mood", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mood: mood }) }).then(() => loadMoodChart());
    addMessage(`Mood logged: ${mood}.`, "bot");
}

let radarChartInstance = null;
let lastEmotionData = null; 

function updateEmotionRadar(emotionData) {
    if (!emotionData || emotionData.length === 0) return;
    lastEmotionData = emotionData; 
    
    const canvas = document.getElementById('emotionRadarChart');
    if (!canvas) return;
    
    let dominantEmotion = emotionData.reduce((max, obj) => (obj.score > max.score) ? obj : max);
    document.getElementById('radar-insight-box').style.display = "flex";
    const emotionName = dominantEmotion.label.charAt(0).toUpperCase() + dominantEmotion.label.slice(1);
    document.getElementById('radar-insight-text').innerHTML = `My analysis detects <strong>${emotionName}</strong> as your primary emotion.`;

    const labels = ['Joy', 'Surprise', 'Neutral', 'Sadness', 'Fear', 'Disgust', 'Anger'];
    const dataPoints = labels.map(label => {
        const found = emotionData.find(e => e.label.toLowerCase() === label.toLowerCase());
        return found ? (found.score * 100).toFixed(1) : 0;
    });

    const ctx = canvas.getContext('2d');
    const theme = getThemeColors(); 

    if (radarChartInstance) radarChartInstance.destroy(); 
    radarChartInstance = new Chart(ctx, {
        type: 'radar',
        data: { labels: labels, datasets: [{ data: dataPoints, backgroundColor: theme.bg, borderColor: theme.line, pointBackgroundColor: theme.point, borderWidth: 2 }] },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            scales: { r: { angleLines: { color: theme.grid }, grid: { color: theme.grid }, pointLabels: { color: theme.text, font: { size: 10, family: 'Plus Jakarta Sans', weight: '600' } }, ticks: { display: false, min: 0, max: 100 } } }, 
            plugins: { legend: { display: false } } 
        }
    });
}

async function loadSidebarSessions() {
    const historyList = document.getElementById("history-list");
    if (!historyList) return;
    try {
        const response = await fetch("/get_sessions");
        const sessions = await response.json();
        historyList.innerHTML = "";
        if (sessions.length === 0) { historyList.innerHTML = '<div class="empty" style="font-size:0.85rem; opacity:0.5;">No recent chats</div>'; return; }
        sessions.forEach(sess => {
            const div = document.createElement("div"); div.className = "history-item";
            div.onclick = () => loadChatThread(sess.session_id);
            const titleSpan = document.createElement("span"); titleSpan.className = "history-title"; titleSpan.innerText = sess.title; 
            const delBtn = document.createElement("button"); delBtn.className = "icon-btn dots-btn"; delBtn.innerHTML = icons.trash; 
            delBtn.style.width = '24px'; delBtn.style.height = '24px';
            delBtn.onclick = (e) => { e.stopPropagation(); deleteEntireSession(sess.session_id); };
            div.appendChild(titleSpan); div.appendChild(delBtn); historyList.appendChild(div);
        });
    } catch (error) {}
}

async function loadChatThread(sessionId) {
    currentSessionId = sessionId; sessionMemory = [];
    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML = '<div class="msg bot">Loading previous session...</div>';
    try {
        const response = await fetch(`/get_chat/${sessionId}`);
        const chats = await response.json();
        chatBox.innerHTML = "";
        if (!chats || chats.length === 0) { chatBox.innerHTML = '<div class="msg bot">This conversation is empty.</div>'; return; }
        chats.forEach(chat => {
            if (chat.user) { addMessage(chat.user, "user"); sessionMemory.push({ role: "User", text: chat.user }); }
            if (chat.bot) { addMessage(chat.bot, "bot"); sessionMemory.push({ role: "SafeMind AI", text: chat.bot }); }
        });
        setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 100);
    } catch (error) { chatBox.innerHTML = '<div class="msg bot" style="color: #ef4444;">Error loading chat.</div>'; }
}

async function sendMessage() {
    const input = document.getElementById("user-input");
    const message = input.value.trim();
    if (!message) return;
    const isFirstMessage = document.querySelectorAll('.msg.user').length === 0;
    addMessage(message, "user");
    sessionMemory.push({ role: "User", text: message });
    input.value = "";
    
    const liveTranscript = document.getElementById("live-transcript");
    if(liveTranscript) liveTranscript.innerText = "Analyzing...";

    const loadingBubble = addMessage("Thinking...", "bot");
    try {
        const selectedLang = document.getElementById("mic-lang") ? document.getElementById("mic-lang").value : 'en-US';

        const response = await fetch("/analyze", { 
            method: "POST", headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ message: message, history: sessionMemory.slice(-6), session_id: currentSessionId, language: selectedLang }) 
        });
        const data = await response.json();
        loadingBubble.remove();
        addMessage(data.response, "bot");
        sessionMemory.push({ role: "SafeMind AI", text: data.response });
        if (data.emotions) updateEmotionRadar(data.emotions);
        
       if (data.audio) {
            let audio = new Audio("data:audio/mp3;base64," + data.audio);
            const stopBtn = document.getElementById('stop-audio-btn');
            audio.play();
            if (stopBtn) stopBtn.style.display = 'flex'; 
            audio.onended = function() { if (stopBtn) stopBtn.style.display = 'none'; };
            window.currentAudio = audio; 
        } else {
            speakResponse(data.response);
        }
        if (isFirstMessage) loadSidebarSessions();
    } catch (error) { loadingBubble.innerText = "Connection lost."; }
}

function addMessage(text, sender) {
    const chatBox = document.getElementById("chat-box");
    if (!chatBox) return;
    const msgDiv = document.createElement("div"); msgDiv.className = `msg ${sender}`;
    const textSpan = document.createElement("span"); textSpan.innerText = text;
    msgDiv.appendChild(textSpan); chatBox.appendChild(msgDiv); chatBox.scrollTop = chatBox.scrollHeight;
    return msgDiv;
}

async function deleteEntireSession(sessionId) {
    if(!confirm("Delete this conversation permanently?")) return;
    await fetch("/delete_session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sessionId }) });
    if (currentSessionId === sessionId) clearChat();
    loadSidebarSessions();
}

function clearChat() {
    const chatBox = document.getElementById("chat-box");
    if(chatBox) chatBox.innerHTML = '';
    sessionMemory = []; currentSessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    const lungsContainer = document.getElementById('lungs-container');
    if (lungsContainer) {
        lungsContainer.style.display = 'flex';
        setTimeout(() => lungsContainer.style.opacity = '1', 50);
    }
}

document.getElementById("user-input")?.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessage(); });

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition; let isListening = false;
if (SpeechRecognition) {
    recognition = new SpeechRecognition(); recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'en-US';
    recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
        document.getElementById("user-input").value = transcript;
        const liveTranscript = document.getElementById("live-transcript");
        if(liveTranscript) liveTranscript.innerText = transcript;
    };
    recognition.onend = () => { 
        isListening = false; 
        document.body.classList.remove('voice-listening');
        if(document.getElementById("voice-status")) document.getElementById("voice-status").style.display = "none"; 
        const inputText = document.getElementById("user-input").value.trim();
        if (inputText.length > 0) { toggleVoiceMode(false); sendMessage(); } else { toggleVoiceMode(false); }
    };
    recognition.onerror = () => { recognition.onend(); };
}

function toggleVoiceMode(show) {
    const voiceMode = document.getElementById('mobile-voice-mode');
    if (show) {
        voiceMode.classList.add('active'); document.body.classList.add('voice-active');
    } else {
        voiceMode.classList.remove('active'); document.body.classList.remove('voice-active');
        if (isListening) recognition.stop();
    }
}

function toggleListening() {
    if (!SpeechRecognition) return alert("Browser doesn't support voice chat.");
    if (isListening) { 
        recognition.stop(); document.body.classList.remove('voice-listening'); 
    } else { 
        document.getElementById("user-input").value = ""; 
        document.getElementById("live-transcript").innerText = "I'm listening..."; 
        const selectedLang = document.getElementById("mic-lang") ? document.getElementById("mic-lang").value : 'en-US';
        recognition.lang = selectedLang; recognition.start(); isListening = true; toggleVoiceMode(true);
        document.body.classList.add('voice-listening');
        if (document.getElementById("voice-status")) document.getElementById("voice-status").style.display = "block"; 
    }
}

let breathInterval; let breathTimeouts = [];
function startBreathing() {
    const modal = document.getElementById('breathe-modal'); const circle = document.getElementById('breathe-circle'); const text = document.getElementById('breathe-text');
    modal.classList.add('active'); window.speechSynthesis.cancel();
    circle.style.transition = 'none'; circle.style.transform = 'scale(1)'; circle.classList.remove('pulse');
    text.innerText = 'Closing your eyes helps.'; speakText("Get ready. Close your eyes, and just follow my voice.");
    breathTimeouts.push(setTimeout(() => { runGuidedCycle(); breathInterval = setInterval(runGuidedCycle, 19000); }, 4500));
}

function runGuidedCycle() {
    const circle = document.getElementById('breathe-circle'); const text = document.getElementById('breathe-text');
    text.innerText = 'Breathe In'; speakText("Breathe in.");
    circle.classList.add('pulse'); circle.style.transition = 'transform 4s cubic-bezier(0.4, 0, 0.2, 1)'; circle.style.transform = 'scale(3)';
    breathTimeouts.push(setTimeout(() => { text.innerText = 'Hold'; speakText("Hold."); circle.style.transition = 'none'; }, 4000));
    breathTimeouts.push(setTimeout(() => { text.innerText = 'Breathe Out'; speakText("Breathe out slowly."); circle.classList.remove('pulse'); circle.style.transition = 'transform 8s cubic-bezier(0.4, 0, 0.2, 1)'; circle.style.transform = 'scale(1)'; }, 11000));
}

function stopBreathing() {
    document.getElementById('breathe-modal')?.classList.remove('active'); window.speechSynthesis.cancel(); clearInterval(breathInterval);
    breathTimeouts.forEach(t => clearTimeout(t)); breathTimeouts = [];
    document.getElementById('breathe-circle').style.transform = 'scale(1)'; document.getElementById('breathe-circle').classList.remove('pulse'); document.getElementById('breathe-text').innerText = 'Ready?';
}

function switchMobileTab(tabName) {
    document.body.classList.remove('mobile-tab-history', 'mobile-tab-chat', 'mobile-tab-tools', 'mobile-tab-account');
    document.body.classList.add('mobile-tab-' + tabName);
    document.querySelectorAll('.mobile-nav-item').forEach(el => { el.classList.remove('active'); });
    const selectedBtn = document.getElementById('nav-' + tabName);
    if (selectedBtn) selectedBtn.classList.add('active');
    if (tabName === 'chat') { const chatBox = document.getElementById("chat-box"); if (chatBox) setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 50); }
}

function closeAllPanels(clickedIcon) {
    document.querySelectorAll('.side-panel').forEach(panel => { panel.classList.remove('active'); });
    document.querySelectorAll('.side-nav-icons .icon-pill').forEach(icon => { icon.classList.remove('active'); });
    if (clickedIcon) { clickedIcon.classList.add('active'); } else { document.querySelector('.side-nav-icons .icon-pill').classList.add('active'); }
}

function togglePanel(panelId, iconElement) {
    const targetPanel = document.getElementById(panelId);
    const isActive = targetPanel.classList.contains('active');
    closeAllPanels(null);
    if (!isActive) {
        targetPanel.classList.add('active'); iconElement.classList.add('active');
        if (panelId === 'panel-analytics') setTimeout(() => { if (moodChartInstance) moodChartInstance.resize(); }, 300);
        if (panelId === 'panel-radar') setTimeout(() => { if (radarChartInstance) radarChartInstance.resize(); }, 300); 
    } else {
        document.querySelector('.side-nav-icons .icon-pill').classList.add('active');
    }
}