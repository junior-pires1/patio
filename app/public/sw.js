/* global self */
// Service worker do Pátio: só repassa as requisições para a rede.
// Não guarda cópias, então cada publicação nova aparece na hora.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
