/* NexoDent 267: despesas gerais; não movimenta laboratório automaticamente. */
(function(){'use strict';
 let cache=[],clinic=null,loaded=false,error='';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
 const today=()=>new Date().toLocaleDateString('en-CA');
 const ready=()=>!!window.OralCloud?.enabled&&!!window.OralCloud?.clinicId;
 const admin=()=>ready()&&window.NexoModules?.isAllowed('finance')!==false&&typeof pmLvl==='function'&&pmLvl('vd')>=2;
 const url=()=>'/rest/v1/nexodent_general_expenses';
 async function load(){if(!admin())throw Error('Acesso administrativo necessário.');const id=window.OralCloud.clinicId;loaded=false;const data=await window.OralCloud.request(url()+'?select=id,description,category,supplier,amount,due_date,paid_at,payment_method,external_reference&clinic_id=eq.'+encodeURIComponent(id)+'&order=due_date.desc&limit=2000');if(window.OralCloud.clinicId!==id)throw Error('Clínica alterada durante a consulta.');cache=Array.isArray(data)?data:[];clinic=id;loaded=true;error='';window.render();}
 function html(){if(!admin())return '<div class="card">Despesas gerais: acesso restrito ao administrador.</div>';
 const valid=loaded&&clinic===window.OralCloud.clinicId,rows=valid?cache:[],pending=rows.filter(x=>!x.paid_at),paid=rows.filter(x=>x.paid_at),overdue=pending.filter(x=>x.due_date<today());
 return `<div class="card"><h2>Despesas gerais da clínica</h2><p class="note">Controle separado do laboratório. Não cadastre aqui uma parcela laboratorial já conciliada ou lançada no livro auxiliar. Nenhuma despesa é importada automaticamente.</p><button id="nx-exp-load">Atualizar despesas</button>${error?`<p class="note">${esc(error)}</p>`:''}<p class="note">${valid?`Total pago: ${money(paid.reduce((s,x)=>s+Number(x.amount),0))} · Pendente: ${money(pending.reduce((s,x)=>s+Number(x.amount),0))} · Vencidas: ${overdue.length}`:'Clique em Atualizar despesas para consultar os dados.'}</p>
 <form id="nx-exp-form" style="display:flex;flex-wrap:wrap;gap:8px;align-items:end"><label>Descrição<input name="description" required minlength="2" maxlength="200"></label><label>Categoria<select name="category">${['Aluguel','Energia','Água','Materiais','Salários','Impostos','Manutenção','Marketing','Outros'].map(x=>`<option>${x}</option>`).join('')}</select></label><label>Fornecedor<input name="supplier" maxlength="150"></label><label>Valor (R$)<input name="amount" type="number" min="0.01" step="0.01" required></label><label>Vencimento<input name="due_date" type="date" required value="${today()}"></label><button type="submit">Cadastrar despesa</button></form>
 <div style="overflow:auto"><table style="width:100%"><thead><tr>${['Vencimento','Descrição','Categoria','Fornecedor','Valor','Situação','Vínculo financeiro','Ação'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.due_date)}</td><td>${esc(x.description)}</td><td>${esc(x.category)}</td><td>${esc(x.supplier)}</td><td>${money(x.amount)}</td><td>${x.paid_at?'Paga em '+esc(x.paid_at):x.due_date<today()?'Vencida':'Pendente'}</td><td>${esc(x.external_reference||'—')}</td><td>${x.paid_at?'':`<button type="button" data-nx-exp-pay="${esc(x.id)}">Marcar paga</button>`} <button type="button" data-nx-exp-link="${esc(x.id)}">${x.external_reference?'Alterar vínculo':'Vincular repasse'}</button></td></tr>`).join('')||'<tr><td colspan="8">Nenhuma despesa carregada.</td></tr>'}</tbody></table></div></div>`;
 }
 window.NexoGeneralExpenses={html,load, snapshot(){
  const id=window.OralCloud?.clinicId;
  return admin()&&loaded&&clinic===id?{ready:true,rows:cache.map(x=>({...x}))}:{ready:false,rows:[]};
 }};
 document.addEventListener('click',async e=>{if(e.target.closest('#nx-exp-load')){try{await load()}catch(err){error=err.message;alert(error)}return;}const b=e.target.closest('[data-nx-exp-pay]');if(!b)return;const x=cache.find(z=>z.id===b.dataset.nxExpPay);if(!x||!admin()||clinic!==window.OralCloud.clinicId)return;const date=prompt('Data do pagamento (AAAA-MM-DD)',today());if(date===null)return;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){alert('Data inválida');return;}const method=prompt('Forma de pagamento (Pix, Dinheiro, Transferência, Cartão, Boleto)', 'Pix');if(!method?.trim())return;if(!confirm(`Confirmar pagamento de ${money(x.amount)}?`))return;const id=clinic;try{await window.OralCloud.request(url()+'?id=eq.'+encodeURIComponent(x.id)+'&clinic_id=eq.'+encodeURIComponent(id)+'&paid_at=is.null',{method:'PATCH',headers:{'Prefer':'return=representation'},body:{paid_at:date,payment_method:method.trim()}});if(window.OralCloud.clinicId===id)await load()}catch(err){alert('Não foi possível registrar pagamento: '+err.message)}});
 document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-nx-exp-link]');if(!b)return;
  const x=cache.find(z=>String(z.id)===b.dataset.nxExpLink);
  if(!x||!admin()||clinic!==window.OralCloud.clinicId)return;
  const ref=prompt('Identificador do repasse pago (CP-ID). Deixe vazio para retirar o vínculo.',x.external_reference||'');
  if(ref===null)return;
  const normalized=ref.trim();
  if(normalized&&!/^CP-[A-Za-z0-9_-]{1,80}$/.test(normalized)){alert('Use o formato CP-ID, com o identificador exato do repasse.');return;}
  if(normalized&&cache.some(z=>z.id!==x.id&&z.external_reference===normalized)){alert('Este repasse já está vinculado a outra despesa geral.');return;}
  if(!confirm(normalized?'Vincular esta despesa ao repasse '+normalized+'? Confira antes o valor e a data do pagamento.':'Remover o vínculo desta despesa?'))return;
  const id=clinic;
  try{const result=await window.OralCloud.request(url()+'?id=eq.'+encodeURIComponent(x.id)+'&clinic_id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{'Prefer':'return=representation'},body:{external_reference:normalized||null}});if(!Array.isArray(result)||result.length!==1)throw Error('Nenhuma despesa atualizada.');if(window.OralCloud.clinicId===id)await load();}catch(err){alert('Falha ao vincular despesa: '+err.message)}
 });
 document.addEventListener('submit',async e=>{if(e.target.id!=='nx-exp-form')return;e.preventDefault();if(!admin())return;const f=e.target,d=Object.fromEntries(new FormData(f));if(!Number.isFinite(Number(d.amount))||Number(d.amount)<=0)return alert('Valor inválido');const id=window.OralCloud.clinicId;try{await window.OralCloud.request(url(),{method:'POST',headers:{'Prefer':'return=representation'},body:{clinic_id:id,description:d.description.trim(),category:d.category,supplier:d.supplier.trim(),amount:Number(d.amount),due_date:d.due_date}});if(window.OralCloud.clinicId===id)await load()}catch(err){alert('Erro ao salvar despesa: '+err.message)}});
 window.addEventListener('nexodent:modules-updated',()=>{loaded=false;cache=[];clinic=null});
})();
