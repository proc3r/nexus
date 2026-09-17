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


// Objeto global para almacenar las sinopsis en memoria
window.nexusSynopsisMap = {};

async function fetchGlobalSynopsis() {
    const url = "http://localhost/documentos/sinopsis.md";
    window.nexusSynopsisMap = {}; 
    
    try {
        const response = await fetch(url);
        const text = await response.text();
        
        // Dividimos por el símbolo # al inicio de la línea
        const bloques = text.split(/^#\s+/gm);
        
        bloques.forEach(bloque => {
            if (!bloque.trim()) return;
            
            const lineas = bloque.split('\n');
            // Limpiamos el nombre: quitamos corchetes y la extensión .md si existiera
            const tituloRaw = lineas[0].trim();
            const nombreLimpio = tituloRaw.replace(/[\[\]]/g, '').replace('.md', '').trim();
            
            const contenido = lineas.slice(1).join('\n').trim();
            
            if (nombreLimpio && contenido) {
                window.nexusSynopsisMap[nombreLimpio] = contenido;
                console.log(`📖 Sinopsis cargada: [${nombreLimpio}]`);
            }
        });
        
    } catch (e) {
        console.error("❌ Error cargando sinopsis.md:", e);
    }
}

// --- GESTIÓN DE MODAL DE SINOPSIS ---

function showSynopsis(bookId) {
    const book = library.find(b => b.id === bookId);
    if (!book) return;

    // 1. Definimos la clave que buscamos (nombre del archivo sin .md)
    const targetName = book.fileName.replace('.md', '').trim().toLowerCase();
    
    // 2. Buscamos en el mapa global ignorando mayúsculas/minúsculas y espacios
    const allKeys = Object.keys(window.nexusSynopsisMap || {});
    const foundKey = allKeys.find(key => key.toLowerCase().trim() === targetName);
    
    const synopsisContent = foundKey ? window.nexusSynopsisMap[foundKey] : null;

    if (synopsisContent) {
        console.log("🎯 Match de sinopsis encontrado:", foundKey);
        
        const modal = document.getElementById('synopsis-modal');
        const body = document.getElementById('synopsis-body');
        const btnPlay = document.getElementById('btn-synopsis-tts');

        // --- DETECCIÓN DE IDIOMA PARA TRADUCCIÓN ---
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
                modalContent.appendChild(loader);
            }
            loader.style.opacity = '1';
            loader.classList.remove('hidden');
            if (btnPlay) btnPlay.disabled = true;
        }

        if (body) {
			
            body.style.userSelect = 'none';
            body.style.webkitUserSelect = 'none';
			
        }

        // --- PROCESAMIENTO DEL TEXTO (Markdown a HTML) ---
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
        
        // --- EFECTO DE BARRIDO PARA TRADUCTORES ---
        if (isTranslated) {
            setTimeout(() => {
                const totalHeight = body.scrollHeight;
                body.scrollTo({ top: totalHeight, behavior: 'smooth' });
                
                setTimeout(() => {
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
        
        // Configuración de botones de acción
        const readBtn = document.getElementById('btn-synopsis-read');
        if (readBtn) {
            readBtn.onclick = (e) => {
                e.preventDefault();
                closeSynopsis();
                openReader(bookId);
            };
        }
                                
        modal.onclick = (e) => {
            if (e.target.id === 'synopsis-modal') closeSynopsis();
        };
    } else {
        console.warn(`⚠️ No se encontró sinopsis para el archivo: ${book.fileName}`);
        console.log("Claves cargadas en memoria:", allKeys);
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
    // 1. Detenemos el audio y reanudamos el podcast (usando la función que ya lo hace)
    stopSynopsisTTS(); 
    
    // 2. Cerramos el modal visualmente
    const modal = document.getElementById('synopsis-modal');
    const body = document.getElementById('synopsis-body');
    
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = ''; // Devolvemos el scroll a la página principal
    if (body) body.scrollTop = 0;      // Reseteamos el scroll interno para la próxima vez
    
    // 3. Limpiamos el timer de las imágenes (si existe)
    if (typeof imageTimer !== 'undefined' && imageTimer) {
        clearInterval(imageTimer);
        imageTimer = null;
    }
    console.log("📌 Modal de sinopsis cerrado.");
}
// --- LÓGICA DE VOZ PARA SINOPSIS ---

function startSynopsisTTS() {
    // 1. GESTIÓN DE AUDIO PREVIO (Podcast)
    // Guardamos el estado para reanudarlo al terminar la lectura
    if (typeof podAudioInstance !== 'undefined' && podAudioInstance && !podAudioInstance.paused) {
        window.wasPodcastPlayingBeforeTTS = true;
        if (typeof togglePodcastPlay === 'function') togglePodcastPlay(false);
    } else {
        window.wasPodcastPlayingBeforeTTS = false;
    }

    const body = document.getElementById('synopsis-body');
    if (!body) return;
    
    // 2. LIMPIEZA DE SÍNTESIS PREVIA
    window.speechSynthesis.cancel();
    if (window.synth) window.synth.cancel();
    synopsisSubChunks = [];
    currentSynopsisIdx = 0;

    // 3. PREPARACIÓN DEL TEXTO 
    // Captura el texto del DOM (si hubo barrido de traducción, ya vendrá traducido)
    let textToRead = body.innerText; 

    // Limpieza de formato Markdown y caracteres especiales
    textToRead = textToRead.replace(/^>\s*-\s*/gm, "… ");
    textToRead = textToRead.replace(/^-\s+/gm, "… ");
    textToRead = textToRead.replace(/([a-zA-ZáéíóúÁÉÍÓÚ])\s*-\s*([a-zA-ZáéíóúÁÉÍÓÚ])/g, "$1 … $2");
    textToRead = textToRead.replace(/\*\*\*/g, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/_/g, '');
    textToRead = textToRead.replace(/\s+-\s+([a-zA-Z])/g, " … $1");
    textToRead = textToRead.replace(/([a-zA-ZáéíóúÁÉÍÓÚ0-9])\s*—\s*([a-zA-ZáéíóúÁÉÍÓÚ])/g, "$1,$2");

    // Gestión de Interfaz: Ocultar Play, Mostrar Stop
    const btnPlay = document.getElementById('btn-synopsis-tts');
    const btnStop = document.getElementById('btn-synopsis-stop');
    if (btnPlay) btnPlay.classList.add('hidden');
    if (btnStop) btnStop.classList.remove('hidden');

    // Segmentación inteligente (usando el límite de 140 caracteres para mejor entonación)
    if (typeof splitTextSmartly === 'function') {
        synopsisSubChunks = splitTextSmartly(textToRead, 140);
    } else {
        synopsisSubChunks = [textToRead];
    }

    // 4. FUNCIÓN INTERNA DE LOCUCIÓN (Recursiva)
    function speakNextSynopsis() {
        const modal = document.getElementById('synopsis-modal');
        const modalVisible = modal && !modal.classList.contains('hidden');
        
        // Finalización por fin de texto o cierre del modal
        if (!modalVisible || currentSynopsisIdx >= synopsisSubChunks.length) {
            stopSynopsisTTS(); // Esta función debe encargarse de reanudar el podcast
            return;
        }

        const currentText = synopsisSubChunks[currentSynopsisIdx].trim();
        if (currentText.length === 0) {
            currentSynopsisIdx++;
            speakNextSynopsis();
            return;
        }

        const utter = new SpeechSynthesisUtterance(currentText);

        // --- AJUSTE DE IDIOMA DINÁMICO ---
        // Ahora usará la versión corregida que detecta si el original está abierto
        utter.lang = (typeof getTTSLanguageCode === 'function') ? getTTSLanguageCode() : 'es-ES';
        
        // --- AJUSTE DE VELOCIDAD ---
        // Sincronizamos con el lector principal (window.readerSpeechRate) 
        // o con la de la sinopsis si esa falla.
       // utter.rate = window.readerSpeechRate || synopsisSpeechRate || 1.1;
		utter.rate = synopsisSpeechRate; // <--- Cambiado de 1.0 a la variable
		
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

        // Limpieza de cualquier audio residual justo antes de hablar
        window.speechSynthesis.cancel(); 
        window.speechSynthesis.speak(utter);
    }

    // Iniciar la cadena de locución
    speakNextSynopsis();
}


function stopSynopsisTTS() {
    window.speechSynthesis.cancel();
    synopsisSubChunks = [];
    currentSynopsisIdx = 0;
    isSynopsisReading = false;

    // Actualizar botones
    const btnStop = document.getElementById('btn-synopsis-stop');
    const btnPlay = document.getElementById('btn-synopsis-tts');
    if (btnStop) btnStop.classList.add('hidden');
    if (btnPlay) btnPlay.classList.remove('hidden');
    
    // --- ESTA ES LA PARTE CLAVE ---
    if (window.wasPodcastPlayingBeforeTTS) {
        console.log("▶️ Reanudando podcast tras cerrar sinopsis...");
        if (typeof togglePodcastPlay === 'function') {
            togglePodcastPlay(true);
        }
        window.wasPodcastPlayingBeforeTTS = false;
    }
}

function renderSynopsisContent(content) {
    const synopsisBody = document.getElementById('synopsis-body-content'); // Ajusta al ID real
    if (synopsisBody) {
        // Añadimos 'notranslate' para evitar que Google inyecte etiquetas que capten clics
        synopsisBody.classList.add('notranslate');
        synopsisBody.innerHTML = content;
    }
}


// Cierre de modal al hacer clic fuera del contenido
window.addEventListener('click', function(event) {
    const modal = document.getElementById('synopsis-modal');
    // Si el clic fue exactamente en el fondo del modal (y no en sus hijos)
    if (event.target === modal) {
        closeSynopsis();
    }
});


// Forzar la carga apenas cargue este archivo JS
(function() {
    console.log("🚀 Nexus Synopsis: Auto-ejecución iniciada");
    fetchGlobalSynopsis();
})();