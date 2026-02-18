/**
 * NEXUS SYNOPSIS MODULE
 * Maneja la visualización de la biblioteca, modales de sinopsis y timers de imagen.
 */

// Variables de estado movidas del core para la sinopsis
let synopsisSpeechRate = 1.1;
let imageTimer = null;
let imageSecondsLeft = 5;
let isImageTimerPaused = false;
let synopsisSubChunks = [];
let currentSynopsisIdx = 0;

// --- RENDERIZADO DE BIBLIOTECA (INDEX) ---


function renderLibrary() {
    const grid = document.getElementById('library-grid');
    grid.innerHTML = library.length ? '' : '<div class="col-span-full py-32 text-center opacity-20 italic text-white">No hay libros disponibles.</div>';
    
    library.forEach(book => {
        let chapterCount = 0;
        book.chapters.forEach(ch => {
            if (ch.content) {
                const hasH1 = ch.content.some(text => (text || "").trim().startsWith('# '));
                if (hasH1) chapterCount++;
            }
        });
        const displayChapters = chapterCount > 0 ? chapterCount : book.chapters.length;
        const hasSynopsis = book.chapters.some(ch => 
            ch.content && ch.content.some(text => (text || "").trim().startsWith('# Sinopsis'))
        );
        let totalWords = 0;
        book.chapters.forEach(ch => ch.content.forEach(text => { 
            totalWords += (text || "").split(/\s+/).filter(w => w.length > 0).length; 
        }));
        const totalMins = Math.ceil(totalWords / 185);
        const timeStr = totalMins >= 60 ? `${Math.floor(totalMins/60)}h ${totalMins%60}m` : `${totalMins} min`;
        
        const card = document.createElement('div');
        card.className = 'book-card group relative bg-white/5 border border-white/10 rounded-[0.5rem] hover:border-[#ffcc00] cursor-pointer text-center overflow-hidden';
        card.onclick = (e) => {
            // Evitamos que se abra el lector si se hace clic en Sinopsis o Podcast
            if (!e.target.closest('.btn-synopsis') && !e.target.closest('.podcast-badge-btn')) {
                openReader(book.id);
            }
        };

        card.innerHTML = `
            <div class="book-card-cover relative w-full aspect-[2/3]">
                <img src="${book.cover}" alt="Cover" loading="lazy" class="w-full h-full object-cover">
                
                ${book.podcastUrl ? `
                    <div id="pod-btn-${book.id}" class="podcast-badge-btn" onclick="event.stopPropagation(); initPodcast('${book.id}')">
                        <span class="pod-label">PODCAST</span>
                        <div class="pod-icon-circle notranslate">
                            <span class="material-icons">headset</span>
                        </div>
                    </div>
                ` : ''}

                <div class="book-card-overlay absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black/95 via-black/20 to-transparent">
                    <h3 class="book-card-title-internal text-left text-white font-bold leading-[1em] uppercase condensed text-[1.3rem] mb-[0.2em]">
                        ${book.title}
                    </h3>
                    <div class="flex items-center justify-between h-[25%] w-full pt-2 border-t border-white/10">
                        <p class="text-[15px] text-white/70 font-[500] uppercase tracking-[0.01em] condensed">
                            ${displayChapters} SECCIONES
                        </p>
                        <div id="synopsis-slot-${book.id}" class="flex-1 flex justify-center">
                            ${hasSynopsis ? `<button class="btn-synopsis" onclick="event.stopPropagation(); showSynopsis('${book.id}')">SINOPSIS</button>` : ''}
                        </div>
                        <p class="text-[18px] text-[#ffcc00] font-bold uppercase condensed italic">
                            <span class="mi-round text-[18px] align-middle mr-1 notranslate">schedule</span>${timeStr}
                        </p>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
    renderShelf();
}


// --- GESTIÓN DE MODAL DE SINOPSIS ---

function showSynopsis(bookId) {
    if (typeof launchFullScreen === 'function') {
        setTimeout(() => {
            launchFullScreen(document.documentElement);
        }, 0);
    }
    
    const book = library.find(b => b.id === bookId);
    if (!book) return;
    const startIndex = book.chapters.findIndex(ch => 
        ch.content && ch.content.some(t => (t || "").trim().startsWith('# Sinopsis'))
    );

    if (startIndex !== -1) {
        const modal = document.getElementById('synopsis-modal');
        const body = document.getElementById('synopsis-body');
        const btnPlay = document.getElementById('btn-synopsis-tts');

        // --- DETECCIÓN DE IDIOMA ---
        const isTranslated = document.documentElement.lang !== 'es';

        if (isTranslated) {
            // Solo creamos y mostramos el loader si la página NO está en español
            let loader = document.getElementById('synopsis-loader');
            if (!loader) {
                loader = document.createElement('div');
                loader.id = 'synopsis-loader';
                loader.innerHTML = `
                    <div class="synopsis-spinner"></div>
                    <div class="synopsis-loader-text">SINCRONIZANDO...</div>
                `;
                const modalContent = modal.querySelector('.relative.bg-white\\/5') || modal.children[0];
                modalContent.appendChild(loader);
            }
            loader.style.opacity = '1';
            loader.classList.remove('hidden');
            if (btnPlay) btnPlay.disabled = true;
        }

        // Bloqueo de selección (siempre activo por seguridad visual)
        if (body) {
            body.style.userSelect = 'none';
            body.style.webkitUserSelect = 'none';
        }

        // (Tu lógica de formateo rawText y lines se mantiene igual...)
        let rawText = book.chapters.slice(startIndex).map(ch => ch.content.join('\n')).join('\n\n');
        const lines = rawText.split('\n');
        let formattedHtml = "";
        lines.forEach(line => {
            let cleanLine = line.trim();
            if (!cleanLine || cleanLine.toLowerCase().startsWith('# sinopsis')) return;
            const processMD = (str) => {
                return str
                    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/_(.*?)_/g, '<em>$1</em>');
            };
            if (cleanLine.startsWith('##')) {
                formattedHtml += `<h2 class="synopsis-h2">${cleanLine.replace(/^#+\s*/, '')}</h2>`;
            } else if (cleanLine.startsWith('>')) {
                let quoteText = processMD(cleanLine.replace(/^>\s*/, ''));
                formattedHtml += `<blockquote class="synopsis-quote">${quoteText}</blockquote>`;
            } else {
                let text = processMD(cleanLine);
                formattedHtml += `<p class="synopsis-p">${text}</p>`;
            }
        });

        body.innerHTML = formattedHtml;
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        // --- BARRIDO CONDICIONAL ---
        if (isTranslated) {
            setTimeout(() => {
                const totalHeight = body.scrollHeight;
                body.scrollTo({ top: totalHeight, behavior: 'smooth' });
                
                setTimeout(() => {
                    body.scrollTo({ top: 0, behavior: 'instant' });
                    const loader = document.getElementById('synopsis-loader');
                    if (loader) {
                        loader.style.opacity = '0';
                        setTimeout(() => loader.classList.add('hidden'), 400);
                    }
                    if (btnPlay) btnPlay.disabled = false;
                }, 900);
            }, 200);
        } else {
            // Si está en español, aseguramos que el botón esté habilitado y no haya scroll
            if (btnPlay) btnPlay.disabled = false;
            body.scrollTop = 0;
        }
        
        // (Eventos readBtn y modal.onclick se mantienen igual...)
        const readBtn = document.getElementById('btn-synopsis-read');
        readBtn.onclick = (e) => {
            e.preventDefault();
            closeSynopsis();
            openReader(bookId);
        };
								
        modal.onclick = (e) => {
            if (e.target.id === 'synopsis-modal') closeSynopsis();
        };
    }
}
	
	function toggleSynopsisSpeedMenu(event) {
		if (event) event.stopPropagation(); // ¡Importante! Evita el cierre inmediato
		const menu = document.getElementById('synopsis-speed-menu');
		if (menu) {
			menu.classList.toggle('hidden');
		}
	}

	function setSynopsisSpeed(rate) {
		synopsisSpeechRate = rate;
		document.getElementById('current-speed-label').innerText = rate + 'x';
		document.getElementById('synopsis-speed-menu').classList.add('hidden');
		// El cambio se aplicará automáticamente en el siguiente chunk
	}
	

function closeSynopsis() {
		window.speechSynthesis.cancel();
		synopsisSubChunks = [];
		isSynopsisReading = false;
		
		
		
		const modal = document.getElementById('synopsis-modal');
		const body = document.getElementById('synopsis-body');
		const btnStop = document.getElementById('btn-synopsis-stop');
		const btnPlay = document.getElementById('btn-synopsis-tts');
		if (modal) modal.classList.add('hidden');
		document.body.style.overflow = '';
		if (body) body.scrollTop = 0;
		if (btnStop) btnStop.classList.add('hidden');
		if (btnPlay) btnPlay.classList.remove('hidden');
	}
	
		stopSynopsisTTS(); 
	
		document.addEventListener('click', function(event) {
				const speedMenuReader = document.getElementById('reader-speed-menu');
				const speedBtnReader = document.querySelector('.speed-btn-center');
				const speedMenuSynopsis = document.getElementById('synopsis-speed-menu');
				const speedBtnSynopsis = document.getElementById('btn-synopsis-speed');
				if (speedMenuReader && !speedMenuReader.classList.contains('hidden')) {
					const isClickInsideMenu = speedMenuReader.contains(event.target);
					const isClickOnButton = event.target.closest('.speed-btn-center');

					if (!isClickInsideMenu && !isClickOnButton) {
						speedMenuReader.classList.add('hidden');
					}
				}

				if (speedMenuSynopsis && !speedMenuSynopsis.classList.contains('hidden')) {
					const isClickInsideMenu = speedMenuSynopsis.contains(event.target);
					const isClickOnButton = event.target.closest('#btn-synopsis-speed');
					if (!isClickInsideMenu && !isClickOnButton) {
						speedMenuSynopsis.classList.add('hidden');
					}
				}
			});

// --- LÓGICA DE VOZ PARA SINOPSIS ---

function startSynopsisTTS() {
    // 1. GESTIÓN DE AUDIO PREVIO (Podcast)
    // Guardamos el estado para reanudarlo al terminar la lectura
    if (typeof podAudioInstance !== 'undefined' && podAudioInstance && !podAudioInstance.paused) {
        window.wasPodcastPlayingBeforeTTS = true;
        if (typeof togglePodcastPlay === 'function') togglePodcastPlay(false);
    } else {
        window.wasPodcastPlayingBeforeTTS = false;
    }

    const body = document.getElementById('synopsis-body');
    if (!body) return;
    
    // 2. LIMPIEZA DE SÍNTESIS PREVIA
    window.speechSynthesis.cancel();
    if (window.synth) window.synth.cancel();
    synopsisSubChunks = [];
    currentSynopsisIdx = 0;

    // 3. PREPARACIÓN DEL TEXTO 
    // Captura el texto del DOM (si hubo barrido de traducción, ya vendrá traducido)
    let textToRead = body.innerText; 

    // Limpieza de formato Markdown y caracteres especiales
    textToRead = textToRead.replace(/^>\s*-\s*/gm, "… ");
    textToRead = textToRead.replace(/^-\s+/gm, "… ");
    textToRead = textToRead.replace(/([a-zA-ZáéíóúÁÉÍÓÚ])\s*-\s*([a-zA-ZáéíóúÁÉÍÓÚ])/g, "$1 … $2");
    textToRead = textToRead.replace(/\*\*\*/g, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/_/g, '');
    textToRead = textToRead.replace(/\s+-\s+([a-zA-Z])/g, " … $1");
    textToRead = textToRead.replace(/([a-zA-ZáéíóúÁÉÍÓÚ0-9])\s*—\s*([a-zA-ZáéíóúÁÉÍÓÚ])/g, "$1,$2");

    // Gestión de Interfaz: Ocultar Play, Mostrar Stop
    const btnPlay = document.getElementById('btn-synopsis-tts');
    const btnStop = document.getElementById('btn-synopsis-stop');
    if (btnPlay) btnPlay.classList.add('hidden');
    if (btnStop) btnStop.classList.remove('hidden');

    // Segmentación inteligente (usando el límite de 140 caracteres para mejor entonación)
    if (typeof splitTextSmartly === 'function') {
        synopsisSubChunks = splitTextSmartly(textToRead, 140);
    } else {
        synopsisSubChunks = [textToRead];
    }

    // 4. FUNCIÓN INTERNA DE LOCUCIÓN (Recursiva)
    function speakNextSynopsis() {
        const modal = document.getElementById('synopsis-modal');
        const modalVisible = modal && !modal.classList.contains('hidden');
        
        // Finalización por fin de texto o cierre del modal
        if (!modalVisible || currentSynopsisIdx >= synopsisSubChunks.length) {
            stopSynopsisTTS(); // Esta función debe encargarse de reanudar el podcast
            return;
        }

        const currentText = synopsisSubChunks[currentSynopsisIdx].trim();
        if (currentText.length === 0) {
            currentSynopsisIdx++;
            speakNextSynopsis();
            return;
        }

        const utter = new SpeechSynthesisUtterance(currentText);

        // --- AJUSTE DE IDIOMA DINÁMICO ---
        // Ahora usará la versión corregida que detecta si el original está abierto
        utter.lang = (typeof getTTSLanguageCode === 'function') ? getTTSLanguageCode() : 'es-ES';
        
        // --- AJUSTE DE VELOCIDAD ---
        // Sincronizamos con el lector principal (window.readerSpeechRate) 
        // o con la de la sinopsis si esa falla.
       // utter.rate = window.readerSpeechRate || synopsisSpeechRate || 1.1;
		utter.rate = synopsisSpeechRate; // <--- Cambiado de 1.0 a la variable
		
        utter.onend = () => {
            currentSynopsisIdx++;
            speakNextSynopsis();
        };

        utter.onerror = (e) => {
            if (e.error !== 'interrupted') {
                console.error("Synopsis TTS Error:", e.error);
                stopSynopsisTTS();
            }
        };

        // Limpieza de cualquier audio residual justo antes de hablar
        window.speechSynthesis.cancel(); 
        window.speechSynthesis.speak(utter);
    }

    // Iniciar la cadena de locución
    speakNextSynopsis();
}


	function stopSynopsisTTS() {
    // Detención total de síntesis
    window.speechSynthesis.cancel();
    synopsisSubChunks = [];
    currentSynopsisIdx = 0;

    // Gestión de Interfaz
    const btnStop = document.getElementById('btn-synopsis-stop');
    const btnPlay = document.getElementById('btn-synopsis-tts');
    if (btnStop) btnStop.classList.add('hidden');
    if (btnPlay) btnPlay.classList.remove('hidden');
    
    // Reanudación de podcast si estaba activo
    if (window.wasPodcastPlayingBeforeTTS) {
        if (typeof togglePodcastPlay === 'function') {
            togglePodcastPlay(true);
        }
        window.wasPodcastPlayingBeforeTTS = false;
    }
}

function renderSynopsisContent(content) {
    const synopsisBody = document.getElementById('synopsis-body-content'); // Ajusta al ID real
    if (synopsisBody) {
        // Añadimos 'notranslate' para evitar que Google inyecte etiquetas que capten clics
        synopsisBody.classList.add('notranslate');
        synopsisBody.innerHTML = content;
    }
}


