let library = [];
        let currentBook = null;
        let currentChapterIndex = 0;
        let currentChunkIndex = 0;
        let chunks = [];
        let isDarkMode = true;
        let isSpeaking = false;
        let isPaused = false;
        let isPinned = false;
        let allExpanded = false;
        let sidebarTimer = null;
        let speechSubChunks = [];
        let currentSubChunkIndex = 0;
        let currentUtterance = null;
        let synopsisSpeechRate = 1.1; // Variable global para la velocidad
        let imageTimer = null;
        let imageSecondsLeft = 5;
        let isImageTimerPaused = false;
		let synopsisSubChunks = [];
		let currentSynopsisIdx = 0;
		let readerSpeechRate = 1.0; // Velocidad por defecto
		let synth = window.speechSynthesis;												
																		   
        const DICTIONARY_URL = "https://raw.githubusercontent.com/proc3r/nexus/master/voice-dictionary.json";
        let VOICE_REPLACEMENTS = {}; 
		   
		  
			
	 
   
					   
	

													 
        const REPOSITORIES = [
            {
                api: "https://api.github.com/repos/proc3r/005-DOCUMENTOS-PROC3R/contents/",
                raw: "https://raw.githubusercontent.com/proc3r/005-DOCUMENTOS-PROC3R/master/adjuntos/"
            },
            {
				api: "https://api.github.com/repos/proc3r/001-Publicados/contents/",
                raw: "https://raw.githubusercontent.com/proc3r/001-Publicados/master/adjuntos/"  
            }
        ];

        const DEFAULT_COVER = "https://raw.githubusercontent.com/proc3r/001-Publicados/refs/heads/master/adjuntos/PortadaBase.jpg";
        
		function toggleReaderSpeedMenu(event) {
			if (event) event.stopPropagation(); // Evita que el clic llegue al document
			const menu = document.getElementById('reader-speed-menu');
			menu.classList.toggle('hidden');
}


	function setReaderSpeed(rate) {
    // 1. Actualizamos ambas variables globales para asegurar consistencia
    readerSpeechRate = rate;
    synopsisSpeechRate = rate;

    // 2. Actualizamos la etiqueta visual del lector principal
    const label = document.getElementById('reader-speed-label');
    if (label) label.innerText = rate + 'x';

    // 3. Actualizamos la etiqueta visual de la sinopsis (si existe)
    const labelSynopsis = document.getElementById('current-speed-label');
    if (labelSynopsis) labelSynopsis.innerText = rate + 'x';
    
    // 4. Ocultamos los menús de selección
    const speedMenu = document.getElementById('reader-speed-menu');
    if (speedMenu) speedMenu.classList.add('hidden');
    
    const speedMenuSynopsis = document.getElementById('synopsis-speed-menu');
    if (speedMenuSynopsis) speedMenuSynopsis.classList.add('hidden');

    // NOTA: No aplicamos synth.cancel(). 
    // La nueva velocidad se tomará automáticamente en la siguiente llamada a:
    // new SpeechSynthesisUtterance() en el próximo fragmento.
}
        

        window.onload = () => {
																
            loadExternalDictionary().then(() => {
                fetchBooks().then(() => {
                    checkLastSession();
                });
            });
            initTouchEvents();
            initPullToRefreshBlocker();
            setTimeout(() => { window.scrollTo(0, 1); }, 300);
        };

		// --- FUNCIÓN AUXILIAR PARA LIMPIAR HTML DE TÍTULOS ---
        function stripHtml(html) {
            const tmp = document.createElement("DIV");
            tmp.innerHTML = html;
            return tmp.textContent || tmp.innerText || "";
        }
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

        function initPullToRefreshBlocker() {
            let touchStart = 0;
            const libraryContainer = document.getElementById('library-container');
            const readerContainer = document.getElementById('reading-container-fixed');
			
            document.addEventListener('touchstart', (e) => { touchStart = e.touches[0].pageY; }, { passive: true });
												
								  

            document.addEventListener('touchmove', (e) => {
                const touchMove = e.touches[0].pageY;
                const activeContainer = document.getElementById('reader-view').classList.contains('hidden') ? libraryContainer : readerContainer;
									   
									  

															   
															 

											   
                if (activeContainer.scrollTop <= 0 && touchMove > touchStart) { if (e.cancelable) e.preventDefault(); }
				 
            }, { passive: false });
        }

        function saveProgress() {
            if (!currentBook) return;
            const progress = {
                bookId: currentBook.id,
                bookTitle: currentBook.title,
                chapterIndex: currentChapterIndex,
                chapterTitle: currentBook.chapters[currentChapterIndex].title,
                chunk: currentChunkIndex,
                timestamp: Date.now()
            };
            localStorage.setItem('nexus_last_session', JSON.stringify(progress));
        }

        function checkLastSession() {
            const saved = localStorage.getItem('nexus_last_session');
            if (saved) {
                const data = JSON.parse(saved);
																		  
																					 
																			   
                document.getElementById('resume-chapter-label').innerText = stripHtml(data.chapterTitle) || "Sección desconocida";
                document.getElementById('resume-book-label').innerText = data.bookTitle || "Libro desconocido";
                document.getElementById('resume-card').classList.remove('hidden');
            }
        }

        function resumeLastSession() {
            const saved = localStorage.getItem('nexus_last_session');
            if (!saved) return;
            const data = JSON.parse(saved);
            openReader(data.bookId);
            setTimeout(() => {
                loadChapter(data.chapterIndex);
                currentChunkIndex = data.chunk;
                renderChunk();
                document.getElementById('resume-card').classList.add('hidden');
            }, 500);
        }

        window.addEventListener('click', (e) => {
            if (!e.target.closest('.settings-dropdown-container')) {
                document.querySelectorAll('.settings-dropdown').forEach(d => d.classList.remove('show'));
            }
        });

        async function fetchBooks() {
            const statusText = document.getElementById('status-text');
            library = []; 
            try {
                for (const repo of REPOSITORIES) {
                    const response = await fetch(repo.api);
                    const files = await response.json();
                    if (!Array.isArray(files)) continue;

                    const mdFiles = files.filter(f => f.name.toLowerCase().endsWith('.md'));
					
                    for (const file of mdFiles) {
                        const res = await fetch(file.download_url);
                        const text = await res.text();

                        // --- FILTRO DE METADATOS (indexar: true) ---
                        const hasIndexTag = /indexar:\s*true/.test(text.split('---')[1] || "");
                        if (!hasIndexTag) continue; 

                        const coverMatch = text.match(/!\[\[(.*?)\]\]/);
	  
                        let coverUrl = DEFAULT_COVER;
                        if (coverMatch) {
   
                            let fileName = coverMatch[1].split('|')[0].trim();
                            coverUrl = repo.raw + encodeURIComponent(fileName);
                        }

                        library.push({
                            id: btoa(file.path + repo.api), 
                            title: file.name.replace('.md', '').replace(/_/g, ' '),
                            cover: coverUrl,
                            chapters: parseMarkdown(text),
                            rawBase: repo.raw 
                        });
                    }
                }
                statusText.innerText = "Sincronizado";
                document.getElementById('main-spinner').classList.add('hidden');
                renderLibrary();
	   
            } catch (e) { statusText.innerText = "Fail"; }
	
        }

        function parseMarkdown(text) {
            const lines = text.split('\n');
            const chapters = [];
            let currentChapter = null;
			
														   
            let inFrontmatter = false;
            let startLine = 0;
			let inMediaBlock = false; // Nueva bandera para detectar bloques media																	  

																									
            if (lines.length > 0 && lines[0].trim() === "---") {
                inFrontmatter = true;
                for (let i = 1; i < lines.length; i++) {
                    if (lines[i].trim() === "---") { inFrontmatter = false; startLine = i + 1; break; }
											  
																								
							  
					 
                }
            }
																						 
            if (inFrontmatter) startLine = 0;
														  

            for (let i = startLine; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();

                // Lógica para saltar bloques ```media
                if (trimmed.startsWith('```media')) {
                    inMediaBlock = true;
                    continue;
                }
                if (inMediaBlock) {
                    if (trimmed.startsWith('```')) inMediaBlock = false;
                    continue;
                }
                // --- IGNORAR ARCHIVOS PPTX ---
                if (trimmed.toLowerCase().includes('.pptx]]')) continue;
														
                const titleMatch = trimmed.match(/^(#+)\s+(.*)/);
				
                if (titleMatch) {
                    if (currentChapter) chapters.push(currentChapter);
                    currentChapter = { level: titleMatch[1].length, title: titleMatch[2].trim(), content: [] };
                    currentChapter.content.push(trimmed); 
                } else if (trimmed !== "") {
                    if (!currentChapter) currentChapter = { level: 1, title: "Inicio", content: [] };
					
												   
															
													 
												   
																									 
																						
																	 
																   
						 
																  
							  
                    const isQuote = trimmed.startsWith('>');
												   

												
																											
                    const parts = trimmed.split(/(!\[\[.*?\]\])/g);
   
					
                    parts.forEach(part => {
                        let subChunk = part.trim();
                        if (subChunk === "") return;

                        // --- MEJORA PARA CALLOUTS ---
                        // Si detectamos el inicio de un Callout de Obsidian [!...]
                        if (subChunk.startsWith('> [!')) {
                            let calloutBlock = subChunk;
                            // Revisamos si la siguiente línea también es parte de la cita para unirla
                            if (i + 1 < lines.length && lines[i+1].trim().startsWith('>')) {
                                calloutBlock += '\n' + lines[i+1].trim();
                                i++; // Saltamos la lectura de la línea siguiente ya que la acabamos de unir
                            }
                            currentChapter.content.push(calloutBlock);
                        } 
                        else if (subChunk.match(/^!\[\[.*?\]\]/)) {
																										  
                            currentChapter.content.push(isQuote && !subChunk.startsWith('>') ? '> ' + subChunk : subChunk);
																			 
									
																	  
							 
                        } else {
																																	
                            currentChapter.content.push(isQuote && !subChunk.startsWith('>') ? '> ' + subChunk : subChunk);
														   
							 
																  
                        }
                    });
 
	
	
  
                }
            }
            if (currentChapter) chapters.push(currentChapter);
            return chapters;
        }
function renderLibrary() {
    const grid = document.getElementById('library-grid');
    grid.innerHTML = library.length ? '' : '<div class="col-span-full py-32 text-center opacity-20 italic text-white">No hay libros disponibles.</div>';
    
    library.forEach(book => {
        // --- 1. LÓGICA DE CONTEO EXACTO PARA H1 (# + espacio) ---
        let chapterCount = 0;
        book.chapters.forEach(ch => {
            if (ch.content) {
                const hasH1 = ch.content.some(text => (text || "").trim().startsWith('# '));
                if (hasH1) chapterCount++;
            }
        });

        const displayChapters = chapterCount > 0 ? chapterCount : book.chapters.length;

        // --- 2. LÓGICA DE DETECCIÓN DE SINOPSIS (# Sinopsis) ---
        // Buscamos si existe un capítulo que empiece exactamente con "# Sinopsis"
        const hasSynopsis = book.chapters.some(ch => 
            ch.content && ch.content.some(text => (text || "").trim().startsWith('# Sinopsis'))
        );

        // --- 3. CÁLCULO DE TIEMPO ---
        let totalWords = 0;
        book.chapters.forEach(ch => ch.content.forEach(text => { 
            totalWords += (text || "").split(/\s+/).filter(w => w.length > 0).length; 
        }));
        const totalMins = Math.ceil(totalWords / 185);
        const timeStr = totalMins >= 60 ? `${Math.floor(totalMins/60)}h ${totalMins%60}m` : `${totalMins} min`;
        
        const card = document.createElement('div');
        card.className = 'book-card group relative bg-white/5 border border-white/10 rounded-[0.5rem] hover:border-[#ffcc00] transition-all cursor-pointer text-center overflow-hidden';
        
        // Ajustamos el click para que no interfiera con el botón de sinopsis
        card.onclick = (e) => {
            if (!e.target.closest('.btn-synopsis')) {
                openReader(book.id);
            }
        };
        
        card.innerHTML = `
            <div class="book-card-cover relative w-full aspect-[2/3]">
                <img src="${book.cover}" alt="Cover" loading="lazy" class="w-full h-full object-cover">
                
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
                            <span class="mi-round text-[18px] align-middle mr-1">schedule</span>${timeStr}
                        </p>
                    </div>
                </div>
            </div>
        `;
        
        grid.appendChild(card);
    });

    renderShelf();
}

// FUNCIÓN DEL PLUGIN PARA RENDERIZAR EL ESTANTE SUPERIOR
function renderShelf() {
    const shelf = document.getElementById('book-shelf');
    if (!shelf || !library.length) return;
    
    shelf.innerHTML = '';
    library.forEach((book, index) => {
        const bookNode = document.createElement('div');
        bookNode.className = 'shelf-book';
        
        // Mantenemos la lógica de apertura para el estante
        bookNode.onclick = () => openReader(book.id);
        
        // Imagen de portada: buscamos cover o primer adjunto
        const coverImg = book.cover || (book.chapters[0] && book.chapters[0].attachments && book.chapters[0].attachments[0]) || '';
        
        bookNode.innerHTML = `
            <img src="${coverImg}" alt="${stripHtml(book.title)}" onerror="this.src='https://via.placeholder.com/120x175?text=SIN+PORTADA'">
            <div class="shelf-book-overlay">
                <div class="shelf-book-title">${stripHtml(book.title)}</div>
            </div>
        `;
        shelf.appendChild(bookNode);
    });
}
function openReader(id) {
    currentBook = library.find(b => b.id === id);
    document.getElementById('reader-title').innerText = currentBook.title;

    // ACTUALIZACIÓN: Imagen de portada en el sidebar
    const coverPreview = document.getElementById('sidebar-cover-preview');
    if (coverPreview) {
        coverPreview.style.backgroundImage = `url('${currentBook.cover}')`;
    }

    renderTOC();
    renderProgressMarkers();
    document.getElementById('library-container').classList.add('hidden');
    document.getElementById('reader-view').classList.remove('hidden');
    document.getElementById('resume-card').classList.add('hidden');

    const isMobile = window.innerWidth <= 768;
    const defFontSize = isMobile ? 23 : 25;
    const defFontName = isMobile ? 'Atkinson Hyperlegible' : 'Merriweather';

    document.getElementById('font-size-val').innerText = defFontSize;
    document.getElementById('current-font-label').innerText = defFontName;

    document.documentElement.style.setProperty('--reader-font-size', defFontSize + 'px');
    document.documentElement.style.setProperty('--reader-font-family', defFontName);

    loadChapter(0);
}

function closeReader() { 
    stopSpeech(); 
    clearImageTimer(); 
    document.getElementById('reader-view').classList.add('hidden'); 
    document.getElementById('library-container').classList.remove('hidden'); 
    checkLastSession(); 
}

function loadChapter(idx) {
    currentChapterIndex = idx;
    const chapter = currentBook.chapters[idx];
    document.getElementById('chapter-indicator').innerText = stripHtml(chapter.title);
    chunks = chapter.content;
    currentChunkIndex = 0;

    // Limpiamos la clase active de TODOS los items
    document.querySelectorAll('.toc-item').forEach(el => el.classList.remove('active'));
    
    // Asignamos active solo al item actual
    const activeItem = document.getElementById(`toc-item-${idx}`);
    if (activeItem) {
        activeItem.classList.add('active');
        if (!allExpanded) expandActiveHierarchy(idx);
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    renderChunk();
}
  
   
 
   
   
  
  
  
 
   
   
 

	
											  
														  
			   
        function cleanMarkdown(str) {
            if (!str) return "";
            return str.replace(/\[\![^\]\n]+\][\+\-]?\s?/g, '').replace(/\^[a-zA-Z0-9-]+(?:\s|$)/g, '').replace(/\[\[([^\]]+)\]\]/g, (match, p1) => p1.includes('|') ? p1.split('|')[1].trim() : p1.trim());
	 
																	 
	  
																				
		
																		   
																				  
				   
        }

   
											  
																			
	 
        function filterTextForVoice(text) {
            let cleanText = text;
            // 1. Eliminar numeraciones tipo 7.8.21 »
																						  
            cleanText = cleanText.replace(/\d+\.\d+\.\d+\s?»/g, '');

            // 2. Aplicar Diccionario Fonético
            for (let [original, reemplazo] of Object.entries(VOICE_REPLACEMENTS)) {
																								   
                const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
														
																									 
                const regex = new RegExp(`\\b${escapedOriginal}(?=\\s|$|[,.;])`, 'gi');
                cleanText = cleanText.replace(regex, reemplazo);
            }

																
																							 

	
	
	
            return cleanText;
        }

 
   
  
   
  
 
   
  
 
 
  
 
  
   


        function renderChunk() {
            clearImageTimer();
            const content = document.getElementById('book-content');
            let rawText = chunks[currentChunkIndex] || "";
			
														 
            if (rawText.trim() === ">") { if (window.navDirection === 'prev') prevChunk(); else nextChunk(); return; }

            let finalHtml = "";
            let isImage = false;
			
															  
            const embedMatch = rawText.match(/!\[\[(.*?)\]\]/);
			
            if (embedMatch) {
                const fileName = embedMatch[1].split('|')[0].trim().toLowerCase();
	
																	
                const isAudio = fileName.endsWith('.m4a') || fileName.endsWith('.mp3') || fileName.endsWith('.wav') || fileName.endsWith('.ogg');
                const isVideo = fileName.endsWith('.mp4') || fileName.endsWith('.mov') || fileName.endsWith('.webm') || fileName.endsWith('.mkv');

										 
																			 
                if (isAudio || isVideo) { if (window.navDirection === 'prev') prevChunk(); else nextChunk(); return; }
							
				 

																 
                isImage = true;
   
	  
                const imageUrl = currentBook.rawBase + encodeURIComponent(embedMatch[1].split('|')[0].trim());
                finalHtml = `<div class="reader-image-container"><img src="${imageUrl}" class="reader-image" alt="${fileName}"></div>`;
            } else if (rawText.trim().startsWith('#')) {
				// Aquí el título del libro en la zona de lectura conserva su HTML original (colores)																					   
                finalHtml = `<div class="reader-section-title">${cleanMarkdown(rawText.replace(/^#+\s+/, '').trim())}</div>`;
            } else if (rawText.trim().startsWith('>')) {
                // Modificación para Callouts: Procesamos múltiples líneas si están presentes (unidas por \n)
                let lines = rawText.split('\n');
                let processedLines = lines.map(l => cleanMarkdown(l.trim().replace(/^>\s?/, ''))).join('<br><hr>');
                finalHtml = `<div class="custom-blockquote">${processFormatting(processedLines)}</div>`;
            } else {
 
                finalHtml = processFormatting(cleanMarkdown(rawText));
													   
            }

            content.innerHTML = finalHtml;
            document.getElementById('reading-container-fixed').scrollTop = 0;
            updateProgress();
            saveProgress();
			
            document.getElementById('next-btn').innerHTML = (currentChunkIndex === chunks.length - 1 && currentChapterIndex === currentBook.chapters.length - 1) ? "FIN" : "NEXT ▶";
																	  
					
																		   
			 

							 
            if (isSpeaking) { if (isImage) startImageTimer(); else prepareAndStartSpeech(); }
											 
			 
        }

        function toggleSpeech() { if (isPaused) resumeSpeech(); else if (isSpeaking) stopSpeech(); else startSpeech(); }
										  
											   
								
		 

     function startSpeech() {
    isSpeaking = true; 
    isPaused = false;
    
    // Visibilidad de botones flotantes
    document.getElementById('tts-btn').classList.add('hidden'); // Oculta Persona hablando (Rojo)
    document.getElementById('pause-btn').classList.remove('hidden'); // Muestra Pausa (Amarillo)
    document.getElementById('stop-btn').classList.remove('hidden'); // Muestra Stop pequeño
    
    // Asegurar que el botón de pausa empiece en estado "sonando" (Amarillo)
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
    
    // Volver al estado inicial: Solo botón rojo de persona hablando
    document.getElementById('tts-btn').classList.remove('hidden'); 
    document.getElementById('pause-btn').classList.add('hidden'); 
    document.getElementById('stop-btn').classList.add('hidden'); 
    
    // Limpiar color verde por si acaso
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
            // MEJORA: Convertimos a minúsculas solo para el motor de voz para evitar que deletree títulos
            textToRead = textToRead.toLowerCase(); 
            textToRead = filterTextForVoice(textToRead);

		
	  
   
            speechSubChunks = splitTextSmartly(textToRead, 140);
            currentSubChunkIndex = 0;
            speakSubChunk();
        }

        function splitTextSmartly(text, limit) {
            const result = [];
            let remaining = text;
            while (remaining.length > 0) {
                if (remaining.length <= limit) { result.push(remaining.trim()); break; }
                let slice = remaining.substring(0, limit);
                let lastBreak = Math.max(slice.lastIndexOf(','), slice.lastIndexOf('.'), slice.lastIndexOf(';'));
                if (lastBreak === -1) lastBreak = slice.lastIndexOf(' ');
                result.push(remaining.substring(0, lastBreak + 1).trim());
                remaining = remaining.substring(lastBreak + 1).trim();
            }
            return result.filter(s => s.length > 0);
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

        function startImageTimer() {
            clearImageTimer();
            const timerEl = document.getElementById('image-timer');
            timerEl.classList.remove('hidden');
            imageSecondsLeft = 5;
            isImageTimerPaused = false;
            updateTimerDisplay();
            imageTimer = setInterval(() => {
                if (!isImageTimerPaused) {
                    imageSecondsLeft--;
                    updateTimerDisplay();
                    if (imageSecondsLeft <= 0) { clearImageTimer(); nextChunk(); }
                }
            }, 1000);
        }

        function updateTimerDisplay() {
            const textEl = document.getElementById('timer-text');
            const btnEl = document.querySelector('.timer-pause-btn');
            if (isImageTimerPaused) { textEl.innerText = "Pausado. Presione REANUDAR o NEXT."; if(btnEl) btnEl.innerText = "Reanudar"; }
            else { textEl.innerText = `Comenzando en ${imageSecondsLeft}s`; if(btnEl) btnEl.innerText = "Pausar"; }
        }

        function togglePauseImageTimer() { isImageTimerPaused = !isImageTimerPaused; isPaused = isImageTimerPaused; updatePauseUI(isPaused); updateTimerDisplay(); }
        function clearImageTimer() { if (imageTimer) clearInterval(imageTimer); imageTimer = null; document.getElementById('image-timer').classList.add('hidden'); }
									 

										 
        function processFormatting(str) { return str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/[*_](.*?)[*_]/g, '<em>$1</em>'); }
		 

 
 
  
   
   
   
  
	
   
   
   

        function nextChunk() { 
            window.navDirection = 'next'; 
            clearImageTimer(); 
            if (isSpeaking && isPaused) { synth.resume(); isPaused = false; updatePauseUI(false); }
            if (isSpeaking) synth.cancel(); 

            if (currentChunkIndex < chunks.length - 1) { currentChunkIndex++; renderChunk(); }
									 
							   
            else if (currentChapterIndex < currentBook.chapters.length - 1) { loadChapter(currentChapterIndex + 1); } 
													  
			  
        }

        function prevChunk() { 
            window.navDirection = 'prev'; 
            clearImageTimer(); 
            if (isSpeaking && isPaused) { synth.resume(); isPaused = false; updatePauseUI(false); }
            if (isSpeaking) synth.cancel(); 

            if (currentChunkIndex > 0) { currentChunkIndex--; renderChunk(); }
            else if (currentChapterIndex > 0) { currentChapterIndex--; loadChapter(currentChapterIndex); currentChunkIndex = chunks.length - 1; renderChunk(); } 
							   
												  
									   
												  
													   
							   
			  
        }

        function jumpToChapter(idx) { let wasSpeaking = isSpeaking; stopSpeech(); loadChapter(idx);
    // Solo cerramos el sidebar si NO está anclado (isPinned es false)
    if (!isPinned) closeSidebar();

    if (wasSpeaking) startSpeech();
}				  
							  
										   
		 

        function updateProgress() {
            if(!currentBook || currentBook.chapters.length === 0) return;
            const chapterWeight = 100 / currentBook.chapters.length;
            const progressInChapter = chunks.length > 0 ? currentChunkIndex / chunks.length : 0;
            const p = (currentChapterIndex * chapterWeight) + (progressInChapter * chapterWeight);
            document.getElementById('reading-progress-bar').style.width = `${p}%`;
            document.getElementById('progress-percent').innerText = `${Math.round(p)}%`;
            document.getElementById('current-p-num').innerText = currentChunkIndex + 1;
            document.getElementById('total-p-num').innerText = chunks.length;
            updateTimeRemaining();
        }

        function updateTimeRemaining() {
            if (!currentBook) return;
            let remainingWords = 0;
            for (let i = currentChunkIndex + 1; i < chunks.length; i++) remainingWords += (chunks[i] || "").split(/\s+/).length;
            for (let i = currentChapterIndex + 1; i < currentBook.chapters.length; i++) {
                currentBook.chapters[i].content.forEach(text => { remainingWords += (text || "").split(/\s+/).length; });
            }
            const mins = remainingWords / 180;
            const timeEl = document.getElementById('time-remaining');
            if (mins < 1) timeEl.innerText = "Falta menos de 1 min";
            else if (mins < 60) timeEl.innerText = `Faltan ${Math.ceil(mins)} min`;
            else timeEl.innerText = `Faltan ${Math.floor(mins/60)}h ${Math.ceil(mins%60)}m`;
        }

        function renderTOC() {
    const list = document.getElementById('chapter-list');
    list.innerHTML = '';
    currentBook.chapters.forEach((ch, i) => {
        const item = document.createElement('div');
        item.className = `toc-item pr-[0.2em]`;
        item.id = `toc-item-${i}`;
        const hasChildren = (i < currentBook.chapters.length - 1 && currentBook.chapters[i+1].level > ch.level);
        
        // Estructura optimizada para el CSS de hijo directo ( > )
        item.innerHTML = `
            <div class="flex items-center group py-[1.5px]">
                <span class="toc-toggle text-[10px] opacity-50" onclick="toggleTOCSection(${i}, event)">
                    ${hasChildren ? '+' : '•'}
                </span>
                <span class="toc-text cursor-pointer hover:opacity-80 transition-opacity truncate font-normal flex-1 condensed uppercase tracking-[0.015em] text-[21px]" onclick="jumpToChapter(${i})">
                    ${ch.title}
                </span>
            </div>
            <div id="child-container-${i}" class="hidden mt-0 pl-3 border-l border-white/5"></div>`;
            
        if (ch.level === 1) {
            list.appendChild(item);
        } else {
            const parents = list.querySelectorAll('.toc-item');
            for(let p = parents.length - 1; p >= 0; p--) {
                const parentIdx = parseInt(parents[p].id.split('-').pop());
                if (currentBook.chapters[parentIdx].level < ch.level) {
                    parents[p].querySelector(`[id^="child-container-"]`).appendChild(item);
                    break;
                }
            }
        }
    });
}

        function toggleTOCSection(idx, event) { if (event) event.stopPropagation(); const container = document.getElementById(`child-container-${idx}`); if (container) { container.classList.toggle('hidden'); event.target.innerText = container.classList.contains('hidden') ? '+' : '−'; } }
        function toggleExpandMode() { allExpanded = !allExpanded; document.getElementById('expand-mode-btn').classList.toggle('text-[#ffcc00]', allExpanded); document.querySelectorAll('[id^="child-container-"]').forEach(c => c.classList.toggle('hidden', !allExpanded)); if (!allExpanded) expandActiveHierarchy(currentChapterIndex); }
        function expandActiveHierarchy(idx) { if (!allExpanded) { let current = document.getElementById(`toc-item-${idx}`); while (current) { const container = current.parentElement; if (container && container.id.startsWith('child-container-')) { container.classList.remove('hidden'); const pIdx = container.id.replace('child-container-', ''); const t = document.querySelector(`#toc-item-${pIdx} .toc-toggle`); if(t) t.innerText = '−'; current = document.getElementById(`toc-item-${pIdx}`); } else current = null; } } }
        
function renderProgressMarkers() {
    const container = document.getElementById('progress-markers-container');
    container.innerHTML = '';
    
    if (!window.ttHideTimer) window.ttHideTimer = null;

    currentBook.chapters.forEach((ch, i) => {
        if (ch.level > 2) return;
        
        const pos = (i / currentBook.chapters.length) * 100;
        const marker = document.createElement('div');
        marker.className = `progress-marker`;
        marker.style.left = `${pos}%`;
        marker.innerHTML = ch.level === 1 ? `<div class="marker-h1-dot"></div>` : `<div class="marker-h2-line"></div>`;
        
        const tooltip = document.createElement('div');
        tooltip.className = 'marker-tooltip condensed';
        tooltip.innerText = stripHtml(ch.title);

        if (pos < 15) tooltip.classList.add('edge-left');
        else if (pos > 85) tooltip.classList.add('edge-right');

        marker.appendChild(tooltip);

        // --- LÓGICA DE MOSTRADO PERSISTENTE ---
        const showTooltipForced = () => {
            if (window.ttHideTimer) clearTimeout(window.ttHideTimer);
            
            // Limpiar todos los demás de forma inmediata
            document.querySelectorAll('.marker-tooltip').forEach(t => {
                t.classList.remove('force-show');
            });
            
            tooltip.classList.add('force-show');
        };

        // --- EVENTOS ESPECÍFICOS ---

        // Móvil: Toque inicial
        marker.addEventListener('touchstart', (e) => {
            // Evitamos que el navegador haga "hover" por su cuenta
            showTooltipForced();
            
            // Se quedará 4 segundos, dándole tiempo de sobra al usuario para leer
            window.ttHideTimer = setTimeout(() => {
                tooltip.classList.remove('force-show');
            }, 4000);
        }, { passive: true });

        // Escritorio: Mouse
        marker.addEventListener('mouseenter', showTooltipForced);
        marker.addEventListener('mouseleave', () => {
            if (window.ttHideTimer) clearTimeout(window.ttHideTimer);
            window.ttHideTimer = setTimeout(() => {
                tooltip.classList.remove('force-show');
            }, 1000); // 1 segundo de cortesía en escritorio
        });

        // Click: Navegación (Funciona en ambos)
        marker.onclick = (e) => { 
            e.stopPropagation(); 
            // Si hace click, quitamos el tooltip y saltamos
            tooltip.classList.remove('force-show');
            if (window.ttHideTimer) clearTimeout(window.ttHideTimer);
            jumpToChapter(i); 
        };
        
        container.appendChild(marker);
    });
}
		
        function openSidebar() { 
    document.getElementById('reader-sidebar').classList.add('open'); 
    document.getElementById('sidebar-trigger').classList.add('hidden'); 
    if (sidebarTimer) clearTimeout(sidebarTimer); 
}

function closeSidebar() {
    // Resetear estado del PIN para que el layout vuelva a pantalla completa
    isPinned = false; 
    document.body.classList.remove('sidebar-pinned');
    
    const sidebar = document.getElementById('reader-sidebar');
    const trigger = document.getElementById('sidebar-trigger');
    
    if (sidebar) {
        sidebar.classList.remove('open');
        sidebar.classList.remove('pinned');
    }
    
    // Volver a mostrar el disparador (la etiqueta amarilla lateral)
    if (trigger) {
        trigger.classList.remove('hidden');
    }
}

function handleSidebarLeave() { 
    if (isPinned) return; 
    sidebarTimer = setTimeout(() => { closeSidebar(); }, 1200); 
}

function togglePin() { 
    // Seguridad: Si es móvil (ancho menor a 1024), no permitir el PIN
    if (window.innerWidth < 1024) return; 

    isPinned = !isPinned; 
    const sidebar = document.getElementById('reader-sidebar');
    const pinBtn = document.getElementById('pin-btn');
    
    sidebar.classList.toggle('pinned', isPinned); 
    pinBtn.classList.toggle('opacity-100', isPinned); 

    // Añadimos clase al body para mover los controles de audio en el CSS
    if (isPinned) {
        document.body.classList.add('sidebar-pinned');
    } else {
        document.body.classList.remove('sidebar-pinned');
    }
}

function initTouchEvents() {
    const sidebar = document.getElementById('reader-sidebar');
    let startX = 0;
    sidebar.addEventListener('touchstart', e => startX = e.touches[0].clientX, {passive: true});
    sidebar.addEventListener('touchend', e => { 
        if (startX - e.changedTouches[0].clientX > 50) closeSidebar(); 
    }, {passive: true});
}

function showSynopsis(bookId) {
    const book = library.find(b => b.id === bookId);
    if (!book) return;

    const startIndex = book.chapters.findIndex(ch => 
        ch.content && ch.content.some(t => (t || "").trim().startsWith('# Sinopsis'))
    );

    if (startIndex !== -1) {
        const modal = document.getElementById('synopsis-modal');
        const body = document.getElementById('synopsis-body');
        
						   

        let rawText = book.chapters.slice(startIndex)
            .map(ch => ch.content.join('\n'))
            .join('\n\n');

        const lines = rawText.split('\n');
        let formattedHtml = "";

        lines.forEach(line => {
            let cleanLine = line.trim();
            
            if (!cleanLine || cleanLine.toLowerCase().startsWith('# sinopsis')) return;

            // Función interna para procesar Markdown de Obsidian
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
                // Ahora también procesamos negritas e itálicas dentro de las citas
                let quoteText = processMD(cleanLine.replace(/^>\s*/, ''));
                formattedHtml += `<blockquote class="synopsis-quote">${quoteText}</blockquote>`;
            } else {
                let text = processMD(cleanLine);
                formattedHtml += `<p class="synopsis-p">${text}</p>`;
            }
        });

        body.innerHTML = formattedHtml;

        // 1. Mostrar el modal primero
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // 2. Resetear el scroll (con un ligero delay para asegurar que el DOM respondió)
        setTimeout(() => {
            body.scrollTop = 0;
        }, 10);

        // Configurar botón leer completo
        const readBtn = document.getElementById('btn-synopsis-read');
        readBtn.onclick = (e) => {
            e.preventDefault();
								
            closeSynopsis();
            openReader(bookId);
        };


        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // --- CERRAR AL TOCAR FUERA ---
        modal.onclick = (e) => {
            // Si el clic es en el fondo negro (el modal en sí) y no en el contenedor blanco
            if (e.target.id === 'synopsis-modal') {
                closeSynopsis();
            }
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


function startSynopsisTTS() {
    const body = document.getElementById('synopsis-body');
    if (!body) return;

    // 1. LIMPIEZA TOTAL PREVIA para evitar leer libros anteriores
    window.speechSynthesis.cancel();
	synth.cancel();
    synopsisSubChunks = [];
    currentSynopsisIdx = 0;

    // 2. OBTENER TEXTO Y APLICAR FILTRO INTELIGENTE
    let textToRead = body.innerText;

    // REGLA A: Guiones de lista (inicio de línea o tras blockquote) -> Reemplazar por pausa (.)
    textToRead = textToRead.replace(/^>\s*-\s*/gm, "… ");
    textToRead = textToRead.replace(/^-\s+/gm, "… ");

    // REGLA B: Guion entre letras o palabras (ej: "hardware - orgánico") -> Reemplazar por pausa (.)
    // Buscamos guiones que NO tengan números a ambos lados
    textToRead = textToRead.replace(/([a-zA-ZáéíóúÁÉÍÓÚ])\s*-\s*([a-zA-ZáéíóúÁÉÍÓÚ])/g, "$1 … $2");
	
	// REGLA C: LIMPIEZA DE SÍMBOLOS DE ESTILO (Para que no diga "asterisco")
    // Eliminamos ***, **, * y _ para que el motor de voz no los nombre
    textToRead = textToRead.replace(/\*\*\*/g, '')
                           .replace(/\*\*/g, '')
                           .replace(/\*/g, '')
                           .replace(/_/g, '');

    // REGLA 3: Guiones persistentes
    textToRead = textToRead.replace(/\s+-\s+([a-zA-Z])/g, " … $1");
    textToRead = textToRead.replace(/([a-zA-ZáéíóúÁÉÍÓÚ0-9])\s*—\s*([a-zA-ZáéíóúÁÉÍÓÚ])/g, "$1,$2");

    // 3. CAMBIAR INTERFAZ
    document.getElementById('btn-synopsis-tts').classList.add('hidden');
    document.getElementById('btn-synopsis-stop').classList.remove('hidden');

    // 4. GENERAR CHUNKS (Usando tu función core splitTextSmartly)
    synopsisSubChunks = splitTextSmartly(textToRead, 140);

    function speakNextSynopsis() {
        // Verificamos si el modal sigue abierto
        const modalVisible = !document.getElementById('synopsis-modal').classList.contains('hidden');
        
        if (!modalVisible || currentSynopsisIdx >= synopsisSubChunks.length) {
            stopSynopsisTTS();
            return;
        }

        const currentText = synopsisSubChunks[currentSynopsisIdx].trim();
        if (currentText.length === 0) {
            currentSynopsisIdx++;
            speakNextSynopsis();
            return;
        }

        const utter = new SpeechSynthesisUtterance(currentText);
		utter.lang = 'es-ES';
		utter.rate = synopsisSpeechRate; // <--- Cambiado de 1.0 a la variable

        utter.onend = () => {
            currentSynopsisIdx++;
            speakNextSynopsis();
        };

        utter.onerror = () => stopSynopsisTTS();

        window.speechSynthesis.speak(utter);
    }

    speakNextSynopsis();
}

function stopSynopsisTTS() {
    window.speechSynthesis.cancel();
    synopsisSubChunks = [];
    currentSynopsisIdx = 0;
    document.getElementById('btn-synopsis-stop').classList.add('hidden');
    document.getElementById('btn-synopsis-tts').classList.remove('hidden');
}

function closeSynopsis() {
    // 1. Detener audio y limpiar cola inmediatamente
    window.speechSynthesis.cancel();
    synopsisSubChunks = [];
    isSynopsisReading = false;

    // 2. Referencias a elementos
    const modal = document.getElementById('synopsis-modal');
    const body = document.getElementById('synopsis-body');
    const btnStop = document.getElementById('btn-synopsis-stop');
    const btnPlay = document.getElementById('btn-synopsis-tts');

    // 3. Ocultar modal y restaurar scroll del body
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';

    // 4. Resetear el scroll interno del texto para la próxima vez
    if (body) body.scrollTop = 0;

    // 5. Restaurar estado de los botones
    if (btnStop) btnStop.classList.add('hidden');
    if (btnPlay) btnPlay.classList.remove('hidden');
}

// Cerrar menús de velocidad al tocar fuera de ellos
document.addEventListener('click', function(event) {
    const speedMenuReader = document.getElementById('reader-speed-menu');
    // Referencia al botón usando la clase que tiene en tu HTML
    const speedBtnReader = document.querySelector('.speed-btn-center');
    
    const speedMenuSynopsis = document.getElementById('synopsis-speed-menu');
    const speedBtnSynopsis = document.getElementById('btn-synopsis-speed');

    // Lógica para el Lector Principal
    if (speedMenuReader && !speedMenuReader.classList.contains('hidden')) {
        // Usamos .closest('.speed-btn-center') para detectar el botón correctamente
        const isClickInsideMenu = speedMenuReader.contains(event.target);
        const isClickOnButton = event.target.closest('.speed-btn-center');

        if (!isClickInsideMenu && !isClickOnButton) {
            speedMenuReader.classList.add('hidden');
        }
    }

    // Lógica para la Sinopsis
    if (speedMenuSynopsis && !speedMenuSynopsis.classList.contains('hidden')) {
        const isClickInsideMenu = speedMenuSynopsis.contains(event.target);
        const isClickOnButton = event.target.closest('#btn-synopsis-speed');

        if (!isClickInsideMenu && !isClickOnButton) {
            speedMenuSynopsis.classList.add('hidden');
        }
    }
});

window.addEventListener('resize', () => {
    const width = window.innerWidth;
    
    // Si la pantalla baja de 1024px y está anclado, forzamos el desanclado completo
    if (width < 1024 && isPinned) {
        isPinned = false; // Cambiamos el estado global
        
        const sidebar = document.getElementById('reader-sidebar');
        const trigger = document.getElementById('sidebar-trigger');
        const pinBtn = document.getElementById('pin-btn');

        document.body.classList.remove('sidebar-pinned');
        if (sidebar) sidebar.classList.remove('pinned', 'open');
        if (trigger) trigger.classList.remove('hidden'); // MOSTRAR el disparador amarillo
        if (pinBtn) pinBtn.classList.remove('active'); // Resetear icono del pin si lo usas
        
        console.log("Reseteo automático: Pantalla pequeña detectada.");
    }
});