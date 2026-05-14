let sessionMemory = [];
let currentSessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
let isSpeaking = false;

function toggleThemeMenu() {
    const menu = document.getElementById('theme-menu');
    menu.classList.toggle('active');
}

document.addEventListener('click', function(event) {
    const themeWrapper = document.getElementById('theme-dropdown-wrapper');
    const themeMenu = document.getElementById('theme-menu');
    if (themeWrapper && themeMenu && !themeWrapper.contains(event.target)) {
        themeMenu.classList.remove('active');
    }
    
    const langWrapper = document.getElementById('lang-dropdown-wrapper');
    const langMenu = document.getElementById('lang-menu');
    if (langWrapper && langMenu && !langWrapper.contains(event.target)) {
        langMenu.classList.remove('active');
    }
});

function toggleLangMenu() {
    document.getElementById('lang-menu').classList.toggle('active');
}

function selectLang(val, label, element) {
    document.getElementById('mic-lang').value = val;
    document.getElementById('current-lang-display').innerText = label;
    document.getElementById('lang-menu').classList.remove('active');
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
    }, 300);
}

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

const icons = { trash: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>` };

document.addEventListener("DOMContentLoaded", async () => {
    if (!localStorage.getItem('safeminds_ftue_accepted')) {
        const safetyModal = document.getElementById('safety-modal');
        if (safetyModal) safetyModal.classList.add('active');
    }

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

    // Load Clinical Safety Plan from local storage
    const triggers = localStorage.getItem('safeminds_safety_triggers');
    const coping = localStorage.getItem('safeminds_safety_coping');
    const contacts = localStorage.getItem('safeminds_safety_contacts');
    if(triggers && document.getElementById('safety-triggers')) document.getElementById('safety-triggers').value = triggers;
    if(coping && document.getElementById('safety-coping')) document.getElementById('safety-coping').value = coping;
    if(contacts && document.getElementById('safety-contacts')) document.getElementById('safety-contacts').value = contacts;

    if (document.getElementById("history-list")) {
        await loadSidebarSessions();
        await loadMoodChart();
        await loadDashboardStats();     
        await loadMainDashboardChart();
    }
});

function saveSafetyPlan() {
    localStorage.setItem('safeminds_safety_triggers', document.getElementById('safety-triggers').value);
    localStorage.setItem('safeminds_safety_coping', document.getElementById('safety-coping').value);
    localStorage.setItem('safeminds_safety_contacts', document.getElementById('safety-contacts').value);
    
    const msg = document.getElementById('safety-save-msg');
    msg.style.display = "block";
    setTimeout(() => { msg.style.display = "none"; }, 3000);
}

function acceptSafety() {
    localStorage.setItem('safeminds_ftue_accepted', 'true');
    closeModal('safety-modal');
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
    chatBox.innerHTML = '';
    addMessage("Loading previous session...", "bot", true);
    
    try {
        const response = await fetch(`/get_chat/${sessionId}`);
        const chats = await response.json();
        chatBox.innerHTML = "";
        
        const icebreakers = document.getElementById("chat-icebreakers");

        if (!chats || chats.length === 0) { 
            addMessage("This conversation is empty.", "bot", true);
            if (icebreakers) icebreakers.style.display = "flex";
            return; 
        }

        if (icebreakers) icebreakers.style.display = "none";

        chats.forEach(chat => {
            if (chat.user) { addMessage(chat.user, "user", true); sessionMemory.push({ role: "User", text: chat.user }); }
            if (chat.bot) { addMessage(chat.bot, "bot", true); sessionMemory.push({ role: "SafeMind AI", text: chat.bot }); }
        });
        setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 100);
    } catch (error) { chatBox.innerHTML = '<div class="msg bot" style="color: #ef4444;">Error loading chat.</div>'; }
}

function sendIcebreaker(text) {
    const input = document.getElementById("user-input");
    if (input) {
        input.value = text;
        sendMessage();
    }
}

async function sendMessage() {
    const input = document.getElementById("user-input");
    const message = input.value.trim();
    if (!message) return;
    const isFirstMessage = document.querySelectorAll('.msg.user').length === 0;
    
    const icebreakers = document.getElementById("chat-icebreakers");
    if (icebreakers) icebreakers.style.display = "none";

    const sendBtn = document.getElementById("send-btn");
    if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = "0.5"; }

    addMessage(message, "user");
    sessionMemory.push({ role: "User", text: message });
    input.value = "";
    
    const liveTranscript = document.getElementById("live-transcript");
    if(liveTranscript) liveTranscript.innerText = "Analyzing...";

    const loadingBubble = addMessage("Thinking...", "bot", true);
    try {
        const selectedLang = document.getElementById("mic-lang") ? document.getElementById("mic-lang").value : 'en-US';

        const response = await fetch("/analyze", { 
            method: "POST", headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ message: message, history: sessionMemory.slice(-12), session_id: currentSessionId, language: selectedLang }) 
        });
        const data = await response.json();
        loadingBubble.remove();
        
        addMessage(data.response, "bot", false, data.tool);
        sessionMemory.push({ role: "SafeMind AI", text: data.response });
        
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
    } catch (error) { 
        loadingBubble.remove();
        addMessage("Connection lost.", "bot", true); 
    } finally {
        if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = "1"; }
    }
}

// ✨ TRUE AGENTIC ROUTING & TYPEWRITER UX
function addMessage(text, sender, skipTyping = false, tool = null) {
    const chatBox = document.getElementById("chat-box");
    if (!chatBox) return;
    
    const msgDiv = document.createElement("div"); 
    msgDiv.className = `msg ${sender}`;
    
    const textSpan = document.createElement("span"); 
    msgDiv.appendChild(textSpan); 
    
    // 🧠 AUTONOMOUS AGENT LOGIC
    function injectProactiveButtons() {
        if (sender === "bot" && tool) {
            const btn = document.createElement("button");
            btn.className = tool === "BURN" ? "inline-action-btn danger-action" : "inline-action-btn";
            
            if (tool === "BURN") {
                btn.innerHTML = "🔥 Try Release Exercise";
                btn.onclick = () => openModal('burn-modal');
            } else if (tool === "CBT") {
                btn.innerHTML = "📝 Start CBT Record";
                btn.onclick = () => openModal('cbt-modal');
            } else if (tool === "PHQ9") {
                btn.innerHTML = "📋 Take PHQ-9 Check-in";
                btn.onclick = () => openModal('phq-modal');
            }
            msgDiv.appendChild(document.createElement("br"));
            msgDiv.appendChild(btn);
        }
    }

    if (sender === "bot" && !skipTyping && text !== "Thinking..." && text !== "Connection lost." && text !== "Loading previous session..." && text !== "This conversation is empty.") {
        let i = 0;
        function typeWriter() {
            if (i < text.length) {
                textSpan.innerHTML += text.charAt(i);
                i++;
                chatBox.scrollTop = chatBox.scrollHeight;
                setTimeout(typeWriter, 12);
            } else {
                injectProactiveButtons();
            }
        }
        typeWriter();
    } else {
        textSpan.innerText = text;
        injectProactiveButtons();
    }

    chatBox.appendChild(msgDiv); 
    chatBox.scrollTop = chatBox.scrollHeight;
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
    
    const icebreakers = document.getElementById("chat-icebreakers");
    if (icebreakers) icebreakers.style.display = "flex";

    const lungsContainer = document.getElementById('lungs-container');
    if (lungsContainer) {
        lungsContainer.style.display = 'flex';
        setTimeout(() => lungsContainer.style.opacity = '1', 50);
    }
}

document.getElementById("user-input")?.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessage(); });

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

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        alert("Speech Recognition is not supported in this browser. Use Chrome or Edge.");
        return null;
    }

    const recog = new SpeechRecognition();

    recog.continuous = true;
    recog.interimResults = true;
    recog.maxAlternatives = 1;

    const langSelector = document.getElementById("mic-lang");
    recog.lang = langSelector ? langSelector.value : "en-US";

    recog.onstart = () => {
        isListening = true;
        manuallyStopped = false;
        finalTranscript = '';

        const input = document.getElementById("user-input");
        if (input) input.value = '';

        const liveTranscript = document.getElementById("live-transcript");
        if (liveTranscript) liveTranscript.innerText = "Listening...";

        toggleVoiceMode(true);
        
        // Only run the visualizer on Desktop to prevent Android Mic Stealing
        if (window.innerWidth > 768) {
            startVoiceVisualizer(); 
        }
    };

    recog.onresult = (event) => {
        let fullText = '';
        for (let i = 0; i < event.results.length; i++) {
            let chunk = event.results[i][0].transcript;
            
            // If the new chunk already contains everything we have so far, 
            // Android is accumulating the string for us. Replace it.
            if (fullText.trim().length > 0 && chunk.toLowerCase().includes(fullText.toLowerCase().trim())) {
                fullText = chunk;
            } else {
                // Otherwise (like on Desktop), it's a new distinct chunk. Append it.
                fullText += chunk;
            }
        }

        const input = document.getElementById("user-input");
        if (input) input.value = fullText;

        const liveTranscript = document.getElementById("live-transcript");
        if (liveTranscript) liveTranscript.innerText = fullText || "Listening...";
    };

    recog.onerror = (event) => {
        console.error("🎤 Speech Error:", event.error);
        stopListening(false);
    };

    recog.onend = () => {
        isListening = false;
        
        if (!manuallyStopped) {
            // Android stopped it automatically. SEND whatever was captured!
            cleanupVoiceUI(true); 
        } else {
            // User manually clicked the stop/send button
            cleanupVoiceUI(true);
        }
    };
    
    return recog;
}

function toggleListening() {
    const voiceMode = document.getElementById('mobile-voice-mode');
    const isUIOpen = voiceMode && voiceMode.classList.contains('active');

    window.speechSynthesis.cancel();
    if (typeof currentCloudAudio !== 'undefined' && currentCloudAudio) {
        currentCloudAudio.pause();
        currentCloudAudio.currentTime = 0;
    }

    if (isListening || isUIOpen) {
        stopListening(true);
        return;
    }

    if (recognition) {
        try { recognition.stop(); } catch (e) {}
        recognition = null;
    }

    recognition = createRecognition();
    if (!recognition) return;

    try { recognition.start(); } catch (err) { cleanupVoiceUI(false); }
}

function stopListening(sendAfter = true) {
    manuallyStopped = true;
    if (recognition) {
        try { recognition.onend = null; recognition.stop(); } catch (e) { }
    }
    isListening = false;
    cleanupVoiceUI(sendAfter);
}

function cleanupVoiceUI(sendAfter = true) {
    stopVoiceVisualizer();

    const input = document.getElementById("user-input");
    const hasText = input && input.value.trim().length > 0;

    if (sendAfter && hasText) {
        const liveTranscript = document.getElementById("live-transcript");
        if (liveTranscript) liveTranscript.innerText = "Analyzing audio...";
        
        setTimeout(() => {
            toggleVoiceMode(false);
            sendMessage();
        }, 800); 
    } else {
        toggleVoiceMode(false);
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
    } else {
        document.querySelector('.side-nav-icons .icon-pill').classList.add('active');
    }
}

let audioContext = null; let analyser = null; let microphoneStream = null; let visualizerFrame = null;

async function startVoiceVisualizer() {
    try {
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
            if (!isListening) return;
            visualizerFrame = requestAnimationFrame(animateVisualizer);
            analyser.getByteFrequencyData(dataArray);
            let sum = 0; for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
            let averageVolume = sum / bufferLength;
            let scaleMultiplier = 1 + (averageVolume / 255) * 1.5; 
            if (waveCore) {
                waveCore.style.transform = `scale(${scaleMultiplier})`;
                waveCore.style.boxShadow = `0 0 ${40 * scaleMultiplier}px var(--primary)`;
            }
        }
        animateVisualizer();
    } catch (err) { console.warn("Visualizer could not access stream:", err); }
}

function stopVoiceVisualizer() {
    if (visualizerFrame) cancelAnimationFrame(visualizerFrame);
    if (audioContext) audioContext.close();
    const waveCore = document.querySelector('.wave-core');
    if (waveCore) { waveCore.style.transform = 'scale(1)'; waveCore.style.boxShadow = '0 0 40px var(--glow-2)'; }
}

function switchMainView(viewName) {
    const views = ['dashboard', 'chat', 'journal'];
    const targetIndex = views.indexOf(viewName);

    views.forEach((v, index) => {
        const panel = document.getElementById('view-' + v);
        const btn = document.getElementById('nav-' + v);
        const mobileBtn = document.getElementById('nav-mobile-' + v);

        if (panel) panel.classList.remove('active', 'slide-left', 'slide-right');
        if (btn) btn.classList.remove('active');
        if (mobileBtn) mobileBtn.classList.remove('active');

        if (index === targetIndex) {
            if (panel) panel.classList.add('active');
            if (btn) btn.classList.add('active');
            if (mobileBtn) mobileBtn.classList.add('active'); 
        } else if (index < targetIndex) {
            if (panel) panel.classList.add('slide-left');
        } else {
            if (panel) panel.classList.add('slide-right');
        }
    });

    if (viewName === 'journal') loadJournals();
    if (viewName === 'chat') { 
        const chatBox = document.getElementById("chat-box"); 
        if (chatBox) setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 50); 
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

document.addEventListener('click', function(event) {
    if (event.target.classList.contains('clinical-modal')) event.target.classList.remove('active');
});

function submitCBT() {
    const situation = document.getElementById('cbt-situation').value;
    const thought = document.getElementById('cbt-thought').value;
    const reframe = document.getElementById('cbt-reframe').value;
    if (!situation || !thought || !reframe) { alert("Please fill out all fields."); return; }
    closeModal('cbt-modal');
    switchMainView('chat');
    const inputField = document.getElementById("user-input");
    if(inputField) {
        inputField.value = `I just completed a CBT exercise. Trigger: "${situation}". Thought: "${thought}". Reframe: "${reframe}".`;
        sendMessage();
    }
}

function submitPHQ() {
    const scores = document.querySelectorAll('.phq-score');
    let totalScore = 0;
    scores.forEach(select => totalScore += parseInt(select.value));
    closeModal('phq-modal');
    alert(`Your PHQ check-in score is ${totalScore}/9. This has been logged to your emotional trends.`);
    switchMainView('chat');
    const inputField = document.getElementById("user-input");
    if(inputField) { inputField.value = `I just took a PHQ check-in and scored ${totalScore}.`; sendMessage(); }
}

function igniteThought() {
    const input = document.getElementById('burn-input');
    const container = document.getElementById('paper-container');
    const btn = document.getElementById('ignite-btn');
    
    if (!input.value.trim()) { 
        alert("Please write a thought you want to let go of first."); 
        return; 
    }

    btn.style.display = "none";
    input.classList.add('burning-paper');
    
    for (let i = 0; i < 35; i++) {
        let ember = document.createElement('div');
        ember.className = 'ember';
        ember.style.left = (Math.random() * 90 + 5) + '%';
        ember.style.setProperty('--rand-x', (Math.random() * 120 - 60) + 'px');
        let size = (Math.random() * 5 + 3) + 'px';
        ember.style.width = size;
        ember.style.height = size;
        ember.style.animationDelay = (Math.random() * 1.5) + 's';
        ember.style.animationDuration = (Math.random() * 1.5 + 1.5) + 's';
        
        container.appendChild(ember);
    }
    
    let utter = new SpeechSynthesisUtterance("Whoosh.");
    utter.volume = 0.5; utter.rate = 1.5;
    window.speechSynthesis.speak(utter);

    setTimeout(() => {
        closeModal('burn-modal');
        switchMainView('chat');
        
        const chatInput = document.getElementById("user-input");
        if(chatInput) {
            chatInput.value = "I just wrote down a negative thought and burned it in the Release Exercise. I feel a bit lighter.";
            sendMessage();
        }
        
        setTimeout(resetBurn, 800);
    }, 2800);
}

function resetBurn() {
    const input = document.getElementById('burn-input');
    const btn = document.getElementById('ignite-btn');
    
    if(input) { 
        input.value = ""; 
        input.classList.remove('burning-paper'); 
    }
    if(btn) btn.style.display = "block";
    
    document.querySelectorAll('.ember').forEach(e => e.remove());
}

const saveJournalBtn = document.getElementById('save-journal-btn');
const journalInput = document.getElementById('journal-input');
const journalFeed = document.getElementById('journal-feed');

let journalRecog = null;
let isJournalMicActive = false;
let originalJournalText = '';

function toggleJournalMic() {
    const btn = document.getElementById('journal-mic-btn');
    const input = document.getElementById('journal-input');

    if (isJournalMicActive && journalRecog) {
        journalRecog.stop();
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Speech recognition not supported in this browser."); return; }

    journalRecog = new SpeechRecognition();
    journalRecog.continuous = true;
    journalRecog.interimResults = true;
    journalRecog.lang = document.getElementById('journal-mic-lang') ? document.getElementById('journal-mic-lang').value : 'en-US';

    journalRecog.onstart = () => {
        isJournalMicActive = true;
        btn.classList.add('recording');
        btn.innerHTML = '🛑';
        originalJournalText = input.value; 
    };

    journalRecog.onresult = (event) => {
        let spokenText = '';
        for (let i = 0; i < event.results.length; i++) {
            let chunk = event.results[i][0].transcript;
            if (spokenText.trim().length > 0 && chunk.toLowerCase().includes(spokenText.toLowerCase().trim())) {
                spokenText = chunk; 
            } else {
                spokenText += chunk; 
            }
        }
        input.value = originalJournalText + (originalJournalText.endsWith(' ') || originalJournalText === '' ? '' : ' ') + spokenText;
    };

    journalRecog.onend = () => {
        isJournalMicActive = false;
        btn.classList.remove('recording');
        btn.innerHTML = '🎙️';
    };

    journalRecog.start();
}

if (saveJournalBtn) {
    saveJournalBtn.addEventListener('click', async () => {
        const text = journalInput.value.trim();
        if (!text) return;

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
                journalInput.value = ''; 
                loadJournals(); 
            }
        } catch (error) { console.error("Error saving journal:", error); }

        saveJournalBtn.innerText = "Save Entry";
        saveJournalBtn.disabled = false;
    });
}

function getEmotionColor(emotion) {
    const e = (emotion || '').toLowerCase();
    if (e.includes('joy') || e.includes('happy') || e.includes('hope')) return { bg: 'rgba(16, 185, 129, 0.2)', text: '#34d399' }; 
    if (e.includes('sad') || e.includes('grief')) return { bg: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa' }; 
    if (e.includes('anxi') || e.includes('stress') || e.includes('fear') || e.includes('overwhelm')) return { bg: 'rgba(139, 92, 246, 0.2)', text: '#a78bfa' }; 
    if (e.includes('ang') || e.includes('frustrat')) return { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171' }; 
    return { bg: 'rgba(255, 255, 255, 0.1)', text: '#cbd5e1' }; 
}

async function deleteJournal(id) {
    if (!confirm("Are you sure you want to delete this reflection?")) return;
    try {
        await fetch('/delete_journal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id }) });
        loadJournals();
    } catch (e) { console.error(e); }
}

async function loadJournals() {
    if (!journalFeed) return;
    try {
        const response = await fetch('/get_journals');
        const journals = await response.json();
        journalFeed.innerHTML = ''; 
        
        if (journals.length === 0) {
            journalFeed.innerHTML = '<p style="color: #64748b; text-align: center;">Your journal is empty. Start writing above!</p>';
            return;
        }

        journals.forEach(j => {
            const dateObj = new Date(j.timestamp);
            const dateString = dateObj.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const timeString = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            const colors = getEmotionColor(j.emotion_tag);

            const card = document.createElement('div');
            card.className = 'journal-card';
           card.innerHTML = `
                <div class="journal-card-header">
                    <div class="emotion-pill" style="background: ${colors.bg}; color: ${colors.text}; border-color: ${colors.text}50;">${j.emotion_tag}</div>
                    <button class="journal-delete-btn" title="Delete Entry" onclick="deleteJournal(${j.id})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
                <div class="journal-date">${dateString} at ${timeString}</div>
                <div class="journal-text">${j.entry_text}</div>
                <div class="journal-insight">
                    ✨ <b>SafeMind Insight:</b> ${j.ai_insight}
                </div>
            `;
            journalFeed.appendChild(card);
        });
    } catch (error) { console.error("Error loading journals:", error); }
}

async function loadDashboardStats() {
    try {
        const response = await fetch('/get_dashboard_stats');
        const data = await response.json();
        
        document.getElementById('stat-sessions').innerText = data.total_sessions;
        document.getElementById('stat-streak').innerText = `${data.streak} Days`;
        document.getElementById('stat-sentiment').innerText = data.avg_sentiment;
        
        const crisisEl = document.getElementById('stat-crisis');
        const crisisTrend = document.getElementById('stat-crisis-trend');
        crisisEl.innerText = data.crisis_alerts;
        
        if (data.crisis_alerts > 0) {
            crisisEl.style.color = "var(--danger)";
            crisisTrend.innerText = "Action recommended";
            crisisTrend.className = "metric-trend danger";
        } else {
            crisisEl.style.color = "var(--primary)";
            crisisTrend.innerText = "No recent triggers";
            crisisTrend.className = "metric-trend positive";
        }
        
        if (data.streak > 2) {
            document.getElementById('stat-streak-trend').innerText = "↗ Looking good";
            document.getElementById('stat-streak-trend').className = "metric-trend positive";
        } else {
            document.getElementById('stat-streak-trend').innerText = "Keep logging!";
            document.getElementById('stat-streak-trend').className = "metric-trend neutral";
        }

        if (data.total_sessions > 0) {
            document.getElementById('stat-sessions-trend').innerText = "Active user";
            document.getElementById('stat-sessions-trend').className = "metric-trend positive";
        }
    } catch (e) { console.error("Error loading dashboard stats:", e); }
}

let mainDashChartInstance = null;
async function loadMainDashboardChart() {
    const canvas = document.getElementById('mainDashboardChart');
    if (!canvas) return;
    try {
        const response = await fetch('/get_moods');
        const data = await response.json();
        if(data.length === 0) return;

        const labels = data.map(log => {
            const date = new Date(log.time);
            return `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        });
        const plotData = data.map(log => moodValues[log.mood] || 2);
        
        const ctx = canvas.getContext('2d');
        const theme = getThemeColors(); 

        if (mainDashChartInstance) mainDashChartInstance.destroy();
        mainDashChartInstance = new Chart(ctx, {
            type: 'line',
            data: { 
                labels: labels, 
                datasets: [{ 
                    label: 'Mood Level', data: plotData, 
                    borderColor: theme.line, backgroundColor: theme.bg, 
                    borderWidth: 3, tension: 0.4, fill: true, 
                    pointBackgroundColor: theme.bg, pointBorderColor: theme.point, 
                    pointBorderWidth: 2, pointRadius: 5, pointHoverRadius: 7
                }] 
            },
            options: { 
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
                scales: { 
                    x: { display: true, ticks: { color: theme.text } }, 
                    y: { min: 0.5, max: 4.5, ticks: { stepSize: 1, color: theme.text, callback: function(value) {
                        if(value === 1) return 'Stressed'; if(value === 2) return 'Sad';
                        if(value === 3) return 'Calm'; if(value === 4) return 'Happy'; return '';
                    } }, grid: { color: theme.grid } } 
                } 
            }
        });
    } catch (error) { console.error("Main chart error:", error); }
}

function toggleJournalLangMenu() {
    document.getElementById('journal-lang-menu').classList.toggle('active');
}
function selectJournalLang(val, label, element) {
    document.getElementById('journal-mic-lang').value = val;
    document.getElementById('journal-current-lang-display').innerText = label;
    document.getElementById('journal-lang-menu').classList.remove('active');
    document.querySelectorAll('#journal-lang-menu .lang-option').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
}

document.addEventListener('click', function(event) {
    const jLangWrapper = document.getElementById('journal-lang-dropdown-wrapper');
    const jLangMenu = document.getElementById('journal-lang-menu');
    if (jLangWrapper && jLangMenu && !jLangWrapper.contains(event.target)) {
        jLangMenu.classList.remove('active');
    }
});