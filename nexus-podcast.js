/**
 * NEXUS PODCAST MODULE - Versión Final con Portal de Resonancia y Control de Volumen
 */

let podAudioInstance = null; // Evita conflicto con TTS
let podActiveBookId = null;
let podTimer = null;
let currentSubtitles = []; // Almacena los subtítulos del libro activo
let lastSubtitleIndex = -1; // Control para evitar parpadeos
const SUBTITLE_OFFSET = 0.35; // Ajuste de sincronización (adelanto de 0.35s)
let translatedSubtitlesCache = []; // Nueva variable para guardar las frases ya traducidas
let currentPodSpeed = 0.8; // Velocidad inicial deseada
const podcastVoiceMap = {
    'es': 'es-ES', 'en': 'en-GB', 'de': 'de-DE', 'fr': 'fr-FR', 'it': 'it-IT', 
    'pt': 'pt-BR', 'ru': 'ru-RU', 'nl': 'nl-NL', 'pl': 'pl-PL', 'uk': 'uk-UA',
    'sv': 'sv-SE', 'no': 'nb-NO', 'da': 'da-DK', 'fi': 'fi-FI', 'el': 'el-GR',
    'hu': 'hu-HU', 'cs': 'cs-CZ', 'ro': 'ro-RO', 'tr': 'tr-TR', 'zh': 'zh-CN', 
    'ja': 'ja-JP', 'ko': 'ko-KR', 'hi': 'hi-IN', 'bn': 'bn-BD', 'id': 'id-ID', 
    'vi': 'vi-VN', 'th': 'th-TH', 'ms': 'ms-MY', 'ta': 'ta-IN', 'te': 'te-IN', 
    'mr': 'mr-IN', 'gu': 'gu-IN', 'kn': 'kn-IN', 'ml': 'ml-IN', 'pa': 'pa-IN', 
    'ur': 'ur-PK', 'tl': 'tl-PH', 'ar': 'ar-SA', 'fa': 'fa-IR', 'he': 'he-IL', 
    'sw': 'sw-KE', 'am': 'am-ET', 'yo': 'yo-NG', 'ig': 'ig-NG', 'zu': 'zu-ZA'
};

function getBestVoice(targetLang) {
    const baseLang = targetLang.split('-')[0];
    return podcastVoiceMap[baseLang] || targetLang;
}

// Canal de comunicación para evitar audios simultáneos en varias pestañas
const podcastChannel = new BroadcastChannel('nexus_podcast_sync');
let isTranslationPending = false; // Bloqueador de audio


podcastChannel.onmessage = (event) => {
    if (event.data === 'pause_others') {
        if (podAudioInstance && !podAudioInstance.paused) {
            console.log("Otra pestaña inició un audio. Pausando esta.");
            togglePodcastPlay(false); 
        }
    }
};



function initPodcast(bookId) {
    // --- NUEVO: ACTIVAR FULLSCREEN AL INICIAR PODCAST ---
    /* if (typeof launchFullScreen === 'function') {
        launchFullScreen(document.documentElement);
    }*/
    
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

    // Limpiar instancia previa y resetear subtítulos anteriores
    if (podAudioInstance) {
        podAudioInstance.pause();
        clearInterval(podTimer);
    }
    
    // --- AJUSTE PARA SUBTÍTULOS: Reset de estados antes de cargar el nuevo libro ---
    currentSubtitles = []; 
    lastSubtitleIndex = -1; // Reset del control de parpadeo
    const subTextEl = document.getElementById('pod-subtitle-text');
    if (subTextEl) subTextEl.innerText = "";
    const subWindow = document.getElementById('pod-subtitles-window');
    if (subWindow) subWindow.classList.add('hidden'); // Ocultar ventana mientras carga el nuevo

    // Actualizar badges visuales en la biblioteca
    document.querySelectorAll('.podcast-badge-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`pod-btn-${bookId}`) || document.querySelector(`[onclick*="${bookId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Configuración de nueva instancia
    podActiveBookId = bookId;
    podAudioInstance = audioEl;

    const fullUrl = book.podcastUrl.startsWith('http') ? book.podcastUrl : (typeof AUDIO_BASE_URL !== 'undefined' ? AUDIO_BASE_URL + book.podcastUrl : book.podcastUrl);
    
    // Genera la URL del SRT reemplazando la extensión del audio
    const srtUrl = fullUrl.replace(/\.(mp3|m4a|wav|ogg)$/i, '.srt');
    
    podAudioInstance.src = fullUrl;
    document.getElementById('podcast-book-title').innerText = book.title;
    
    playerContainer.classList.remove('hidden');
    playerContainer.style.display = 'flex';

    // Detector de finalización para abrir el Portal
    podAudioInstance.onended = () => {
        showPodcastEndPortal(podActiveBookId);
    };

    // Recuperar progreso
    const savedTime = localStorage.getItem(`pod-pos-${bookId}`);
    
    podAudioInstance.load();
   
   podAudioInstance.onloadedmetadata = () => {
        if (savedTime) podAudioInstance.currentTime = parseFloat(savedTime);
        document.getElementById('pod-progress').max = Math.floor(podAudioInstance.duration);
        
		// --- CONTROL DE VELOCIDAD INICIAL ---
			currentPodSpeed = 0.8;
				podAudioInstance.playbackRate = currentPodSpeed;
				const speedBtn = document.getElementById('pod-speed-btn');
				if (speedBtn) {
					speedBtn.innerText = "0.8x";
					speedBtn.style.color = "#00e676"; // Color de "modo estudio" activo
					speedBtn.style.borderColor = "#00e676";
				}
	
        // Determinamos el idioma real
        const targetLang = localStorage.getItem('nexus_preferred_lang') || 'es';
        
        // --- LÓGICA DIRECTA PARA ESPAÑOL ---
        if (targetLang === 'es' || targetLang === 'es-ES') {
            console.log("Nexus: Modo Español Directo.");
            isTranslationPending = false; 
            
            // Ocultamos cualquier mensaje de "Processing"
            const subWindow = document.getElementById('pod-subtitles-window');
            if (subWindow) subWindow.classList.add('hidden');

            // Cargamos el SRT normalmente (sin traducir)
            if (typeof cargarSubtitulos === 'function') {
                cargarSubtitulos(srtUrl);
            }

            togglePodcastPlay(true);
            startPodTimer();
        } 
        // --- LÓGICA PARA OTROS IDIOMAS ---
        else {
            isTranslationPending = true;
            const subTextEl = document.getElementById('pod-subtitle-text');
            if (subTextEl) subTextEl.innerText = "Synchronizing transcription...";
            
            podAudioInstance.pause();
            if (typeof cargarSubtitulos === 'function') {
                cargarSubtitulos(srtUrl);
            }
        }
        updatePlaybackUI();
    };
    
    setupMediaSession(book);
}


function updatePlaybackUI() {
    if (!podAudioInstance) return;
    
    const currentTime = podAudioInstance.currentTime;
    const progressEl = document.getElementById('pod-progress');
    if (progressEl) progressEl.value = Math.floor(currentTime);
    const timeEl = document.getElementById('pod-time');
    if (timeEl) timeEl.innerText = `${formatPodTime(currentTime)} / ${formatPodTime(podAudioInstance.duration || 0)}`;

    const subTextEl = document.getElementById('pod-subtitle-text');
    const subWindow = document.getElementById('pod-subtitles-window');
    if (!subTextEl || !subWindow) return;

    // SEGURIDAD: Si no hay subtítulos, ocultamos y salimos
    if (!currentSubtitles || currentSubtitles.length === 0) {
        if (!subWindow.classList.contains('hidden')) subWindow.classList.add('hidden');
        return;
    }

    // Mientras se traduce, mostramos el mensaje de espera
    if (typeof isTranslationPending !== 'undefined' && isTranslationPending) {
        subTextEl.innerText = "Synchronizing transcription...";
        subWindow.classList.remove('hidden');
        return;
    }

    const lookupTime = currentTime + SUBTITLE_OFFSET;
    const subIndex = currentSubtitles.findIndex(s => lookupTime >= s.start && lookupTime <= s.end);
    
    if (subIndex === lastSubtitleIndex) return;
    lastSubtitleIndex = subIndex;

     if (subIndex !== -1) {
        subTextEl.classList.add('notranslate');
        
        // REFUERZO: 
        // Primero intentamos leer la dirección del documento
        const currentDir = document.documentElement.dir || 'ltr';
        subTextEl.style.direction = currentDir;
        
        // Alineación: Si es RTL, a la derecha. Si es LTR, centrado.
        subTextEl.style.textAlign = (currentDir === 'rtl') ? 'right' : 'center';
        // ------------------

        // --- MOTOR DE TEXTO ---
        // 1. Prioridad: Caché de traducción (para idiomas extranjeros)
        // 2. Fallback: Texto original (para Español)
        let textToDisplay = translatedSubtitlesCache[subIndex] || currentSubtitles[subIndex].text;
        
        if (textToDisplay) {
            subTextEl.innerText = textToDisplay;
            subWindow.classList.remove('hidden');
        } else {
            subWindow.classList.add('hidden');
        }
    } else {
        subTextEl.innerText = "";
        subWindow.classList.add('hidden');
    }
}

function togglePodcastPlay(forcePlay = false) {
    if (!podAudioInstance) return;
    const btn = document.getElementById('pod-play-pause');
    
    if (podAudioInstance.paused || forcePlay) {
        // 1. Feedback visual imediato
        if (btn) btn.innerHTML = '<span class="material-icons">pause</span>';
        
        // Notificar outros canais para pausar
        podcastChannel.postMessage('pause_others');
        
        // --- AJUSTE DE VELOCIDAD ---
        // Aseguramos que use la velocidad guardada (ej. 0.8) antes de arrancar
        podAudioInstance.playbackRate = currentPodSpeed;
        // ---------------------------
        
        // 2. Iniciamos a tentativa de reprodução
        const playPromise = podAudioInstance.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log("Nexus: Audio iniciado correctamente a " + currentPodSpeed + "x");
            }).catch(e => {
                console.log("Nexus: Error en play controlado:", e);
                if (btn) btn.innerHTML = '<span class="material-icons">play_arrow</span>';
            });
        }
    } else {
        // Pause normal
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
        podAudioInstance.src = ""; 
        clearInterval(podTimer);
    }
    
    // Borramos el almacén temporal de traducción
    const preTranslateDiv = document.getElementById('pod-pre-translate');
    if (preTranslateDiv) preTranslateDiv.remove();
    
    translatedSubtitlesCache = [];
    isTranslationReady = false;

    const playerContainer = document.getElementById('podcast-player-container');
    if (playerContainer) {
        playerContainer.classList.add('hidden');
        playerContainer.style.display = 'none';
    }
    
    const subWindow = document.getElementById('pod-subtitles-window');
    if (subWindow) subWindow.classList.add('hidden');

    document.querySelectorAll('.podcast-badge-btn').forEach(btn => btn.classList.remove('active'));
    podActiveBookId = null;
    lastSubtitleIndex = -1;
}

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

// --- FUNCIONES DE SOPORTE PARA SUBTÍTULOS SRT ---

// --- ACTUALIZA ESTA FUNCIÓN (Ajuste para forzar la traducción de Google) ---




async function cargarSubtitulos(url) {
    try {
        // Reset de estados para la nueva carga/traducción
        lastSubtitleIndex = -1;
        currentSubtitles = [];
        translatedSubtitlesCache = [];
        isTranslationPending = true;

        const response = await fetch(url);
        if (!response.ok) {
            console.log("Nexus: SRT no encontrado.");
            isTranslationPending = false;
            // Solo intentamos dar play si el audio existe y está pausado
            if (podAudioInstance && podAudioInstance.paused) { 
                togglePodcastPlay(true); 
                startPodTimer(); 
            }
            return;
        }

        const data = await response.text();
        currentSubtitles = parseSRT(data);

        // DETERMINACIÓN DE IDIOMA
        let targetLang = localStorage.getItem('nexus_preferred_lang') || 'es';
        
        // --- BLINDAJE PARA ESPAÑOL (FLUJO RÁPIDO) ---
        if (targetLang === 'es' || targetLang === 'es-ES' || targetLang === '') {
            console.log("Nexus: [FLUJO RÁPIDO] Español detectado. Saltando traducción.");
            
            isTranslationPending = false; 

            if (podAudioInstance && podActiveBookId) {
                // CAMBIO DINÁMICO: Solo damos Play si estaba pausado. 
                // Si ya estaba sonando (cambio de idioma en vivo), no lo tocamos.
                if (podAudioInstance.paused) {
                    togglePodcastPlay(true);
                }
                startPodTimer();
            }
            return; 
        }

        // --- FLUJO TRADUCCIÓN (IDIOMAS EXTRANJEROS) ---
        console.log("Nexus: [FLUJO TRADUCCIÓN] Idioma: " + targetLang);
        ejecutarFlujoTraduccion();

    } catch (e) {
        console.error("Nexus: Error en carga:", e);
        isTranslationPending = false;
        if (podAudioInstance && podAudioInstance.paused) { 
            togglePodcastPlay(true); 
            startPodTimer(); 
        }
    }
}


function ejecutarFlujoTraduccion() {
    let preTranslateDiv = document.getElementById('pod-pre-translate');
    if (preTranslateDiv) preTranslateDiv.remove();

    preTranslateDiv = document.createElement('div');
    preTranslateDiv.id = 'pod-pre-translate';
    preTranslateDiv.setAttribute('style', 'position:fixed; top:0; left:0; width:400px; height:400px; overflow-y:scroll; opacity:0.01; z-index:10000; background:white; color:black; pointer-events:none;');
    
    preTranslateDiv.innerHTML = currentSubtitles.map((s, i) => 
        `<p id="pre-sub-${i}" style="margin:10px 0; display:block;">${s.text}</p>`
    ).join('');
    
    document.body.appendChild(preTranslateDiv);

    let scrollStep = 0;
    const scrollInterval = setInterval(() => {
        scrollStep++;
        preTranslateDiv.scrollTop = (preTranslateDiv.scrollHeight / 5) * scrollStep;
        if (scrollStep >= 5) clearInterval(scrollInterval);
    }, 300);

    let attempts = 0;
    const checkTranslation = setInterval(() => {
        attempts++;
        let translatedCount = 0;

        currentSubtitles.forEach((sub, i) => {
            const el = document.getElementById(`pre-sub-${i}`);
            if (el) {
                const hasTags = el.innerHTML.includes('<font') || el.innerHTML.includes('<span');
                const textChanged = el.innerText.trim() !== sub.text.trim();
                if (hasTags || textChanged) {
                    translatedSubtitlesCache[i] = el.innerText;
                    translatedCount++;
                }
            }
        });

        if (translatedCount >= currentSubtitles.length * 0.90 || attempts > 20) {
            clearInterval(checkTranslation);
            isTranslationPending = false;
            preTranslateDiv.style.display = 'none';
            console.log("Nexus: Traducción completa.");
            if (podAudioInstance && podActiveBookId) {
                togglePodcastPlay(true);
                startPodTimer();
            }
        }
    }, 600);
}

function parseSRT(data) {
    const regex = /(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n([\s\S]*?)(?=\n{2}|\n$|$)/g;
    let match;
    const subs = [];
    while ((match = regex.exec(data)) !== null) {
        subs.push({
            start: srtTimeToSeconds(match[2]),
            end: srtTimeToSeconds(match[3]),
            text: match[4].replace(/\n/g, ' ').trim()
        });
    }
    return subs;
}

function srtTimeToSeconds(timeStr) {
    const [hms, ms] = timeStr.split(',');
    const [h, m, s] = hms.split(':').map(Number);
    return h * 3600 + m * 60 + s + Number(ms) / 1000;
}

window.stopAndHidePodcast = closePodcast;

function changePodSpeed() {
    if (!podAudioInstance) return;
    
    // Toggle simple entre 0.8 y 1.0
    currentPodSpeed = (currentPodSpeed === 0.8) ? 1.0 : 0.8;
    
    // Aplicar al audio
    podAudioInstance.playbackRate = currentPodSpeed;
    
    // Actualizar el texto del botón
    const speedBtn = document.getElementById('pod-speed-btn');
    if (speedBtn) {
        speedBtn.innerText = currentPodSpeed + "x";
        
        // Cambio visual: si está en 1.0x (normal) se ve estándar, 
        // si está en 0.8x (estudio) resalta un poco más
        speedBtn.style.color = (currentPodSpeed === 1.0) ? "#fff" : "#00e676";
        speedBtn.style.borderColor = (currentPodSpeed === 1.0) ? "rgba(255,255,255,0.3)" : "#00e676";
    }
}

