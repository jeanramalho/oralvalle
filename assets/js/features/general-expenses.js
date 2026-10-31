/* NexoDent 267: despesas gerais; não movimenta laboratório automaticamente. */
(function(){'use strict';
 let cache=[],clinic=null,loaded=false,error='',suggestions=[],suggestError='',suggestLoaded=false;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
 const today=()=>new Date().toLocaleDateString('en-CA');
 const ready=()=>!!window.OralCloud?.enabled&&!!window.OralCloud?.clinicId;
 const admin=()=>ready()&&window.NexoModules?.isAllowed('finance')!==false&&typeof pmLvl==='function'&&pmLvl('vd')>=2;
 const url=()=>'/rest/v1/nexodent_general_expenses';
 async function load(){if(!admin())throw Error('Acesso administrativo necessário.');const id=window.OralCloud.clinicId;loaded=false;const data=await window.OralCloud.request(url()+'?select=id,description,category,supplier,amount,due_date,paid_at,payment_method,external_reference&clinic_id=eq.'+encodeURIComponent(id)+'&order=due_date.desc&limit=2000');if(window.OralCloud.clinicId!==id)throw Error('Clínica alterada durante a consulta.');cache=Array.isArray(data)?data:[];clinic=id;loaded=true;error='';window.render();}
 function html(){if(!admin())return '<div class="card">Despesas gerais: acesso restrito ao administrador.</div>';
 const valid=loaded&&clinic===window.OralCloud.clinicId,rows=valid?cache:[],pending=rows.filter(x=>!x.paid_at),paid=rows.filter(x=>x.paid_at),overdue=pending.filter(x=>x.due_date<today());
 const refCounts=new Map();for(const x of rows){if(x.external_reference)refCounts.set(x.external_reference,(refCounts.get(x.external_reference)||0)+1)}
 const repeated=[...refCounts].filter(([,n])=>n>1),unpaidLinked=rows.filter(x=>x.external_reference&&!x.paid_at),linked=rows.filter(x=>x.external_reference);
 const audit=valid?`<div class="note" style="padding:10px;border:1px solid #f5a623;border-radius:8px;margin:8px 0"><strong>Auditoria de vínculos:</strong> ${linked.length} despesas vinculadas · ${unpaidLinked.length} vinculadas e ainda não pagas · ${repeated.length} referências repetidas${rows.length===2000?' · Atenção: limite de 2.000 despesas atingido; auditoria pode estar incompleta.':''}.${repeated.length?'<br><strong>Referências repetidas:</strong> '+repeated.slice(0,10).map(([r,n])=>esc(r)+' ('+n+')').join(', '):''}</div>`:'';
 return `<div class="card"><h2>Despesas gerais da clínica</h2><p class="note">Controle separado do laboratório. Não cadastre aqui uma parcela laboratorial já conciliada ou lançada no livro auxiliar. Nenhuma despesa é importada automaticamente.</p><button id="nx-exp-load">Atualizar despesas</button>${error?`<p class="note">${esc(error)}</p>`:''}<p class="note">${valid?`Total pago: ${money(paid.reduce((s,x)=>s+Number(x.amount),0))} · Pendente: ${money(pending.reduce((s,x)=>s+Number(x.amount),0))} · Vencidas: ${overdue.length}`:'Clique em Atualizar despesas para consultar os dados.'}</p>
 ${audit}<div class="note" style="padding:12px;border:1px solid #f5a623;border-radius:8px;margin:10px 0"><strong>Conciliação assistida de laboratório</strong><p>Localize parcelas com valor igual e pagamento próximo ao vencimento (até 7 dias). Revise antes de vincular; nenhuma alteração é automática.</p><button type="button" id="nx-exp-suggest">Buscar correspondências</button>${suggestError?`<p>${esc(suggestError)}</p>`:''}${suggestLoaded?`<p>${suggestions.length} correspondência(s) sugerida(s). Apenas despesas ainda sem vínculo.</p><div style="overflow:auto"><table><thead><tr><th>Despesa</th><th>Parcela laboratório</th><th>Valor</th><th>Diferença de dias</th><th>Ação</th></tr></thead><tbody>${suggestions.map((v,i)=>`<tr><td>${esc(v.exp.description)} (${esc(v.exp.due_date)})</td><td>${esc(v.event.id)} (${esc(v.event.paid_at)})</td><td>${money(v.exp.amount)}</td><td>${v.days}</td><td><button type="button" data-nx-exp-suggest="${i}">Conferir e vincular</button></td></tr>`).join('')||'<tr><td colspan="5">Nenhuma correspondência encontrada.</td></tr>'}</tbody></table></div>`:''}</div><form id="nx-exp-form" style="display:flex;flex-wrap:wrap;gap:8px;align-items:end"><label>Descrição<input name="description" required minlength="2" maxlength="200"></label><label>Categoria<select name="category">${['Aluguel','Energia','Água','Materiais','Salários','Impostos','Manutenção','Marketing','Outros'].map(x=>`<option>${x}</option>`).join('')}</select></label><label>Fornecedor<input name="supplier" maxlength="150"></label><label>Valor (R$)<input name="amount" type="number" min="0.01" step="0.01" required></label><label>Vencimento<input name="due_date" type="date" required value="${today()}"></label><button type="submit">Cadastrar despesa</button></form>
 <div style="overflow:auto"><table style="width:100%"><thead><tr>${['Vencimento','Descrição','Categoria','Fornecedor','Valor','Situação','Vínculo financeiro','Ação'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.due_date)}</td><td>${esc(x.description)}</td><td>${esc(x.category)}</td><td>${esc(x.supplier)}</td><td>${money(x.amount)}</td><td>${x.paid_at?'Paga em '+esc(x.paid_at):x.due_date<today()?'Vencida':'Pendente'}</td><td>${esc(x.external_reference||'—')}</td><td>${x.paid_at?'':`<button type="button" data-nx-exp-pay="${esc(x.id)}">Marcar paga</button>`} <button type="button" data-nx-exp-link="${esc(x.id)}">${x.external_reference?'Alterar vínculo':'Vincular pagamento'}</button></td></tr>`).join('')||'<tr><td colspan="8">Nenhuma despesa carregada.</td></tr>'}</tbody></table></div></div>`;
 }
 window.NexoGeneralExpenses={html,load, snapshot(){
  const id=window.OralCloud?.clinicId;
  return admin()&&loaded&&clinic===id?{ready:true,rows:cache.map(x=>({...x}))}:{ready:false,rows:[]};
 }};
 async function findSuggestions(){
  if(!admin()||!loaded||clinic!==window.OralCloud.clinicId)throw Error('Atualize as despesas primeiro.');
  const id=clinic;
  const events=await window.OralCloud.request('/rest/v1/nexodent_lab_payment_events?select=id,amount,paid_at,kind&clinic_id=eq.'+encodeURIComponent(id)+'&order=paid_at.desc&limit=5000');
  if(id!==window.OralCloud.clinicId)throw Error('Clínica alterada durante a consulta.');
  if(!Array.isArray(events))throw Error('Não foi possível carregar as parcelas.');
  const used=new Set(cache.map(x=>x.external_reference).filter(Boolean));
  suggestions=[];
  for(const exp of cache.filter(x=>!x.external_reference&&x.paid_at)){
   for(const event of events){
    if(event.kind==='opening'||!event.paid_at||used.has('LABPAY-'+event.id))continue;
    if(Math.abs(Math.round(Number(exp.amount)*100)-Math.round(Number(event.amount)*100))>0)continue;
    const reference=exp.paid_at||exp.due_date;
    const days=Math.round(Math.abs(new Date(reference+'T12:00:00Z')-new Date(event.paid_at+'T12:00:00Z'))/86400000);
    if(Number.isFinite(days)&&days<=7)suggestions.push({exp,event,days});
   }
  }
  suggestions.sort((a,b)=>a.days-b.days);
  suggestLoaded=true;suggestError='';window.render();
 }
 document.addEventListener('click',async e=>{
  if(e.target.closest('#nx-exp-suggest')){try{await findSuggestions()}catch(err){suggestError=err.message;suggestLoaded=false;window.render()}return;}
  const btn=e.target.closest('[data-nx-exp-suggest]');if(!btn)return;
  const match=suggestions[Number(btn.dataset.nxExpSuggest)];if(!match||!admin()||clinic!==window.OralCloud.clinicId)return;
  const {exp,event}=match,ref='LABPAY-'+event.id;
  if(!cache.some(x=>x.id===exp.id&&!x.external_reference)||cache.some(x=>x.external_reference===ref))return alert('Vínculo alterado. Atualize os dados.');
  if(!confirm(`Confirmar vínculo?\nDespesa: ${exp.description}\nValor: ${money(exp.amount)}\nPagamento laboratório: ${ref}\nData: ${event.paid_at}\n\nVerifique também se a parcela já está no livro auxiliar ou conciliada manualmente.`))return;
  const id=clinic;
  try{const result=await window.OralCloud.request(url()+'?id=eq.'+encodeURIComponent(exp.id)+'&clinic_id=eq.'+encodeURIComponent(id)+'&external_reference=is.null',{method:'PATCH',headers:{'Prefer':'return=representation'},body:{external_reference:ref}});if(!Array.isArray(result)||result.length!==1)throw Error('Despesa alterada por outro usuário.');suggestLoaded=false;suggestions=[];await load()}catch(err){alert('Falha ao vincular: '+err.message)}
 });
 document.addEventListener('click',async e=>{if(e.target.closest('#nx-exp-load')){try{await load()}catch(err){error=err.message;alert(error)}return;}const b=e.target.closest('[data-nx-exp-pay]');if(!b)return;const x=cache.find(z=>z.id===b.dataset.nxExpPay);if(!x||!admin()||clinic!==window.OralCloud.clinicId)return;const date=prompt('Data do pagamento (AAAA-MM-DD)',today());if(date===null)return;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){alert('Data inválida');return;}const method=prompt('Forma de pagamento (Pix, Dinheiro, Transferência, Cartão, Boleto)', 'Pix');if(!method?.trim())return;if(!confirm(`Confirmar pagamento de ${money(x.amount)}?`))return;const id=clinic;try{await window.OralCloud.request(url()+'?id=eq.'+encodeURIComponent(x.id)+'&clinic_id=eq.'+encodeURIComponent(id)+'&paid_at=is.null',{method:'PATCH',headers:{'Prefer':'return=representation'},body:{paid_at:date,payment_method:method.trim()}});if(window.OralCloud.clinicId===id)await load()}catch(err){alert('Não foi possível registrar pagamento: '+err.message)}});
 document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-nx-exp-link]');if(!b)return;
  const x=cache.find(z=>String(z.id)===b.dataset.nxExpLink);
  if(!x||!admin()||clinic!==window.OralCloud.clinicId)return;
  const ref=prompt('Identificador do pagamento: CP-ID (repasse) ou LABPAY-ID (parcela do laboratório). Deixe vazio para retirar o vínculo. Confira valor e data antes de confirmar.',x.external_reference||'');
  if(ref===null)return;
  const normalized=ref.trim();
  if(normalized&&!/^(?:CP|LABPAY)-[A-Za-z0-9_-]{1,80}$/.test(normalized)){alert('Use CP-ID para repasses ou LABPAY-ID para parcelas laboratoriais.');return;}
  if(normalized&&cache.some(z=>z.id!==x.id&&z.external_reference===normalized)){alert('Este pagamento já está vinculado a outra despesa geral.');return;}
  if(!confirm(normalized?'Vincular esta despesa ao pagamento '+normalized+'? Confira antes o valor e a data do pagamento.':'Remover o vínculo desta despesa?'))return;
  const id=clinic;
  try{const result=await window.OralCloud.request(url()+'?id=eq.'+encodeURIComponent(x.id)+'&clinic_id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{'Prefer':'return=representation'},body:{external_reference:normalized||null}});if(!Array.isArray(result)||result.length!==1)throw Error('Nenhuma despesa atualizada.');if(window.OralCloud.clinicId===id)await load();}catch(err){alert('Falha ao vincular despesa: '+err.message)}
 });
 document.addEventListener('submit',async e=>{if(e.target.id!=='nx-exp-form')return;e.preventDefault();if(!admin())return;const f=e.target,d=Object.fromEntries(new FormData(f));if(!Number.isFinite(Number(d.amount))||Number(d.amount)<=0)return alert('Valor inválido');const id=window.OralCloud.clinicId;try{await window.OralCloud.request(url(),{method:'POST',headers:{'Prefer':'return=representation'},body:{clinic_id:id,description:d.description.trim(),category:d.category,supplier:d.supplier.trim(),amount:Number(d.amount),due_date:d.due_date}});if(window.OralCloud.clinicId===id)await load()}catch(err){alert('Erro ao salvar despesa: '+err.message)}});
 window.addEventListener('nexodent:modules-updated',()=>{loaded=false;cache=[];clinic=null;suggestions=[];suggestLoaded=false});
})();
