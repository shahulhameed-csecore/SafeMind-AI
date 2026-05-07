let sessionMemory = [];
let currentSessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
let isSpeaking = false;

// 🎨 PREMIUM FLOATING THEME LOGIC
function toggleThemeMenu() {
    const menu = document.getElementById('theme-menu');
    menu.classList.toggle('active');
}

document.addEventListener('click', function(event) {
    const wrapper = document.getElementById('theme-dropdown-wrapper');
    const menu = document.getElementById('theme-menu');
    if (wrapper && menu && !wrapper.contains(event.target)) {
        menu.classList.remove('active');
    }
});

function applyTheme(moodId, moodName, primaryHex, secondaryHex) {
    document.body.setAttribute('data-mood', moodId);
    localStorage.setItem('safeminds_theme', moodId);
    
    const nameEl = document.getElementById('current-theme-name');
    if(nameEl) nameEl.innerText = moodName;
    
    const dot = document.getElementById('current-theme-dot');
    if(dot) dot.style.background = `linear-gradient(135deg, ${primaryHex}, ${secondaryHex})`;
    
    document.getElementById('theme-menu').classList.remove('active');
    
    setTimeout(() => {
        if(typeof moodChartInstance !== 'undefined' && moodChartInstance) loadMoodChart(); 
        if(typeof radarChartInstance !== 'undefined' && radarChartInstance && typeof lastEmotionData !== 'undefined' && lastEmotionData) updateEmotionRadar(lastEmotionData);
    }, 300);
}

// 🧠 EMOTIONALLY ADAPTIVE CHART COLOR ENGINE
function getThemeColors() {
    const mood = document.body.getAttribute('data-mood') || 'woods';
    const palettes = {
        'woods':      { text: '#e2e8dd', grid: 'rgba(132, 136, 113, 0.25)', line: '#848871', bg: 'rgba(132, 136, 113, 0.25)', point: '#afb4ad' },
        'sunset':     { text: '#ffffff', grid: 'rgba(194, 102, 167, 0.25)', line: '#c266a7', bg: 'rgba(194, 102, 167, 0.25)', point: '#e7c8e7' },
        'wave':       { text: '#ffffff', grid: 'rgba(79, 165, 216, 0.25)',  line: '#4fa5d8', bg: 'rgba(79, 165, 216, 0.25)',  point: '#daeaf7' },
        'wildflower': { text: '#fdefc0', grid: 'rgba(254, 182, 64, 0.25)',  line: '#feb640', bg: 'rgba(254, 182, 64, 0.25)',  point: '#ffdf7c' },
        'blueberry':  { text: '#ffffff', grid: 'rgba(190, 212, 233, 0.25)', line: '#bed4e9', bg: 'rgba(190, 212, 233, 0.25)', point: '#e7f1fb' },
        'ceiling':    { text: '#ffffff', grid: 'rgba(142, 174, 187, 0.25)', line: '#8eaebb', bg: 'rgba(142, 174, 187, 0.25)', point: '#bdd9cd' },
        'seashore':   { text: '#333333', grid: 'rgba(196, 179, 169, 0.3)',  line: '#97978f', bg: 'rgba(196, 179, 169, 0.4)',  point: '#787775' },
        'peachy':     { text: '#ffddba', grid: 'rgba(217, 174, 142, 0.25)', line: '#d9ae8e', bg: 'rgba(217, 174, 142, 0.25)', point: '#ffddba' },
        'lotus':      { text: '#ffffff', grid: 'rgba(224, 130, 157, 0.25)', line: '#e0829d', bg: 'rgba(224, 130, 157, 0.25)', point: '#dac4d0' },
        'teal':       { text: '#ffffff', grid: 'rgba(134, 185, 176, 0.25)', line: '#86b9b0', bg: 'rgba(134, 185, 176, 0.25)', point: '#d0d6d6' },
        'mist':       { text: '#ffffff', grid: 'rgba(126, 163, 142, 0.25)', line: '#7ea38e', bg: 'rgba(126, 163, 142, 0.25)', point: '#c4d9ce' }
    };
    return palettes[mood] || palettes['woods'];
}

const icons = { trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>` };

document.addEventListener("DOMContentLoaded", async () => {
    const savedTheme = localStorage.getItem('safeminds_theme') || 'woods';
    document.body.setAttribute('data-mood', savedTheme);
    
    const themeMaps = {
        'woods':      { name: 'Into the Woods', p: '#848871', s: '#464b37' },
        'sunset':     { name: 'Purple Sunset',  p: '#c266a7', s: '#52489f' },
        'wave':       { name: 'Under the Wave', p: '#4fa5d8', s: '#0855b1' },
        'wildflower': { name: 'Wildflower',     p: '#feb640', s: '#a46379' },
        'blueberry':  { name: 'Blueberry Bliss',p: '#bed4e9', s: '#3373b0' },
        'ceiling':    { name: 'Ceiling Blues',  p: '#8eaebb', s: '#386994' },
        'seashore':   { name: 'By the Seashore',p: '#97978f', s: '#c4b3a9' },
        'peachy':     { name: 'Peachy Fog',     p: '#d9ae8e', s: '#9f8d8d' },
        'lotus':      { name: 'Peace Lotus',    p: '#e0829d', s: '#8f5774' },
        'teal':       { name: 'Teal Lightning', p: '#86b9b0', s: '#4c7273' },
        'mist':       { name: 'Forest Mist',    p: '#7ea38e', s: '#476355' }
    };
    
    const currMap = themeMaps[savedTheme] || themeMaps['woods'];
    const nameEl = document.getElementById('current-theme-name');
    if(nameEl) nameEl.innerText = currMap.name;
    const dot = document.getElementById('current-theme-dot');
    if(dot) dot.style.background = `linear-gradient(135deg, ${currMap.p}, ${currMap.s})`;

    if (document.getElementById("history-list")) {
        await loadSidebarSessions();
        await loadMoodChart();
    }
});

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

/* 🎤 🚨 FIX: BULLETPROOF VOICE ENGINE 🚨 🎤 */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition; 
let isListening = false;
let finalTranscript = '';

if (SpeechRecognition) {
    recognition = new SpeechRecognition(); 
    recognition.continuous = true; // Keeps listening even if user pauses
    recognition.interimResults = true; // Shows live words 
    
    recognition.onstart = () => {
        isListening = true;
        finalTranscript = '';
        document.getElementById("user-input").value = '';
        
        const liveTranscript = document.getElementById("live-transcript");
        if(liveTranscript) liveTranscript.innerText = "I'm listening...";
        
        toggleVoiceMode(true);
        document.body.classList.add('voice-listening');
        const voiceStatus = document.getElementById("voice-status");
        if (voiceStatus) voiceStatus.style.display = "block";
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        
        const displayText = finalTranscript + interimTranscript;
        
        // Show live text in both places
        document.getElementById("user-input").value = displayText;
        const liveDisplay = document.getElementById("live-transcript");
        if(liveDisplay) liveDisplay.innerText = displayText || "I'm listening...";
    };
    
    recognition.onend = () => { 
        isListening = false; 
        document.body.classList.remove('voice-listening');
        const voiceStatus = document.getElementById("voice-status");
        if(voiceStatus) voiceStatus.style.display = "none"; 
        
        toggleVoiceMode(false); 
        
        // Only trigger message send if text exists 
        const inputText = document.getElementById("user-input").value.trim();
        if (inputText.length > 0) { 
            sendMessage(); 
        }
    };
    
    recognition.onerror = (event) => { 
        console.error("Microphone Error:", event.error);
    };
}

function toggleVoiceMode(show) {
    const voiceMode = document.getElementById('mobile-voice-mode');
    if (!voiceMode) return;
    
    if (show) {
        voiceMode.classList.add('active'); 
        document.body.classList.add('voice-active');
    } else {
        voiceMode.classList.remove('active'); 
        document.body.classList.remove('voice-active');
    }
}

function toggleListening() {
    if (!SpeechRecognition) {
        alert("Your browser doesn't support Voice Chat. Please use Google Chrome or Edge.");
        return;
    }
    
    if (isListening) { 
        // Manually stopping it will trigger onend() which sends the message
        recognition.stop(); 
    } else { 
        // Start listening
        const langSelector = document.getElementById("mic-lang");
        recognition.lang = langSelector ? langSelector.value : 'en-US'; 
        recognition.start(); 
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