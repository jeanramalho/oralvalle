(function (global) {
  'use strict';
  const config = global.OralCloudConfig;
  const sessionKey = 'oralvalle_cloud_session';
  let session = null;
  let keep = false;
  let refreshing = null;
  let recovery = false;

  function storeSession(value, persistent) {
    if (value && !value.expires_at) value.expires_at = Math.floor(Date.now() / 1000) + Number(value.expires_in || 3600);
    session = value;
    keep = persistent;
    localStorage.removeItem(sessionKey);
    sessionStorage.removeItem(sessionKey);
    if (value) (keep ? localStorage : sessionStorage).setItem(sessionKey, JSON.stringify(value));
  }

  async function send(path, options = {}, token) {
    const response = await fetch(config.url + path, {
      method: options.method || 'GET',
      headers: {
        apikey: config.publishableKey,
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      cache: 'no-store',
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) {}
    if (!response.ok) {
      const error = new Error(data?.message || data?.msg || data?.error_description || 'Falha na conexão com Supabase.');
      error.code = data?.code || data?.error_code || String(response.status);
      error.status = response.status;
      error.details = data?.details;
      error.hint = data?.hint;
      throw error;
    }
    return data;
  }

  async function refresh() {
    if (!session?.refresh_token) throw new Error('Entre novamente para acessar a clínica.');
    if (!refreshing) {
      refreshing = send('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', body: { refresh_token: session.refresh_token },
      }).then(data => { storeSession(data, keep); return data; }).finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  async function request(path, options = {}) {
    if (!session) throw new Error('Sessão Supabase não iniciada.');
    if (!session.expires_at || session.expires_at * 1000 < Date.now() + 60000) await refresh();
    return send(path, options, session.access_token);
  }

  async function restoreSession() {
    // Confirmação de convite e recuperação usam o endereço HTTPS configurado no painel.
    const fragment = new URLSearchParams(location.hash.slice(1));
    if (fragment.has('access_token') && fragment.has('refresh_token')) {
      recovery = fragment.get('type') === 'recovery' || fragment.get('type') === 'invite';
      storeSession({ access_token: fragment.get('access_token'), refresh_token: fragment.get('refresh_token'),
        expires_at: Math.floor(Date.now() / 1000) + Number(fragment.get('expires_in') || 3600) }, false);
      history.replaceState(null, '', location.pathname + location.search);
    } else {
      const saved = sessionStorage.getItem(sessionKey) || localStorage.getItem(sessionKey);
      if (!saved) return null;
      keep = !sessionStorage.getItem(sessionKey);
      try { session = JSON.parse(saved); } catch (_) { storeSession(null, false); return null; }
    }
    try {
      const user = await request('/auth/v1/user');
      return { user, keep, recovery };
    } catch (error) {
      // Falha de rede não deve eliminar uma sessão recuperável.
      if (error.status === 400 || error.status === 401) storeSession(null, false);
      throw error;
    }
  }

  async function login(email, password, persistent) {
    const data = await send('/auth/v1/token?grant_type=password', {
      method: 'POST', body: { email, password },
    });
    storeSession(data, persistent);
    return data.user;
  }

  async function signup(nome, email, password) {
    const redirect = /^https?:$/.test(location.protocol)
      ? '?redirect_to=' + encodeURIComponent(location.origin + location.pathname + location.search)
      : '';
    // O nome é apenas informação de perfil, nunca autorização ou vínculo com a clínica.
    await send('/auth/v1/signup' + redirect, {
      method: 'POST', body: { email, password, data: { nome } },
    });
  }

  async function logout() {
    try { if (session) await request('/auth/v1/logout', { method: 'POST', body: {} }); }
    finally { storeSession(null, false); cloud.clinicId = null; recovery = false; }
  }

  async function recover(email) {
    if (!/^https?:$/.test(location.protocol)) throw new Error('Abra a versão hospedada para recuperar a senha por e-mail.');
    const redirect = location.origin + location.pathname;
    await send('/auth/v1/recover?redirect_to=' + encodeURIComponent(redirect), { method: 'POST', body: { email } });
  }

  async function password(value) {
    await request('/auth/v1/user', { method: 'PUT', body: { password: value } });
    recovery = false;
  }

  const cloud = global.OralCloud = {
    enabled: Boolean(config?.enabled), clinicId: null, request, login, signup, logout,
    restoreSession, recover, password, config,
    get session() { return session; },
    get keep() { return keep; },
  };
})(window);