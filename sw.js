/* Oral Valle — recebimento de notificações Web Push. */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data?.text() || '' }; }
  const title = String(data.title || 'Nexodent — Horário chegando');
  const options = {
    body: String(data.body || 'Você tem um atendimento próximo.'),
    tag: String(data.tag || 'oralvalle-' + Date.now()),
    data: { url: '/' },
    icon: '/apple-touch-icon.png',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus();
        return;
      }
    }
    await clients.openWindow('/');
  })());
});
