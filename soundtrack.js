// Usamos var para permitir que el script se cargue más de una vez sin error fatal
var player;
var isMusicPlaying = isMusicPlaying || false;
var isPlayerReady = isPlayerReady || false;
var isSyncing = isSyncing || false;

// --- VARIABLES PARA EL SALTO ALEATORIO ---
window.currentRandomTime = 0; 
window.yaSalto = false;

const DEFAULT_VOLUME = 20; 
const DEFAULT_SOUNDTRACK = "wJ2tGxjTjuI";

// --- LÓGICA DE VALOR ALEATORIO ---
function refrescarValorAleatorio() {
    window.currentRandomTime = Math.floor(Math.random() * 3001);
    window.yaSalto = false; 
    console.log("%c 🎲 VALOR GLOBAL REFRESCADO: " + window.currentRandomTime, "color: #000; background: #ffff00; font-weight: bold;");
}

// 1. Inicialización de la API
function onYouTubeIframeAPIReady() {
    if (!window.currentRandomTime) refrescarValorAleatorio();
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
            'modestbranding': 1,
            'start': window.currentRandomTime // Carga inicial
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': (e) => console.error("Error YT:", e.data)
        }
    });
}

/**
 * Función que llama nexus-core.js (Actualizada con salto)
 */
function updateSoundtrack(newVideoId, shouldPlay = true) {
    const vId = newVideoId || DEFAULT_SOUNDTRACK;
    
    if (newVideoId !== null) {
        refrescarValorAleatorio();
    }

    // EL AJUSTE ES ESTA CONDICIÓN REFORZADA:
    if (player && isPlayerReady && typeof player.getIframe === 'function' && player.getIframe()) {
        player.loadVideoById({
            videoId: vId,
            startSeconds: window.currentRandomTime
        });
        
        if (!shouldPlay) {
            setTimeout(() => { if(player) player.pauseVideo(); }, 500);
        }
    } else {
        // Si el player existe pero perdió el Iframe (causa del cloneNode), lo reseteamos
        player = null; 
        isPlayerReady = false;
        initPlayer();
    }
}

function onPlayerReady(event) {
    isPlayerReady = true;
    
    // LOGICA PARA LECTOR DIRECTO:
    // Si estamos en el lector (por enlace externo), forzamos el arranque
    if (window.currentBook || window.isLectorFijo) {
        event.target.unMute();
        event.target.setVolume(DEFAULT_VOLUME);
        event.target.playVideo();
    }

    globalVolumeControl(DEFAULT_VOLUME, 'init');

    // Actualizar visuales de interfaz
    const volBtn = document.getElementById('btn-volume-yt');
    if (volBtn && !isMusicPlaying) {
        volBtn.classList.add('music-waiting-pulse');
    }

    const statusText = document.getElementById('music-status-text');
    if (statusText) {
        statusText.innerText = (window.currentBook || window.isLectorFijo) ? "SINCRONIZADO" : "AMBIENTE LISTO";
    }
}

function onPlayerStateChange(event) {
    // 1. L��GICA DE SINCRONIZACI��N INICIAL (Tu c��digo original)
    if (event.data === YT.PlayerState.PLAYING && !window.yaSalto) {
        console.log("?? Sincronizando audio con valor global: " + window.currentRandomTime);
        
        event.target.seekTo(window.currentRandomTime, true);
        
        // REFUERZO DE MUTE: Aseguramos sonido y volumen
        event.target.unMute();
        event.target.setVolume(DEFAULT_VOLUME);
        
        window.yaSalto = true;
        
        const volBtn = document.getElementById('btn-volume-yt');
        if (volBtn) volBtn.classList.remove('music-waiting-pulse');
    }

    // 2. REFUERZO PARA EVITAR PAUSA POR BLOQUEO DE NAVEGADOR
    // Si el navegador intenta pausar al inicio, forzamos Play
    if (event.data === YT.PlayerState.PAUSED && !window.yaSalto && (window.currentBook || window.isLectorFijo)) {
        console.log("?? Pausa detectada al inicio. Forzando reproducci��n...");
        event.target.playVideo();
    }

    // 3. ACTUALIZACI��N DE ESTADOS Y VISUALES
    if (event.data === YT.PlayerState.PLAYING) {
        isMusicPlaying = true;
        if (typeof actualizarVisualesMusica === 'function') actualizarVisualesMusica(true);
    } 
    else if (event.data === YT.PlayerState.PAUSED) {
        isMusicPlaying = false;
        if (typeof actualizarVisualesMusica === 'function') actualizarVisualesMusica(false);
    }

    // 4. BUCLE INFINITO (Loop din��mico)
    // Cuando el tema termina, refresca el valor aleatorio y vuelve a empezar
    if (event.data === YT.PlayerState.ENDED) {
        console.log("?? Tema finalizado. Generando nuevo punto de inicio...");
        refrescarValorAleatorio(); // Genera un nuevo currentRandomTime
        
        const nextVideoId = (window.currentBook && window.currentBook.soundtrack) 
                            ? window.currentBook.soundtrack 
                            : DEFAULT_SOUNDTRACK;
                            
        event.target.loadVideoById({
            videoId: nextVideoId,
            startSeconds: window.currentRandomTime
        });
    }
}

// --- VIGILANTE DE EMERGENCIA (Anti-bloqueo de red) ---
// Revisa cada 30 segundos si la m��sica deber��a sonar pero est�� detenida por un error de YouTube
setInterval(() => {
    if (isMusicPlaying && player && isPlayerReady) {
        const state = player.getPlayerState();
        // Si el estado es PAUSADO (2) o SIN INICIAR (-1) pero la UI dice que deber��a sonar:
        if (state === 2 || state === -1) {
            console.warn("?? Vigilante: Detectado bloqueo o interrupci��n de red. Intentando reanudar...");
            player.playVideo();
        }
    }
}, 30000);




function globalVolumeControl(val, originId) {
    if (isSyncing) return; 
    isSyncing = true;

    const volumeValue = parseInt(val);

    // 1. Aplicar a YouTube
    if (player && isPlayerReady && typeof player.setVolume === 'function') {
        player.setVolume(volumeValue);
        // Si hay volumen y debería estar sonando, aseguramos el play
        if (volumeValue > 0 && isMusicPlaying) {
            if (player.getPlayerState() !== 1) player.playVideo();
        }
    }

    // 2. Sincronizar Sliders (Escritorio y Emergente)
    const mainSlider = document.getElementById('music-volume');
    if (mainSlider && originId !== 'music-volume') mainSlider.value = volumeValue;

    const syncSlider = document.getElementById('music-volume-sync');
    if (syncSlider && originId !== 'music-volume-sync') syncSlider.value = volumeValue;

    // 3. Visuales
    updateVolumeButtonVisuals(volumeValue);

    isSyncing = false;
}



function updateVolumeButtonVisuals(val) {
    const btn = document.getElementById('btn-volume-yt');
    if (!btn) return;
    
    const volumeValue = parseInt(val);

    if (volumeValue === 0) {
        // MUTEADO
        btn.style.opacity = "0.6";
        btn.classList.remove('music-playing-beat');
        btn.classList.add('music-waiting-pulse');
        
        // Opcional: Pausar para ahorrar recursos, pero solo si realmente está en 0
        if (player && typeof player.pauseVideo === 'function') player.pauseVideo();
    } else {
        // CON VOLUMEN
        btn.style.opacity = "1";
        
        if (isMusicPlaying) {
            btn.classList.remove('music-waiting-pulse');
            btn.classList.add('music-playing-beat');
            // Si el volumen subió, nos aseguramos de que suene
            if (player && typeof player.playVideo === 'function') {
                if (player.getPlayerState() !== 1) player.playVideo();
            }
        } else {
            btn.classList.add('music-waiting-pulse');
        }
    }
}



function toggleSoundtrack() {
    const musicBtn = document.getElementById('btn-music-main');
    const volBtn = document.getElementById('btn-volume-yt');

    if (!player || !isPlayerReady) return;

    // RESCATE: Si está en silencio total al dar Play, lo subimos al 40% automáticamente
    if (!isMusicPlaying && player.getVolume() === 0) {
        globalVolumeControl(20, 'auto-fix');
    }

    try {
        if (!isMusicPlaying) {
            player.playVideo();
            isMusicPlaying = true;
            actualizarVisualesMusica(true);
        } else {
            player.pauseVideo();
            isMusicPlaying = false;
            actualizarVisualesMusica(false);
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

function actualizarVisualesMusica(activar) {
    const musicBtn = document.getElementById('btn-music-main');
    const musicIcon = document.getElementById('music-icon');
    const volBtn = document.getElementById('btn-volume-yt');
    const statusText = document.getElementById('music-status-text');
    
    // Verificamos si el slider de volumen está en 0
    const syncSlider = document.getElementById('music-volume-sync');
    const isMuted = syncSlider && parseInt(syncSlider.value) === 0;

    if (activar) {
        if (musicBtn) musicBtn.style.background = "#FFD920A6";
        if (musicIcon) musicIcon.innerText = "pause";
        if (statusText) statusText.innerText = "REPRODUCIENDO...";
        
        if (volBtn) {
            // Si está reproduciendo pero muteado, sigue en latido blanco
            if (isMuted) {
                volBtn.classList.remove('music-playing-beat');
                volBtn.classList.add('music-waiting-pulse');
            } else {
                volBtn.classList.remove('music-waiting-pulse');
                volBtn.classList.add('music-playing-beat');
            }
        }
    } else {
        if (musicBtn) musicBtn.style.background = "#08f0fb7a";
        if (musicIcon) musicIcon.innerText = "play_arrow";
        if (statusText) statusText.innerText = "EN PAUSA";
        
        if (volBtn) {
            // En pausa SIEMPRE late en blanco (esté muteado o no)
            volBtn.classList.remove('music-playing-beat');
            volBtn.classList.add('music-waiting-pulse');
        }
    }
}



function toggleVolumePopover(event) {
    if (event) event.stopPropagation();
    
    const volBtn = document.getElementById('btn-volume-yt');
    const sidebar = document.getElementById('volume-sidebar-container');
    
    // --- LÓGICA DE ACTIVACIÓN ---
    if (isPlayerReady && !isMusicPlaying) {
        // Quitamos el latido de espera y activamos la música
        if (volBtn) volBtn.classList.remove('music-waiting-pulse');
        toggleSoundtrack(); // Esta función ya activa isMusicPlaying y el beat de reproducción
    }

    if (!sidebar) return;

    // --- MANEJO DE LA BARRA LATERAL ---
    if (sidebar.classList.contains('hidden')) {
        sidebar.classList.remove('hidden');
        sidebar.style.transform = "";
        sidebar.style.opacity = "";
        
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

    sidebar?.addEventListener('click', (e) => e.stopPropagation());
    sidebar?.addEventListener('mousedown', (e) => e.stopPropagation());

    if (syncSlider) {
        // 1. Manejo nativo (Escritorio / Clic directo)
        syncSlider.addEventListener('input', (e) => {
            globalVolumeControl(e.target.value, 'music-volume-sync');
        });

        // 2. GESTIÓN TÁCTIL CORREGIDA
        const handleTouch = (e) => {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();

            const touch = e.touches[0];
            const rect = syncSlider.getBoundingClientRect();
            
            // Determinamos si el slider es vertical u horizontal según su dibujo en pantalla
            const isVertical = rect.height > rect.width;
            
            let percentage;
            if (isVertical) {
                // Si es vertical: El 100% está arriba (top) y el 0% abajo (bottom)
                // Invertimos la resta porque en pantalla el eje Y crece hacia abajo
                percentage = ((rect.bottom - touch.clientY) / rect.height) * 100;
            } else {
                // Si es horizontal: El 0% está a la izquierda (left)
                percentage = ((touch.clientX - rect.left) / rect.width) * 100;
            }
            
            // LIMITACIÓN ESTRICTA: Evita que siga subiendo al salir de la barra
            let finalVal = Math.round(Math.min(Math.max(percentage, 0), 100));

            if (!isNaN(finalVal)) {
                syncSlider.value = finalVal;
                globalVolumeControl(finalVal, 'music-volume-sync');
            }
        };

        // Eventos de inicio y movimiento
        syncSlider.addEventListener('touchstart', (e) => {
            clearTimeout(window.volumeTimeout);
            handleTouch(e);
        }, { passive: false });

        syncSlider.addEventListener('touchmove', handleTouch, { passive: false });

        // 3. Al soltar
        const handleRelease = (e) => {
            e.stopPropagation(); 
            clearTimeout(window.volumeTimeout);
            window.volumeTimeout = setTimeout(closeVolumeSidebar, 3000);
        };

        syncSlider.addEventListener('touchend', handleRelease);
        syncSlider.addEventListener('mouseup', handleRelease);
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

