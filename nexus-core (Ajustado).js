		let library = [];
        let currentBook = null;
        let currentChapterIndex = 0;
        let currentChunkIndex = 0;
        let chunks = [];
const REPOSITORIES = [
    {
        api: "http://localhost/documentos/",
        raw: "http://localhost/documentos/",
        adjuntos: "https://raw.githubusercontent.com/proc3r/005-DOCUMENTOS-PROC3R/master/adjuntos/"
    }
];

        const DEFAULT_COVER = "./PortadaBase.jpg";
		// Red Unificada de Adjuntos (Aquí puedes añadir más en el futuro)
		const AUDIO_BASE_URL = "https://raw.githubusercontent.com/proc3r/Audios/refs/heads/master/";
	
	async function initNexus() { // Asegúrate de que tenga 'async'
    console.log("Iniciando Nexus...");
    await fetchBooks();         // Espera a los libros
    renderLibrary();            // Recién aquí dibuja la biblioteca
}
	
	
// 1. Buscador simple: Solo busca la URL cruda
async function buscarImagenEnRepositorios(nombreArchivo, urlAdjuntosBase) {
    if (!nombreArchivo || !urlAdjuntosBase) return DEFAULT_COVER;
    const nombreLimpio = nombreArchivo.replace(/!\[\[|\]\]/g, '').split('|')[0].trim();
    const urlProvisional = urlAdjuntosBase + encodeURIComponent(nombreLimpio);
    try {
        const respuesta = await fetch(urlProvisional, { method: 'HEAD', cache: 'force-cache' });
        return respuesta.ok ? urlProvisional : DEFAULT_COVER;
    } catch (err) {
        return DEFAULT_COVER;
    }
}

// Optimizador único: Crea la URL para el visor de wsrv.nl
function getOptimizedImageUrl(url, width = 400) {
    if (!url || url === DEFAULT_COVER) return DEFAULT_COVER;
    // El &v=1 es CLAVE para que el navegador guarde la imagen en caché
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&output=webp&q=75&v=1`;
}


// --- 2. FUNCIONES DE CONTROL DE INTERFAZ (MOVER AQUÍ ARRIBA) ---

	
	let libraryRetries = 0;
	function renderLibrary() {
    const grid = document.getElementById('library-grid');
    if (window.isLectorFijo || !grid) return;

    if (library.length === 0) {
        if (libraryRetries < 5) {
            libraryRetries++;
            setTimeout(renderLibrary, 500);
        } else {
            console.error("Nexus Core: No se pudo cargar la librería.");
        }
        return;
    }

    grid.innerHTML = ''; 

    library.forEach(book => {
        // --- 1. RECUPERACIÓN DE SECCIONES ---
        const displayChapters = book.chaptersCount || (book.chapters ? book.chapters.length : 1);
        
        // --- 2. LÓGICA DE SINOPSIS ---
        // Se mantiene fiel al valor que traiga el objeto book (actualizado por fetchBooks)
        const hasSynopsis = book.hasSynopsis === true;

        // --- 3. PROCESAMIENTO DE TIEMPO DE LECTURA (CORREGIDO) ---
        let timeStr = book.readingTime || "-- min";

        // Solo procesamos si el valor es un número puro o un string numérico sin letras
        const hasLetters = /[a-zA-Z]/.test(timeStr);
        
        if (!hasLetters) {
            const totalMin = parseInt(timeStr);
            if (!isNaN(totalMin)) {
                if (totalMin >= 60) {
                    const h = Math.floor(totalMin / 60);
                    const m = totalMin % 60;
                    timeStr = m > 0 ? `${h} h ${m} min` : `${h} h`;
                } else {
                    timeStr = `${totalMin} min`;
                }
            }
        }
        
        const card = document.createElement('div');
        card.className = 'book-card group relative bg-white/5 border border-white/10 rounded-[0.5rem] hover:border-[#ffcc00] cursor-pointer text-center overflow-hidden';
        card.onclick = (e) => {
            if (!e.target.closest('.btn-synopsis') && !e.target.closest('.podcast-badge-btn')) {
                openReader(book.id);
            }
        };

        card.innerHTML = `
            <div class="book-card-cover relative w-full aspect-[2/3]">
                <img src="${book.cover}" alt="Cover" loading="lazy" class="w-full h-full object-cover"
                onerror="this.onerror=null; this.src='${DEFAULT_COVER}';">
                
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
                        ${book.displayName || book.title}
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

    // Limpieza de Interfaz
    document.getElementById('main-spinner')?.classList.add('hidden');
    const splash = document.getElementById('nexus-splash') || document.getElementById('auto-loader');
    if (splash) {
        splash.style.opacity = "0";
        setTimeout(() => { splash.style.display = "none"; }, 800);
    }

    if (typeof renderShelf === 'function') renderShelf();
}



// --- CAPTURA INMEDIATA DE TÍTULO PARA EL SPINNER (AJUSTADA) ---
(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const loaderTitle = document.getElementById('loader-book-title');
    
    if (loaderTitle) {
        // No importa qué libro sea, primero mostramos un estado neutro
        // para evitar que el traductor o el sistema muestren el nombre del archivo .md
        loaderTitle.innerText = "BUSCANDO LIBRO";
        
        // Si quieres que el libro por defecto tenga su nombre desde el inicio:
        const bookParam = urlParams.get('book');
        if (!bookParam && !urlParams.get('s')) {
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


function checkAutoLoad() {
    const params = getUrlParams();
    if (params.repo !== null && params.book) {
        // Aseguramos estado neutro por si acaso
        const loaderTitle = document.getElementById('loader-book-title');
        if (loaderTitle) loaderTitle.innerText = "BUSCANDO LIBRO";

        const repoIdx = parseInt(params.repo);
        const book = library.find(b => b.fileName === params.book && b.repoIdx === repoIdx);
        
        if (book) {
            // El libro ya existe en la librería cargada
            openReader(book.id, params.ch, params.ck);
        } else {
            // El libro es de un link externo, requiere fetch
            loadDirectBook(params);
        }
    }
}


async function loadDirectBook(params) {
    // 1. CONTROL INMEDIATO DEL UI (Evita parpadeos de nombres técnicos)
    const loaderTitle = document.getElementById('loader-book-title');
    if (loaderTitle) {
        loaderTitle.innerText = "BUSCANDO LIBRO";
    }
    document.getElementById('auto-loader')?.classList.remove('hidden');

    currentBook = null; 
    const statusText = document.getElementById('status-text');
    let repoIndex = (params.repo !== null && !isNaN(params.repo)) ? parseInt(params.repo) : 0;
    let fileName = params.book ? decodeURIComponent(params.book) : "Modelo Noumenico.md";
    const repo = REPOSITORIES[repoIndex] || REPOSITORIES[0];
    const fileUrl = repo.raw + encodeURIComponent(fileName);

    try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`Error 404`);
        const text = await response.text();
        
        // 2. EXTRACCIÓN DE METADATOS (Título Real)
        const sections = text.split('---');
        const frontmatter = sections[1] || "";
        const titleMatch = frontmatter.match(/titulo:\s*(.+)/);
        const realTitle = titleMatch ? titleMatch[1].trim() : null;

        // 3. ACTUALIZACIÓN DINÁMICA DEL SPINNER
        // Solo cambiamos el texto si logramos extraer el metadato real
        if (loaderTitle && realTitle) {
            loaderTitle.innerText = realTitle.toUpperCase();
        }

        // --- LÓGICA DE PORTADA UNIFICADA Y DIRECTA ---
        const coverMatch = text.match(/!\[\[(.*?)\]\]/);
        let coverUrlFinal = DEFAULT_COVER;

        if (coverMatch) {
            let rawName = coverMatch[1].split('|')[0].trim();

            if (rawName.toLowerCase().endsWith('.mp3')) {
                const matches = [...text.matchAll(/!\[\[(.*?)\]\]/g)];
                const img = matches.find(m => !m[1].toLowerCase().endsWith('.mp3'));
                if (img) rawName = img[1].split('|')[0].trim();
            }

            // CAMBIO AQUÍ: Usamos la base de adjuntos del repo ya cargado arriba
            const urlVerificada = await buscarImagenEnRepositorios(rawName, repo.adjuntos);
            
            if (urlVerificada !== DEFAULT_COVER) {
                coverUrlFinal = (typeof getOptimizedImageUrl === 'function') 
                    ? getOptimizedImageUrl(urlVerificada, 400) 
                    : `https://wsrv.nl/?url=${encodeURIComponent(urlVerificada)}&v=1&w=400&output=webp&q=75`;
            }
        }	

        const parsedChapters = parseMarkdown(text);

        // 5. ASIGNACIÓN DE DATOS (displayName para consistencia total)
        currentBook = {
            id: 'direct-load',
            fileName: fileName,
            title: fileName.replace('.md', '').replace(/_/g, ' ').replace(/[^\w\s\u0370-\u03FFáéíóúÁÉÍÓÚñÑ\+]/g, ''),
            displayName: realTitle || fileName.replace('.md', '').replace(/_/g, ' '),
            cover: coverUrlFinal,
            chapters: parsedChapters,
            rawBase: repo.adjuntos,
            repoIdx: repoIndex,
            soundtrack: parsedChapters.soundtrackId
        };

        // 6. ACTUALIZACIÓN DE INTERFAZ DEL LECTOR
        document.getElementById('reader-title').innerText = currentBook.displayName || currentBook.title;
        
        const coverPreview = document.getElementById('sidebar-cover-preview');
        if (coverPreview) coverPreview.style.backgroundImage = `url('${currentBook.cover}')`;

        // Control de contenedores
        document.getElementById('library-container')?.classList.add('hidden');
        document.getElementById('reader-view').classList.remove('hidden');

        // 7. CARGA DE CONTENIDO
        await loadChapter(params.ch || 0);
        currentChunkIndex = params.ck || 0;
        await renderChunk();
        
        renderTOC();
        renderProgressMarkers();

        // 8. PERSISTENCIA (Sincroniza el nuevo título con el historial)
		document.getElementById('reader-title').innerText = currentBook.displayName || currentBook.title;
        saveProgress();

        if (statusText) statusText.innerText = "Sincronizado";
        document.getElementById('main-spinner')?.classList.add('hidden');
        document.getElementById('auto-loader')?.classList.add('hidden');

        // 9. LÓGICA DE AUDIO / SOUNDTRACK
        if (currentBook && currentBook.soundtrack) {
            if (typeof refrescarValorAleatorio === 'function') refrescarValorAleatorio();
            setTimeout(() => {
                if (typeof updateSoundtrack === 'function') updateSoundtrack(currentBook.soundtrack);
                else if (typeof initPlayer === 'function') initPlayer();
            }, 300); 
        }

    } catch (e) {
        console.error("Error de carga directa:", e);
        if (statusText) statusText.innerText = "Error 404";
        if (loaderTitle) loaderTitle.innerText = "ERROR AL CARGAR";
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

    // 1. Intentar cargar desde caché para velocidad instantánea
    const cachedLibrary = sessionStorage.getItem('nexus_library_cache');
    if (cachedLibrary) {
        let tempLibrary = JSON.parse(cachedLibrary);
        
        // --- MEJORA: Sincronización dinámica de Sinopsis con el caché ---
        // Esto asegura que si agregas una sinopsis al .md, el botón aparezca aunque haya caché
        library = tempLibrary.map(book => {
            const bookKey = book.fileName.replace('.md', '').trim();
            const hasGlobal = window.nexusSynopsisMap && window.nexusSynopsisMap[bookKey];
            return { ...book, hasSynopsis: book.hasSynopsis || !!hasGlobal };
        });

        renderLibrary();
        checkAutoLoad(); 
        ocultarSplash();
        
        // Opcional: Si quieres que el sistema busque cambios en segundo plano aunque haya caché,
        // podrías quitar el 'return', pero por ahora lo dejamos como lo tienes.
        return; 
    }

    library = []; 
    try {
        // 2. ÚNICA petición a GitHub/Local: el índice JSON
        // Añadimos un parámetro de tiempo (?v=...) para obligar al navegador a no usar el caché del archivo
        const response = await fetch('library-index.json?v=' + Date.now());
        if (!response.ok) throw new Error("No se encontró el índice");
        const indexFiles = await response.json();

        // 3. Procesar el JSON (Cero lectura de archivos .md aquí)
        for (const file of indexFiles) {
            // Solo procesamos si index es true
            if (file.index !== true) continue;

            const safeId = btoa(unescape(encodeURIComponent(file.download_url)));

            // Optimización de portada si es externa (ImgBB)
            let coverUrlFinal = DEFAULT_COVER;
            if (file.coverUrl) {
                coverUrlFinal = (typeof getOptimizedImageUrl === 'function')
                    ? getOptimizedImageUrl(file.coverUrl, 400)
                    : `https://wsrv.nl/?url=${encodeURIComponent(file.coverUrl)}&w=400&output=webp&q=75&v=1`;
            }

            // --- LÓGICA DE SINOPSIS GLOBAL ---
            // Verificamos si el libro existe en el mapa cargado desde sinopsis.md
            const bookKey = file.name.replace('.md', '').trim();
            const hasGlobalSynopsis = window.nexusSynopsisMap && window.nexusSynopsisMap[bookKey];

            library.push({
                id: safeId, 
                fileName: file.name,
                title: file.name.replace('.md', ''),
                displayName: file.displayName || file.name.replace('.md', ''),
                cover: coverUrlFinal,
                soundtrack: file.soundtrack || null,
                repoIdx: file.repoIdx,
                path: file.download_url,
                chaptersCount: file.chaptersCount || 0,
                readingTime: file.readingTime || "-- min",
                // Prioridad: Mapa Global OR Valor en JSON OR false
                hasSynopsis: !!hasGlobalSynopsis || file.hasSynopsis || false, 
                chapters: [] // IMPORTANTE: Se llenará al abrir el libro
            });
        }
        
        if (library.length > 0) {
            sessionStorage.setItem('nexus_library_cache', JSON.stringify(library));
        }

        document.getElementById('main-spinner')?.classList.add('hidden');
        renderLibrary();
        checkAutoLoad(); 
        ocultarSplash();

    } catch (e) { 
        console.error("Error en sistema Nexus de bajo impacto:", e);
        ocultarSplash();
    }
}


// Arreglos temporales para preservar fórmulas
let latexBlocks = [];
let latexInline = [];

function protectLatex(text) {
    if (!text) return "";
    latexBlocks = [];
    latexInline = [];

    // 1. Proteger bloques $$...$$ (display mode)
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
        latexBlocks.push(formula.trim());
        return `NXMathBlock${latexBlocks.length - 1}Nx`;
    });

    // 2. Proteger inline $...$ (evitando coincidir con precios o símbolos aislados)
    text = text.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, (match, prefix, formula) => {
        latexInline.push(formula.trim());
        return `${prefix}NXMathInline${latexInline.length - 1}Nx`;
    });

    return text;
}

function restoreLatex(text) {
    if (!text) return "";

    // Restaurar bloques $$...$$ (Display mode centrado)
    text = text.replace(/NXMathBlock(\d+)Nx/g, (match, index) => {
        const latex = latexBlocks[parseInt(index)];
        if (!latex) return match;
        return `<div class="nexus-latex-wrapper" style="display: flex; justify-content: center; align-items: center; width: 100%; margin: 1em 0; text-align: center;">\\[${latex}\\]</div>`;
    });

    // Restaurar inline $...$ (Inline puro en el mismo párrafo)
    text = text.replace(/NXMathInline(\d+)Nx/g, (match, index) => {
        const latex = latexInline[parseInt(index)];
        if (!latex) return match;
        // Inyectamos un span estricto inline para evitar saltos de línea
        return `<span class="nexus-latex-inline" style="display: inline !important; vertical-align: baseline;">\\(${latex}\\)</span>`;
    });

    return text;
}



function parseMarkdown(text) {
    const lines = text.split('\n');
    const chapters = [];
    let currentChapter = null;
    let inFrontmatter = false;
    let startLine = 0;
    let inMediaBlock = false;
    
    // --- VARIABLES DE CONTROL LATEX $$ ---
    let inLatexBlock = false;
    let accumulatedLatex = ""; 

    // --- LÓGICA DE SOUNDTRACK (LIMPIEZA AGRESIVA) ---
    let soundtrackId = null;
    if (lines.length > 0 && lines[0].trim() === "---") {
        inFrontmatter = true;
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.toLowerCase().startsWith('soundtrack:')) {
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
            const cleanLine = isQuote ? trimmed.replace(/^>\s?/, '').trim() : trimmed;

            // --- CAPTURA EXCLUSIVA DE BLOQUES LATEX $$ EN CITAS ---
            
            // Caso A: Fórmula completa $$ ... $$ en una sola línea (con o sin '>')
            if (cleanLine.startsWith('$$') && cleanLine.endsWith('$$') && cleanLine.length > 2) {
                if (currentChapter.content.length > 0) {
                    const lastIdx = currentChapter.content.length - 1;
                    // Se acopla únicamente al párrafo anterior
                    currentChapter.content[lastIdx] += '\n' + trimmed;
                } else {
                    currentChapter.content.push(trimmed);
                }
                continue;
            }

            // Caso B: Inicio de bloque multilínea $$
            if (cleanLine.startsWith('$$') && !inLatexBlock) {
                inLatexBlock = true;
                accumulatedLatex = trimmed;
                continue;
            }

            // Caso C: Dentro de bloque multilínea $$
            if (inLatexBlock) {
                accumulatedLatex += '\n' + trimmed;
                if (cleanLine.endsWith('$$')) {
                    inLatexBlock = false;
                    if (currentChapter.content.length > 0) {
                        const lastIdx = currentChapter.content.length - 1;
                        // Se acopla el bloque multilínea completo únicamente al párrafo anterior
                        currentChapter.content[lastIdx] += '\n' + accumulatedLatex;
                    } else {
                        currentChapter.content.push(accumulatedLatex);
                    }
                    accumulatedLatex = "";
                }
                continue;
            }
            // ------------------------------------

            // Si es una línea de cita puramente vacía ('>'), no crea un chunk nuevo
            if (isQuote && cleanLine === "") {
                continue;
            }

            const parts = trimmed.split(/(!\[\[.*?\]\])/g);
            for (let j = 0; j < parts.length; j++) {
                let subChunk = parts[j].trim();
                if (!subChunk) continue;

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
                    // Cadenas de texto normales se guardan cada una en su chunk independiente
                    currentChapter.content.push(subChunk);
                }
            }
        }
    }
    if (currentChapter) chapters.push(currentChapter);
    
    chapters.soundtrackId = soundtrackId;
    return chapters;
}
	

function renderShelf() {
    const shelf = document.getElementById('book-shelf');
    if (!shelf) return;

    shelf.innerHTML = '';
    // Usamos los primeros 15 libros
    const shelfBooks = library.slice(0, 15);

    shelfBooks.forEach(book => {
        const bookEl = document.createElement('div');
        bookEl.className = 'shelf-book';
        
        // Mantenemos openReader con book.id para que la lógica de carga no cambie
        bookEl.onclick = () => openReader(book.id);
        
        // Usamos displayName para el texto visual y el ALT de la imagen
        const tituloAMostrar = book.displayName || book.title;
        
        bookEl.innerHTML = `
            <img src="${book.cover}" alt="${tituloAMostrar}" onerror="this.src='${DEFAULT_COVER}'">
            <div class="shelf-book-overlay">
                <div class="shelf-book-title">${tituloAMostrar}</div>
            </div>
        `;
        shelf.appendChild(bookEl);
    });

    // Inicializa el scroll de las flechas
    if (typeof initShelfScroll === 'function') {
        initShelfScroll();
    }
}
	
	
	
async function openReader(id, forceCh = null, forceCk = null) {
    // --- 1. CONFIGURACIÓN DE INTERFAZ ---
    if (typeof launchFullScreen === 'function') {
        launchFullScreen(document.documentElement);
    }
    
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

    // --- 2. PROCESAMIENTO BAJO DEMANDA (NUEVA LÓGICA) ---
    // Si los capítulos están vacíos, es porque el libro no se ha procesado aún
    if (!currentBook.chapters || currentBook.chapters.length === 0) {
        try {
            console.log("Nexus: Procesando contenido para " + currentBook.title);
            const res = await fetch(currentBook.path);
            if (!res.ok) throw new Error("No se pudo obtener el archivo md");
            const text = await res.text();
            
            // Usamos tu función parseMarkdown que ya tienes definida en nexus-core
            currentBook.chapters = parseMarkdown(text);
            
            // Si el libro tiene soundtrack en el MD pero no en el JSON, lo recuperamos
            if (!currentBook.soundtrack) {
                const sections = text.split('---');
                const frontmatter = sections[1] || "";
                const stMatch = frontmatter.match(/soundtrack:\s*([a-zA-Z0-9_-]{11})/);
                if (stMatch) currentBook.soundtrack = stMatch[1];
            }
        } catch (e) {
            console.error("Error procesando libro al abrir:", e);
            alert("No se pudo cargar el contenido del libro.");
            return;
        }
    }

    // --- 3. LÓGICA DE POSICIONAMIENTO HÍBRIDA ---
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

    // --- 4. RENDERIZADO DE INTERFAZ ---
    document.getElementById('reader-title').innerText = currentBook.displayName || currentBook.title;
    const coverPreview = document.getElementById('sidebar-cover-preview');
    if (coverPreview) {
        coverPreview.style.backgroundImage = `url('${currentBook.cover}')`;
    }
    
    renderTOC();
    renderProgressMarkers();
    
    document.getElementById('library-container')?.classList.add('hidden');
    document.getElementById('reader-view').classList.remove('hidden');
    document.getElementById('resume-card')?.classList.add('hidden');
    
    // --- 5. PREFERENCIAS VISUALES ---
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

    // --- 6. CARGA DE CONTENIDO Y ACTUALIZACIÓN DE DATOS ---
    await loadChapter(currentChapterIndex, currentChunkIndex);
    
    if (typeof updateProgress === 'function') {
        updateProgress(); 
    }

    // --- 7. MOSTRAR/INYECTAR MODAL CON DATOS SINCRONIZADOS ---
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
                                    <h2 class="nx-resume-book-title">${currentBook.displayName || currentBook.title}</h2>
                                    <p class="nx-resume-chapter-name">${currentCap}</p>
                                </div>
                                <div class="nx-resume-progress-track">
                                    <div id="nx-resume-bar-fill" class="nx-resume-progress-fill" style="width: ${progPercentText};"></div>
                                </div>
                                <div class="nx-resume-stats-row">
                                    <span style=" text-align: left;"><b style="color:#fff;">${progPercentText}</b> Completado</span>
                                    <span style=" text-align: right;">${timeLeft}</span>
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
                
                document.removeEventListener('keydown', handleNxResumeKeys, true);
                document.addEventListener('keydown', handleNxResumeKeys, true);

                const mainBtn = document.querySelector('.nx-resume-btn-main');
                if (mainBtn) mainBtn.focus();

            } else {
                modal.style.display = 'flex';
                modal.style.opacity = '1';
                const bar = document.getElementById('nx-resume-bar-fill');
                if (bar) bar.style.width = progPercentText;
                
                document.removeEventListener('keydown', handleNxResumeKeys, true);
                document.addEventListener('keydown', handleNxResumeKeys, true);
                const mainBtn = document.querySelector('.nx-resume-btn-main');
                if (mainBtn) mainBtn.focus();
            }
        }, 300); 
    }

    // --- 8. INTEGRACIÓN SOUNDTRACK ---
    setTimeout(() => {
        if (typeof updateSoundtrack === 'function') {
            updateSoundtrack(currentBook.soundtrack);
        }
    }, 300);
}


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
	
	// --- ACTUALIZACIÓN DE TIEMPO EN PORTADA ANTES DEL RESET ---
    if (currentBook) {
        let totalWords = 0;
        currentBook.chapters.forEach(ch => {
            if (ch.content) {
                ch.content.forEach(text => { 
                    totalWords += (text || "").split(/\s+/).filter(w => w.length > 0).length; 
                });
            }
        });

        const nuevoTiempoStr = typeof calcularTiempoLectura === 'function' 
            ? calcularTiempoLectura(totalWords) 
            : (Math.ceil(totalWords / 190) + " min");

        // Buscamos la card específica en la biblioteca para actualizar su tiempo visual
        const allCards = document.querySelectorAll('.book-card');
        allCards.forEach(card => {
            // Buscamos la card que contiene el título del libro actual
            if (card.innerText.includes(currentBook.title)) {
                const timeContainer = card.querySelector('p .mi-round')?.parentElement;
                if (timeContainer) {
                    timeContainer.innerHTML = `<span class="mi-round text-[18px] align-middle mr-1 notranslate">schedule</span>${nuevoTiempoStr}`;
                }
            }
        });
    }
    // ---------------------------------------------------------

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
        // Tus líneas originales de reset visual
        const musicIcon = document.getElementById('music-icon');
        const musicBtn = document.getElementById('btn-music-main');
        const statusText = document.getElementById('music-status-text');
        const volBtn = document.getElementById('btn-volume-yt');

        if (musicIcon) musicIcon.innerText = "play_arrow";
        if (musicBtn) musicBtn.style.background = "#08f0fb7a"; 
        if (statusText) statusText.innerText = "Ambiente listo";
        if (volBtn) volBtn.classList.remove('music-playing-beat');

        // Lógica de retorno inteligente al Portal
        if (typeof updateSoundtrack === 'function') {
            if (userWantsSilence) {
                // Si el usuario marcó OFF antes, volvemos al portal pero en silencio
                updateSoundtrack(PORTAL_SOUNDTRACK, false);
                isMusicPlaying = false;
            } else {
                // Si no, retomamos la música ambiente
                updateSoundtrack(PORTAL_SOUNDTRACK, true);
                isMusicPlaying = true;
            }
        }
        
        if (typeof actualizarBotonAmbienteUI === 'function') actualizarBotonAmbienteUI();
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

    // --- LIMPIEZA INMEDIATA ---
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

    // 3. PROCESAMIENTO DE CONTENIDO CON PROTECCIÓN LATEX GLOBAL
    let finalHtml = "";
    let isImage = false;
    
    // --- DETECCIÓN DE IMÁGENES ---
    const embedMatch = rawText.match(/!\[\[(.*?)\]\]/); // Formato Obsidian
    const externalImgMatch = rawText.match(/!\[.*?\]\((https:\/\/.*?)\)/); // Formato Markdown Estándar (ImgBB)

    if (externalImgMatch) {
        isImage = true;
        const imageUrl = externalImgMatch[1];
        const optimizedUrl = getOptimizedImageUrl(imageUrl, 700);
        
        finalHtml = `<div class="reader-image-container">
            <img src="${optimizedUrl}" 
                 class="reader-image cursor-zoom-in" 
                 alt="Imagen externa" 
                 onerror="this.onerror=null; this.src='${DEFAULT_COVER}';"
                 onclick="openImageModal('${imageUrl}', 'Imagen Externa')">
            <p class="reader-text">Click para ampliar</p>
        </div>`;

    } else if (embedMatch) {
        const originalFileName = embedMatch[1].split('|')[0].trim();
        const fileNameLower = originalFileName.toLowerCase();
        
        const isAudio = fileNameLower.endsWith('.m4a') || fileNameLower.endsWith('.mp3') || fileNameLower.endsWith('.wav') || fileNameLower.endsWith('.ogg');
        const isVideo = fileNameLower.endsWith('.mp4') || fileNameLower.endsWith('.mov') || fileNameLower.endsWith('.webm') || fileNameLower.endsWith('.mkv');
        
        if (isAudio || isVideo) { 
            if (window.navDirection === 'prev') return prevChunk(); 
            else return nextChunk(); 
        }
        
        isImage = true;
        const repoActual = REPOSITORIES[currentBook.repoIdx];
        const rawImageUrl = repoActual.adjuntos + encodeURIComponent(originalFileName);
        
        const finalImageUrl = fileNameLower.endsWith('.gif') 
            ? rawImageUrl 
            : getOptimizedImageUrl(rawImageUrl, 700);

        finalHtml = `<div class="reader-image-container">
            <img src="${finalImageUrl}" 
                 class="reader-image cursor-zoom-in" 
                 alt="${originalFileName}" 
                 onerror="this.onerror=null; this.src='${DEFAULT_COVER}';"
                 onclick="openImageModal('${rawImageUrl}', '${originalFileName}')">
            <p class="reader-text">Click para ampliar</p>
        </div>`;

    } else if (rawText.trim().startsWith('#')) {
        finalHtml = `<div class="reader-section-title">${cleanMarkdown(rawText.replace(/^#+\s+/, '').trim())}</div>`;

    } else if (rawText.trim().startsWith('>')) {
        // --- PROTECCIÓN DE LATEX DENTRO DE CITAS (BLOCKQUOTES) ---
        const protectedText = protectLatex(rawText);
        let lines = protectedText.split('\n');
        
        const ttsPause = '<div style="display:none;">\n</div>';
        const visualSeparator = '<span style="display: block; opacity: 70%; border-bottom: 2px dotted; margin-bottom: 10px;"></span>';

        // Mapeamos las líneas limpiando el prefijo '>' y procesando markdown
        let processedLines = lines
            .map(l => processFormatting(cleanMarkdown(l.trim().replace(/^>\s?/, ''))))
            .filter(l => l.trim().length > 0) // Filtra líneas vacías para evitar duplicación de puntos
            .join(ttsPause + visualSeparator);
        
        const contentWithLatex = restoreLatex(processedLines);
        finalHtml = `<div class="custom-blockquote">${contentWithLatex}</div>`;

    } else {
        const protectedText = protectLatex(rawText);
        const markdownProcessed = processFormatting(cleanMarkdown(protectedText));
        finalHtml = restoreLatex(markdownProcessed);
    }

    // 4. INSERCIÓN DE CONTENIDO
    content.innerHTML = finalHtml;

    // --- RENDERIZADO Y TIPOGRAFÍA DE FÓRMULAS LATEX (MATHJAX) ---
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        window.MathJax.typesetPromise([content]).catch(err => console.error("Error MathJax:", err));
    }

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

    // 7. SINCRONIZACIÓN DE VOZ / MODO VISUAL
    if (window.isSpeaking) { 
        if (isImage) {
            startImageTimer();
        } else {
            if (window.hasAvailableVoice === false) {
                setTimeout(() => {
                    if (typeof showVisualTimer === 'function' && typeof calculateReadingTime === 'function') {
                        const text = content.innerText || "";
                        showVisualTimer(calculateReadingTime(text));
                    }
                }, 300);
            } else {
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

function initShelfScroll() {
    const shelf = document.getElementById('book-shelf');
    const btnLeft = document.getElementById('prev-shelf');
    const btnRight = document.getElementById('next-shelf');

    if (!shelf || !btnLeft || !btnRight) return;

    // Desplazamiento suave manual (aunque el CSS ya ayuda)
    const step = 120; 

    btnLeft.onclick = (e) => {
        e.stopPropagation();
        shelf.scrollBy({ left: -step, behavior: 'smooth' });
    };

    btnRight.onclick = (e) => {
        e.stopPropagation();
        shelf.scrollBy({ left: step, behavior: 'smooth' });
    };
    
    const checkScroll = () => {
        // Tolerancia de 10px para evitar desapariciones nerviosas
        const canScrollLeft = shelf.scrollLeft > 10;
        const canScrollRight = shelf.scrollLeft + shelf.clientWidth < shelf.scrollWidth - 10;

        // Añadimos o quitamos la clase activa que controla el CSS
        if (canScrollLeft) btnLeft.classList.add('is-active');
        else btnLeft.classList.remove('is-active');

        if (canScrollRight) btnRight.classList.add('is-active');
        else btnRight.classList.remove('is-active');
    };

    // Escuchamos el scroll con un pequeño throttling para rendimiento
    shelf.onscroll = checkScroll;
    window.onresize = checkScroll;
    
    // Ejecución inicial con delay para que el render esté completo
    setTimeout(checkScroll, 600);
}