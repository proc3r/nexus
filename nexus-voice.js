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
		document.getElementById('tts-btn').classList.add('hidden'); // Oculta Persona hablando (Rojo)
		document.getElementById('pause-btn').classList.remove('hidden'); // Muestra Pausa (Amarillo)
		document.getElementById('stop-btn').classList.remove('hidden'); // Muestra Stop pequeño
		updatePauseUI(false);
		const isImage = (chunks[currentChunkIndex] || "").match(/!\[\[(.*?)\]\]/);
		if (isImage) startImageTimer(); else prepareAndStartSpeech();
	}

	function pauseSpeech() { 
		if (synth.speaking && !isPaused) { 
			synth.pause(); 
			isPaused = true; 
			updatePauseUI(true); // Cambia a icono Play y color Verde
		} else if (isPaused) {
			resumeSpeech(); 
		}
		if (imageTimer) isImageTimerPaused = true; 
}

	function resumeSpeech() { 
		synth.resume(); 
		isPaused = false; 
		updatePauseUI(false); // Vuelve a icono Pausa y color Amarillo
		if ((chunks[currentChunkIndex] || "").match(/!\[\[(.*?)\]\]/)) { 
			isImageTimerPaused = false; 
			if (!imageTimer) startImageTimer(); 
		} 
	}

	function updatePauseUI(paused) { 
		const icon = document.getElementById('pause-icon'); 
		const pauseBtn = document.getElementById('pause-btn');
		if (icon) {
			// Si está pausado, ponemos el icono de Play (&#xe037;), si no, el de Pausa (&#xe1a2;)
			icon.innerHTML = paused ? '&#xe037;' : '&#xe1a2;'; 
		}
		if (pauseBtn) {
			if (paused) {
				// APLICAR COLOR VERDE
				pauseBtn.classList.add('bg-pause-active');
			} else {
				// VOLVER A COLOR AMARILLO
				pauseBtn.classList.remove('bg-pause-active');
			}
		}
	}

	function stopSpeech() { 
		synth.cancel(); 
		isSpeaking = false; 
		isPaused = false; 
		clearImageTimer(); 
		document.getElementById('tts-btn').classList.remove('hidden'); 
		document.getElementById('pause-btn').classList.add('hidden'); 
		document.getElementById('stop-btn').classList.add('hidden'); 
		const pauseBtn = document.getElementById('pause-btn');
		if (pauseBtn) pauseBtn.classList.remove('bg-pause-active');
		updatePauseUI(false); 
	}					  

	function prepareAndStartSpeech() {
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
