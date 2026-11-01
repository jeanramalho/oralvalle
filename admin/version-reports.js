/* NexoDent Admin 72 - Relatorios de estabilidade: somente leitura. */
(()=>{'use strict';
const pane=document.getElementById('nx-reports');
if(!pane)return;
const section=document.createElement('section');section.style.marginTop='20px';
const title=document.createElement('h2');title.textContent='Relatório de estabilidade — atualização 77';section.append(title);
const note=document.createElement('p');note.textContent='Consulta até 100 erros automáticos e ocorrências manuais. A versão só aparece quando retornada pela consulta administrativa. Sem eventos não significa ausência de falhas.';section.append(note);
const btn=document.createElement('button');btn.type='button';btn.textContent='Gerar relatório de estabilidade';section.append(btn);
const status=document.createElement('p');status.setAttribute('role','status');section.append(status);
const output=document.createElement('div');section.append(output);
const download=document.createElement('button');download.type='button';download.textContent='Exportar relatório JSON';download.hidden=true;section.append(download);
pane.append(section);
let report=null;
function item(label,value){const el=document.createElement('div');el.className='nx-result';el.textContent=label+': '+value;output.append(el)}
btn.addEventListener('click',async()=>{btn.disabled=true;download.hidden=true;output.replaceChildren();status.textContent='Consultando registros...';
const errors=[];let automatic=[],manual=[];
if(typeof window.OralCloud?.request!=='function'){status.textContent='Cliente de dados indisponível.';btn.disabled=false;return}
try{const x=await window.OralCloud.request('/rest/v1/rpc/nexodent_admin_client_errors_v2',{method:'POST',body:{p_limit:100}});if(!Array.isArray(x))throw Error('Resposta inesperada');automatic=x}catch(e){errors.push('Erros automáticos: consulta indisponível')}
try{const x=await window.OralCloud.request('/rest/v1/rpc/nexodent_admin_incidents',{method:'POST',body:{p_action:'list',p_module:null,p_severity:null,p_description:null,p_id:null,p_status:null}});if(!Array.isArray(x))throw Error('Resposta inesperada');manual=x}catch(e){errors.push('Ocorrências manuais: consulta indisponível')}
const clinics={};for(const e of automatic){const id=typeof e.clinic_id==='string'&&e.clinic_id?e.clinic_id:'Não identificada';clinics[id]=(clinics[id]||0)+1}
const modules={};for(const e of manual){const m=String(e.module||'Não informado').slice(0,80);modules[m]=(modules[m]||0)+1}
const versions={};let unversioned=0;for(const e of automatic){const v=typeof e.app_version==='string'?e.app_version:typeof e.version==='string'?e.version:typeof e.client_version==='string'?e.client_version:null;if(v&&/^[a-zA-Z0-9._-]{1,32}$/.test(v)){versions[v]=(versions[v]||0)+1}else{unversioned++}}
const dates=[...automatic,...manual].map(e=>Date.parse(e.created_at)).filter(Number.isFinite);
report={generated_at:new Date().toISOString(),admin_report_version:'77',event_version_tracking:Object.keys(versions).length?'parcial ou disponível conforme resposta do servidor':'não disponível no RPC atual',sample_limit_automatic:100,automatic_events:automatic.length,manual_incidents:manual.length,automatic_by_clinic:clinics,manual_by_module:modules,automatic_by_version:versions,events_without_version:unversioned,first_event:dates.length?new Date(Math.min(...dates)).toISOString():null,last_event:dates.length?new Date(Math.max(...dates)).toISOString():null,version_comparison:Object.keys(versions).length>=2?'contagens brutas por versão; não representam taxas comparáveis':'indisponível: menos de duas versões identificadas',warnings:errors};
item('Erros automáticos',report.automatic_events);item('Ocorrências manuais',report.manual_incidents);
for(const [k,v] of Object.entries(clinics))item('Clínica '+k,v+' evento(s)');
for(const [k,v] of Object.entries(modules))item('Módulo '+k,v+' ocorrência(s)');
for(const [v,n] of Object.entries(versions))item('Versão '+v,n+' evento(s) na amostra');item('Eventos sem versão',unversioned);if(!automatic.length)item('Monitoramento','Nenhum evento automático registrado na amostra. Isso não confirma que a captura esteja ativa.');else if(!Object.keys(versions).length)item('Versões','A consulta não retornou versões preenchidas. Verifique se o RPC nexodent_admin_client_errors_v2 expõe app_version e se novos eventos estão sendo gravados com versão.');item('Comparação de versões',report.version_comparison);
for(const warning of errors)item('Atenção',warning);
status.textContent=errors.length?'Relatório parcial — fontes indisponíveis.':'Relatório gerado (amostra limitada).';download.hidden=false;btn.disabled=false;
});
download.addEventListener('click',()=>{if(!report)return;const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nexodent-estabilidade-77.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
})();
