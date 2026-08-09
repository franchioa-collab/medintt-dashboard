// Service worker del módulo de presentismo. Solo hace dos cosas: mostrar el
// aviso de chequeo de ubicación que llega por push, y abrir la app cuando el
// empleado lo toca. No cachea nada ni intercepta pedidos de red.

self.addEventListener('push', (event) => {
  let datos = { title: 'Presentismo', body: 'Confirmá tu ubicación', chequeoId: '' };
  try {
    if (event.data) datos = event.data.json();
  } catch {
    // si el payload no es JSON válido, se usan los valores por defecto
  }

  event.waitUntil(
    self.registration.showNotification(datos.title, {
      body: datos.body,
      tag: 'chequeo-presentismo',
      data: { chequeoId: datos.chequeoId },
      requireInteraction: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chequeoId = event.notification.data?.chequeoId ?? '';
  const url = `/presentismo?chequeo=${encodeURIComponent(chequeoId)}`;

  // clients.openWindow() directo: es el patrón que Chrome soporta de forma
  // confiable. La alternativa de buscar una pestaña abierta con matchAll() y
  // navegarla pierde la activación de usuario del click en algunas versiones
  // de Chrome/Android y falla en silencio (el aviso se cierra pero no pasa
  // nada). Chrome de todos modos enfoca una pestaña existente de este origen
  // cuando puede, así que no hace falta buscarla a mano.
  event.waitUntil(self.clients.openWindow(url));
});
