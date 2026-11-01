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
