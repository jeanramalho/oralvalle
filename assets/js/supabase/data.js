/* Classic script. Authentication and HTTP transport belong to OralCloud, not this adapter. */
(function (global) {
  'use strict';
  const roots = { p: 'patients', ag: 'appointments', dt: 'dentists', pr: 'procedures',
    mt: 'materials', vd: 'sales', cp: 'commission_payments', lem: 'reminders' };
  const children = {
    patients: { anam: ['patient_anamneses', 'object'], odo: ['patient_odontograms', 'value'],
      olog: ['odontogram_history', 'array'], evol: ['patient_evolutions', 'array'],
      dplan: ['dental_plans', 'array'], orcs: ['budgets', 'array'], trat: ['treatments', 'array'],
      arquivos: ['patient_files', 'array'], sign: ['patient_files', 'value'],
      signDate: ['patient_files', 'value'], signTermo: ['patient_files', 'value'],
      evolSign: ['patient_files', 'value'], evolSignDate: ['patient_files', 'value'] },
    patient_anamneses: { c: ['patient_conditions', 'map'] },
    budgets: { itens: ['budget_items', 'array'] }, treatments: { mats: ['treatment_materials', 'array'] },
    procedures: { mats: ['procedure_materials', 'array'] },
    sales: { pg: ['receipts', 'array'], plano: ['installments', 'array'] }
  };
  const tables = [...new Set(['clinic_settings', 'document_models', ...Object.values(roots),
    ...Object.values(children).flatMap(fields => Object.values(fields).map(x => x[0]))])];
  let state = null;
  let pending = Promise.resolve();
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const copy = value => JSON.parse(JSON.stringify(value));
  const canonical = value => JSON.stringify(value, function (_, v) {
    if (!object(v)) return v;
    return Object.keys(v).sort().reduce((out, key) => {
      Object.defineProperty(out, key, { value: v[key], enumerable: true }); return out;
    }, {});
  });
  const fail = (code, message) => Object.assign(new Error(message), { code });
  function cloud() {
    const c = global.OralCloud;
    if (!c || !c.enabled || typeof c.request !== 'function' || !c.clinicId)
      throw fail('CLOUD_NOT_READY', 'Selecione uma clínica autenticada antes de acessar os dados.');
    return c;
  }
  function put(target, key, value) {
    // Preserve even imported keys such as __proto__ without prototype mutation.
    Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
  }
  function flatten(snapshot) {
    if (!object(snapshot)) throw fail('INVALID_SNAPSHOT', 'O banco precisa ser um objeto JSON.');
    const rows = new Map();
    function emit(table, id, parent, slot, position, kind, dados) {
      const key = table + ':' + id;
      if (rows.has(key)) throw fail('DUPLICATE_ID', 'Identificador duplicado em ' + table + '.');
      rows.set(key, { table, id, row: { parent_id: parent, slot, position, kind, dados } });
    }
    function entity(table, value, id, parent, slot, position) {
      const fields = children[table] || {};
      const dados = object(value) ? {} : value;
      if (object(value)) Object.keys(value).forEach(key => {
        if (!own(fields, key)) put(dados, key, value[key]);
      });
      emit(table, id, parent, slot, position, object(value) ? 'object' : 'value', dados);
      if (object(value)) Object.keys(fields).forEach(key => {
        if (own(value, key)) node(fields[key][0], fields[key][1], value[key], id, key);
      });
    }
    function node(table, type, value, parent, slot) {
      const id = JSON.stringify([parent, slot]);
      if (type === 'array' && Array.isArray(value)) {
        emit(table, id, parent, slot, -1, 'array', null);
        value.forEach((item, position) => {
          const identity = object(item) && own(item, 'id') ? ['id', item.id] : ['position', position];
          entity(table, item, JSON.stringify([parent, slot, identity]), parent, slot, position);
        });
      } else if (type === 'map' && object(value)) {
        emit(table, id, parent, slot, -1, 'map', null);
        Object.keys(value).forEach((key, position) =>
          emit(table, JSON.stringify([parent, slot, ['key', key]]), parent, slot, position,
            'entry', { key, value: value[key] }));
      } else if (type === 'object' && object(value)) {
        entity(table, value, id, parent, slot, 0);
      } else emit(table, id, parent, slot, -1, 'value', value);
    }
    Object.keys(snapshot).forEach(key => {
      if (own(roots, key)) node(roots[key], 'array', snapshot[key], null, key);
      else if (key === 'rxm') node('document_models', 'map', snapshot[key], null, key);
      else emit('clinic_settings', JSON.stringify([null, key]), null, key, 0, 'value', snapshot[key]);
    });
    return rows;
  }
  function inflate(payload) {
    const buckets = new Map();
    tables.forEach(table => {
      const list = payload.tables[table] || [];
      if (!Array.isArray(list)) throw fail('INVALID_RESPONSE', 'Resposta relacional inválida.');
      list.forEach(row => {
        const key = JSON.stringify([table, row.parent_id, row.slot]);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(row);
      });
    });
    function node(table, parent, slot) {
      const list = buckets.get(JSON.stringify([table, parent, slot]));
      if (!list) return { present: false };
      const marker = list.find(row => row.position === -1);
      if (marker && marker.kind === 'array') return { present: true, value: list
        .filter(row => row.position >= 0).sort((a, b) => a.position - b.position).map(row => entity(table, row)) };
      if (marker && marker.kind === 'map') {
        const value = {};
        list.filter(row => row.kind === 'entry').sort((a, b) => a.position - b.position)
          .forEach(row => put(value, row.dados.key, row.dados.value));
        return { present: true, value };
      }
      return { present: true, value: entity(table, marker || list[0]) };
    }
    function entity(table, row) {
      const value = copy(row.dados);
      if (row.kind === 'object' && object(value)) Object.entries(children[table] || {}).forEach(([slot, spec]) => {
        const child = node(spec[0], row.id, slot);
        if (child.present) put(value, slot, child.value);
      });
      return value;
    }
    const result = {};
    Object.entries(roots).forEach(([key, table]) => {
      const value = node(table, null, key); if (value.present) put(result, key, value.value);
    });
    const models = node('document_models', null, 'rxm');
    if (models.present) put(result, 'rxm', models.value);
    (payload.tables.clinic_settings || []).forEach(row => put(result, row.slot, row.dados));
    return result;
  }
  function enqueue(work) {
    const next = pending.then(work);
    pending = next.catch(() => {});
    return next;
  }
  async function load() {
    const clinic = cloud().clinicId;
    return enqueue(async () => {
      const c = cloud();
      if (c.clinicId !== clinic) throw fail('CLINIC_CHANGED', 'A clínica mudou antes da leitura.');
      const payload = await c.request('/rest/v1/rpc/clinic_load', { method: 'POST', body: { p_clinic: clinic } });
      if (cloud().clinicId !== clinic) throw fail('CLINIC_CHANGED', 'A clínica mudou durante a leitura.');
      if (!payload || !object(payload.tables) || !object(payload.access) || typeof payload.revision !== 'string')
        throw fail('INVALID_RESPONSE', 'Resposta da clínica inválida.');
      const data = inflate(payload);
      // Capture BEFORE the caller runs migrate(): inserted defaults must remain real changes.
      // Detached JSON is essential: migrate mutates cl/hc/anam maps in place.
      state = { clinic, revision: payload.revision, baseline: flatten(copy(data)), access: payload.access };
      return data;
    });
  }
  async function save(snapshot) {
    // Capture synchronously: subsequent edits to the caller's db must not alter this save.
    const captured = copy(snapshot);
    const clinic = cloud().clinicId;
    return enqueue(async () => {
      const c = cloud();
      if (!state || state.clinic !== clinic || c.clinicId !== clinic)
        throw fail('LOAD_REQUIRED', 'Carregue esta clínica antes de salvar.');
      const current = flatten(captured), changes = [];
      function changed(value, deletion) {
        const access = state.access[value.table];
        // No hidden baseline rows exist here. Server also checks per-slot permissions.
        if (!access || !access.read) {
          if (!deletion) throw fail('CLOUD_PERMISSION_DENIED', 'Dados não acessíveis: ' + value.table);
          return;
        }
        if (!access.admin && !access.write?.[value.row.slot])
          throw fail('CLOUD_PERMISSION_DENIED', 'Sem permissão de edição: ' + value.table + '/' + value.row.slot);
        changes.push(deletion ? { table: value.table, id: value.id, delete: true } : value);
      }
      current.forEach((value, key) => {
        const before = state.baseline.get(key);
        if (!before || canonical(before.row) !== canonical(value.row)) changed(value, false);
      });
      state.baseline.forEach((value, key) => { if (!current.has(key)) changed(value, true); });
      if (changes.length > 50000)
        throw fail('IMPORT_TOO_LARGE', 'Importação excede 50.000 alterações por transação. Não divida automaticamente: solicite uma importação administrativa para manter as relações.');
      // Even a no-op checks the global revision; never silently accepts a stale snapshot.
      const result = await c.request('/rest/v1/rpc/clinic_apply', { method: 'POST', body: {
        p_clinic: clinic, p_revision: state.revision, p_changes: changes
      } });
      if (!result || typeof result.revision !== 'string') throw fail('INVALID_RESPONSE', 'Revisão inválida.');
      if (cloud().clinicId !== clinic) { state = null; throw fail('CLINIC_CHANGED', 'A clínica mudou durante a gravação.'); }
      state = { ...state, revision: result.revision, baseline: current };
      return result.revision;
    });
  }
  function prepareDefaults(snapshot) {
    if (!state) throw fail('LOAD_REQUIRED', 'Carregue a clínica antes de preparar os dados.');
    // migrate() cria campos vazios para telas ocultas. Eles não são registros remotos novos.
    flatten(copy(snapshot)).forEach((value, key) => {
      const access = state.access[value.table];
      const editable = access && (access.admin || access.write?.[value.row.slot]);
      if (!editable) state.baseline.set(key, value);
    });
  }
  async function members() {
    const c = cloud(), clinic = c.clinicId;
    const result = await c.request('/rest/v1/rpc/clinic_members_list', { method: 'POST', body: { p_clinic: clinic } });
    if (cloud().clinicId !== clinic) throw fail('CLINIC_CHANGED', 'A clínica mudou durante a leitura de membros.');
    return result;
  }
  async function pendingUsers() {
    const c = cloud(), clinic = c.clinicId;
    const result = await c.request('/rest/v1/rpc/clinic_pending_users', {
      method: 'POST', body: { p_clinic: clinic },
    });
    if (cloud().clinicId !== clinic) throw fail('CLINIC_CHANGED', 'A clínica mudou durante a leitura de solicitações.');
    if (!Array.isArray(result)) throw fail('INVALID_RESPONSE', 'Lista de solicitações inválida.');
    return result;
  }
  async function decideUser(userId, approve) {
    if (typeof approve !== 'boolean') throw fail('INVALID_ACCESS_DECISION', 'Informe aprovar ou rejeitar.');
    const clinic = cloud().clinicId;
    return enqueue(async () => {
      const c = cloud();
      if (c.clinicId !== clinic) throw fail('CLINIC_CHANGED', 'A clínica mudou antes da aprovação.');
      const result = await c.request('/rest/v1/rpc/clinic_decide_user', {
        method: 'POST', body: { p_clinic: clinic, p_user_id: userId, p_approve: approve },
      });
      state = null;
      if (cloud().clinicId !== clinic) throw fail('CLINIC_CHANGED', 'A clínica mudou durante a aprovação.');
      return result;
    });
  }
  async function updateMember(userId, patch) {
    if (!object(patch) || Object.keys(patch).some(key => !['perms', 'active'].includes(key)))
      throw fail('INVALID_MEMBER_PATCH', 'Somente perms e active podem ser alterados.');
    const clinic = cloud().clinicId, captured = copy(patch);
    return enqueue(async () => {
      const c = cloud();
      if (c.clinicId !== clinic) throw fail('CLINIC_CHANGED', 'A clínica mudou antes da alteração de membros.');
      const result = await c.request('/rest/v1/rpc/clinic_update_member', { method: 'POST', body: {
        p_clinic: clinic, p_user_id: userId, p_patch: captured
      } });
      // Membership changes affect the readable baseline. A new load is mandatory.
      state = null;
      if (cloud().clinicId !== clinic) throw fail('CLINIC_CHANGED', 'A clínica mudou durante a alteração de membros.');
      return result;
    });
  }
  global.OralCloudData = Object.freeze({ load, save, prepareDefaults, members, updateMember, pendingUsers, decideUser });
})(window);