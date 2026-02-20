// EJECUCIÓN INMEDIATA
// REEMPLAZO SEGURO PARA document.write
(function() {
    const preferredLang = localStorage.getItem('nexus_preferred_lang');
    if (preferredLang) {
        // En lugar de document.write, inyectamos un estilo al head de forma limpia
        const style = document.createElement('style');
        style.innerHTML = '#welcome-portal { display: none !important; }';
        document.head.appendChild(style);
    }
})();

let isNexusProcessingLang = false;

// traductor.js - Adaptación fiel del código original para Nexus

document.addEventListener("DOMContentLoaded", function () {
    let googleTranslateInitialized = false; 

    const translateOverlay = document.getElementById("translate-overlay");
    const welcomePortal = document.getElementById('welcome-portal');
    const isNewUser = !localStorage.getItem('nexus_preferred_lang');

    // Mover el widget al portal si es un usuario nuevo (Al cargar la página)
    if (isNewUser && welcomePortal) {
        const googleElement = document.getElementById('google_translate_element');
        const portalContainer = document.getElementById('google_portal_element');
        if (googleElement && portalContainer) {
            portalContainer.appendChild(googleElement);
			
        }
    }

// 1. GESTIÓN DE EVENTOS (Mapeo de botones .translate-toggle)
    document.body.addEventListener("click", function (event) {
        const btnAbrir = event.target.closest(".translate-toggle");
        
        if (btnAbrir && translateOverlay) {
            event.preventDefault();
            console.log("Botón de traducción presionado.");

            // MEJORA: Si el portal de bienvenida estaba abierto, lo cerramos
            if (welcomePortal) {
                welcomePortal.style.display = "none";
            }

            // Al abrir el modal normal, aseguramos que el widget de Google regrese a él
            const googleElement = document.getElementById('google_translate_element');
            const normalContainer = translateOverlay.querySelector('.overlay-content');
            
            if (googleElement && normalContainer) {
                // CAMBIO SEGURO: Usamos appendChild en lugar de insertBefore para evitar errores de jerarquía
                // Esto simplemente coloca el selector de Google al final del contenido del modal
                normalContainer.appendChild(googleElement);
            }

            // Alternar interfaz de traducción
            translateOverlay.style.display = translateOverlay.style.display === "none" ? "flex" : "none";

            if (!googleTranslateInitialized) {
                if (typeof googleTranslateElementInit === 'function') {
                    googleTranslateElementInit();
                }
                googleTranslateInitialized = true;
            }

            desactivarRestriccionesGoogleTranslate();
            window.addEventListener("scroll", cerrarMenuAlScroll);
        }

        // Mapeo del botón de cierre del modal NORMAL
        const btnCerrar = event.target.closest("#close-translate-overlay");
        if (btnCerrar && translateOverlay) {
            console.log("Botón de cierre presionado. Ocultando el menú de selección de idiomas.");
            translateOverlay.style.display = "none";
            activarRestriccionesGoogleTranslate();
            window.removeEventListener("scroll", cerrarMenuAlScroll);
        }
    });
   

   

// 2. FUNCIÓN DE SCROLL (Corregida para ser global)
    // Al quitar "function" y usar window. la hacemos visible para todo el archivo
    window.cerrarMenuAlScroll = function() {
        const translateOverlay = document.getElementById("translate-overlay"); // Aseguramos referencia
        if (translateOverlay && translateOverlay.style.display === "flex") {
            console.log("Scroll detectado. Cerrando el menú de selección de idiomas.");
            translateOverlay.style.display = "none";
            if (typeof activarRestriccionesGoogleTranslate === 'function') {
                activarRestriccionesGoogleTranslate();
            }
            window.removeEventListener("scroll", window.cerrarMenuAlScroll);
        }
    };
	
// 3. INICIALIZACIÓN DE GOOGLE (Configuración original - Ajuste: Sin 'es' en la lista)
window.googleTranslateElementInit = function() {
    new google.translate.TranslateElement({
        pageLanguage: "es",
        layout: google.translate.TranslateElement.InlineLayout.VERTICAL,
        autoDisplay: false,
        // CLAVE: Se elimina 'es' de esta lista para que el usuario use "Mostrar Original" 
        // y así evitar el bug de colisión del widget de Google.
        // includedLanguages: "en,zh-CN,hi,fr,ar,bn,pt,ru,id,ur,de,ja,it,tr,sw,ko,vi"
		
    }, "google_translate_element");

    setTimeout(() => {
        const googleTranslateDropdown = document.querySelector('.goog-te-combo');
        if (googleTranslateDropdown) {
            googleTranslateDropdown.addEventListener('change', async () => {
                // Bloqueo de re-entrada para evitar que Google anule el cambio
                if (isNexusProcessingLang) return;
                isNexusProcessingLang = true;

                const selectedLang = googleTranslateDropdown.value;
                console.log("Nexus: Google Widget detectó cambio a:", selectedLang);

                // Si es español, aseguramos limpieza total de cookies
                if (selectedLang === 'es') {
                    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + location.host;
                }

                localStorage.setItem('nexus_preferred_lang', selectedLang);
				aplicarDireccionGlobal(); 
				
                // Cerramos interfaces
                const portal = document.getElementById("welcome-portal");
                const overlay = document.getElementById("translate-overlay");
                if (portal) portal.style.display = "none";
                if (overlay) overlay.style.display = "none";
                
                // Aumentamos el delay a 400ms para que Google asiente el DOM
                // antes de que nexus-voice intente leerlo
                setTimeout(() => {
                    cambiarIdioma(selectedLang);
                    isNexusProcessingLang = false; // Liberamos el bloqueo
                }, 400); 

                if (typeof activarRestriccionesGoogleTranslate === 'function') {
                    activarRestriccionesGoogleTranslate();
                }
            });
        }
    }, 800);
}

    // 4. ELIMINAR TOOLTIPS (MutationObserver original)
    function eliminarGoogleTranslateTooltips() {
        const tooltips = document.querySelectorAll('#goog-gt-tt, .goog-te-balloon-frame, .goog-tooltip, .VIpgJd-suEOdc');
        tooltips.forEach(tooltip => tooltip.remove());
    }

    const observer = new MutationObserver(() => {
        eliminarGoogleTranslateTooltips();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // 5. FUNCIONES DE RESTRICCIÓN (Copiadas exactamente de tu código)
    function desactivarRestriccionesGoogleTranslate() {
        const styleTag = document.getElementById("custom-google-translate-style");
        if (styleTag) {
            styleTag.remove(); 
        }

        const googleTranslateDropdown = document.querySelector('.goog-te-combo');
        if (googleTranslateDropdown) {
            googleTranslateDropdown.style.pointerEvents = 'auto';
        }
    }
	
	
	

    function activarRestriccionesGoogleTranslate() {
        // Evitar duplicados
        if (document.getElementById("custom-google-translate-style")) return;

        const styleTag = document.createElement("style");
        styleTag.id = "custom-google-translate-style";
        styleTag.innerHTML = `
            .goog-te-banner-frame, #goog-gt-tt, .goog-te-balloon-frame, .goog-tooltip {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
			
			/* Oculta el spinner de carga (la rueda blanca) */
				div[class*="VIpgJd-ZVi9od"] { 
				display: none !important; 
				pointer-events: none !important;
			}
            .skiptranslate {
                pointer-events: none !important;
                opacity: 10%;
            }
			
			
        `;
        document.head.appendChild(styleTag);

        const googleTranslateDropdown = document.querySelector('.goog-te-combo');
        if (googleTranslateDropdown) {
            googleTranslateDropdown.style.pointerEvents = 'none';
        }
    }

    // Activar restricciones iniciales
    
});

// Carga del motor de Google
(function() {
    var gt = document.createElement('script');
    gt.async = true;
    gt.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.head.appendChild(gt);
})();

// Cierre del modal de traducción al hacer clic fuera del contenido
document.getElementById("translate-overlay").addEventListener("click", function (event) {
    // Si el clic fue exactamente en el overlay (el fondo) y no en sus hijos (el cuadro blanco)
    if (event.target === this) {
        this.style.display = "none";
        // Importante: Reactivar las restricciones al cerrar
        if (typeof activarRestriccionesGoogleTranslate === 'function') {
            activarRestriccionesGoogleTranslate();
        }
        // Remover el listener de scroll
        window.removeEventListener("scroll", cerrarMenuAlScroll);
        console.log("Modal de traducción cerrado al hacer clic en el fondo.");
    }
});

/**
 * Limpia las cookies de traducción y recarga la página
 * para forzar que el texto vuelva a ser el original del archivo .md
 */
function restaurarOriginalYRefrescar() {
    console.log("Nexus: Eliminando rastro de traducción y refrescando...");

    // NUEVO: Forzamos que la preferencia sea español antes de recargar
    localStorage.setItem('nexus_preferred_lang', 'es'); 

    // 1. Borrar la cookie 'googtrans'
    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + location.host;
    
    location.reload();
}

// Variable global para controlar la espera
window.isWaitingForTranslation = false;

/**
 * Función que "promete" esperar a la traducción
 * @param {HTMLElement} targetNode - El contenedor del texto (#reading-container)
 */
function waitForTranslation(targetNode) {
    return new Promise((resolve) => {
        // Si no hay traducción activa (el html no tiene clase 'translated'), resolvemos de inmediato
        if (!document.documentElement.classList.contains('translated') && 
            document.cookie.indexOf('googtrans=/es/es') !== -1) {
            resolve();
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            // Google Translate suele añadir clases o cambiar el texto
            // Verificamos si el nodo ya no tiene el texto original en español
            // o si Google ha inyectado sus etiquetas <font>
            const hasBeenTranslated = targetNode.querySelector('font') || 
                                     !targetNode.innerText.includes(window.originalTextSent);

            if (hasBeenTranslated) {
                obs.disconnect();
                setTimeout(resolve, 100); // Un pequeño margen de seguridad
            }
        });

        observer.observe(targetNode, { childList: true, subtree: true, characterData: true });
        
        // Timeout de seguridad: si en 3 segundos no traduce, lee lo que haya
        setTimeout(() => {
            observer.disconnect();
            resolve();
        }, 3000);
    });
}

/**
 * Obtiene el código de idioma actual de la cookie de Google Translate
 * Retorna el código (ej: 'en', 'fr', 'de') o 'es' por defecto.
 */
function getCurrentGoogleLang() {
    // 1. Prioridad: Revisar si la página YA está traducida visualmente
    const isTranslated = document.documentElement.classList.contains('translated-ltr') || 
                         document.documentElement.classList.contains('translated-rtl');
    
    const value = `; ${document.cookie}`;
    const parts = value.split(`; googtrans=`);
    
    if (parts.length === 2) {
        const langPath = parts.pop().split(';').shift(); 
        const lang = langPath.split('/').pop();
        if (lang === 'es') return 'es';
        return lang;
    }
    
    // Si no hay cookie pero la clase existe, intentamos sacar el idioma del localStorage
    if (isTranslated) {
        return localStorage.getItem('nexus_preferred_lang') || 'es';
    }

    return 'es'; 
}

/**
 * Mapea el código de Google al formato de idioma de las voces TTS
 */

function getTTSLanguageCode() {
    // CLAVE: Si Google no tiene estas clases, el usuario está viendo el ORIGINAL
    const isTranslated = document.documentElement.classList.contains('translated-ltr') || 
                         document.documentElement.classList.contains('translated-rtl');

    if (!isTranslated) {
        return 'es-ES'; // Forzamos español si no hay traducción activa
    }

    const value = `; ${document.cookie}`;
    const parts = value.split(`; googtrans=`);
    let lang = 'es';
    
    if (parts.length === 2) {
        lang = parts.pop().split(';').shift().split('/').pop();
    } else {
        const preferred = localStorage.getItem('nexus_preferred_lang');
        if (preferred) lang = preferred;
    }

    const baseLang = lang.split('-')[0];
    const map = {
        // Europa
        'es': 'es-ES', 'en': 'en-GB', 'de': 'de-DE', 'fr': 'fr-FR', 'it': 'it-IT', 
        'pt': 'pt-BR', 'ru': 'ru-RU', 'nl': 'nl-NL', 'pl': 'pl-PL', 'uk': 'uk-UA',
        'sv': 'sv-SE', 'no': 'nb-NO', 'da': 'da-DK', 'fi': 'fi-FI', 'el': 'el-GR',
        'hu': 'hu-HU', 'cs': 'cs-CZ', 'ro': 'ro-RO', 'tr': 'tr-TR',

        // Asia & Oceanía
        'zh': 'zh-CN', 'ja': 'ja-JP', 'ko': 'ko-KR', 'hi': 'hi-IN', 'bn': 'bn-BD',
        'id': 'id-ID', 'vi': 'vi-VN', 'th': 'th-TH', 'ms': 'ms-MY', 'ta': 'ta-IN',
        'te': 'te-IN', 'mr': 'mr-IN', 'gu': 'gu-IN', 'kn': 'kn-IN', 'ml': 'ml-IN',
        'pa': 'pa-IN', 'ur': 'ur-PK', 'tl': 'tl-PH',

        // Medio Oriente & África
        'ar': 'ar-SA', 'fa': 'fa-IR', 'he': 'he-IL', 'sw': 'sw-KE', 'am': 'am-ET',
        'yo': 'yo-NG', 'ig': 'ig-NG', 'zu': 'zu-ZA'
    };
    
    return map[baseLang] || map[lang] || 'es-ES';
}

function getBestVoice(targetLang) {
    const baseLang = targetLang.split('-')[0];
    
    // 1. Intentar el mapa experto
    if (map[baseLang]) return map[baseLang];
    
    // 2. Si no está en el mapa, devolver el código base 
    // (Ej: si eligen 'ca' de Catalán, intentará buscar voz 'ca')
    return targetLang; 
}

async function cambiarIdioma(langCode) {
    const idiomaFinal = langCode || 'es';
    console.log("Nexus: Sincronizando audio para: " + idiomaFinal);
    
    localStorage.setItem('nexus_preferred_lang', idiomaFinal);

    if (window.synth) window.synth.cancel();

    // Sincronización de Podcast
    if (typeof podAudioInstance !== 'undefined' && podAudioInstance && podActiveBookId) {
        const srtUrl = podAudioInstance.src.replace(/\.(mp3|m4a|wav|ogg)$/i, '.srt');
        if (typeof cargarSubtitulos === 'function') cargarSubtitulos(srtUrl);
    }

    // Detectar si estamos en una imagen para no romper el flujo
    const estaEnImagen = (NexusImage.timer !== null || NexusImage.isPaused);

    if (window.isSpeaking) {
    if (window.synth) window.synth.cancel();
    window.shouldResumeAfterTranslation = true;

    // Si hay un mensaje de timer de imagen, lo borramos.
    // Al reanudarse prepareAndStartSpeech(), se volverá a escribir en el nuevo idioma.
    const imageMsg = document.getElementById('image-timer-message');
    if (imageMsg) imageMsg.innerText = "";
}

    const delay = (idiomaFinal === 'es' || idiomaFinal === 'es-ES') ? 200 : 1500;

    if (window.shouldResumeAfterTranslation) {
        setTimeout(() => {
            window.shouldResumeAfterTranslation = false;
            if (window.isSpeaking) {
                if (typeof prepareAndStartSpeech === 'function') {
                    // Actualizamos el contador visual al nuevo idioma inmediatamente
                    if (estaEnImagen) updateTimerDisplay();
					// Usamos startSpeech en lugar de prepareAndStartSpeech 
					// porque startSpeech ahora ya sabe limpiar la barra y elegir el modo correcto
					startSpeech();
                }
            }
        }, delay); 
    }
}


// Función para actualizar la dirección global de la app y sincronizar soporte de voz
function aplicarDireccionGlobal() {
    // Lista expandida: 'iw' es el código que suele usar Google Translate para Hebreo
    const rtlLangs = ['ar', 'he', 'iw', 'fa', 'ur', 'ps', 'sd', 'yi'];
    
    // Obtenemos el idioma y lo limpiamos (ej: "he-IL" -> "he")
    let currentLang = localStorage.getItem('nexus_preferred_lang') || 'es';
    currentLang = currentLang.split('-')[0].toLowerCase().trim();
    
    const isRTL = rtlLangs.includes(currentLang);

    console.log("Nexus Traductor: Detectado idioma " + currentLang + " | RTL: " + isRTL);

    // 1. Forzamos LTR en el layout general (Menús, botones, etc)
    document.documentElement.dir = "ltr"; 
    document.body.dir = "ltr";

    // 2. Contenedores de texto de lectura
    const textContainers = [
        document.getElementById('pod-subtitle-text'), 
        document.getElementById('reading-container-fixed'),
        document.querySelector('.synopsis-content')    
    ];

    const currentAlign = getComputedStyle(document.documentElement).getPropertyValue('--reader-text-align').trim();

    textContainers.forEach(container => {
        if (container) {
            container.style.direction = isRTL ? 'rtl' : 'ltr';
            
            // Corrección de última línea para modo Justificado
            if (currentAlign === 'justify') {
                container.style.textAlignLast = isRTL ? 'right' : 'left';
                document.documentElement.style.setProperty('--reader-text-align-last', isRTL ? 'right' : 'left');
            } else {
                container.style.textAlignLast = 'auto';
                document.documentElement.style.setProperty('--reader-text-align-last', currentAlign);
            }
        }
    });

    // 3. Lógica de botones de alineación
    const leftOpt = document.getElementById('option-align-left');
    const rightOpt = document.getElementById('option-align-right');

    if (leftOpt && rightOpt) {
        if (isRTL) {
            leftOpt.classList.add('hidden');
            rightOpt.classList.remove('hidden');
            if (currentAlign === 'left') {
                if (typeof changeAlignment === 'function') changeAlignment('right');
            }
        } else {
            leftOpt.classList.remove('hidden');
            rightOpt.classList.add('hidden');
            if (currentAlign === 'right') {
                if (typeof changeAlignment === 'function') changeAlignment('left');
            }
        }
    }

    if (typeof syncLanguageSupport === 'function') {
        syncLanguageSupport();
    }
}


function seleccionarIdiomaInicio(lang) {
    console.log("Nexus: Iniciando en idioma: " + lang);
    localStorage.setItem('nexus_preferred_lang', lang);
	
	

    if (lang === 'es') {
        // Si es español, limpiamos cookies y entramos
        document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + location.host;
        cerrarPortalBienvenida();
    } else {
        // Si es otro idioma, configuramos la cookie de Google y recargamos
        // El formato es /es/code (ej: /es/en)
        document.cookie = "googtrans=/es/" + lang + "; path=/;";
        document.cookie = "googtrans=/es/" + lang + "; path=/; domain=" + location.host;
        location.reload(); // Recargamos para que Google traduzca desde el inicio
    }
}

function cerrarPortalBienvenida() {
    const portal = document.getElementById('welcome-portal');
    if (portal) {
        portal.style.opacity = '0';
        portal.style.pointerEvents = 'none';
        setTimeout(() => { portal.style.display = 'none'; }, 500);
    }
}

function cambiarIdiomaDinamicamente(lang) {
    console.log("Nexus: Intento de cambio rápido a " + lang);
    localStorage.setItem('nexus_preferred_lang', lang);

    // 1. Seteamos la cookie (esto es vital para que Google sepa qué idioma queremos)
    document.cookie = "googtrans=/es/" + lang + "; path=/;";
    document.cookie = "googtrans=/es/" + lang + "; path=/; domain=" + location.host;

    // 2. Buscamos el selector interno de Google (el combo oculto)
    const googleCombo = document.querySelector('.goog-te-combo');
    
    if (googleCombo) {
        googleCombo.value = lang; // Cambiamos el valor al idioma deseado
        googleCombo.dispatchEvent(new Event('change')); // Disparamos el evento para que Google traduzca
        
        // Cerramos el modal automáticamente tras elegir
        const overlay = document.getElementById('translate-overlay');
        if (overlay) overlay.style.display = "none";
        
    } else {
        // Si por alguna razón el widget no cargó, usamos el plan B (recargar)
        location.reload();
    }
}

// Para el botón de "Mostrar Original"
function restaurarOriginalYRefrescar() {
    localStorage.setItem('nexus_preferred_lang', 'es');
    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + location.host;
    location.reload();
}

// Ejecutar al cargar la página
document.addEventListener("DOMContentLoaded", aplicarDireccionGlobal);