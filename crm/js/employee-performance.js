(()=>{'use strict';
const box=document.getElementById('employee-performance');if(!box)return;
const body=document.getElementById('employee-performance-list'),period=document.getElementById('employee-performance-month'),note=document.getElementById('employee-performance-note');
period.value=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}).slice(0,7);let serial=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
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
body.replaceChildren();if(!rows.length){body.textContent='Nenhuma atividade atribuída neste mês (ou sem acesso administrativo).';return}
const table=document.createElement('table');table.className='employee-table';table.innerHTML='<thead><tr><th>Funcionário</th><th>Contatos</th><th>Tarefas</th><th>Fechamentos</th><th>Valor registrado</th><th>Meta individual</th><th>Progresso</th></tr></thead>';
const tb=document.createElement('tbody');for(const [id,v] of [...grouped].sort((a,b)=>b[1].closed-a[1].closed||b[1].amount-a[1].amount||b[1].contact-a[1].contact)){const tr=document.createElement('tr');tr.innerHTML='<td title="'+esc(id)+'">'+esc(names.get(String(id))||((String(id).slice(0,8))+'…'))+'</td><td>'+v.contact+'</td><td>'+v.task+'</td><td>'+v.closed+'</td><td>'+money(v.amount)+'</td>';const target=targets.get(String(id))||0;const td=document.createElement('td');const inp=document.createElement('input');inp.type='number';inp.min='0.01';inp.step='0.01';inp.value=target||'';inp.placeholder='Definir meta';inp.setAttribute('aria-label','Meta mensal de '+(names.get(String(id))||String(id)));inp.style.width='115px';const btn=document.createElement('button');btn.type='button';btn.textContent='Salvar';btn.style.marginLeft='5px';btn.addEventListener('click',async()=>{const amount=Number(inp.value);if(!Number.isFinite(amount)||amount<=0){note.textContent='Informe uma meta maior que zero.';return}btn.disabled=true;try{await window.OralCloud.request('/rest/v1/rpc/nexodent_crm_employee_goal_save',{method:'POST',body:{p_clinic_id:clinicId,p_actor_id:id,p_month:month,p_target:amount}});note.textContent='Meta individual salva.';refresh(clinicId)}catch(e){note.textContent='Não foi possível salvar a meta: '+e.message;btn.disabled=false}});td.append(inp,btn);tr.append(td);const progress=document.createElement('td');progress.textContent=target?Math.round(v.amount/target*100)+'%':'—';tr.append(progress);tb.append(tr)}table.append(tb);body.append(table);
if(namesUnavailable)note.textContent='Não foi possível consultar os nomes dos funcionários; exibindo identificadores abreviados. ';
if(rows.length===1000)note.textContent='Limite de 1.000 eventos atingido: resultados parciais. Amplie a consulta antes de usar para avaliação de desempenho.';
}catch(e){if(run!==serial)return;body.textContent='Não foi possível consultar o desempenho.';note.textContent='Somente administradores podem visualizar. Verifique se o SQL foi executado. Detalhe: '+e.message}
}
let lastClinic=null;window.addEventListener('nexocrm:leads-loaded',e=>{lastClinic=e.detail?.clinicId;refresh(lastClinic)});period.addEventListener('change',()=>refresh(lastClinic));
})();