/* NexoDent Admin 70: painel de saude, somente leitura. */
(()=>{'use strict';
const pane=document.getElementById('nx-diagnostics');
if(!pane || !window.OralCloud || typeof window.OralCloud.request!=='function')return;
const section=document.createElement('section');section.style.marginTop='22px';
const heading=document.createElement('h2');heading.textContent='Painel de saúde — Atualização 70';section.appendChild(heading);
const note=document.createElement('p');note.textContent='Indicadores baseados apenas nos registros retornados (até 100 eventos automáticos). Ausência de registros não comprova ausência de bugs. Consultas somente de leitura.';section.appendChild(note);
const button=document.createElement('button');button.type='button';button.textContent='Atualizar painel de saúde';section.appendChild(button);
const status=document.createElement('p');status.setAttribute('role','status');section.appendChild(status);
const list=document.createElement('div');section.appendChild(list);pane.appendChild(section);
function item(label,value){const row=document.createElement('div');row.className='nx-result';const strong=document.createElement('strong');strong.textContent=label;row.append(strong,document.createTextNode(' — '+value));list.appendChild(row)}
async function load(){button.disabled=true;list.replaceChildren();status.textContent='Consultando registros...';
let events=null,incidents=null;const failures=[];
try{const result=await window.OralCloud.request('/rest/v1/rpc/nexodent_admin_client_errors',{method:'POST',body:{p_limit:100}});if(!Array.isArray(result))throw Error('Formato inesperado');events=result}catch(e){failures.push('Eventos automáticos indisponíveis')}
try{const result=await window.OralCloud.request('/rest/v1/rpc/nexodent_admin_incidents',{method:'POST',body:{p_action:'list',p_module:null,p_severity:null,p_description:null,p_id:null,p_status:null}});if(!Array.isArray(result))throw Error('Formato inesperado');incidents=result}catch(e){failures.push('Ocorrências manuais indisponíveis')}
if(failures.length){item('🟡 Diagnóstico parcial','Não foi possível consultar todas as fontes.');for(const f of failures)item('Atenção',f)}
if(events){item('Eventos automáticos',String(events.length)+' (máximo de 100 retornados)');const byClinic=new Map();for(const e of events){const k=typeof e.clinic_id==='string'&&e.clinic_id?e.clinic_id:'Não identificada';byClinic.set(k,(byClinic.get(k)||0)+1)}item('Clínicas com eventos identificados',String([...byClinic.keys()].filter(k=>k!=='Não identificada').length));for(const [clinic,count] of [...byClinic].sort((a,b)=>b[1]-a[1]).slice(0,10))item('Clínica '+clinic,String(count)+' evento(s)');}
if(incidents){item('Ocorrências manuais',String(incidents.length));const pending=incidents.filter(r=>!['corrigido','resolvido','closed','resolved'].includes(String(r.status||'').toLowerCase()));item('Ocorrências não encerradas',String(pending.length));const counts=new Map();for(const r of incidents){const key=String(r.module||'Não identificado').slice(0,60);counts.set(key,(counts.get(key)||0)+1)}for(const [module,count] of [...counts].sort((a,b)=>b[1]-a[1]).slice(0,10))item('Módulo '+module,String(count)+' ocorrência(s)')}
if(events&&incidents){const open=incidents.filter(r=>!['corrigido','resolvido','closed','resolved'].includes(String(r.status||'').toLowerCase()));const severe=open.some(r=>/critical|critico|crítico|alta|grave/.test(String(r.severity||'').toLowerCase()));item(severe?'🔴 Atenção prioritária':(events.length||open.length?'🟡 Atenção':'🟢 Sem ocorrências na amostra'),severe?'Há ocorrências abertas classificadas como graves.':events.length||open.length?'Existem eventos ou ocorrências abertas para revisar.':'Nenhum registro encontrado nas fontes consultadas; não é garantia de sistema sem falhas.');}
const dates=[...(events||[]),...(incidents||[])].map(r=>Date.parse(r.created_at)).filter(Number.isFinite);if(dates.length)item('Período dos registros',new Date(Math.min(...dates)).toLocaleString('pt-BR')+' a '+new Date(Math.max(...dates)).toLocaleString('pt-BR'));
status.textContent='Consulta concluída. Indicadores não substituem testes funcionais.';button.disabled=false;
}
button.addEventListener('click',load);
})();
