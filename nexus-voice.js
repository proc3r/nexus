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
	

// --- CONTROLADOR DE VOZ DEL LECTOR ---

	function setReaderSpeed(rate) {
    window.readerSpeechRate = rate;
    const label = document.getElementById('reader-speed-label');
    if (label) label.innerText = rate + 'x';

    const speedMenu = document.getElementById('reader-speed-menu');
    if (speedMenu) speedMenu.classList.add('hidden');
    
    // Se eliminan referencias a Synopsis para evitar errores de referencia nula
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
	
	
function startSpeech() {
    if (typeof launchFullScreen === 'function') {
        launchFullScreen(document.documentElement);
    }
    
    // Limpieza preventiva
    window.synth.cancel();
    window.isImageTimerPaused = false; 
    
    window.isSpeaking = true; 
    window.isPaused = false;
    
    document.getElementById('tts-btn').classList.add('hidden'); 
    document.getElementById('pause-btn').classList.remove('hidden'); 
    document.getElementById('stop-btn').classList.remove('hidden'); 
    updatePauseUI(false);

    const currentText = chunks[currentChunkIndex] || "";
    const isImage = currentText.match(/!\[\[(.*?)\]\]/);
    
    if (isImage) {
        if (typeof clearImageTimer === 'function') clearImageTimer();
        startImageTimer(); 
    } else {
        prepareAndStartSpeech();
    }
}

function pauseSpeech() { 
    if (!isSpeaking) return;

    // 1. DETECCIÓN DE MÓVIL
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        stopSpeech();
        return;
    }

    // 2. LÓGICA PARA IMAGEN
    const timerEl = document.getElementById('image-timer');
    const isImageActive = timerEl && !timerEl.classList.contains('hidden');

    if (isImageActive) {
        if (typeof togglePauseImageTimer === 'function') {
            togglePauseImageTimer();
        } else {
            // Fallback por si la función no existe
            window.isImageTimerPaused = !window.isImageTimerPaused;
            updatePauseUI(window.isImageTimerPaused);
        }
    } else {
        // 3. LÓGICA PARA TEXTO
        if (!isPaused) { 
            synth.pause(); 
            isPaused = true; 
            updatePauseUI(true); 
            console.log("Nexus Voice: Pausado");
        } else {
            resumeSpeech(); 
        }
    }

    // 4. Timer de seguridad: 15s (Ahora detecta también pausa de imagen)
    clearTimeout(window.pauseTimer);
    window.pauseTimer = setTimeout(() => {
        // Verificamos si cualquiera de los dos sistemas sigue pausado
        const imageIsPaused = (typeof NexusImage !== 'undefined' && NexusImage.isPaused);
        if (window.isPaused || imageIsPaused) {
            console.log("Nexus Voice: Tiempo de pausa excedido (15s), ejecutando Stop.");
            stopSpeech(); 
        }
    }, 15000); 
}

function resumeSpeech() { 
    clearTimeout(window.pauseTimer);
    
    // VERIFICACIÓN DE IMAGEN
    const timerEl = document.getElementById('image-timer');
    const isImageActive = timerEl && !timerEl.classList.contains('hidden');

    if (isImageActive) {
        // Si el conteo de la imagen está pausado, lo despertamos
        if (isImageTimerPaused) {
            togglePauseImageTimer();
        }
    } else {
        // LÓGICA NORMAL DE TEXTO
        synth.resume(); 
        isPaused = false; 
        updatePauseUI(false); 
    }
    
    // Limpieza de UI
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) pauseBtn.title = "";

    // Aseguramos que el timer visual siga si es una imagen
    if ((chunks[currentChunkIndex] || "").match(/!\[\[(.*?)\]\]/)) { 
        if (!imageTimer && !isImageTimerPaused) startImageTimer(); 
    } 
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
    if (window.nexusSpeechTimeout) clearTimeout(window.nexusSpeechTimeout);
    
    window.synth.cancel(); 
    window.isSpeaking = false; 
    window.isPaused = false; 
    
    // RESET CRUCIAL PARA IMÁGENES (Sincronización con nexus-functions.js)
    window.isImageTimerPaused = false; 
    if (typeof NexusImage !== 'undefined') {
        NexusImage.isPaused = false;
        NexusImage.secondsLeft = 5; // Resetear también el tiempo por seguridad
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
    console.log("Nexus Voice: Stop total. Estados de voz e imagen reseteados.");
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
        // Dividimos en partes pequeñas para mayor estabilidad (max 140 car)
        window.speechSubChunks = splitTextSmartly(textToRead, 140);
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
            // Detenemos audio actual
            window.synth.cancel(); 
            
            // --- CLAVE: MATAR CUALQUIER REINTENTO DE VALIDACIÓN PENDIENTE ---
            if (window.nexusSpeechTimeout) {
                clearTimeout(window.nexusSpeechTimeout);
                window.nexusSpeechTimeout = null;
            }

            setTimeout(async () => { 
                console.log("Nexus Voice: Ejecutando salto automático...");
                
                // Aseguramos estado limpio para el nuevo párrafo
                window.navDirection = 'next'; 
                window.romanceRetryCount = 0; 

                // El await asegura que el contenido se renderice antes de disparar la nueva validación
                await nextChunk(); 
            }, 600); // Reducido a 600ms para mejorar la fluidez tras unificar procesos
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

    // 3. CONFIGURACIÓN DE LA LOCUCIÓN
    const utterance = new SpeechSynthesisUtterance(speechSubChunks[currentSubChunkIndex]);
    window.currentUtterance = utterance;

    utterance.lang = (typeof getTTSLanguageCode === 'function') ? getTTSLanguageCode() : 'es-ES';
    utterance.rate = window.readerSpeechRate || 1.0;

    // 4. MANEJO DE EVENTOS
    utterance.onend = () => {
        if (window.isSpeaking && !window.isPaused) {
            currentSubChunkIndex++;
            const targetLang = getCurrentGoogleLang();
            const isTranslated = targetLang !== 'es';
            
            // Delay entre frases
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

    // 5. EJECUCIÓN DEL AUDIO (Unificada)
    // Cancelamos cualquier audio residual y damos un micro-delay de 50ms 
    // para que el motor de síntesis del navegador no se colapse.
    window.synth.cancel();
    setTimeout(() => { 
        if (window.isSpeaking && !window.isPaused) {
            window.synth.speak(utterance);
        }
    }, 50);
}