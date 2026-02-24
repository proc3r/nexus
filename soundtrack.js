// Usamos var para permitir que el script se cargue m谩s de una vez sin error fatal
var player;
var isMusicPlaying = isMusicPlaying || false;
var isPlayerReady = isPlayerReady || false;
var isSyncing = isSyncing || false;
let userWantsSilence = false; // Rastrea si el usuario apagó la música manualmente

// --- VARIABLES PARA EL SALTO ALEATORIO ---ca
window.currentRandomTime = 0; 
window.yaSalto = false;

const DEFAULT_VOLUME = 15; 
const DEFAULT_SOUNDTRACK = "O00n5bg_eHY";
const PORTAL_SOUNDTRACK = 'O00n5bg_eHY'; // Reemplaza con el ID deseado
const AMBIENT_VOLUME = 10; // Volumen sutil para el portal

// --- L脫GICA DE VALOR ALEATORIO ---
function refrescarValorAleatorio() {
    window.currentRandomTime = Math.floor(Math.random() * 1500);
    window.yaSalto = false; 
    console.log("%c 馃幉 VALOR GLOBAL REFRESCADO: " + window.currentRandomTime, "color: #000; background: #ffff00; font-weight: bold;");
}

// 1. Inicializaci贸n de la API
function onYouTubeIframeAPIReady() {
    // Solo refresca si es estrictamente necesario para no empezar en 0
    if (window.currentRandomTime === undefined || window.currentRandomTime === null) {
        refrescarValorAleatorio();
    }
    initPlayer();
}

function initPlayer() {
    if (player) return;
   // const vId = (window.currentBook && window.currentBook.soundtrack) ? window.currentBook.soundtrack : DEFAULT_SOUNDTRACK;
    
    player = new YT.Player('youtube-player', {
        height: '0',
        width: '0',
         //videoId: vId,  //<-- MANTENLO COMENTADO PARA SILENCIO INICIAL
        playerVars: {
            'playsinline': 1,
            'enablejsapi': 1,
            'origin': window.location.origin,
            'controls': 0,
            'disablekb': 1,
            'fs': 0,
            'modestbranding': 1,
            //'start': window.currentRandomTime // Carga inicial
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': (e) => console.error("Error YT:", e.data)
        }
    });
}


/**
 * Función Maestra para actualizar el soundtrack
 * Combina: Salto aleatorio, protección de Iframe y actualización de botones
 */
  
function updateSoundtrack(newVideoId, shouldPlay = true) {
    // Si no viene ID, usamos el del Portal en lugar del Default genérico
    const vId = newVideoId || PORTAL_SOUNDTRACK; 
    window.lastLoadedSoundtrack = vId; 

    // Solo refrescamos el valor si realmente vamos a REPRODUCIR
    if (shouldPlay) {
        window.yaSalto = false; 
        refrescarValorAleatorio();
        console.log("%c ?? AUDIO: Solicitado nuevo tema (PLAY): " + vId, "color: #fff; background: #2ecc71; padding: 2px 5px;");
    } else {
        console.log("%c ?? AUDIO: Preparando tema en espera: " + vId, "color: #fff; background: #95a5a6; padding: 2px 5px;");
    }

    // Cambiamos la validación para ser más tolerantes con el estado del reproductor
    if (player && typeof player.loadVideoById === 'function') {
        try {
            if (shouldPlay) {
                isMusicPlaying = true;

                // --- AJUSTE DE VOLUMEN Y SLIDERS ---
                // Determinamos el volumen objetivo
                const targetVol = (vId === PORTAL_SOUNDTRACK) ? AMBIENT_VOLUME : DEFAULT_VOLUME;
                
                // Sincronizamos los Sliders visuales con el volumen que vamos a poner
                globalVolumeControl(targetVol, 'system-reset');

                player.loadVideoById({
                    videoId: vId,
                    startSeconds: window.currentRandomTime,
                    suggestedQuality: 'small'
                });
                
                player.unMute();
                player.setVolume(targetVol);

                if (typeof actualizarVisualesMusica === 'function') actualizarVisualesMusica(true);
            } else {
                isMusicPlaying = false;
                player.cueVideoById({
                    videoId: vId,
                    startSeconds: window.currentRandomTime
                });
                if (typeof actualizarVisualesMusica === 'function') actualizarVisualesMusica(false);
            }
        } catch (e) {
            console.warn("?? AUDIO: El reproductor falló al cargar (posible pesta?a inactiva). El Vigilante reintentará.");
        }
    } else {
        console.error("%c ?? AUDIO: Reproductor no listo. Intentando inicializar...", "color: #fff; background: #e74c3c;");
        isPlayerReady = false;
        initPlayer();

        if (shouldPlay) {
            setTimeout(() => {
                if (isPlayerReady) updateSoundtrack(vId, true);
            }, 2500);
        }
    }
}

function onPlayerReady(event) {
    isPlayerReady = true;
    
    // 1. Lógica de reproducción (Lector vs Portal)
    if (window.currentBook || window.isLectorFijo) {
        const videoData = event.target.getVideoData();
        if (videoData && videoData.video_id) {
            event.target.unMute();
            event.target.setVolume(DEFAULT_VOLUME);
            event.target.playVideo();
        }
    } else {
        // Portal: Iniciamos música ambiente
        isMusicPlaying = true;
        event.target.unMute();
        event.target.setVolume(AMBIENT_VOLUME);
        player.loadVideoById({
            videoId: PORTAL_SOUNDTRACK,
            startSeconds: window.currentRandomTime
        });
    }

     // --- AJUSTE AQUí: No forzar DEFAULT_VOLUME si estamos en el portal ---
    const inicialVol = (window.currentBook || window.isLectorFijo) ? DEFAULT_VOLUME : AMBIENT_VOLUME;
    globalVolumeControl(inicialVol, 'init');

    const volBtn = document.getElementById('btn-volume-yt');
    if (volBtn && !isMusicPlaying) {
        volBtn.classList.add('music-waiting-pulse');
    }

    const statusText = document.getElementById('music-status-text');
    if (statusText) {
        statusText.innerText = (window.currentBook || window.isLectorFijo) ? "SINCRONIZADO" : "AMBIENTE LISTO";
    }

    // Actualizar el nuevo botón de la barra superior
    if (typeof actualizarBotonAmbienteUI === 'function') actualizarBotonAmbienteUI();
}




function onPlayerStateChange(event) {
    // --- 1. SINCRONIZACIóN INICIAL (CORREGIDA PARA EVITAR TARTAMUDEO) ---
    if (event.data === YT.PlayerState.PLAYING && !window.yaSalto) {
        
        const currentTime = event.target.getCurrentTime();
        if (Math.abs(currentTime - window.currentRandomTime) > 2) {
            console.log("%c ?? AUDIO: Sincronizando posición inicial: " + window.currentRandomTime + "s", "background: #222; color: #bada55");
            event.target.seekTo(window.currentRandomTime, true);
        } else {
            console.log("%c ? AUDIO: Posición inicial ya sincronizada.", "background: #222; color: #bada55");
        }
        
        // Marcamos que ya se procesó el salto inicial
        window.yaSalto = true; 
        
        event.target.unMute();

        // --- AJUSTE: Volumen dinámico y sincronización de Sliders ---
        const vData = event.target.getVideoData();
        const isPortal = vData && vData.video_id === PORTAL_SOUNDTRACK;
        const targetVol = isPortal ? AMBIENT_VOLUME : (window.currentVolume || DEFAULT_VOLUME);
        
        event.target.setVolume(targetVol);
        // Aseguramos que los sliders visuales marquen el volumen real al empezar
        globalVolumeControl(targetVol, 'system-init'); 
        
        const volBtn = document.getElementById('btn-volume-yt');
        if (volBtn) volBtn.classList.remove('music-waiting-pulse');
    }

    // --- 2. GESTIóN DE VISUALES ---
    if (event.data === YT.PlayerState.PLAYING) {
        isMusicPlaying = true;
        if (typeof actualizarVisualesMusica === 'function') actualizarVisualesMusica(true);
        if (typeof actualizarBotonAmbienteUI === 'function') actualizarBotonAmbienteUI(); // <--- A?ADIR ESTA
    } 
    else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.BUFFERING) {
        if (event.data === YT.PlayerState.PAUSED) {
            isMusicPlaying = false;
            if (typeof actualizarBotonAmbienteUI === 'function') actualizarBotonAmbienteUI(); // <--- A?ADIR ESTA
        }
        if (typeof actualizarVisualesMusica === 'function') actualizarVisualesMusica(false);
    }

    // --- 3. REINICIO DEL BUCLE (Loop) ---
    if (event.data === YT.PlayerState.ENDED) {
        console.log("%c ?? AUDIO: Tema finalizado. Reiniciando bucle...", "background: #222; color: #00e5ff");
        
        const libroVideoId = window.lastLoadedSoundtrack || 
                             (window.currentBook && window.currentBook.soundtrack) || 
                             DEFAULT_SOUNDTRACK;

        // IMPORTANTE: Bloqueamos el salto aleatorio para que el bucle empiece en 0
        window.yaSalto = true; 

        setTimeout(() => {
            // Verificamos si es el portal para asignar el volumen correcto
            const esPortal = libroVideoId === PORTAL_SOUNDTRACK;
            const volLoop = esPortal ? AMBIENT_VOLUME : DEFAULT_VOLUME;

            player.loadVideoById({
                videoId: libroVideoId,
                startSeconds: 0,
                suggestedQuality: 'small'
            });
            
            // Forzamos el play y el volumen definido
            if (isMusicPlaying) {
                player.unMute();
                player.setVolume(volLoop);
                player.playVideo();
            }
        }, 500); // Un peque?o margen para que YouTube limpie el estado anterior
    }
}




/**
 * Alterna la música (Play/Pause) desde el botón de la barra superior
 */
function toggleAmbientMusic() {
    if (!player || !isPlayerReady) return;

    if (isMusicPlaying) {
        player.pauseVideo();
        isMusicPlaying = false;
        userWantsSilence = true; 
    } else {
        userWantsSilence = false; 
        // Determinamos volumen según el video que está cargado
        const vData = player.getVideoData();
        const isPortal = vData && vData.video_id === PORTAL_SOUNDTRACK;
        const volActivo = isPortal ? AMBIENT_VOLUME : (window.currentVolume || DEFAULT_VOLUME);
        
        player.setVolume(volActivo);
        player.playVideo();
        isMusicPlaying = true;
    }
    actualizarBotonAmbienteUI();
}

/**
 * Actualiza el texto e icono del botón en la barra superior
 */
function actualizarBotonAmbienteUI() {
    const btn = document.getElementById('btn-ambient-music');
    if (!btn) return;
    
    const icon = btn.querySelector('.material-icons-round');

    if (isMusicPlaying) {
        btn.classList.remove('muted');
        btn.classList.add('active'); // Activa la animación music-beat
        if (icon) icon.innerText = 'music_note';
    } else {
        btn.classList.add('muted');
        btn.classList.remove('active'); // Detiene la animación
        if (icon) icon.innerText = 'music_off';
    }
}

// Inicializar el evento del clic al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-ambient-music');
    if (btn) btn.addEventListener('click', toggleAmbientMusic);
});

// --- 4. EL VIGILANTE (Fuera de las funciones, para emergencias) ---
// Si el botón está latiendo (isMusicPlaying) pero YouTube se colgó (Error 503 o AdBlock),
// este peque?o bloque intenta despertarlo cada 20 segundos.
// Este bloque revisa cada 10 segundos si la música debería sonar pero está trabada
setInterval(() => {
    // Si la lógica dice que debe sonar y el player está listo
    if (isMusicPlaying && player && isPlayerReady) {
        const state = player.getPlayerState();
        // Si está en pausa (2), buffering infinito (3), terminado (0) o no iniciado (-1)
        if (state === 2 || state === 3 || state === -1 || state === 0) {
            console.warn("?? AUDIO: Vigilante detectó silencio. Forzando Play...");
            player.playVideo();
            
            // Si el volumen se bajó a 0 por error del API, lo restauramos
            if (player.getVolume() === 0) {
                const vData = player.getVideoData();
                const isPortal = vData && vData.video_id === PORTAL_SOUNDTRACK;
                player.setVolume(isPortal ? AMBIENT_VOLUME : DEFAULT_VOLUME);
            }
        }
    }
}, 10000);



function globalVolumeControl(val, originId) {
    if (isSyncing) return; 
    isSyncing = true;

    // --- REINICIAR TEMPORIZADOR DE CIERRE ---
    // Cada vez que interactúas con el volumen, se cancela el cierre anterior
    // y se programa uno nuevo a 4 segundos.
    clearTimeout(window.volumeTimeout);
    window.volumeTimeout = setTimeout(closeVolumeSidebar, 4000);

    const volumeValue = parseInt(val);

    // 1. Aplicar a YouTube
    if (player && isPlayerReady && typeof player.setVolume === 'function') {
        player.setVolume(volumeValue);
        
        // --- LóGICA DE REPRODUCCIóN INTELIGENTE ---
        if (volumeValue > 0) {
            // Si el volumen sube de 0, forzamos que el estado sea "reproduciendo"
            if (!isMusicPlaying) {
                isMusicPlaying = true;
                player.playVideo();
                // Actualizamos el botón principal (color/icono)
                if (typeof actualizarVisualesMusica === 'function') {
                    actualizarVisualesMusica(true);
                }
            } else if (player.getPlayerState() !== 1) {
                // Si ya debería estar sonando pero el player se detuvo, le damos play
                player.playVideo();
            }
        } else if (volumeValue === 0 && isMusicPlaying) {
            // Si el volumen llega a 0, marcamos como no reproduciendo y pausamos
            isMusicPlaying = false;
            player.pauseVideo();
            if (typeof actualizarVisualesMusica === 'function') {
                actualizarVisualesMusica(false);
            }
        }
    }

    // 2. Sincronizar Sliders (Escritorio y Emergente)
    const mainSlider = document.getElementById('music-volume');
    // Eliminamos originId !== 'music-volume' para permitir resets forzados del sistema
    if (mainSlider) mainSlider.value = volumeValue;

    const syncSlider = document.getElementById('music-volume-sync');
    if (syncSlider) syncSlider.value = volumeValue;

    // 3. Visuales del icono de volumen (el peque?o altavoz)
    if (typeof updateVolumeButtonVisuals === 'function') {
        updateVolumeButtonVisuals(volumeValue);
    }

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
        
        // Opcional: Pausar para ahorrar recursos, pero solo si realmente est谩 en 0
        if (player && typeof player.pauseVideo === 'function') player.pauseVideo();
    } else {
        // CON VOLUMEN
        btn.style.opacity = "1";
        
        if (isMusicPlaying) {
            btn.classList.remove('music-waiting-pulse');
            btn.classList.add('music-playing-beat');
            // Si el volumen subi贸, nos aseguramos de que suene
            if (player && typeof player.playVideo === 'function') {
                if (player.getPlayerState() !== 1) player.playVideo();
            }
        } else {
            btn.classList.add('music-waiting-pulse');
        }
    }
}



function toggleSoundtrack() {
    if (!player || !isPlayerReady) return;

    // Si vamos a encender y el volumen es 0, usamos la función global para subirlo
    if (!isMusicPlaying && player.getVolume() === 0) {
        globalVolumeControl(20, 'auto-fix');
        return; // globalVolumeControl ya se encarga de dar play y actualizar visuales
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




function actualizarVisualesMusica(activar) {
    const musicBtn = document.getElementById('btn-music-main');
    const musicIcon = document.getElementById('music-icon');
    const volBtn = document.getElementById('btn-volume-yt');
    const statusText = document.getElementById('music-status-text');
    
    const syncSlider = document.getElementById('music-volume-sync');
    const volumeValue = syncSlider ? parseInt(syncSlider.value) : 0;

    if (activar) {
        if (musicBtn) musicBtn.style.background = "#FFD920A6";
        if (musicIcon) musicIcon.innerText = "pause";
        if (statusText) statusText.innerText = "REPRODUCIENDO...";
        
        if (volBtn) {
            volBtn.style.opacity = (volumeValue === 0) ? "0.6" : "1";
            if (volumeValue === 0) {
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
            volBtn.style.opacity = "0.6";
            volBtn.classList.remove('music-playing-beat');
            volBtn.classList.add('music-waiting-pulse');
        }
    }
}

function toggleVolumePopover(event) {
    if (event) event.stopPropagation();
    
    if (typeof closeVoiceSidebar === 'function') closeVoiceSidebar();
    
    const volBtn = document.getElementById('btn-volume-yt');
    const sidebar = document.getElementById('volume-sidebar-container');
    const syncSlider = document.getElementById('music-volume-sync');

    // SI ESTá APAGADO: Al abrir la barra, queremos que empiece a sonar
    if (isPlayerReady && !isMusicPlaying) {
        // Si el slider está en 0, lo subimos al 20% automáticamente para que suene
        if (syncSlider && parseInt(syncSlider.value) === 0) {
            globalVolumeControl(20, 'auto-fix');
        } else {
            toggleSoundtrack(); // Si ya tenía volumen, solo damos play
        }
    }

    if (!sidebar) return;

    if (sidebar.classList.contains('hidden')) {
        sidebar.classList.remove('hidden');
        clearTimeout(window.volumeTimeout);
        window.volumeTimeout = setTimeout(closeVolumeSidebar, 4000);
    } else {
        closeVolumeSidebar();
    }
}

// Funci贸n para cerrar con animaci贸n hacia el costado
function closeVolumeSidebar() {
    const sidebar = document.getElementById('volume-sidebar-container');
    if (sidebar && !sidebar.classList.contains('hidden')) {
        // A帽adimos una clase de transici贸n (debes ponerla en tu CSS)
        sidebar.style.transform = "translateY(-50%) translateX(100px)";
        sidebar.style.opacity = "0";
        
        setTimeout(() => {
            sidebar.classList.add('hidden');
            // Reseteamos estilos para la pr贸xima vez que se abra
            sidebar.style.transform = "";
            sidebar.style.opacity = "";
        }, 400); // Duraci贸n de la animaci贸n
    }
}

// Cerrar al hacer clic fuera
window.addEventListener('click', () => {
    closeVolumeSidebar(); // Ya estaba
    if (typeof closeVoiceSidebar === 'function') closeVoiceSidebar(); // <--- LíNEA NUEVA
});





document.addEventListener('DOMContentLoaded', () => {
    const syncSlider = document.getElementById('music-volume-sync');
    const sidebar = document.getElementById('volume-sidebar-container');
    const voiceSidebar = document.getElementById('voice-volume-sidebar');
    const voiceSlider = document.getElementById('voice-volume-sync');

    // --- PROTECCIóN DE BARRAS ---
    sidebar?.addEventListener('click', (e) => e.stopPropagation());
    sidebar?.addEventListener('mousedown', (e) => e.stopPropagation());
    voiceSidebar?.addEventListener('click', (e) => e.stopPropagation());
    voiceSidebar?.addEventListener('mousedown', (e) => e.stopPropagation());

    // --- LóGICA SLIDER MúSICA (AZUL) ---
    if (syncSlider) {
        syncSlider.addEventListener('input', (e) => {
            globalVolumeControl(e.target.value, 'music-volume-sync');
        });

        const handleTouch = (e) => {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            const touch = e.touches[0];
            const rect = syncSlider.getBoundingClientRect();
            const isVertical = rect.height > rect.width;
            let percentage = isVertical 
                ? ((rect.bottom - touch.clientY) / rect.height) * 100 
                : ((touch.clientX - rect.left) / rect.width) * 100;
            let finalVal = Math.round(Math.min(Math.max(percentage, 0), 100));
            if (!isNaN(finalVal)) {
                syncSlider.value = finalVal;
                globalVolumeControl(finalVal, 'music-volume-sync');
            }
        };

        syncSlider.addEventListener('touchstart', (e) => {
            clearTimeout(window.volumeTimeout);
            handleTouch(e);
        }, { passive: false });
        syncSlider.addEventListener('touchmove', handleTouch, { passive: false });
        
        const handleRelease = (e) => {
            e.stopPropagation(); 
            clearTimeout(window.volumeTimeout);
            window.volumeTimeout = setTimeout(closeVolumeSidebar, 3000);
        };
        syncSlider.addEventListener('touchend', handleRelease);
        syncSlider.addEventListener('mouseup', handleRelease);
    }

    // --- LóGICA TáCTIL PARA EL SLIDER DE VOZ (VERDE) ---
    if (voiceSlider) {
        const handleVoiceTouch = (e) => {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            const touch = e.touches[0];
            const rect = voiceSlider.getBoundingClientRect();
            const isVertical = rect.height > rect.width;
            
            let percentage = isVertical 
                ? ((rect.bottom - touch.clientY) / rect.height) 
                : ((touch.clientX - rect.left) / rect.width);
            
            // CAMBIO CLAVE: Forzamos el 0.3 aquí también
            let finalVal = Math.min(Math.max(percentage, 0.3), 1).toFixed(1);

            if (!isNaN(finalVal)) {
                voiceSlider.value = finalVal;
                if (typeof controlVoiceVolume === 'function') controlVoiceVolume(finalVal);
            }
        };

        voiceSlider.addEventListener('touchstart', (e) => {
            clearTimeout(window.voiceTimeout);
            handleVoiceTouch(e);
        }, { passive: false });
        voiceSlider.addEventListener('touchmove', handleVoiceTouch, { passive: false });

        const releaseVoice = (e) => {
            e.stopPropagation();
            clearTimeout(window.voiceTimeout);
            window.voiceTimeout = setTimeout(closeVoiceSidebar, 3000);
        };
        voiceSlider.addEventListener('touchend', releaseVoice);
        voiceSlider.addEventListener('mouseup', releaseVoice);

        // RESET AL CARGAR: 100%
        voiceSlider.value = "1"; 
        if (typeof nexusVoiceVolume !== 'undefined') nexusVoiceVolume = 1.0;
    }
});

// Funci贸n de cierre con retraso y animaci贸n
function startClosingTimeout() {
    clearTimeout(window.volumeTimeout);
    window.volumeTimeout = setTimeout(() => {
        const sidebar = document.getElementById('volume-sidebar-container');
        if (sidebar && !sidebar.classList.contains('hidden')) {
            sidebar.classList.add('closing-animation'); // A帽adimos clase de salida
            
            // Esperamos a que termine la animaci贸n de CSS para ocultarlo realmente
            setTimeout(() => {
                sidebar.classList.add('hidden');
                sidebar.classList.remove('closing-animation');
            }, 400); 
        }
    }, 3000); // 3 segundos de cortes铆a antes de irse
}

// Función nueva para cerrar la barra de voz con animación
function closeVoiceSidebar() {
    const sidebar = document.getElementById('voice-volume-sidebar');
    if (sidebar && !sidebar.classList.contains('hidden')) {
        // Aplicamos la misma animación de salida que la de música
        sidebar.style.transform = "translateY(-50%) translateX(100px)";
        sidebar.style.opacity = "0";
        
        setTimeout(() => {
            sidebar.classList.add('hidden');
            // Reseteamos estilos para que al volver a abrir aparezca bien
            sidebar.style.transform = "";
            sidebar.style.opacity = "";
        }, 400); 
    }
}

// Función para manejar el tiempo de cierre de la voz (independiente de la música)
function startVoiceClosingTimeout() {
    clearTimeout(window.voiceTimeout);
    window.voiceTimeout = setTimeout(closeVoiceSidebar, 3000);
}