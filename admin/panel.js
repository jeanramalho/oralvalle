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

  const money = n => Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const cycleLabels={monthly:'Mensal',quarterly:'Trimestral',yearly:'Anual',free:'Gratuito'};
  async function rpc(name,body={}) { return OralCloud.request('/rest/v1/rpc/'+name,{method:'POST',body}); }
  async function loadCommercial(){
    try{
      const data=await rpc('nexodent_admin_commercial_overview');
      const plans=data.plans||[], payments=data.payments||[];
      $('plans').replaceChildren();
      for(const p of plans){
        const tr=document.createElement('tr');
        for(const value of [p.name,cycleLabels[p.cycle]||p.cycle,money(p.price_cents/100),(p.modules||[]).join(', ')]){
          const td=document.createElement('td');td.textContent=value;tr.appendChild(td);
        }
        const td=document.createElement('td');const b=document.createElement('button');b.className='secondary';b.textContent='Vincular à clínica';
        b.addEventListener('click',async()=>{
          const names=(window.nexoClinics||[]).map((c,i)=>`${i+1}. ${c.nome}`).join('\n');
          const n=prompt('Escolha o número da clínica:\n'+names);if(n===null)return;
          const c=(window.nexoClinics||[])[Number(n)-1];if(!c){alert('Clínica inválida');return;}
          const reason=prompt('Justificativa (mínimo 5 caracteres):');if(!reason||reason.trim().length<5)return;
          if(!confirm(`Vincular ${p.name} à clínica ${c.nome}?`))return;
          try{await rpc('nexodent_admin_set_clinic_plan',{p_clinic:c.id,p_plan:p.id,p_reason:reason.trim()});await loadCommercial();alert('Plano vinculado.');}catch(e){alert(e.message)}
        });td.appendChild(b);tr.appendChild(td);$('plans').appendChild(tr);
      }
      const clinicSelect=$('payment-clinic');const prev=clinicSelect.value;clinicSelect.replaceChildren();
      for(const c of window.nexoClinics||[]){const o=document.createElement('option');o.value=c.id;o.textContent=c.nome;clinicSelect.appendChild(o)}clinicSelect.value=prev||clinicSelect.value;
      $('payments').replaceChildren();let received=0,open=0,overdue=0;
      for(const p of payments){
        const tr=document.createElement('tr');const late=p.status==='open'&&p.due_date<new Date().toISOString().slice(0,10);
        if(p.status==='paid')received+=p.amount_cents;else if(p.status==='open'){open+=p.amount_cents;if(late)overdue+=p.amount_cents;}
        for(const value of [p.clinic_name||p.clinic_id,money(p.amount_cents/100),formatDate(p.due_date),p.status==='paid'?'Pago':p.status==='canceled'?'Cancelado':late?'Vencida':'Em aberto']){const td=document.createElement('td');td.textContent=value;tr.appendChild(td)}
        const td=document.createElement('td');if(p.status==='open')for(const [label,status] of [['Marcar pago','paid'],['Cancelar','canceled']]){
          const b=document.createElement('button');b.className='secondary action';b.textContent=label;b.addEventListener('click',async()=>{
            const reason=prompt('Justificativa (mínimo 5 caracteres):');if(!reason||reason.trim().length<5)return;
            if(!confirm('Confirmar '+label+'?'))return;
            try{await rpc('nexodent_admin_update_payment',{p_payment:p.id,p_status:status,p_reason:reason.trim()});await loadCommercial()}catch(e){alert(e.message)}
          });td.appendChild(b);
        }tr.appendChild(td);$('payments').appendChild(tr);
      }
      $('received-total').textContent=money(received/100);$('open-total').textContent=money(open/100);$('overdue-total').textContent=money(overdue/100);
    }catch(e){console.error('Comercial indisponível:',e);$('plans').textContent='Não foi possível carregar planos: '+e.message;}
  }
  $('create-plan').addEventListener('click',async()=>{
    const name=$('plan-name').value.trim(),cycle=$('plan-cycle').value,amount=Number($('plan-price').value),modules=$('plan-modules').value.split(',').map(x=>x.trim()).filter(Boolean);
    if(name.length<2||!Number.isFinite(amount)||amount<0||!$('plan-price').value){alert('Informe nome e preço válido.');return;}
    try{await rpc('nexodent_admin_create_plan',{p_name:name,p_cycle:cycle,p_price_cents:Math.round(amount*100),p_modules:modules});await loadCommercial()}catch(e){alert(e.message)}
  });
  $('create-payment').addEventListener('click',async()=>{
    const amount=Number($('payment-amount').value),due=$('payment-due').value,clinic=$('payment-clinic').value;
    if(!clinic||!Number.isFinite(amount)||amount<=0||!due){alert('Preencha clínica, valor e vencimento.');return;}
    try{await rpc('nexodent_admin_create_payment',{p_clinic:clinic,p_amount_cents:Math.round(amount*100),p_due_date:due});await loadCommercial()}catch(e){alert(e.message)}
  });


  const moduleNames={agenda:'Agenda',pacientes:'Pacientes',financeiro:'Financeiro',comissoes:'Comissões',whatsapp:'WhatsApp',documentos:'Documentos',relatorios:'Relatórios'};
  async function loadModules(){
    const select=$('module-clinic'),previous=select.value;
    select.replaceChildren();
    for(const c of window.nexoClinics||[]){const opt=document.createElement('option');opt.value=c.id;opt.textContent=c.nome;select.appendChild(opt);}
    if([...select.options].some(o=>o.value===previous))select.value=previous;
    const name=id=>(window.nexoClinics||[]).find(c=>c.id===id)?.nome||id;
    try{
      const data=await rpc('nexodent_admin_module_overview');
      $('module-overrides').replaceChildren();$('module-audit').replaceChildren();
      for(const item of data.overrides||[]){const tr=document.createElement('tr');for(const value of [name(item.clinic_id),moduleNames[item.module_key]||item.module_key,item.enabled?'Liberado':'Restrito',formatDateTime(item.changed_at)]){const td=document.createElement('td');td.textContent=value;tr.appendChild(td)}$('module-overrides').appendChild(tr)}
      for(const item of data.audit||[]){const tr=document.createElement('tr');for(const value of [formatDateTime(item.changed_at),name(item.clinic_id),moduleNames[item.module_key]||item.module_key,item.new_enabled?'Liberado':'Restrito',item.reason]){const td=document.createElement('td');td.textContent=value;tr.appendChild(td)}$('module-audit').appendChild(tr)}
      $('module-message').textContent='Preferências carregadas. Restrições ainda não são aplicadas ao NexoDent.';
    }catch(e){$('module-message').textContent='Não foi possível carregar as preferências: '+e.message;}
  }
  $('module-save').addEventListener('click',async()=>{
    const clinic=$('module-clinic').value,reason=$('module-reason').value.trim();
    if(!clinic||reason.length<5){alert('Selecione uma clínica e informe justificativa de pelo menos 5 caracteres.');return;}
    if(!confirm('Salvar preferência comercial? Ela ainda não bloqueia o acesso no NexoDent.'))return;
    const button=$('module-save');button.disabled=true;
    try{await rpc('nexodent_admin_set_module_override',{p_clinic:clinic,p_module:$('module-key').value,p_enabled:$('module-enabled').value==='true',p_reason:reason});$('module-reason').value='';await loadModules();}
    catch(e){alert('Erro ao salvar: '+e.message)}finally{button.disabled=false}
  });

  async function loadMonitoring(){
    const set=(id,value)=>{ $(id).textContent=value; };
    set('health-site',navigator.onLine?'Página carregada; navegador online':'Página carregada; navegador offline');
    set('health-auth','Verificando…');set('health-alerts','Verificando…');
    $('admin-alerts').replaceChildren();
    try {
      const rows=await rpc('nexodent_admin_alerts',{p_days:Number($('alert-days').value)});
      set('health-auth','Sessão autorizada para consultas administrativas');
      set('health-alerts','Consulta concluída');
      const names={suspended:'Suspensa',overdue:'Vencida / em atraso',expiring:'Próxima do vencimento',other:'Verificar situação'};
      for(const item of rows||[]){
        const tr=document.createElement('tr');
        for(const value of [item.clinic_name,names[item.alert_type]||item.alert_type,formatDate(item.expires_at),String(item.grace_days??0)+' dias']){
          const td=document.createElement('td');td.textContent=value??'—';tr.appendChild(td);
        }
        $('admin-alerts').appendChild(tr);
      }
      if(!rows?.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=4;td.textContent='Nenhum alerta no período selecionado.';tr.appendChild(td);$('admin-alerts').appendChild(tr);}
    }catch(e){
      set('health-auth','Não foi possível confirmar');set('health-alerts','Falha: '+e.message);
    }
    set('health-time','Última verificação: '+new Date().toLocaleString('pt-BR'));
  }
  $('check-health').addEventListener('click',loadMonitoring);
  $('alert-days').addEventListener('change',loadMonitoring);

  async function load() {
    const result = await OralCloud.request('/rest/v1/rpc/nexodent_admin_overview', {method:'POST',body:{}});
    $('total').textContent = result.total_clinicas;
    $('members').textContent = result.total_vinculos;
    $('trials').textContent = result.em_teste ?? 0;
    $('active').textContent = result.assinaturas_ativas ?? 0;
    window.nexoClinics = result.clinicas || [];
    renderClinics();
    await loadCommercial();
    await loadModules();
    await loadMonitoring();
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
