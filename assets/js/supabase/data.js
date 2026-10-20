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
  const fileSlots = Object.keys(children.patients).filter(slot => children.patients[slot][0] === 'patient_files');
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
  function snapshot(value) {
    const projected = { ...value };
    if (Array.isArray(value.p)) projected.p = value.p.map(patient => {
      const fields = { ...patient };
      fileSlots.forEach(slot => { delete fields[slot]; });
      return fields;
    });
    return copy(projected);
  }
  function loaded(clinic) {
    if (!state || state.clinic !== clinic || cloud().clinicId !== clinic)
      throw fail('LOAD_REQUIRED', 'Carregue esta clínica antes de continuar.');
    return state;
  }
  async function rpc(name, body) {
    return cloud().request('/rest/v1/rpc/' + name, { method: 'POST', body });
  }
  async function rowChunks(clinic, revision, table, id) {
    let offset = 0;
    let bytes = 0;
    const parts = [];
    do {
      const part = await rpc('clinic_row_chunk', { p_clinic: clinic, p_revision: revision,
        p_table: table, p_id: id, p_offset: offset });
      if (part.revision !== revision || typeof part.text !== 'string' ||
        (part.next !== null && (!Number.isInteger(part.next) || part.next <= offset)))
        throw fail('INVALID_RESPONSE', 'Bloco de dados inválido.');
      bytes += part.text.length * 2;
      if (bytes > 67108864) throw fail('ROW_TOO_LARGE', 'Registro excede o limite seguro de leitura no navegador. Solicite extração administrativa sem remover o original.');
      parts.push(part.text);
      offset = part.next;
    } while (offset !== null);
    const row = JSON.parse(parts.join(''));
    if (row.id !== id) throw fail('INVALID_RESPONSE', 'Identidade do registro inválida.');
    return row;
  }
  async function pages(name, body, revision, table) {
    const rows = [];
    let cursor = null;
    do {
      const page = await rpc(name, { ...body, p_after: cursor });
      if (page.revision !== revision || !Array.isArray(page.rows) ||
        (page.next !== null && (typeof page.next !== 'string' || page.next === cursor)))
        throw fail('INVALID_RESPONSE', 'Página de dados inválida.');
      for (const row of page.rows) rows.push(row.chunked ? await rowChunks(body.p_clinic, revision, table, row.id) : row);
      cursor = page.next;
    } while (cursor !== null);
    return rows;
  }
  async function load() {
    const clinic = cloud().clinicId;
    return enqueue(async () => {
      const c = cloud();
      if (c.clinicId !== clinic) throw fail('CLINIC_CHANGED', 'A clínica mudou antes da leitura.');
      state = null;
      const payload = await rpc('clinic_load_start', { p_clinic: clinic });
      if (payload?.protocol !== 2 || !object(payload.access) || typeof payload.revision !== 'string')
        throw fail('INVALID_RESPONSE', 'Protocolo de leitura indisponível. Aplique a migration de leitura paginada.');
      payload.tables = {};
      for (const table of tables.filter(name => name !== 'patient_files')) {
        if (!payload.access[table]?.read) { payload.tables[table] = []; continue; }
        payload.tables[table] = await pages('clinic_load_page', { p_clinic: clinic,
          p_revision: payload.revision, p_table: table }, payload.revision, table);
      }
      const final = await rpc('clinic_load_start', { p_clinic: clinic });
      if (final.revision !== payload.revision) throw fail('40001', 'A clínica mudou durante a leitura. Tente carregar novamente.');
      if (cloud().clinicId !== clinic) throw fail('CLINIC_CHANGED', 'A clínica mudou durante a leitura.');
      if (!payload || !object(payload.tables) || !object(payload.access) || typeof payload.revision !== 'string')
        throw fail('INVALID_RESPONSE', 'Resposta da clínica inválida.');
      const data = inflate(payload);
      // Capture BEFORE the caller runs migrate(): inserted defaults must remain real changes.
      // Detached JSON is essential: migrate mutates cl/hc/anam maps in place.
      const patients = new Map((payload.tables.patients || []).filter(row => row.kind === 'object')
        .map(row => [JSON.stringify(row.dados.id), row.id]));
      state = { clinic, revision: payload.revision, baseline: flatten(snapshot(data)), access: payload.access, patients };
      return data;
    });
  }
  async function save(snapshot) {
    // Capture synchronously: subsequent edits to the caller's db must not alter this save.
    const captured = global.OralCloudData.snapshot(snapshot);
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
      state.patients = new Map([...current.values()].filter(value => value.table === 'patients' && value.row.kind === 'object')
        .map(value => [JSON.stringify(value.row.dados.id), state.patients.get(JSON.stringify(value.row.dados.id)) || value.id]));
      return result.revision;
    });
  }
  function prepareDefaults(snapshot) {
    if (!state) throw fail('LOAD_REQUIRED', 'Carregue a clínica antes de preparar os dados.');
    // migrate() cria campos vazios para telas ocultas. Eles não são registros remotos novos.
    flatten(global.OralCloudData.snapshot(snapshot)).forEach((value, key) => {
      const access = state.access[value.table];
      const editable = access && (access.admin || access.write?.[value.row.slot]);
      if (!editable) state.baseline.set(key, value);
    });
  }
  async function files(patientId) {
    const clinic = cloud().clinicId;
    return enqueue(async () => {
      const current = loaded(clinic);
      const parent = current.patients.get(JSON.stringify(patientId));
      if (!parent) throw fail('INVALID_PATIENT', 'Salve o paciente antes de acessar os arquivos.');
      const rows = await pages('clinic_files_page', { p_clinic: clinic, p_revision: current.revision,
        p_patient: parent }, current.revision, 'patient_files');
      loaded(clinic);
      return rows;
    });
  }
  async function file(patientId, rowId) {
    const clinic = cloud().clinicId;
    return enqueue(async () => {
      const current = loaded(clinic);
      const row = await rowChunks(clinic, current.revision, 'patient_files', rowId);
      if (row.parent_id !== current.patients.get(JSON.stringify(patientId)))
        throw fail('INVALID_RESPONSE', 'Arquivo não pertence ao paciente.');
      loaded(clinic);
      return row;
    });
  }
  async function changeFile(patientId, operation, data) {
    const captured = copy(data);
    const clinic = cloud().clinicId;
    return enqueue(async () => {
      const current = loaded(clinic);
      const parent = current.patients.get(JSON.stringify(patientId));
      if (!parent) throw fail('INVALID_PATIENT', 'Salve e recarregue o paciente antes de anexar arquivos.');
      if (operation === 'append') {
        captured.row_id = JSON.stringify([parent, 'arquivos', ['id', captured.file.id]]);
        captured.marker_id = JSON.stringify([parent, 'arquivos']);
      } else if (operation === 'signature') {
        captured.ids = Object.fromEntries(Object.keys(captured.values).map(slot => [slot, JSON.stringify([parent, slot])]));
      }
      const result = await rpc('clinic_file_apply', { p_clinic: clinic, p_revision: current.revision,
        p_patient: parent, p_operation: operation, p_data: captured });
      loaded(clinic);
      if (typeof result.revision !== 'string') throw fail('INVALID_RESPONSE', 'Revisão de arquivo inválida.');
      current.revision = result.revision;
      return result.revision;
    });
  }
  async function fullData(current, captured) {
      const clinic = current.clinic;
      let bytes = JSON.stringify(captured).length * 2;
      if (bytes > 67108864) throw fail('EXPORT_TOO_LARGE', 'Backup grande exige exportação administrativa pg_dump. Nenhum arquivo parcial foi gerado.');
      const payload = { tables: { patients: [] } };
      for (const patient of captured.p || []) {
        const parent = current.patients.get(JSON.stringify(patient.id));
        if (!parent) continue;
        const descriptors = await pages('clinic_files_page', { p_clinic: clinic, p_revision: current.revision,
          p_patient: parent }, current.revision, 'patient_files');
        payload.tables.patients = [{ id: parent, parent_id: null, slot: 'p', position: 0, kind: 'object', dados: {} }];
        payload.tables.patient_files = [];
        for (const descriptor of descriptors) {
          const row = await rowChunks(clinic, current.revision, 'patient_files', descriptor.id);
          bytes += JSON.stringify(row).length * 2;
          if (bytes > 67108864) throw fail('EXPORT_TOO_LARGE', 'Backup excede o limite seguro de memória. Use o backup administrativo pg_dump, que inclui os anexos. Nenhum backup parcial foi gerado.');
          payload.tables.patient_files.push(row);
        }
        payload.tables.patients.unshift({ id: 'export-patients', parent_id: null, slot: 'p', position: -1, kind: 'array', dados: null });
        const restored = inflate(payload).p;
        if (restored?.[0]) Object.assign(patient, restored[0]);
      }
      const final = await rpc('clinic_load_start', { p_clinic: clinic });
      if (final.revision !== current.revision) throw fail('40001', 'A clínica mudou durante o backup. Repita sem gravações simultâneas.');
      loaded(clinic);
      return captured;
  }
  async function exportData(value) {
    const captured = snapshot(value);
    const clinic = cloud().clinicId;
    return enqueue(async () => {
      const current = loaded(clinic);
      return fullData(current, captured);
    });
  }
  async function restoreData(value) {
    const captured = copy(value);
    const clinic = cloud().clinicId;
    return enqueue(async () => {
      const current = loaded(clinic);
      if (!current.access.patients?.admin) throw fail('42501', 'Restaurar a clínica exige administrador.');
      const payload = { tables: {} };
      current.baseline.forEach(value => {
        (payload.tables[value.table] ||= []).push({ id: value.id, ...value.row });
      });
      const complete = await fullData(current, inflate(payload));
      const before = flatten(complete), after = flatten(captured), changes = [];
      after.forEach((value, key) => { if (!before.has(key) || canonical(before.get(key).row) !== canonical(value.row)) changes.push(value); });
      before.forEach((value, key) => { if (!after.has(key)) changes.push({ table: value.table, id: value.id, delete: true }); });
      if (changes.length > 50000 || JSON.stringify(changes).length * 2 > 5242880)
        throw fail('RESTORE_TOO_LARGE', 'Restauração grande exige importação administrativa em janela de manutenção, com backup verificado. Nada foi alterado.');
      try {
        return await rpc('clinic_apply', { p_clinic: clinic, p_revision: current.revision, p_changes: changes });
      } finally { state = null; }
    });
  }
  function reset() { state = null; }
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
  global.OralCloudData = Object.freeze({ load, save, prepareDefaults, members, updateMember, pendingUsers, decideUser,
    snapshot, files, file, changeFile, exportData, restoreData, reset });
})(window);