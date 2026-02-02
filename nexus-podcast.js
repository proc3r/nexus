/**
 * NEXUS PODCAST MODULE - Versión Final con Portal de Resonancia y Control de Volumen
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
        
        // Sincronizar volumen actual del slider con la instancia de audio
        const volSlider = document.getElementById('pod-volume-slider');
        if (volSlider) podAudioInstance.volume = volSlider.value;
        
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

// --- NUEVAS FUNCIONES DE VOLUMEN ---
function updatePodVolume(val) {
    if (podAudioInstance) {
        podAudioInstance.volume = val;
        podAudioInstance.muted = (val == 0);
    }
    const muteBtn = document.getElementById('pod-mute-btn');
    if (muteBtn) {
        const icon = muteBtn.querySelector('.material-icons');
        if (val == 0) icon.innerText = 'volume_off';
        else if (val < 0.5) icon.innerText = 'volume_down';
        else icon.innerText = 'volume_up';
    }
}

function togglePodMute() {
    if (!podAudioInstance) return;
    const volSlider = document.getElementById('pod-volume-slider');
    const muteBtn = document.getElementById('pod-mute-btn');
    const icon = muteBtn ? muteBtn.querySelector('.material-icons') : null;

    if (podAudioInstance.muted) {
        podAudioInstance.muted = false;
        if (volSlider) volSlider.value = podAudioInstance.volume || 1;
        if (icon) icon.innerText = podAudioInstance.volume < 0.5 ? 'volume_down' : 'volume_up';
    } else {
        podAudioInstance.muted = true;
        if (volSlider) volSlider.value = 0;
        if (icon) icon.innerText = 'volume_off';
    }
}

function closePodcast() {
     if (podAudioInstance) {
        podAudioInstance.pause();
        podAudioInstance.src = ""; // Limpia la fuente para que no quede "cargado"
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

    // NUEVO: Cerrar al hacer clic fuera de la ventana principal
    portal.onclick = function(e) {
        // Si el ID del elemento clickeado es el del contenedor padre (el fondo oscuro)
        if (e.target.id === 'nexus-portal-container') {
            closePodcast(); 
			closePodcastEndPortal();
        }
    };


	// BOTÓN DE LA CRUZ (Si tienes un botón close en el HTML del portal)
		const portalCloseBtn = portal.querySelector('.portal-close-btn'); // Ajusta el selector si es diferente
		if (portalCloseBtn) {
			portalCloseBtn.onclick = () => {
				closePodcast();
				closePodcastEndPortal();
			};
		}
		
    // --- ACCIONES DE BOTONES (Sin cambios) ---
    document.getElementById('btn-portal-read').onclick = () => {
        closePodcastEndPortal();
        closePodcast();
        window.speechSynthesis.cancel(); 
        openReader(bookId);
        setTimeout(() => { if (typeof startSpeech === 'function') startSpeech(); }, 1200);
    };

    document.getElementById('btn-portal-synopsis').onclick = () => {
        closePodcastEndPortal();
		 closePodcast();
        window.speechSynthesis.cancel(); 
        if (typeof showSynopsis === 'function') {
            showSynopsis(bookId);
            setTimeout(() => { if (typeof startSynopsisTTS === 'function') startSynopsisTTS(); }, 800);
        }
    };

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
        // Limpiamos el evento onclick al cerrar para evitar ejecuciones accidentales después
        portal.onclick = null; 
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

// Inicialización de Listeners para el slider de volumen
document.addEventListener('DOMContentLoaded', () => {
    const volSlider = document.getElementById('pod-volume-slider');
    const muteBtn = document.getElementById('pod-mute-btn');
    
    if (volSlider) {
        // Inicializar el volumen de la instancia si ya existe
        volSlider.addEventListener('input', (e) => {
            if (podAudioInstance) podAudioInstance.volume = e.target.value;
            // Opcional: llamar a updatePodVolume si quieres cambiar el icono del altavoz
            if (typeof updatePodVolume === 'function') updatePodVolume(e.target.value);
        });
    }
    if (muteBtn) {
        muteBtn.addEventListener('click', togglePodMute);
    }
});