/**
 * EXTRAS.JS - Sistema de Zoom para Imágenes Nexus
 */

const NexusImageZoom = {
    scale: 1,
    panning: false,
    pointX: 0,
    pointY: 0,
    start: { x: 0, y: 0 },
    imgElement: null,

    init(imgId) {
        this.imgElement = document.getElementById(imgId);
        if (!this.imgElement) return;

        // Reset inicial
        this.reset();

        // Eventos de Mouse (Escritorio)
        this.imgElement.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.imgElement.addEventListener('wheel', (e) => this.handleWheel(e));

        // Eventos de Toque (Móvil)
        this.imgElement.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.imgElement.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.imgElement.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    },

    setTransform() {
        // Limitamos que la imagen no se pierda fuera de la pantalla al arrastrar
        this.imgElement.style.transform = `translate(${this.pointX}px, ${this.pointY}px) scale(${this.scale})`;
    },

    reset() {
        this.scale = 1;
        this.pointX = 0;
        this.pointY = 0;
        if (this.imgElement) {
            this.imgElement.style.transform = `translate(0px, 0px) scale(1)`;
            this.imgElement.style.cursor = "zoom-in";
        }
    },

    zoom(delta) {
        const newScale = this.scale + delta;
        if (newScale >= 1 && newScale <= 5) {
            this.scale = newScale;
            this.imgElement.style.cursor = this.scale > 1 ? "grab" : "zoom-in";
            this.setTransform();
        }
    },

    // --- LÓGICA DE RATÓN ---
    handleMouseDown(e) {
        if (this.scale === 1) return;
        e.preventDefault();
        this.panning = true;
        this.start = { x: e.clientX - this.pointX, y: e.clientY - this.pointY };
        this.imgElement.style.cursor = "grabbing";
    },

    handleMouseUp() {
        this.panning = false;
        if (this.scale > 1) this.imgElement.style.cursor = "grab";
    },

    handleMouseMove(e) {
        if (!this.panning) return;
        this.pointX = (e.clientX - this.start.x);
        this.pointY = (e.clientY - this.start.y);
        this.setTransform();
    },

    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.2 : 0.2;
        this.zoom(delta);
    },

    // --- LÓGICA TÁCTIL (Pinch & Pan) ---
    lastTouchTime: 0,
    initialDist: null,

    handleTouchStart(e) {
        if (e.touches.length === 1) {
            if (this.scale > 1) {
                this.panning = true;
                this.start = { x: e.touches[0].clientX - this.pointX, y: e.touches[0].clientY - this.pointY };
            }
        } else if (e.touches.length === 2) {
            this.initialDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    },

    handleTouchMove(e) {
        e.preventDefault();
        if (this.panning && e.touches.length === 1) {
            this.pointX = (e.touches[0].clientX - this.start.x);
            this.pointY = (e.touches[0].clientY - this.start.y);
            this.setTransform();
        } else if (e.touches.length === 2) {
            const currentDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const delta = (currentDist - this.initialDist) * 0.01;
            this.zoom(delta);
            this.initialDist = currentDist;
        }
    },

    handleTouchEnd() {
        this.panning = false;
    }
};