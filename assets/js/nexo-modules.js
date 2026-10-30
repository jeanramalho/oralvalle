/* NexoDent 177: leitura isolada de permissões comerciais.
 * Não é um mecanismo de bloqueio: o servidor precisa validar cada operação.
 */
(function () {
  'use strict';
  let generation = 0;
  let current = null;
  const keys = ['agenda','patients','finance','commissions','wa','documents','reports'];
  function resolve(key) {
    if (!keys.includes(key) || !current) return null;
    if (Object.prototype.hasOwnProperty.call(current.overrides || {}, key))
      return current.overrides[key] === true;
    if (!current.has_plan) return true; // compatibilidade: clínica sem plano
    return Array.isArray(current.plan_modules) && current.plan_modules.includes(key);
  }
  async function refresh() {
    const seq = ++generation;
    const clinicId = window.OralCloud?.clinicId;
    current = null;
    if (!clinicId || !window.OralCloud?.request) return;
    try {
      const result = await window.OralCloud.request('/rest/v1/rpc/nexodent_clinic_module_access', {
        method: 'POST', body: { p_clinic: clinicId }
      });
      if (seq === generation && clinicId === window.OralCloud?.clinicId && result && result.clinic_id === clinicId) {
        current = result;
        window.dispatchEvent(new CustomEvent('nexodent:modules-updated', { detail: { clinicId } }));
      }
    } catch (err) {
      if (seq === generation) console.warn('[NexoDent] Não foi possível consultar os módulos; nenhuma restrição será aplicada nesta etapa.', err);
    }
  }
  window.NexoModules = Object.freeze({ refresh, resolve, get snapshot() { return current; },
    reset() { ++generation; current = null; } });
})();
