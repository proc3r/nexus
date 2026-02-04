let player;
let isMusicPlaying = false;

// Esta función la llama el navegador cuando el script de YouTube termina de cargar
function onYouTubeIframeAPIReady() {
    console.log("API de YouTube lista");
    initPlayer();
}

function initPlayer() {
    const videoId = (currentBook && currentBook.soundtrack) ? currentBook.soundtrack : "Jv1JH89G7s8"; 
    
    console.log("Iniciando reproductor con ID:", videoId);

    player = new YT.Player('youtube-player', {
        height: '180',
        width: '100%',
        videoId: videoId,
        playerVars: {
            'playsinline': 1,
            'controls': 1,
            'autoplay': 0,
            'origin': window.location.origin // <--- AGREGA ESTA LÍNEA CRUCIAL
        },
        events: {
            'onReady': () => console.log("Reproductor listo"),
            'onError': (e) => {
                console.error("Error en YouTube. Código:", e.data);
                if(e.data === 150 || e.data === 101) {
                    console.warn("El video no permite ser embebido o el ID es incorrecto.");
                }
            }
        }
    });
}

function toggleSoundtrack() {
    if (!player || typeof player.playVideo !== 'function') {
        console.error("El reproductor no está inicializado");
        return;
    }

    if (!isMusicPlaying) {
        player.playVideo();
        document.getElementById('music-icon').innerText = "pause";
        document.getElementById('music-text').innerText = "Pausar";
        isMusicPlaying = true;
    } else {
        player.pauseVideo();
        document.getElementById('music-icon').innerText = "play_arrow";
        document.getElementById('music-text').innerText = "Reproducir";
        isMusicPlaying = false;
    }
}