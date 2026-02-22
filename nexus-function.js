/**
 * NEXUS FUNCTION - Módulo Menus / Toc / Imagen / Share / DarkMode
 * Extraído de nexus-core.js para mejorar la modularidad.
 */
 
 
		let isDarkMode = true;
        let isPinned = false;
        let allExpanded = false;
        let sidebarTimer = null;
		// Lista de códigos de idioma que se escriben de derecha a izquierda
		const RTL_LANGS = ['ar', 'he', 'fa', 'ur', 'dv', 'ha', 'ps', 'yi'];
		
		
		function saveProgress() {
    if (!currentBook) return;
    
    // 1. Obtener el historial completo o crear uno nuevo
    const history = JSON.parse(localStorage.getItem('nexus_reading_history') || '{}');

    // 2. Crear el registro específico de este libro
    const bookProgress = {
        bookId: currentBook.id,
        fileName: currentBook.fileName,
        repoIdx: currentBook.repoIdx,
        bookTitle: currentBook.title,
        chapterIndex: currentChapterIndex,
        chapterTitle: currentBook.chapters[currentChapterIndex].title,
        chunk: currentChunkIndex,
        timestamp: Date.now()
    };

    // 3. Guardar en el historial usando el fileName como clave única
    history[currentBook.fileName] = bookProgress;
    localStorage.setItem('nexus_reading_history', JSON.stringify(history));
    
    // Mantenemos nexus_last_session solo para la "Card de Continuar" del menú principal
    localStorage.setItem('nexus_last_session', JSON.stringify(bookProgress));
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
    
    // --- NUEVO: ACTIVAR FULLSCREEN AL REANUDAR SESIÓN ---
    if (typeof launchFullScreen === 'function') {
        launchFullScreen(document.documentElement);
    }
    
    const data = JSON.parse(saved);

    // 1. Intentamos encontrar el libro en la librería cargada por su ID o su fileName
    let book = library.find(b => b.id === data.id || b.fileName === data.fileName);

    if (book) {
        // Si el libro existe en la librería actual, usamos el openReader híbrido.
        // Pasamos los índices directamente para que abra en el lugar exacto de un solo golpe.
        openReader(book.id, data.chapterIndex, data.chunk);
        
        // Ocultamos la tarjeta de reanudación
        const resumeCard = document.getElementById('resume-card');
        if (resumeCard) resumeCard.classList.add('hidden');
    } else {
        // Si no está en la librería (caso de libros externos del lector fijo), 
        // usamos la carga directa pero asegurando que pasamos los parámetros
        const params = {
            repo: data.repoIdx !== undefined ? data.repoIdx : 0,
            book: data.fileName,
            ch: data.chapterIndex,
            ck: data.chunk
        };
        
        console.log("Nexus: Reanudando libro externo no indexado:", params.book);
        loadDirectBook(params);
        
        const resumeCard = document.getElementById('resume-card');
        if (resumeCard) resumeCard.classList.add('hidden');
    }
}
	
	
	
	// Usamos un objeto para no ensuciar el espacio global y evitar errores de carga
const NexusImage = {
    timer: null,
    secondsLeft: 10,
    isPaused: false
};

function startImageTimer() {
    // Si el usuario pausó, no reiniciamos el contador al traducir
    if (NexusImage.isPaused) {
        updateTimerDisplay();
        return;
    }

    clearImageTimer();
    const timerEl = document.getElementById('image-timer');
    if (timerEl) timerEl.classList.remove('hidden');

    NexusImage.secondsLeft = 10;
    NexusImage.isPaused = false;
    updateTimerDisplay();

    NexusImage.timer = setInterval(() => {
        if (!NexusImage.isPaused) {
            NexusImage.secondsLeft--;
            updateTimerDisplay();
            if (NexusImage.secondsLeft <= 0) {
                clearImageTimer();
                if (typeof nextChunk === 'function') nextChunk();
            }
        }
    }, 1000);
}

function updateTimerDisplay() {
    const textEl = document.getElementById('timer-text');
    const btnEl = document.querySelector('.timer-pause-btn');
    if (!textEl) return;

    // Extraemos traducciones del almacén
    const storeComenzando = document.getElementById('store-comenzando');
    const storePausado = document.getElementById('store-pausado');
    const storeBtnPausar = document.getElementById('store-btn-pausar');
    const storeBtnReanudar = document.getElementById('store-btn-reanudar');

    const getTxt = (el) => el ? el.innerHTML : "...";

    if (NexusImage.isPaused) {
        textEl.innerHTML = getTxt(storePausado);
        if (btnEl) btnEl.innerHTML = getTxt(storeBtnReanudar);
    } else {
        // Solo el número tiene 'notranslate' para evitar el parpadeo
        textEl.innerHTML = `${getTxt(storeComenzando)} <span class="notranslate">${NexusImage.secondsLeft}</span>`;
        if (btnEl) btnEl.innerHTML = getTxt(storeBtnPausar);
    }
}

function togglePauseImageTimer() {
    NexusImage.isPaused = !NexusImage.isPaused;
    // Sincronizar con el estado de pausa del lector si existe
    if (typeof isPaused !== 'undefined') isPaused = NexusImage.isPaused;
    if (typeof updatePauseUI === 'function') updatePauseUI(NexusImage.isPaused);
    updateTimerDisplay();
}

function clearImageTimer() {
    if (NexusImage.timer) clearInterval(NexusImage.timer);
    NexusImage.timer = null;
    
    // ESTA ES LA LÍNEA CLAVE QUE FALTA:
    NexusImage.isPaused = false; 
    
    const timerEl = document.getElementById('image-timer');
    if (timerEl) timerEl.classList.add('hidden');
}


function processFormatting(str) { 
    return str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/[*_](.*?)[*_]/g, '<em>$1</em>'); 
}

	function jumpToChapter(idx) { let wasSpeaking = isSpeaking; stopSpeech(); loadChapter(idx);
    if (!isPinned) closeSidebar();
    if (wasSpeaking) startSpeech();
}				  

	function updateProgress() {
    if(!currentBook || !currentBook.chapters || currentBook.chapters.length === 0) return;
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
    if (!list || !currentBook || !currentBook.chapters) return; // Seguridad
    
    list.innerHTML = '';
    currentBook.chapters.forEach((ch, i) => {
        const item = document.createElement('div');
        // Asegúrate de que el ID coincida con lo que busca loadChapter
        item.id = `toc-item-${i}`; 
        item.className = `toc-item pr-[0.2em] ${i === currentChapterIndex ? 'active' : ''}`;
        
        const hasChildren = (i < currentBook.chapters.length - 1 && currentBook.chapters[i+1].level > ch.level);
        
        item.innerHTML = `
            <div class="flex items-center group py-[1.5px]">
                <span class="toc-toggle notranslate" onclick="toggleTOCSection(${i}, event)">
                    ${hasChildren ? '+' : '•'}
                </span>
                <span class="toc-text cursor-pointer hover:opacity-80 transition-opacity truncate font-normal flex-1 condensed  text-[21px]" onclick="jumpToChapter(${i})">
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
                    const childContainer = parents[p].querySelector(`[id^="child-container-"]`);
                    if(childContainer) childContainer.appendChild(item);
                    break;
                }
            }
        }
    });

    // Si entramos a un capítulo específico, expandir la jerarquía
    expandActiveHierarchy(currentChapterIndex);
}

	function toggleTOCSection(idx, event) { if (event) event.stopPropagation(); const container = document.getElementById(`child-container-${idx}`); if (container) { container.classList.toggle('hidden'); event.target.innerText = container.classList.contains('hidden') ? '+' : '−'; } }
	function toggleExpandMode() { allExpanded = !allExpanded; document.getElementById('expand-mode-btn').classList.toggle('text-[#ffcc00]', allExpanded); document.querySelectorAll('[id^="child-container-"]').forEach(c => c.classList.toggle('hidden', !allExpanded)); if (!allExpanded) expandActiveHierarchy(currentChapterIndex); }
	function expandActiveHierarchy(idx) { if (!allExpanded) { let current = document.getElementById(`toc-item-${idx}`); while (current) { const container = current.parentElement; if (container && container.id.startsWith('child-container-')) { container.classList.remove('hidden'); const pIdx = container.id.replace('child-container-', ''); const t = document.querySelector(`#toc-item-${pIdx} .toc-toggle`); if(t) t.innerText = '−'; current = document.getElementById(`toc-item-${pIdx}`); } else current = null; } } }
	
	function renderProgressMarkers() {
    const container = document.getElementById('progress-markers-container');
    if (!container || !currentBook) return; // Validación de seguridad
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
			const showTooltipForced = () => {
				if (window.ttHideTimer) clearTimeout(window.ttHideTimer);
				document.querySelectorAll('.marker-tooltip').forEach(t => {
					t.classList.remove('force-show');
				});
				tooltip.classList.add('force-show');
			};
			marker.addEventListener('touchstart', (e) => {
				showTooltipForced();
				window.ttHideTimer = setTimeout(() => {
					tooltip.classList.remove('force-show');
				}, 4000);
			}, { passive: true });
			marker.addEventListener('mouseenter', showTooltipForced);
			marker.addEventListener('mouseleave', () => {
				if (window.ttHideTimer) clearTimeout(window.ttHideTimer);
				window.ttHideTimer = setTimeout(() => {
					tooltip.classList.remove('force-show');
				}, 1000); // 1 segundo de cortesía en escritorio
			});
			marker.onclick = (e) => { 
				e.stopPropagation(); 
				tooltip.classList.remove('force-show');
				if (window.ttHideTimer) clearTimeout(window.ttHideTimer);
				jumpToChapter(i); 
			};
			
			container.appendChild(marker);
		});
	}
		
    
	
	function openSidebar() { 
    const sidebar = document.getElementById('reader-sidebar');
    sidebar.classList.add('open'); 
    document.body.classList.add('sidebar-open'); // Nueva clase de control
    document.getElementById('sidebar-trigger').classList.add('hidden'); 
    
    if (window.innerWidth < 1024) {
        document.body.style.overflow = 'hidden';
    }

    if (sidebarTimer) clearTimeout(sidebarTimer); 
}

	function closeSidebar() {
    isPinned = false; 
    document.body.style.overflow = '';
    document.body.classList.remove('sidebar-pinned');
    document.body.classList.remove('sidebar-open'); // Limpiamos la clase

    const sidebar = document.getElementById('reader-sidebar');
    const trigger = document.getElementById('sidebar-trigger');

    if (sidebar) {
        sidebar.classList.remove('open');
        sidebar.classList.remove('pinned');
    }
    if (trigger) {
        trigger.classList.remove('hidden');
    }
}

	function handleSidebarLeave() { 
		if (isPinned) return; 
		sidebarTimer = setTimeout(() => { closeSidebar(); }, 1200); 
	}

	function togglePin() { 
		if (window.innerWidth < 1024) return; 
		isPinned = !isPinned; 
		const sidebar = document.getElementById('reader-sidebar');
		const pinBtn = document.getElementById('pin-btn');
		sidebar.classList.toggle('pinned', isPinned); 
		pinBtn.classList.toggle('opacity-100', isPinned); 
		if (isPinned) {
			document.body.classList.add('sidebar-pinned');
		} else {
			document.body.classList.remove('sidebar-pinned');
		}
	}

	
	
	function initTouchEvents() {
    const sidebar = document.getElementById('reader-sidebar');
    if (!sidebar) return;

    let startX = 0;
    let startY = 0;

    sidebar.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        
        // Si estamos al tope de la lista, bajamos 1px manualmente. 
        // Esto "engaña" al navegador para que no active el pull-to-refresh.
        if (sidebar.scrollTop === 0) {
            sidebar.scrollTop = 1;
        }
    }, {passive: false});

    sidebar.addEventListener('touchmove', e => {
        const currentY = e.touches[0].clientY;
        const currentX = e.touches[0].clientX;
        const diffY = currentY - startY;
        const diffX = currentX - startX;

        // Si el movimiento es vertical (scroll)
        if (Math.abs(diffY) > Math.abs(diffX)) {
            // Evitamos que el evento llegue al 'body' o al navegador (refresco)
            e.stopPropagation();
        }
    }, {passive: false});

    sidebar.addEventListener('touchend', e => { 
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;

        // Lógica de cierre lateral (Swipe left)
        if (startX - endX > 70 && Math.abs(startY - endY) < 40) {
            closeSidebar(); 
        }
    }, {passive: true});
}

	

	

	window.addEventListener('resize', () => {
		const width = window.innerWidth;
		
		if (width < 1024 && isPinned) {
			isPinned = false; // Cambiamos el estado global
			const sidebar = document.getElementById('reader-sidebar');
			const trigger = document.getElementById('sidebar-trigger');
			const pinBtn = document.getElementById('pin-btn');
			document.body.classList.remove('sidebar-pinned');
			if (sidebar) sidebar.classList.remove('pinned', 'open');
			if (trigger) trigger.classList.remove('hidden'); // MOSTRAR el disparador amarillo
			if (pinBtn) pinBtn.classList.remove('active'); // Resetear icono del pin si lo usas
			/*console.log("Reseteo automático: Pantalla pequeña detectada.");*/
		}
	});


		// Función para habilitar el zoom cuando la imagen se abre
		function enableZoom() {
			const viewport = document.querySelector('meta[name="viewport"]');
			if (viewport) {
				viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
			}
		}

		// Función para deshabilitar el zoom al cerrar la imagen
		function disableZoom() {
			const viewport = document.getElementById('meta-viewport'); // O usa querySelector como arriba
			if (viewport) {
				viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
			}
			
			// TRUCO EXTRA: Forzar al navegador a volver al zoom original
			window.scrollTo(0, 0);
			document.body.style.zoom = "100%"; 
		}



	function openImageModal(url, caption) {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-image');
    const modalCap = document.getElementById('modal-caption');
    
    // 1. Habilitar ZOOM temporalmente para la imagen
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
    }

    modalImg.src = url;
    modalCap.innerText = caption.replace(/_/g, ' ');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeImageModal() {
    const modal = document.getElementById('image-modal');
    
    // 1. Bloquear ZOOM nuevamente
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }

    // 2. Truco para forzar al navegador a "resetear" el zoom si el usuario lo dejó ampliado
    window.scrollTo(0, 0); 

    modal.classList.add('hidden');
    document.body.style.overflow = '';
    document.getElementById('modal-image').src = "";
}

document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") closeImageModal();
});

	document.addEventListener('keydown', (e) => {
		if (e.key === "Escape") closeImageModal();
	});

		


function shareCurrentPoint() {
    if (!currentBook) return;

    const modal = document.getElementById('share-modal');
    const previewArea = document.getElementById('share-text-preview');
    const textContainer = document.querySelector('.share-text-content');
    
    // 1. Datos básicos del título
    document.getElementById('share-book-title').innerText = currentBook.title;

    // 2. LÓGICA DE IMAGEN ULTRA-SIMPLE
    // Prioridad 1: La imagen que ya tiene el objeto currentBook
    // Prioridad 2: La imagen por defecto (DEFAULT_COVER)
    let finalCover = currentBook.cover || DEFAULT_COVER;

    // Si por algún error de carga la imagen es un audio, forzamos la base
    if (typeof finalCover === 'string' && finalCover.toLowerCase().includes('.mp3')) {
        finalCover = DEFAULT_COVER;
    }

    document.getElementById('share-book-img').src = finalCover;

    // 3. Capturamos el contenido para limpiar
    const contentOriginal = document.getElementById('book-content');
    if (!contentOriginal) return;

    const tempDiv = contentOriginal.cloneNode(true);

    // --- CAPA 1: LIMPIEZA POR ID (Universal) ---
    const marker = tempDiv.querySelector('#nexus-language-marker') || tempDiv.querySelector('#nexus-validation-anchor');
    let detectedWord = "";
    
    if (marker) {
        detectedWord = marker.innerText.trim();
        marker.remove();
    }

    let textForShare = tempDiv.innerText;

    // --- CAPA 2: DOBLE SEGURIDAD ---
    if (detectedWord) {
        const dynamicRegex = new RegExp(detectedWord + "$", "gi");
        textForShare = textForShare.replace(dynamicRegex, "");
    }

    const staticApples = ["manzana", "apple", "تفاحة", "pomme", "apfel", "mela", "maçã", "яблоко", "苹果"];
    staticApples.forEach(word => {
        const staticRegex = new RegExp(word + "$", "gi");
        textForShare = textForShare.replace(staticRegex, "");
    });

    // 4. Limpieza final de espacios
    let cleanText = textForShare.replace(/\s+/g, ' ').trim();

    if (previewArea) {
        previewArea.innerText = cleanText;
    }

    if (textContainer) {
        textContainer.scrollTop = 0;
    }

    modal.dataset.fullContent = cleanText;
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('show'), 10);
    document.body.style.overflow = 'hidden';
}

	
	function closeShareModal() {
		const modal = document.getElementById('share-modal');
		modal.classList.remove('show');
		
		setTimeout(() => {
			modal.classList.add('hidden');
			document.body.style.overflow = ''; // Devuelve el scroll al lector
		}, 300);
	}

	document.addEventListener('mousedown', (e) => {
		const modal = document.getElementById('share-modal');
		const container = document.getElementById('share-modal-content');
		if (!modal.classList.contains('hidden') && e.target === modal) {
			closeShareModal();
		}
	});



function executeShare(platform) {
    const modal = document.getElementById('share-modal');
    const textSnippet = modal.dataset.fullContent || "";
    const bookTitle = document.getElementById('share-book-title').innerText.toUpperCase();

    const currentPath = window.location.pathname;
    const directory = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
    const finalBase = window.location.origin + directory + "lector.html";

    // --- MEJORA DE ENLACE SMART (Legible) ---
    // 1. Limpiamos el nombre: quitamos .md y cambiamos espacios por guiones bajos
    let cleanBookName = currentBook.fileName.replace('.md', '').replace(/\s+/g, '_');
    
    // 2. Codificamos solo el nombre (para proteger caracteres como el + o tildes)
    // pero mantenemos los separadores | fuera de la codificación
    const smartParams = `${currentBook.repoIdx}|${encodeURIComponent(cleanBookName)}|${currentChapterIndex}|${currentChunkIndex}`;
    
    // 3. El resultado será ?s=0|Nombre_Libro|1|3 (el navegador respetará los |)
    const shareUrl = `${finalBase}?s=${smartParams}`;
    // ----------------------------------------

    const fullMessage = `*${bookTitle}*\n\n_"${textSnippet}"_\n\n${shareUrl}`;

    let finalUrl = "";
    switch(platform) {
        case 'facebook':
            finalUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
            break;
        case 'reddit':
            finalUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(bookTitle)}`;
            break;
        case 'whatsapp':
            finalUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullMessage)}`;
            break;
        case 'x':
            const xMsg = `"${textSnippet.substring(0, 150)}..."`;
            finalUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(bookTitle + '\n' + xMsg)}&url=${encodeURIComponent(shareUrl)}`;
            break;
        case 'telegram':
            finalUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(fullMessage)}`;
            break;
        case 'linkedin':
            finalUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
            break;
        case 'email':
            finalUrl = `mailto:?subject=${encodeURIComponent(bookTitle)}&body=${encodeURIComponent(fullMessage)}`;
            break;
        case 'copy':
            navigator.clipboard.writeText(shareUrl).then(() => {
                alert("Enlace copiado");
                closeShareModal();
            });
            return;
    }

    if (finalUrl) {
        window.open(finalUrl, '_blank', 'width=600,height=400');
        closeShareModal();
    }
}



	
	   function cleanCalloutTags() {
            const content = document.getElementById('book-content');
            if (!content) return;
            const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, null, false);
            let node;
            const nodesToReplace = [];
            while(node = walker.nextNode()) {
                if (node.nodeValue.includes('[!')) {
                    nodesToReplace.push(node);
                }
            }
            nodesToReplace.forEach(textNode => {
                const newValue = textNode.nodeValue.replace(/\[\![^\]\n]+\][\+\-]?\s?/g, '');
                textNode.nodeValue = newValue;
            });
        }
        const observer = new MutationObserver((mutations) => {
            cleanCalloutTags();
        });

        window.addEventListener('load', () => {
            const target = document.getElementById('book-content');
            if (target) {
                observer.observe(target, { childList: true, subtree: true });
            }
        });
		
     function toggleDropdown(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const isShown = el.classList.contains('show');
    document.querySelectorAll('.settings-dropdown').forEach(d => d.classList.remove('show'));
    if (!isShown) el.classList.add('show');
}

function changeFontFamily(f) {
    const isMobile = window.innerWidth <= 768;
    const deviceSuffix = isMobile ? '-mobile' : '-desktop';

    document.documentElement.style.setProperty('--reader-font-family', f);
    localStorage.setItem('reader-font-family' + deviceSuffix, f);
    
    document.getElementById('font-dropdown')?.classList.remove('show');
    syncVisualSettings();
}

function changeFontSize(d) { 
    const isMobile = window.innerWidth <= 768;
    const deviceSuffix = isMobile ? '-mobile' : '-desktop';
    
    const val = document.getElementById('font-size-val'); 
    if (!val) return;
    let s = Math.max(12, Math.min(60, parseInt(val.innerText) + d)); 
    val.innerText = s; 
    document.documentElement.style.setProperty('--reader-font-size', s + 'px');
    
    localStorage.setItem('reader-font-size' + deviceSuffix, s);
}

function changeAlignment(align) {
    const isMobile = window.innerWidth <= 768;
    const deviceSuffix = isMobile ? '-mobile' : '-desktop';

    // 1. Aplicamos la alineación principal (center, left, right, justify)
    document.documentElement.style.setProperty('--reader-text-align', align);
    localStorage.setItem('reader-text-align' + deviceSuffix, align);

    const rtlLangs = ['ar', 'he', 'iw', 'fa', 'ur', 'ps', 'sd', 'yi'];
    const currentLang = localStorage.getItem('nexus_preferred_lang') || 'es';
    const isRTL = rtlLangs.includes(currentLang.split('-')[0]);

    // 2. CORRECCIÓN LÓGICA DE LA ÚLTIMA LÍNEA
    if (align === 'justify') {
        // Solo forzamos left/right cuando estamos justificando
        const lastLineAlign = isRTL ? 'right' : 'left';
        document.documentElement.style.setProperty('--reader-text-align-last', lastLineAlign);
    } else {
        // SI EL USUARIO ELIGE CENTRO, DERECHA O IZQUIERDA:
        // Usamos 'inherit'. Esto anula el 'left' inyectado y hace que la última línea
        // siga exactamente lo que dice '--reader-text-align'.
        document.documentElement.style.setProperty('--reader-text-align-last', 'inherit');
    }
    
    document.getElementById('align-dropdown')?.classList.remove('show');
    syncVisualSettings();
}

function changeLineHeight(h) {
    const isMobile = window.innerWidth <= 768;
    const deviceSuffix = isMobile ? '-mobile' : '-desktop';

    document.documentElement.style.setProperty('--reader-line-height', h);
    localStorage.setItem('reader-line-height' + deviceSuffix, h);
    
    document.getElementById('spacing-dropdown')?.classList.remove('show');
    syncVisualSettings();
}
		
		
        function toggleDarkMode() { 
            isDarkMode = !isDarkMode; 
            const v = document.getElementById('reader-view'); 
            v.classList.toggle('dark-mode', isDarkMode); 
            v.classList.toggle('light-mode', !isDarkMode); 
        }
		
	function syncVisualSettings() {
    // 1. Obtener valores actuales de las variables CSS aplicadas al documento
    const style = getComputedStyle(document.documentElement);
    const currentFont = style.getPropertyValue('--reader-font-family').replace(/['"]/g, '').trim();
    const currentAlign = style.getPropertyValue('--reader-text-align').trim();
    const currentLineHeight = style.getPropertyValue('--reader-line-height').trim();

    // 2. Sincronizar Menú de Fuentes (Lógica robusta)
    document.querySelectorAll('#font-dropdown .setting-option').forEach(opt => {
        const fontName = opt.style.fontFamily.replace(/['"]/g, '').trim();
        const isSelected = fontName === currentFont || opt.innerText.trim() === currentFont;
        opt.classList.toggle('selected', isSelected);
    });

    // 3. Sincronizar Menú de Alineación
    // Buscamos cuál botón contiene el valor exacto (ej: 'justify', 'center', 'left')
    document.querySelectorAll('#align-dropdown .setting-option').forEach(opt => {
        const onClickAttr = opt.getAttribute('onclick') || "";
        // Ahora comparamos correctamente si el onClick incluye el valor actual
        opt.classList.toggle('selected', onClickAttr.includes(`'${currentAlign}'`));
    });

    // 4. Sincronizar Menú de Interlineado
    document.querySelectorAll('#spacing-dropdown .setting-option').forEach(opt => {
        const onClickAttr = opt.getAttribute('onclick') || "";
        // Extraemos el número del onclick para comparar (ej: de "changeLineHeight(1.5)" sacamos "1.5")
        const valMatch = onClickAttr.match(/[\d.]+/);
        if (valMatch) {
            const val = valMatch[0];
            // Marcamos como seleccionado si el valor del botón coincide con el del CSS
            opt.classList.toggle('selected', val === currentLineHeight);
        }
    });
}



function toggleZenMode() {
    const mainLayout = document.querySelector('.reader-main-layout');
    const zenIcon = document.getElementById('zen-icon');
    if (!mainLayout) return;

    // Solo manejamos las barras visuales
    const isZen = mainLayout.classList.toggle('zen-active-ui');

    if (isZen) {
        closeSidebar(); 
    }

    if (zenIcon) {
        zenIcon.innerText = isZen ? 'fullscreen_exit' : 'fullscreen';
    }
}

/**
 * NEXUS CORE - MODO ZEN
 * Navegación simple por teclado sin gestión de foco.
 */
document.addEventListener('keydown', (e) => {
    // 1. Bloqueamos el TAB por completo
    if (e.key === 'Tab') {
        e.preventDefault();
        return;
    }

    // 2. Si el lector está oculto o estamos escribiendo, no hacer nada
    const readerView = document.getElementById('reader-view');
    if (!readerView || readerView.classList.contains('hidden')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const container = document.getElementById('reading-container-fixed');

    switch (e.key) {
        // NAVEGACIÓN DE TEXTO (BLOQUES)
        case 'ArrowRight':
            e.preventDefault();
            if (typeof nextChunk === 'function') nextChunk();
            break;

        case 'ArrowLeft':
            e.preventDefault();
            if (typeof prevChunk === 'function') prevChunk();
            break;

        // SCROLL (DENTRO DEL TEXTO)
        case 'ArrowDown':
            e.preventDefault();
            container?.scrollBy({ top: 150, behavior: 'smooth' });
            break;

        case 'ArrowUp':
            e.preventDefault();
            container?.scrollBy({ top: -150, behavior: 'smooth' });
            break;

        // PLAY / PAUSE
        case ' ':
            e.preventDefault();
            if (typeof toggleSpeech === 'function') toggleSpeech();
            break;

        // SALIR / RESTABLECER
        case 'Escape':
            // 1. Detección de estados
            const layout = document.querySelector('.reader-main-layout');
            const isZenMode = layout && layout.classList.contains('zen-active-ui');
            const isFullScreen = !!(document.fullscreenElement || document.webkitFullscreenElement);

            // 2. Lógica de "Limpieza"
            if (isZenMode || isFullScreen) {
                if (isFullScreen) document.exitFullscreen?.();
                if (isZenMode) toggleZenMode();
                console.log("🧹 ESC: Limpieza de capas ejecutada.");
            } 
            else {
                // 3. MODO NORMAL: Confirmación de salida
                e.preventDefault();
                mostrarConfirmacionSalida();
            }
            break;
    }
});


function mostrarConfirmacionSalida() {
    if (document.getElementById('exit-confirmation')) return;

    const div = document.createElement('div');
    div.id = 'exit-confirmation';
    div.className = 'exit-dialog-overlay';
    div.innerHTML = `
        <div class="exit-dialog-content">
            <p>¿Quieres volver a la Biblioteca?</p>
            <div class="exit-dialog-buttons">
                <button id="confirm-exit-yes" class="btn-exit">SI</button>
                <button id="confirm-exit-no" class="btn-exit btn-cancel">NO</button>
            </div>
        </div>
    `;
    document.body.appendChild(div);

    const cerrarConfirmacion = () => {
        div.remove();
        document.removeEventListener('keydown', handleKeyAction);
    };

    // --- NUEVA LÓGICA DE CLIC FUERA ---
    div.onclick = (e) => {
        // Si el clic es en el overlay (fondo) y no en el contenido blanco
        if (e.target === div) {
            cerrarConfirmacion();
        }
    };

    const handleKeyAction = (e) => {
        const key = e.key.toLowerCase();
        if (key === 's') {
            cerrarConfirmacion();
            if (typeof closeReader === 'function') closeReader();
        } else if (key === 'n' || key === 'escape') {
            e.preventDefault();
            e.stopPropagation();
            cerrarConfirmacion();
        }
    };

    document.getElementById('confirm-exit-yes').onclick = () => {
        cerrarConfirmacion();
        if (typeof closeReader === 'function') closeReader();
    };

    document.getElementById('confirm-exit-no').onclick = cerrarConfirmacion;

    document.addEventListener('keydown', handleKeyAction);
}


// --- GESTOR DE CIERRE DE MENÚS (CLIC FUERA) ---

window.addEventListener('mousedown', (e) => {
    // 1. Buscamos si el clic fue dentro de algún dropdown o botón de configuración
    const isClickInsideDropdown = e.target.closest('.settings-dropdown');
    const isClickOnToggleBtn = e.target.closest('.setting-btn, .btn-speed');

    // 2. Si el clic no fue en ninguno de esos dos, cerramos todos los menús
    if (!isClickInsideDropdown && !isClickOnToggleBtn) {
        document.querySelectorAll('.settings-dropdown').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    }
});

			// Este evento detecta cuando el Fullscreen se cierra, ya sea por ESC, por F11 o por código
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        // Si acabamos de salir de Fullscreen, verificamos si el Zen sigue puesto
        const layout = document.querySelector('.reader-main-layout');
        if (layout && layout.classList.contains('zen-active-ui')) {
            console.log("🔗 Sincronización: Fullscreen cerrado, desactivando Modo Zen automáticamente...");
            toggleZenMode(); 
        }
    }
});


// Al abrir el modal de traducción
function openTranslateModal() {
    const overlay = document.getElementById("translate-overlay");
    overlay.style.display = "flex";
    
    // Bloquear el scroll del fondo para que solo se mueva el menú de idiomas
    document.body.style.overflow = 'hidden'; 
}

// Al cerrar (clic fuera o botón X)
function closeTranslateModal() {
    const overlay = document.getElementById("translate-overlay");
    overlay.style.display = "none";
    
    // Devolver el scroll al contenido
    document.body.style.overflow = ''; 
}


function updateRTLAlignment(langCode) {
    const leftOpt = document.getElementById('option-align-left');
    const rightOpt = document.getElementById('option-align-right');
    if (!leftOpt || !rightOpt) return;

    const baseLang = langCode.split('-')[0].toLowerCase();
    const isRTL = RTL_LANGS.includes(baseLang);

    if (isRTL) {
        leftOpt.classList.add('hidden');
        rightOpt.classList.remove('hidden');
        // Si estaba en izquierda, lo movemos a derecha automáticamente
        if (getComputedStyle(document.documentElement).getPropertyValue('--reader-text-align').trim() === 'left') {
            changeAlignment('right');
        }
    } else {
        leftOpt.classList.remove('hidden');
        rightOpt.classList.add('hidden');
        // Si estaba en derecha (por un idioma previo), volvemos a izquierda
        if (getComputedStyle(document.documentElement).getPropertyValue('--reader-text-align').trim() === 'right') {
            changeAlignment('left');
        }
    }
}