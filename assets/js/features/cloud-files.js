(function () {
  'use strict';
  if (!window.OralCloud?.enabled) return;
  let generation = 0;
  const cache = new Map();
  const urls = new Set();
  const nativeFilesTab = tabArquivos;
  PM_SAFE.add('cloudfileopen');
  PM_SAFE.add('cloudfilesretry');
  PM_SAFE.add('cloudfilefilter');
  function entry(patient) {
    const key = JSON.stringify(patient.id);
    if (!cache.has(key)) cache.set(key, { rows: null, loading: false, error: '', signatures: new Set(), filter: 'Todos' });
    return cache.get(key);
  }
  function redraw(patient, token) {
    if (token === generation && !LOCKED && cur()?.id === patient.id) render();
  }
  async function metadata(patient) {
    const state = entry(patient);
    if (state.rows) return state.rows;
    if (state.promise) return state.promise;
    const token = generation;
    state.loading = true;
    state.promise = OralCloudData.files(patient.id).then(rows => {
      if (token !== generation) throw new Error('A clínica mudou durante a leitura.');
      state.rows = rows;
      state.error = '';
      return rows;
    }).catch(error => { state.error = error.message; throw error; })
      .finally(() => { state.loading = false; state.promise = null; redraw(patient, token); });
    return state.promise;
  }
  function report(error) { toast(error.message || 'Não foi possível concluir a operação.', 5000); }
  async function append(patient, file) {
    await OralCloudSync.fileOperation(patient.id, 'append', { file });
    cache.delete(JSON.stringify(patient.id));
    if (cur()?.id === patient.id) render();
  }
  async function upload(patient, files, category) {
    for (const file of files) {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Não foi possível ler ' + file.name));
        reader.readAsDataURL(file);
      });
      await append(patient, { id: uid(), nome: file.name, tipo: file.type,
        categoria: category, data, dataEnvio: hojeBR() });
    }
    toast('Arquivo(s) confirmado(s) no Supabase.');
  }
  async function ensureSignature(patient, slot) {
    const state = entry(patient);
    if (state.signatures.has(slot)) return;
    if (state['promise-' + slot]) return state['promise-' + slot];
    state['loading-' + slot] = true;
    const token = generation;
    const slots = slot === 'sign' ? ['sign', 'signDate', 'signTermo'] : ['evolSign', 'evolSignDate'];
    state['promise-' + slot] = (async () => { try {
      const rows = await metadata(patient);
      const values = {};
      for (const name of slots) {
        const descriptor = rows.find(row => row.slot === name);
        values[name] = descriptor ? (await OralCloudData.file(patient.id, descriptor.id)).dados : '';
      }
      if (token !== generation) return;
      Object.assign(patient, values);
      state.signatures.add(slot);
      state.error = '';
    } catch (error) { state.error = error.message; }
    finally { state['loading-' + slot] = false; state['promise-' + slot] = null; redraw(patient, token); }
    })();
    return state['promise-' + slot];
  }
  async function signaturesForPrint(patient) {
    for (const slot of ['sign', 'evolSign']) {
      await ensureSignature(patient, slot);
      if (entry(patient).error) throw new Error(entry(patient).error);
    }
  }
  function signatureReady(patient, slot) {
    const state = entry(patient);
    if (state.signatures.has(slot)) return true;
    const canvas = $(slot === 'sign' ? 'sig' : 'evsig');
    if (canvas) canvas.style.pointerEvents = 'none';
    const status = $(slot === 'sign' ? 'sigst' : 'evsigst');
    if (status) {
      status.textContent = state.error || 'Carregando assinatura...';
      if (state.error) {
        const retry = document.createElement('button');
        retry.type = 'button'; retry.textContent = 'Tentar novamente';
        retry.onclick = () => { state.error = ''; ensureSignature(patient, slot); };
        status.appendChild(retry);
      }
    }
    if (!state.error) ensureSignature(patient, slot);
    return false;
  }
  async function signature(patient, slot, values) {
    await OralCloudSync.fileOperation(patient.id, 'signature', { slot, values });
    const state = entry(patient);
    state.rows = null;
    state.signatures.add(slot);
    Object.assign(patient, values);
    if (cur()?.id === patient.id) render();
  }
  tabArquivos = function (patient) {
    const state = entry(patient);
    if (!state.rows && !state.loading && !state.error) metadata(patient).catch(() => {});
    const base = nativeFilesTab({ ...patient, arquivos: [] });
    const list = state.rows?.filter(row => row.slot === 'arquivos' && row.position >= 0) || [];
    const categories = ['Todos', 'Receituário', 'Atestado', 'Relatório', 'Outros'];
    const classified = list.map((row, index) => ({ row, index, category: String(row.dados?.categoria || 'Outros') }));
    const categoryOf = item => categories.includes(item.category) && item.category !== 'Todos' ? item.category : 'Outros';
    const count = category => category === 'Todos' ? classified.length : classified.filter(item => categoryOf(item) === category).length;
    const active = categories.includes(state.filter) ? state.filter : 'Todos';
    const filters = categories.map((category, index) => `<button type="button" class="${category === active ? 'primary' : 'ghost'} sm" data-act="cloudfilefilter" data-category-index="${index}" aria-pressed="${category === active}">${esc(category)} (${count(category)})</button>`).join(' ');
    const visible = classified.filter(item => active === 'Todos' || categoryOf(item) === active);
    const content = state.error
      ? `<p role="alert">${esc(state.error)}</p><button data-act="cloudfilesretry">Tentar novamente</button>`
      : state.loading ? '<p role="status">Carregando arquivos...</p>'
        : visible.map(({row, index}) => `<article class="ov-file-card"><strong>${esc(row.dados?.nome || 'Arquivo')}</strong>
          <p>${esc(row.dados?.categoria || 'Outros')} · ${esc(row.dados?.dataEnvio || 'Data não informada')}</p>
          <button class="ghost sm" data-act="cloudfileopen" data-index="${index}">Abrir / baixar</button>
          <button class="danger sm" data-act="cloudfiledelete" data-index="${index}">Excluir</button></article>`).join('') || '<p>Nenhum documento nesta categoria.</p>';
    const marker = '<h2>Arquivos anexados';
    const markerAt = base.indexOf(marker);
    const header = markerAt >= 0 ? base.slice(0, markerAt) : base;
    return header
      .replace('Para evitar que o navegador fique sem espaço, cada arquivo pode ter até 1,5 MB.', 'Cada novo arquivo pode ter até 1,5 MB.')
      .replace('Os anexos ficam salvos neste navegador; faça backups regularmente.', 'Os anexos ficam no Supabase; faça backups regularmente.')
      + `<div id="nexo-signature-upload-slot"></div><h2>Arquivos anexados (${list.length})</h2><div class="ov-file-filters" style="display:flex;flex-wrap:wrap;gap:6px;margin:12px 0">${filters}</div><div class="ov-file-grid">${content}</div>`;
  };
  // Resumo somente leitura de documentos na linha do tempo clínica.
  // Os arquivos permanecem no armazenamento existente e são abertos na aba Documentos.
  function timelineCloudSummary() {
    const slot = document.getElementById('nexo-timeline-cloud-slot');
    const patient = cur();
    if (!slot || !patient) return;
    const state = entry(patient);
    if (!state.rows && !state.loading && !state.error) metadata(patient).catch(() => {});
    if (state.error) { slot.textContent = 'Documentos na nuvem indisponíveis no momento.'; return; }
    if (!state.rows) { slot.textContent = 'Consultando documentos na nuvem...'; return; }
    const rows = state.rows.filter(row => row.slot === 'arquivos' && row.position >= 0);
    slot.replaceChildren();
    const title = document.createElement('p');
    title.className = 'note';
    title.textContent = `Documentos arquivados na nuvem: ${rows.length}. Abra a aba Radiografias e documentos para visualizar ou baixar.`;
    slot.appendChild(title);
  }
  const timelineObserver = new MutationObserver(() => {
    if (document.getElementById('nexo-timeline-cloud-slot')) timelineCloudSummary();
  });
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body) timelineObserver.observe(document.body, {childList:true,subtree:true});
  });
  A.cloudfilefilter = (button, data, patient) => {
    if (!patient) return;
    const categories = ['Todos', 'Receituário', 'Atestado', 'Relatório', 'Outros'];
    const category = categories[Number(data.categoryIndex)];
    if (!category) return;
    entry(patient).filter = category;
    render();
  };
  A.cloudfilesretry = () => { const patient = cur(); if (!patient) return; cache.delete(JSON.stringify(patient.id)); render(); };
  A.cloudfileopen = async (button, data, patient) => {
    const rows = entry(patient).rows?.filter(row => row.slot === 'arquivos' && row.position >= 0) || [];
    const descriptor = rows[Number(data.index)];
    if (!descriptor) return;
    button.disabled = true;
    try {
      const row = await OralCloudData.file(patient.id, descriptor.id);
      if (typeof row.dados?.data !== 'string' || !/^data:/i.test(row.dados.data))
        throw new Error('Conteúdo do arquivo inválido. Solicite recuperação administrativa.');
      const response = await fetch(row.dados.data);
      const url = URL.createObjectURL(await response.blob());
      urls.add(url);
      const link = document.createElement('a');
      link.href = url; link.download = row.dados.nome || 'arquivo'; link.click();
      setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url); }, 60000);
    } catch (error) { report(error); }
    finally { button.disabled = false; }
  };
  A.cloudfiledelete = async (button, data, patient) => {
    const rows = entry(patient).rows?.filter(row => row.slot === 'arquivos' && row.position >= 0) || [];
    const row = rows[Number(data.index)];
    if (!row || !confirm('Excluir este arquivo do prontuário?')) return;
    button.disabled = true;
    try {
      await OralCloudSync.fileOperation(patient.id, 'delete', { row_id: row.id });
      cache.delete(JSON.stringify(patient.id)); render();
    } catch (error) { report(error); }
    finally { button.disabled = false; }
  };
  for (const [action, slot] of [['sigclr', 'sign'], ['evsigclr', 'evolSign']]) {
    A[action] = async (button, data, patient) => {
      if (!patient || !signatureReady(patient, slot)) return;
      const names = slot === 'sign' ? ['sign', 'signDate', 'signTermo'] : ['evolSign', 'evolSignDate'];
      try { await signature(patient, slot, Object.fromEntries(names.map(name => [name, '']))); }
      catch (error) { report(error); }
    };
  }
  for (const [action, create, category] of [['rxsave', rxDoc, 'Receituário'], ['atsave', atDoc, 'Atestado']]) {
    A[action] = async (button, data, patient) => {
      if (!patient) return;
      button.disabled = true;
      try {
        // rxDoc/atDoc podem retornar Promise: aguardar antes de acessar .doc.output.
        const generated = await create(patient);
        if (!generated) return;
        if (!generated.doc || typeof generated.doc.output !== 'function') {
          throw new Error('O gerador de PDF não retornou um documento válido.');
        }
        const pdfData = generated.doc.output('datauristring');
        if (typeof pdfData !== 'string' || !pdfData.startsWith('data:application/pdf')) {
          throw new Error('Não foi possível preparar o PDF para o prontuário.');
        }
        await append(patient, { id: uid(), nome: generated.fname, tipo: 'application/pdf', categoria: category,
          data: pdfData.replace(/;filename=[^;]*;/, ';'), dataEnvio: hojeBR() });
      } catch (error) { report(error); }
      finally { button.disabled = false; }
    };
  }
  for (const action of ['printficha', 'printevol']) {
    const original = A[action];
    A[action] = async (button, data, patient) => {
      if (!patient) return;
      button.disabled = true;
      try { await signaturesForPrint(patient); original(button, data, patient); }
      catch (error) { report(error); }
      finally { button.disabled = false; }
    };
  }
  let backupText = '';
  let preparedBackup = '';
  let backingUp = false;
  async function prepareBackup() {
    await OralCloudSync.flush();
    const data = await OralCloudData.exportData(db);
    if (!Array.isArray(data?.p)) throw new Error('Exportação incompleta: lista de pacientes ausente.');
    const text = JSON.stringify({ app: 'consultorio', v: 2, exp: new Date().toISOString(), data });
    if (!text || new Blob([text]).size < 100) throw new Error('Backup vazio ou incompleto. Nenhum arquivo foi criado.');
    return text;
  }
  bkHtml = function () {
    return `<section><h2>Backup e restauração</h2>
      <div class="card" style="margin-bottom:16px"><h3>Backup automático criptografado</h3>
      <p class="note">Rotina preparada no GitHub Actions para executar diariamente às 02:00 (horário de Brasília, UTC−3), com retenção de 30 dias. <strong>Status: não verificado.</strong> Esta tela não recebe confirmação automática do GitHub; não considere o backup ativo antes de conferir uma execução concluída.</p>
      <p class="note">No repositório GitHub, abra Actions → Backup criptografado do Supabase → Run workflow. Configure os segredos <code>SUPABASE_DB_URL</code> e <code>BACKUP_AGE_RECIPIENT</code> nas configurações do repositório. Guarde a chave privada age em local seguro, fora do sistema.</p>
      <p class="note">Após executar, confira o resultado e baixe o artefato criptografado. Teste periodicamente a restauração em ambiente separado. O backup do banco não inclui automaticamente os arquivos do Supabase Storage.</p>
      <a class="ghost" href="https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/manually-running-a-workflow" target="_blank" rel="noopener noreferrer">Como executar e conferir no GitHub</a></div>
      <p>Exportação dos dados autorizados, incluindo anexos. Para uma cópia administrativa completa ou volumes grandes, utilize pg_dump.</p>
      <button data-act="bksave"${backingUp ? ' disabled' : ''}>${backingUp ? 'Preparando backup...' : 'Baixar backup com anexos'}</button>
      ${preparedBackup ? `<button data-act="bkdownload">Salvar backup preparado (${(new Blob([preparedBackup]).size / 1048576).toFixed(1)} MB)</button>` : ''}
      <button class="ghost" data-act="bktxt"${backingUp ? ' disabled' : ''}>Mostrar texto do backup</button>
      ${backupText ? `<textarea readonly aria-label="Backup completo">${esc(backupText)}</textarea><button data-act="bkcopy">Copiar backup preparado</button>` : ''}
      <h2>Restaurar backup</h2><label for="rstf">Arquivo JSON</label><input id="rstf" type="file" accept=".json,application/json">
      <label for="rst">Texto do backup</label><textarea id="rst">${esc(view.rst || '')}</textarea>
      <button class="danger" data-act="bkrst">Restaurar dados</button>
      <h2>Importar pacientes</h2><label for="importPacFile">Arquivo CSV ou JSON</label><input id="importPacFile" type="file" accept=".csv,.txt,.json">${acHtml()}</section>`;
  };
  async function backup(showText) {
    if (backingUp) return;
    backingUp = true;
    preparedBackup = '';
    render();
    try {
      const text = await prepareBackup();
      if (showText) {
        backupText = text;
        toast('Texto do backup preparado.');
      } else {
        preparedBackup = text;
        toast('Backup preparado. Clique em “Salvar backup preparado” para gravar no computador.', 7000);
      }
    } catch (error) { report(error); }
    finally { backingUp = false; render(); }
  }
  A.bksave = async () => {
    if (backingUp) return;
    if (typeof window.showSaveFilePicker !== 'function' || !window.isSecureContext) {
      toast('Para backup grande, abra o Nexodent no Chrome ou Edge atualizado (HTTPS).', 7000);
      return;
    }
    let handle;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: 'oralvalle-backup-' + tdy() + '.json',
        types: [{ description: 'Backup JSON', accept: { 'application/json': ['.json'] } }]
      });
    } catch (error) {
      if (error?.name !== 'AbortError') report(error);
      return;
    }
    backingUp = true;
    render();
    let stream;
    try {
      await OralCloudSync.flush();
      stream = await handle.createWritable();
      let last = 0;
      const bytes = await OralCloudData.exportToWritable(db, stream, (done, total) => {
        const now = Date.now();
        if (now - last > 1200 || done === total) {
          last = now;
          const label = document.querySelector('[data-act="bksave"]');
          if (label) label.textContent = `Preparando ${done}/${total} pacientes...`;
        }
      });
      if (bytes < 100) throw new Error('Backup vazio: operação cancelada.');
      await stream.close();
      stream = null;
      markBk();
      toast(`Backup salvo (${(bytes / 1048576).toFixed(1)} MB). Verifique o arquivo.`, 7000);
    } catch (error) {
      if (stream) await stream.abort().catch(() => {});
      report(error);
    } finally { backingUp = false; render(); }
  };
  A.bkdownload = async () => {
    if (!preparedBackup) { toast('Prepare o backup primeiro.'); return; }
    const text = preparedBackup;
    const filename = 'oralvalle-backup-' + tdy() + '.json';
    try {
      if (typeof window.showSaveFilePicker === 'function' && window.isSecureContext) {
        // Abrir a janela somente depois de o backup estar completo: nunca criar arquivo vazio.
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'Backup JSON', accept: { 'application/json': ['.json'] } }]
        });
        const stream = await handle.createWritable();
        try {
          await stream.write(new Blob([text], { type: 'application/json' }));
          await stream.close();
        } catch (error) { await stream.abort().catch(() => {}); throw error; }
        toast('Backup salvo no computador. Confira o tamanho do arquivo.', 6000);
      } else {
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url; link.download = filename;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        toast('Download solicitado. Confira o tamanho do arquivo na pasta Downloads.', 6000);
      }
      markBk();
    } catch (error) {
      if (error?.name === 'AbortError') toast('Salvamento cancelado.', 5000);
      else report(error);
    }
  };
  A.bktxt = () => backup(true);
  A.bkcopy = () => { if (backupText) copy(backupText, 'Backup copiado.'); };
  restore = async function () {
    if (!ME?.admin) { toast('Restaurar exige administrador.'); return; }
    try {
      const parsed = JSON.parse(view.rst || '');
      if (parsed.app === 'oralvalle-pending-changes') throw new Error('Este arquivo contém alterações pendentes, não um backup completo.');
      const data = parsed.app === 'consultorio' ? parsed.data : parsed;
      if (!Array.isArray(data?.p)) throw new Error('Backup inválido.');
      if (!confirm('Restaurar substitui os dados da clínica. Confirme que possui um backup completo atual e que não há outros usuários gravando. Continuar?')) return;
      await OralCloudSync.flush();
      $('app').inert = true;
      await OralCloudData.restoreData(migrate(data));
      location.reload();
    } catch (error) { report(error); }
    finally { $('app').inert = false; }
  };
  const originalDelete = A.del;
  A.del = async (button, data, patient) => {
    try {
      const rows = await OralCloudData.files(patient.id);
      if (rows.length) { toast('Paciente possui arquivos ou assinaturas. Mantenha arquivado; a exclusão exige revisão administrativa.', 5000); return; }
      originalDelete(button, data, patient);
    } catch (error) { report(error); }
  };
  window.OralCloudFiles = Object.freeze({ append, upload, signatureReady, signature,
    reset() { generation++; cache.clear(); backupText = ''; preparedBackup = ''; urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); } });
})();