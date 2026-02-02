		let library = [];
        let currentBook = null;
        let currentChapterIndex = 0;
        let currentChunkIndex = 0;
        let chunks = [];
        const REPOSITORIES = [
    {
        api: "https://api.github.com/repos/proc3r/005-DOCUMENTOS-PROC3R/contents/",
        raw: "https://raw.githubusercontent.com/proc3r/005-DOCUMENTOS-PROC3R/refs/heads/master/",
        adjuntos: "https://raw.githubusercontent.com/proc3r/005-DOCUMENTOS-PROC3R/master/adjuntos/"
    },
    {
        api: "https://api.github.com/repos/proc3r/001-Publicados/contents/",
        raw: "https://raw.githubusercontent.com/proc3r/001-Publicados/refs/heads/master/",
        adjuntos: "https://raw.githubusercontent.com/proc3r/001-Publicados/master/adjuntos/"
    }
];
        const DEFAULT_COVER = "https://raw.githubusercontent.com/proc3r/001-Publicados/refs/heads/master/adjuntos/PortadaBase.jpg";

	const AUDIO_BASE_URL = "https://raw.githubusercontent.com/proc3r/Audios/master/";

		function extractPodcast(content) {
			const match = content.match(/!\[\[(.*?\.mp3)\]\]/);
			if (match) {
				return AUDIO_BASE_URL + encodeURIComponent(match[1].trim());
			}
			return null;
		}

	function getUrlParams() {
		const params = new URLSearchParams(window.location.search);
		return {
			repo: params.get('repo'),
			book: params.get('book'), // Nombre real del archivo .md
			ch: parseInt(params.get('ch')) || 0,
			ck: parseInt(params.get('ck')) || 0
		};
	}

	function getOptimizedImageUrl(url, width = 400) {
		if (!url || url === DEFAULT_COVER) return url;
		return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&output=webp&q=75`;
	}
	
	
	window.onload = () => {
    loadExternalDictionary().then(() => {
        if (window.isLectorFijo) {
            const params = getUrlParams();
            loadDirectBook(params);
        } else {
            fetchBooks().then(() => {
                checkLastSession();
            });
        }
    });
    initTouchEvents();
    initPullToRefreshBlocker();
    setTimeout(() => { window.scrollTo(0, 1); }, 300);
	};


async function loadDirectBook(params) {
    const statusText = document.getElementById('status-text');
    let repoIndex = (params.repo !== null && !isNaN(params.repo)) ? parseInt(params.repo) : 0;
    
    // Si no hay libro en el parámetro, usamos el "Modelo Nouménico" por defecto
    let fileName = params.book ? decodeURIComponent(params.book) : "Modelo Nouménico.md";
    
    const repo = REPOSITORIES[repoIndex] || REPOSITORIES[0];
    
    // Construimos la URL: raw base (raíz del repo) + nombre del archivo .md
    const fileUrl = repo.raw + encodeURIComponent(fileName);

    try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`Error 404: No se encontró el archivo en ${fileUrl}`);
        
        const text = await response.text();
        
        // Lógica de Portada: Intentamos extraer la portada del texto antes de asignar la por defecto
        const coverMatch = text.match(/!\[\[(.*?)\]\]/);
        let coverUrl = DEFAULT_COVER;
        if (coverMatch) {
            let fileNameImg = coverMatch[1].split('|')[0].trim();
            let rawCoverUrl = repo.adjuntos + encodeURIComponent(fileNameImg);
            coverUrl = getOptimizedImageUrl(rawCoverUrl, 400); 
        }

        // Dentro de loadDirectBook en nexus-core.js
		currentBook = {
		id: 'direct-load',
		fileName: fileName, // <--- ESTE NOMBRE ES CRUCIAL
		title: fileName.replace('.md', '').replace(/_/g, ' '),
		cover: coverUrl,
		chapters: parseMarkdown(text),
		rawBase: repo.adjuntos,
		repoIdx: repoIndex   // <--- ESTE ÍNDICE ES CRUCIAL
};

        // --- CONFIGURACIÓN DE LA INTERFAZ (UI) ---
        
        // 1. Título e Imagen de fondo en el Sidebar
        document.getElementById('reader-title').innerText = currentBook.title;
        const coverPreview = document.getElementById('sidebar-cover-preview');
        if (coverPreview) {
            coverPreview.style.backgroundImage = `url('${currentBook.cover}')`;
        }

        // 2. Control de visibilidad de contenedores
        const libContainer = document.getElementById('library-container');
        if (libContainer) libContainer.classList.add('hidden');
        document.getElementById('reader-view').classList.remove('hidden');
        
        // 3. Cargar posición y renderizar contenido
        loadChapter(params.ch || 0);
        currentChunkIndex = params.ck || 0;
        renderChunk();
        
        // 4. INICIALIZAR NAVEGACIÓN (TOC y Marcadores)
        // Estas llamadas activan el menú lateral y los puntos de la barra inferior
        renderTOC();
        renderProgressMarkers();
        
        // 5. Finalización
        if(statusText) statusText.innerText = "Sincronizado";
        
        // Ocultar el spinner/loader de lector.html si existe
        document.getElementById('auto-loader')?.classList.add('hidden');
        document.getElementById('main-spinner')?.classList.add('hidden');

    } catch (e) {
        console.error("Error de carga en loadDirectBook:", e);
        if(statusText) statusText.innerText = "Error: Archivo no encontrado";
        // Si hay error, al menos ocultamos el loader para mostrar el mensaje
        document.getElementById('auto-loader')?.classList.add('hidden');
    }
}


	function stripHtml(html) {
		const tmp = document.createElement("DIV");
		tmp.innerHTML = html;
		return tmp.textContent || tmp.innerText || "";
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

	

	window.addEventListener('click', (e) => {
		if (!e.target.closest('.settings-dropdown-container')) {
			document.querySelectorAll('.settings-dropdown').forEach(d => d.classList.remove('show'));
		}
	});

async function fetchBooks() {
    const statusText = document.getElementById('status-text');
    
    // 1. INTENTAR CARGAR DESDE CACHE (sessionStorage)
    const cachedLibrary = sessionStorage.getItem('nexus_library_cache');
    if (cachedLibrary) {
        library = JSON.parse(cachedLibrary);
        console.log("Cargado desde cache para ahorrar cuota de GitHub");
        if (statusText) statusText.innerText = "Sincronizado (Cache)";
        document.getElementById('main-spinner')?.classList.add('hidden');
        renderLibrary();
        checkAutoLoad(); 
        return; 
    }

    // 2. SI NO HAY CACHE, PROCEDER CON LA CARGA NORMAL
    library = []; 
    try {
        for (const repo of REPOSITORIES) {
            const response = await fetch(repo.api);
            
            if (!response.ok) {
                if (response.status === 403) throw new Error("API Rate Limit");
                continue;
            }
            
            const files = await response.json();
            if (!Array.isArray(files)) continue;

            const mdFiles = files.filter(f => 
                f.name.toLowerCase().endsWith('.md') && 
                !f.name.toLowerCase().includes('readme')
            );

            for (let i = 0; i < mdFiles.length; i += 5) {
                const batch = mdFiles.slice(i, i + 5);
                await Promise.all(batch.map(async (file) => {
                    try {
                        const res = await fetch(file.download_url);
                        if (!res.ok) return;
                        const text = await res.text();
                        
                        const hasIndexTag = /indexar:\s*true/.test(text.split('---')[1] || "");
                        if (!hasIndexTag) return; 

                        // --- DETECTOR DE PODCAST (NUEVO) ---
                        const podcastMatch = text.match(/!\[\[(.*?\.mp3)\]\]/);
                        let podcastUrl = null;
                        if (podcastMatch) {
                            podcastUrl = AUDIO_BASE_URL + encodeURIComponent(podcastMatch[1].trim());
                        }

                        // --- DETECTOR DE PORTADA ---
                        const coverMatch = text.match(/!\[\[(.*?)\]\]/);
                        let coverUrl = DEFAULT_COVER;
                        if (coverMatch) {
                            // Si el primer match es el mp3, buscamos otro para la imagen o usamos el default
                            let fileNameImg = coverMatch[1].split('|')[0].trim();
                            if (fileNameImg.toLowerCase().endsWith('.mp3')) {
                                // Buscamos un segundo match que no sea mp3
                                const allMatches = [...text.matchAll(/!\[\[(.*?)\]\]/g)];
                                const imgMatch = allMatches.find(m => !m[1].toLowerCase().endsWith('.mp3'));
                                if (imgMatch) fileNameImg = imgMatch[1].split('|')[0].trim();
                            }
                            
                            if (!fileNameImg.toLowerCase().endsWith('.mp3')) {
                                coverUrl = getOptimizedImageUrl(repo.adjuntos + encodeURIComponent(fileNameImg), 400); 
                            }
                        }

                        library.push({
                            id: btoa(file.path + repo.api), 
                            fileName: file.name,
                            title: file.name.replace('.md', '').replace(/_/g, ' '),
                            cover: coverUrl,
                            podcastUrl: podcastUrl, // Guardamos la URL del audio
                            chapters: parseMarkdown(text),
                            rawBase: repo.adjuntos,
                            repoIdx: REPOSITORIES.indexOf(repo)
                        });
                    } catch (e) { console.error("Error en archivo", e); }
                }));
            }
        }
        
        if (library.length > 0) {
            sessionStorage.setItem('nexus_library_cache', JSON.stringify(library));
        }

        if (statusText) statusText.innerText = "Sincronizado";
        document.getElementById('main-spinner')?.classList.add('hidden');
        
        renderLibrary();
        checkAutoLoad(); 

    } catch (e) { 
        if (statusText) {
            statusText.innerText = e.message === "API Rate Limit" ? "Límite GitHub excedido" : "Error API";
        }
        console.error("Error crítico:", e);
    }
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
			if (trimmed.startsWith('```media')) {
				inMediaBlock = true;
				continue;
			}
			if (inMediaBlock) {
				if (trimmed.startsWith('```')) inMediaBlock = false;
				continue;
			}
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
					if (subChunk.startsWith('> [!')) {
						let calloutBlock = subChunk;
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
	

	function renderShelf() {
		const shelf = document.getElementById('book-shelf');
		if (!shelf || !library.length) return;
		shelf.innerHTML = '';
		library.forEach((book, index) => {
			const bookNode = document.createElement('div');
			bookNode.className = 'shelf-book';
			bookNode.onclick = () => openReader(book.id);
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
	
	 // OCULTAR HEADER AL ENTRAR AL LECTOR
    const globalHeader = document.getElementById('nexus-header-global');
    if (globalHeader) globalHeader.classList.add('header-hidden');
    // --- INTEGRACIÓN PODCAST: Detener audio al entrar al lector ---
    if (typeof window.stopAndHidePodcast === 'function') {
        window.stopAndHidePodcast();
    }

    const book = library.find(b => b.id === id);
    if (!book) return;
    
    currentBook = book;
    
    // SOLUCIÓN AL POSICIONAMIENTO: Reiniciamos siempre a 0 al abrir un libro nuevo
    currentChapterIndex = 0;
    currentChunkIndex = 0;
    
    // Asegurar datos para el compartir
    if (currentBook.repoIdx === undefined) currentBook.repoIdx = 0;
    if (!currentBook.fileName) currentBook.fileName = currentBook.title + ".md";

    document.getElementById('reader-title').innerText = currentBook.title;
    const coverPreview = document.getElementById('sidebar-cover-preview');
    if (coverPreview) {
        coverPreview.style.backgroundImage = `url('${currentBook.cover}')`;
    }
    
    renderTOC();
    renderProgressMarkers();
    
    document.getElementById('library-container')?.classList.add('hidden');
    document.getElementById('reader-view').classList.remove('hidden');
    document.getElementById('resume-card')?.classList.add('hidden');
    
    // --- LÓGICA DE PREFERENCIAS (MEMORIA SEPARADA) ---
    const isMobile = window.innerWidth <= 768;
    const deviceSuffix = isMobile ? '-mobile' : '-desktop';

    // 1. Tamaño: Recuperar específico del dispositivo o usar default inteligente
    const savedSize = localStorage.getItem('reader-font-size' + deviceSuffix);
    const defFontSize = savedSize ? parseInt(savedSize) : (isMobile ? 23 : 25);
    document.documentElement.style.setProperty('--reader-font-size', defFontSize + 'px');
    document.getElementById('font-size-val').innerText = defFontSize;

    // 2. Fuente: Recuperar o usar default por dispositivo
    const savedFont = localStorage.getItem('reader-font-family' + deviceSuffix);
    const defFontName = savedFont || (isMobile ? 'Atkinson Hyperlegible' : 'Merriweather');
    document.documentElement.style.setProperty('--reader-font-family', defFontName);

    // 3. Alineación e Interlineado: Si no existen, el CSS :root ya tiene los suyos
    const savedAlign = localStorage.getItem('reader-text-align' + deviceSuffix);
    if (savedAlign) {
        document.documentElement.style.setProperty('--reader-text-align', savedAlign);
    }

    const savedHeight = localStorage.getItem('reader-line-height' + deviceSuffix);
    if (savedHeight) {
        document.documentElement.style.setProperty('--reader-line-height', savedHeight);
    }

    // Sincronizar marcas visuales (amarillo)
    syncVisualSettings();

    loadChapter(0);
}
function closeReader() { 
    // 1. LIMPIEZA DE PROCESOS ACTIVOS (Voz y Timers)
    // Detenemos cualquier audio de síntesis inmediatamente
    if (typeof stopSpeech === 'function') {
        stopSpeech(); 
    } else {
        window.speechSynthesis.cancel();
    }
    
    if (typeof clearImageTimer === 'function') clearImageTimer(); 

    // 2. RESET DE ESTADO INTERNO
    // Es vital resetear estos índices para que la próxima vez que se abra un libro 
    // (o el mismo) no intente renderizar desde una posición inválida.
    currentChunkIndex = 0;
    currentChapterIndex = 0;
    window.navDirection = 'next'; // Resetear dirección por defecto

    // 3. MANEJO DE NAVEGACIÓN SEGÚN EL MODO
    if (window.isLectorFijo) {
        // Si el lector es una página independiente, volvemos a la raíz
        window.location.href = "./"; 
    } else {
        // Ocultar Lector y Mostrar Biblioteca
        const readerView = document.getElementById('reader-view');
        const libraryContainer = document.getElementById('library-container');
        const globalHeader = document.getElementById('nexus-header-global');

        if (readerView) readerView.classList.add('hidden'); 
        if (libraryContainer) libraryContainer.classList.remove('hidden'); 

        // 4. RESTABLECER HEADER GLOBAL
        if (globalHeader) {
            globalHeader.classList.remove('header-hidden');
            globalHeader.style.transform = "translateY(0)";
            // Aseguramos que sea visible quitando estilos de opacidad si los hubiera
            globalHeader.style.opacity = "1";
        }

        // 5. RESET DE SCROLL Y UI
        // Volvemos arriba para que el usuario vea la biblioteca desde el inicio
        window.scrollTo({ top: 0, behavior: 'instant' });
        
        // lastScrollTop debe resetearse si usas lógica de ocultar header al hacer scroll
        if (typeof lastScrollTop !== 'undefined') lastScrollTop = 0;

        // Desbloqueamos el scroll del body por si acaso quedó bloqueado por el lector
        document.body.style.overflow = '';

        // 6. ACTUALIZACIÓN DE SESIÓN
        // Verificar sesión para mostrar la tarjeta de "Continuar leyendo"
        if (typeof checkLastSession === 'function') checkLastSession(); 
    }
    
    console.log("Lector cerrado y estados reseteados.");
}
	function loadChapter(idx) {
    if (idx < 0 || idx >= currentBook.chapters.length) return;

    // CAMBIO: Si ya es 'prev' (porque viene de prevChunk), no lo sobrescribas
    if (window.navDirection !== 'prev') {
        window.navDirection = 'next';
    }
    
    currentChapterIndex = idx;
    const chapter = currentBook.chapters[idx];
    document.getElementById('chapter-indicator').innerText = stripHtml(chapter.title);
    
    // IMPORTANTE: Esta línea debe estar aquí para que el texto exista
    chunks = chapter.content; 
    
    currentChunkIndex = 0;
    document.querySelectorAll('.toc-item').forEach(el => el.classList.remove('active'));
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
	 

function renderChunk() {
    clearImageTimer();
    const content = document.getElementById('book-content');
    if (!content) return;

    // 1. LIMPIEZA TOTAL DE CLASES
    content.classList.remove('slide-in-right', 'slide-in-left', 'desktop-fade');

    let rawText = chunks[currentChunkIndex] || "";
    
    if (rawText.trim() === ">") { 
        if (window.navDirection === 'prev') prevChunk(); 
        else nextChunk(); 
        return; 
    }

    let finalHtml = "";
    let isImage = false;
    const embedMatch = rawText.match(/!\[\[(.*?)\]\]/);

    if (embedMatch) {
        // ... (Tu lógica existente de multimedia e imágenes se mantiene igual) ...
        const fileName = embedMatch[1].split('|')[0].trim().toLowerCase();
        const isAudio = fileName.endsWith('.m4a') || fileName.endsWith('.mp3') || fileName.endsWith('.wav') || fileName.endsWith('.ogg');
        const isVideo = fileName.endsWith('.mp4') || fileName.endsWith('.mov') || fileName.endsWith('.webm') || fileName.endsWith('.mkv');
        if (isAudio || isVideo) { if (window.navDirection === 'prev') prevChunk(); else nextChunk(); return; }
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

    // 2. INSERCIÓN DE CONTENIDO
    content.innerHTML = finalHtml;

    // 3. DISPARAR ANIMACIÓN SEGÚN DISPOSITIVO
    void content.offsetWidth; // Forzar reflow

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // Efecto Barrido Lateral para Móvil
        if (window.navDirection === 'next') content.classList.add('slide-in-right');
        else if (window.navDirection === 'prev') content.classList.add('slide-in-left');
    } else {
        // Efecto "Emerger y Difuminar" para Escritorio
        content.classList.add('desktop-fade');
    }

    // 4. FINALIZACIÓN
    document.getElementById('reading-container-fixed').scrollTop = 0;
    updateProgress();
    saveProgress();

    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
        nextBtn.innerHTML = (currentChunkIndex === chunks.length - 1 && currentChapterIndex === currentBook.chapters.length - 1) ? "FIN" : "NEXT ▶";
    }

    if (isSpeaking) { 
        if (isImage) startImageTimer(); 
        else prepareAndStartSpeech(); 
    }
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

	function nextChunk() { 
		window.navDirection = 'next'; 
		clearImageTimer(); 
		if (isSpeaking && isPaused) { synth.resume(); isPaused = false; updatePauseUI(false); }
		if (isSpeaking) synth.cancel(); 

		if (currentChunkIndex < chunks.length - 1) { currentChunkIndex++; renderChunk(); }
								 
						   
		else if (currentChapterIndex < currentBook.chapters.length - 1) { loadChapter(currentChapterIndex + 1); } 
												  
		  
        }


function prevChunk() { 
    window.navDirection = 'prev'; // Seteamos dirección atrás
    
    // --- NUEVA LÓGICA DE RETORNO AL INICIO ---
    if (currentChunkIndex === 0 && currentChapterIndex === 0) {
        console.log("Inicio alcanzado: Retornando a la biblioteca.");
        
        // Detenemos cualquier audio antes de salir
        if (typeof stopSpeech === 'function') {
            stopSpeech(); 
        } else {
            window.speechSynthesis.cancel();
        }

        // Cerramos el lector (Asegúrate de tener esta función definida)
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
    
    if (isSpeaking && isPaused) { 
        synth.resume(); 
        isPaused = false; 
        updatePauseUI(false); 
    }
    if (isSpeaking) synth.cancel(); 

    if (currentChunkIndex > 0) { 
        currentChunkIndex--; 
        renderChunk(); 
    } else if (currentChapterIndex > 0) { 
        // Retrocedemos el índice del capítulo
        currentChapterIndex--; 
        
        // Cargamos los datos del nuevo capítulo
        const chapter = currentBook.chapters[currentChapterIndex];
        chunks = chapter.content; 
        currentChunkIndex = chunks.length - 1; // Vamos al final del capítulo anterior
        
        // Actualizamos la interfaz
        const indicator = document.getElementById('chapter-indicator');
        if (indicator) indicator.innerText = stripHtml(chapter.title);
        
        document.querySelectorAll('.toc-item').forEach(el => el.classList.remove('active'));
        const activeItem = document.getElementById(`toc-item-${currentChapterIndex}`);
        if (activeItem) activeItem.classList.add('active');

        // Renderizamos (usará la dirección 'prev')
        renderChunk(); 
    } 
}


    


// --- LÓGICA DE SWIPE PARA MÓVIL ---
let touchstartX = 0;
let touchendX = 0;

function initTouchEvents() {
    const readerZone = document.getElementById('reading-container-fixed');
    if (!readerZone) return;

    readerZone.addEventListener('touchstart', e => {
        touchstartX = e.changedTouches[0].screenX;
    }, {passive: true});

    readerZone.addEventListener('touchend', e => {
        touchendX = e.changedTouches[0].screenX;
        handleSwipeGesture();
    }, {passive: true});
}

function handleSwipeGesture() {
    const swipeThreshold = 60; // Sensibilidad
    
    // Deslizar a la izquierda -> Siguiente
    if (touchstartX - touchendX > swipeThreshold) {
        if (typeof nextChunk === 'function') nextChunk();
    }
    
    // Deslizar a la derecha -> Atrás (Ahora incluye retorno a biblioteca)
    if (touchendX - touchstartX > swipeThreshold) {
        prevChunk();
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', initTouchEvents);
     
	 
function checkAutoLoad() {
    const params = getUrlParams();
    if (params.repo !== null && params.book) {
        const repoIdx = parseInt(params.repo);
        // Buscamos el libro en la librería cargada
        const book = library.find(b => b.fileName === params.book && b.repoIdx === repoIdx);
        if (book) {
            // Abrimos el lector
            openReader(book.id);
            // Si la URL traía capítulo o fragmento específico, los aplicamos después de abrir
            if (params.ch > 0) loadChapter(params.ch);
            if (params.ck > 0) {
                currentChunkIndex = params.ck;
                renderChunk();
            }
        }
    }
}
// --- LÓGICA DE NAVEGACIÓN GLOBAL (HEADER + PODCAST) ---
(function() {
    let lastScrollTop = 0;

    // Usamos 'true' para capturar scroll incluso en contenedores internos
    document.addEventListener('scroll', function(e) {
        const header = document.getElementById('nexus-header-global');
        const podcast = document.getElementById('podcast-player-container');
        const readerView = document.getElementById('reader-view');

        // 1. Si el lector está abierto o no hay header, no hacemos nada
        if (readerView && !readerView.classList.contains('hidden')) return;
        if (!header) return;

        // 2. Obtención robusta del valor de scroll
        let st = window.pageYOffset || document.documentElement.scrollTop;
        if (st === 0 && e.target.scrollTop) {
            st = e.target.scrollTop;
        }

        // 3. Umbral de seguridad
        if (Math.abs(lastScrollTop - st) <= 5) return;

        // 4. Lógica de movimiento sincronizado
        if (st > lastScrollTop && st > 100) {
            // --- BAJANDO: Ocultar elementos ---
            header.classList.add('header-hidden');
            
            // Sincronizar Podcast en Mobile
            if (podcast && window.innerWidth <= 768) {
                podcast.classList.add('header-hidden-state');
            }
        } else {
            // --- SUBIENDO: Mostrar elementos ---
            header.classList.remove('header-hidden');
            
            // Sincronizar Podcast en Mobile
            if (podcast && window.innerWidth <= 768) {
                podcast.classList.remove('header-hidden-state');
            }
        }

        lastScrollTop = st <= 0 ? 0 : st;
    }, true); 
})();