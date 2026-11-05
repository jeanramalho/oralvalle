(() => {'use strict';const $=id=>document.getElementById(id), stages=['Novo lead','Contatado','Agendado','Avaliado','Orçamento','Fechado','Perdida'];let clinicId=null,leads=[],editing=null;const cloud=window.OralCloud;const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});const status=(msg,error=false)=>{$('status').textContent=msg;$('status').style.color=error?'#b42318':'#9a5200'};const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));async function api(path,options){return cloud.request('/rest/v1/'+path,options)}async function load(){if(!clinicId)return;status('Carregando oportunidades…');try{leads=await api('nexodent_crm_leads?clinic_id=eq.'+encodeURIComponent(clinicId)+'&select=*&order=created_at.desc');render();window.dispatchEvent(new CustomEvent('nexocrm:leads-loaded',{detail:{clinicId,leads}}));if(window.NexoCRMIntegracao)window.NexoCRMIntegracao.listarPendentes(clinicId,cloud);status('Dados atualizados.')}catch(e){status('Não foi possível carregar o CRM: '+e.message,true)}}function localDay(v){if(!v)return '';const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v).slice(0,10);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
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
function render(){const term=$('search').value.trim().toLocaleLowerCase('pt-BR'),filtered=leads.filter(x=>(x.name+' '+(x.phone||'')).toLocaleLowerCase('pt-BR').includes(term));$('total').textContent=leads.length;$('open').textContent=leads.filter(x=>x.stage!=='Fechado'&&x.stage!=='Perdida').length;$('won').textContent=leads.filter(x=>x.stage==='Fechado').length;$('value').textContent=money(leads.filter(x=>x.stage!=='Fechado'&&x.stage!=='Perdida').reduce((s,x)=>s+Number(x.estimated_value||0),0));$('board').replaceChildren();for(const stage of stages){const col=document.createElement('section');col.className='column';const items=filtered.filter(x=>x.stage===stage);const title=document.createElement('h3');title.textContent=stage+' ('+items.length+')';col.append(title);for(const x of items){const btn=document.createElement('button');btn.className='card';btn.innerHTML='<b>'+escape(x.name)+'</b><small>'+escape(x.phone||'Sem telefone')+'</small><small>'+money(x.estimated_value)+'</small>';btn.onclick=()=>edit(x);col.append(btn)}$('board').append(col)}followup();renderSales()}function edit(x){if(x&&window.NexoCRMIntegracao)window.NexoCRMIntegracao.consultar(x,clinicId,cloud);editing=x?.id||null;$('formtitle').textContent=x?'Editar lead':'Novo lead';$('form').reset();for(const key of ['name','phone','source','stage','estimated_value','notes','next_contact_at'])if(x&&x[key]!=null)$('form').elements[key].value=key==='next_contact_at'?String(x[key]).slice(0,10):key==='notes'?cleanNotes(x[key]):x[key];$('loss-reason').value=resultData(x)?.reason||'';toggleResult();$('contact_log').value='';$('contact_type').value='WhatsApp';$('history-view').textContent=(cleanNotes(x?.notes).split('\n').filter(line=>/^\[\d{2}\/\d{2}\/\d{4}.*\] /.test(line)).join('\n'))||'Nenhum contato registrado.';$('editor').showModal()}async function init(){if(!cloud?.enabled){status('Supabase não configurado.',true);return}try{const auth=await cloud.restoreSession();if(!auth){status('Entre no NexoDent antes de acessar o CRM.',true);return}const result=await cloud.request('/rest/v1/rpc/clinic_list',{method:'POST',body:{}});const clinics=Array.isArray(result)?result:[];if(!clinics.length){status('Nenhuma clínica autorizada para este usuário.',true);return}for(const c of clinics){const opt=document.createElement('option');opt.value=c.clinic_id;opt.textContent=c.nome;$('clinic').append(opt)}clinicId=clinics[0].clinic_id;$('app').hidden=false;$('new').disabled=false;await load()}catch(e){status('Não foi possível validar o acesso: '+e.message,true)}}// A importacao e manual e usa uma referencia estavel para detectar repeticoes.
const budgetMarker=id=>'[NEXODENT_BUDGET:'+encodeURIComponent(id)+']';
const markerPattern=/\[NEXODENT_BUDGET:[^\]\r\n]*\]/g;
const getMarker=notes=>(String(notes||'').match(markerPattern)||[])[0]||'';
const cleanNotes=notes=>String(notes||'').replace(markerPattern,'').replace(/\[NEXODENT_RESULT:[^\]\r\n]*\]/g,'').replace(/\n{3,}/g,'\n\n').trim();

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
$('stage').replaceChildren();for(const s of stages){const opt=document.createElement('option');opt.value=s;opt.textContent=s;$('stage').append(opt)}$('stage').addEventListener('change',toggleResult);$('sales-period').addEventListener('change',renderSales);$('sales-all').addEventListener('click',()=>{$('sales-period').value='';renderSales()});$('new').onclick=()=>edit(null);$('cancel').onclick=()=>$('editor').close();$('refresh').onclick=load;$('search').oninput=render;$('clinic').onchange=()=>{clinicId=$('clinic').value;if(window.NexoCRMIntegracao){window.NexoCRMIntegracao.limpar();window.NexoCRMIntegracao.cancelarPendentes()}load()};$('form').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),payload={name:String(fd.get('name')).trim(),phone:String(fd.get('phone')).trim(),source:String(fd.get('source')),stage:String(fd.get('stage')),estimated_value:Number(fd.get('estimated_value')||0),notes:String(fd.get('notes')).trim(),next_contact_at:fd.get('next_contact_at')||null};if(!payload.name)return;
 const original=editing?leads.find(x=>String(x.id)===String(editing)):null;
 const preservedMarker=getMarker(original?.notes);const previousResult=resultData(original);const nextStage=payload.stage;const lossReason=String(fd.get('loss_reason')||'').trim();if(nextStage==='Perdida'&&!lossReason){status('Informe o motivo da oportunidade perdida.',true);return}
 const log=String(fd.get('contact_log')||'').trim();
 if(log){const type=String(fd.get('contact_type')||'Contato');const stamp=new Date().toLocaleString('pt-BR');const entry='['+stamp+'] '+type+': '+log.replace(/[\r\n]+/g,' ');payload.notes=(payload.notes?payload.notes+'\n':'')+entry;if(payload.notes.length>3000){status('Histórico atingiu o limite de 3.000 caracteres. Salve uma cópia antes de continuar.',true);return}}
 if(nextStage==='Fechado'||nextStage==='Perdida'){const kind=nextStage==='Fechado'?'FECHADO':'PERDIDA';const day=previousResult?.type===kind?previousResult.day:today();const reason=kind==='PERDIDA'?'|'+encodeURIComponent(lossReason):'';payload.notes=(payload.notes?payload.notes+'\n':'')+'[NEXODENT_RESULT:'+kind+'|'+day+reason+']'}
 if(preservedMarker)payload.notes=(payload.notes?payload.notes+'\n':'')+preservedMarker;
 if(payload.notes.length>3000){status('Observações e histórico excedem 3.000 caracteres.',true);return}
 const btn=$('save');btn.disabled=true;try{
 if(editing){
  await api('nexodent_crm_leads?id=eq.'+encodeURIComponent(editing)+'&clinic_id=eq.'+encodeURIComponent(clinicId),{method:'PATCH',body:payload});
  const check=await api('nexodent_crm_leads?id=eq.'+encodeURIComponent(editing)+'&clinic_id=eq.'+encodeURIComponent(clinicId)+'&select=id,notes,next_contact_at&limit=1');
  if(!Array.isArray(check)||check.length!==1||String(check[0].notes||'')!==payload.notes||String(check[0].next_contact_at||'').slice(0,10)!==String(payload.next_contact_at||'').slice(0,10))
   throw new Error('O Supabase não confirmou a gravação. Verifique a permissão de edição do CRM.');
 }else await api('nexodent_crm_leads',{method:'POST',body:{...payload,clinic_id:clinicId}});
 $('editor').close();await load()
 }catch(err){status('Falha ao salvar: '+err.message,true);alert('Não foi possível confirmar o salvamento: '+err.message)}finally{btn.disabled=false}};init()})();