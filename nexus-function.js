/**
 * NEXUS FUNCTION - Módulo Menus / Toc / Imagen / Share / DarkMode
 * Extraído de nexus-core.js para mejorar la modularidad.
 */
 
 
		let isDarkMode = true;
        let isPinned = false;
        let allExpanded = false;
        let sidebarTimer = null;
		
		
		
		function saveProgress() {
    if (!currentBook) return;
    const progress = {
        bookId: currentBook.id,
        fileName: currentBook.fileName, // Guardamos el nombre del archivo
        repoIdx: currentBook.repoIdx,   // Guardamos el índice del repo
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

    // Intentamos encontrar el libro en la librería cargada
    let book = library.find(b => b.fileName === data.fileName);

    if (book) {
        openReader(book.id);
        setTimeout(() => {
            loadChapter(data.chapterIndex);
            currentChunkIndex = data.chunk;
            renderChunk();
            document.getElementById('resume-card').classList.add('hidden');
        }, 500);
    } else {
        // Si no está en la librería (por ejemplo, en lector.html), 
        // usamos la carga directa que creamos antes
        const params = {
            repo: data.repoIdx,
            book: data.fileName,
            ch: data.chapterIndex,
            ck: data.chunk
        };
        loadDirectBook(params);
        document.getElementById('resume-card').classList.add('hidden');
    }
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
		document.getElementById('reader-sidebar').classList.add('open'); 
		document.getElementById('sidebar-trigger').classList.add('hidden'); 
		if (sidebarTimer) clearTimeout(sidebarTimer); 
	}

	function closeSidebar() {
		isPinned = false; 
		document.body.classList.remove('sidebar-pinned');
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
		let startX = 0;
		sidebar.addEventListener('touchstart', e => startX = e.touches[0].clientX, {passive: true});
		sidebar.addEventListener('touchend', e => { 
			if (startX - e.changedTouches[0].clientX > 50) closeSidebar(); 
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
			console.log("Reseteo automático: Pantalla pequeña detectada.");
		}
	});

	function openImageModal(url, caption) {
		const modal = document.getElementById('image-modal');
		const modalImg = document.getElementById('modal-image');
		const modalCap = document.getElementById('modal-caption');
		modalImg.src = url;
		modalCap.innerText = caption.replace(/_/g, ' '); // Limpia el nombre del archivo
		modal.classList.remove('hidden');
		document.body.style.overflow = 'hidden';
	}

	function closeImageModal() {
		const modal = document.getElementById('image-modal');
		modal.classList.add('hidden');
		document.body.style.overflow = '';
		document.getElementById('modal-image').src = "";
	}

	document.addEventListener('keydown', (e) => {
		if (e.key === "Escape") closeImageModal();
	});

	function shareCurrentPoint() {
		if (!currentBook) return;

		const modal = document.getElementById('share-modal');
		document.getElementById('share-book-title').innerText = currentBook.title;
		document.getElementById('share-book-img').src = currentBook.cover || DEFAULT_COVER;
		modal.dataset.currentText = document.getElementById('book-content').innerText;
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

	function shareCurrentPoint() {
		if (!currentBook) return;

		const modal = document.getElementById('share-modal');
		const previewArea = document.getElementById('share-text-preview');
		const textContainer = document.querySelector('.share-text-content'); // El contenedor con scroll
		document.getElementById('share-book-title').innerText = currentBook.title;
		document.getElementById('share-book-img').src = currentBook.cover || DEFAULT_COVER;
		const rawText = document.getElementById('book-content').innerText;
		const cleanText = rawText.replace(/\s+/g, ' ').trim();
		previewArea.innerText = `“${cleanText}”`;
		if (textContainer) {
			textContainer.scrollTop = 0;
		}
		modal.dataset.fullContent = cleanText;
		modal.classList.remove('hidden');
		setTimeout(() => modal.classList.add('show'), 10);
		document.body.style.overflow = 'hidden';
	}

	function executeShare(platform) {
    const modal = document.getElementById('share-modal');
    const textSnippet = modal.dataset.fullContent || "";
    const bookTitle = document.getElementById('share-book-title').innerText;

    // --- Versión Optimizada de la URL ---
    // Obtenemos la ruta actual eliminando el nombre del archivo (index o lector)
    const currentPath = window.location.pathname;
    const directory = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
    const finalBase = window.location.origin + directory + "lector.html";
    // ------------------------------------

    const shareUrl = `${finalBase}?repo=${currentBook.repoIdx}&book=${encodeURIComponent(currentBook.fileName)}&ch=${currentChapterIndex}&ck=${currentChunkIndex}`;
    
    const fullMessage = `📚 *${bookTitle}*\n\n"${textSnippet}"\n\n🔗 Sigue leyendo aquí: ${shareUrl}`;

 
		let finalUrl = "";
		switch(platform) {
			case 'facebook':
				finalUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
				break;
			case 'reddit':
				finalUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent("Cita de: " + bookTitle)}`;
				break;
			case 'whatsapp':
				finalUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullMessage)}`;
				break;
			case 'x':
				const xMsg = `"${textSnippet.substring(0, 100)}..."`;
				finalUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(xMsg)}&url=${encodeURIComponent(shareUrl)}`;
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
				navigator.clipboard.writeText(fullMessage).then(() => {
					alert("Cita y enlace copiados al portapapeles");
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
            const isShown = el.classList.contains('show');
            document.querySelectorAll('.settings-dropdown').forEach(d => d.classList.remove('show'));
            if(!isShown) el.classList.add('show');
        }
        function changeFontFamily(f) {
            document.documentElement.style.setProperty('--reader-font-family', f);
            document.getElementById('current-font-label').innerText = f;
            document.getElementById('font-dropdown').classList.remove('show');
            document.querySelectorAll('#font-dropdown .setting-option').forEach(opt => {
                opt.classList.toggle('selected', opt.style.fontFamily.replace(/['"]/g, '') === f);
            });
        }
        function changeAlignment(align) {
            document.documentElement.style.setProperty('--reader-text-align', align);
            document.getElementById('align-dropdown').classList.remove('show');
            document.querySelectorAll('#align-dropdown .setting-option').forEach(opt => {
                opt.classList.toggle('selected', opt.getAttribute('onclick').includes(align));
            });
        }
        function changeLineHeight(h) {
            document.documentElement.style.setProperty('--reader-line-height', h);
            document.getElementById('spacing-dropdown').classList.remove('show');
            document.querySelectorAll('#spacing-dropdown .setting-option').forEach(opt => {
                opt.classList.toggle('selected', opt.getAttribute('onclick').includes(h));
            });
        }
        function changeFontSize(d) { 
            const val = document.getElementById('font-size-val'); 
            let s = Math.max(12, Math.min(60, parseInt(val.innerText) + d)); 
            val.innerText = s; 
            document.documentElement.style.setProperty('--reader-font-size', s + 'px');
        }
        function toggleDarkMode() { 
            isDarkMode = !isDarkMode; 
            const v = document.getElementById('reader-view'); 
            v.classList.toggle('dark-mode', isDarkMode); 
            v.classList.toggle('light-mode', !isDarkMode); 
        }