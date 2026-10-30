(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const showError = e => { $('error').textContent = e?.message || 'Não foi possível entrar.'; };
  async function load() {
    const result = await OralCloud.request('/rest/v1/rpc/nexodent_admin_overview', {method:'POST',body:{}});
    $('total').textContent = result.total_clinicas;
    $('members').textContent = result.total_vinculos;
    $('trials').textContent = result.em_teste ?? 0;
    $('active').textContent = result.assinaturas_ativas ?? 0;
    $('clinics').replaceChildren();
    for (const c of result.clinicas || []) {
      const tr = document.createElement('tr');
      for (const value of [c.nome, c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '—', c.status_assinatura || 'Não configurado', c.vencimento ? new Date(c.vencimento).toLocaleDateString('pt-BR') : '—', c.id]) {
        const td = document.createElement('td'); td.textContent = value ?? ''; tr.appendChild(td);
      }
      $('clinics').appendChild(tr);
    }
    const requests = await OralCloud.request('/rest/v1/rpc/nexodent_admin_trial_requests', {method:'POST',body:{}});
    $('requests').replaceChildren();
    for (const r of requests || []) {
      const tr = document.createElement('tr');
      for (const value of [r.nome,r.clinica,r.email,r.whatsapp,r.status,r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : '—']) {
        const td=document.createElement('td'); td.textContent=value??'';tr.appendChild(td);
      }
      const td=document.createElement('td');
      if(r.status==='pending') for(const [label,decision] of [['Aprovar análise','approved'],['Recusar','rejected']]) {
        const button=document.createElement('button');button.textContent=label;button.className=decision==='rejected'?'secondary':'';
        button.addEventListener('click',async()=>{
          if(!confirm('Confirma esta decisão? A aprovação nesta etapa NÃO libera acesso nem inicia o teste.'))return;
          button.disabled=true;
          try {await OralCloud.request('/rest/v1/rpc/nexodent_admin_review_trial',{method:'POST',body:{p_id:r.id,p_decision:decision}});await load()}
          catch(err){alert(err.message);button.disabled=false}
        });td.appendChild(button);td.append(' ');
      }
      tr.appendChild(td);$('requests').appendChild(tr);
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
