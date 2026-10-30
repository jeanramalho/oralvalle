(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const showError = e => { $('error').textContent = e?.message || 'Não foi possível entrar.'; };
  async function load() {
    const result = await OralCloud.request('/rest/v1/rpc/nexodent_admin_overview', {method:'POST',body:{}});
    $('total').textContent = result.total_clinicas;
    $('members').textContent = result.total_vinculos;
    $('clinics').replaceChildren();
    for (const c of result.clinicas || []) {
      const tr = document.createElement('tr');
      for (const value of [c.nome, new Date(c.created_at).toLocaleDateString('pt-BR'), c.id]) {
        const td = document.createElement('td'); td.textContent = value ?? ''; tr.appendChild(td);
      }
      $('clinics').appendChild(tr);
    }
    $('login').style.display = 'none'; $('app').style.display = 'block'; $('logout').hidden = false;
  }
  $('login').addEventListener('submit', async e => {
    e.preventDefault(); $('error').textContent = '';
    const btn = e.currentTarget.querySelector('button'); btn.disabled = true;
    try { await OralCloud.login($('email').value.trim(), $('password').value, false); await load(); }
    catch (err) { showError(err); await OralCloud.logout().catch(() => {}); }
    finally { btn.disabled = false; }
  });
  $('logout').addEventListener('click', async () => {
    await OralCloud.logout(); $('app').style.display = 'none'; $('login').style.display = 'block'; $('logout').hidden = true;
  });
  OralCloud.restoreSession().then(session => { if (session) return load(); }).catch(showError);
})();
