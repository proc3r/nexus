let player;
let isMusicPlaying = false;
let isPlayerReady = false;
let isSyncing = false; // Bandera para evitar bucles infinitos

const DEFAULT_VOLUME = 20; 
const DEFAULT_SOUNDTRACK = "Q9ksWb4Y3SY";

// 1. Inicialización de la API
function onYouTubeIframeAPIReady() {
    initPlayer();
}

function initPlayer() {
    if (player) return;
    const vId = (window.currentBook && window.currentBook.soundtrack) ? window.currentBook.soundtrack : DEFAULT_SOUNDTRACK;
    
    player = new YT.Player('youtube-player', {
        height: '0',
        width: '0',
        videoId: vId,
        playerVars: {
            'playsinline': 1,
            'enablejsapi': 1,
            'origin': window.location.origin,
            'controls': 0,
            'disablekb': 1,
            'fs': 0,
            'modestbranding': 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': (e) => console.error("Error YT:", e.data)
        }
    });
}

function onPlayerReady(event) {
    isPlayerReady = true;
    // Inicialización maestra del volumen
    globalVolumeControl(DEFAULT_VOLUME, 'init');

    const statusText = document.getElementById('music-status-text');
    if (statusText) {
        statusText.innerText = (window.currentBook && window.currentBook.soundtrack) ? "SINCRONIZADO" : "AMBIENTE LISTO";
    }
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) player.playVideo();
}

// --- CONTROLADOR MAESTRO DE VOLUMEN ---
// Sustituye a syncAllVolumes y changeVolume
function globalVolumeControl(val, originId) {
    if (isSyncing) return; 
    isSyncing = true;

    const volumeValue = parseInt(val);

    // 1. Aplicar a YouTube
    if (player && isPlayerReady && typeof player.setVolume === 'function') {
        player.setVolume(volumeValue);
    }

    // 2. Sincronizar Slider del Menú Lateral (Widget)
    const mainSlider = document.getElementById('music-volume');
    if (mainSlider && originId !== 'music-volume') {
        mainSlider.value = volumeValue;
    }

    // 3. Sincronizar Slider Emergente (Lateral)
    const syncSlider = document.getElementById('music-volume-sync');
    if (syncSlider && originId !== 'music-volume-sync') {
        syncSlider.value = volumeValue;
    }

    // 4. Actualizar Visuales y Auto-Pausa
    updateVolumeButtonVisuals(volumeValue);

    // 5. Gestión de cierre automático si se usa la barra emergente
    if (originId === 'music-volume-sync') {
        clearTimeout(window.volumeTimeout);
        window.volumeTimeout = setTimeout(() => {
            document.getElementById('volume-sidebar-container')?.classList.add('hidden');
        }, 4000);
    }

    isSyncing = false;
}

function updateVolumeButtonVisuals(val) {
    const btn = document.getElementById('btn-volume-yt');
    if (!btn) return;
    
    if (val === 0) {
        btn.classList.remove('music-playing-beat');
        btn.style.opacity = "0.4";
        // Opcional: Si el volumen es 0, pausamos la música para ahorrar datos
        if (isMusicPlaying && player) player.pauseVideo(); 
    } else {
        btn.style.opacity = "1";
        if (isMusicPlaying) {
            btn.classList.add('music-playing-beat');
            if (player) player.playVideo();
        }
    }
}

function toggleSoundtrack() {
    const musicBtn = document.getElementById('btn-music-main');
    const musicIcon = document.getElementById('music-icon');
    const statusText = document.getElementById('music-status-text');
    const volBtn = document.getElementById('btn-volume-yt');

    if (!player || !isPlayerReady) return;

    try {
        if (!isMusicPlaying) {
            player.playVideo();
            if (musicIcon) musicIcon.innerText = "pause";
            if (statusText) statusText.innerText = "REPRODUCIENDO...";
            if (musicBtn) musicBtn.style.background = "#FFD920A6";
            if (volBtn) volBtn.classList.add('music-playing-beat');
            isMusicPlaying = true;
        } else {
            player.pauseVideo();
            if (musicIcon) musicIcon.innerText = "play_arrow";
            if (statusText) statusText.innerText = "EN PAUSA";
            if (musicBtn) musicBtn.style.background = "#08f0fb7a";
            if (volBtn) volBtn.classList.remove('music-playing-beat');
            isMusicPlaying = false;
        }
    } catch (e) { console.error("Error toggle:", e); }
}

function updateSoundtrack(videoId) {
    const finalId = videoId || DEFAULT_SOUNDTRACK;
    if (player && isPlayerReady) {
        isMusicPlaying = false;
        const musicBtn = document.getElementById('btn-music-main');
        const volBtn = document.getElementById('btn-volume-yt');
        
        if (musicBtn) musicBtn.style.background = "#08f0fb7a";
        if (volBtn) volBtn.classList.remove('music-playing-beat');
        
        player.cueVideoById({
            videoId: finalId,
            suggestedQuality: 'small'
        });
        
        document.getElementById('music-status-text').innerText = videoId ? "SINCRONIZADO" : "AMBIENTE ESTÁNDAR";
    } else if (!player) {
        initPlayer();
    }
}

function toggleVolumePopover(event) {
    if (event) event.stopPropagation();
    const sidebar = document.getElementById('volume-sidebar-container');
    if (!sidebar) return;

    if (sidebar.classList.contains('hidden')) {
        sidebar.classList.remove('hidden');
        clearTimeout(window.volumeTimeout);
        window.volumeTimeout = setTimeout(() => {
            sidebar.classList.add('hidden');
        }, 4000);
    } else {
        sidebar.classList.add('hidden');
    }
}

// Cerrar al hacer clic fuera
window.addEventListener('click', () => {
    document.getElementById('volume-sidebar-container')?.classList.add('hidden');
});