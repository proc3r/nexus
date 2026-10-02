/**
 * NEXUS SYNOPSIS MODULE - Optimizado para GitHub Pages
 * Maneja la visualización de la biblioteca, modales de sinopsis y TTS.
 */

// --- CONFIGURACIÓN DE ENTORNO ---
const CONFIG_SYNOPSIS = {
    // Cambiar a false al publicar en GitHub Pages
    IS_LOCAL: false, 
    LOCAL_URL: "http://localhost/documentos/sinopsis.md",
    REMOTE_URL: "https://raw.githubusercontent.com/proc3r/nexus/refs/heads/main/Sinopsis.md" // O la URL Raw de GitHub cuando esté activo
};

// Variables de estado
let synopsisSpeechRate = 1.1;
let imageTimer = null;
let imageSecondsLeft = 5;
let isImageTimerPaused = false;
let synopsisSubChunks = [];
let currentSynopsisIdx = 0;
let synopsisScrollTimeout1 = null;
let synopsisScrollTimeout2 = null;

// Objeto global para almacenar las sinopsis en memoria
window.nexusSynopsisMap = {};

async function fetchGlobalSynopsis() {
    const url = CONFIG_SYNOPSIS.IS_LOCAL 
        ? CONFIG_SYNOPSIS.LOCAL_URL 
        : CONFIG_SYNOPSIS.REMOTE_URL;
        
    window.nexusSynopsisMap = {}; 
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const text = await response.text();
        
        // Dividimos por el símbolo # al inicio de la línea
        const bloques = text.split(/^#\s+/gm);
        
        bloques.forEach(bloque => {
            if (!bloque.trim()) return;
            
            const lineas = bloque.split('\n');
            const tituloRaw = lineas[0].trim();
            const nombreLimpio = tituloRaw.replace(/[\[\]]/g, '').replace('.md', '').trim();
            const contenido = lineas.slice(1).join('\n').trim();
            
            if (nombreLimpio && contenido) {
                window.nexusSynopsisMap[nombreLimpio] = contenido;
            }
        });
        console.log(`📖 Sinopsis cargadas con éxito (${Object.keys(window.nexusSynopsisMap).length} libros)`);
        
    } catch (e) {
        console.warn("⚠️ No se pudo cargar sinopsis.md:", e.message);
    }
}

// --- GESTIÓN DE MODAL DE SINOPSIS ---

function showSynopsis(bookId) {
    // Validación de seguridad para la librería
    if (typeof library === 'undefined' || !Array.isArray(library)) return;

    const book = library.find(b => b.id === bookId);
    if (!book) return;

    const targetName = (book.fileName || book.name || "").replace('.md', '').trim().toLowerCase();
    const allKeys = Object.keys(window.nexusSynopsisMap || {});
    const foundKey = allKeys.find(key => key.toLowerCase().trim() === targetName);
    
    const synopsisContent = foundKey ? window.nexusSynopsisMap[foundKey] : null;

    if (synopsisContent) {
        const modal = document.getElementById('synopsis-modal');
        const body = document.getElementById('synopsis-body');
        const btnPlay = document.getElementById('btn-synopsis-tts');

        if (!modal || !body) return;

        const isTranslated = document.documentElement.lang !== 'es';

        if (isTranslated) {
            let loader = document.getElementById('synopsis-loader');
            if (!loader) {
                loader = document.createElement('div');
                loader.id = 'synopsis-loader';
                loader.innerHTML = `
                    <div class="synopsis-spinner"></div>
                    <div class="synopsis-loader-text">SINCRONIZANDO...</div>
                `;
                const modalContent = modal.querySelector('.relative.bg-white\\/5') || modal.children[0];
                if (modalContent) modalContent.appendChild(loader);
            }
            if (loader) {
                loader.style.opacity = '1';
                loader.classList.remove('hidden');
            }
            if (btnPlay) btnPlay.disabled = true;
        }

        body.style.userSelect = 'none';
        body.style.webkitUserSelect = 'none';

        // Procesamiento Markdown a HTML
        const lines = synopsisContent.split('\n');
        let formattedHtml = "";
        
        const processMD = (str) => {
            return str
                .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/_(.*?)_/g, '<em>$1</em>');
        };

        lines.forEach(line => {
            let cleanLine = line.trim();
            if (!cleanLine) return;

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
        
        // Control de traducción y desplazamiento
        if (isTranslated) {
            synopsisScrollTimeout1 = setTimeout(() => {
                const totalHeight = body.scrollHeight;
                body.scrollTo({ top: totalHeight, behavior: 'smooth' });
                
                synopsisScrollTimeout2 = setTimeout(() => {
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
            if (btnPlay) btnPlay.disabled = false;
            body.scrollTop = 0;
        }
        
        const readBtn = document.getElementById('btn-synopsis-read');
        if (readBtn) {
            readBtn.onclick = (e) => {
                e.preventDefault();
                closeSynopsis();
                if (typeof openReader === 'function') openReader(bookId);
            };
        }
                                
        modal.onclick = (e) => {
            if (e.target.id === 'synopsis-modal') closeSynopsis();
        };
    } else {
        console.warn(`⚠️ No se encontró sinopsis para: ${targetName}`);
    }
}

function toggleSynopsisSpeedMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('synopsis-speed-menu');
    if (menu) menu.classList.toggle('hidden');
}

function setSynopsisSpeed(rate) {
    synopsisSpeechRate = rate;
    const label = document.getElementById('current-speed-label');
    if (label) label.innerText = rate + 'x';
    const menu = document.getElementById('synopsis-speed-menu');
    if (menu) menu.classList.add('hidden');
}

function closeSynopsis() {
    stopSynopsisTTS(); 
    
    // Limpieza de temporizadores de scroll
    if (synopsisScrollTimeout1) clearTimeout(synopsisScrollTimeout1);
    if (synopsisScrollTimeout2) clearTimeout(synopsisScrollTimeout2);

    const modal = document.getElementById('synopsis-modal');
    const body = document.getElementById('synopsis-body');
    
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = ''; 
    if (body) body.scrollTop = 0;      
    
    if (typeof imageTimer !== 'undefined' && imageTimer) {
        clearInterval(imageTimer);
        imageTimer = null;
    }
}

// --- LÓGICA DE VOZ PARA SINOPSIS (TTS) ---

function startSynopsisTTS() {
    if (typeof podAudioInstance !== 'undefined' && podAudioInstance && !podAudioInstance.paused) {
        window.wasPodcastPlayingBeforeTTS = true;
        if (typeof togglePodcastPlay === 'function') togglePodcastPlay(false);
    } else {
        window.wasPodcastPlayingBeforeTTS = false;
    }

    const body = document.getElementById('synopsis-body');
    if (!body) return;
    
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (window.synth) window.synth.cancel();
    synopsisSubChunks = [];
    currentSynopsisIdx = 0;

    let textToRead = body.innerText; 

    textToRead = textToRead.replace(/^>\s*-\s*/gm, "… ")
                           .replace(/^-\s+/gm, "… ")
                           .replace(/([a-zA-ZáéíóúÁÉÍÓÚ])\s*-\s*([a-zA-ZáéíóúÁÉÍÓÚ])/g, "$1 … $2")
                           .replace(/\*\*\*/g, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/_/g, '')
                           .replace(/\s+-\s+([a-zA-Z])/g, " … $1")
                           .replace(/([a-zA-ZáéíóúÁÉÍÓÚ0-9])\s*—\s*([a-zA-ZáéíóúÁÉÍÓÚ])/g, "$1,$2");

    const btnPlay = document.getElementById('btn-synopsis-tts');
    const btnStop = document.getElementById('btn-synopsis-stop');
    if (btnPlay) btnPlay.classList.add('hidden');
    if (btnStop) btnStop.classList.remove('hidden');

    if (typeof splitTextSmartly === 'function') {
        synopsisSubChunks = splitTextSmartly(textToRead, 140);
    } else {
        synopsisSubChunks = [textToRead];
    }

    function speakNextSynopsis() {
        const modal = document.getElementById('synopsis-modal');
        const modalVisible = modal && !modal.classList.contains('hidden');
        
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
        utter.lang = (typeof getTTSLanguageCode === 'function') ? getTTSLanguageCode() : 'es-ES';
        utter.rate = synopsisSpeechRate; 
        
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

        if (window.speechSynthesis) {
            window.speechSynthesis.cancel(); 
            window.speechSynthesis.speak(utter);
        }
    }

    speakNextSynopsis();
}

function stopSynopsisTTS() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    synopsisSubChunks = [];
    currentSynopsisIdx = 0;

    const btnStop = document.getElementById('btn-synopsis-stop');
    const btnPlay = document.getElementById('btn-synopsis-tts');
    if (btnStop) btnStop.classList.add('hidden');
    if (btnPlay) btnPlay.classList.remove('hidden');
    
    if (window.wasPodcastPlayingBeforeTTS) {
        if (typeof togglePodcastPlay === 'function') {
            togglePodcastPlay(true);
        }
        window.wasPodcastPlayingBeforeTTS = false;
    }
}

function renderSynopsisContent(content) {
    const synopsisBody = document.getElementById('synopsis-body-content');
    if (synopsisBody) {
        synopsisBody.classList.add('notranslate');
        synopsisBody.innerHTML = content;
    }
}

window.addEventListener('click', function(event) {
    const modal = document.getElementById('synopsis-modal');
    if (event.target === modal) {
        closeSynopsis();
    }
});

// Inicialización de la carga global de sinopsis
(function() {
    fetchGlobalSynopsis();
})();