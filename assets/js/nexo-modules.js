/* NexoDent 184: correção de classificação de Documentos e Backup.
 * Leitura isolada de permissões comerciais.
 * Não é um mecanismo de bloqueio: o servidor precisa validar cada operação.
 */
(function () {
  'use strict';
  let generation = 0;
  let current = null;
  let loadedClinic = null;
  let lastRefresh = 0;
  let pending = false;
  const keys = ['agenda','patients','finance','commissions','wa','documents','reports'];
  function resolve(key) {
    if (!keys.includes(key) || !current) return null;
    if (Object.prototype.hasOwnProperty.call(current.overrides || {}, key))
      return current.overrides[key] === true;
    if (!current.has_plan) return true; // compatibilidade: clínica sem plano
    return Array.isArray(current.plan_modules) && current.plan_modules.includes(key);
  }
  async function refresh() {
    const clinicId = window.OralCloud?.clinicId;
    if (clinicId !== loadedClinic) {
      ++generation;
      current = null;
      loadedClinic = clinicId || null;
      applyNavigation();
    }
    if (!clinicId || !window.OralCloud?.request || pending) return;
    const seq = ++generation;
    pending = true;
    lastRefresh = Date.now();
    try {
      const result = await window.OralCloud.request('/rest/v1/rpc/nexodent_clinic_module_access', {
        method: 'POST', body: { p_clinic: clinicId }
      });
      if (seq === generation && clinicId === window.OralCloud?.clinicId && result && result.clinic_id === clinicId) {
        current = result;
        window.dispatchEvent(new CustomEvent('nexodent:modules-updated', { detail: { clinicId } }));
      }
    } catch (err) {
      if (seq === generation) console.warn('[NexoDent] Falha ao atualizar permissões comerciais; mantendo último estado conhecido para esta clínica.', err);
    } finally {
      pending = false;
    }
  }
  // Proteção de interface apenas. Autorização de operações exige RLS/RPC no servidor.
  // Áreas clínicas essenciais (pacientes, prontuários e agenda) não são bloqueadas
  // automaticamente por razões comerciais.
  const navigationModules = Object.freeze({
    vd:'finance', pf:'finance', cm:'commissions', wa:'wa', reports:'reports'
    // 'sigdoc' contém documentos clínicos essenciais: não bloquear.
    // 'bk' é Backup, não Relatórios: não associar ao módulo reports.
  });
  function moduleForNavigation(section) { return navigationModules[section] || null; }
  // Disponível aos recursos de interface; não substitui autorização no servidor.
  function isAllowed(key) { return resolve(key) !== false; }

  function allowedNavigation(section) {
    const module = moduleForNavigation(section);
    return !module || resolve(module) !== false;
  }
  function applyNavigation() {
    document.querySelectorAll('[data-act="nav"][data-t]').forEach(button => {
      const denied = !allowedNavigation(button.dataset.t);
      if (button.hidden !== denied) button.hidden = denied;
      if (button.getAttribute('aria-hidden') !== String(denied)) button.setAttribute('aria-hidden', String(denied));
      if (denied && button.getAttribute('tabindex') !== '-1') button.setAttribute('tabindex', '-1');
      else if (!denied && button.hasAttribute('tabindex')) button.removeAttribute('tabindex');
    });
  }
  // Capture evita que o manipulador de ações da aplicação execute navegação negada.
  document.addEventListener('click', event => {
    const nav = event.target.closest?.('[data-act="nav"][data-t]');
    if (!nav || allowedNavigation(nav.dataset.t)) return;
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  window.addEventListener('nexodent:modules-updated', () => {
    applyNavigation();
    const section = window.view?.h;
    if (section && !allowedNavigation(section)) {
      // Nunca redirecionar uma ficha clínica aberta.
      if (!window.view?.id) {
        window.view.h = 'ag';
        if (typeof window.render === 'function') window.render();
      }
    }
  });
  const observer = new MutationObserver(() => applyNavigation());
  window.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('app');
    if (root) observer.observe(root, { childList:true, subtree:true });
    applyNavigation();
  });
  // Consulta periodicamente e quando o usuário retorna à aba. Não substitui
  // as validações no Supabase; evita exigir uma nova publicação para mudanças.
  function refreshIfDue() {
    const clinicId = window.OralCloud?.clinicId || null;
    if (clinicId !== loadedClinic || Date.now() - lastRefresh > 60000) refresh();
  }
  window.addEventListener('focus', refreshIfDue);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshIfDue();
  });
  window.setInterval(() => { if (!document.hidden) refreshIfDue(); }, 60000);
  window.addEventListener('DOMContentLoaded', refreshIfDue);
  window.NexoModules = Object.freeze({ refresh, resolve, isAllowed, allowedNavigation, applyNavigation, get snapshot() { return current; },
    reset() { ++generation; current = null; loadedClinic = null; lastRefresh = 0; applyNavigation(); } });
})();
