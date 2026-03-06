/**
 * NEXUS VOICE - Módulo de síntesis de voz y diccionario fonético.
 * Extraído de nexus-core.js para mejorar la modularidad.
 */

window.readerSpeechRate = 1.0;
window.isSpeaking = false;
window.isPaused = false;
window.speechSubChunks = [];
window.currentSubChunkIndex = 0;
window.currentUtterance = null;
window.synth = window.speechSynthesis;
window.pauseTimer = null;
window.VOICE_REPLACEMENTS = {};
const DICTIONARY_URL = "https://raw.githubusercontent.com/proc3r/nexus/master/voice-dictionary.json";
window.nexusSpeechTimeout = null; // Guardará el timer actual



// --- GESTIÓN DEL DICCIONARIO ---

async function loadExternalDictionary() {
		try {
			const response = await fetch(DICTIONARY_URL);
			if (response.ok) {
				VOICE_REPLACEMENTS = await response.json();
				console.log("Diccionario fonético cargado correctamente");
			}
		} catch (e) {
			console.error("No se pudo cargar el diccionario externo", e);
			VOICE_REPLACEMENTS = {};
		}
	}
	
	
	// Añadir al principio de nexus-voice.js o antes de startSpeech
function getDynamicChunkLimit() {
    const currentLang = localStorage.getItem('nexus_preferred_lang') || 'es';
    const baseLang = currentLang.split('-')[0].toLowerCase();

    // Configuración de límites por idioma
    const limits = {
        'zh': 55,  // Chino
        'ko': 80,  // Coreano
        'ja': 60,  // Japonés
        'default': 130
    };

    const limit = limits[baseLang] || limits['default'];
   /* console.log(`Nexus Voice: Límite de caracteres para '${baseLang}': ${limit}`);*/
    return limit;
}

// --- CONTROLADOR DE VOZ DEL LECTOR ---


function setReaderSpeed(rate) {
    window.readerSpeechRate = rate;
    const label = document.getElementById('reader-speed-label');
    if (label) label.innerText = rate + 'x';
    document.getElementById('reader-speed-menu')?.classList.add('hidden');
    
    if (typeof updateVisualTimerSpeed === 'function') {
        updateVisualTimerSpeed();
    }

    // --- NUEVA LÍNEA CLAVE ---
    // Forzamos la actualización del cronómetro de lectura al cambiar la velocidad
    if (typeof updateTimeRemaining === 'function') {
        updateTimeRemaining();
    }
}

	
	function filterTextForVoice(text) {
		let cleanText = text;
		cleanText = cleanText.replace(/\d+\.\d+\.\d+\s?»/g, '');
		for (let [original, reemplazo] of Object.entries(VOICE_REPLACEMENTS)) {
			const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const regex = new RegExp(`\\b${escapedOriginal}(?=\\s|$|[,.;])`, 'gi');
			cleanText = cleanText.replace(regex, reemplazo);
		}
		return cleanText;
	}

	function toggleSpeech() { if (isPaused) resumeSpeech(); else if (isSpeaking) stopSpeech(); else startSpeech(); }

	function toggleReaderSpeedMenu(event) {
			if (event) event.stopPropagation(); // Evita que el clic llegue al document
			const menu = document.getElementById('reader-speed-menu');
			menu.classList.toggle('hidden');
	}
	
		

async function startSpeech() {
    
    /* if (typeof launchFullScreen === 'function') {
        launchFullScreen(document.documentElement);
    }*/
	
    // 1. LIMPIEZA TOTAL
    window.synth.cancel();
    if (typeof stopVisualTimer === 'function') stopVisualTimer();

    // RESET DE ESTADOS
    window.visualPausedTime = null; 
    window.visualStartTime = null;
    if (window.visualTimerInterval) {
        clearTimeout(window.visualTimerInterval);
        window.visualTimerInterval = null;
    }
    
    window.isSpeaking = true; 
    window.isPaused = false;
    
    if (typeof syncLanguageSupport === 'function') {
        await syncLanguageSupport(); 
    }

    // 3. ACTUALIZAR UI
    document.getElementById('tts-btn').classList.add('hidden'); 
    document.getElementById('pause-btn').classList.remove('hidden'); 
    document.getElementById('stop-btn').classList.remove('hidden'); 
	document.getElementById('voice-vol-btn').classList.remove('hidden'); 
    if (typeof updatePauseUI === 'function') updatePauseUI(false);

    // CAPTURA DE TEXTO ORIGINAL (Sin filtros fallidos)
    const contentEl = document.getElementById('book-content');
    const rawText = chunks[currentChunkIndex] || "";
    const currentText = (contentEl && contentEl.innerText.trim() !== "") ? contentEl.innerText.trim() : rawText;

    const isImage = rawText.match(/!\[\[(.*?)\]\]/);
    
    if (isImage) {
        if (typeof clearImageTimer === 'function') clearImageTimer();
        if (typeof startImageTimer === 'function') startImageTimer(); 
    } else {
        // 4. INTERRUPTOR DE MODO
        if (window.hasAvailableVoice === false) {
            // MODO VISUAL: Ocultamos refresh porque no hay voz que arreglar
            const btnRefresh = document.getElementById('refresh-voice-btn');
            if (btnRefresh) btnRefresh.style.display = 'none';

            if (typeof showVisualTimer === 'function' && typeof calculateReadingTime === 'function') {
                const duration = calculateReadingTime(currentText);
                showVisualTimer(duration);
            }
            return; 
        }

        // 5. MODO AUDIO: Mostramos refresh y aviso
        if (typeof stopVisualTimer === 'function') stopVisualTimer();
        
        const btnRefresh = document.getElementById('refresh-voice-btn');
        if (btnRefresh) btnRefresh.style.display = 'block'; 
        
        mostrarAvisoLectura(); 
        
        /*console.log("Nexus Voice: Iniciando lectura.");*/
        prepareAndStartSpeech(currentText); 
    }
}


function pauseSpeech() { 
    if (!isSpeaking) return;

    // 1. DETECCIÓN DE MÓVIL (Tu lógica original intacta)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        stopSpeech();
        return;
    }

    // 2. LÓGICA PARA MODO VISUAL (Sin Voz) - AJUSTADA
    if (window.hasAvailableVoice === false) {
        if (!isPaused) {
            // Llamamos a la pausa que congela la barra y guarda el tiempo restante
            if (typeof pauseVisualTimer === 'function') pauseVisualTimer();
            isPaused = true;
            updatePauseUI(true);
           /* console.log("Nexus Voice: Barra visual pausada");*/
        } else {
            resumeSpeech();
        }
        return;
    }

    // 3. LÓGICA PARA IMAGEN (Tu lógica original intacta)
    const timerEl = document.getElementById('image-timer');
    const isImageActive = timerEl && !timerEl.classList.contains('hidden');

    if (isImageActive) {
        if (typeof togglePauseImageTimer === 'function') {
            togglePauseImageTimer();
        } else {
            window.isImageTimerPaused = !window.isImageTimerPaused;
            updatePauseUI(window.isImageTimerPaused);
        }
    } else {
        // 4. LÓGICA PARA TEXTO (TTS Normal)
        if (!isPaused) { 
            synth.pause(); 
            isPaused = true; 
            updatePauseUI(true); 
         /*   console.log("Nexus Voice: Audio pausado");*/
        } else {
            resumeSpeech(); 
        }
    }

    // Timer de seguridad de 15 segundos (Tu lógica original intacta)
    clearTimeout(window.pauseTimer);
    window.pauseTimer = setTimeout(() => {
        const imageIsPaused = (typeof NexusImage !== 'undefined' && NexusImage.isPaused);
        if (window.isPaused || imageIsPaused) {
            stopSpeech(); 
        }
    }, 15000); 
}



function resumeSpeech() { 
    clearTimeout(window.pauseTimer);
    
    // MODO VISUAL (Sin Voz) - AJUSTADA
    if (!window.hasAvailableVoice) {
        isPaused = false;
        updatePauseUI(false);
        
        // Verificamos si existe la función para reanudar el tiempo restante
        if (typeof resumeVisualTimer === 'function') {
            resumeVisualTimer();
        } else {
            // Si por algún motivo no existe, fallback al reinicio normal
            const currentText = chunks[currentChunkIndex] || "";
            if (typeof showVisualTimer === 'function') {
                showVisualTimer(calculateReadingTime(currentText));
            }
        }
        return;
    }

    // VERIFICACIÓN DE IMAGEN (Tu lógica original intacta)
    const timerEl = document.getElementById('image-timer');
    const isImageActive = timerEl && !timerEl.classList.contains('hidden');

    if (isImageActive) {
        if (isImageTimerPaused) togglePauseImageTimer();
    } else {
        // LÓGICA NORMAL DE TEXTO
        synth.resume(); 
        isPaused = false; 
        updatePauseUI(false); 
    }
    
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) pauseBtn.title = "";
}


function updatePauseUI(paused) { 
    const icon = document.getElementById('pause-icon'); 
    const pauseBtn = document.getElementById('pause-btn');
    
    if (icon) {
        icon.innerHTML = paused ? '&#xe037;' : '&#xe1a2;'; 
    }
    
    if (pauseBtn) {
        if (paused) {
            pauseBtn.classList.add('bg-pause-active');
            pauseBtn.title = "Si no reanuda, presione STOP y luego PLAY";
        } else {
            pauseBtn.classList.remove('bg-pause-active');
            pauseBtn.title = "";
        }
    }
}


function stopSpeech() { 
    clearTimeout(window.pauseTimer);
    if (window.nexusSpeechTimeout) {
        clearTimeout(window.nexusSpeechTimeout);
        window.nexusSpeechTimeout = null;
    }
    
    // DETENCIÓN DE BARRA VISUAL
    if (typeof stopVisualTimer === 'function') stopVisualTimer();
    
    window.synth.cancel(); 
    window.isSpeaking = false; 
    window.isPaused = false; 
    
    window.isImageTimerPaused = false; 
    if (typeof NexusImage !== 'undefined') {
        NexusImage.isPaused = false;
        NexusImage.secondsLeft = 5;
    }
    
    window.speechSubChunks = [];
    window.currentSubChunkIndex = 0;
    
    if (typeof clearImageTimer === 'function') clearImageTimer(); 
    
    document.getElementById('tts-btn').classList.remove('hidden'); 
    document.getElementById('pause-btn').classList.add('hidden'); 
    document.getElementById('stop-btn').classList.add('hidden'); 
    document.getElementById('voice-vol-btn').classList.add('hidden'); 
	if (typeof closeVoiceSidebar === 'function') closeVoiceSidebar();
	
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
        pauseBtn.classList.remove('bg-pause-active');
        pauseBtn.title = "";
    }
    updatePauseUI(false); 
    /*console.log("Nexus Voice: Stop total ejecutado.");*/
}
	

// Variable global para evitar bucles infinitos en idiomas similares
if (typeof window.romanceRetryCount === 'undefined') window.romanceRetryCount = 0;




function prepareAndStartSpeech() {
    // 1. COMPROBACIONES DE SEGURIDAD
    const synModal = document.getElementById('synopsis-modal');
    if (synModal && !synModal.classList.contains('hidden')) return;
    
    // Matar procesos previos
    if (window.nexusSpeechTimeout) {
        clearTimeout(window.nexusSpeechTimeout);
        window.nexusSpeechTimeout = null;
    }

    if (window.synth.speaking || window.isPaused) {
        if (window.isPaused) window.synth.resume(); 
        window.synth.cancel();
    }
    
    window.isSpeaking = true; 
    window.isPaused = false;
    if (typeof updatePauseUI === 'function') updatePauseUI(false); 

    // 2. REFERENCIA DINÁMICA DEL NODO Y EL ANCLA
    let contentEl = document.getElementById('book-content');
    let anchor = document.getElementById('nexus-validation-anchor');
    
    if (!contentEl || contentEl.innerText.trim() === "") {
        window.nexusSpeechTimeout = setTimeout(prepareAndStartSpeech, 300);
        return;
    }
    
    // Obtenemos el idioma preferido
    const preferredLang = localStorage.getItem('nexus_preferred_lang') || 'es';
    const targetLang = getCurrentGoogleLang(); 
    
    const isTranslated = targetLang !== 'es' || preferredLang !== 'es';

    // 3. VALIDACIÓN POR ANCLA
    if (isTranslated && preferredLang !== 'es') {
        const anchorText = anchor ? anchor.innerText.toLowerCase().trim() : "";
        const isNotYetTranslated = !anchor || anchorText === "" || anchorText.includes("manzana");

        if (isNotYetTranslated) {
            if (window.romanceRetryCount < 8) {
                window.romanceRetryCount++;
                /*console.log(`Nexus Voice: Esperando señal de Google Translate (${window.romanceRetryCount}/8)...`);*/
                
                if (window.romanceRetryCount === 4) {
                    /*console.log("Nexus Voice: Forzando re-escaneo activo de Google...");*/
                    const poke = document.createElement('span');
                    poke.style.cssText = "position:absolute; visibility:hidden; width:1px;";
                    poke.innerHTML = " &nbsp; "; 
                    contentEl.appendChild(poke);
                    contentEl.dispatchEvent(new Event('input', { bubbles: true }));
                    setTimeout(() => poke.remove(), 50);
                }

                window.nexusSpeechTimeout = setTimeout(prepareAndStartSpeech, 350);
                return;
            } else {
             /*   console.warn("Nexus Voice: Tiempo de espera agotado.");*/
            }
        }
    }

    window.romanceRetryCount = 0; 

    // 4. PREPARACIÓN DEL TEXTO FINAL (MÉTODO DE CLONACIÓN)
    // Clonamos el elemento para manipularlo sin afectar la vista del usuario ni la traducción
    let textToRead = "";
    if (contentEl) {
        const tempDiv = contentEl.cloneNode(true);
        
        // Buscamos y eliminamos el ancla de validación DENTRO del clon
        // Así, no importa el idioma o lo que diga, la IA nunca lo verá.
        const internalAnchor = tempDiv.querySelector('#nexus-validation-anchor');
        if (internalAnchor) {
            internalAnchor.remove();
        }
        
        // También eliminamos posibles restos de clases de Apple/Google que causan ruidos
        const appleNewline = tempDiv.querySelector('.Apple-interchange-newline');
        if (appleNewline) appleNewline.remove();

        textToRead = tempDiv.innerText.trim();
    }

    // 5. REEMPLAZOS DE DICCIÓN Y NORMALIZACIÓN
    textToRead = textToRead.replace(/^>\s*-\s*/gm, "… ");
    textToRead = textToRead.replace(/^-\s+/gm, "… ");
    textToRead = textToRead.replace(/([a-zA-ZáéíóúÁÉÍÓÚ0-9])\s*-\s*([a-zA-ZáéíóúÁÉÍÓÚ])/g, "$1 … $2");
    textToRead = textToRead.replace(/([a-zA-ZáéíóúÁÉÍÓÚ0-9])\s*—\s*([a-zA-ZáéíóúÁÉÍÓÚ])/g, "$1,$2");
    
    textToRead = textToRead.toLowerCase(); 
    if (typeof filterTextForVoice === 'function') {
        textToRead = filterTextForVoice(textToRead);
    }

    // 6. ARRANQUE DEL AUDIO
    window.speechSubChunks = [];
    window.currentSubChunkIndex = 0;

    if (typeof splitTextSmartly === 'function') {
        const dynamicLimit = getDynamicChunkLimit();
        /*console.log(`Nexus Voice: Fragmentando con límite de ${dynamicLimit} caracteres.`);*/
        
        window.speechSubChunks = splitTextSmartly(textToRead, dynamicLimit);
        
        if (typeof speakSubChunk === 'function' && window.speechSubChunks.length > 0) {
            speakSubChunk();
        }
    }
}
	
	
	
	

function speakSubChunk() {
    if (!window.isSpeaking || window.isPaused) return;

    // 1. GESTIÓN DE SALTO DE PÁRRAFO (Automático)
    if (currentSubChunkIndex >= speechSubChunks.length) {
        window.speechSubChunks = [];
        window.currentSubChunkIndex = 0;

        if (!(currentChunkIndex === chunks.length - 1 && currentChapterIndex === currentBook.chapters.length - 1)) {
            window.synth.cancel(); 
            
            if (window.nexusSpeechTimeout) {
                clearTimeout(window.nexusSpeechTimeout);
                window.nexusSpeechTimeout = null;
            }

            setTimeout(async () => { 
              /*  console.log("Nexus Voice: Ejecutando salto automático...");*/
                window.navDirection = 'next'; 
                window.romanceRetryCount = 0; 
                await nextChunk(); 
            }, 600); 
        } else {
            stopSpeech();
        }
        return;
    }

    // 2. COMPROBACIÓN DE CONTENIDO REAL EN PANTALLA
    const contentEl = document.getElementById('book-content');
    if (!contentEl || contentEl.innerText.trim() === "") {
        console.log("Nexus Voice: Contenedor vacío. Abortando emisión.");
        return; 
    }

    // --- BLOQUEO CRÍTICO MODO VISUAL ---
    // Si ya sabemos que no hay voz, salimos antes de configurar la locución.
    // Esto evita que lea números en español y que los eventos 'onend' interfieran con la barra.
    if (window.hasAvailableVoice === false) {
       /* console.log("Nexus Voice: Modo Visual activo. TTS bloqueado para evitar interferencias.");*/
        return; 
    }
    // ------------------------------------

    // 3. CONFIGURACIÓN DE LA LOCUCIÓN (Forzado de Voz Regional)
    const utterance = new SpeechSynthesisUtterance(speechSubChunks[currentSubChunkIndex]);
    window.currentUtterance = utterance;

    const langCode = (typeof getTTSLanguageCode === 'function') ? getTTSLanguageCode() : (localStorage.getItem('nexus_preferred_lang') || 'es-ES');
    utterance.lang = langCode;
    utterance.rate = window.readerSpeechRate || 1.0;
    utterance.volume = nexusVoiceVolume; // Ahora usa el valor del slider

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
        let targetVoice = voices.find(v => v.lang.toLowerCase().replace('_', '-') === langCode.toLowerCase());
        if (!targetVoice) {
            targetVoice = voices.find(v => v.lang.toLowerCase().startsWith(langCode.split('-')[0].toLowerCase()));
        }
        if (targetVoice) {
            utterance.voice = targetVoice;
           /* console.log("Nexus Voice: Voz asignada ->", targetVoice.name, "[" + targetVoice.lang + "]");*/
        }
    }

    const startTime = Date.now();

    // 4. MANEJO DE EVENTOS
    utterance.onend = () => {
        const duration = Date.now() - startTime;

        if (window.isSpeaking && !window.isPaused) {
            // Este bloque captura fallos inesperados (ej: cuando creíamos que había voz pero no)
            if (duration < 100 && !langCode.startsWith('es')) {
              /*  console.warn("Nexus Voice: Audio demasiado corto. Activando Modo Lectura.");*/
                window.hasAvailableVoice = false;
                
                if (typeof showVisualTimer === 'function') {
                    const textToMeasure = speechSubChunks.join(" ");
                    showVisualTimer(calculateReadingTime(textToMeasure));
                } else {
                    stopSpeech();
                }
                return;
            }

            currentSubChunkIndex++;
            const targetLang = getCurrentGoogleLang();
            const isTranslated = targetLang !== 'es';
            
            setTimeout(() => { 
                if (window.isSpeaking && !window.isPaused) speakSubChunk(); 
            }, isTranslated ? 300 : 150); 
        }
    };

    utterance.onerror = (e) => {
        if (e.error !== 'interrupted') {
            console.error("Nexus TTS Error:", e.error);
            setTimeout(() => { if (window.isSpeaking) speakSubChunk(); }, 500);
        }
    };

    // 5. EJECUCIÓN DEL AUDIO
    window.synth.cancel();
    setTimeout(() => { 
        // Doble seguridad: solo hablamos si sigue habiendo voz disponible
        if (window.isSpeaking && !window.isPaused && window.hasAvailableVoice !== false) {
            window.synth.speak(utterance);
        }
    }, 50);
}


/**
 * Reinicia la lectura actual capturando el texto fresco del DOM.
 * Útil si el traductor tardó en aplicar el idioma.
 */
async function refreshSpeech() {
   /* console.log("Nexus Voice: Solicitando reinicio de lectura...");*/

    // 1. Detenemos cualquier audio y limpiamos estados
    window.synth.cancel();
    if (window.nexusSpeechTimeout) {
        clearTimeout(window.nexusSpeechTimeout);
        window.nexusSpeechTimeout = null;
    }

    // 2. Reseteamos los sub-chunks para forzar re-fragmentación
    window.speechSubChunks = [];
    window.currentSubChunkIndex = 0;

    // 3. Pequeña pausa para asegurar que el sintetizador liberó el hilo
    setTimeout(async () => {
        // 4. Volvemos a sincronizar idioma por si acaso
        if (typeof syncLanguageSupport === 'function') {
            await syncLanguageSupport();
        }

        // 5. Llamamos a prepareAndStartSpeech que volverá a leer el innerText
        // del contenedor 'book-content' (ya traducido)
        if (typeof prepareAndStartSpeech === 'function') {
            prepareAndStartSpeech();
        }
    }, 200);
}

// Variable global para controlar la frecuencia (fuera de la función)
window.ultimaVezAvisoNexus = 0;

function mostrarAvisoLectura() {
    const ahora = Date.now();
    // 30000 milisegundos = 30 segundos de "descanso" antes de volver a mostrarlo
    if (ahora - window.ultimaVezAvisoNexus < 30000) {
        console.log("Nexus: Aviso silenciado para evitar repetición.");
        return; 
    }

    const toast = document.getElementById('reading-help-toast');
    const toastText = toast?.querySelector('.toast-text');
    if (!toast || !toastText) return;

    const currentLang = localStorage.getItem('nexus_preferred_lang');
    
    // Solo actuamos si no es español (idioma original)
    if (currentLang && currentLang !== 'es') {
        // Actualizamos la marca de tiempo para el bloqueo de repetición
        window.ultimaVezAvisoNexus = ahora;

        // Texto adaptado
        toastText.innerText = "¿Traducción errónea? Pulsa";

        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 6000); 
    }
}

document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        // 1. Verificamos si el idioma NO es español
        // Detecta el atributo lang del HTML (es el método más fiable)
        const currentLang = document.documentElement.lang.toLowerCase();
        const isSpanish = currentLang.startsWith('es');

        // 2. Solo ejecutamos la parada si se está leyendo Y NO es español
        if (window.isSpeaking && !isSpanish) {
            window.synth.cancel();
            window.isSpeaking = false;
            window.isPaused = false;
            
            // Actualizar UI de botones
            const ttsBtn = document.getElementById('tts-btn');
            const pauseBtn = document.getElementById('pause-btn');
            const stopBtn = document.getElementById('stop-btn');
            
            if (ttsBtn) ttsBtn.classList.remove('hidden');
            if (pauseBtn) pauseBtn.classList.add('hidden');
            if (stopBtn) stopBtn.classList.add('hidden');
            
            console.log(`🌍 Idioma detectado: ${currentLang}. Pausando por seguridad de traducción.`);
            crearOverlayMensaje("Lectura detenida para preservar la traducción.");
        } else if (window.isSpeaking && isSpanish) {
            console.log("🇪🇸 Idioma español detectado. La lectura continúa en segundo plano.");
        }
    }
});

const nexusI18n = {
    'es': { title: "Lectura en espera", msg: "Pausado para evitar errores de traducción. Mantén la pestaña visible si deseas seguir escuchando el audio.", resume: "Continuar con voz", close: "Modo manual" },
    'en': { title: "Reading Paused", msg: "Paused to prevent translation errors. Please keep this tab visible if you want to continue listening to the audio.", resume: "Continue with Voice", close: "Manual Mode" },
    'de': { title: "Lesepause", msg: "Gestoppt, um Übersetzungsfehler zu vermeiden. Lassen Sie den Tab im Vordergrund, wenn Sie die Sprachausgabe weiter hören möchten.", resume: "Mit Stimme fortfahren", close: "Manueller Modus" },
    'ru': { title: "Чтение в ожидании", msg: "Пауза для предотвращения ошибок перевода. Держите вкладку открытой, если хотите продолжить прослушивание аудио.", resume: "Продолжить голосом", close: "Ручной режим" },
    'hi': { title: "पढ़ना रुक गया है", msg: "अनुवाद त्रुटियों को रोकने के लिए रोका गया। यदि आप ऑडियो सुनना जारी रखना चाहते हैं तो इस टैब को खुला रखें।", resume: "आवाज के साथ जारी रखें", close: "मैनुअल मोड" },
    'fr': { title: "Lecture en attente", msg: "Pause pour éviter les erreurs de traducción. Gardez l'onglet visible si vous souhaitez continuer à écouter l'audio.", resume: "Continuer avec la voix", close: "Mode manuel" },
    'it': { title: "Lettura in attesa", msg: "In pausa per evitare errori di traduzione. Mantieni la scheda visibile se desideri continuare ad ascoltare l'audio.", resume: "Continua con la voce", close: "Modalità manuale" },
    'pt': { title: "Leitura em espera", msg: "Pausado para evitar erros de tradução. Mantenha a aba visível se desejar continuar ouvindo o áudio.", resume: "Continuar com voz", close: "Modo manual" },
    'ko': { title: "읽기 대기 중", msg: "번역 오류를 방지하기 위해 일시 중지됨. 오디오를 계속 듣고 싶다면 이 탭을 활성 상태로 유지하세요.", resume: "음성으로 계속하기", close: "수동 모드" },
    'ja': { title: "読書を一時停止中", msg: "翻訳エラーを避けるために停止しました。音声での読み上げを続けたい場合は、この画面を表示したままにしてください。", resume: "音声で続行", close: "マニュアルモード" },
    'ar': { title: "القراءة في الانتظار", msg: "توقف مؤقتًا لتجنب أخطاء الترجمة. يرجى إبقاء التبويب مرئية إذا كنت ترغب في الاستمرار في الاستماع إلى الصوت.", resume: "المتابعة بالصوت", close: "الوضع اليدوي" },
    'tr': { title: "Okuma Beklemede", msg: "Çeviri hatalarını önlemek için duraklatıldı. Sesli okumaya devam etmek istiyorsanız lütfen bu sekmeyi açık tutun.", resume: "Sesle devam et", close: "Manuel mod" },
    'vi': { title: "Đang tạm dừng đọc", msg: "Đã tạm dừng để tránh lỗi dịch. Vui lòng giữ tab này hiển thị nếu bạn muốn tiếp tục nghe âm thanh.", resume: "Tiếp tục bằng giọng nói", close: "Chế độ thủ công" },
    'pl': { title: "Czytanie wstrzymane", msg: "Wstrzymano, aby zapobiec błędom w tłumaczeniu. Pozostaw tę kartę widoczną, jeśli chcesz nadal słuchać dźwięku.", resume: "Kontynuuj z głosem", close: "Tryb ręczny" },
    'nl': { title: "Lezen gepauzeerd", msg: "Gepauzeerd om vertaalfouten te voorkomen. Houd dit tabblad zichtbaar als u naar de audio wilt blijven luisteren.", resume: "Doorgaan met stem", close: "Handmatige modus" },
    'th': { title: "หยุดการอ่านชั่วคราว", msg: "หยุดชั่วคราวเพื่อป้องกันข้อผิดพลาดในการแปล โปรดเปิดแท็บนี้ค้างไว้หากคุณต้องการฟังเสียงต่อ", resume: "ฟังเสียงต่อ", close: "โหมดแมนนวล" },
    'id': { title: "Pembacaan Ditangguhkan", msg: "Dihentikan sebentar untuk menghindari kesalahan terjemahan. Biarkan tab ini tetap terlihat jika ingin terus mendengarkan audio.", resume: "Lanjutkan suara", close: "Mode manual" },
    'zh': { title: "阅读暂停", msg: "为了防止翻译错误，已暂停阅读。如果您想继续收听音频，请保持此标签页处于激活状态。", resume: "继续语音播放", close: "手动模式" },
    'sv': { title: "Läsning pausad", msg: "Pausad för att förhindra översättningsfel. Håll den här fliken synlig om du vill fortsätta lyssna på ljudet.", resume: "Fortsätt med röst", close: "Manuellt läge" },
    'el': { title: "Ανάγνωση σε παύση", msg: "Παύση για αποφυγή σφαλμάτων μετάφρασης. Κρατήστε αυτήν την καρτέλα ορατή εάν θέλετε να συνεχίσετε να ακούτε τον ήχο.", resume: "Συνέχεια με φωνή", close: "Μη αυτόματη λειτουργία" },
    'ro': { title: "Lectură în așteptare", msg: "Pauză pentru a preveni erorile de traducere. Menține fila vizibilă dacă dorești să asculți în continuare audio.", resume: "Continuă cu voce", close: "Mod manual" },
    'uk': { title: "Читання призупинено", msg: "Призупинено, щоб запобігти помилкам перекладу. Тримайте цю вкладку відкритою, якщо хочете продовжити прослуховування.", resume: "Продовжити голосом", close: "Ручний режим" },
    'hu': { title: "Olvasás felfüggesztve", msg: "A fordítási hibák elkerülése érdekében felfüggesztve. Tartsa láthatóan ezt a lapot, ha továbbra is hallgatni szeretné a hangot.", resume: "Folytatás hanggal", close: "Kézi mód" },
    'cs': { title: "Čtení pozastaveno", msg: "Pozastaveno, aby se předešlo chybám v překladu. Pokud chcete nadále poslouchat zvuk, nechte tuto kartu viditelną.", resume: "Pokračovat hlasem", close: "Ruční režim" },
    'fa': { title: "توقف موقت خواندن", msg: "برای جلوگیری از خطای ترجمه متوقف شد. اگر می‌خواهید به شنیدن صوت ادامه دهید، این برگه را باز نگه دارید.", resume: "ادامه با صدا", close: "حالت دستی" }
};


function crearOverlayMensaje(textoOriginal) {
    if (document.getElementById('nexus-pause-overlay')) return;
    
    const lang = getCurrentGoogleLang() || 'en'; 
    // ¿Tenemos este idioma en nuestro diccionario?
    const isManual = nexusI18n.hasOwnProperty(lang);
    const i18n = isManual ? nexusI18n[lang] : nexusI18n['es']; // Si no es manual, usamos español como base para que Google traduzca desde ahí

    const overlay = document.createElement('div');
    overlay.id = 'nexus-pause-overlay';
    
    // Si es manual, ponemos 'notranslate'. Si no, dejamos que Google traduzca.
    const translateClass = isManual ? 'notranslate' : '';
    const translateAttr = isManual ? 'translate="no"' : 'translate="yes"';

    overlay.innerHTML = `
        <div class="nx-resume-bg-layer"></div>
        <div class="pause-content ${translateClass}" ${translateAttr}>
            <div style="font-size: 32px; margin-bottom: 20px;">📖</div>
            <h3>${i18n.title}</h3>
            <p>${i18n.msg}</p>
            <div class="pause-btn-group">
                <button id="nexus-btn-resume" class="btn-nexus btn-resume-voice">
                    🔊 ${i18n.resume}
                </button>
                <button id="nexus-btn-close" class="btn-nexus btn-only-read">
                    ${i18n.close}
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);

    // Lógica de botones y cierre (Igual que antes...)
    overlay.onclick = () => overlay.remove();
    const content = overlay.querySelector('.pause-content');
    content.onclick = (e) => e.stopPropagation();

    document.getElementById('nexus-btn-resume').onclick = (e) => {
        e.stopPropagation();
        overlay.remove();
        if (typeof startSpeech === 'function') startSpeech();
    };

    document.getElementById('nexus-btn-close').onclick = (e) => {
        e.stopPropagation();
        overlay.remove();
    };
}

// Variable global
let nexusVoiceVolume = 1.0; // Cambiado: ya no busca en localStorage

function speak(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = nexusVoiceVolume; 
    window.speechSynthesis.speak(utterance);
}

function toggleVoiceStack(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation(); // Evita que el clic cierre la barra inmediatamente
    }
    
    const voiceSidebar = document.getElementById('voice-volume-sidebar');
    
    // Cierre cruzado: Si la de música está abierta, se cierra
    closeVolumeSidebar();

    if (!voiceSidebar) return;

    if (voiceSidebar.classList.contains('hidden')) {
        voiceSidebar.classList.remove('hidden');
        voiceSidebar.style.transform = "";
        voiceSidebar.style.opacity = "";
        
        clearTimeout(window.voiceTimeout);
        window.voiceTimeout = setTimeout(closeVoiceSidebar, 4000);
    } else {
        closeVoiceSidebar();
    }
}

function controlVoiceVolume(valor) {
    // Aseguramos que nunca sea menor a 0.3 por lógica
    nexusVoiceVolume = Math.max(parseFloat(valor), 0.3);
    
    // Feedback: Si está leyendo, paramos y reiniciamos el chunk
    if (window.isSpeaking && !window.isPaused) {
        window.synth.cancel(); 
        
        clearTimeout(window.restartTimeoout);
        window.restartTimeoout = setTimeout(() => {
            // Solo reiniciamos si el usuario no pausó manualmente mientras movía el slider
            if (window.isSpeaking && !window.isPaused) {
                speakSubChunk(); 
            }
        }, 150); // Pequeño respiro para el motor TTS
    }

    clearTimeout(window.voiceTimeout);
    window.voiceTimeout = setTimeout(closeVoiceSidebar, 4000);
}

