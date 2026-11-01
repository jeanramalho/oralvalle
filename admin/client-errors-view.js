/* Atualizacao 66: leitura restrita pelo RPC do servidor. */
(()=>{'use strict';const pane=document.getElementById('nx-errors');if(!pane)return;
const box=document.createElement('section');box.style.marginTop='18px';
const title=document.createElement('h2');title.textContent='Erros automaticos das clinicas';box.appendChild(title);
const info=document.createElement('p');info.textContent='Eventos tecnicos anonimizados por tipo. Sem mensagens, URLs ou dados de pacientes. Clinica nao identificada quando o usuario pertence a mais de uma.';box.appendChild(info);
const btn=document.createElement('button');btn.type='button';btn.textContent='Atualizar eventos automaticos';box.appendChild(btn);
const status=document.createElement('p');status.setAttribute('role','status');box.appendChild(status);
const list=document.createElement('div');box.appendChild(list);pane.appendChild(box);
async function refresh(){btn.disabled=true;status.textContent='Consultando...';list.replaceChildren();try{
 const rows=await window.OralCloud.request('/rest/v1/rpc/nexodent_admin_client_errors',{method:'POST',body:{p_limit:100}});
 for(const r of rows||[]){const item=document.createElement('div');item.className='nx-result';item.textContent=`${new Date(r.created_at).toLocaleString('pt-BR')} — ${r.kind==='promise'?'Promise rejeitada':'Erro JavaScript'} — Clinica: ${r.clinic_id||'nao identificada'}`;list.appendChild(item)}
 status.textContent=`${(rows||[]).length} eventos encontrados (ultimos 100).`;
 }catch(e){status.textContent='Consulta indisponivel: '+(e?.message||'erro');}finally{btn.disabled=false}}
 btn.addEventListener('click',refresh);
 document.querySelector('[data-nx-tab="errors"]')?.addEventListener('click',refresh);
})();


/* Atualizacao 69: analise agregada SOMENTE LEITURA; nao altera o painel nem o banco. */
(()=>{'use strict';
const pane=document.getElementById('nx-diagnostics');
if(!pane || !window.OralCloud || typeof window.OralCloud.request!=='function')return;
const section=document.createElement('section');section.style.marginTop='18px';
const heading=document.createElement('h2');heading.textContent='Análise de estabilidade — Atualização 69';section.appendChild(heading);
const explanation=document.createElement('p');explanation.textContent='Resumo dos últimos registros disponíveis (até 100 eventos automáticos e ocorrências manuais retornadas pelo servidor). Não executa testes clínicos nem altera dados.';section.appendChild(explanation);
const button=document.createElement('button');button.type='button';button.textContent='Analisar erros registrados';section.appendChild(button);
const status=document.createElement('p');status.setAttribute('role','status');section.appendChild(status);
const results=document.createElement('div');section.appendChild(results);pane.appendChild(section);
const classify=s=>{s=String(s||'').toLowerCase();if(/assin|certific|pdf|document|receit|atest|evolu/.test(s))return'Documentos e assinaturas';if(/laborat/.test(s))return'Laboratório';if(/finance|pagam|comiss|cobran/.test(s))return'Financeiro e comissões';if(/pacien|anamn|odontogram/.test(s))return'Pacientes';if(/agenda|agendam/.test(s))return'Agenda';return'Outros / não identificado'};
const add=(title,detail)=>{const item=document.createElement('div');item.className='nx-result';const strong=document.createElement('strong');strong.textContent=title;item.append(strong,document.createTextNode(' — '+detail));results.appendChild(item)};
button.addEventListener('click',async()=>{button.disabled=true;results.replaceChildren();status.textContent='Consultando registros (somente leitura)...';
const problems=[];let events=[],incidents=[];
try{const data=await window.OralCloud.request('/rest/v1/rpc/nexodent_admin_client_errors',{method:'POST',body:{p_limit:100}});if(!Array.isArray(data))throw Error('Resposta inesperada');events=data}catch(e){problems.push('Eventos automáticos indisponíveis: '+String(e?.message||'erro').slice(0,120))}
try{const data=await window.OralCloud.request('/rest/v1/rpc/nexodent_admin_incidents',{method:'POST',body:{p_action:'list',p_module:null,p_severity:null,p_description:null,p_id:null,p_status:null}});if(!Array.isArray(data))throw Error('Resposta inesperada');incidents=data}catch(e){problems.push('Ocorrências manuais indisponíveis: '+String(e?.message||'erro').slice(0,120))}
const groups=new Map();for(const row of incidents){const module=classify(row.module);const key=module+' / '+String(row.status||'não informado');groups.set(key,(groups.get(key)||0)+1)}
add('Eventos automáticos',String(events.length)+' eventos retornados; por privacidade, o tipo de evento não identifica o módulo.');
add('Ocorrências manuais',String(incidents.length)+' registros retornados.');
for(const [key,count] of [...groups].sort((a,b)=>b[1]-a[1]))add(key,String(count)+' ocorrência(s)');
const byKind=new Map();for(const e of events){const kind=e.kind==='promise'?'Promise rejeitada':e.kind==='error'?'Erro JavaScript':'Outro evento';byKind.set(kind,(byKind.get(kind)||0)+1)}
for(const [kind,count] of byKind)add('Repetição: '+kind,String(count)+' evento(s) na amostra');
const times=[...events,...incidents].map(x=>Date.parse(x.created_at)).filter(Number.isFinite);if(times.length)add('Período da amostra',new Date(Math.min(...times)).toLocaleString('pt-BR')+' até '+new Date(Math.max(...times)).toLocaleString('pt-BR'));
for(const issue of problems)add('Atenção',issue);
status.textContent=problems.length?'Análise parcial: '+problems.length+' fonte(s) indisponível(is).':'Análise concluída. Resultados limitados aos registros retornados.';
button.disabled=false;
});
})();
