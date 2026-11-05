(()=>{'use strict';
const box=document.getElementById('employee-performance');if(!box)return;
const body=document.getElementById('employee-performance-list'),period=document.getElementById('employee-performance-month'),note=document.getElementById('employee-performance-note');
period.value=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}).slice(0,7);let serial=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
let currentLeads=[];
async function refresh(clinicId){const run=++serial;if(!clinicId)return;
body.textContent='Carregando desempenho…';note.textContent='Metas e valores consideram quem registrou o fechamento, não necessariamente quem conduziu a negociação. Histórico disponível somente após a atualização 28.';
try{
const month=period.value;if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Mês inválido');
const start=month+'-01T00:00:00Z';const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1)).toISOString();
const url='/rest/v1/nexodent_crm_activity?clinic_id=eq.'+encodeURIComponent(clinicId)+'&occurred_at=gte.'+encodeURIComponent(start)+'&occurred_at=lt.'+encodeURIComponent(end)+'&select=actor_id,event_type,amount&limit=1000';
const rows=await window.OralCloud.request(url);if(run!==serial)return;
// Consulta apenas membros da clínica atual pelo RPC existente (respeita permissões).
let names=new Map(), namesUnavailable=false;
try{
 const members=await window.OralCloud.request('/rest/v1/rpc/clinic_members_list',{method:'POST',body:{p_clinic:clinicId}});
 if(run!==serial)return;
 if(!Array.isArray(members))throw Error('Lista de membros inválida');
 for(const member of members){
  const id=String(member.user_id||member.id||'');
  const name=String(member.nome||member.name||member.full_name||'').trim();
  if(id&&name)names.set(id,name);
 }
}catch(_){namesUnavailable=true;}

if(!Array.isArray(rows))throw Error('Resposta inválida');
let goals=[];try{goals=await window.OralCloud.request('/rest/v1/nexodent_crm_employee_goals?clinic_id=eq.'+encodeURIComponent(clinicId)+'&month=eq.'+encodeURIComponent(month)+'&select=actor_id,target_amount');if(!Array.isArray(goals))goals=[]}catch(e){note.textContent='Metas individuais indisponíveis. Execute a migração SQL da atualização 33. '+(e.message||'')}
if(run!==serial)return;
const targets=new Map(goals.map(g=>[String(g.actor_id),Number(g.target_amount)||0]));
const grouped=new Map();for(const x of rows){let v=grouped.get(x.actor_id);if(!v){v={contact:0,task:0,closed:0,amount:0};grouped.set(x.actor_id,v)}if(x.event_type==='contact')v.contact++;if(x.event_type==='task')v.task++;if(x.event_type==='closed'){v.closed++;v.amount+=Number(x.amount)||0}}
body.replaceChildren();if(!rows.length){const empty=document.createElement('p');empty.textContent='Nenhuma atividade registrada neste mês.';body.append(empty)}
const table=document.createElement('table');table.className='employee-table';table.innerHTML='<thead><tr><th>Funcionário</th><th>Contatos</th><th>Tarefas</th><th>Fechamentos</th><th>Valor registrado</th><th>Meta individual</th><th>Progresso</th></tr></thead>';
const tb=document.createElement('tbody');for(const [id,v] of [...grouped].sort((a,b)=>b[1].closed-a[1].closed||b[1].amount-a[1].amount||b[1].contact-a[1].contact)){const tr=document.createElement('tr');tr.innerHTML='<td title="'+esc(id)+'">'+esc(names.get(String(id))||((String(id).slice(0,8))+'…'))+'</td><td>'+v.contact+'</td><td>'+v.task+'</td><td>'+v.closed+'</td><td>'+money(v.amount)+'</td>';const target=targets.get(String(id))||0;const td=document.createElement('td');const inp=document.createElement('input');inp.type='number';inp.min='0.01';inp.step='0.01';inp.value=target||'';inp.placeholder='Definir meta';inp.setAttribute('aria-label','Meta mensal de '+(names.get(String(id))||String(id)));inp.style.width='115px';const btn=document.createElement('button');btn.type='button';btn.textContent='Salvar';btn.style.marginLeft='5px';btn.addEventListener('click',async()=>{const amount=Number(inp.value);if(!Number.isFinite(amount)||amount<=0){note.textContent='Informe uma meta maior que zero.';return}btn.disabled=true;try{await window.OralCloud.request('/rest/v1/rpc/nexodent_crm_employee_goal_save',{method:'POST',body:{p_clinic_id:clinicId,p_actor_id:id,p_month:month,p_target:amount}});note.textContent='Meta individual salva.';refresh(clinicId)}catch(e){note.textContent='Não foi possível salvar a meta: '+e.message;btn.disabled=false}});td.append(inp,btn);tr.append(td);const progress=document.createElement('td');progress.textContent=target?Math.round(v.amount/target*100)+'%':'—';tr.append(progress);tb.append(tr)}table.append(tb);if(rows.length)body.append(table);renderOwnerConversion(body,currentLeads,month,names,targets);
if(namesUnavailable)note.textContent='Não foi possível consultar os nomes dos funcionários; exibindo identificadores abreviados. ';
if(rows.length===1000)note.textContent='Limite de 1.000 eventos atingido: resultados parciais. Amplie a consulta antes de usar para avaliação de desempenho.';
}catch(e){if(run!==serial)return;body.textContent='Não foi possível consultar o desempenho.';note.textContent='Somente administradores podem visualizar. Verifique se o SQL foi executado. Detalhe: '+e.message}
}
function renderOwnerConversion(container,leads,month,names,targets){
 const heading=document.createElement('h3');heading.textContent='Conversão por responsável comercial';container.append(heading);
 const explanation=document.createElement('p');explanation.className='productivity-footnote';explanation.textContent='Coorte: oportunidades criadas no mês selecionado, agrupadas pelo responsável comercial ATUAL. Fechadas = etapa atual Fechado. Atribuições e valores podem ter mudado desde o mês de criação; este relatório não é um histórico de responsáveis nem de faturamento.';container.append(explanation);
 const grouped=new Map();let unassigned=0;
 for(const lead of leads){if(String(lead.created_at||'').slice(0,7)!==month)continue;const id=String(lead.commercial_owner_id||'');if(!id){unassigned++;continue}let item=grouped.get(id);if(!item){item={total:0,won:0,amount:0};grouped.set(id,item)}item.total++;if(lead.stage==='Fechado'){item.won++;item.amount+=Number(lead.estimated_value)||0}}
 if(!grouped.size){const msg=document.createElement('p');msg.textContent='Nenhuma oportunidade criada neste mês com responsável atribuído.';container.append(msg)}else{
 const table=document.createElement('table');table.className='employee-table';table.innerHTML='<thead><tr><th>Responsável atual</th><th>Oportunidades recebidas*</th><th>Fechadas atualmente</th><th>Conversão da coorte</th><th>Valor estimado fechado</th><th>Meta individual</th><th>Progresso da meta**</th></tr></thead>';
 const tbody=document.createElement('tbody');for(const [id,item] of [...grouped].sort((a,b)=>b[1].won-a[1].won||b[1].amount-a[1].amount)){const tr=document.createElement('tr');const target=targets.get(id)||0;const cells=[names.get(id)||id.slice(0,8)+'…',String(item.total),String(item.won),(100*item.won/item.total).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%',money(item.amount),target?money(target):'—',target?(100*item.amount/target).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'—'];for(const value of cells){const td=document.createElement('td');td.textContent=value;tr.append(td)}tbody.append(tr)}table.append(tbody);container.append(table)}
 const foot=document.createElement('p');foot.className='productivity-footnote';foot.textContent='* Não representa a data de atribuição: '+unassigned+' oportunidade(s) da coorte sem responsável. ** Comparação ilustrativa entre fechamentos atuais da coorte e meta do mês; não substitui o resultado mensal de fechamentos.';container.append(foot)
}
let lastClinic=null;window.addEventListener('nexocrm:leads-loaded',e=>{lastClinic=e.detail?.clinicId;currentLeads=Array.isArray(e.detail?.leads)?e.detail.leads:[];refresh(lastClinic)});period.addEventListener('change',()=>refresh(lastClinic));
})();