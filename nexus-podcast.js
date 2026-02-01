/**
 * NEXUS PODCAST MODULE - Versión Final con Portal de Resonancia
 */

let podAudioInstance = null; // Evita conflicto con TTS
let podActiveBookId = null;
let podTimer = null;

// Canal de comunicación para evitar audios simultáneos en varias pestañas
const podcastChannel = new BroadcastChannel('nexus_podcast_sync');

podcastChannel.onmessage = (event) => {
    if (event.data === 'pause_others') {
        if (podAudioInstance && !podAudioInstance.paused) {
            console.log("Otra pestaña inició un audio. Pausando esta.");
            togglePodcastPlay(false); 
        }
    }
};

function initPodcast(bookId) {
    // Buscamos el libro en la librería global
    const book = library.find(b => b.id === bookId);
    if (!book || !book.podcastUrl) return;

    const playerContainer = document.getElementById('podcast-player-container');
    const audioEl = document.getElementById('main-podcast-audio');
    
    // Si es el mismo libro, alternamos play/pause
    if (podActiveBookId === bookId) {
        togglePodcastPlay();
        return;
    }

    // Limpiar instancia previa
    if (podAudioInstance) {
        podAudioInstance.pause();
        clearInterval(podTimer);
    }

    // Actualizar badges visuales en la biblioteca
    document.querySelectorAll('.podcast-badge-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`pod-btn-${bookId}`) || document.querySelector(`[onclick*="${bookId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Configuración de nueva instancia
    podActiveBookId = bookId;
    podAudioInstance = audioEl;

    const fullUrl = book.podcastUrl.startsWith('http') ? book.podcastUrl : (typeof AUDIO_BASE_URL !== 'undefined' ? AUDIO_BASE_URL + book.podcastUrl : book.podcastUrl);
    
    podAudioInstance.src = fullUrl;
    document.getElementById('podcast-book-title').innerText = book.title;
    
    playerContainer.classList.remove('hidden');
    playerContainer.style.display = 'flex';

    // NUEVO: Detector de finalización para abrir el Portal
    podAudioInstance.onended = () => {
        showPodcastEndPortal(podActiveBookId);
    };

    // Recuperar progreso
    const savedTime = localStorage.getItem(`pod-pos-${bookId}`);
    
    podAudioInstance.load();
    podAudioInstance.onloadedmetadata = () => {
        if (savedTime) podAudioInstance.currentTime = parseFloat(savedTime);
        document.getElementById('pod-progress').max = Math.floor(podAudioInstance.duration);
        updatePlaybackUI();
    };

    togglePodcastPlay(true);
    startPodTimer();
    setupMediaSession(book);
}

function updatePlaybackUI() {
    if (!podAudioInstance) return;
    const currentTime = podAudioInstance.currentTime;
    const duration = podAudioInstance.duration || 0;
    
    const progressEl = document.getElementById('pod-progress');
    if (progressEl) progressEl.value = Math.floor(currentTime);
    
    const timeEl = document.getElementById('pod-time');
    if (timeEl) timeEl.innerText = `${formatPodTime(currentTime)} / ${formatPodTime(duration)}`;
}

function togglePodcastPlay(forcePlay = false) {
    if (!podAudioInstance) return;
    const btn = document.getElementById('pod-play-pause');
    
    if (podAudioInstance.paused || forcePlay) {
        podcastChannel.postMessage('pause_others');
        podAudioInstance.play().catch(e => console.log("Error play:", e));
        if (btn) btn.innerHTML = '<span class="material-icons">pause</span>';
    } else {
        podAudioInstance.pause();
        if (btn) btn.innerHTML = '<span class="material-icons">play_arrow</span>';
    }
}

function startPodTimer() {
    if (podTimer) clearInterval(podTimer);
    podTimer = setInterval(() => {
        if (!podAudioInstance || podAudioInstance.paused) return;
        updatePlaybackUI();
        localStorage.setItem(`pod-pos-${podActiveBookId}`, podAudioInstance.currentTime);
    }, 1000);
}

function formatPodTime(secs) {
    if (isNaN(secs)) return "00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return h > 0 
        ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        : `${m}:${s.toString().padStart(2, '0')}`;
}

function seekAudio(val) { if (podAudioInstance) podAudioInstance.currentTime = val; }
function rewindAudio() { if (podAudioInstance) podAudioInstance.currentTime -= 10; }
function forwardAudio() { if (podAudioInstance) podAudioInstance.currentTime += 30; }

function closePodcast() {
    if (podAudioInstance) {
        podAudioInstance.pause();
        clearInterval(podTimer);
    }
    const playerContainer = document.getElementById('podcast-player-container');
    if (playerContainer) {
        playerContainer.classList.add('hidden');
        playerContainer.style.display = 'none';
    }
    document.querySelectorAll('.podcast-badge-btn').forEach(btn => btn.classList.remove('active'));
    podActiveBookId = null;
}

window.stopAndHidePodcast = function() {
    if (podAudioInstance) {
        closePodcast();
    }
};

/**
 * FUNCIONALIDADES DEL PORTAL DE RESONANCIA
 */
// Reemplaza estas funciones en tu nexus-podcast.js

function showPodcastEndPortal(bookId) {
    const book = library.find(b => b.id === bookId);
    if (!book) return;

    const portal = document.getElementById('nexus-portal-container');
    const portalImg = document.getElementById('portal-cover-img');
    const portalTitle = document.getElementById('portal-title-text');

    if (portalTitle) portalTitle.innerText = book.title;
    if (portalImg) portalImg.src = book.cover;

    portal.classList.remove('hidden');
    portal.classList.add('flex');

    // --- ACCIONES CORREGIDAS ---

    // 1. LEER LIBRO (Usa el sistema de nexus-voice.js)
    document.getElementById('btn-portal-read').onclick = () => {
        closePodcastEndPortal();
        closePodcast();
        // Cancelamos cualquier voz previa (sinopsis o libro anterior)
        window.speechSynthesis.cancel(); 
        
        openReader(bookId);
        
        // Esperamos a que el lector cargue para iniciar su TTS específico
        setTimeout(() => { 
            if (typeof startSpeech === 'function') {
                startSpeech(); // Llama a la función de nexus-voice.js
            }
        }, 1200);
    };

    // 2. VER SINOPSIS (Usa el sistema de nexus-synopsis.js)
    document.getElementById('btn-portal-synopsis').onclick = () => {
        closePodcastEndPortal();
        window.speechSynthesis.cancel(); // Limpia cola de voz
        
        if (typeof showSynopsis === 'function') {
            showSynopsis(bookId);
            // Iniciamos específicamente el TTS de la sinopsis
            setTimeout(() => { 
                if (typeof startSynopsisTTS === 'function') {
                    startSynopsisTTS(); 
                }
            }, 800);
        }
    };

    // 3. REPETIR PODCAST
    document.getElementById('btn-portal-replay').onclick = () => {
        closePodcastEndPortal();
        window.speechSynthesis.cancel();
        if (podAudioInstance) {
            podAudioInstance.currentTime = 0;
            togglePodcastPlay(true);
        }
    };
}

function closePodcastEndPortal() {
    const portal = document.getElementById('nexus-portal-container');
    if (portal) {
        portal.classList.add('hidden');
        portal.classList.remove('flex');
    }
}

function setupMediaSession(book) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: book.title,
            artist: 'Nexus Podcast',
            artwork: [{ src: book.cover, sizes: '512x512', type: 'image/jpeg' }]
        });

        navigator.mediaSession.setActionHandler('play', () => togglePodcastPlay(true));
        navigator.mediaSession.setActionHandler('pause', () => togglePodcastPlay(false));
    }
}