(() => {'use strict';const $=id=>document.getElementById(id), stages=['Novo lead','Contatado','Agendado','Avaliado','Orçamento','Fechado','Perdida'];let clinicId=null,leads=[],editing=null,commercialMembers=[];const cloud=window.OralCloud;const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});const status=(msg,error=false)=>{$('status').textContent=msg;$('status').style.color=error?'#b42318':'#9a5200'};const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));async function api(path,options){return cloud.request('/rest/v1/'+path,options)}async function load(){if(!clinicId)return;status('Carregando oportunidades…');try{leads=await api('nexodent_crm_leads?clinic_id=eq.'+encodeURIComponent(clinicId)+'&select=*&order=created_at.desc');render();renderGoals();await fetchGoal();window.dispatchEvent(new CustomEvent('nexocrm:leads-loaded',{detail:{clinicId,leads}}));if(window.NexoCRMIntegracao)window.NexoCRMIntegracao.listarPendentes(clinicId,cloud);status('Dados atualizados.')}catch(e){status('Não foi possível carregar o CRM: '+e.message,true)}}function localDay(v){if(!v)return '';const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v).slice(0,10);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
// Metas comerciais sincronizadas por clínica e mês no Supabase.
const goalMonthEl=$('goal-month');
let goalValue=null,goalCanEdit=false,goalRequest=0;
async function fetchGoal(){
 if(!clinicId||!goalMonthEl?.value)return;
 const token=++goalRequest,selectedClinic=clinicId,selectedMonth=goalMonthEl.value;
 const feedback=$('goal-feedback');feedback.textContent='Carregando meta…';
 try{
  const [rows,access]=await Promise.all([
   api('nexodent_crm_goals?clinic_id=eq.'+encodeURIComponent(selectedClinic)+'&month=eq.'+encodeURIComponent(selectedMonth)+'&select=target_amount&limit=1'),
   api('rpc/nexodent_crm_goal_can_edit',{method:'POST',body:{p_clinic_id:selectedClinic}})
  ]);
  if(token!==goalRequest||clinicId!==selectedClinic||goalMonthEl.value!==selectedMonth)return;
  goalValue=Array.isArray(rows)&&rows.length?Number(rows[0].target_amount):null;
  goalCanEdit=access===true;
  $('goal-input').disabled=!goalCanEdit;$('goal-save').disabled=!goalCanEdit;
  feedback.textContent=goalCanEdit?'Meta compartilhada com a equipe.':'Somente o administrador pode alterar a meta.';
  renderGoals();
 }catch(e){
  if(token!==goalRequest)return;
  goalValue=null;goalCanEdit=false;$('goal-input').disabled=true;$('goal-save').disabled=true;
  feedback.textContent='Não foi possível consultar as metas. Execute a migração SQL 27 no Supabase. '+e.message;
  renderGoals();
 }
}
function renderGoals(){
 if(!goalMonthEl)return;
 const month=goalMonthEl.value,goal=goalValue;
 const closed=leads.filter(x=>x.stage==='Fechado'&&resultData(x)?.type==='FECHADO'&&resultData(x).day.startsWith(month));
 const won=closed.reduce((sum,x)=>sum+(Number(x.estimated_value)||0),0);
 const percent=goal?won/goal*100:null,remain=goal?Math.max(0,goal-won):null;
 $('goal-target').textContent=goal?money(goal):'Não definida';$('goal-won').textContent=money(won);
 $('goal-percent').textContent=percent===null?'—':percent.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
 $('goal-remaining').textContent=remain===null?'—':money(remain);
 $('goal-progress-fill').style.width=(percent===null?0:Math.min(100,percent))+'%';
 $('goal-progress').setAttribute('aria-valuenow',String(percent===null?0:Math.min(100,Math.round(percent))));
 if(document.activeElement!==$('goal-input'))$('goal-input').value=goal===null?'':String(goal);
}
if(goalMonthEl){
 goalMonthEl.value=today().slice(0,7);
 $('goal-input').disabled=true;$('goal-save').disabled=true;
 goalMonthEl.addEventListener('change',fetchGoal);
 $('goal-save').addEventListener('click',async()=>{
  const month=goalMonthEl.value,value=Number($('goal-input').value),selectedClinic=clinicId;
  if(!goalCanEdit||!selectedClinic)return;
  if(!Number.isFinite(value)||value<=0){$('goal-feedback').textContent='Informe uma meta maior que zero.';return}
  const btn=$('goal-save');btn.disabled=true;
  try{
   await api('rpc/nexodent_crm_goal_save',{method:'POST',body:{p_clinic_id:selectedClinic,p_month:month,p_target:value}});
   if(clinicId===selectedClinic&&goalMonthEl.value===month)await fetchGoal();
   $('goal-feedback').textContent='Meta salva no Supabase para a clínica.';
  }catch(e){$('goal-feedback').textContent='Erro ao salvar meta: '+e.message;btn.disabled=false}
 });
}
let followupFilter='late';
let showAllPriorities=false;
function followupDate(day){if(!/^\d{4}-\d{2}-\d{2}$/.test(day||''))return day||'';const [y,m,d]=day.split('-');return d+'/'+m+'/'+y}
function followup(){
 const box=$('followup-list');if(!box)return;
 const now=today(),limit=new Date(now+'T12:00:00');limit.setDate(limit.getDate()+7);
 const future=[limit.getFullYear(),String(limit.getMonth()+1).padStart(2,'0'),String(limit.getDate()).padStart(2,'0')].join('-');
 const active=leads.filter(x=>x.stage!=='Fechado'&&x.stage!=='Perdida');
 const dated=active.filter(x=>x.next_contact_at).map(x=>({...x,day:localDay(x.next_contact_at)}));
 const contactPattern=/\[(\d{2})\/(\d{2})\/(\d{4}),?[^\]]*\]\s*(?:WhatsApp|Ligação|Presencial|Proposta|Outro|Contato):/g;
 const lastContact=x=>{let latest=String(x.created_at||'').slice(0,10);for(const match of String(x.notes||'').matchAll(contactPattern)){const day=match[3]+'-'+match[2]+'-'+match[1];if(day>latest)latest=day}return latest};
 const weekAgo=new Date(now+'T12:00:00');weekAgo.setDate(weekAgo.getDate()-7);
 const threshold=[weekAgo.getFullYear(),String(weekAgo.getMonth()+1).padStart(2,'0'),String(weekAgo.getDate()).padStart(2,'0')].join('-');
 const groups={
  late:dated.filter(x=>x.day<now),
  today:dated.filter(x=>x.day===now),
  upcoming:dated.filter(x=>x.day>now&&x.day<=future),
  stale:active.filter(x=>{const last=lastContact(x);return last&&last<=threshold&&(!x.next_contact_at||localDay(x.next_contact_at)>now)})
 };
 for(const key of ['late','today','upcoming','stale']){
  const count=$('followup-'+key);if(count)count.textContent=groups[key].length;
  const button=document.querySelector('[data-followup="'+key+'"]');if(button)button.setAttribute('aria-pressed',String(followupFilter===key));
 }
 const selected=groups[followupFilter]||[];
 $('followup-count').textContent=selected.length+' oportunidade(s) nesta categoria';
 box.replaceChildren();
 if(!selected.length){box.textContent='Nenhuma oportunidade nesta categoria.';renderPriorities(groups,lastContact,now);return}
 selected.sort((a,b)=>String(a.day||a.created_at||'').localeCompare(String(b.day||b.created_at||'')));
 for(const x of selected){const btn=document.createElement('button');btn.type='button';btn.className='followup-item';const label=document.createElement('strong');label.textContent=x.name;const date=document.createElement('span');date.textContent=followupFilter==='stale'?'Último contato: '+followupDate(lastContact(x)):followupFilter==='late'?'Atrasado desde '+followupDate(x.day):followupFilter==='today'?'Hoje · '+followupDate(x.day):'Previsto para '+followupDate(x.day);btn.append(label,date);btn.onclick=()=>edit(x);box.append(btn)}
 renderPriorities(groups,lastContact,now);
}

function renderPriorities(groups,lastContact,now){
 const list=$('priority-list');if(!list)return;
 const active=leads.filter(x=>x.stage!=='Fechado'&&x.stage!=='Perdida');
 const late=new Set(groups.late.map(x=>String(x.id))),due=new Set(groups.today.map(x=>String(x.id))),stale=new Set(groups.stale.map(x=>String(x.id)));
 const ranked=active.map(x=>{
  const id=String(x.id),value=Number(x.estimated_value)||0;
  let rank=4,reason='Acompanhar negociação',tone='normal';
  if(late.has(id)){rank=0;reason='Retorno atrasado desde '+followupDate(localDay(x.next_contact_at));tone='urgent'}
  else if(due.has(id)){rank=1;reason='Retorno agendado para hoje';tone='high'}
  else if(stale.has(id)){rank=2;reason='Sem contato há 7 dias';tone='attention'}
  else if(value>0){rank=3;reason='Oportunidade em negociação';tone='value'}
  return {x,rank,reason,tone,value};
 }).sort((a,b)=>a.rank-b.rank||(a.rank<2?String(a.x.next_contact_at||'').localeCompare(String(b.x.next_contact_at||'')):0)||b.value-a.value||String(a.x.name).localeCompare(String(b.x.name),'pt-BR'));
 const totalEl=$('priority-total');if(totalEl)totalEl.textContent=ranked.length+' oportunidade(s) aberta(s)';
 list.replaceChildren();
 if(!ranked.length){list.textContent='Nenhuma oportunidade aberta no momento.';return}
 for(const item of ranked.slice(0,showAllPriorities?ranked.length:5)){
  const btn=document.createElement('button');btn.type='button';btn.className='priority-item priority-'+item.tone;
  const info=document.createElement('span');info.className='priority-info';
  const name=document.createElement('strong');name.textContent=item.x.name;
  const detail=document.createElement('small');detail.textContent=item.reason+' · '+item.x.stage;
  info.append(name,detail);
  const val=document.createElement('span');val.className='priority-value';val.textContent=money(item.value);
  btn.append(info,val);btn.addEventListener('click',()=>edit(item.x));list.append(btn);
 }
 if(ranked.length>5){
  const toggle=document.createElement('button');toggle.type='button';toggle.className='priority-toggle';
  toggle.textContent=showAllPriorities?'Mostrar somente 5 prioridades':'Ver todas as '+ranked.length+' oportunidades';
  toggle.addEventListener('click',()=>{showAllPriorities=!showAllPriorities;renderPriorities(groups,lastContact,now)});
  list.append(toggle);
 }
}
for(const button of document.querySelectorAll('[data-followup]'))button.addEventListener('click',()=>{followupFilter=button.dataset.followup;followup()});
const resultMarker=/\[NEXODENT_RESULT:(?:FECHADO|PERDIDA)\|[^\]\r\n]*\]/g;
const resultData=x=>{const m=String(x.notes||'').match(/\[NEXODENT_RESULT:(FECHADO|PERDIDA)\|([0-9]{4}-[0-9]{2}-[0-9]{2})(?:\|([^\]\r\n]*))?\]/);return m?{type:m[1],day:m[2],reason:decodeURIComponent(m[3]||'')}:null};
// Central de recuperação: somente orçamentos vinculados manualmente ao CRM.
// Preferencia comercial preservada nas observacoes existentes, sem alterar o banco.
const optoutMarker='[NEXODENT_NO_CONTACT]';
const isOptedOut=x=>String(x?.notes||'').includes(optoutMarker);
function recoverySuggestion(x,days){
 const notes=String(x.notes||'').toLocaleLowerCase('pt-BR');
 const first=String(x.name||'').trim().split(/\s+/)[0]||'Olá';
 if(notes.includes('parcelamento')||notes.includes('parcelar'))return {reason:'Dúvida sobre parcelamento',message:`Olá, ${first}! Tudo bem? Sobre as condições de pagamento do seu tratamento, gostaria de saber se ficou alguma dúvida. Posso ajudar a esclarecer as opções disponíveis na clínica.`};
 if(notes.includes('preço')||notes.includes('caro')||notes.includes('valor alto'))return {reason:'Dúvida sobre valores',message:`Olá, ${first}! Tudo bem? Estou entrando em contato para saber se gostaria de esclarecer alguma dúvida sobre seu plano de tratamento e as condições disponíveis.`};
 if(days>=15)return {reason:'Acompanhamento após 15 dias',message:`Olá, ${first}! Tudo bem? Gostaria de saber se ainda tem interesse em conversar sobre seu plano de tratamento. Caso prefira não receber novos contatos, é só nos avisar.`};
 if(days>=7)return {reason:'Acompanhamento após 7 dias',message:`Olá, ${first}! Tudo bem? Passando para saber se ficou alguma dúvida sobre o orçamento e se podemos ajudar com mais informações.`};
 if(days>=3)return {reason:'Acompanhamento após 3 dias',message:`Olá, ${first}! Tudo bem? Conseguiu analisar o orçamento do tratamento? Se tiver alguma dúvida, estamos à disposição.`};
 return {reason:'Primeiro acompanhamento',message:`Olá, ${first}! Tudo bem? Agradecemos sua visita! Ficou alguma dúvida sobre o tratamento proposto? Estamos à disposição.`};
}
// Pontuação heurística: priorização operacional, não previsão estatística de conversão.
let recoveryPriorityFilter='all';
function recoveryPriority(item){
 const value=Math.max(0,Number(item.x.estimated_value)||0);
 const score=(item.late?45:0)+(item.days>=15?30:item.days>=7?20:item.days>=3?10:0)+(value>=5000?20:value>=2000?12:value>0?5:0);
 const level=score>=55?'Alta':score>=25?'Média':'Baixa';
 const next=item.late?'Retomar o contato atrasado':item.days>=7?'Confirmar interesse e combinar próximo retorno':item.days>=3?'Esclarecer dúvidas sobre o orçamento':'Acompanhar na data combinada';
 return {score,level,next};
}
let recoveryPhone='';
function recoveryLastContact(x){
 const entries=[...String(x.notes||'').matchAll(/\[(\d{2})\/(\d{2})\/(\d{4}),?[^\]]*\]\s*(?:WhatsApp|Ligação|Presencial|Proposta|Outro|Contato):/g)];
 if(!entries.length)return String(x.created_at||'').slice(0,10);
 return entries.map(m=>m[3]+'-'+m[2]+'-'+m[1]).sort().at(-1);
}
function renderRecovery(){
 const box=$('recovery-list');if(!box)return;
 const imported=leads.filter(x=>/\[NEXODENT_BUDGET:[^\]\r\n]+\]/.test(String(x.notes||'')));
 const open=imported.filter(x=>x.stage!=='Fechado'&&x.stage!=='Perdida');
 const won=imported.filter(x=>x.stage==='Fechado');
 $('recovery-count').textContent=String(open.length);
 $('recovery-open-value').textContent=money(open.reduce((n,x)=>n+(Number(x.estimated_value)||0),0));
 $('recovery-won-value').textContent=money(won.reduce((n,x)=>n+(Number(x.estimated_value)||0),0));
 box.replaceChildren();
 if(!open.length){box.textContent='Nenhum orçamento importado em negociação no momento.';return}
 const now=today();const dayDiff=day=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return 0;return Math.max(0,Math.floor((new Date(now+'T12:00:00')-new Date(day+'T12:00:00'))/86400000))};
 const sorted=open.map(x=>({x,days:dayDiff(recoveryLastContact(x)),late:!!x.next_contact_at&&localDay(x.next_contact_at)<now})).map(item=>({...item,priority:recoveryPriority(item)})).filter(item=>recoveryPriorityFilter==='all'||item.priority.level===recoveryPriorityFilter).sort((a,b)=>b.priority.score-a.priority.score||b.days-a.days||(Number(b.x.estimated_value)||0)-(Number(a.x.estimated_value)||0));
 const shown=$('recovery-filter-count');if(shown)shown.textContent=sorted.length+' de '+open.length+' oportunidades';
 for(const item of sorted){const x=item.x;const card=document.createElement('article');card.className='recovery-item';
 const info=document.createElement('div');const name=document.createElement('strong');name.textContent=x.name;const detail=document.createElement('small');detail.textContent=x.stage+' · '+money(x.estimated_value)+' · '+(item.late?'Retorno atrasado':item.days>=7?'Sem contato há '+item.days+' dias':'Último contato há '+item.days+' dia(s)');info.append(name,detail);const priority=document.createElement('small');priority.className='crm-recovery-priority';priority.textContent='Prioridade '+item.priority.level+' ('+item.priority.score+'/95) · Próxima ação: '+(isOptedOut(x)?'Não contatar — preferência registrada':item.priority.next);info.append(priority);if(isOptedOut(x)){const badge=document.createElement('small');badge.className='crm-no-contact';badge.textContent='Não deseja contatos comerciais';info.append(badge)}else{const suggestion=recoverySuggestion(x,item.days);const hint=document.createElement('small');hint.textContent='Sugestão: '+suggestion.reason;info.append(hint)}
 const actions=document.createElement('div');actions.className='recovery-actions';const openBtn=document.createElement('button');openBtn.type='button';openBtn.textContent='Abrir ficha';openBtn.onclick=()=>edit(x);actions.append(openBtn);
 const phone=String(x.phone||'').replace(/\D/g,'');if(!isOptedOut(x)&&phone.length>=10&&phone.length<=13){const whats=document.createElement('button');whats.type='button';whats.textContent='Preparar WhatsApp';whats.onclick=()=>{recoveryPhone=phone.length<=11?'55'+phone:phone;const suggestion=recoverySuggestion(x,item.days);$('recovery-guidance').textContent='Sugestão: '+suggestion.reason+'. Revise antes de abrir o WhatsApp.';$('recovery-text').value=suggestion.message;$('recovery-message').showModal()};actions.append(whats)}
 card.append(info,actions);box.append(card)}
}
document.querySelectorAll('[data-recovery-priority]').forEach(btn=>btn.addEventListener('click',()=>{recoveryPriorityFilter=btn.dataset.recoveryPriority;document.querySelectorAll('[data-recovery-priority]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));renderRecovery()}));
$('recovery-send').addEventListener('click',()=>{const message=$('recovery-text').value.trim();if(!message||!recoveryPhone)return;const url='https://wa.me/'+recoveryPhone+'?text='+encodeURIComponent(message);window.open(url,'_blank','noopener,noreferrer');$('recovery-message').close()});
function renderSales(){
 const period=$('sales-period')?.value||'all';const results=leads.filter(x=>{const r=resultData(x);return r&&(period==='all'||r.day.startsWith(period))});
 const wins=results.filter(x=>x.stage==='Fechado'&&resultData(x)?.type==='FECHADO');
 const losses=results.filter(x=>x.stage==='Perdida'&&resultData(x)?.type==='PERDIDA');
 const eligible=leads.filter(x=>period==='all'||String(x.created_at||'').slice(0,7)===period);
 const cohortWins=eligible.filter(x=>x.stage==='Fechado');
 $('sales-won').textContent=String(wins.length);$('sales-lost').textContent=String(losses.length);
 $('sales-total').textContent=money(wins.reduce((a,x)=>a+Number(x.estimated_value||0),0));
 $('sales-rate').textContent=eligible.length?(100*cohortWins.length/eligible.length).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'—';
 const rows=$('sales-rows');rows.replaceChildren();
 for(const x of [...results].sort((a,b)=>resultData(b).day.localeCompare(resultData(a).day))){const r=resultData(x),line=document.createElement('button');line.type='button';line.className='sales-row';line.textContent=followupDate(r.day)+' · '+x.name+' · '+(r.type==='FECHADO'?'Fechado — '+money(x.estimated_value):'Perdida — '+(r.reason||'Sem motivo'));line.onclick=()=>edit(x);rows.append(line)}
 if(!results.length)rows.textContent='Nenhum fechamento ou perda registrado neste período. Registros anteriores à atualização não têm data de conversão e não entram no relatório.';
 renderSalesInsights(eligible,losses);

}
function renderSalesInsights(cohort,losses){
 const funnel=$('sales-funnel'),reasons=$('sales-reasons');if(!funnel||!reasons)return;
 funnel.replaceChildren();reasons.replaceChildren();
 const allStages=['Novo lead','Contatado','Agendado','Avaliado','Orçamento','Fechado','Perdida'];
 const count=cohort.length;
 for(const stage of allStages){const n=cohort.filter(x=>x.stage===stage).length;const item=document.createElement('div');item.className='sales-insight-row';
 const label=document.createElement('span');label.textContent=stage;const track=document.createElement('div');track.className='sales-insight-track';const bar=document.createElement('span');bar.style.width=(count?100*n/count:0)+'%';track.append(bar);
 const value=document.createElement('strong');value.textContent=String(n);item.append(label,track,value);funnel.append(item)}
 const grouped=new Map();for(const x of losses){const reason=resultData(x)?.reason||'Sem motivo';grouped.set(reason,(grouped.get(reason)||0)+1)}
 if(!grouped.size){reasons.textContent='Nenhuma perda registrada no período.';return}
 for(const [reason,n] of [...grouped].sort((a,b)=>b[1]-a[1])){const row=document.createElement('div');row.className='sales-insight-row';const label=document.createElement('span');label.textContent=reason;const track=document.createElement('div');track.className='sales-insight-track';const bar=document.createElement('span');bar.style.width=(100*n/losses.length)+'%';track.append(bar);const value=document.createElement('strong');value.textContent=String(n);row.append(label,track,value);reasons.append(row)}
}
function toggleResult(){const stage=$('stage').value,loss=$('loss-reason-wrap');loss.hidden=stage!=='Perdida';$('loss-reason').required=stage==='Perdida';$('result-help').textContent=stage==='Fechado'?'O fechamento registra uma venda comercial, sem gerar pagamento.':stage==='Perdida'?'Informe o motivo da oportunidade perdida.':'Alterações de etapa não geram movimentação financeira.'}

// Fila diária derivada das oportunidades: não grava nem envia mensagens automaticamente.
let dailyFilter='all';
const dailyContactPattern=/\[(\d{2})\/(\d{2})\/(\d{4}),?[^\]]*\]\s*(?:WhatsApp|Ligação|Presencial|Proposta|Outro|Contato):/g;
function dailyLastContact(x){let last=String(x.created_at||'').slice(0,10);for(const m of String(x.notes||'').matchAll(dailyContactPattern)){const day=m[3]+'-'+m[2]+'-'+m[1];if(day>last)last=day}return last}
function dailyAttempts(x){return [...String(x.notes||'').matchAll(dailyContactPattern)].length}
function renderDailyQueue(){
 const box=$('daily-list');if(!box)return;
 const now=today(),thresholdDate=new Date(now+'T12:00:00');thresholdDate.setDate(thresholdDate.getDate()-7);
 const threshold=[thresholdDate.getFullYear(),String(thresholdDate.getMonth()+1).padStart(2,'0'),String(thresholdDate.getDate()).padStart(2,'0')].join('-');
 const rows=leads.filter(x=>x.stage!=='Fechado'&&x.stage!=='Perdida'&&!isOptedOut(x)).map(x=>{
  const day=localDay(x.next_contact_at),last=dailyLastContact(x);
  const category=day&&day<now?'late':day===now?'today':(!day||day>now)&&last&&last<=threshold?'stale':null;
  return {x,day,last,category,attempts:dailyAttempts(x)};
 }).filter(row=>row.category);
 const counts={late:0,today:0,stale:0};for(const row of rows)counts[row.category]++;
 $('daily-late').textContent=counts.late;$('daily-today').textContent=counts.today;$('daily-stale').textContent=counts.stale;
 $('daily-total').textContent=rows.length+' para acompanhar';
 document.querySelectorAll('[data-daily]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.daily===dailyFilter)));
 const selected=rows.filter(row=>dailyFilter==='all'||row.category===dailyFilter).sort((a,b)=>({late:0,today:1,stale:2}[a.category]-{late:0,today:1,stale:2}[b.category])||(a.day||a.last).localeCompare(b.day||b.last)||Number(b.x.estimated_value||0)-Number(a.x.estimated_value||0));
 box.replaceChildren();if(!selected.length){box.textContent='Nenhuma oportunidade pendente neste filtro.';return}
 for(const row of selected){const item=document.createElement('div');item.className='daily-row';const info=document.createElement('div');const name=document.createElement('strong');name.textContent=row.x.name;const detail=document.createElement('small');detail.textContent=(row.category==='late'?'Retorno atrasado desde '+followupDate(row.day):row.category==='today'?'Retorno marcado para hoje':'Sem contato desde '+followupDate(row.last))+' · '+row.attempts+' contato(s) registrado(s)';const suggestion=document.createElement('small');suggestion.textContent='Próxima ação: '+(row.category==='late'?'reagendar ou registrar retorno':row.category==='today'?'realizar o contato combinado':'verificar interesse e agendar retorno');info.append(name,detail,suggestion);const button=document.createElement('button');button.type='button';button.textContent='Abrir oportunidade';button.onclick=()=>edit(row.x);item.append(info,button);box.append(item)}
}
document.querySelectorAll('[data-daily]').forEach(button=>button.addEventListener('click',()=>{dailyFilter=button.dataset.daily;renderDailyQueue()}));

// Tarefas derivadas do próximo contato; nenhuma tabela adicional ou envio automático.
let completingTask=false;
function renderTasks(){
 const list=$('tasks-list');if(!list)return;
 const day=today();const tasks=leads.filter(x=>x.stage!=='Fechado'&&x.stage!=='Perdida'&&!isOptedOut(x)&&x.next_contact_at&&localDay(x.next_contact_at)<=day).sort((a,b)=>localDay(a.next_contact_at).localeCompare(localDay(b.next_contact_at))||Number(b.estimated_value||0)-Number(a.estimated_value||0));
 $('tasks-total').textContent=tasks.length+' pendente(s)';list.replaceChildren();
 if(!tasks.length){list.textContent='Nenhum contato vencido ou programado para hoje.';return}
 for(const x of tasks){const row=document.createElement('div');row.className='tasks-row';const info=document.createElement('div');const name=document.createElement('strong');name.textContent=x.name;const detail=document.createElement('small');detail.textContent=(localDay(x.next_contact_at)<day?'Atrasada desde ':'Programada para ')+followupDate(localDay(x.next_contact_at))+' · '+x.stage;info.append(name,detail);const actions=document.createElement('div');actions.className='tasks-actions';const open=document.createElement('button');open.type='button';open.textContent='Abrir / reagendar';open.onclick=()=>edit(x);const done=document.createElement('button');done.type='button';done.textContent='Concluir tarefa';done.disabled=completingTask;done.onclick=()=>completeTask(x);actions.append(open,done);row.append(info,actions);list.append(row)}
}
async function completeTask(x){
 if(completingTask||!clinicId||!x?.id)return;
 if(!confirm('Concluir o contato agendado de '+x.name+'? Isso registra somente a tarefa executada; não confirma que o paciente respondeu.'))return;
 completingTask=true;const feedback=$('tasks-feedback');feedback.textContent='Registrando conclusão…';renderTasks();
 try{
  const path='nexodent_crm_leads?id=eq.'+encodeURIComponent(x.id)+'&clinic_id=eq.'+encodeURIComponent(clinicId);
  const current=await api(path+'&select=id,notes,next_contact_at,stage&limit=1');
  if(!Array.isArray(current)||current.length!==1)throw new Error('O registro não foi encontrado nesta clínica.');
  const row=current[0];if(row.stage==='Fechado'||row.stage==='Perdida'||isOptedOut(row))throw new Error('Esta oportunidade não permite novos contatos.');
  if(localDay(row.next_contact_at)!==localDay(x.next_contact_at))throw new Error('A data foi alterada em outra sessão. Atualize a lista.');
  const stamp=new Date().toLocaleString('pt-BR');const entry='['+stamp+'] Tarefa: acompanhamento programado concluído (sem confirmação de resposta).';
  const notes=(String(row.notes||'').trim()?String(row.notes).trim()+'\n':'')+entry;
  if(notes.length>3000)throw new Error('O histórico atingiu o limite de 3.000 caracteres. Abra a ficha para revisar antes de concluir.');
  await api(path,{method:'PATCH',body:{notes,next_contact_at:null}});
  const check=await api(path+'&select=id,notes,next_contact_at,commercial_owner_id&limit=1');
  if(!Array.isArray(check)||check.length!==1||check[0].notes!==notes||check[0].next_contact_at)throw new Error('Não foi possível confirmar a gravação da tarefa.');
  feedback.textContent='Tarefa concluída e registrada no histórico. Para novo contato, use Abrir / reagendar.';
  await load();
 }catch(e){feedback.textContent='Erro: '+e.message;status('Falha ao concluir tarefa: '+e.message,true)}finally{completingTask=false;renderTasks()}
}

// Painel somente leitura: calcula a produtividade a partir de registros persistidos.
function renderProductivity(){
 const period=$('productivity-period')?.value||'month';
 const now=new Date();const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 if(period==='week')start.setDate(start.getDate()-6);
 if(period==='month')start.setDate(1);
 const dateAllowed=day=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(day||''))return false;if(period==='all')return true;const d=new Date(day+'T12:00:00');return !Number.isNaN(d.getTime())&&d>=start&&d<=now};
 let contacts=0,done=0,wins=0,recovered=0;
 const contactLine=/^\[(\d{2})\/(\d{2})\/(\d{4}),?[^\]]*\]\s*(WhatsApp|Ligação|Presencial|Proposta|Outro|Contato):/;
 const taskLine=/^\[(\d{2})\/(\d{2})\/(\d{4}),?[^\]]*\]\s*Tarefa:\s*acompanhamento programado concluído/;
 for(const x of leads){
  for(const line of String(x.notes||'').split(/\r?\n/)){
   let m=line.match(contactLine);if(m&&dateAllowed(m[3]+'-'+m[2]+'-'+m[1]))contacts++;
   m=line.match(taskLine);if(m&&dateAllowed(m[3]+'-'+m[2]+'-'+m[1]))done++;
  }
  const r=resultData(x);
  if(x.stage==='Fechado'&&r?.type==='FECHADO'&&dateAllowed(r.day)){
   wins++;if(getMarker(x.notes))recovered++;
  }
 }
 const pending=leads.filter(x=>x.stage!=='Fechado'&&x.stage!=='Perdida'&&!isOptedOut(x)&&x.next_contact_at&&localDay(x.next_contact_at)<=today()).length;
 $('productivity-contacts').textContent=String(contacts);
 $('productivity-done').textContent=String(done);
 $('productivity-pending').textContent=String(pending);
 $('productivity-wins').textContent=String(wins);
 $('productivity-recovered').textContent=String(recovered);
}
function render(){const term=$('search').value.trim().toLocaleLowerCase('pt-BR'),filtered=leads.filter(x=>(x.name+' '+(x.phone||'')).toLocaleLowerCase('pt-BR').includes(term));$('total').textContent=leads.length;$('open').textContent=leads.filter(x=>x.stage!=='Fechado'&&x.stage!=='Perdida').length;$('won').textContent=leads.filter(x=>x.stage==='Fechado').length;$('value').textContent=money(leads.filter(x=>x.stage!=='Fechado'&&x.stage!=='Perdida').reduce((s,x)=>s+Number(x.estimated_value||0),0));$('board').replaceChildren();for(const stage of stages){const col=document.createElement('section');col.className='column';const items=filtered.filter(x=>x.stage===stage);const title=document.createElement('h3');title.textContent=stage+' ('+items.length+')';col.append(title);for(const x of items){const btn=document.createElement('button');btn.className='card';btn.innerHTML='<b>'+escape(x.name)+'</b><small>'+escape(x.phone||'Sem telefone')+'</small><small>'+money(x.estimated_value)+'</small>';btn.onclick=()=>edit(x);col.append(btn)}$('board').append(col)}followup();renderDailyQueue();renderTasks();renderSales();renderRecovery();renderProductivity()}function edit(x){if(x&&window.NexoCRMIntegracao)window.NexoCRMIntegracao.consultar(x,clinicId,cloud);editing=x?.id||null;window.dispatchEvent(new CustomEvent('nexocrm:editor-open',{detail:{leadId:editing,clinicId,commercialMembers}}));$('formtitle').textContent=x?'Editar lead':'Novo lead';$('form').reset();for(const key of ['name','phone','source','stage','estimated_value','notes','next_contact_at'])if(x&&x[key]!=null)$('form').elements[key].value=key==='next_contact_at'?String(x[key]).slice(0,10):key==='notes'?cleanNotes(x[key]):x[key];$('commercial-owner').value=x?.commercial_owner_id||'';$('loss-reason').value=resultData(x)?.reason||'';$('contact-optout').checked=isOptedOut(x);toggleResult();$('contact_log').value='';$('contact_type').value='WhatsApp';$('history-view').textContent=(cleanNotes(x?.notes).split('\n').filter(line=>/^\[\d{2}\/\d{2}\/\d{4}.*\] /.test(line)).join('\n'))||'Nenhum contato registrado.';$('editor').showModal()}async function loadCommercialMembers(){const select=$('commercial-owner');select.replaceChildren();const blank=document.createElement('option');blank.value='';blank.textContent='Não atribuído';select.append(blank);commercialMembers=[];try{const rows=await api('rpc/clinic_members_list',{method:'POST',body:{p_clinic:clinicId}});if(!Array.isArray(rows))throw Error('Lista inválida');for(const m of rows){const id=String(m.user_id||m.id||'');const name=String(m.nome||m.name||m.full_name||'').trim();if(!/^[0-9a-f-]{36}$/i.test(id)||!name)continue;commercialMembers.push({id,name});const opt=document.createElement('option');opt.value=id;opt.textContent=name;select.append(opt)}}catch(e){status('Não foi possível listar responsáveis: '+e.message,true)}}async function init(){if(!cloud?.enabled){status('Supabase não configurado.',true);return}try{const auth=await cloud.restoreSession();if(!auth){status('Entre no NexoDent antes de acessar o CRM.',true);return}const result=await cloud.request('/rest/v1/rpc/clinic_list',{method:'POST',body:{}});const clinics=Array.isArray(result)?result:[];if(!clinics.length){status('Nenhuma clínica autorizada para este usuário.',true);return}for(const c of clinics){const opt=document.createElement('option');opt.value=c.clinic_id;opt.textContent=c.nome;$('clinic').append(opt)}clinicId=clinics[0].clinic_id;await loadCommercialMembers();$('app').hidden=false;$('new').disabled=false;await load()}catch(e){status('Não foi possível validar o acesso: '+e.message,true)}}// A importacao e manual e usa uma referencia estavel para detectar repeticoes.
const budgetMarker=id=>'[NEXODENT_BUDGET:'+encodeURIComponent(id)+']';
const markerPattern=/\[NEXODENT_BUDGET:[^\]\r\n]*\]/g;
const getMarker=notes=>(String(notes||'').match(markerPattern)||[])[0]||'';
const cleanNotes=notes=>String(notes||'').replace(markerPattern,'').replace(/\[NEXODENT_RESULT:[^\]\r\n]*\]/g,'').replaceAll(optoutMarker,'').replace(/\n{3,}/g,'\n\n').trim();

let importingBudget=false;
window.addEventListener('nexocrm:import-budget',async event=>{
 const d=event.detail||{};const finish=(ok,msg)=>{if(typeof d.onResult==='function')d.onResult(ok,msg)};
 if(importingBudget){finish(false,'Aguarde a importação anterior.');return}
 if(!clinicId||d.clinicId!==clinicId||!d.budgetId){finish(false,'Clínica ou orçamento inválido.');return}
 if(!d.patientName||!Number.isFinite(d.total)||d.total<0){finish(false,'Dados insuficientes para importar.');return}
 if(!window.confirm('Adicionar o orçamento de '+d.patientName+' ao funil comercial?')){finish(false,'Importação cancelada.');return}
 importingBudget=true;
 try{
  // Reconsulta antes da gravação para reduzir risco de duplicação entre abas/sessões.
  const current=await api('nexodent_crm_leads?clinic_id=eq.'+encodeURIComponent(clinicId)+'&select=id,notes&limit=1000');
  if(!Array.isArray(current)||current.length===1000)throw new Error('Não foi possível verificar todas as oportunidades.');
  const marker=budgetMarker(d.budgetId);
  if(current.some(x=>String(x.notes||'').includes(marker))){finish(true,'Este orçamento já foi adicionado ao funil.');return}
  await api('nexodent_crm_leads',{method:'POST',body:{clinic_id:clinicId,name:d.patientName,
   phone:d.phone||'',source:'Outros',stage:'Orçamento',estimated_value:d.total,
   notes:'Origem: orçamento NexoDent. Procedimentos: '+String(d.description||'').slice(0,700)+'\n'+marker}});
  finish(true,'Orçamento adicionado ao funil.');await load();
 }catch(e){finish(false,'Não foi possível importar: '+e.message)}finally{importingBudget=false}
});
$('stage').replaceChildren();for(const s of stages){const opt=document.createElement('option');opt.value=s;opt.textContent=s;$('stage').append(opt)}$('stage').addEventListener('change',toggleResult);$('sales-period').addEventListener('change',renderSales);$('productivity-period').addEventListener('change',renderProductivity);$('sales-all').addEventListener('click',()=>{$('sales-period').value='';renderSales()});$('new').onclick=()=>edit(null);$('cancel').onclick=()=>$('editor').close();$('refresh').onclick=load;$('search').oninput=render;$('clinic').onchange=()=>{clinicId=$('clinic').value;if(window.NexoCRMIntegracao){window.NexoCRMIntegracao.limpar();window.NexoCRMIntegracao.cancelarPendentes()}loadCommercialMembers().then(load)};$('form').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),payload={name:String(fd.get('name')).trim(),phone:String(fd.get('phone')).trim(),source:String(fd.get('source')),stage:String(fd.get('stage')),estimated_value:Number(fd.get('estimated_value')||0),notes:String(fd.get('notes')).trim(),next_contact_at:fd.get('next_contact_at')||null,commercial_owner_id:fd.get('commercial_owner')||null};if(!payload.name)return;
 if(payload.commercial_owner_id&&!commercialMembers.some(m=>m.id===payload.commercial_owner_id)){status('Responsável inválido para esta clínica.',true);return}const original=editing?leads.find(x=>String(x.id)===String(editing)):null;
 const preservedMarker=getMarker(original?.notes);payload.notes=payload.notes.replaceAll(optoutMarker,'').trim();if(fd.get('contact_optout'))payload.notes=(payload.notes?payload.notes+'\n':'')+optoutMarker;const previousResult=resultData(original);const nextStage=payload.stage;const lossReason=String(fd.get('loss_reason')||'').trim();if(nextStage==='Perdida'&&!lossReason){status('Informe o motivo da oportunidade perdida.',true);return}
 const log=String(fd.get('contact_log')||'').trim();
 if(log){const type=String(fd.get('contact_type')||'Contato');const stamp=new Date().toLocaleString('pt-BR');const entry='['+stamp+'] '+type+': '+log.replace(/[\r\n]+/g,' ');payload.notes=(payload.notes?payload.notes+'\n':'')+entry;if(payload.notes.length>3000){status('Histórico atingiu o limite de 3.000 caracteres. Salve uma cópia antes de continuar.',true);return}}
 if(nextStage==='Fechado'||nextStage==='Perdida'){const kind=nextStage==='Fechado'?'FECHADO':'PERDIDA';const day=previousResult?.type===kind?previousResult.day:today();const reason=kind==='PERDIDA'?'|'+encodeURIComponent(lossReason):'';payload.notes=(payload.notes?payload.notes+'\n':'')+'[NEXODENT_RESULT:'+kind+'|'+day+reason+']'}
 if(preservedMarker)payload.notes=(payload.notes?payload.notes+'\n':'')+preservedMarker;
 if(payload.notes.length>3000){status('Observações e histórico excedem 3.000 caracteres.',true);return}
 const btn=$('save');btn.disabled=true;try{
 if(editing){
  await api('nexodent_crm_leads?id=eq.'+encodeURIComponent(editing)+'&clinic_id=eq.'+encodeURIComponent(clinicId),{method:'PATCH',body:payload});
  const check=await api('nexodent_crm_leads?id=eq.'+encodeURIComponent(editing)+'&clinic_id=eq.'+encodeURIComponent(clinicId)+'&select=id,notes,next_contact_at,commercial_owner_id&limit=1');
  if(!Array.isArray(check)||check.length!==1||String(check[0].notes||'')!==payload.notes||String(check[0].next_contact_at||'').slice(0,10)!==String(payload.next_contact_at||'').slice(0,10)||String(check[0].commercial_owner_id||'')!==String(payload.commercial_owner_id||''))
   throw new Error('O Supabase não confirmou a gravação. Verifique a permissão de edição do CRM.');
 }else await api('nexodent_crm_leads',{method:'POST',body:{...payload,clinic_id:clinicId}});
 $('editor').close();await load()
 }catch(err){status('Falha ao salvar: '+err.message,true);alert('Não foi possível confirmar o salvamento: '+err.message)}finally{btn.disabled=false}};init()})();