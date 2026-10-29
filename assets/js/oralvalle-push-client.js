/* Oral Valle 055 — cadastro de notificações Web Push (chave pública VAPID). */
(function () {
  'use strict';
  // Substitua APENAS pelo valor Public Key gerado no seu computador.
  const VAPID_PUBLIC_KEY = 'BD-S_MitPiKJLbbsv2BlZnq7Ko9QOchv9SBluTG29CLGv8G2tMf9N7zH3RXKM--ul1urnTOGUfDuXWbcrB5TjSE';
  function keyBytes(base64url) {
    const padded = (base64url + '='.repeat((4 - base64url.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
  }
  async function activatePush() {
    if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Este aparelho não oferece suporte a Web Push neste modo.');
    }
    if (VAPID_PUBLIC_KEY.startsWith('COLE_AQUI')) throw new Error('Configure primeiro a chave pública VAPID.');
    if (!window.OralCloud?.session?.access_token || !window.OralCloud?.clinicId) {
      throw new Error('Entre na clínica antes de ativar as notificações Push.');
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Permissão de notificações não concedida.');
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(VAPID_PUBLIC_KEY)
      });
    }
    const response = await fetch(window.OralCloud.config.url + '/functions/v1/oralvalle-push-register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': window.OralCloud.config.publishableKey,
        'Authorization': 'Bearer ' + window.OralCloud.session.access_token
      },
      body: JSON.stringify({ subscription: subscription.toJSON() })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.error || 'Não foi possível registrar este aparelho.');
    return result;
  }
  // Verificação silenciosa: nunca solicita permissão automaticamente.
  async function checkPushStatus() {
    if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
      return { active: false, label: 'Push indisponível neste modo' };
    if (Notification.permission === 'denied') return { active: false, label: 'Notificações bloqueadas' };
    if (Notification.permission !== 'granted') return { active: false, label: 'Notificações desativadas' };
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      const subscription = registration && await registration.pushManager.getSubscription();
      return subscription ? { active: true, label: 'Push ativado neste aparelho' }
        : { active: false, label: 'Push não cadastrado neste aparelho' };
    } catch (_) { return { active: false, label: 'Não foi possível verificar o Push' }; }
  }
  let checking = false;
  async function refreshPushStatus() {
    if (checking) return;
    const buttons = document.querySelectorAll('[data-act="pushactivate"]');
    if (!buttons.length) return;
    checking = true;
    try {
      const status = await checkPushStatus();
      buttons.forEach(button => {
        button.textContent = status.active ? '🟢 Push ativado' : '🔴 ' + status.label + ' · Ativar Push';
        button.title = status.active ? 'Toque para renovar o cadastro neste aparelho' : 'Toque para ativar as notificações Push';
        button.setAttribute('aria-label', status.label + (status.active ? '. Toque para renovar o cadastro.' : '. Toque para ativar.'));
      });
    } finally { checking = false; }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshPushStatus(); });
  document.addEventListener('DOMContentLoaded', refreshPushStatus);
  // O cartão da agenda é recriado ao navegar; verificar periodicamente quando visível.
  setInterval(() => { if (!document.hidden) refreshPushStatus(); }, 12000);
  document.addEventListener('click', async function (event) {
    const button = event.target.closest('[data-act="pushactivate"]');
    if (!button) return;
    event.preventDefault();
    button.disabled = true;
    try {
      await activatePush();
      alert('Notificações Push cadastradas neste aparelho!');
    } catch (error) {
      alert('Não foi possível ativar Push: ' + error.message);
    } finally { button.disabled = false; refreshPushStatus(); }
  }, true);
  window.OralVallePush = { activatePush, checkPushStatus, refreshPushStatus };
})();
