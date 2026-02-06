// Nombre del caché (puedes cambiarlo si actualizas la web)
const CACHE_NAME = 'nexus-reader-v1';

// El Service Worker mínimo para que sea instalable
self.addEventListener('install', (event) => {
  console.log('SW: Instalado');
});

self.addEventListener('activate', (event) => {
  console.log('SW: Activo');
});

// Esto permite que la App funcione mejor en red, pero por ahora solo cumple el requisito
self.addEventListener('fetch', (event) => {
  // Aquí podrías agregar lógica para lectura offline en el futuro
});