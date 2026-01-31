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
		document.getElementById('tts-btn').classList.add('hidden'); // Oculta Persona hablando (Rojo)
		document.getElementById('pause-btn').classList.remove('hidden'); // Muestra Pausa (Amarillo)
		document.getElementById('stop-btn').classList.remove('hidden'); // Muestra Stop pequeño
		updatePauseUI(false);
		const isImage = (chunks[currentChunkIndex] || "").match(/!\[\[(.*?)\]\]/);
		if (isImage) startImageTimer(); else prepareAndStartSpeech();
	}

			function pauseSpeech() { 
				if (!isSpeaking) return;

				// DETECCIÓN DE MÓVIL
				const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
				
				if (isMobile) {
					// En móvil, la pausa ejecuta un STOP directo y restablece botones
					stopSpeech();
					return;
				}

				// LÓGICA PARA ESCRITORIO
				if (synth.speaking && !isPaused) { 
					synth.pause(); 
					isPaused = true; 
					updatePauseUI(true); // Cambia a Play Verde

					// Iniciar temporizador: si pasan 10s en pausa, ejecuta STOP automático
					clearTimeout(window.pauseTimer);
					window.pauseTimer = setTimeout(() => {
						if (window.isPaused) {
							stopSpeech(); // Restablece botones físicamente a estado inicial
						}
					}, 15000); 
				} else if (isPaused) {
					resumeSpeech(); 
				}
				if (imageTimer) isImageTimerPaused = true; 
			}

				function resumeSpeech() { 
				clearTimeout(window.pauseTimer);
				synth.resume(); 
				isPaused = false; 
				updatePauseUI(false); 
				
				// Quitamos el mensaje de ayuda al reanudar
				const pauseBtn = document.getElementById('pause-btn');
				if (pauseBtn) pauseBtn.title = "";

				if ((chunks[currentChunkIndex] || "").match(/!\[\[(.*?)\]\]/)) { 
					isImageTimerPaused = false; 
					if (!imageTimer) startImageTimer(); 
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
						// Agregamos la sugerencia solo al pasar el ratón (tooltip nativo)
						pauseBtn.title = "Si no reanuda, presione STOP y luego PLAY";
					} else {
						pauseBtn.classList.remove('bg-pause-active');
						pauseBtn.title = "";
					}
				}
			}

			function stopSpeech() { 
				clearTimeout(window.pauseTimer); // Cancelar cualquier cierre pendiente
				synth.cancel(); 
				isSpeaking = false; 
				isPaused = false; 
				clearImageTimer(); 
				
				// Físicamente volvemos al estado inicial:
				document.getElementById('tts-btn').classList.remove('hidden'); // Botón Play principal
				document.getElementById('pause-btn').classList.add('hidden'); // Ocultar pausa
				document.getElementById('stop-btn').classList.add('hidden');  // Ocultar stop
				
				const pauseBtn = document.getElementById('pause-btn');
				if (pauseBtn) {
					pauseBtn.classList.remove('bg-pause-active');
					pauseBtn.title = "";
				}
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
