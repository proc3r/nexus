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
    console.log(`Nexus Voice: Límite de caracteres para '${baseLang}': ${limit}`);
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
    if (typeof launchFullScreen === 'function') {
        launchFullScreen(document.documentElement);
    }
    
    // 1. LIMPIEZA TOTAL DE AMBOS MODOS
    window.synth.cancel();
    
    if (typeof stopVisualTimer === 'function') {
        stopVisualTimer(); 
    }

    // RESET DE ESTADOS CRÍTICOS
    window.visualPausedTime = null; 
    window.visualStartTime = null;
    if (window.visualTimerInterval) {
        clearTimeout(window.visualTimerInterval);
        window.visualTimerInterval = null;
    }
    
    window.isSpeaking = true; 
    window.isPaused = false;
    
    // 2. SINCRONIZACIÓN FORZADA
    if (typeof syncLanguageSupport === 'function') {
        await syncLanguageSupport(); 
    }

    // 3. ACTUALIZAR UI
    document.getElementById('tts-btn').classList.add('hidden'); 
    document.getElementById('pause-btn').classList.remove('hidden'); 
    document.getElementById('stop-btn').classList.remove('hidden'); 
    if (typeof updatePauseUI === 'function') updatePauseUI(false);

    // --- MEJORA DE CAPTURA DE TEXTO TRADUCIDO ---
    const contentEl = document.getElementById('book-content');
    const rawText = chunks[currentChunkIndex] || "";
    // Solo si hay contenido en el DOM, lo usamos (para leer la traducción de Google)
    const currentText = (contentEl && contentEl.innerText.trim() !== "") ? contentEl.innerText.trim() : rawText;
    // --------------------------------------------

    const isImage = rawText.match(/!\[\[(.*?)\]\]/);
    
    if (isImage) {
        if (typeof clearImageTimer === 'function') clearImageTimer();
        if (typeof startImageTimer === 'function') startImageTimer(); 
    } else {
        // 4. INTERRUPTOR DE MODO (Modo Visual vs Modo Audio)
        if (window.hasAvailableVoice === false) {
            console.log("Nexus Vocal: Iniciando Modo Visual (Barra de progreso).");
            if (typeof showVisualTimer === 'function' && typeof calculateReadingTime === 'function') {
                const duration = calculateReadingTime(currentText);
                showVisualTimer(duration);
            }
            return; 
        }

        // 5. MODO AUDIO (Inglés, Español, etc.)
        if (typeof stopVisualTimer === 'function') stopVisualTimer();
        
        console.log("Nexus Voice: Iniciando lectura con voz.");
        
        // MANTENEMOS TU FUNCIÓN ORIGINAL
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
            console.log("Nexus Vocal: Barra visual pausada");
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
            console.log("Nexus Voice: Audio pausado");
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
    
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
        pauseBtn.classList.remove('bg-pause-active');
        pauseBtn.title = "";
    }
    updatePauseUI(false); 
    console.log("Nexus Voice: Stop total ejecutado.");
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
    
    // Es traducido si la cookie dice algo distinto a español O si el usuario eligió algo distinto a español
    const isTranslated = targetLang !== 'es' || preferredLang !== 'es';

    // 3. VALIDACIÓN POR ANCLA (Con Despertador de Emergencia Reforzado)
    if (isTranslated && preferredLang !== 'es') {
        const anchorText = anchor ? anchor.innerText.toLowerCase().trim() : "";
        // No traducido si: no hay ancla, está vacía o sigue diciendo "manzana"
        const isNotYetTranslated = !anchor || anchorText === "" || anchorText.includes("manzana");

        if (isNotYetTranslated) {
            if (window.romanceRetryCount < 8) {
                window.romanceRetryCount++;
                console.log(`Nexus Voice: Esperando señal de Google Translate (${window.romanceRetryCount}/8)...`);
                
                // --- DESPERTADOR DE EMERGENCIA (Intento 4) ---
                // Si Google se durmió, forzamos un cambio visual real
                if (window.romanceRetryCount === 4) {
                    console.log("Nexus Voice: Forzando re-escaneo activo de Google...");
                    const poke = document.createElement('span');
                    // Usamos un estilo que Google detecta como cambio de layout
                    poke.style.cssText = "position:absolute; visibility:hidden; width:1px;";
                    poke.innerHTML = " &nbsp; "; 
                    contentEl.appendChild(poke);
                    
                    // Disparamos evento de mutación para despertar el Observer de Google
                    contentEl.dispatchEvent(new Event('input', { bubbles: true }));
                    
                    setTimeout(() => poke.remove(), 50);
                }

                window.nexusSpeechTimeout = setTimeout(prepareAndStartSpeech, 350);
                return;
            } else {
                console.warn("Nexus Voice: Tiempo de espera agotado. Forzando idioma preferido: " + preferredLang);
            }
        }
    }

    // --- RESET DEL CONTADOR ---
    window.romanceRetryCount = 0; 

    // 4. PREPARACIÓN DEL TEXTO FINAL
    // Usamos innerText para obtener el texto ya traducido por Google
    let textToRead = contentEl.innerText.trim();

    // Limpiamos el ancla (Regex global para todas las variantes posibles)
    const anchorKeywords = ["manzana", "apple", "mela", "maçã", "pomme", "apfel", "りんご", "苹果"];
    anchorKeywords.forEach(word => {
        // Buscamos la palabra con límites de palabra para no romper otras (ej: "apples")
        const reg = new RegExp('\\b' + word + '\\b', 'gi');
        textToRead = textToRead.replace(reg, "");
    });

    // 5. REEMPLAZOS DE DICCIÓN
    // Mejoramos los reemplazos para que el flujo de voz sea más natural
    textToRead = textToRead.replace(/^>\s*-\s*/gm, "… ");
    textToRead = textToRead.replace(/^-\s+/gm, "… ");
    textToRead = textToRead.replace(/([a-zA-ZáéíóúÁÉÍÓÚ0-9])\s*-\s*([a-zA-ZáéíóúÁÉÍÓÚ])/g, "$1 … $2");
    textToRead = textToRead.replace(/([a-zA-ZáéíóúÁÉÍÓÚ0-9])\s*—\s*([a-zA-ZáéíóúÁÉÍÓÚ])/g, "$1,$2");
    
    // Normalización de texto
    textToRead = textToRead.toLowerCase(); 
    if (typeof filterTextForVoice === 'function') {
        textToRead = filterTextForVoice(textToRead);
    }

    // 6. ARRANQUE DEL AUDIO
    window.speechSubChunks = [];
    window.currentSubChunkIndex = 0;

    if (typeof splitTextSmartly === 'function') {
        // CAMBIO: Ahora el límite no es 140 fijo, sino dinámico según el idioma
        const dynamicLimit = getDynamicChunkLimit();
        
        console.log(`Nexus Voice: Fragmentando con límite de ${dynamicLimit} caracteres.`);
        
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
                console.log("Nexus Voice: Ejecutando salto automático...");
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
        console.log("Nexus Voice: Modo Visual activo. TTS bloqueado para evitar interferencias.");
        return; 
    }
    // ------------------------------------

    // 3. CONFIGURACIÓN DE LA LOCUCIÓN (Forzado de Voz Regional)
    const utterance = new SpeechSynthesisUtterance(speechSubChunks[currentSubChunkIndex]);
    window.currentUtterance = utterance;

    const langCode = (typeof getTTSLanguageCode === 'function') ? getTTSLanguageCode() : (localStorage.getItem('nexus_preferred_lang') || 'es-ES');
    utterance.lang = langCode;
    utterance.rate = window.readerSpeechRate || 1.0;
    utterance.volume = 1.0; 

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
        let targetVoice = voices.find(v => v.lang.toLowerCase().replace('_', '-') === langCode.toLowerCase());
        if (!targetVoice) {
            targetVoice = voices.find(v => v.lang.toLowerCase().startsWith(langCode.split('-')[0].toLowerCase()));
        }
        if (targetVoice) {
            utterance.voice = targetVoice;
            console.log("Nexus Voice: Voz asignada ->", targetVoice.name, "[" + targetVoice.lang + "]");
        }
    }

    const startTime = Date.now();

    // 4. MANEJO DE EVENTOS
    utterance.onend = () => {
        const duration = Date.now() - startTime;

        if (window.isSpeaking && !window.isPaused) {
            // Este bloque captura fallos inesperados (ej: cuando creíamos que había voz pero no)
            if (duration < 100 && !langCode.startsWith('es')) {
                console.warn("Nexus Voice: Audio demasiado corto. Activando Modo Lectura.");
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
    console.log("Nexus Voice: Solicitando reinicio de lectura...");

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