(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const showError = e => { $('error').textContent = e?.message || 'Não foi possível entrar.'; };
  const formatDate = value => value ? new Date(value).toLocaleDateString('pt-BR',{timeZone:'UTC'}) : '—';
  const formatDateTime = value => value ? new Date(value).toLocaleString('pt-BR') : '—';
  const statuses = {trial:'Em teste',active:'Ativa',past_due:'Em atraso',expired:'Expirada',exempt:'Sem vencimento',canceled:'Cancelada'};
  async function manageSubscription(c,action){
    let until=null,days=null,reason='';
    if(action==='extend'){
      const raw=prompt('Prorrogar por quantos dias? (1 a 3650)','15');
      if(raw===null)return;
      days=Number(raw);
      if(!Number.isInteger(days)||days<1||days>3650){alert('Informe de 1 a 3650 dias.');return;}
    }
    if(action==='set_date'){
      const raw=prompt('Nova data de vencimento (AAAA-MM-DD):','');
      if(raw===null)return;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)||Number.isNaN(Date.parse(raw))){alert('Data inválida.');return;}
      until=raw;
    }
    if(action==='grace'){
      const raw=prompt('Dias de tolerância após vencimento (0 a 365):',String(c.grace_days ?? 0));
      if(raw===null)return;
      days=Number(raw);
      if(!Number.isInteger(days)||days<0||days>365){alert('Informe de 0 a 365 dias.');return;}
    }
    reason=prompt('Justificativa da alteração (obrigatória):','');
    if(reason===null)return;
    reason=reason.trim();
    if(reason.length<5){alert('Informe uma justificativa com pelo menos 5 caracteres.');return;}
    if(!confirm('Confirmar alteração de assinatura da clínica '+c.nome+'?'))return;
    try{
      await OralCloud.request('/rest/v1/rpc/nexodent_admin_manage_subscription',{method:'POST',body:{p_clinic:c.id,p_action:action,p_days:days,p_until:until,p_reason:reason}});
      await load();
    }catch(err){alert('Não foi possível alterar a assinatura: '+err.message);}
  }
  function renderClinics(){
    const term=($('clinic-search')?.value||'').toLocaleLowerCase('pt-BR');
    const filter=$('clinic-filter')?.value||'';
    $('clinics').replaceChildren();
    for(const c of window.nexoClinics||[]){
      if(!String(c.nome||'').toLocaleLowerCase('pt-BR').includes(term))continue;
      if(filter && c.status_assinatura!==filter)continue;
      const tr=document.createElement('tr');
      const status=c.status_assinatura || 'Não configurada';
      for(const value of [c.nome,formatDate(c.created_at),statuses[status]||status,formatDate(c.vencimento),String(c.grace_days??0)+' dias']){
        const td=document.createElement('td');td.textContent=value??'—';tr.appendChild(td);
      }
      const td=document.createElement('td');td.className='actions';
      for(const [label,action] of [['+ Dias','extend'],['Definir data','set_date'],['Sem vencimento','permanent'],['Tolerância','grace'],['Suspender','suspend'],['Reativar','reactivate']]){
        const b=document.createElement('button');b.type='button';b.className='secondary action';b.textContent=label;
        b.addEventListener('click',async()=>{b.disabled=true;try{await manageSubscription(c,action)}finally{b.disabled=false}});
        td.appendChild(b);
      }
      tr.appendChild(td);$('clinics').appendChild(tr);
    }
  }
  $('clinic-search').addEventListener('input',renderClinics);
  $('clinic-filter').addEventListener('change',renderClinics);
  async function load() {
    const result = await OralCloud.request('/rest/v1/rpc/nexodent_admin_overview', {method:'POST',body:{}});
    $('total').textContent = result.total_clinicas;
    $('members').textContent = result.total_vinculos;
    $('trials').textContent = result.em_teste ?? 0;
    $('active').textContent = result.assinaturas_ativas ?? 0;
    window.nexoClinics = result.clinicas || [];
    renderClinics();
    try {
      const history = await OralCloud.request('/rest/v1/rpc/nexodent_admin_subscription_history',{method:'POST',body:{}});
      $('audit').replaceChildren();
      for(const item of history || []){
        const tr=document.createElement('tr');
        for(const value of [formatDateTime(item.created_at),item.clinic_name || item.clinic_id,item.action,item.actor_id,item.reason]){
          const td=document.createElement('td');td.textContent=value ?? '—';tr.appendChild(td);
        }
        $('audit').appendChild(tr);
      }
    }catch(err){$('audit').replaceChildren();const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=5;td.textContent='Histórico indisponível: '+err.message;tr.appendChild(td);$('audit').appendChild(tr);}
    const requests = await OralCloud.request('/rest/v1/rpc/nexodent_admin_trial_requests', {method:'POST',body:{}});
    $('requests').replaceChildren();
    for (const r of requests || []) {
      const tr = document.createElement('tr');
      for (const value of [r.nome,r.clinica,r.email,r.whatsapp,r.status,r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : '—']) {
        const td=document.createElement('td'); td.textContent=value??'';tr.appendChild(td);
      }
      const td=document.createElement('td');
      if(r.status==='pending') for(const [label,decision] of [['Aprovar teste','approved'],['Recusar','rejected']]) {
        const button=document.createElement('button');button.textContent=label;button.className=decision==='rejected'?'secondary':'';
        button.addEventListener('click',async()=>{
          if(!confirm('Confirma? A aprovação permite ao titular ativar seu teste em /ativar-teste/ após confirmar o e-mail.'))return;
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
