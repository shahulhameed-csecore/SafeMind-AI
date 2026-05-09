let sessionMemory = [];
let currentSessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
let isSpeaking = false;

// 🎨 PREMIUM FLOATING THEME LOGIC
function toggleThemeMenu() {
    const menu = document.getElementById('theme-menu');
    menu.classList.toggle('active');
}

// Close dropdowns if user clicks outside of them
document.addEventListener('click', function(event) {
    // Theme Menu
    const themeWrapper = document.getElementById('theme-dropdown-wrapper');
    const themeMenu = document.getElementById('theme-menu');
    if (themeWrapper && themeMenu && !themeWrapper.contains(event.target)) {
        themeMenu.classList.remove('active');
    }
    
    // Language Menu
    const langWrapper = document.getElementById('lang-dropdown-wrapper');
    const langMenu = document.getElementById('lang-menu');
    if (langWrapper && langMenu && !langWrapper.contains(event.target)) {
        langMenu.classList.remove('active');
    }
});

// Custom Language Menu Logic
function toggleLangMenu() {
    document.getElementById('lang-menu').classList.toggle('active');
}

function selectLang(val, label, element) {
    // 1. Update the hidden input so the AI knows which language to use
    document.getElementById('mic-lang').value = val;
    
    // 2. Update the button text (EN, தமிழ், etc)
    document.getElementById('current-lang-display').innerText = label;
    
    // 3. Close the menu
    document.getElementById('lang-menu').classList.remove('active');
    
    // 4. Highlight the selected option
    document.querySelectorAll('.lang-option').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
}

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


/* ==========================================
   🎤 FIXED STABLE VOICE ENGINE 🎤
========================================== */

let recognition = null;
let isListening = false;
let finalTranscript = '';
let manuallyStopped = false;

function toggleVoiceMode(show) {
    const voiceMode = document.getElementById('mobile-voice-mode');

    if (!voiceMode) return;

    if (show) {
        voiceMode.classList.add('active');
        document.body.classList.add('voice-active');

        const voiceStatus = document.getElementById("voice-status");
        if (voiceStatus) {
            voiceStatus.style.display = "block";
        }
    } else {
        voiceMode.classList.remove('active');
        document.body.classList.remove('voice-active');

        const voiceStatus = document.getElementById("voice-status");
        if (voiceStatus) {
            voiceStatus.style.display = "none";
        }
    }
}

function createRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        alert("Speech Recognition is not supported in this browser. Use Chrome or Edge.");
        return null;
    }

    const recog = new SpeechRecognition();

    recog.continuous = true;
    recog.interimResults = true;
    recog.maxAlternatives = 1;

    const langSelector = document.getElementById("mic-lang");

    recog.lang = langSelector
        ? langSelector.value
        : "en-US";

    recog.onstart = () => {
        isListening = true;
        manuallyStopped = false;
        finalTranscript = '';

        const input = document.getElementById("user-input");
        if (input) {
            input.value = '';
        }

        const liveTranscript = document.getElementById("live-transcript");
        if (liveTranscript) {
            liveTranscript.innerText = "Listening...";
        }

        toggleVoiceMode(true);
        startVoiceVisualizer(); // 🚨 START VISUALIZER HERE
    };

    recog.onresult = (event) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }

        const fullText = finalTranscript + interimTranscript;
        const input = document.getElementById("user-input");
        if (input) {
            input.value = fullText;
        }

        const liveTranscript = document.getElementById("live-transcript");
        if (liveTranscript) {
            liveTranscript.innerText = fullText || "Listening...";
        }
    };

    recog.onerror = (event) => {
        console.error("🎤 Speech Error:", event.error);
        const liveTranscript = document.getElementById("live-transcript");

        switch (event.error) {
            case "not-allowed":
                if (liveTranscript) {
                    liveTranscript.innerText = "Microphone permission denied.";
                }
                stopListening(false);
                break;
            case "audio-capture":
                if (liveTranscript) {
                    liveTranscript.innerText = "No microphone detected.";
                }
                stopListening(false);
                break;
            case "network":
                if (liveTranscript) {
                    liveTranscript.innerText = "Network issue detected.";
                }
                break;
            case "no-speech":
                if (liveTranscript) {
                    liveTranscript.innerText = "No speech detected...";
                }
                break;
            case "aborted":
                console.log("🎤 Recognition aborted");
                break;
            default:
                if (liveTranscript) {
                    liveTranscript.innerText = "Microphone error occurred.";
                }
        }
    };

    recog.onend = () => {
        console.log("🎤 Mic ended");
        isListening = false;

        if (!manuallyStopped) {
            setTimeout(() => {
                if (!isListening && recognition) {
                    try {
                        recognition.start();
                    } catch (e) {
                        console.error("Restart blocked by browser. Closing UI to prevent freeze.");
                        cleanupVoiceUI(false); 
                    }
                } else if (!recognition) {
                    cleanupVoiceUI(false);
                }
            }, 500);
        } else {
            cleanupVoiceUI(true);
        }
    };

    return recog;
}

function toggleListening() {
    const voiceMode = document.getElementById('mobile-voice-mode');
    const isUIOpen = voiceMode && voiceMode.classList.contains('active');

    // 🚨 SMART INTERRUPTION: Shut the AI up instantly if user taps mic!
    window.speechSynthesis.cancel();
    if (typeof currentCloudAudio !== 'undefined' && currentCloudAudio) {
        currentCloudAudio.pause();
        currentCloudAudio.currentTime = 0;
    }

    // 🚨 STOP MIC or CLOSE STUCK UI
    if (isListening || isUIOpen) {
        stopListening(true);
        return;
    }

    // CLEAN OLD INSTANCE
    if (recognition) {
        try {
            recognition.stop();
        } catch (e) {}
        recognition = null;
    }

    // CREATE NEW INSTANCE
    recognition = createRecognition();

    if (!recognition) return;

    try {
        recognition.start();
    } catch (err) {
        console.error("🎤 Mic start failed:", err);
        cleanupVoiceUI(false);
    }
}

function stopListening(sendAfter = true) {
    manuallyStopped = true;

    if (recognition) {
        try {
            recognition.onend = null;
            recognition.stop();
        } catch (e) {
            console.error(e);
        }
    }

    isListening = false;
    cleanupVoiceUI(sendAfter);
}

function cleanupVoiceUI(sendAfter = true) {
    toggleVoiceMode(false);
    stopVoiceVisualizer(); // 🚨 STOP VISUALIZER HERE

    const liveTranscript = document.getElementById("live-transcript");
    if (liveTranscript) {
        liveTranscript.innerText = "";
    }

    if (sendAfter) {
        const input = document.getElementById("user-input");
        if (input) {
            const text = input.value.trim();
            if (text.length > 0) {
                sendMessage();
            }
        }
    }
}

/* ==========================================
   EXTRA SAFETY FIXES
========================================== */
window.addEventListener('beforeunload', () => {
    if (recognition) {
        try {
            recognition.stop();
        } catch (e) {}
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden && recognition && isListening) {
        stopListening(false);
    }
});

/* ==========================================
   🧘 BREATHE TOOL & NAVIGATION 
========================================== */
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
/* ==========================================
   🎙️ PREMIUM LIVE AUDIO VISUALIZER (ChatGPT Style)
========================================== */
let audioContext = null;
let analyser = null;
let microphoneStream = null;
let visualizerFrame = null;

async function startVoiceVisualizer() {
    try {
        // Request raw audio data from the mic
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphoneStream = audioContext.createMediaStreamSource(stream);
        
        microphoneStream.connect(analyser);
        analyser.fftSize = 256;
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const waveCore = document.querySelector('.wave-core');

        function animateVisualizer() {
            if (!isListening) return; // Stop animating if mic is off
            
            visualizerFrame = requestAnimationFrame(animateVisualizer);
            analyser.getByteFrequencyData(dataArray);
            
            // Calculate average volume
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            let averageVolume = sum / bufferLength;
            
            // Scale the central orb based on how loud the user speaks
            // Base scale is 1.0, max scale is around 2.2 for loud noises
            let scaleMultiplier = 1 + (averageVolume / 255) * 1.5; 
            
            if (waveCore) {
                waveCore.style.transform = `scale(${scaleMultiplier})`;
                // Intensify the glow when speaking louder
                waveCore.style.boxShadow = `0 0 ${40 * scaleMultiplier}px var(--primary)`;
            }
        }
        
        animateVisualizer();
        
    } catch (err) {
        console.warn("Visualizer could not access raw audio stream:", err);
    }
}

function stopVoiceVisualizer() {
    if (visualizerFrame) cancelAnimationFrame(visualizerFrame);
    if (audioContext) audioContext.close();
    
    // Reset the orb to normal size
    const waveCore = document.querySelector('.wave-core');
    if (waveCore) {
        waveCore.style.transform = 'scale(1)';
        waveCore.style.boxShadow = '0 0 40px var(--glow-2)';
    }
}
/* ==========================================
   🚀 SLIDING VIEW NAVIGATION
========================================== */
function switchMainView(viewName) {
    const chatView = document.getElementById('view-chat');
    const dashView = document.getElementById('view-dashboard');
    const navChatBtn = document.getElementById('nav-btn-chat');
    const navDashBtn = document.getElementById('nav-btn-dash');

    if (viewName === 'dashboard') {
        // Slide Chat out to the left, Slide Dashboard in from the right
        chatView.classList.remove('active');
        chatView.classList.add('slide-left');
        
        dashView.classList.remove('slide-right');
        dashView.classList.add('active');

        // Update Button colors
        if(navChatBtn) navChatBtn.classList.remove('active');
        if(navDashBtn) navDashBtn.classList.add('active');
        
    } else if (viewName === 'chat') {
        // Slide Dashboard out to the right, Slide Chat in from the left
        dashView.classList.remove('active');
        dashView.classList.add('slide-right');
        
        chatView.classList.remove('slide-left');
        chatView.classList.add('active');

        // Update Button colors
        if(navDashBtn) navDashBtn.classList.remove('active');
        if(navChatBtn) navChatBtn.classList.add('active');
    }
}
/* ==========================================
   📋 CLINICAL TOOLS & MODALS
========================================== */

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

// Close clinical modals if user clicks the dark background outside the content
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('clinical-modal')) {
        event.target.classList.remove('active');
    }
});

function submitCBT() {
    const situation = document.getElementById('cbt-situation').value;
    const thought = document.getElementById('cbt-thought').value;
    const reframe = document.getElementById('cbt-reframe').value;

    if (!situation || !thought || !reframe) {
        alert("Please fill out the Situation, Thought, and Reframe fields to complete the exercise.");
        return;
    }

    // Normally you would send this to app.py using fetch() here.
    // For now, we simulate success and feed it into the chat!
    closeModal('cbt-modal');
    
    // Switch back to chat view and send a message on their behalf
    switchMainView('chat');
    
    const cbtSummary = `I just completed a CBT exercise. My trigger was: "${situation}". My negative thought was: "${thought}". But I reframed it to: "${reframe}".`;
    
    const inputField = document.getElementById("user-input");
    if(inputField) {
        inputField.value = cbtSummary;
        sendMessage();
    }
}

function submitPHQ() {
    const scores = document.querySelectorAll('.phq-score');
    let totalScore = 0;
    
    scores.forEach(select => {
        totalScore += parseInt(select.value);
    });

    closeModal('phq-modal');
    alert(`Your PHQ check-in score is ${totalScore}/9. This has been logged to your emotional trends.`);
    
    // Switch back to chat so the AI can check on them
    switchMainView('chat');
    const inputField = document.getElementById("user-input");
    if(inputField) {
        inputField.value = `I just took a PHQ check-in and scored ${totalScore}.`;
        sendMessage();
    }
}
// --- NAVIGATION LOGIC ---
const navChat = document.getElementById('nav-chat'); // Make sure your HTML has this ID
const navJournal = document.getElementById('nav-journal'); // Make sure your HTML has this ID
const chatView = document.getElementById('chat-view'); // The wrapper for your chat UI
const journalView = document.getElementById('journal-view');

// Switch to Journal
navJournal.addEventListener('click', () => {
    chatView.style.display = 'none';
    journalView.style.display = 'block';
    loadJournals(); // Fetch past journals when they open the tab
});

// Switch to Chat
navChat.addEventListener('click', () => {
    journalView.style.display = 'none';
    chatView.style.display = 'flex'; // or 'block' depending on your current CSS
});


// --- JOURNAL LOGIC ---
const saveJournalBtn = document.getElementById('save-journal-btn');
const journalInput = document.getElementById('journal-input');
const journalFeed = document.getElementById('journal-feed');

saveJournalBtn.addEventListener('click', async () => {
    const text = journalInput.value.trim();
    if (!text) return;

    // Show loading state
    saveJournalBtn.innerText = "Reflecting...";
    saveJournalBtn.disabled = true;

    try {
        const response = await fetch('/save_journal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entry: text })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            journalInput.value = ''; // Clear the text box
            loadJournals(); // Refresh the feed to show the new entry + AI insight
        }
    } catch (error) {
        console.error("Error saving journal:", error);
    }

    // Restore button
    saveJournalBtn.innerText = "Save Entry";
    saveJournalBtn.disabled = false;
});

// Fetch and display past journals
async function loadJournals() {
    try {
        const response = await fetch('/get_journals');
        const journals = await response.json();
        
        journalFeed.innerHTML = ''; // Clear current list
        
        if (journals.length === 0) {
            journalFeed.innerHTML = '<p style="color: #64748b; text-align: center;">Your journal is empty. Start writing above!</p>';
            return;
        }

        journals.forEach(j => {
            // Format the date nicely
            const dateObj = new Date(j.timestamp);
            const dateString = dateObj.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const timeString = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

            const card = document.createElement('div');
            card.className = 'journal-card';
            card.innerHTML = `
                <div class="journal-date">${dateString} at ${timeString}</div>
                <div class="journal-text">${j.entry_text}</div>
                <div class="journal-insight">
                    ✨ <b>SafeMind Insight:</b> ${j.ai_insight}
                </div>
            `;
            journalFeed.appendChild(card);
        });
    } catch (error) {
        console.error("Error loading journals:", error);
    }
}