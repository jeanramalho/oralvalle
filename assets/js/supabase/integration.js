(function () {
  'use strict';
  if (!OralCloud.enabled) return;
  let pending = null;
  let running = null;
  let timer = null;
  let failure = null;
  let memberBaseline = [];
  let memberQueue = Promise.resolve();
  let membersRunning = false;
  let membersPending = 0;
  let disposed = false;
  let accessRequests = [];
  let accessError = '';
  let accessLoading = false;
  const copy = value => JSON.parse(JSON.stringify(value));
  const localToast = toast;
  const localPermissionCard = pmCardHtml;

  function status(message, error = false) {
    let panel = $('cloudStatus');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'cloudStatus';
      panel.setAttribute('role', 'status');
      document.body.appendChild(panel);
    }
    panel.className = 'cloud-status' + (error ? ' cloud-error' : '');
    panel.replaceChildren();
    const text = document.createElement('span');
    text.textContent = message;
    panel.appendChild(text);
    if (error) {
      const backup = document.createElement('button');
      backup.className = 'ghost sm';
      backup.textContent = 'Baixar alterações pendentes';
      backup.onclick = () => downloadBackup();
      const retry = document.createElement('button');
      retry.className = 'sm';
      retry.textContent = failure?.code === '40001' || failure?.needsReload ? 'Recarregar dados' : 'Tentar novamente';
      retry.onclick = async () => {
        if (failure?.code === '40001' || failure?.needsReload) {
          if (!confirm('As alterações locais ainda não foram gravadas. Baixe um backup antes. Recarregar descarta as alterações pendentes e lê o banco novamente.')) return;
          pending = null;
          failure = null;
          try { await openClinic(OralCloud.keep); } catch (error) { status(error.message, true); }
        } else { failure = null; flush().catch(() => {}); }
      };
      panel.append(backup, retry);
    }
    panel.hidden = false;
  }

  function downloadBackup() {
    const url = URL.createObjectURL(new Blob([bkData()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'oralvalle-alteracoes-pendentes-' + tdy() + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function saved() {
    lastSaved = new Date();
    lastSavedPid = view.id || null;
    updSaveStat();
    status('✓ Alterações confirmadas no Supabase.');
  }

  async function flush() {
    clearTimeout(timer);
    if (membersRunning) return memberQueue.then(() => flush());
    if (running) return running;
    if (failure) throw failure;
    running = (async () => {
      while (pending && !disposed) {
        const snapshot = pending;
        pending = null;
        try {
          await OralCloudData.save(snapshot);
          if (!pending) saved();
        } catch (error) {
          if (!pending) pending = snapshot;
          failure = error;
          status(error.code === '40001'
            ? 'Outro usuário alterou a clínica. Suas alterações não foram sobrescritas: baixe o backup e recarregue.'
            : 'Não foi possível gravar no Supabase: ' + error.message, true);
          throw error;
        }
      }
    })().finally(() => { running = null; updSaveStat(); });
    return running;
  }

  save = function () {
    if (LOCKED || !OralCloud.clinicId || disposed) {
      localToast('Entre na clínica antes de gravar dados.', 3500);
      return;
    }
    pending = copy(db);
    lastSaved = null;
    updSaveStat();
    if (!failure) status('Gravando alterações no Supabase…');
    clearTimeout(timer);
    timer = setTimeout(() => flush().catch(() => {}), 350);
  };

  saveStatText = function (patient) {
    if (failure) return '⚠ Alterações não gravadas no Supabase';
    if (pending || running) return '⏳ Aguardando confirmação do Supabase';
    return patient && lastSaved && lastSavedPid === patient.id
      ? '✓ Tudo salvo às ' + hhmm(lastSaved) : '✓ Dados carregados do Supabase';
  };
  toastSaved = function () {
    if (failure) return localToast('Há alterações pendentes. Confira o aviso de conexão.', 3500);
    localToast(pending || running ? 'Aguardando confirmação do Supabase…' : '✓ Alterações confirmadas no Supabase');
  };
  toast = function (message, duration) {
    // Ações legadas avisam imediatamente; não confundir mudança em tela com gravação remota.
    if ((pending || running || membersPending) && /salv|registrad|restaurad|cadastrad|atualizad|removid|importa.*conclu/i.test(message))
      message += ' — confirmação no Supabase pendente.';
    localToast(message, duration);
  };

  async function openClinic(keep) {
    disposed = false;
    const clinics = await OralCloud.request('/rest/v1/rpc/clinic_list', { method: 'POST', body: {} });
    if (!Array.isArray(clinics) || !clinics.length)
      throw new Error('Sua conta ainda não tem acesso à clínica. Confirme seu e-mail e peça ao administrador Ricardo Silva que aprove seu cadastro em Configurações → Acessos.');
    const configured = OralCloud.config.clinicId;
    const clinic = configured ? clinics.find(item => item.clinic_id === configured) : clinics.length === 1 ? clinics[0] : null;
    if (!clinic) throw new Error('Defina clinicId no arquivo de configuração: há mais de uma clínica ou o vínculo não corresponde.');
    OralCloud.clinicId = clinic.clinic_id;
    AUTH = { users: (await OralCloudData.members()).filter(member => member.active), rec: null };
    memberBaseline = copy(AUTH.users);
    const raw = await OralCloudData.load();
    // Nunca importar automaticamente os dados locais ao preencher as credenciais.
    db = migrate(raw);
    OralCloudData.prepareDefaults(db);
    const member = AUTH.users.find(user => user.id === clinic.user_id);
    if (!member) throw new Error('Vínculo de usuário não disponível.');
    accessRequests = [];
    accessError = '';
    if (member.admin) await refreshAccessRequests();
    pending = null;
    failure = null;
    lastSaved = null;
    unlock(member, keep);
    OralCloudData.prepareDefaults(db);
    status('Conectado ao Supabase · ' + clinic.nome);
  }

  async function refreshAccessRequests() {
    accessLoading = true;
    try {
      accessRequests = await OralCloudData.pendingUsers();
      accessError = '';
    } catch (error) {
      accessRequests = [];
      accessError = error.code === 'PGRST202' || error.status === 404
        ? 'Execute a migration 202610140002_main_clinic_access.sql para ativar a aprovação de usuários.'
        : 'Não foi possível carregar as solicitações: ' + explain(error);
    } finally { accessLoading = false; }
  }

  function accessRequestsHtml() {
    const list = accessRequests.map(user => `<article class="pg" style="flex-wrap:wrap">
      <span><strong>${esc(user.nome || 'Usuário sem nome')}</strong><br>${esc(user.email)}</span>
      <span class="row" style="flex:none"><button class="sm" data-act="cloudapprove" data-id="${esc(user.id)}">Aprovar</button><button class="danger sm" data-act="cloudreject" data-id="${esc(user.id)}">Rejeitar</button></span>
    </article>`).join('');
    return `<section class="card"><div class="row"><h2 style="margin:0">Solicitações de acesso</h2><button class="ghost sm" data-act="cloudrequests"${accessLoading ? ' disabled' : ''}>Atualizar</button></div>
      <p class="note">Somente contas com e-mail confirmado aparecem aqui. Aprovar libera inicialmente a visualização da agenda, lista de pacientes e lembretes. Ajuste abaixo as permissões de cada usuário.</p>
      ${accessError ? `<p role="alert">${esc(accessError)}</p>` : list || '<p class="note">Nenhuma solicitação pendente.</p>'}</section>`;
  }

  function cloudLock(mode, message = '') {
    LOCKED = true;
    clearTimeout(idleT);
    $('app').innerHTML = '';
    $('app').style.display = 'none';
    let lock = $('lock');
    if (!lock) { lock = document.createElement('div'); lock.id = 'lock'; document.body.appendChild(lock); }
    const clinic = topCl();
    const warning = message ? `<div class="lk-err" role="alert">${esc(message)}</div>` : '';
    const email = '<label for="cloudEmail">E-mail</label><input id="cloudEmail" type="email" autocomplete="username" autocapitalize="none" required>';
    let body;
    if (mode === 'signup') body = `<h1>Criar conta</h1><p class="lk-t">Cadastre seu acesso. O administrador precisará autorizar sua entrada na clínica.</p>${warning}<label for="cloudName">Nome completo</label><input id="cloudName" autocomplete="name" required>${email}<label for="cloudPassword">Senha (mínimo 6 caracteres)</label><input id="cloudPassword" type="password" autocomplete="new-password" minlength="6" required><label for="cloudRepeat">Repita a senha</label><input id="cloudRepeat" type="password" autocomplete="new-password" minlength="6" required><button type="submit">Cadastrar</button><button type="button" class="lk-link" data-cloud-back>Já tenho conta. Entrar</button>`;
    else if (mode === 'recover') body = `<h1>Redefinir senha</h1><p class="lk-t">Enviaremos um link para o e-mail cadastrado no Supabase.</p>${warning}${email}<button type="submit">Enviar link</button><button type="button" class="lk-link" data-cloud-back>Voltar</button>`;
    else if (mode === 'password') body = `<h1>Definir senha</h1>${warning}<label for="cloudPassword">Nova senha</label><input id="cloudPassword" type="password" autocomplete="new-password" minlength="6" required><label for="cloudRepeat">Repita a senha</label><input id="cloudRepeat" type="password" autocomplete="new-password" minlength="6" required><button type="submit">Salvar senha</button>`;
    else body = `<h1>Entrar</h1><p class="lk-t">Entre com seu acesso da clínica no Supabase.</p>${warning}${email}<label for="cloudPassword">Senha</label><input id="cloudPassword" type="password" autocomplete="current-password" required><label class="lk-chk"><input id="cloudKeep" type="checkbox"> Manter conectado neste aparelho</label><button type="submit">Entrar</button><button type="button" class="lk-link" data-cloud-signup>Criar conta</button><button type="button" class="lk-link" data-cloud-forgot>Esqueci a senha</button>`;
    lock.innerHTML = `<div class="lk-box"><div class="lk-brand"><strong>${esc(clinic.marca)}</strong><span>${esc(clinic.sub)}</span></div><form>${body}</form></div>`;
    lock.querySelector('[data-cloud-signup]')?.addEventListener('click', () => { location.hash = 'cadastro'; });
    lock.querySelector('[data-cloud-back]')?.addEventListener('click', () => {
      if (location.hash === '#cadastro') history.replaceState(null, '', location.pathname + location.search);
      cloudLock('login');
    });
    lock.querySelector('[data-cloud-forgot]')?.addEventListener('click', () => cloudLock('recover'));
    lock.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      const button = lock.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        if (mode === 'signup') {
          const nome = $('cloudName').value.trim();
          const password = $('cloudPassword').value;
          const error = pwOk(password, $('cloudRepeat').value);
          if (!nome) throw new Error('Preencha seu nome.');
          if (error) throw new Error(error);
          await OralCloud.signup(nome, $('cloudEmail').value.trim(), password);
          history.replaceState(null, '', location.pathname + location.search);
          cloudLock('login', 'Solicitação de cadastro enviada. Se necessário, confirme seu e-mail. Para acessar a clínica, peça ao administrador que autorize sua conta. Se já possui conta, entre ou recupere sua senha.');
        } else if (mode === 'recover') {
          await OralCloud.recover($('cloudEmail').value.trim());
          cloudLock('login', 'Se o e-mail estiver cadastrado, você receberá o link de recuperação.');
        } else if (mode === 'password') {
          const password = $('cloudPassword').value;
          const error = pwOk(password, $('cloudRepeat').value);
          if (error) throw new Error(error);
          await OralCloud.password(password);
          await openClinic(OralCloud.keep);
        } else {
          const keep = $('cloudKeep').checked;
          await OralCloud.login($('cloudEmail').value.trim(), $('cloudPassword').value, keep);
          await openClinic(keep);
        }
      } catch (error) { cloudLock(mode, explain(error)); }
    };
    lock.querySelector('input')?.focus();
  }

  function explain(error) {
    if (error.code === 'PGRST202' || error.status === 404)
      return 'As migrations ainda não estão disponíveis. Execute o SQL fornecido no painel Supabase e recarregue.';
    return error.message || 'Falha de conexão. Verifique sua internet e tente novamente.';
  }

  authBoot = async function () {
    db = migrate({});
    cloudLock(location.hash === '#cadastro' ? 'signup' : 'login');
    try {
      const restored = await OralCloud.restoreSession();
      if (restored?.recovery) cloudLock('password');
      else if (restored) await openClinic(restored.keep);
    } catch (error) { cloudLock('login', explain(error)); }
  };

  window.addEventListener('hashchange', () => {
    if (!LOCKED || !['', '#cadastro'].includes(location.hash)) return;
    cloudLock(location.hash === '#cadastro' ? 'signup' : 'login');
  });

  doLogout = async function (message) {
    try {
      await memberQueue;
      await flush();
    } catch (_) { localToast('Não foi possível sair: há alterações não gravadas. Resolva o aviso ou baixe um backup.', 5000); return; }
    disposed = true;
    try { await OralCloud.logout(); } catch (_) {}
    clearTimeout(idleT);
    ME = null; AUTH = { users: [], rec: null };
    accessRequests = []; accessError = '';
    db = migrate({}); view.id = null; view.h = 'pac'; delArm = null;
    $('cloudStatus')?.remove();
    cloudLock('login', message || '');
  };

  acHtml = function () {
    if (!ME) return '';
    return `<section class="card"><h2>Meu acesso</h2><p>Conectado como <strong>${esc(ME.nome)}</strong> (${esc(ME.login)}).</p><p class="note">Dados compartilhados no Supabase. Novas contas são criadas na tela de cadastro e aprovadas pelo administrador em Configurações → Acessos, onde também são ajustadas as permissões.</p><button class="ghost" data-act="logout">Sair do sistema</button><h2 style="margin-top:18px">Alterar minha senha</h2><label for="acp0">Senha atual</label><input id="acp0" type="password" autocomplete="current-password"><label for="acp1">Nova senha</label><input id="acp1" type="password" autocomplete="new-password"><label for="acp2">Repita a nova senha</label><input id="acp2" type="password" autocomplete="new-password"><button data-act="acpw" style="margin-top:12px">Alterar senha</button></section>`;
  };
  pmCardHtml = function () {
    const html = localPermissionCard();
    if (!html) return '';
    return accessRequestsHtml() + html.split('<h3 class="up-h" style="margin-top:20px">')[0] + '<p class="note">Novos usuários aparecem nas solicitações após confirmar o e-mail. Remover um usuário revoga o acesso à clínica, sem apagar sua conta de autenticação.</p></section>';
  };

  aSave = function () {
    const captured = copy(AUTH.users);
    membersPending++;
    memberQueue = memberQueue.catch(() => {}).then(async () => {
      await flush();
      membersRunning = true;
      $('app').inert = true;
      try {
        for (const previous of memberBaseline) {
          const current = captured.find(member => member.id === previous.id);
          const patch = !current ? { active: false }
            : JSON.stringify(previous.perms) !== JSON.stringify(current.perms) ? { perms: current.perms } : null;
          if (patch) await OralCloudData.updateMember(previous.id, patch);
        }
        memberBaseline = copy(captured);
        db = migrate(await OralCloudData.load());
        OralCloudData.prepareDefaults(db);
        render();
        OralCloudData.prepareDefaults(db);
        status('✓ Permissões confirmadas no Supabase.');
      } finally {
        membersRunning = false;
        $('app').inert = false;
        if (pending) timer = setTimeout(() => flush().catch(() => {}), 350);
      }
    }).catch(error => {
      AUTH.users = copy(memberBaseline);
      render();
      error.needsReload = true;
      failure = error;
      status('Permissões não confirmadas: ' + explain(error), true);
      localToast('Permissões não gravadas: ' + explain(error), 6000);
      throw error;
    }).finally(() => { membersPending--; });
    memberQueue.catch(() => {});
    status('Gravando permissões no Supabase…');
    return true;
  };

  A.acpw = async function () {
    const password = $('acp1').value;
    const error = pwOk(password, $('acp2').value);
    if (error) return localToast(error, 3500);
    try {
      await OralCloud.login(ME.login, $('acp0').value, OralCloud.keep);
      await OralCloud.password(password);
      render(); localToast('Senha alterada no Supabase.');
    } catch (error) { localToast(explain(error), 5000); }
  };
  A.acadd = () => localToast('Peça ao usuário que crie a conta na tela de cadastro e confirme o e-mail. Depois, aprove a solicitação em Acessos.', 5000);
  A.cloudrequests = async () => {
    if (!ME?.admin || accessLoading) return;
    await refreshAccessRequests();
    if (ME?.admin && !LOCKED) render();
  };
  function decideAccess(button, userId, approve) {
    if (!ME?.admin || membersPending) return;
    const requested = accessRequests.find(user => user.id === userId);
    if (!requested) return;
    if (!confirm((approve ? 'Aprovar o acesso de ' : 'Rejeitar a solicitação de ') + requested.email + '?')) return;
    button.disabled = true;
    membersPending++;
    // A aprovação também muda a revisão clínica; não pode disputar com uma gravação em curso.
    memberQueue = memberQueue.catch(() => {}).then(async () => {
      await flush();
      membersRunning = true;
      $('app').inert = true;
      try {
        await OralCloudData.decideUser(userId, approve);
        AUTH.users = (await OralCloudData.members()).filter(member => member.active);
        memberBaseline = copy(AUTH.users);
        db = migrate(await OralCloudData.load());
        OralCloudData.prepareDefaults(db);
        await refreshAccessRequests();
        render();
        OralCloudData.prepareDefaults(db);
        status(approve ? '✓ Usuário aprovado na clínica.' : '✓ Solicitação rejeitada.');
      } catch (error) {
        // A alteração pode ter ocorrido antes da falha de recarga. Não salvar contra um baseline antigo.
        error.needsReload = true;
        failure = error;
        status('Não foi possível concluir a aprovação: ' + explain(error), true);
        throw error;
      } finally {
        membersRunning = false;
        $('app').inert = false;
      }
    }).finally(() => { membersPending--; button.disabled = false; });
    memberQueue.catch(() => {});
  }
  A.cloudapprove = (button, data) => decideAccess(button, data.id, true);
  A.cloudreject = (button, data) => decideAccess(button, data.id, false);
  A.acrec = () => cloudLock('recover');
  A.savebtn = () => { document.activeElement?.blur(); save(); flush().catch(() => {}); };
  const localBackupView = bkHtml;
  bkHtml = () => localBackupView().replace('guardados neste navegador. Se limpar o navegador ou trocar de aparelho, tudo se perde.', 'compartilhados no Supabase. Faça backup antes de restaurar ou importar dados.');

  window.addEventListener('beforeunload', event => {
    if (pending || running || failure || membersPending) { event.preventDefault(); event.returnValue = ''; }
  });
  window.OralCloudSync = Object.freeze({ flush, get dirty() { return Boolean(pending || running || failure || membersPending); } });
})();