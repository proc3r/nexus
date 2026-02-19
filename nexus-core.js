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



	

// --- 2. FUNCIONES DE CONTROL DE INTERFAZ (MOVER AQUÍ ARRIBA) ---

function renderLibrary() {
    const grid = document.getElementById('library-grid');
    if (window.isLectorFijo || !grid) return;
	
	

    // Si la librería está vacía, esperamos un poco y reintentamos (por si el fetch de GitHub es lento)
    if (library.length === 0) {
        console.warn("Nexus Core: Librería vacía, reintentando render en 500ms...");
        setTimeout(renderLibrary, 500);
        return;
    }

    console.log("Renderizando librería...");
    grid.innerHTML = ''; 

    library.forEach(book => {
        // Buscamos la función en window por si se cargó en otro script
        const createFn = window.createBookCard || createBookCard;
        
        if (typeof createFn === 'function') {
            const card = createFn(book);
            grid.appendChild(card);
        } else {
            console.error("Nexus Core: No se encuentra la función createBookCard.");
        }
    });

    // ... resto del código (quitar spinners y splash) ...
    document.getElementById('main-spinner')?.classList.add('hidden');
    const splash = document.getElementById('nexus-splash') || document.getElementById('auto-loader');
    if (splash) {
        splash.style.opacity = "0";
        setTimeout(() => { splash.style.display = "none"; }, 800);
    }
}

// --- CAPTURA INMEDIATA DE TÍTULO PARA EL SPINNER ---
(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const bookName = urlParams.get('book');
    const loaderTitle = document.getElementById('loader-book-title');
    
    // Solo actuamos si existe el elemento dinámico (estamos en el lector)
    if (loaderTitle) {
        if (bookName) {
            loaderTitle.innerText = bookName.replace('.md', '').replace(/_/g, ' ').toUpperCase();
        } else {
            // Si el lector abre el libro por defecto
            loaderTitle.innerText = "MODELO NOUMÉNICO";
        }
    }
})();


// --- 3. LÓGICA DE CARGA (FETCHBOOKS) ---
// Aquí pegas tu función fetchBooks tal cual la definimos en el paso anterior


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
    
    setTimeout(() => { window.scrollTo(0, 1); }, 300);
	};



async function loadDirectBook(params) {
    currentBook = null; 
    const statusText = document.getElementById('status-text');
    let repoIndex = (params.repo !== null && !isNaN(params.repo)) ? parseInt(params.repo) : 0;
    let fileName = params.book ? decodeURIComponent(params.book) : "Modelo Nouménico.md";
    const repo = REPOSITORIES[repoIndex] || REPOSITORIES[0];
    const fileUrl = repo.raw + encodeURIComponent(fileName);

    try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`Error 404`);
        const text = await response.text();
        
        // Lógica de Portada Original
        const coverMatch = text.match(/!\[\[(.*?)\]\]/);
        let coverUrl = DEFAULT_COVER;
        if (coverMatch) {
            let fileNameImg = coverMatch[1].split('|')[0].trim();
            let rawCoverUrl = repo.adjuntos + encodeURIComponent(fileNameImg);
            coverUrl = (typeof getOptimizedImageUrl === 'function') ? getOptimizedImageUrl(rawCoverUrl, 400) : rawCoverUrl;
        }

        const parsedChapters = parseMarkdown(text);

        // ASIGNACIÓN DE DATOS (Aquí definimos el título real)
        currentBook = {
            id: 'direct-load',
            fileName: fileName,
            title: fileName.replace('.md', '').replace(/_/g, ' ').replace(/[^\w\s\u0370-\u03FFáéíóúÁÉÍÓÚñÑ\+]/g, ''),
            cover: coverUrl,
            chapters: parsedChapters,
            rawBase: repo.adjuntos,
            repoIdx: repoIndex,
            soundtrack: parsedChapters.soundtrackId
        };

        // UI ORIGINAL
        document.getElementById('reader-title').innerText = currentBook.title;
        const coverPreview = document.getElementById('sidebar-cover-preview');
        if (coverPreview) coverPreview.style.backgroundImage = `url('${currentBook.cover}')`;

        // Control de contenedores original
        document.getElementById('library-container')?.classList.add('hidden');
        document.getElementById('reader-view').classList.remove('hidden');

        // CARGA DE CONTENIDO ORIGINAL
        await loadChapter(params.ch || 0);
        currentChunkIndex = params.ck || 0;
        await renderChunk();
        
        renderTOC();
        renderProgressMarkers();

        // GUARDADO DE SEGURIDAD
        // Ahora que el libro está cargado con nombre real, guardamos la sesión limpia
        saveProgress();

        if (statusText) statusText.innerText = "Sincronizado";
        document.getElementById('main-spinner')?.classList.add('hidden');
        document.getElementById('auto-loader')?.classList.add('hidden');

        // SOUNDTRACK ORIGINAL
        if (currentBook && currentBook.soundtrack) {
            if (typeof refrescarValorAleatorio === 'function') refrescarValorAleatorio();
            setTimeout(() => {
                if (typeof updateSoundtrack === 'function') updateSoundtrack(currentBook.soundtrack);
                else if (typeof initPlayer === 'function') initPlayer();
            }, 300); 
        }

    } catch (e) {
        console.error("Error de carga:", e);
    }
}





function stripHtml(html) {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}
	





async function fetchBooks() {
    const statusText = document.getElementById('status-text');
    
    const ocultarSplash = () => {
        setTimeout(() => {
            const splash = document.getElementById('nexus-splash');
            if (splash) {
                splash.style.opacity = "0";
                setTimeout(() => { splash.style.display = "none"; }, 800);
            }
        }, 500);
    };

    const cachedLibrary = sessionStorage.getItem('nexus_library_cache');
    if (cachedLibrary) {
        library = JSON.parse(cachedLibrary);
        if (statusText) statusText.innerText = "Ok (Cache)";
        document.getElementById('main-spinner')?.classList.add('hidden');
        renderLibrary();
        checkAutoLoad(); 
        ocultarSplash();
        return; 
    }

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
                        
                        // Extraer Frontmatter
                        const sections = text.split('---');
                        const frontmatter = sections[1] || "";
                        const hasIndexTag = /indexar:\s*true/.test(frontmatter);
                        if (!hasIndexTag) return; 

                        // --- DETECTOR DE SOUNDTRACK ---
                        const soundtrackMatch = frontmatter.match(/soundtrack:\s*([a-zA-Z0-9_-]{11})/);
                        const soundtrackId = soundtrackMatch ? soundtrackMatch[1] : null;

                        // --- DETECTOR DE PODCAST ---
                        const podcastMatch = text.match(/!\[\[(.*?\.mp3)\]\]/);
                        let podcastUrl = null;
                        if (podcastMatch) {
                            podcastUrl = AUDIO_BASE_URL + encodeURIComponent(podcastMatch[1].trim());
                        }

                        // --- DETECTOR DE PORTADA ---
                        const coverMatch = text.match(/!\[\[(.*?)\]\]/);
                        let coverUrl = DEFAULT_COVER;
                        if (coverMatch) {
                            let fileNameImg = coverMatch[1].split('|')[0].trim();
                            if (fileNameImg.toLowerCase().endsWith('.mp3')) {
                                const allMatches = [...text.matchAll(/!\[\[(.*?)\]\]/g)];
                                const imgMatch = allMatches.find(m => !m[1].toLowerCase().endsWith('.mp3'));
                                if (imgMatch) fileNameImg = imgMatch[1].split('|')[0].trim();
                            }
                            
                            if (!fileNameImg.toLowerCase().endsWith('.mp3')) {
                                // Usamos encodeURIComponent para que las imágenes con nombres griegos funcionen
                                coverUrl = getOptimizedImageUrl(repo.adjuntos + encodeURIComponent(fileNameImg), 400); 
                            }
                        }

                        const chapters = parseMarkdown(text);

                        // --- CAMBIO CLAVE: ID COMPATIBLE CON UNICODE ---
                        // btoa no soporta caracteres griegos directamente, usamos esta alternativa:
                        const safeId = btoa(unescape(encodeURIComponent(file.path + repo.api)));

                        library.push({
                            id: safeId, 
                            fileName: file.name,
                            // Mantenemos el Regex que admite letras griegas
                            title: file.name.replace('.md', '').replace(/_/g, ' ').replace(/[^\w\s\u0370-\u03FFáéíóúÁÉÍÓÚñÑ\+]/g, ''),
                            cover: coverUrl,
                            podcastUrl: podcastUrl,
                            soundtrack: soundtrackId,
                            chapters: chapters,
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
        ocultarSplash();

    } catch (e) { 
        if (statusText) {
            statusText.innerText = e.message === "API Rate Limit" ? "Límite GitHub excedido" : "Error API";
        }
        console.error("Error crítico:", e);
        ocultarSplash();
    }
}




function parseMarkdown(text) {
		const lines = text.split('\n');
		const chapters = [];
		let currentChapter = null;
		let inFrontmatter = false;
		let startLine = 0;
		let inMediaBlock = false; 																	  
																								
		// --- LÓGICA DE SOUNDTRACK (LIMPIEZA AGRESIVA) ---
		let soundtrackId = null;
		if (lines.length > 0 && lines[0].trim() === "---") {
			inFrontmatter = true;
			for (let i = 1; i < lines.length; i++) {
				const line = lines[i].trim();
				if (line.toLowerCase().startsWith('soundtrack:')) {
					// Limpiamos comillas, espacios y caracteres especiales del ID
					soundtrackId = line.split(':')[1].replace(/['"\r\s]/g, '').trim();
				}
				if (line === "---") { inFrontmatter = false; startLine = i + 1; break; }
			}
		}
		// ------------------------------------------------

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
							i++; 
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
		
		chapters.soundtrackId = soundtrackId;
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
	
	

async function openReader(id, forceCh = null, forceCk = null) {
    // --- 1. CONFIGURACIÓN DE INTERFAZ ---
   /* if (typeof launchFullScreen === 'function') {
        launchFullScreen(document.documentElement);
    }*/
    
    const globalHeader = document.getElementById('nexus-header-global');
    if (globalHeader) {
        globalHeader.classList.add('header-hidden');
        globalHeader.style.opacity = "0";
        globalHeader.style.pointerEvents = "none"; 
    }
    
    if (typeof closePodcast === 'function') {
        closePodcast(); 
    }

    const book = library.find(b => b.id === id);
    if (!book) return;
    
    currentBook = book;
    
    if (currentBook.repoIdx === undefined) currentBook.repoIdx = 0;
    if (!currentBook.fileName) currentBook.fileName = currentBook.title + ".md";

    // --- 2. LÓGICA DE POSICIONAMIENTO HÍBRIDA ---
    let targetChapter = 0;
    let targetChunk = 0;
    let hasSavedProgress = false; 
    let savedData = null;

    if (forceCh !== null && forceCh !== undefined) {
        console.log("Nexus: Prioridad URL detectada (Link compartido o Lector Fijo)");
        targetChapter = parseInt(forceCh);
        targetChunk = parseInt(forceCk) || 0;
    } 
    else {
        const history = JSON.parse(localStorage.getItem('nexus_reading_history') || '{}');
        const saved = history[currentBook.fileName];

        if (saved) {
            console.log("Nexus: Posición recuperada de memoria para " + currentBook.fileName, saved);
            targetChapter = saved.chapterIndex;
            targetChunk = saved.chunk;
            savedData = saved;
            
            if (targetChapter > 0 || targetChunk > 0) {
                hasSavedProgress = true;
            }
        } else {
            console.log("Nexus: Sin historial previo, iniciando en 0");
            targetChapter = 0;
            targetChunk = 0;
        }
    }

    currentChapterIndex = targetChapter;
    currentChunkIndex = targetChunk;

    // --- 3. RENDERIZADO DE INTERFAZ ---
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
    
    // --- 4. PREFERENCIAS VISUALES (RESTAURADAS COMPLETAS) ---
    const isMobile = window.innerWidth <= 768;
    const deviceSuffix = isMobile ? '-mobile' : '-desktop';

    const savedSize = localStorage.getItem('reader-font-size' + deviceSuffix);
    const defFontSize = savedSize ? parseInt(savedSize) : (isMobile ? 23 : 25);
    document.documentElement.style.setProperty('--reader-font-size', defFontSize + 'px');
    document.getElementById('font-size-val').innerText = defFontSize;

    const savedFont = localStorage.getItem('reader-font-family' + deviceSuffix);
    const defFontName = savedFont || (isMobile ? 'Atkinson Hyperlegible' : 'Merriweather');
    document.documentElement.style.setProperty('--reader-font-family', defFontName);

    const savedAlign = localStorage.getItem('reader-text-align' + deviceSuffix);
    if (savedAlign) document.documentElement.style.setProperty('--reader-text-align', savedAlign);

    const savedHeight = localStorage.getItem('reader-line-height' + deviceSuffix);
    if (savedHeight) document.documentElement.style.setProperty('--reader-line-height', savedHeight);

    syncVisualSettings();

    // --- 5. CARGA DE CONTENIDO Y ACTUALIZACIÓN DE DATOS ---
    await loadChapter(currentChapterIndex, currentChunkIndex);
    
    // IMPORTANTE: Llamamos a tus funciones de nexus-function.js para procesar los datos reales
    if (typeof updateProgress === 'function') {
        updateProgress(); 
    }

    // --- 6. MOSTRAR/INYECTAR MODAL CON DATOS SINCRONIZADOS ---
// --- 6. MOSTRAR/INYECTAR MODAL CON DATOS SINCRONIZADOS ---
    if (hasSavedProgress) {
        setTimeout(() => {
            const progPercentText = document.getElementById('progress-percent')?.innerText || "0%";
            const timeLeft = document.getElementById('time-remaining')?.innerText || "-- min";
            const currentCap = document.getElementById('reader-chapter-indicator')?.innerText || savedData?.chapterTitle || "Capítulo actual";

            let modal = document.getElementById('nx-resume-modal');

            if (!modal) {
                const modalHTML = `
                    <div id="nx-resume-modal" class="nx-resume-overlay">
                        <div class="nx-resume-card">
                            <div class="nx-resume-bg-layer"></div>
                            <div class="nx-resume-content">
                                <div class="nx-resume-header">
                                    <h2 class="nx-resume-book-title">${currentBook.title}</h2>
                                    <p class="nx-resume-chapter-name">${currentCap}</p>
                                </div>
                                <div class="nx-resume-progress-track">
                                    <div id="nx-resume-bar-fill" class="nx-resume-progress-fill" style="width: ${progPercentText};"></div>
                                </div>
                                <div class="nx-resume-stats-row">
                                    <span><b style="color:#fff;">${progPercentText}</b> completado</span>
                                    <span>${timeLeft}</span>
                                </div>
                                <div class="nx-resume-actions">
                                    <div class="nx-resume-grid-alt">
                                        <button onclick="confirmResume('restart')" class="nx-resume-btn-minimal">Comenzar desde cero</button>
                                        <button onclick="confirmResume('section')" class="nx-resume-btn-sub">Reiniciar sección</button>
                                        <button onclick="confirmResume('continue')" class="nx-resume-btn-main">Continuar leyendo</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>`;
                document.body.insertAdjacentHTML('beforeend', modalHTML);
                
                // Vinculación de teclado (Limpiamos el anterior por si acaso)
                document.removeEventListener('keydown', handleNxResumeKeys, true);
                document.addEventListener('keydown', handleNxResumeKeys, true);

                // Foco inicial en "Continuar" (Main) para comodidad del usuario
                const mainBtn = document.querySelector('.nx-resume-btn-main');
                if (mainBtn) mainBtn.focus();

            } else {
                // Si el modal ya existe (re-entrada rápida), actualizamos sus datos
                modal.style.display = 'flex';
                modal.style.opacity = '1';
                const bar = document.getElementById('nx-resume-bar-fill');
                if (bar) bar.style.width = progPercentText;
                
                // Re-activar teclado y foco
                document.removeEventListener('keydown', handleNxResumeKeys, true);
                document.addEventListener('keydown', handleNxResumeKeys, true);
                const mainBtn = document.querySelector('.nx-resume-btn-main');
                if (mainBtn) mainBtn.focus();
            }
        }, 300); 
    }

    // --- 7. INTEGRACIÓN SOUNDTRACK ---
    setTimeout(() => {
        if (typeof updateSoundtrack === 'function') {
            updateSoundtrack(currentBook.soundtrack);
        }
    }, 300);
} // Aquí termina openReader

function closeNxResume() {
    const modal = document.getElementById('nx-resume-modal');
    if (modal) {
        modal.style.opacity = '0';
        document.removeEventListener('keydown', handleNxResumeKeys, true);
        setTimeout(() => {
            if (modal.parentNode) modal.remove();
            window.pendingProgress = null;
        }, 300);
    }
}

function handleNxResumeKeys(e) {
    const modal = document.getElementById('nx-resume-modal');
    if (!modal) {
        document.removeEventListener('keydown', handleNxResumeKeys, true);
        return;
    }

    const keysToBlock = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter', 'Escape'];
    if (keysToBlock.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
    }

    if (e.key === 'Escape') {
        closeNxResume();
        return;
    }

    // Orden visual forzado: Cero (arriba), Sección (medio), Continuar (abajo)
    const btnCero = modal.querySelector('.nx-resume-btn-minimal');
    const btnSeccion = modal.querySelector('.nx-resume-btn-sub');
    const btnContinuar = modal.querySelector('.nx-resume-btn-main');

    const buttons = [btnCero, btnSeccion, btnContinuar].filter(b => b !== null);
    let currentIndex = buttons.indexOf(document.activeElement);

    if (currentIndex === -1) {
        buttons[0].focus();
        return;
    }

    if (e.key === 'ArrowDown' && currentIndex < buttons.length - 1) {
        buttons[currentIndex + 1].focus();
    } 
    else if (e.key === 'ArrowUp' && currentIndex > 0) {
        buttons[currentIndex - 1].focus();
    } 
    else if (e.key === 'Enter' || e.key === ' ') {
        buttons[currentIndex].click();
    }
}



function closeReader() { 

// NUEVO: Refrescar el valor aleatorio global para la próxima carga
    if (typeof refrescarValorAleatorio === 'function') {
        refrescarValorAleatorio();
    }
    // 1. LIMPIEZA DE PROCESOS ACTIVOS (Voz, Timers y Música)
    // Detenemos cualquier audio de síntesis inmediatamente
    if (typeof stopSpeech === 'function') {
        stopSpeech(); 
    } else {
        window.speechSynthesis.cancel();
    }
    
    if (typeof clearImageTimer === 'function') clearImageTimer(); 

    // --- INTEGRACIÓN SOUNDTRACK: Detener música al salir ---
    if (typeof player !== 'undefined' && player && typeof player.pauseVideo === 'function') {
        player.pauseVideo();
        isMusicPlaying = false;
        
        // Reset visual de los controles de música
        const musicIcon = document.getElementById('music-icon');
        const musicBtn = document.getElementById('btn-music-main');
        const statusText = document.getElementById('music-status-text');
        const volBtn = document.getElementById('btn-volume-yt'); // Agregado para quitar el beat

        if (musicIcon) musicIcon.innerText = "play_arrow";
        if (musicBtn) musicBtn.style.background = "#08f0fb7a"; // Color inactivo
        if (statusText) statusText.innerText = "Ambiente listo";
        if (volBtn) volBtn.classList.remove('music-playing-beat');

        // IMPORTANTE: Cargamos el soundtrack por defecto en modo "espera" (silencio)
        if (typeof updateSoundtrack === 'function') {
    updateSoundtrack(null, false); // El 'false' apaga el auto-play
	
        }
    }

    // 2. RESET DE ESTADO INTERNO
    currentChunkIndex = 0;
    currentChapterIndex = 0;
    window.navDirection = 'next'; 

    // 3. MANEJO DE NAVEGACIÓN SEGÚN EL MODO
    if (window.isLectorFijo) {
        window.location.href = "./"; 
    } else {
        const readerView = document.getElementById('reader-view');
        const libraryContainer = document.getElementById('library-container');
        const globalHeader = document.getElementById('nexus-header-global');

        if (readerView) readerView.classList.add('hidden'); 
        if (libraryContainer) libraryContainer.classList.remove('hidden'); 

        // 4. RESTABLECER HEADER GLOBAL
        if (globalHeader) {
            globalHeader.classList.remove('header-hidden');
            globalHeader.style.transform = "translateY(0)";
            globalHeader.style.opacity = "1";
        }

        // 5. RESET DE SCROLL Y UI
        window.scrollTo({ top: 0, behavior: 'instant' });
        if (typeof lastScrollTop !== 'undefined') lastScrollTop = 0;
        document.body.style.overflow = '';

        // 6. ACTUALIZACIÓN DE SESIÓN
        if (typeof checkLastSession === 'function') checkLastSession(); 
    }
    
    console.log("Lector cerrado, música en espera y estados reseteados.");
}



function loadChapter(idx, chunkToLoad = 0) {
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
    
    // AJUSTE: Usamos el chunk solicitado (por defecto 0 si es una carga normal)
    currentChunkIndex = chunkToLoad;

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
	 

async function renderChunk() {
    clearImageTimer();
    // Limpieza de barra visual para que no se duplique en el nuevo párrafo
    if (typeof stopVisualTimer === 'function') stopVisualTimer();

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
        const originalFileName = embedMatch[1].split('|')[0].trim();
        const fileNameLower = originalFileName.toLowerCase();
        
        const isAudio = fileNameLower.endsWith('.m4a') || fileNameLower.endsWith('.mp3') || fileNameLower.endsWith('.wav') || fileNameLower.endsWith('.ogg');
        const isVideo = fileNameLower.endsWith('.mp4') || fileNameLower.endsWith('.mov') || fileNameLower.endsWith('.webm') || fileNameLower.endsWith('.mkv');
        
        if (isAudio || isVideo) { 
            if (window.navDirection === 'prev') return prevChunk(); 
            else return nextChunk(); 
        }
        
        isImage = true;
        const rawImageUrl = currentBook.rawBase + encodeURIComponent(originalFileName);
        
        const finalImageUrl = fileNameLower.endsWith('.gif') 
            ? rawImageUrl 
            : (typeof getOptimizedImageUrl === 'function' ? getOptimizedImageUrl(rawImageUrl, 700) : rawImageUrl);

        finalHtml = `<div class="reader-image-container">
            <img src="${finalImageUrl}" 
                 class="reader-image cursor-zoom-in" 
                 alt="${originalFileName}" 
                 onclick="openImageModal('${rawImageUrl}', '${originalFileName}')">
            <p class="reader-text">Click para ampliar</p>
        </div>`;
    } else if (rawText.trim().startsWith('#')) {
        finalHtml = `<div class="reader-section-title">${cleanMarkdown(rawText.replace(/^#+\s+/, '').trim())}</div>`;
    } else if (rawText.trim().startsWith('>')) {
        let lines = rawText.split('\n');
        
        // Creamos un separador que es un "div" invisible con un salto de línea.
        // Esto garantiza que el TTS haga una pausa sin pronunciar "punto".
        const ttsPause = '<div style="display:none;">\n</div>';
        
        // El separador visual sigue siendo tu span con borde punteado
        const visualSeparator = '<span style="display: block; opacity: 70%; border-bottom: 2px dotted; margin-bottom: 10px;"></span>';

        let processedLines = lines.map(l => {
            // Limpiamos el markdown de la línea de forma segura
            return cleanMarkdown(l.trim().replace(/^>\s?/, ''));
        }).join(ttsPause + visualSeparator);
        
        finalHtml = `<div class="custom-blockquote">${processFormatting(processedLines)}</div>`;
    } else {
        finalHtml = processFormatting(cleanMarkdown(rawText));
    }

    // 4. INSERCIÓN DE CONTENIDO
    content.innerHTML = finalHtml;

    // --- MEJORA DEL ANCLA DE VALIDACIÓN ---
    if (isTranslated) {
        const validator = document.createElement('div');
        validator.id = 'nexus-validation-anchor';
        validator.style.cssText = "height:1px; font-size:1px; color:transparent; position:absolute; pointer-events:none; overflow:hidden;";
        validator.innerHTML = '<span id="nexus-language-marker">manzana</span>';
        content.appendChild(validator);
        
        setTimeout(() => {
            content.dispatchEvent(new Event('input', { bubbles: true }));
            content.dispatchEvent(new Event('change', { bubbles: true }));
            const trigger = document.createElement('span');
            trigger.innerHTML = "&nbsp;";
            content.appendChild(trigger);
            setTimeout(() => trigger.remove(), 10);
        }, 50);
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

    // 7. SINCRONIZACIÓN DE VOZ / MODO VISUAL (Nexus Voice)
    if (window.isSpeaking) { 
        if (isImage) {
            startImageTimer();
        } else {
            // --- NUEVA LÓGICA DE SALTO HÍBRIDO ---
            if (window.hasAvailableVoice === false) {
                // Si no hay voz, lanzamos la barra directamente al renderizar el nuevo párrafo
                console.log("Nexus Vocal: Iniciando barra visual en nuevo párrafo.");
                setTimeout(() => {
                    if (typeof showVisualTimer === 'function' && typeof calculateReadingTime === 'function') {
                        const text = content.innerText || "";
                        showVisualTimer(calculateReadingTime(text));
                    }
                }, 300);
            } else {
                // Si hay voz, esperamos la validación de Google normal
                setTimeout(() => {
                    prepareAndStartSpeech();
                }, 250);
            }
        } 
    }
    
    return Promise.resolve();
}




/**
 * Divide el texto en partes manejables para el motor de síntesis de voz
 */

function splitTextSmartly(text, limit) {
    const result = [];
    // Aseguramos que el texto tenga una pausa mínima si detectamos 
    // que falta espacio después de puntos (común en concatenaciones de callouts)
    let cleanedText = text.replace(/([\.!\?])([A-ZÁÉÍÓÚ])/g, '$1 $2'); 

    let remaining = cleanedText;
    
    while (remaining.length > 0) {
        if (remaining.length <= limit) { 
            result.push(remaining.trim()); 
            break; 
        }
        
        let slice = remaining.substring(0, limit);
        
        // Buscamos puntos, exclamaciones o interrogaciones para dar prioridad a pausas largas
        let lastBreak = Math.max(
            slice.lastIndexOf('.'), 
            slice.lastIndexOf('!'), 
            slice.lastIndexOf('?'),
            slice.lastIndexOf(';'),
            slice.lastIndexOf(',')
        );

        // Si no hay puntuación clara, buscamos el último espacio
        if (lastBreak === -1) lastBreak = slice.lastIndexOf(' ');
        
        // Si no hay espacios ni puntuación, cortamos al límite
        if (lastBreak === -1) lastBreak = limit;

        result.push(remaining.substring(0, lastBreak + 1).trim());
        remaining = remaining.substring(lastBreak + 1).trim();
    }
    return result.filter(s => s.length > 0);
}

	
async function nextChunk() { 
    window.navDirection = 'next'; 
    if (typeof clearImageTimer === 'function') clearImageTimer(); 
    
    // Si el usuario está en modo lectura, limpiamos el audio actual
    if (window.isSpeaking) {
        window.synth.cancel();
        if (window.nexusSpeechTimeout) clearTimeout(window.nexusSpeechTimeout);
        window.isPaused = false; 
        updatePauseUI(false);
    }

    if (currentChunkIndex < chunks.length - 1) { 
        currentChunkIndex++; 
        
        // --- GUARDADO DE PROGRESO ---
        if (typeof saveProgress === 'function') saveProgress();
        
        // Renderizamos el contenido
        await renderChunk(); 
        
        // --- DECISIÓN INTELIGENTE ---
        if (window.isSpeaking) {
            const currentText = chunks[currentChunkIndex] || "";
            const isImage = currentText.match(/!\[\[(.*?)\]\]/);

            if (isImage) {
                if (typeof startImageTimer === 'function') startImageTimer();
            } else {
                prepareAndStartSpeech();
            }
        }
    }
    else if (currentChapterIndex < currentBook.chapters.length - 1) { 
        // Si saltamos de capítulo
        currentChapterIndex++;
        currentChunkIndex = 0; // Empezamos al inicio del nuevo cap
        
        await loadChapter(currentChapterIndex);
        
        // Guardamos que ya estamos en el nuevo capítulo
        if (typeof saveProgress === 'function') saveProgress();
        
        await renderChunk();
        
        // Si venía leyendo, iniciamos la lectura del nuevo capítulo
        if (window.isSpeaking) {
            prepareAndStartSpeech();
        }
    } 
}


async function prevChunk() { 
    // --- 1. FRENO DE EMERGENCIA INMEDIATO (Para navegación rápida) ---
    window.synth.cancel(); 
    if (window.nexusSpeechTimeout) clearTimeout(window.nexusSpeechTimeout);
    if (typeof clearImageTimer === 'function') clearImageTimer(); 
    
    window.navDirection = 'prev'; // Seteamos dirección atrás
    
    // --- 2. LÓGICA DE RETORNO AL INICIO (MANTENIDA ÍNTEGRA) ---
    if (currentChunkIndex === 0 && currentChapterIndex === 0) {
        console.log("Inicio alcanzado: Retornando a la biblioteca.");
        
        if (typeof stopSpeech === 'function') {
            stopSpeech(); 
        } else {
            window.speechSynthesis.cancel();
        }

        if (typeof closeReader === 'function') {
            closeReader();
        } else {
            document.getElementById('reader-view').classList.add('hidden');
            document.getElementById('library-container').classList.remove('hidden');
            document.body.style.overflow = ''; 
        }
        return; 
    }

    // --- 3. CAPTURA DE ESTADO Y LIMPIEZA DE ÍNDICES ---
    const wasSpeaking = window.isSpeaking;
    window.currentSubChunkIndex = 0; 
    window.speechSubChunks = [];

    if (window.isSpeaking && window.isPaused) { 
        window.isPaused = false; 
        updatePauseUI(false); 
    }

    // --- 4. NAVEGACIÓN HACIA ATRÁS (Lógica de índices y Capítulos) ---
    if (currentChunkIndex > 0) { 
        currentChunkIndex--; 
    } else if (currentChapterIndex > 0) { 
        currentChapterIndex--; 
        
        // Cargamos los datos del capítulo anterior
        await loadChapter(currentChapterIndex); 
        
        // Vamos al final del capítulo anterior
        currentChunkIndex = chunks.length - 1; 
        
        // Actualizamos la interfaz (Indicador y TOC)
        const indicator = document.getElementById('chapter-indicator');
        if (indicator) indicator.innerText = stripHtml(currentBook.chapters[currentChapterIndex].title);
        
        document.querySelectorAll('.toc-item').forEach(el => el.classList.remove('active'));
        const activeItem = document.getElementById(`toc-item-${currentChapterIndex}`);
        if (activeItem) activeItem.classList.add('active');
    } 

    // --- GUARDADO DE PROGRESO ---
    // Guardamos la nueva posición después del cambio de índices
    if (typeof saveProgress === 'function') {
        saveProgress();
    }

    // RENDERIZADO DEL NUEVO CHUNK
    await renderChunk(); 

    // --- 5. REINICIO INTELIGENTE DEL MOTOR ---
    if (wasSpeaking) {
        setTimeout(() => {
            const currentText = chunks[currentChunkIndex] || "";
            const isImage = currentText.match(/!\[\[(.*?)\]\]/);

            if (isImage) {
                console.log("Retroceso detectado: Iniciando timer de imagen.");
                if (typeof startImageTimer === 'function') startImageTimer();
            } else {
                prepareAndStartSpeech();
            }
        }, 60); 
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
    


// --- LÓGICA DE SWIPE OPTIMIZADA ---
let touchstartX = 0;
let touchstartY = 0; // Añadido para medir eje Y
let touchendX = 0;
let touchendY = 0; // Añadido para medir eje Y

function initTouchEvents() {
    const readerZone = document.getElementById('reading-container-fixed');
    if (!readerZone) return;

    readerZone.addEventListener('touchstart', e => {
        touchstartX = e.changedTouches[0].screenX;
        touchstartY = e.changedTouches[0].screenY; // Capturamos origen vertical
    }, {passive: true});

    readerZone.addEventListener('touchend', e => {
        touchendX = e.changedTouches[0].screenX;
        touchendY = e.changedTouches[0].screenY; // Capturamos final vertical
        handleSwipeGesture();
    }, {passive: true});
}

function handleSwipeGesture() {
    const deltaX = touchendX - touchstartX;
    const deltaY = touchendY - touchstartY;
    
    const swipeThreshold = 70; // Sensibilidad horizontal (ligeramente aumentada)
    const verticalLimit = Math.abs(deltaY); // Cuánto se movió el dedo verticalmente
    
    // FILTRO DE INTENCIÓN: 
    // Solo permitimos el swipe si el movimiento horizontal es mayor al vertical.
    // Esto anula el "arco" del pulgar al hacer scroll.
    if (Math.abs(deltaX) > verticalLimit && Math.abs(deltaX) > swipeThreshold) {
        if (deltaX < 0) {
            // Deslizar a la izquierda (delta negativo) -> Siguiente
            if (typeof nextChunk === 'function') nextChunk();
        } else {
            // Deslizar a la derecha (delta positivo) -> Atrás
            if (typeof prevChunk === 'function') prevChunk();
        }
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', initTouchEvents);
     



/**
 * Llama a esta función dentro de tu código cuando abras el lector
 * para que el foco empiece en el botón de lectura.
 */
function focusInitialReaderElement() {
    // Intentamos enfocar el botón de Play/Voz por defecto
    const playBtn = document.querySelector('.btn-audio-main') || document.getElementById('btn-read-toggle');
    if (playBtn) playBtn.focus();
}

function checkAutoLoad() {
    const params = getUrlParams();
    if (params.repo !== null && params.book) {
        const repoIdx = parseInt(params.repo);
        // Buscamos el libro en la librería cargada
        const book = library.find(b => b.fileName === params.book && b.repoIdx === repoIdx);
        if (book) {
            // AJUSTE: Pasamos ch y ck directamente a openReader.
            // Si son 0 o null, openReader usará automáticamente la memoria local.
            // Si tienen valor (link compartido), openReader priorizará esos valores.
            openReader(book.id, params.ch, params.ck);
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

function launchFullScreen(element) {
    if(element.requestFullscreen) {
        element.requestFullscreen();
    } else if(element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
    } else if(element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
    } else if(element.msRequestFullscreen) {
        element.msRequestFullscreen();
    }
}


function saveProgress() {
    if (!currentBook) return;
    
    // ESCUDO: Si el título es el placeholder del HTML, abortamos el guardado
    // para no ensuciar el localStorage con "BOOK TITLE"
    const titleToCheck = (currentBook.title || "").toLowerCase();
    if (titleToCheck.includes("book title") || titleToCheck === "") return;

    const history = JSON.parse(localStorage.getItem('nexus_reading_history') || '{}');

    const bookProgress = {
        bookId: currentBook.id,
        fileName: currentBook.fileName,
        repoIdx: currentBook.repoIdx,
        bookTitle: currentBook.title, // Mantenemos tu nombre de variable
        chapterIndex: currentChapterIndex,
        chapterTitle: currentBook.chapters[currentChapterIndex]?.title || "Capítulo " + (currentChapterIndex + 1),
        chunk: currentChunkIndex,
        timestamp: Date.now(),
        // Añadimos cover para que la tarjeta la tenga
        cover: currentBook.cover 
    };

    history[currentBook.fileName] = bookProgress;
    localStorage.setItem('nexus_reading_history', JSON.stringify(history));
    
    // Sincronizamos con la llave que usa checkLastSession
    localStorage.setItem('nexus_last_session', JSON.stringify(bookProgress));
}

function checkBookProgress(fileName) {
    const history = JSON.parse(localStorage.getItem('nexus_reading_history') || '{}');
    const savedProgress = history[fileName];

    // Solo mostramos el modal si el progreso no es el inicio absoluto (Cap 0, Chunk 0)
    if (savedProgress && (savedProgress.chapterIndex > 0 || savedProgress.chunk > 0)) {
        const infoEl = document.getElementById('resume-info');
        if (infoEl) {
            infoEl.innerText = "Última vez: " + (savedProgress.chapterTitle || "Capítulo " + (savedProgress.chapterIndex + 1));
        }
        
        const modal = document.getElementById('resume-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
        
        window.pendingProgress = savedProgress;
    }
}



async function confirmResume(option) {
    // 1. Detener cualquier audio que esté sonando AHORA mismo para evitar el doble hilo
    if (typeof stopSpeech === 'function') {
        stopSpeech(); 
    }

    const modal = document.getElementById('nx-resume-modal');
    if (modal) {
        modal.style.opacity = '0';
        if (typeof handleNxResumeKeys === 'function') {
            document.removeEventListener('keydown', handleNxResumeKeys, true);
        }
        setTimeout(() => modal.remove(), 300);
    }

    // 2. Pequeña pausa para dejar que el motor de síntesis de Google se limpie
    await new Promise(resolve => setTimeout(resolve, 100));

    switch (option) {
        case 'continue':
            console.log("Nexus: Continuando lectura...");
            // No hacemos nada más, startSpeech se encarga abajo
            break;

        case 'section':
            console.log("Nexus: Reiniciando sección...");
            currentChunkIndex = 0;
            await renderChunk();
            break;

        case 'restart':
            console.log("Nexus: Reiniciando libro completo...");
            currentChapterIndex = 0;
            currentChunkIndex = 0;
            await loadChapter(0, 0);
            break;
    }
    
    // 3. Guardar progreso y disparar una ÚNICA vez el audio
    if (typeof saveProgress === 'function') saveProgress();
    
    // Usamos un pequeño delay tras el renderizado para evitar el error de setAttribute de Google
    setTimeout(() => {
        if (typeof startSpeech === 'function') {
            console.log("Nexus: Disparo de voz único iniciado.");
            startSpeech();
        }
    }, 200);

    window.scrollTo(0, 0);
}

window.addEventListener('click', (e) => {
    // 1. Buscamos el modal por su nuevo ID único
    const modal = document.getElementById('nx-resume-modal');
    
    // 2. Si el clic fue exactamente en el fondo (overlay) y no en la tarjeta
    if (e.target === modal) {
        // Aplicamos una salida suave antes de remover
        modal.style.opacity = '0';
        
        setTimeout(() => {
            modal.remove(); // Eliminamos el elemento del DOM
            window.pendingProgress = null; // Limpiamos la lectura pendiente
        }, 300);
        
        console.log("Nexus: Modal cerrado por clic externo.");
    }
});