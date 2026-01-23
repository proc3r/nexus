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
			card.className = 'book-card group relative bg-white/5 border border-white/10 rounded-[0.5rem] hover:border-[#ffcc00] transition-all cursor-pointer text-center overflow-hidden';
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

// --- GESTIÓN DE MODAL DE SINOPSIS ---

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
			setTimeout(() => {
				body.scrollTop = 0;
			}, 10);
			const readBtn = document.getElementById('btn-synopsis-read');
			readBtn.onclick = (e) => {
				e.preventDefault();
									
				closeSynopsis();
				openReader(bookId);
			};
			modal.classList.remove('hidden');
			document.body.style.overflow = 'hidden';
			modal.onclick = (e) => {
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
		const body = document.getElementById('synopsis-body');
		if (!body) return;
		window.speechSynthesis.cancel();
		synth.cancel();
		synopsisSubChunks = [];
		currentSynopsisIdx = 0;
		let textToRead = body.innerText;
		textToRead = textToRead.replace(/^>\s*-\s*/gm, "… ");
		textToRead = textToRead.replace(/^-\s+/gm, "… ");
		textToRead = textToRead.replace(/([a-zA-ZáéíóúÁÉÍÓÚ])\s*-\s*([a-zA-ZáéíóúÁÉÍÓÚ])/g, "$1 … $2");
		textToRead = textToRead.replace(/\*\*\*/g, '')
							   .replace(/\*\*/g, '')
							   .replace(/\*/g, '')
							   .replace(/_/g, '');
		textToRead = textToRead.replace(/\s+-\s+([a-zA-Z])/g, " … $1");
		textToRead = textToRead.replace(/([a-zA-ZáéíóúÁÉÍÓÚ0-9])\s*—\s*([a-zA-ZáéíóúÁÉÍÓÚ])/g, "$1,$2");
		document.getElementById('btn-synopsis-tts').classList.add('hidden');
		document.getElementById('btn-synopsis-stop').classList.remove('hidden');
		synopsisSubChunks = splitTextSmartly(textToRead, 140);
		function speakNextSynopsis() {
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

