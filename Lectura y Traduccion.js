function startSpeech() {
	
	if (typeof launchFullScreen === 'function') {
        launchFullScreen(document.documentElement);
    }
    isSpeaking = true; 
    isPaused = false;
    document.getElementById('tts-btn').classList.add('hidden'); 
    document.getElementById('pause-btn').classList.remove('hidden'); 
    document.getElementById('stop-btn').classList.remove('hidden'); 
    updatePauseUI(false);
    const isImage = (chunks[currentChunkIndex] || "").match(/!\[\[(.*?)\]\]/);
    if (isImage) startImageTimer(); else prepareAndStartSpeech();
}

function pauseSpeech() { 
    if (!isSpeaking) return;

    // 1. DETECCIÓN DE MÓVIL (Mantenida idéntica)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        stopSpeech();
        return;
    }

    // 2. LÓGICA PARA IMAGEN (Sincronización con menú emergente - Mantenida)
    const timerEl = document.getElementById('image-timer');
    const isImageActive = timerEl && !timerEl.classList.contains('hidden');

    if (isImageActive) {
        if (!isImageTimerPaused) {
            togglePauseImageTimer();
        } else {
            resumeSpeech();
            return; 
        }
    } else {
        // 3. LÓGICA PARA TEXTO (Escritorio - Reforzada)
        // Usamos synth.speaking pero también nuestra variable isPaused
        if (!isPaused) { 
            synth.pause(); 
            isPaused = true; 
            updatePauseUI(true); 
            console.log("Nexus Voice: Pausado");
        } else {
            // Si ya estaba pausado, llamamos a resumeSpeech
            resumeSpeech(); 
        }
    }

    // 4. Timer de seguridad: 15s (Mantenido idéntico)
    clearTimeout(window.pauseTimer);
    window.pauseTimer = setTimeout(() => {
        if (window.isPaused) {
            console.log("Nexus Voice: Tiempo de pausa excedido, deteniendo.");
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
    synth.cancel(); 
    isSpeaking = false; 
    isPaused = false; 
    
    // --- LIMPIEZA PROFUNDA DE FRAGMENTOS (Tu lógica original) ---
    window.speechSubChunks = [];
    window.currentSubChunkIndex = 0;
    
    // Limpieza de timer de imagen
    if (typeof clearImageTimer === 'function') clearImageTimer(); 
    
    // Reset de la Interfaz - Mantenido íntegro
    document.getElementById('tts-btn').classList.remove('hidden'); 
    document.getElementById('pause-btn').classList.add('hidden'); 
    document.getElementById('stop-btn').classList.add('hidden'); 
    
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
        pauseBtn.classList.remove('bg-pause-active');
        pauseBtn.title = "";
    }
    updatePauseUI(false); 
    console.log("Nexus Voice: Parada total y limpieza de memoria completada.");
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
    
    const targetLang = getCurrentGoogleLang(); 
    const isTranslated = targetLang !== 'es';

    // 3. VALIDACIÓN POR ANCLA (Sustituye a los filtros de Spanglish)
    if (isTranslated) {
        // Si el ancla no existe aún o Google no la ha traducido (sigue diciendo manzana)
        const anchorText = anchor ? anchor.innerText.toLowerCase().trim() : "";
        const isNotYetTranslated = !anchor || anchorText === "manzana";

        if (isNotYetTranslated && window.romanceRetryCount < 8) { // Damos hasta 8 intentos de 300ms
            window.romanceRetryCount++;
            console.log(`Nexus Voice: Esperando señal de Google Translate (${window.romanceRetryCount}/8)...`);
            window.nexusSpeechTimeout = setTimeout(prepareAndStartSpeech, 300);
            return;
        }
    }

    // 4. PREPARACIÓN DEL TEXTO FINAL
    window.romanceRetryCount = 0; 
    let textToRead = contentEl.innerText.trim();

    // Limpiamos el texto del ancla para que la voz no lo lea
    // Buscamos "manzana" y sus traducciones comunes para estar seguros
    const anchorKeywords = ["manzana", "apple", "mela", "maçã", "pomme", "apfel"];
    anchorKeywords.forEach(word => {
        const reg = new RegExp('\\b' + word + '\\b', 'gi');
        textToRead = textToRead.replace(reg, "");
    });

    // 5. REEMPLAZOS DE DICCIÓN Y PUNTUACIÓN
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
        window.speechSubChunks = splitTextSmartly(textToRead, 140);
        if (typeof speakSubChunk === 'function') {
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



async function renderChunk() {
    clearImageTimer();
    const container = document.getElementById('reading-container-fixed');
    let content = document.getElementById('book-content');
    if (!content) return;

    // 1. DETECCIÓN DE TRADUCCIÓN
    const isTranslated = document.cookie.includes('googtrans') && !document.cookie.includes('/es/es');

    // --- MEJORA: LIMPIEZA INMEDIATA ---
    if (window.isSpeaking) window.synth.cancel();

    // 2. LIMPIEZA PROFUNDA (Atomic Reset)
    if (isTranslated) {
        const newContent = document.createElement('div');
        newContent.id = 'book-content';
        newContent.className = 'reader-content-area custom-scrollbar';
        
        newContent.style.opacity = "0"; 
        newContent.style.visibility = "hidden";
        newContent.style.transition = "none"; 
        
        content.parentNode.replaceChild(newContent, content);
        content = newContent; 
    } else {
        content.classList.remove('slide-in-right', 'slide-in-left', 'desktop-fade');
        content.style.transition = ""; 
        content.style.visibility = "visible";
        content.style.opacity = "1";
        content.innerHTML = ""; 
    }

    let rawText = chunks[currentChunkIndex] || "";
    
    if (rawText.trim() === ">") { 
        if (window.navDirection === 'prev') return prevChunk(); 
        else return nextChunk(); 
    }

    // 3. PROCESAMIENTO DE CONTENIDO
    let finalHtml = "";
    let isImage = false;
    const embedMatch = rawText.match(/!\[\[(.*?)\]\]/);

    if (embedMatch) {
        const fileName = embedMatch[1].split('|')[0].trim().toLowerCase();
        const isAudio = fileName.endsWith('.m4a') || fileName.endsWith('.mp3') || fileName.endsWith('.wav') || fileName.endsWith('.ogg');
        const isVideo = fileName.endsWith('.mp4') || fileName.endsWith('.mov') || fileName.endsWith('.webm') || fileName.endsWith('.mkv');
        if (isAudio || isVideo) { 
            if (window.navDirection === 'prev') return prevChunk(); 
            else return nextChunk(); 
        }
        
        isImage = true;
        const rawImageUrl = currentBook.rawBase + encodeURIComponent(embedMatch[1].split('|')[0].trim());
        const optimizedUrl = getOptimizedImageUrl(rawImageUrl, 700); 
        finalHtml = `<div class="reader-image-container"><img src="${optimizedUrl}" class="reader-image cursor-zoom-in" alt="${fileName}" onclick="openImageModal('${rawImageUrl}', '${fileName}')"><p class="reader-text">Click para ampliar</p></div>`;
    } else if (rawText.trim().startsWith('#')) {
        finalHtml = `<div class="reader-section-title">${cleanMarkdown(rawText.replace(/^#+\s+/, '').trim())}</div>`;
    } else if (rawText.trim().startsWith('>')) {
        let lines = rawText.split('\n');
        let processedLines = lines.map(l => cleanMarkdown(l.trim().replace(/^>\s?/, ''))).join('<span style="display: block;opacity: 70%;border-bottom: 2px dotted; margin-bottom: 10px;"></span>');
        finalHtml = `<div class="custom-blockquote">${processFormatting(processedLines)}</div>`;
    } else {
        finalHtml = processFormatting(cleanMarkdown(rawText));
    }

    // 4. INSERCIÓN DE CONTENIDO
    content.innerHTML = finalHtml;

    // --- CLAVE: INSERCIÓN DEL ANCLA DE VALIDACIÓN ---
    if (isTranslated) {
        const validator = document.createElement('div');
        validator.id = 'nexus-validation-anchor';
        // Lo mantenemos invisible pero presente para Google Translate
        validator.style.height = "0px";
        validator.style.overflow = "hidden";
        validator.style.opacity = "0";
        // La etiqueta <font> fuerza a Google a considerar este nodo para traducción
        validator.innerHTML = '<font>manzana</font>'; 
        content.appendChild(validator);
    }

    // 5. ANIMACIÓN Y VISIBILIDAD
    void content.offsetWidth; 

    if (isTranslated) {
        content.style.transition = "opacity 0.3s ease";
        content.style.visibility = "visible";
        content.style.opacity = "1";
    }

    const isMobile = window.innerWidth <= 768;
    const loader = document.getElementById('auto-loader');
    if (loader) {
        loader.style.opacity = "0";
        setTimeout(() => { loader.style.display = "none"; }, 800);
    }
    
    if (isMobile) {
        if (window.navDirection === 'next') content.classList.add('slide-in-right');
        else if (window.navDirection === 'prev') content.classList.add('slide-in-left');
    } else {
        content.classList.add('desktop-fade');
    }

    // 6. ACTUALIZACIÓN DE INTERFAZ Y PROGRESO
    container.scrollTop = 0;
    updateProgress();
    saveProgress();

    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
        const isLast = (currentChunkIndex === chunks.length - 1 && currentChapterIndex === currentBook.chapters.length - 1);
        nextBtn.innerHTML = isLast ? "FIN" : "NEXT ▶";
    }

    // 7. SINCRONIZACIÓN DE VOZ (Nexus Voice)
    if (window.isSpeaking) { 
        if (isImage) {
            startImageTimer();
        } else {
            // Bajamos el delay inicial a 150ms ya que prepareAndStartSpeech 
            // ahora tiene su propia lógica de espera basada en el ancla.
            setTimeout(() => {
                prepareAndStartSpeech();
            }, 150);
        } 
    }
    
    return Promise.resolve();
}


	
async function nextChunk() { 
    window.navDirection = 'next'; 
    clearImageTimer(); 
    
    // Si el usuario está en modo lectura, limpiamos el audio actual
    // pero NO tocamos isSpeaking, para que el sistema sepa que debe seguir en el siguiente
    if (window.isSpeaking) {
        window.synth.cancel();
        window.isPaused = false; // Si estaba pausado y da "Siguiente", reseteamos la pausa
    }

    if (currentChunkIndex < chunks.length - 1) { 
        currentChunkIndex++; 
        // El await es vital para que renderChunk espere a Google Translate
        await renderChunk(); 
        
        // IMPORTANTE: No añadimos prepareAndStartSpeech() aquí.
        // renderChunk() ya lo dispara al final si isSpeaking es true.
    }
    else if (currentChapterIndex < currentBook.chapters.length - 1) { 
        // Si saltamos de capítulo, loadChapter se encarga
        loadChapter(currentChapterIndex + 1); 
    } 
}


async function prevChunk() { 
    window.navDirection = 'prev'; // Seteamos dirección atrás
    
    // --- NUEVA LÓGICA DE RETORNO AL INICIO (MANTENIDA ÍNTEGRA) ---
    if (currentChunkIndex === 0 && currentChapterIndex === 0) {
        console.log("Inicio alcanzado: Retornando a la biblioteca.");
        
        // Detenemos cualquier audio antes de salir
        if (typeof stopSpeech === 'function') {
            stopSpeech(); 
        } else {
            window.speechSynthesis.cancel();
        }

        // Cerramos el lector
        if (typeof closeReader === 'function') {
            closeReader();
        } else {
            // Fallback en caso de que la función tenga otro nombre
            document.getElementById('reader-container').classList.add('hidden');
            document.body.style.overflow = ''; 
        }
        return; // Salimos de la función para no ejecutar el resto
    }
    // ------------------------------------------

    if (typeof clearImageTimer === 'function') clearImageTimer(); 
    
    // Capturamos el estado de voz
    const wasSpeaking = window.isSpeaking;

    if (isSpeaking && isPaused) { 
        synth.resume(); 
        isPaused = false; 
        updatePauseUI(false); 
    }
    if (isSpeaking) synth.cancel(); 

    if (currentChunkIndex > 0) { 
        currentChunkIndex--; 
        await renderChunk(); 
        if (wasSpeaking) prepareAndStartSpeech();
    } else if (currentChapterIndex > 0) { 
        // Retrocedemos el índice del capítulo
        currentChapterIndex--; 
        
        // Cargamos los datos del nuevo capítulo
        const chapter = currentBook.chapters[currentChapterIndex];
        chunks = chapter.content; 
        currentChunkIndex = chunks.length - 1; // Vamos al final del capítulo anterior
        
        // Actualizamos la interfaz (Lógica original de TOC mantenida)
        const indicator = document.getElementById('chapter-indicator');
        if (indicator) indicator.innerText = stripHtml(chapter.title);
        
        document.querySelectorAll('.toc-item').forEach(el => el.classList.remove('active'));
        const activeItem = document.getElementById(`toc-item-${currentChapterIndex}`);
        if (activeItem) activeItem.classList.add('active');

        // Renderizamos (usará la dirección 'prev')
        await renderChunk(); 
        if (wasSpeaking) prepareAndStartSpeech();
    } 
}






async function renderChunkWithTranslation() {
    // 1. Renderizamos el texto (ya es async)
    await renderChunk();

    // 2. ¿Hay traducción activa real?
    // Si la cookie no existe, o es /es/es, NO es una traducción
    const isTranslated = document.cookie.includes('googtrans') && 
                        !document.cookie.includes('/es/es') && 
                        !document.cookie.includes('/es/auto');

    if (isTranslated) {
        return new Promise((resolve) => {
            console.log("Nexus: Esperando traducción de Google...");
            setTimeout(() => {
                resolve();
            }, 600); // Tiempo para que el DOM cambie
        });
    }
    
    // Si es español, resolvemos de inmediato para que la voz no se detenga
    return Promise.resolve();
}

/**
 * Mapea el código de Google al formato de idioma de las voces TTS
 */
function getTTSLanguageCode() {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; googtrans=`);
    let lang = 'es';
    
    if (parts.length === 2) {
        // Obtenemos el código final (ej: "en" de "/es/en")
        lang = parts.pop().split(';').shift().split('/').pop();
    }

    // Normalizamos: si viene algo como 'es-ES', lo dejamos en 'es' para el mapeo
    const baseLang = lang.split('-')[0];

    const map = {
        'es': 'es-ES',
        'en': 'en-GB',
        'de': 'de-DE',
        'fr': 'fr-FR',
        'it': 'it-IT',
        'pt': 'pt-BR',
        'ja': 'ja-JP',
        'zh': 'zh-CN', // Simplificado para captar zh-CN o zh-TW
        'ru': 'ru-RU',
        'hi': 'hi-IN',
        'ar': 'ar-SA',
        'ko': 'ko-KR',
        'id': 'id-ID',
        'bn': 'bn-BD',
        'vi': 'vi-VN',
        'tr': 'tr-TR',
        'ur': 'ur-PK',
        'sw': 'sw-KE'
    };
    
    return map[baseLang] || map[lang] || 'es-ES';
}


async function cambiarIdioma(langCode) {
    console.log("Nexus: Sincronizando audio para: " + langCode);

    if (window.isSpeaking) {
        // CANCELAMOS el audio, pero NO llamamos a stopSpeech()
        // para no resetear los botones ni poner isSpeaking en false
        window.synth.cancel();
        window.shouldResumeAfterTranslation = true;
    }

    const delay = (langCode === 'es' || langCode === 'es-ES') ? 200 : 1200;

    if (window.shouldResumeAfterTranslation) {
        setTimeout(() => {
            window.shouldResumeAfterTranslation = false;
            // Solo reanudamos si el sistema aún considera que estamos en modo lectura
            if (window.isSpeaking) {
                prepareAndStartSpeech();
            }
        }, delay); 
    }
}
