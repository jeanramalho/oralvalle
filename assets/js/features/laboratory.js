/* NexoDent — controle de trabalhos protéticos / laboratório. */
(function(){
'use strict';
const STAGES=['Planejamento','Moldagem / escaneamento','Enviado ao laboratório','Em produção','Prova','Ajustes','Finalização','Recebido na clínica','Entregue ao paciente'];
const STATES=['Pendente','Em andamento','Aguardando laboratório','Em prova','Em observação','Recebido','Entregue','Cancelado'];
const $id=id=>document.getElementById(id);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(arr,selected)=>arr.map(v=>`<option value="${safe(v)}" ${v===selected?'selected':''}>${safe(v)}</option>`).join('');
const date=s=>s?String(s).slice(0,10):'';
const stamp=()=>new Date().toISOString();
let orders=[],loading=false,error='',loadedClinic=null,filter='ativos',search='',editing=null,busy=false,loadAttemptedClinic=null;
const cloud=()=>!!window.OralCloud?.enabled;
const clinic=()=>window.OralCloud?.clinicId||null;
const key=()=>`nexodent:lab:v1:${clinic()||'local'}:${ME?.id||'local'}`;
const isLab=()=>view.h==='lab'&&!view.id;
function localRead(){try{return JSON.parse(localStorage.getItem(key())||'[]')}catch(_){return []}}
function localWrite(){localStorage.setItem(key(),JSON.stringify(orders));}
function allowed(){return typeof pmSee!=='function'||pmSee('pac');}
function canEdit(){return typeof pmLvl!=='function'||pmLvl('pac')>=2;}
function renderLab(){if(isLab()&&typeof render==='function')render();}
async function fetchOrders(force=false){
 if(!allowed())return;
 const id=clinic();
 if(cloud()&&!id){orders=[];loadedClinic=null;error='Selecione uma clínica para consultar os trabalhos.';renderLab();return;}
 if(loading)return;
 if(!force&&(loadedClinic===(id||'local')||loadAttemptedClinic===(id||'local')))return;
 loadAttemptedClinic=id||'local';
 loading=true;error='';renderLab();
 try{
  if(cloud()){
   const path='/rest/v1/nexodent_lab_orders?select=*&clinic_id=eq.'+encodeURIComponent(id)+'&order=updated_at.desc&limit=1000';
   const data=await OralCloud.request(path);if(clinic()!==id)return;
   orders=Array.isArray(data)?data:[];
  }else orders=localRead();
  loadedClinic=id||'local';
 }catch(e){orders=[];loadedClinic=null;error='Não foi possível carregar os trabalhos: '+(e.message||'erro de conexão');}
 finally{loading=false;renderLab();}
}
function input(label,id,value='',type='text',extra=''){
 return `<label class="nxlab-field"><span>${label}</span><input id="${id}" type="${type}" value="${safe(value)}" ${extra}></label>`;
}
function select(label,id,values,value){return `<label class="nxlab-field"><span>${label}</span><select id="${id}">${options(values,value)}</select></label>`;}
function textarea(label,id,value=''){return `<label class="nxlab-field nxlab-wide"><span>${label}</span><textarea id="${id}" rows="3">${safe(value)}</textarea></label>`;}
function patientName(id){return db.p?.find(p=>String(p.id)===String(id))?.nome||'Paciente não encontrado';}
// Integração de consulta: utiliza tratamentos já cadastrados, sem modificar registros financeiros.
function patientTreatments(pid){
 const patient=(db.p||[]).find(p=>String(p.id)===String(pid));
 return Array.isArray(patient?.trat)?patient.trat:[];
}
function money(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function isoToday(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function validateOrder(f,original){
 if(f.due_at&&f.sent_at&&f.due_at<f.sent_at)return 'A previsão de entrega não pode ser anterior à data de envio.';
 if(f.received_at&&f.sent_at&&f.received_at<f.sent_at)return 'O recebimento não pode ser anterior ao envio.';
 if(f.status==='Entregue'&&!f.received_at)return 'Informe a data de recebimento antes de marcar como entregue.';
 const duplicate=orders.some(o=>o.id!==original?.id&&String(o.patient_id)===String(f.patient_id)&&String(o.laboratory||'').trim().toLowerCase()===f.laboratory.toLowerCase()&&String(o.work_description||'').trim().toLowerCase()===f.work_description.toLowerCase()&&!['Cancelado','Entregue'].includes(o.status));
 if(duplicate&&!confirm('Já existe um trabalho em aberto com o mesmo paciente, laboratório e descrição. Deseja cadastrar mesmo assim?'))return 'cancel';
 return '';
}

function treatmentSummary(pid){
 const list=patientTreatments(pid);
 if(!list.length)return '<span>Nenhum tratamento cadastrado para este paciente.</span>';
 const completed=list.filter(t=>t.vid||['concluído','concluido','realizado'].includes(String(t.status||'').toLowerCase()));
 const cost=list.reduce((sum,t)=>sum+(Number(t.custo)||0),0);
 return `<span><b>Tratamentos:</b> ${list.length} (${completed.length} concluídos)</span><span><b>Custos cadastrados:</b> ${safe(money(cost))}</span>`;
}
function form(o={}){
 const patients=(db.p||[]).filter(p=>!p.arq);
 return `<section class="card nxlab-form"><h3>${o.id?'Editar trabalho':'Novo trabalho para laboratório'}</h3>
 <div class="nxlab-grid"><label class="nxlab-field"><span>Paciente * — digite para filtrar</span><input id="nxlab-patient-search" type="search" autocomplete="off" list="nxlab-patient-options" placeholder="Digite o nome do paciente" value="${safe(patients.find(p=>String(p.id)===String(o.patient_id))?.nome||'')}"><datalist id="nxlab-patient-options">${patients.map(p=>`<option value="${safe(p.nome)}"></option>`).join('')}</datalist><input id="nxlab-patient" type="hidden" value="${safe(o.patient_id||'')}"><small id="nxlab-patient-count">${patients.length} pacientes disponíveis</small></label>
 ${input('Laboratório responsável *','nxlab-lab',o.laboratory,'text','maxlength="160" required')}
 ${input('Trabalho a realizar *','nxlab-work',o.work_description,'text','maxlength="240" required')}
 ${input('Cor / escala (ex.: A2)','nxlab-shade',o.shade,'text','maxlength="80"')}
 ${input('Dente(s) / região','nxlab-teeth',o.teeth,'text','maxlength="80"')}
 ${input('Data de envio','nxlab-sent',date(o.sent_at),'date')}
 ${input('Previsão de entrega','nxlab-due',date(o.due_at),'date')}
 ${input('Data de recebimento','nxlab-received',date(o.received_at),'date')}
 ${select('Etapa atual','nxlab-stage',STAGES,o.stage||STAGES[0])}
 ${select('Situação','nxlab-status',STATES,o.status||STATES[0])}
 ${textarea('Motivo da observação (obrigatório se Em observação)','nxlab-observation',o.observation_reason)}
 ${textarea('Instruções para o laboratório','nxlab-instructions',o.instructions)}
 </div><div class="nxlab-actions"><button type="button" data-lab="save">${o.id?'Salvar alterações':'Cadastrar trabalho'}</button><button class="ghost" type="button" data-lab="cancel">Cancelar</button></div></section>`;
}
function card(o){
 const events=Array.isArray(o.history)?o.history:[];
 const comments=Array.isArray(o.comments)?o.comments:[];
 const obs=o.status==='Em observação';
 return `<article class="card nxlab-card"><div class="nxlab-head"><div><strong>${safe(patientName(o.patient_id))}</strong><div class="nxlab-sub">${safe(o.work_description)} · ${safe(o.teeth||'Sem região')}</div></div><span class="nxlab-pill ${obs?'nxlab-alert':''}">${safe(o.status)}</span></div>
 <div class="nxlab-details"><span><b>Laboratório:</b> ${safe(o.laboratory)}</span><span><b>Cor:</b> ${safe(o.shade||'—')}</span><span><b>Etapa:</b> ${safe(o.stage)}</span><span><b>Envio:</b> ${safe(date(o.sent_at)||'—')}</span><span><b>Entrega prevista:</b> ${safe(date(o.due_at)||'—')}</span><span><b>Recebido:</b> ${safe(date(o.received_at)||'—')}</span>${treatmentSummary(o.patient_id)}</div>
 ${obs?`<p class="nxlab-note"><b>Em observação:</b> ${safe(o.observation_reason||'Motivo não informado')}</p>`:''}
 ${o.instructions?`<p><b>Instruções:</b> ${safe(o.instructions)}</p>`:''}
 <div class="nxlab-actions"><button class="ghost sm" data-lab="details" data-id="${safe(o.id)}">Histórico e comentários (${events.length+comments.length})</button>${canEdit()?`<button class="ghost sm" data-lab="edit" data-id="${safe(o.id)}">Editar</button><button class="sm" data-lab="advance" data-id="${safe(o.id)}">Avançar etapa →</button>`:''}</div>
 ${view.labDetails===o.id?`<div class="nxlab-timeline">${events.slice().reverse().map(h=>`<div><small>${safe(new Date(h.at).toLocaleString('pt-BR'))}</small> · ${safe(h.text)}</div>`).join('')}${comments.map(c=>`<div><small>${safe(new Date(c.at).toLocaleString('pt-BR'))}</small> · 💬 ${safe(c.text)}</div>`).join('')||'<p>Sem comentários.</p>'}${canEdit()?`<label class="nxlab-field"><span>Novo comentário</span><textarea id="nxlab-comment-${safe(o.id)}" maxlength="2000" rows="2" placeholder="Registre orientações, ajustes, ocorrências..."></textarea></label><button class="sm" data-lab="comment" data-id="${safe(o.id)}">Adicionar comentário</button>`:''}</div>`:''}
 </article>`;
}
function style(){return `<style>
 .nxlab-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:0 0 16px}.nxlab-metrics>div{padding:14px;border:1px solid #f3d3b6;background:#fff8f1;border-radius:12px;display:flex;flex-direction:column;gap:4px}.nxlab-metrics strong{font-size:25px;color:#b95000}.nxlab-metrics span{font-size:12px;color:#6b4c38}.nxlab-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px}.nxlab-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.nxlab-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}.nxlab-field{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:600}.nxlab-field input,.nxlab-field select,.nxlab-field textarea{width:100%;padding:10px;border:1px solid #d7d7d7;border-radius:9px;background:#fff;color:#222;font:inherit}.nxlab-wide{grid-column:1/-1}.nxlab-card{margin:12px 0}.nxlab-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.nxlab-sub{color:#666;margin-top:5px}.nxlab-pill{padding:5px 10px;border-radius:99px;background:#fff0df;color:#9a4d00;font-size:12px;font-weight:700}.nxlab-alert{background:#ffe1e1;color:#a70000}.nxlab-details{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:9px;margin-top:14px;font-size:13px}.nxlab-note{background:#fff3e2;border-left:3px solid #f80;padding:10px}.nxlab-timeline{border-top:1px solid #ddd;margin-top:14px;padding-top:12px}.nxlab-timeline>div{padding:7px 0;border-bottom:1px solid #eee}.nxlab-form{margin-bottom:20px}.nxlab-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.nxlab-filters input,.nxlab-filters select{padding:10px;border:1px solid #ddd;border-radius:8px;min-width:180px}.nxlab-empty{padding:20px;color:#555}.nxlab-error{background:#fff0f0;padding:12px;border-radius:8px;color:#a00000}
 </style>`;}
window.nexoLabHtml=function(){
 if(!allowed())return '<div class="card">Você não possui permissão para consultar os trabalhos de laboratório.</div>';
 if(loadedClinic!==(clinic()||'local')&&!loading&&loadAttemptedClinic!==(clinic()||'local'))setTimeout(()=>fetchOrders(),0);
 const today=isoToday();
 const active=o=>!['Entregue','Cancelado'].includes(o.status);
 const late=o=>active(o)&&!!o.due_at&&date(o.due_at)<today;
 const soon=o=>active(o)&&!!o.due_at&&date(o.due_at)>=today&&date(o.due_at)<=new Date(Date.now()+7*86400000).toLocaleDateString('en-CA');
 const noDeadline=o=>active(o)&&!o.due_at;
 const totals={open:orders.filter(active).length,late:orders.filter(late).length,observed:orders.filter(o=>o.status==='Em observação').length,delivered:orders.filter(o=>o.status==='Entregue').length,soon:orders.filter(soon).length,noDeadline:orders.filter(noDeadline).length};
 const items=orders.filter(o=>filter==='todos'||(filter==='observacao'?o.status==='Em observação':filter==='atrasados'?late(o):filter==='proximos'?soon(o):filter==='sem-prazo'?noDeadline(o):active(o))).filter(o=>!search||[patientName(o.patient_id),o.laboratory,o.work_description,o.teeth].some(t=>String(t||'').toLowerCase().includes(search.toLowerCase())));

 return `${style()}<div class="nxlab-top"><div><h2>Laboratório</h2><p>Controle de trabalhos, etapas, prazos e comunicação.</p></div><div class="nxlab-actions">${canEdit()?'<button data-lab="new">+ Novo trabalho</button>':''}<button class="ghost" data-lab="export">Exportar CSV (filtro atual)</button><button class="ghost" data-lab="refresh">Atualizar</button></div></div>
 ${error?`<p class="nxlab-error">${safe(error)}</p>`:''}${loading?'<p>Carregando trabalhos...</p>':''}
 <div class="nxlab-metrics"><div><strong>${totals.open}</strong><span>Em aberto</span></div><div><strong>${totals.late}</strong><span>Atrasados</span></div><div><strong>${totals.observed}</strong><span>Em observação</span></div><div><strong>${totals.delivered}</strong><span>Entregues</span></div><div><strong>${totals.soon}</strong><span>Próximos 7 dias</span></div><div><strong>${totals.noDeadline}</strong><span>Sem prazo definido</span></div></div>
 ${editing!==null?form(editing==='new'?{}:orders.find(o=>o.id===editing)||{}):''}
 <div class="nxlab-filters"><select id="nxlab-filter"><option value="ativos" ${filter==='ativos'?'selected':''}>Em aberto</option><option value="observacao" ${filter==='observacao'?'selected':''}>Em observação</option><option value="atrasados" ${filter==='atrasados'?'selected':''}>Atrasados</option><option value="proximos" ${filter==='proximos'?'selected':''}>Próximos 7 dias</option><option value="sem-prazo" ${filter==='sem-prazo'?'selected':''}>Sem prazo definido</option><option value="todos" ${filter==='todos'?'selected':''}>Todos</option></select><input id="nxlab-search" placeholder="Buscar paciente, laboratório ou trabalho" value="${safe(search)}"></div>
 <div>${items.length?items.map(card).join(''):'<div class="card nxlab-empty">Nenhum trabalho encontrado.</div>'}</div>`;
};
async function persist(o){
 if(cloud()){
  const id=clinic();if(!id)throw Error('Clínica não selecionada.');
  const path='/rest/v1/nexodent_lab_orders'+(o._new?'':'?id=eq.'+encodeURIComponent(o.id)+'&clinic_id=eq.'+encodeURIComponent(id));
  const body={...o,clinic_id:id};delete body._new;
  const method=o._new?'POST':'PATCH';
  await OralCloud.request(path,{method,body});
 }else{const ix=orders.findIndex(x=>x.id===o.id);if(ix>=0)orders[ix]=o;else orders.unshift(o);localWrite();}
 await fetchOrders(true);
}
function readForm(){const v=id=>($id(id)?.value||'').trim();return {patient_id:v('nxlab-patient'),laboratory:v('nxlab-lab'),work_description:v('nxlab-work'),shade:v('nxlab-shade'),teeth:v('nxlab-teeth'),sent_at:v('nxlab-sent')||null,due_at:v('nxlab-due')||null,received_at:v('nxlab-received')||null,stage:v('nxlab-stage'),status:v('nxlab-status'),observation_reason:v('nxlab-observation'),instructions:v('nxlab-instructions')};}
function exportCsv(){
 const fields=['Paciente','Laboratório','Trabalho','Dentes','Cor','Etapa','Situação','Envio','Previsão','Recebimento','Observação','Tratamentos cadastrados','Tratamentos concluídos','Custos cadastrados'];
 const today=isoToday();
 const active=o=>!['Entregue','Cancelado'].includes(o.status);
 const filtered=orders.filter(o=>filter==='todos'||(filter==='observacao'?o.status==='Em observação':filter==='atrasados'?active(o)&&o.due_at&&date(o.due_at)<today:filter==='proximos'?active(o)&&o.due_at&&date(o.due_at)>=today&&date(o.due_at)<=new Date(Date.now()+7*86400000).toLocaleDateString('en-CA'):filter==='sem-prazo'?active(o)&&!o.due_at:active(o))).filter(o=>!search||[patientName(o.patient_id),o.laboratory,o.work_description,o.teeth].some(t=>String(t||'').toLowerCase().includes(search.toLowerCase())));
 const rows=filtered.map(o=>[patientName(o.patient_id),o.laboratory,o.work_description,o.teeth,o.shade,o.stage,o.status,date(o.sent_at),date(o.due_at),date(o.received_at),o.observation_reason,patientTreatments(o.patient_id).length,patientTreatments(o.patient_id).filter(t=>t.vid||['concluído','concluido','realizado'].includes(String(t.status||'').toLowerCase())).length,patientTreatments(o.patient_id).reduce((sum,t)=>sum+(Number(t.custo)||0),0).toFixed(2)]);
 const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,v=>"'"+v).replace(/"/g,'""')+'"';
 const csv='\uFEFF'+[fields,...rows].map(row=>row.map(cell).join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='nexodent-laboratorio-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function execute(action,id){
 if(action==='export'){if(allowed())exportCsv();return;}
 if(busy)return;
 if(action==='refresh'){loadedClinic=null;loadAttemptedClinic=null;await fetchOrders(true);return;}
 if(action==='details'){view.labDetails=view.labDetails===id?null:id;renderLab();return;}
 if(!canEdit())return;
 if(action==='new'){editing='new';renderLab();return;}
 if(action==='cancel'){editing=null;renderLab();return;}
 if(action==='edit'){editing=id;renderLab();return;}
 const old=orders.find(o=>o.id===id);
 if(action!=='save'&&!old)return;
 let o;
 if(action==='save'){
  const f=readForm();if(!f.patient_id||!f.laboratory||!f.work_description){alert('Informe paciente, laboratório e trabalho.');return;}
  if(f.status==='Em observação'&&!f.observation_reason){alert('Informe o motivo da observação.');return;}
  const original=editing==='new'?null:orders.find(x=>x.id===editing);
  const invalid=validateOrder(f,original);if(invalid){if(invalid!=='cancel')alert(invalid);return;}
  o={...(original||{}),...f,id:original?.id||crypto.randomUUID(),history:[...(original?.history||[]),{at:stamp(),text:original?'Dados e etapa atualizados':'Trabalho cadastrado'}],comments:original?.comments||[],updated_at:stamp(),_new:!original};
 }else if(action==='advance'){
  const ix=STAGES.indexOf(old.stage),next=STAGES[Math.min(ix+1,STAGES.length-1)];
  if(ix===STAGES.length-1){alert('O trabalho já está na última etapa.');return;}
  const note=prompt(`Avançar para "${next}". Informe um comentário sobre a etapa (opcional):`);if(note===null)return;
  o={...old,stage:next,status:next==='Recebido na clínica'?'Recebido':next==='Entregue ao paciente'?'Entregue':'Em andamento',received_at:next==='Recebido na clínica'?(old.received_at||new Date().toISOString().slice(0,10)):old.received_at,history:[...(old.history||[]),{at:stamp(),text:`Etapa: ${old.stage} → ${next}${note?' — '+note.slice(0,500):''}`}],updated_at:stamp()};
 }else if(action==='comment'){
  const txt=($id('nxlab-comment-'+id)?.value||'').trim();if(!txt)return;
  o={...old,comments:[...(old.comments||[]),{at:stamp(),text:txt.slice(0,2000)}],updated_at:stamp()};
 }else return;
 busy=true;
 try{await persist(o);if(action==='save')editing=null;renderLab();if(typeof toast==='function')toast('Trabalho de laboratório atualizado.');}
 catch(e){alert('Não foi possível salvar: '+(e.message||'Erro de conexão'));}
 finally{busy=false;}
}
function labPatientMatch(){
 const input=$id('nxlab-patient-search'),hidden=$id('nxlab-patient'),count=$id('nxlab-patient-count');
 if(!input||!hidden)return;
 const normalize=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
 const q=normalize(input.value);
 const patients=(db.p||[]).filter(p=>!p.arq);
 const exact=patients.filter(p=>normalize(p.nome)===q);
 hidden.value=exact.length===1?String(exact[0].id):'';
 if(count)count.textContent=!q?patients.length+' pacientes disponíveis':exact.length>1?'Existem pacientes com o mesmo nome. Confirme no cadastro.':exact.length===1?'Paciente selecionado':patients.filter(p=>normalize(p.nome).includes(q)).length+' paciente(s) encontrado(s)';
}
document.addEventListener('input',e=>{if(e.target.id==='nxlab-patient-search')labPatientMatch();});
document.addEventListener('change',e=>{if(e.target.id==='nxlab-patient-search')labPatientMatch();});
document.addEventListener('click',e=>{const btn=e.target.closest('[data-lab]');if(btn){e.preventDefault();execute(btn.dataset.lab,btn.dataset.id);}});
document.addEventListener('change',e=>{if(e.target.id==='nxlab-filter'){filter=e.target.value;renderLab();}if(e.target.id==='nxlab-search'){search=e.target.value;renderLab();}});
document.addEventListener('keydown',e=>{if(e.target.id==='nxlab-search'&&e.key==='Enter'){search=e.target.value;renderLab();}});
window.addEventListener('nexodent:clinic-data-loaded',()=>{loadedClinic=null;loadAttemptedClinic=null;if(isLab())fetchOrders(true);});
window.addEventListener('focus',()=>{if(isLab())fetchOrders(true);});
})();
