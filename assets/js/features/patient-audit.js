/* Histórico de alterações: consulta exclusivamente via RPC com autorização no servidor. */
(function (global) {
  'use strict';
  const cache = new Map();
  const labels = {patients:'Paciente',budgets:'Orçamentos',budget_items:'Itens do orçamento',treatments:'Tratamentos',patient_evolutions:'Evoluções',patient_anamneses:'Anamnese',patient_conditions:'Condições de saúde',patient_odontograms:'Odontograma',odontogram_history:'Histórico odontológico',dental_plans:'Planejamento',patient_files:'Arquivos',treatment_materials:'Materiais do tratamento'};
  const actions = {INSERT:'Inclusão',UPDATE:'Alteração',DELETE:'Exclusão'};
  const safe = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function allowed() { return Boolean(global.OralCloud?.enabled && global.OralCloud?.clinicId && global.OralCurrentUser?.()?.admin); }
  function key(patientId) { return String(global.OralCloud.clinicId) + ':' + String(patientId); }
  function load(patientId, force) {
    if (!allowed()) return;
    const id = String(patientId);
    const k = key(id);
    if (!force && cache.has(k)) return;
    const requestId = Symbol('audit');
    cache.set(k, { loading: true, requestId });
    const box = document.getElementById('ov-patient-audit');
    if (box) box.innerHTML = '<p class="note">Carregando histórico...</p>';
    global.OralCloud.request('/rest/v1/rpc/clinic_patient_audit', {
      method: 'POST', body: { p_clinic: global.OralCloud.clinicId, p_patient: id }
    }).then(rows => {
      if (cache.get(k)?.requestId !== requestId) return;
      cache.set(k, { rows: Array.isArray(rows) ? rows : [] });
      paint(id);
    }).catch(error => {
      if (cache.get(k)?.requestId !== requestId) return;
      cache.set(k, { error: error.message || 'Falha na consulta.' });
      paint(id);
    });
  }
  function content(patientId) {
    if (!allowed()) return '<section class="card"><p class="note">Histórico disponível somente para administradores da clínica conectados ao Supabase.</p></section>';
    const state = cache.get(key(patientId));
    if (!state || state.loading) return '<p class="note">Carregando histórico...</p>';
    if (state.error) return '<p role="alert" class="note">Não foi possível consultar o histórico: ' + safe(state.error) + '</p>';
    if (!state.rows.length) return '<p class="note">Nenhuma alteração disponível para este paciente. Os registros anteriores à atualização da auditoria não têm vínculo recuperável automaticamente.</p>';
    return '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;text-align:left"><thead><tr><th>Data e hora</th><th>Área</th><th>Ação</th><th>Usuário (ID)</th><th>Campos</th></tr></thead><tbody>' + state.rows.map(row => {
      const date = row.changed_at ? new Date(row.changed_at).toLocaleString('pt-BR') : '—';
      const fields = row.changed_fields && typeof row.changed_fields === 'object' ? Object.keys(row.changed_fields).join(', ') : '—';
      return '<tr style="border-top:1px solid var(--line)"><td style="padding:10px 8px;white-space:nowrap">' + safe(date) + '</td><td style="padding:10px 8px">' + safe(labels[row.table_name] || row.table_name) + '</td><td style="padding:10px 8px">' + safe(actions[row.action] || row.action) + '</td><td style="padding:10px 8px;overflow-wrap:anywhere;font-size:12px" title="Identificador do usuário">' + safe(row.changed_by || 'Não identificado') + '</td><td style="padding:10px 8px;overflow-wrap:anywhere">' + safe(fields) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  function paint(patientId) {
    if (String(global.view?.id) !== String(patientId) || global.view?.tab !== 'auditoria') return;
    const box = document.getElementById('ov-patient-audit');
    if (box) box.innerHTML = content(patientId);
  }
  global.OralPatientAudit = {
    allowed,
    render(patient) {
      if (allowed() && !cache.has(key(patient.id))) setTimeout(() => load(patient.id), 0);
      return '<section class="card"><div class="row" style="justify-content:space-between;align-items:center"><h2>Histórico de alterações</h2><button type="button" class="ghost sm" data-act="auditrefresh">Atualizar</button></div><p class="note">Últimos 100 registros. Mostra o campo alterado, não o valor anterior. Alterações anteriores à atualização podem não aparecer.</p><div id="ov-patient-audit" aria-live="polite">' + content(patient.id) + '</div></section>';
    },
    refresh(patientId) { if (allowed()) load(patientId, true); },
    clear() { cache.clear(); }
  };
})(window);
