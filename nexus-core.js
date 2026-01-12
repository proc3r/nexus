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
        
        let imageTimer = null;
        let imageSecondsLeft = 5;
        let isImageTimerPaused = false;

        const GITHUB_API_URL = "https://api.github.com/repos/proc3r/001-Publicados/contents/";
        const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/proc3r/001-Publicados/master/adjuntos/";
        const DEFAULT_COVER = "https://raw.githubusercontent.com/proc3r/001-Publicados/refs/heads/master/adjuntos/PortadaBase.jpg";
        
        let synth = window.speechSynthesis;

        window.onload = () => {
            fetchBooks().then(() => {
                checkLastSession();
            });
            initTouchEvents();
            initPullToRefreshBlocker();
            setTimeout(() => { window.scrollTo(0, 1); }, 300);
        };

        function initPullToRefreshBlocker() {
            let touchStart = 0;
            const libraryContainer = document.getElementById('library-container');
            const readerContainer = document.getElementById('reading-container-fixed');
            
            document.addEventListener('touchstart', (e) => {
                touchStart = e.touches[0].pageY;
            }, { passive: true });

            document.addEventListener('touchmove', (e) => {
                const touchMove = e.touches[0].pageY;
                const activeContainer = document.getElementById('reader-view').classList.contains('hidden') 
                    ? libraryContainer 
                    : readerContainer;

                const isAtTop = activeContainer.scrollTop <= 0;
                const isSwipingDown = touchMove > touchStart;

                if (isAtTop && isSwipingDown) {
                    if (e.cancelable) e.preventDefault();
                }
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
                const resumeCard = document.getElementById('resume-card');
                const chapterLabel = document.getElementById('resume-chapter-label');
                const bookLabel = document.getElementById('resume-book-label');
                chapterLabel.innerText = data.chapterTitle || "Sección desconocida";
                bookLabel.innerText = data.bookTitle || "Libro desconocido";
                resumeCard.classList.remove('hidden');
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
            try {
                const response = await fetch(GITHUB_API_URL);
                const files = await response.json();
                const mdFiles = files.filter(f => f.name.toLowerCase().endsWith('.md'));
                
                for (const file of mdFiles) {
                    const res = await fetch(file.download_url);
                    const text = await res.text();
                    const coverMatch = text.match(/!\[\[(.*?)\]\]/);
                    let coverUrl = null;
                    if (coverMatch) coverUrl = GITHUB_RAW_BASE + encodeURIComponent(coverMatch[1].trim());

                    library.push({
                        id: btoa(file.path),
                        title: file.name.replace('.md', '').replace(/_/g, ' '),
                        cover: coverUrl,
                        chapters: parseMarkdown(text)
                    });
                }
                statusText.innerText = "Sincronizado";
                document.getElementById('main-spinner').classList.add('hidden');
                renderLibrary();
            } catch (e) {
                statusText.innerText = "Error API";
            }
        }

        function parseMarkdown(text) {
            const lines = text.split('\n');
            const chapters = [];
            let currentChapter = null;
            lines.forEach(line => {
                const titleMatch = line.match(/^(#+)\s+(.*)/);
                if (titleMatch) {
                    if (currentChapter) chapters.push(currentChapter);
                    currentChapter = { level: titleMatch[1].length, title: titleMatch[2].trim(), content: [] };
                    currentChapter.content.push(line.trim()); 
                } else if (line.trim() !== "") {
                    if (!currentChapter) currentChapter = { level: 1, title: "Inicio", content: [] };
                    currentChapter.content.push(line.trim());
                }
            });
            if (currentChapter) chapters.push(currentChapter);
            return chapters;
        }

         function renderLibrary() {
            const grid = document.getElementById('library-grid');
            grid.innerHTML = library.length ? '' : '<div class="col-span-full py-32 text-center opacity-20 italic text-white">No hay libros disponibles.</div>';
            library.forEach(book => {
                let totalWords = 0;
                book.chapters.forEach(ch => {
                    ch.content.forEach(text => {
                        totalWords += (text || "").split(/\s+/).filter(w => w.length > 0).length;
                    });
                });
                const totalMins = Math.ceil(totalWords / 185);
                const timeStr = totalMins >= 60 ? `${Math.floor(totalMins/60)}h ${totalMins%60}m` : `${totalMins} min`;
                const card = document.createElement('div');
                card.className = 'book-card group relative bg-white/5 border border-white/10 rounded-[2.5rem] hover:border-[#ffcc00] transition-all cursor-pointer text-center';
                card.onclick = () => openReader(book.id);
                const finalCover = book.cover ? book.cover : DEFAULT_COVER;
                card.innerHTML = `
                    <div class="book-card-cover"><img src="${finalCover}" alt="Cover" loading="lazy"></div>
                    <h3 class="text-2xl pt-2 px-2 font-bold text-white leading-tight uppercase tracking-tighter condensed">${book.title}</h3>
                    <div class="flex items-center justify-center pb-3 gap-2 mt-3">
                        <p class="text-[13px] opacity-90 uppercase tracking-normal condensed">${book.chapters.length} secciones</p>
                        <span class="text-[13px] opacity-90">•</span>
                        <p class="text-[13px] text-[#ffcc00] font-bold uppercase tracking-normal condensed italic">
                            <span class="mi-round text-[13px] align-middle mr-1" style="padding-bottom: 2px;">schedule</span>${timeStr}
                        </p>
                    </div>
                `;
                grid.appendChild(card);
            });
        }

        function openReader(id) {
            currentBook = library.find(b => b.id === id);
            document.getElementById('reader-title').innerText = currentBook.title;
            renderTOC();
            renderProgressMarkers();
            document.getElementById('library-container').classList.add('hidden');
            document.getElementById('reader-view').classList.remove('hidden');
            document.getElementById('resume-card').classList.add('hidden');

            // Inicialización de UI según dispositivo
            const isMobile = window.innerWidth <= 768;
            const defFontSize = isMobile ? 17 : 25;
            const defFontName = isMobile ? 'Atkinson Hyperlegible' : 'Merriweather';

            document.getElementById('font-size-val').innerText = defFontSize;
            document.getElementById('current-font-label').innerText = defFontName;
            
            // Forzamos actualización de variables CSS según el estado de la UI inicial
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
            document.getElementById('chapter-indicator').innerText = chapter.title;
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

        function renderChunk() {
            clearImageTimer();
            const content = document.getElementById('book-content');
            let rawText = chunks[currentChunkIndex] || "";
            if (rawText.trim() === ">") { if (window.navDirection === 'prev') prevChunk(); else nextChunk(); return; }

            let finalHtml = "";
            let isImage = false;
            const imgMatch = rawText.match(/!\[\[(.*?)\]\]/);
            
            if (imgMatch) {
                isImage = true;
                const fileName = imgMatch[1].trim();
                const imageUrl = GITHUB_RAW_BASE + encodeURIComponent(fileName);
                finalHtml = `<div class="reader-image-container"><img src="${imageUrl}" class="reader-image" alt="${fileName}"></div>`;
            } else if (rawText.trim().startsWith('#')) {
                finalHtml = `<div class="reader-section-title">${rawText.replace(/^#+\s+/, '').trim()}</div>`;
            } else if (rawText.trim().startsWith('>')) {
                finalHtml = `<div class="custom-blockquote">${processFormatting(rawText.trim().substring(1).trim())}</div>`;
            } else {
                finalHtml = processFormatting(rawText);
            }

            content.innerHTML = finalHtml;
            document.getElementById('reading-container-fixed').scrollTop = 0;
            updateProgress();
            saveProgress();
            
            if (currentChunkIndex === chunks.length - 1 && currentChapterIndex === currentBook.chapters.length - 1) {
                document.getElementById('next-btn').innerHTML = "FIN";
            } else {
                document.getElementById('next-btn').innerHTML = "NEXT ▶";
            }

            if (isSpeaking) {
                if (isImage) startImageTimer();
                else prepareAndStartSpeech();
            }
        }

        function toggleSpeech() { 
            if (isPaused) resumeSpeech(); 
            else if (isSpeaking) stopSpeech(); 
            else startSpeech(); 
        }

        function startSpeech() {
            isSpeaking = true; isPaused = false;
            document.getElementById('tts-btn').classList.add('hidden');
            document.getElementById('pause-btn').classList.remove('hidden');
            document.getElementById('stop-btn').classList.remove('hidden');
            updatePauseUI(false);
            
            const isImage = (chunks[currentChunkIndex] || "").match(/!\[\[(.*?)\]\]/);
            if (isImage) startImageTimer();
            else prepareAndStartSpeech();
        }

        function pauseSpeech() { 
            if (synth.speaking && !isPaused) { 
                synth.pause(); 
                isPaused = true; 
                updatePauseUI(true); 
            } else if (isPaused) {
                resumeSpeech();
            }
            if (imageTimer) isImageTimerPaused = true;
        }

        function resumeSpeech() { 
            synth.resume(); 
            isPaused = false; 
            updatePauseUI(false); 
            if ((chunks[currentChunkIndex] || "").match(/!\[\[(.*?)\]\]/)) {
                isImageTimerPaused = false;
                if (!imageTimer) startImageTimer();
            }
        }

        function updatePauseUI(paused) {
            const icon = document.getElementById('pause-icon');
            icon.innerHTML = paused ? '&#xe037;' : '&#xe1a2;';
        }

        function stopSpeech() {
            synth.cancel(); 
            isSpeaking = false; isPaused = false;
            clearImageTimer();
            document.getElementById('tts-btn').classList.remove('hidden');
            document.getElementById('pause-btn').classList.add('hidden');
            document.getElementById('stop-btn').classList.add('hidden');
            updatePauseUI(false);
        }

        function prepareAndStartSpeech() {
            if (isPaused) synth.resume(); 
            synth.cancel();
            isPaused = false;
            updatePauseUI(false);

            const text = document.getElementById('book-content').innerText;
            if(!text.trim()) return;
            speechSubChunks = splitTextSmartly(text, 140);
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
            if (isImageTimerPaused) { textEl.innerText = "Pausado. Presione REANUDAR o NEXT."; btnEl.innerText = "Reanudar"; }
            else { textEl.innerText = `Comenzando en ${imageSecondsLeft}s`; btnEl.innerText = "Pausar"; }
        }

        function togglePauseImageTimer() { isImageTimerPaused = !isImageTimerPaused; isPaused = isImageTimerPaused; updatePauseUI(isPaused); updateTimerDisplay(); }
        function clearImageTimer() { if (imageTimer) clearInterval(imageTimer); imageTimer = null; document.getElementById('image-timer').classList.add('hidden'); }

        function processFormatting(str) {
            return str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/[*_](.*?)[*_]/g, '<em>$1</em>');
        }

        function nextChunk() { 
            window.navDirection = 'next'; 
            clearImageTimer(); 
            if (isSpeaking && isPaused) { synth.resume(); isPaused = false; updatePauseUI(false); }
            if (isSpeaking) synth.cancel(); 

            if (currentChunkIndex < chunks.length - 1) { 
                currentChunkIndex++; 
                renderChunk(); 
            } else if (currentChapterIndex < currentBook.chapters.length - 1) { 
                loadChapter(currentChapterIndex + 1); 
            } 
        }

        function prevChunk() { 
            window.navDirection = 'prev'; 
            clearImageTimer(); 
            if (isSpeaking && isPaused) { synth.resume(); isPaused = false; updatePauseUI(false); }
            if (isSpeaking) synth.cancel(); 

            if (currentChunkIndex > 0) { 
                currentChunkIndex--; 
                renderChunk(); 
            } else if (currentChapterIndex > 0) { 
                currentChapterIndex--; 
                loadChapter(currentChapterIndex); 
                currentChunkIndex = chunks.length - 1; 
                renderChunk(); 
            } 
        }

        function jumpToChapter(idx) { 
            let wasSpeaking = isSpeaking;
            stopSpeech(); 
            loadChapter(idx); 
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
            if (mins < 1) timeEl.innerText = "Menos de 1 min restante";
            else if (mins < 60) timeEl.innerText = `${Math.ceil(mins)} min restantes`;
            else timeEl.innerText = `${Math.floor(mins/60)}h ${Math.ceil(mins%60)}m restantes`;
        }

        function renderTOC() {
            const list = document.getElementById('chapter-list');
            list.innerHTML = '';
            currentBook.chapters.forEach((ch, i) => {
                const item = document.createElement('div');
                item.className = `toc-item pr-4`;
                item.id = `toc-item-${i}`;
                const hasChildren = (i < currentBook.chapters.length - 1 && currentBook.chapters[i+1].level > ch.level);
                item.innerHTML = `<div class="flex items-start group"><span class="toc-toggle text-[10px] mt-1" onclick="toggleTOCSection(${i}, event)">${hasChildren ? '+' : '•'}</span><span class="toc-text cursor-pointer hover:text-[#ff4444] transition-colors truncate flex-1 condensed uppercase tracking-tight text-[17px]" onclick="jumpToChapter(${i})">${ch.title}</span></div><div id="child-container-${i}" class="hidden mt-1 pl-2"></div>`;
                if (ch.level === 1) list.appendChild(item);
                else {
                    const parents = list.querySelectorAll('.toc-item');
                    for(let p = parents.length - 1; p >= 0; p--) {
                        if (currentBook.chapters[parseInt(parents[p].id.split('-').pop())].level < ch.level) { parents[p].querySelector(`[id^="child-container-"]`).appendChild(item); break; }
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
            currentBook.chapters.forEach((ch, i) => {
                if (ch.level > 2) return;
                const pos = (i / currentBook.chapters.length) * 100;
                const marker = document.createElement('div');
                marker.className = `progress-marker`;
                marker.style.left = `${pos}%`;
                marker.innerHTML = ch.level === 1 ? `<div class="marker-h1-dot"></div>` : `<div class="marker-h2-line"></div>`;
                const tooltip = document.createElement('div');
                tooltip.className = 'marker-tooltip condensed';
                tooltip.innerText = ch.title;
                marker.appendChild(tooltip);
                marker.onclick = (e) => { e.stopPropagation(); jumpToChapter(i); };
                container.appendChild(marker);
            });
        }

        function openSidebar() { document.getElementById('reader-sidebar').classList.add('open'); document.getElementById('sidebar-trigger').classList.add('hidden'); if (sidebarTimer) clearTimeout(sidebarTimer); }
        function closeSidebar() { document.getElementById('reader-sidebar').classList.remove('open'); document.getElementById('sidebar-trigger').classList.remove('hidden'); }
        function handleSidebarLeave() { if (isPinned) return; sidebarTimer = setTimeout(() => { closeSidebar(); }, 1200); }
        function togglePin() { isPinned = !isPinned; document.getElementById('reader-sidebar').classList.toggle('pinned', isPinned); document.getElementById('pin-btn').classList.toggle('opacity-100', isPinned); }
        function initTouchEvents() {
            const sidebar = document.getElementById('reader-sidebar');
            let startX = 0;
            sidebar.addEventListener('touchstart', e => startX = e.touches[0].clientX, {passive: true});
            sidebar.addEventListener('touchend', e => {
                if (startX - e.changedTouches[0].clientX > 50) closeSidebar();
            }, {passive: true});
        }