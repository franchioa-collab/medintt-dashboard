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

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
