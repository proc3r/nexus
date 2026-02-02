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
		readerSpeechRate = rate;
		synopsisSpeechRate = rate;
		const label = document.getElementById('reader-speed-label');
		if (label) label.innerText = rate + 'x';
		const labelSynopsis = document.getElementById('current-speed-label');
		if (labelSynopsis) labelSynopsis.innerText = rate + 'x';
		const speedMenu = document.getElementById('reader-speed-menu');
		if (speedMenu) speedMenu.classList.add('hidden');
		
		const speedMenuSynopsis = document.getElementById('synopsis-speed-menu');
		if (speedMenuSynopsis) speedMenuSynopsis.classList.add('hidden');
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

    // DETECCIÓN DE MÓVIL
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        stopSpeech();
        return;
    }

    // LÓGICA PARA IMAGEN (Sincronización con menú emergente)
    const timerEl = document.getElementById('image-timer');
    const isImageActive = timerEl && !timerEl.classList.contains('hidden');

    if (isImageActive) {
        // Si hay una imagen y NO está pausada, activamos la pausa de la imagen
        if (!isImageTimerPaused) {
            togglePauseImageTimer();
        } else {
            // Si ya estaba pausada por imagen, reanudamos
            resumeSpeech();
            return; // Salimos para no ejecutar la lógica de texto
        }
    } else {
        // LÓGICA PARA TEXTO (Escritorio)
        if (synth.speaking && !isPaused) { 
            synth.pause(); 
            isPaused = true; 
            updatePauseUI(true); 
        } else if (isPaused) {
            resumeSpeech(); 
        }
    }

    // Timer de seguridad: 15s (según tu código actual)
    clearTimeout(window.pauseTimer);
    window.pauseTimer = setTimeout(() => {
        if (window.isPaused) {
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
    
    // Limpieza de timer de imagen (desde nexus-functions.js)
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
}
	function prepareAndStartSpeech() {
		// Seguridad: Si el modal de sinopsis está abierto, no iniciar voz del lector
		const synModal = document.getElementById('synopsis-modal');
		if (synModal && !synModal.classList.contains('hidden')) return;
		if (isPaused) synth.resume(); 
		synth.cancel();
		isPaused = false;
		updatePauseUI(false);

																			   
		let textToRead = document.getElementById('book-content').innerText;
		if(!textToRead.trim()) return;
		textToRead = textToRead.replace(/^>\s*-\s*/gm, "… ");
		textToRead = textToRead.replace(/^-\s+/gm, "… ");
		textToRead = textToRead.replace(/([a-zA-ZáéíóúÁÉÍÓÚ0-9])\s*-\s*([a-zA-ZáéíóúÁÉÍÓÚ])/g, "$1 … $2");
		textToRead = textToRead.replace(/([a-zA-ZáéíóúÁÉÍÓÚ0-9])\s*—\s*([a-zA-ZáéíóúÁÉÍÓÚ])/g, "$1,$2");
		textToRead = textToRead.toLowerCase(); 
		textToRead = filterTextForVoice(textToRead);
		speechSubChunks = splitTextSmartly(textToRead, 140);
		currentSubChunkIndex = 0;
		speakSubChunk();
	}
	
	
	function speakSubChunk() {
		if (!isSpeaking || isPaused) return;
		if (currentSubChunkIndex >= speechSubChunks.length) {
			if (!(currentChunkIndex === chunks.length - 1 && currentChapterIndex === currentBook.chapters.length - 1)) nextChunk(); else stopSpeech();
			return;
		}
		currentUtterance = new SpeechSynthesisUtterance(speechSubChunks[currentSubChunkIndex]);
		currentUtterance.lang = 'es-ES';
		currentUtterance.rate = readerSpeechRate; 
		currentUtterance.onend = () => { currentSubChunkIndex++; setTimeout(speakSubChunk, 100); };
		synth.speak(currentUtterance);
	}
