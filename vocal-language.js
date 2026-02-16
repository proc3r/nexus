/**
 * VOCAL-LANGUAGE.JS
 * Control de disponibilidad de voces y tiempos de lectura visual
 */
let visualTimerInterval = null;
let visualPausedTime = null; // Nueva variable global para el módulo
let visualTotalDuration = null;
let visualStartTime = null;

const SPEED_GRADIENTS = {
    "0.9": "linear-gradient(90deg, rgb(26 7 42 / 60%) 0%, rgb(160 29 213) 100%)", // Violeta
    "1.0": "linear-gradient(90deg, rgb(9 21 34 / 65%) 0%, rgb(24 137 217) 100%)", // Azul
    "1.1": "linear-gradient(90deg, rgb(21 92 27 / 65%) 0%, rgb(19 219 25) 100%)", // Verde
    "1.2": "linear-gradient(90deg, rgb(42 41 7 / 65%) 0%, rgb(235 188 17) 100%)", // Amarillo
    "1.3": "linear-gradient(90deg, rgb(38 22 11 / 84%) 0%, rgb(231 104 13) 100%)", // Naranja (Ajustado según tu petición)
    "1.4": "linear-gradient(90deg, rgb(68 16 16 / 66%) 0%, rgb(221 35 35) 100%)"  // Rojo
};

const SPEED_CONCEPTS = {
    "0.9": "6@", // Violeta
    "1.0": "5@", // Azul
    "1.1": "4@", // Verde
    "1.2": "3@", // Amarillo
    "1.3": "2@", // Naranja
    "1.4": "1@"  // Rojo
};

window.hasAvailableVoice = true; // Estado global

// 1. Verificador de voces con soporte asíncrono

function checkVoiceAvailability(langCode) {
    return new Promise((resolve) => {
        const voices = window.speechSynthesis.getVoices();
        const base = langCode.split('-')[0].toLowerCase();
        
        const findVoice = () => {
            const currentVoices = window.speechSynthesis.getVoices();
            // CUIDADO: Buscamos coincidencia real en la lista de voces del sistema
            const exists = currentVoices.some(v => 
                v.lang.toLowerCase().startsWith(base) || 
                v.lang.toLowerCase().includes(base)
            );
            console.log(`Nexus Vocal: Comprobando [${base}] -> ¿Voz física?: ${exists}`);
            return exists;
        };

        if (voices.length > 0) {
            resolve(findVoice());
        } else {
            window.speechSynthesis.onvoiceschanged = () => resolve(findVoice());
            setTimeout(() => resolve(findVoice()), 800);
        }
    });
}

// 2. Sincronización con el idioma elegido en el Traductor


async function syncLanguageSupport() {
    try {
        const preferred = localStorage.getItem('nexus_preferred_lang');
        const targetLang = preferred || 'es-ES';
        
        // Si no hay voces cargadas aún, no bloqueamos, devolvemos true por defecto
        // y dejamos que checkVoiceAvailability maneje la espera después.
        if (targetLang.startsWith('es')) {
            window.hasAvailableVoice = true;
        } else {
            window.hasAvailableVoice = await checkVoiceAvailability(targetLang);
        }
        return window.hasAvailableVoice;
    } catch (e) {
        console.warn("Nexus Vocal: Error en sincronización inicial, continuando...", e);
        window.hasAvailableVoice = true; 
        return true;
    }
}

// 3. Calculador de tiempo para la Barra de Progreso (Modo sin voz)
function calculateReadingTime(text) {
    if (!text) return 3500;
    
    // 1. LIMPIEZA DE CÓDIGO HTML
    // Esto elimina etiquetas como <span>, <font>, <b>, etc., para contar solo el texto visible.
    const cleanText = text.replace(/<[^>]*>/g, '');
    
    // 2. VELOCIDAD BASE
    const wordsPerMinuteBase = 120; 
    const words = cleanText.trim().split(/\s+/).length; // Contamos sobre el texto limpio
    
    // Tiempo base en milisegundos
    let baseTimeMs = (words / wordsPerMinuteBase) * 60 * 1000;
    
    const rate = window.readerSpeechRate || 1.0;

    // 3. TABLA DE CONTROL MANUAL (Rate Mapping)
    const rateMapping = {
        "0.9": 0.65,
        "1.0": 1.0, 
        "1.1": 1.3,
        "1.2": 1.6,
        "1.3": 1.9,
        "1.4": 2.3 
    };

    const effectiveRate = rateMapping[rate.toFixed(1)] || rate;

    // 4. CÁLCULO FINAL
    const finalTime = baseTimeMs / effectiveRate;

    console.log(`Nexus Vocal: Palabras reales: ${words} | Tiempo: ${Math.round(finalTime/1000)}s`);

    return Math.max(finalTime, 3500);
}

function showVisualTimer(duration) {
    const wrapper = document.getElementById('visual-timer-wrapper');
    const fill = document.getElementById('visual-timer-fill');
    const conceptEl = document.getElementById('visual-timer-concept');
    
    if (!wrapper || !fill) return;

    if (window.visualTimerInterval) clearTimeout(window.visualTimerInterval);

    const currentRate = (window.readerSpeechRate || 1.0).toFixed(1);
    fill.style.background = SPEED_GRADIENTS[currentRate] || SPEED_GRADIENTS["1.0"];
    
    if (conceptEl) {
        conceptEl.innerText = SPEED_CONCEPTS[currentRate] || "5@";
        conceptEl.style.transition = 'none';
        conceptEl.style.left = '0%';
    }
    
    fill.style.transition = 'none';
    fill.style.width = '0%';
    wrapper.classList.remove('hidden');
    
    fill.offsetHeight; // Reflow

    window.visualStartTime = Date.now();
    window.visualTotalDuration = duration;
    window.visualPausedTime = null; 

    // Aplicar animación a ambos
    fill.style.transition = `width ${duration}ms linear`;
    fill.style.width = '100%';

    if (conceptEl) {
        conceptEl.style.transition = `left ${duration}ms linear`;
        conceptEl.style.left = '100%';
    }

    window.visualTimerInterval = setTimeout(() => {
        if (window.isSpeaking && !window.isPaused && typeof nextChunk === 'function') {
            nextChunk();
        }
    }, duration);
}



// Función para pausar (si el usuario presiona PAUSE manualmente)
// Función para pausar (si el usuario presiona PAUSE manualmente)
function pauseVisualTimer() {
    const fill = document.getElementById('visual-timer-fill');
    const conceptEl = document.getElementById('visual-timer-concept');
    
    if (fill && window.visualStartTime) {
        // 1. Detener el reloj de JS inmediatamente
        if (window.visualTimerInterval) {
            clearTimeout(window.visualTimerInterval);
            window.visualTimerInterval = null;
        }

        // 2. Calcular exactamente cuánto tiempo faltaba
        const elapsed = Date.now() - window.visualStartTime;
        window.visualPausedTime = window.visualTotalDuration - elapsed;

        // 3. CONGELAR BARRA (Capturamos posición actual)
        const fillStyle = window.getComputedStyle(fill);
        const currentWidth = fillStyle.getPropertyValue('width');
        
        fill.style.transition = 'none';
        fill.style.width = currentWidth;

        // 4. CONGELAR CONCEPTO (@N)
        if (conceptEl) {
            const conceptStyle = window.getComputedStyle(conceptEl);
            const currentLeft = conceptStyle.getPropertyValue('left');
            
            conceptEl.style.transition = 'none';
            conceptEl.style.left = currentLeft; // Clava el número en su sitio
        }
        
        console.log("Nexus Vocal: Pausa sincronizada aplicada.");
    }
}

// NUEVA FUNCIÓN: Para reanudar sin ir a cero
function resumeVisualTimer() {
    const fill = document.getElementById('visual-timer-fill');
    const conceptEl = document.getElementById('visual-timer-concept');
    
    // Verificación de seguridad: si no hay tiempo pausado o la barra no existe, abortar
    if (!fill || window.visualPausedTime === null || window.visualPausedTime === undefined) return;

    const remaining = Math.max(window.visualPausedTime, 0); // Evitar números negativos
    
    // 1. Sincronizar marcas de tiempo para que la lógica interna no se pierda
    window.visualStartTime = Date.now() - (window.visualTotalDuration - remaining);
    window.visualPausedTime = null; // Limpiamos el estado de pausa

    // 2. RE-INICIAR ANIMACIONES (Forzamos un pequeño reflow para asegurar el arranque)
    fill.offsetHeight; 

    // Reanudar Barra hacia el final
    fill.style.transition = `width ${remaining}ms linear`;
    fill.style.width = '100%';

    // Reanudar Concepto (@N) hacia el final
    if (conceptEl) {
        conceptEl.style.transition = `left ${remaining}ms linear`;
        conceptEl.style.left = '100%';
    }

    // 3. Volver a programar el salto automático al siguiente chunk
    if (window.visualTimerInterval) clearTimeout(window.visualTimerInterval);
    window.visualTimerInterval = setTimeout(() => {
        // Solo saltar si el usuario no ha vuelto a pausar o detener
        if (window.isSpeaking && !window.isPaused) {
            if (typeof nextChunk === 'function') nextChunk();
        }
    }, remaining);

    console.log(`Nexus Vocal: Reanudando lectura. Restan ${Math.round(remaining/1000)}s`);
}



function updateVisualTimerSpeed() {
    const fill = document.getElementById('visual-timer-fill');
    const conceptEl = document.getElementById('visual-timer-concept');
    
    if (window.hasAvailableVoice === false && window.isSpeaking && !window.isPaused && fill) {
        
        // 1. OBTENER NUEVOS VALORES
        const currentRate = (window.readerSpeechRate || 1.0).toFixed(1);
        const newGradient = SPEED_GRADIENTS[currentRate] || SPEED_GRADIENTS["1.0"];
        
        // 2. CAPTURAR POSICIÓN ACTUAL (Sincronizada para ambos)
        const computedStyle = window.getComputedStyle(fill);
        const currentWidth = computedStyle.getPropertyValue('width');
        
        // 3. APLICAR CAMBIOS VISUALES INSTANTÁNEOS
        fill.style.transition = 'none';
        fill.style.width = currentWidth;
        fill.style.background = newGradient; 
        
        if (conceptEl) {
            conceptEl.innerText = SPEED_CONCEPTS[currentRate] || "5@";
            conceptEl.style.transition = 'none';
            conceptEl.style.left = currentWidth; // El texto salta a la posición de la barra
        }
        
        if (parseFloat(currentRate) > 1.1) {
             fill.style.boxShadow = "0 0 0px #9b59b6";
        } else {
             fill.style.boxShadow = "0 0 0px #00d2ff";
        }

        fill.offsetHeight; // Reflow

        // 4. REANUDAR ANIMACIÓN FLUIDA
        const elapsedSinceStart = Date.now() - window.visualStartTime;
        const originalRemaining = window.visualTotalDuration - elapsedSinceStart;
        const safeRemaining = Math.max(originalRemaining, 0);

        // Reanudar barra
        fill.style.transition = `width ${safeRemaining}ms linear`;
        fill.style.width = '100%';

        // Reanudar concepto
        if (conceptEl) {
            conceptEl.style.transition = `left ${safeRemaining}ms linear`;
            conceptEl.style.left = '100%';
        }
    }
}

function stopVisualTimer() {
    if (window.visualTimerInterval) {
        clearTimeout(window.visualTimerInterval);
        window.visualTimerInterval = null;
    }

    const wrapper = document.getElementById('visual-timer-wrapper');
    const fill = document.getElementById('visual-timer-fill');
    const conceptEl = document.getElementById('visual-timer-concept');

    if (wrapper) wrapper.classList.add('hidden'); // Ocultar sin mover el footer
    if (fill) {
        fill.style.transition = 'none';
        fill.style.width = '0%';
    }
    if (conceptEl) {
        conceptEl.style.transition = 'none';
        conceptEl.style.left = '0%';
    }
}


setTimeout(() => {
    syncLanguageSupport();
}, 500); // Pequeño delay para que Google Translate termine de setear el idioma

window.addEventListener('load', () => {
    syncLanguageSupport().then(() => {
        console.log("Nexus Vocal: Sistema listo tras carga de página.");
    });
});