// traductor.js - Adaptación fiel del código original para Nexus

document.addEventListener("DOMContentLoaded", function () {
    let googleTranslateInitialized = false; 

    const translateOverlay = document.getElementById("translate-overlay");

    // 1. GESTIÓN DE EVENTOS (Mapeo de botones .translate-toggle)
    // Usamos delegación para que funcione en el Header y en el Lector Interno
    document.body.addEventListener("click", function (event) {
        const btnAbrir = event.target.closest(".translate-toggle");
        
        if (btnAbrir && translateOverlay) {
            event.preventDefault();
            console.log("Botón de traducción presionado.");

            // Alternar interfaz de traducción (Lógica original)
            translateOverlay.style.display = translateOverlay.style.display === "none" ? "flex" : "none";

            if (!googleTranslateInitialized) {
                googleTranslateElementInit();
                googleTranslateInitialized = true;
            }

            // Permitir interacción temporal con Google Translate (Lógica original)
            desactivarRestriccionesGoogleTranslate();

            // Agregar el listener para cerrar el menú al hacer scroll
            window.addEventListener("scroll", cerrarMenuAlScroll);
        }

        // Mapeo del botón de cierre
        const btnCerrar = event.target.closest("#close-translate-overlay");
        if (btnCerrar && translateOverlay) {
            console.log("Botón de cierre presionado. Ocultando el menú de selección de idiomas.");
            translateOverlay.style.display = "none";
            // Reactivamos restricciones al cerrar manualmente
            activarRestriccionesGoogleTranslate();
            window.removeEventListener("scroll", cerrarMenuAlScroll);
        }
    });

    // 2. FUNCIÓN DE SCROLL (Original)
    function cerrarMenuAlScroll() {
        if (translateOverlay && translateOverlay.style.display === "flex") {
            console.log("Scroll detectado. Cerrando el menú de selección de idiomas.");
            translateOverlay.style.display = "none";
            activarRestriccionesGoogleTranslate();
            window.removeEventListener("scroll", cerrarMenuAlScroll);
        }
    }

    // 3. INICIALIZACIÓN DE GOOGLE (Configuración original)
    window.googleTranslateElementInit = function() {
        console.log("Inicializando Google Translate...");
        new google.translate.TranslateElement({
            pageLanguage: "es",
            layout: google.translate.TranslateElement.InlineLayout.VERTICAL,
            autoDisplay: false,
            includedLanguages: "en,zh-CN,es,hi,fr,ar,bn,pt,ru,id,ur,de,ja,it,tr,sw,ko,vi"
        }, "google_translate_element");

        // Observar cambios en el idioma seleccionado
        setTimeout(() => {
            const googleTranslateDropdown = document.querySelector('.goog-te-combo');
            if (googleTranslateDropdown) {
                googleTranslateDropdown.addEventListener('change', async () => {
                    console.log("Idioma seleccionado. Ocultando el menú.");

                    translateOverlay.style.display = "none"; // Ocultar automáticamente

                    // Reactivar restricciones tras seleccionar
                    activarRestriccionesGoogleTranslate();
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
            .goog-te-banner-frame {
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
                opacity: 60%;
            }
        `;
        document.head.appendChild(styleTag);

        const googleTranslateDropdown = document.querySelector('.goog-te-combo');
        if (googleTranslateDropdown) {
            googleTranslateDropdown.style.pointerEvents = 'none';
        }
    }

    // Activar restricciones iniciales
    activarRestriccionesGoogleTranslate();
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