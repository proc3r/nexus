let player;
let isMusicPlaying = false;
let isPlayerReady = false;
let isSyncing = false; // Bandera para evitar bucles infinitos

const DEFAULT_VOLUME = 20; 
const DEFAULT_SOUNDTRACK = "wJ2tGxjTjuI";

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

    // 4. Actualizar Visuales y Auto-Pausa (Mantiene tu lógica)
    updateVolumeButtonVisuals(volumeValue);

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

function updateSoundtrack(videoId, forcePlay = true) {
    // Si no hay videoId (el libro no tiene), usamos el DEFAULT
    const finalId = videoId || DEFAULT_SOUNDTRACK;
    
    if (player && isPlayerReady) {
        // Si forcePlay es true (como cuando entramos a un libro), usamos loadVideoById
        if (forcePlay) {
            isMusicPlaying = true;
            player.loadVideoById({
                videoId: finalId,
                suggestedQuality: 'small'
            });
            actualizarVisualesMusica(true);
        } else {
            // Solo entra aquí si explícitamente enviamos forcePlay = false (al cerrar)
            isMusicPlaying = false;
            player.cueVideoById({
                videoId: finalId,
                suggestedQuality: 'small'
            });
            actualizarVisualesMusica(false);
        }
    } else {
        initPlayer();
    }
}

// Función auxiliar para no repetir código de iconos
function actualizarVisualesMusica(activar) {
    const musicBtn = document.getElementById('btn-music-main');
    const musicIcon = document.getElementById('music-icon');
    const volBtn = document.getElementById('btn-volume-yt');
    const statusText = document.getElementById('music-status-text');

    if (activar) {
        if (musicBtn) musicBtn.style.background = "#FFD920A6";
        if (musicIcon) musicIcon.innerText = "pause";
        if (volBtn) volBtn.classList.add('music-playing-beat');
        if (statusText) statusText.innerText = "REPRODUCIENDO...";
    } else {
        if (musicBtn) musicBtn.style.background = "#08f0fb7a";
        if (musicIcon) musicIcon.innerText = "play_arrow";
        if (volBtn) volBtn.classList.remove('music-playing-beat');
        if (statusText) statusText.innerText = "AMBIENTE LISTO";
    }
}

function toggleVolumePopover(event) {
    if (event) event.stopPropagation();
    const sidebar = document.getElementById('volume-sidebar-container');
    if (!sidebar) return;

    if (sidebar.classList.contains('hidden')) {
        sidebar.classList.remove('hidden');
        // Reset de seguridad por si venía de una animación
        sidebar.style.transform = "";
        sidebar.style.opacity = "";
        
        // Iniciamos el timer de cierre inicial
        clearTimeout(window.volumeTimeout);
        window.volumeTimeout = setTimeout(closeVolumeSidebar, 4000);
    } else {
        closeVolumeSidebar();
    }
}

// Función para cerrar con animación hacia el costado
function closeVolumeSidebar() {
    const sidebar = document.getElementById('volume-sidebar-container');
    if (sidebar && !sidebar.classList.contains('hidden')) {
        // Añadimos una clase de transición (debes ponerla en tu CSS)
        sidebar.style.transform = "translateY(-50%) translateX(100px)";
        sidebar.style.opacity = "0";
        
        setTimeout(() => {
            sidebar.classList.add('hidden');
            // Reseteamos estilos para la próxima vez que se abra
            sidebar.style.transform = "";
            sidebar.style.opacity = "";
        }, 400); // Duración de la animación
    }
}

// Cerrar al hacer clic fuera
window.addEventListener('click', () => {
    document.getElementById('volume-sidebar-container')?.classList.add('hidden');
});


document.addEventListener('DOMContentLoaded', () => {
    const syncSlider = document.getElementById('music-volume-sync');
    const sidebar = document.getElementById('volume-sidebar-container');

    // --- PROTECCIÓN PARA ESCRITORIO ---
    // Evitamos que el clic dentro del panel llegue a la ventana y lo cierre
    sidebar?.addEventListener('click', (e) => e.stopPropagation());
    sidebar?.addEventListener('mousedown', (e) => e.stopPropagation());

    if (syncSlider) {
        // Bloqueo de scroll del body mientras se arrastra en mobile
        syncSlider.addEventListener('touchmove', (e) => {
            // Detenemos que el toque llegue al listener de scroll global
            e.stopPropagation();
            
            // Si el navegador intenta hacer scroll en la página, lo cancelamos
            // para que el slider mantenga el control del dedo.
            if (e.cancelable) e.preventDefault(); 
        }, { passive: false });

        // Al soltar (Mobile y Escritorio)
        const handleRelease = (e) => {
            e.stopPropagation(); // Evita que el clic final active el cierre global
            clearTimeout(window.volumeTimeout);
            window.volumeTimeout = setTimeout(closeVolumeSidebar, 3000);
        };

        syncSlider.addEventListener('touchend', handleRelease);
        syncSlider.addEventListener('mouseup', handleRelease);
        
        // Al tocar (para resetear el timer de cierre inmediatamente)
        syncSlider.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            clearTimeout(window.volumeTimeout);
        }, { passive: true });
    }
});

// Función de cierre con retraso y animación
function startClosingTimeout() {
    clearTimeout(window.volumeTimeout);
    window.volumeTimeout = setTimeout(() => {
        const sidebar = document.getElementById('volume-sidebar-container');
        if (sidebar && !sidebar.classList.contains('hidden')) {
            sidebar.classList.add('closing-animation'); // Añadimos clase de salida
            
            // Esperamos a que termine la animación de CSS para ocultarlo realmente
            setTimeout(() => {
                sidebar.classList.add('hidden');
                sidebar.classList.remove('closing-animation');
            }, 400); 
        }
    }, 3000); // 3 segundos de cortesía antes de irse
}