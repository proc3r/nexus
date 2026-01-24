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


	function getUrlParams() {
		const params = new URLSearchParams(window.location.search);
		return {
			repo: params.get('repo'),
			book: params.get('book'), // Nombre real del archivo .md
			ch: parseInt(params.get('ch')) || 0,
			ck: parseInt(params.get('ck')) || 0
		};
	}

	function getOptimizedImageUrl(url, width = 800) {
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
            coverUrl = getOptimizedImageUrl(rawCoverUrl, 500); 
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
    library = []; 
    try {
        for (let i = 0; i < REPOSITORIES.length; i++) {
            const repo = REPOSITORIES[i];
            const response = await fetch(repo.api);
            const files = await response.json();
            if (!Array.isArray(files)) continue;
            
            const mdFiles = files.filter(f => f.name.toLowerCase().endsWith('.md'));
            
            for (const file of mdFiles) {
                const res = await fetch(file.download_url);
                const text = await res.text();
                
                const hasIndexTag = /indexar:\s*true/.test(text.split('---')[1] || "");
                if (!hasIndexTag) continue; 

                const coverMatch = text.match(/!\[\[(.*?)\]\]/);
                let coverUrl = DEFAULT_COVER;
                if (coverMatch) {
                    let fileNameImg = coverMatch[1].split('|')[0].trim();
                    let rawCoverUrl = repo.adjuntos + encodeURIComponent(fileNameImg);
                    coverUrl = getOptimizedImageUrl(rawCoverUrl, 500); 
                }

                library.push({
                    id: btoa(file.path + repo.api), 
                    fileName: file.name, // <-- CRUCIAL: Guardar nombre real
                    title: file.name.replace('.md', '').replace(/_/g, ' '),
                    cover: coverUrl,
                    chapters: parseMarkdown(text),
                    rawBase: repo.adjuntos,
                    repoIdx: i // <-- CRUCIAL: Guardar índice del repo
                });
            }
        }
        
        if (statusText) statusText.innerText = "Sincronizado";
        document.getElementById('main-spinner')?.classList.add('hidden');
        renderLibrary();
    } catch (e) { 
        if (statusText) statusText.innerText = "Fail";
        console.error("Error:", e);
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
    const book = library.find(b => b.id === id);
    if (!book) return;
    
    currentBook = book;
    
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
    
    // Tipografía
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

    if (window.isLectorFijo) {
        // En lugar de "index.html", usamos "./" para ir a la raíz de la carpeta actual
        window.location.href = "./"; 
    } else {
        document.getElementById('reader-view').classList.add('hidden'); 
        document.getElementById('library-container').classList.remove('hidden'); 
        checkLastSession(); 
    }
}
	function loadChapter(idx) {
		currentChapterIndex = idx;
		const chapter = currentBook.chapters[idx];
		document.getElementById('chapter-indicator').innerText = stripHtml(chapter.title);
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
                const rawImageUrl = currentBook.rawBase + encodeURIComponent(embedMatch[1].split('|')[0].trim());
				const optimizedUrl = getOptimizedImageUrl(rawImageUrl, 1000); // 1000px para lectura interna
			finalHtml = `
				<div class="reader-image-container">
					<img src="${optimizedUrl}" 
						 class="reader-image cursor-zoom-in" 
						 alt="${fileName}" 
						 onclick="openImageModal('${rawImageUrl}', '${fileName}')">
					<p class="reader-text">Click para ampliar</p>
				</div>`;
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
		window.navDirection = 'prev'; 
		clearImageTimer(); 
		if (isSpeaking && isPaused) { synth.resume(); isPaused = false; updatePauseUI(false); }
		if (isSpeaking) synth.cancel(); 

		if (currentChunkIndex > 0) { currentChunkIndex--; renderChunk(); }
		else if (currentChapterIndex > 0) { currentChapterIndex--; loadChapter(currentChapterIndex); currentChunkIndex = chunks.length - 1; renderChunk(); } 
	}

    

     