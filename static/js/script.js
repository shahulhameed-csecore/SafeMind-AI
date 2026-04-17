let sessionMemory = [];
let currentSessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
let isSpeaking = false;
const icons = { trash: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>` };

document.addEventListener("DOMContentLoaded", async () => {
    if (document.getElementById("history-list")) {
        await loadSidebarSessions();
        await loadMoodChart();
        setTimeout(init3DAvatar, 200);
    }
});

function toggleSpeakingGlow(isSpeaking) {
    const logo = document.getElementById('sm-logo-circle');
    if (!logo) return;
    
    if (isSpeaking) {
        logo.classList.remove('avatar-idle');
        logo.classList.add('avatar-speaking');
    } else {
        logo.classList.remove('avatar-speaking');
        logo.classList.add('avatar-idle');
    }
}

function getBestTherapistVoice(text = "") {
    const voices = window.speechSynthesis.getVoices();
    
    if (/[\u0B80-\u0BFF]/.test(text)) {
        let tamilVoice = voices.find(v => v.name.includes('Google') && v.lang.includes('ta')) || 
                         voices.find(v => v.lang.includes('ta-IN') || v.lang.includes('ta'));
        return tamilVoice; 
    }
    if (/[\u0900-\u097F]/.test(text)) {
        let hindiVoice = voices.find(v => v.name.includes('Google') && v.lang.includes('hi')) || 
                         voices.find(v => v.lang.includes('hi-IN') || v.lang.includes('hi'));
        return hindiVoice;
    }

    let best = voices.find(v => v.name.includes('Natural') && (v.name.includes('Female') || v.name.includes('Jenny')));
    if (!best) best = voices.find(v => v.name.includes('Google US English'));
    if (!best) best = voices.find(v => v.name.includes('Google UK English Female'));
    if (!best) best = voices.find(v => v.name.includes('Samantha') || v.name.includes('Zira'));
    
    return best || voices[0];
}

function speakText(text) {
    window.speechSynthesis.cancel();
    let smoothedText = text.replace(/ \. /g, '... ').replace(/,/g, ', ');
    const utterance = new SpeechSynthesisUtterance(smoothedText);
    
    utterance.voice = getBestTherapistVoice(text);
    
    if (/[\u0B80-\u0BFF]/.test(text) || /[\u0900-\u097F]/.test(text)) {
        utterance.rate = 0.85; 
    } else {
        utterance.rate = 1.05; 
    }
    
    utterance.pitch = 1.05; 
    utterance.volume = 1.0;
    const stopBtn = document.getElementById('stop-audio-btn');

    utterance.onstart = () => { isSpeaking = true; if(stopBtn) stopBtn.style.display = 'flex'; };
    utterance.onend = () => { isSpeaking = false; if(stopBtn) stopBtn.style.display = 'none'; };
    
    if (utterance.voice || !(/[\u0B80-\u0BFF]/.test(text) || /[\u0900-\u097F]/.test(text))) {
        window.speechSynthesis.speak(utterance);
    }
}

let currentCloudAudio = null;

function playCloudAudio(base64Audio) {
    if (currentCloudAudio) {
        currentCloudAudio.pause();
        currentCloudAudio.currentTime = 0;
    }
    window.speechSynthesis.cancel(); 
    
    currentCloudAudio = new Audio("data:audio/mp3;base64," + base64Audio);
    const stopBtn = document.getElementById('stop-audio-btn');

    currentCloudAudio.onplay = () => { isSpeaking = true; if(stopBtn) stopBtn.style.display = 'flex'; };
    currentCloudAudio.onended = () => { isSpeaking = false; if(stopBtn) stopBtn.style.display = 'none'; };
    currentCloudAudio.play();
}

function stopSpeech() {
    window.speechSynthesis.cancel(); 
    if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio.currentTime = 0;
    }
    toggleSpeakingGlow(false); 
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
        if (moodChartInstance) moodChartInstance.destroy();
        moodChartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: labels, datasets: [{ data: plotData, borderColor: '#4A90E2', backgroundColor: 'rgba(74, 144, 226, 0.1)', borderWidth: 2, tension: 0.4, fill: true, pointBackgroundColor: '#050508', pointBorderColor: '#6FCF97', pointBorderWidth: 2, pointRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { min: 0.5, max: 4.5, ticks: { stepSize: 1, color: 'rgba(255,255,255,0.5)', font: {size: 10} }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
        });
        
        if (data.length > 0) {
            const latestMood = data[data.length - 1].mood;
            const insightText = document.getElementById('mood-insight-text');
            if (latestMood === 'Happy') insightText.innerHTML = "You've been feeling <strong>positive</strong>. Keep up the great energy!";
            else if (latestMood === 'Calm') insightText.innerHTML = "Your mood is <strong>steady and calm</strong>. This is a great baseline.";
            else if (latestMood === 'Sad') insightText.innerHTML = "You've been feeling <strong>down</strong> lately. Be kind to yourself.";
            else if (latestMood === 'Stressed') insightText.innerHTML = "Your <strong>stress levels are high</strong>. Consider using the breathing tool.";
        }
    } catch (error) { console.error("Chart error:", error); }
}

function saveMood(mood) {
    fetch("/save_mood", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mood: mood }) }).then(() => loadMoodChart());
    addMessage(`Mood logged: ${mood}.`, "bot");
}

let radarChartInstance = null;
function updateEmotionRadar(emotionData) {
    const canvas = document.getElementById('emotionRadarChart');
    if (!canvas || !emotionData || emotionData.length === 0) return;
    
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
    if (radarChartInstance) {
        radarChartInstance.data.datasets[0].data = dataPoints;
        radarChartInstance.update();
    } else {
        radarChartInstance = new Chart(ctx, {
            type: 'radar',
            data: { labels: labels, datasets: [{ data: dataPoints, backgroundColor: 'rgba(74, 144, 226, 0.2)', borderColor: '#4A90E2', pointBackgroundColor: '#6FCF97', borderWidth: 2 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { r: { angleLines: { color: 'rgba(255,255,255,0.05)' }, grid: { color: 'rgba(255,255,255,0.05)' }, pointLabels: { color: 'rgba(255,255,255,0.6)', font: { size: 9, family: 'Poppins' } }, ticks: { display: false, min: 0, max: 100 } } }, plugins: { legend: { display: false } } }
        });
    }
}

async function loadSidebarSessions() {
    const historyList = document.getElementById("history-list");
    if (!historyList) return;
    try {
        const response = await fetch("/get_sessions");
        const sessions = await response.json();
        historyList.innerHTML = "";
        if (sessions.length === 0) { historyList.innerHTML = '<div class="empty">No recent chats</div>'; return; }
        sessions.forEach(sess => {
            const div = document.createElement("div"); div.className = "history-item";
            
            div.onclick = () => loadChatThread(sess.session_id);
            div.style.cursor = "pointer";

            const titleSpan = document.createElement("span"); titleSpan.className = "history-title"; titleSpan.innerText = sess.title; 
            const delBtn = document.createElement("button"); delBtn.className = "icon-btn dots-btn"; delBtn.innerHTML = icons.trash; 
            delBtn.onclick = (e) => { e.stopPropagation(); deleteEntireSession(sess.session_id); };
            
            div.appendChild(titleSpan); div.appendChild(delBtn); historyList.appendChild(div);
        });
    } catch (error) { historyList.innerHTML = '<div class="empty">Error loading</div>'; }
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
            if (chat.bot) { addMessage(chat.bot, "bot"); sessionMemory.push({ role: "SafeMinds", text: chat.bot }); }
        });
        setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 100);
    } catch (error) { chatBox.innerHTML = '<div class="msg bot" style="color: #e17070;">Error loading chat.</div>'; }
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

    const loadingBubble = addMessage("Typing...", "bot");
    try {
        const selectedLang = document.getElementById("mic-lang") ? document.getElementById("mic-lang").value : 'en-US';

        const response = await fetch("/analyze", { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ 
                message: message, 
                history: sessionMemory.slice(-6), 
                session_id: currentSessionId,
                language: selectedLang
            }) 
        });
        const data = await response.json();
        loadingBubble.remove();
        addMessage(data.response, "bot");
        sessionMemory.push({ role: "SafeMinds", text: data.response });
        if (data.emotions) updateEmotionRadar(data.emotions);
        
       if (data.audio) {
            let audio = new Audio("data:audio/mp3;base64," + data.audio);
            audio.play();
            toggleSpeakingGlow(true);
            audio.onended = function() {
                toggleSpeakingGlow(false);
            };
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
    if(chatBox) chatBox.innerHTML = '<div class="msg bot">New session started. I am here to listen.</div>';
    sessionMemory = []; currentSessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
}

document.getElementById("user-input")?.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessage(); });

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition; let isListening = false;
if (SpeechRecognition) {
    recognition = new SpeechRecognition(); recognition.continuous = true; recognition.interimResults = true; recognition.lang = 'en-US';
    
    recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
        
        document.getElementById("user-input").value = transcript;
        const liveTranscript = document.getElementById("live-transcript");
        if(liveTranscript) liveTranscript.innerText = transcript;
    };
    
    recognition.onend = () => { 
        isListening = false; 
        document.getElementById("mic-btn")?.classList.remove("recording"); 
        document.body.classList.remove('voice-listening');
        if(document.getElementById("voice-status")) document.getElementById("voice-status").style.display = "none"; 
        
        const inputText = document.getElementById("user-input").value.trim();
        if (inputText.length > 0) {
            toggleVoiceMode(false); 
            sendMessage(); 
        } else {
            toggleVoiceMode(false); 
        }
    };
    recognition.onerror = () => { recognition.onend(); };
}

function toggleVoiceMode(show) {
    const voiceMode = document.getElementById('mobile-voice-mode');
    const avatarStage = document.getElementById('avatar-stage');
    const desktopContainer = document.getElementById('desktop-avatar-container');
    const mobilePlaceholder = document.getElementById('mobile-avatar-placeholder');

    if (show) {
        voiceMode.classList.add('active');
        document.body.classList.add('voice-active');
        if (mobilePlaceholder && avatarStage) mobilePlaceholder.appendChild(avatarStage);
        setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    } else {
        voiceMode.classList.remove('active');
        document.body.classList.remove('voice-active');
        if (isListening) recognition.stop();
        if (desktopContainer && avatarStage) desktopContainer.appendChild(avatarStage);
        setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    }
}

function toggleListening() {
    if (!SpeechRecognition) return alert("Browser doesn't support voice chat.");
    if (isListening) { 
        recognition.stop(); 
        document.body.classList.remove('voice-listening'); 
    } else { 
        document.getElementById("user-input").value = ""; 
        document.getElementById("live-transcript").innerText = "I'm listening..."; 
        const selectedLang = document.getElementById("mic-lang") ? document.getElementById("mic-lang").value : 'en-US';
        recognition.lang = selectedLang;
        recognition.start(); 
        isListening = true; 
        toggleVoiceMode(true);
        document.body.classList.add('voice-listening');
        document.getElementById("mic-btn").classList.add("recording"); 
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
    if (tabName === 'chat') {
        const chatBox = document.getElementById("chat-box");
        if (chatBox) setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 50);
    }
}

// ==========================================
// 🧍‍♂️ 3D AVATAR ENGINE
// ==========================================
let scene, camera, renderer, avatar;
let faceMesh = null, mouthMorphIndex = -1, fallbackHeadBone = null;
let leftArmBone = null, rightArmBone = null, leftForearmBone = null, rightForearmBone = null;

function init3DAvatar() {
    const stage = document.getElementById('avatar-stage');
    if (!stage) return;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, stage.clientWidth / stage.clientHeight, 0.1, 100); 
    camera.position.set(0, 1.4, 0.9); 
    camera.lookAt(new THREE.Vector3(0, 1.4, 0));

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); 
    renderer.setSize(stage.clientWidth, stage.clientHeight); 
    renderer.setPixelRatio(window.devicePixelRatio);
    stage.innerHTML = ""; 
    stage.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1));
    const light1 = new THREE.DirectionalLight(0xffffff, 1);
    light1.position.set(0, 2, 2);
    scene.add(light1);
    const light2 = new THREE.DirectionalLight(0x8b5cf6, 0.5);
    light2.position.set(-2, 1, 1);
    scene.add(light2);

    const loader = new THREE.GLTFLoader();
    const modelPath = window.AVATAR_URL || '/static/models/avatar.glb';

    loader.load(modelPath, function (gltf) {
        avatar = gltf.scene; 
        avatar.scale.set(1.65, 1.65, 1.65); 
        const baseY = -1.2; 
        avatar.position.set(0, baseY, 0); 
        avatar.userData.baseY = baseY;

        avatar.traverse((child) => {
            if (child.isMesh && child.morphTargetDictionary) {
                for (let key in child.morphTargetDictionary) {
                    if (key.toLowerCase().includes('mouthopen') || key.toLowerCase().includes('jawopen') || key.toLowerCase().includes('viseme_o') || key.toLowerCase().includes('mouth')) {
                        faceMesh = child; mouthMorphIndex = child.morphTargetDictionary[key]; break;
                    }
                }
            }
            if (child.isBone) {
                const b = child.name.toLowerCase();
                if (b.includes('head')) fallbackHeadBone = child;
                if (b.includes('leftarm') || b.includes('left_arm') || b.includes('mixamorigleftarm') || b.includes('mixamorig:leftarm')) leftArmBone = child;
                if (b.includes('rightarm') || b.includes('right_arm') || b.includes('mixamorigrightarm') || b.includes('mixamorig:rightarm')) rightArmBone = child;
                if (b.includes('leftforearm') || b.includes('left_forearm') || b.includes('mixamorigleftforearm') || b.includes('mixamorig:leftforearm')) leftForearmBone = child;
                if (b.includes('rightforearm') || b.includes('right_forearm') || b.includes('mixamorigrightforearm') || b.includes('mixamorig:rightforearm')) rightForearmBone = child;
            }
        });
        scene.add(avatar);
    }, undefined, function (error) { 
        console.error("Error loading 3D model!", error); 
    });

    function animate() {
        requestAnimationFrame(animate); 
        const time = Date.now() * 0.001;

        if (avatar && avatar.userData.baseY !== undefined) {
            const floatOffset = Math.sin(time * 2) * 0.02; 
            avatar.position.y = avatar.userData.baseY + (isNaN(floatOffset) ? 0 : floatOffset);
            
            if (typeof isSpeaking !== 'undefined' && isSpeaking) {
                const talkSpeed = 15; 
                const mouthAmount = (Math.sin(time * talkSpeed) + 1) / 2;
                if (faceMesh && mouthMorphIndex !== -1) faceMesh.morphTargetInfluences[mouthMorphIndex] = mouthAmount * 0.6;
                else if (fallbackHeadBone) fallbackHeadBone.rotation.x = Math.sin(time * talkSpeed) * 0.05;
            } else {
                if (faceMesh && mouthMorphIndex !== -1) faceMesh.morphTargetInfluences[mouthMorphIndex] = 0;
                else if (fallbackHeadBone) fallbackHeadBone.rotation.x = 0;
            }

            if (leftArmBone) { leftArmBone.rotation.set(0, 0, 1.35); }
            if (rightArmBone) { rightArmBone.rotation.set(0, 0, -1.35); }
            if (leftForearmBone) { leftForearmBone.rotation.set(0, 0, 0); }
            if (rightForearmBone) { rightForearmBone.rotation.set(0, 0, 0); }
        }
        renderer.render(scene, camera);
    }
    
    animate();
    
    window.addEventListener('resize', () => {
        const stage = document.getElementById('avatar-stage');
        if(stage) { 
            camera.aspect = stage.clientWidth / stage.clientHeight; 
            camera.updateProjectionMatrix(); 
            renderer.setSize(stage.clientWidth, stage.clientHeight); 
        }
    });
}