/* NexoDent 185 — relatórios de leitura, derivados dos dados já autorizados da clínica.
 * A navegação e o controle comercial aqui são apenas de interface. Não são
 * substitutos para RLS / RPC no Supabase. */
(function(){
 'use strict';
 const can = k => typeof pmLvl==='function' && pmLvl(k)>=1;
 const commercial = () => !window.OralCloud?.enabled || window.NexoModules?.isAllowed('reports') === true;
 // Não apresentar/exportar dados de uma clínica após a troca de contexto.
 let reportClinic = null;
 function clinicReady(){
  const id = window.OralCloud?.clinicId;
  if (!window.OralCloud?.enabled) return true;
  if (!id) return false;
  if (reportClinic === null) reportClinic = id;
  if (reportClinic !== id) return false;
  return true;
 }
 window.addEventListener('nexodent:modules-updated', e => {
  // A atualização de permissões não prova que os dados da nova clínica
  // já foram carregados; não redefinir o contexto de dados aqui.
 });
 const moduleAllowed = key => window.NexoModules?.isAllowed(key) !== false;
 const dateOK=(s,a,b)=>!!s && String(s).slice(0,10)>=a && String(s).slice(0,10)<=b;
 const validDate=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===s;};
 const n=v=>typeof num==='function'?num(v):(Number(v)||0);
 const cash=v=>typeof brl==='function'?brl(v):Number(v||0).toFixed(2);
 const safe=v=>typeof esc==='function'?esc(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const patient=id=>typeof pName==='function'?pName(id):'—';
 const dentist=id=>typeof dName==='function'?dName(id):'—';
 const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
 function dates(){const a=document.getElementById('nx-r-from')?.value||view.reportFrom||today().slice(0,7)+'-01';const b=document.getElementById('nx-r-to')?.value||view.reportTo||today();return [a,b]}
 function rows(type,a,b){
  const sales=(db.vd||[]).filter(v=>dateOK(v.data,a,b));
  // Recebimentos do período devem considerar TODAS as vendas carregadas,
  // inclusive as realizadas antes do início do filtro.
  const pay=(db.vd||[]).flatMap(v=>(Array.isArray(v.pg)?v.pg:[]).filter(x=>dateOK(x.data,a,b)).map(x=>({v,x})));
  const receivedPeriod=pay.reduce((t,z)=>t+n(z.x.valor),0);
  const salesTotal=sales.reduce((t,v)=>t+n(v.valor),0);
  const balance=sales.reduce((t,v)=>t+(typeof saldoV==='function'?saldoV(v):0),0);
  if(type==='laboratory'){
   const mirror=window.NexoLabRead;
   const ready=mirror?.loaded && mirror.clinicId===(window.OralCloud?.clinicId||'local');
   const all=ready?mirror.orders||[]:[];
   const items=all.filter(o=>dateOK(o.received_at||o.due_at,a,b));
   const total=items.filter(o=>o.status!=='Cancelado').reduce((sum,o)=>sum+n(o.laboratory_cost),0);
   const missing=items.filter(o=>!o.treatment_id&&o.status!=='Cancelado').length;
   const invalid=items.filter(o=>o.treatment_id&&!((db.p||[]).find(p=>String(p.id)===String(o.patient_id))?.trat||[]).some(t=>String(t.id)===String(o.treatment_id))).length;
   return {heads:['Data referência','Paciente','Laboratório','Trabalho','Situação','Tratamento vinculado','Custo'],items:items.map(o=>[o.received_at||o.due_at||'',patient(o.patient_id),o.laboratory||'',o.work_description||'',o.status||'',o.treatment_id||'Não vinculado',cash(o.laboratory_cost)]),summary:ready?`Custos cadastrados de trabalhos não cancelados: ${cash(total)} · Sem vínculo: ${missing} · Vínculos não encontrados: ${invalid}. Data de referência: recebimento, ou previsão se não recebido. Valores informativos, não representam despesas pagas; NÃO são somados ao caixa.`:'Dados do laboratório ainda não carregados. Clique em “Carregar laboratório” para consultar. Nenhuma despesa é lançada.'};
  }
  if(type==='labledger'){
   const mirror=window.NexoLabRead;
   const ready=mirror?.loaded && mirror.clinicId===(window.OralCloud?.clinicId||'local');
   const all=ready?(mirror.orders||[]):[];
   // Identificador estável por trabalho: editar não cria outra obrigação.
   const active=all.filter(o=>o.status!=='Cancelado' && n(o.laboratory_cost)>0);
   const entries=active.filter(o=>dateOK(o.received_at||o.due_at,a,b));
   const total=entries.reduce((sum,o)=>sum+n(o.laboratory_cost),0);
   const unlinked=entries.filter(o=>!o.treatment_id).length;
   const undated=active.filter(o=>!o.received_at&&!o.due_at).length;
   return {heads:['Identificador da obrigação','Data referência','Paciente','Laboratório','Trabalho','Tratamento','Custo previsto','Situação'],items:entries.map(o=>['LAB-'+o.id,o.received_at||o.due_at,patient(o.patient_id),o.laboratory||'',o.work_description||'',o.treatment_id||'Sem vínculo',cash(o.laboratory_cost),o.status||'']),summary:ready?`Obrigações laboratoriais previstas no período: ${cash(total)} · ${entries.length} trabalho(s) · ${unlinked} sem tratamento vinculado · ${undated} sem data (fora do período). Cada trabalho tem uma única referência LAB-ID. Alterações de custo atualizam a mesma referência. Não são despesas pagas, não movimentam caixa e não devem ser somadas novamente ao custo do tratamento.`:'Carregue o laboratório para consultar obrigações financeiras. Não houve lançamento no caixa.'};
  }
  if(type==='labmatching'){
   const id=window.OralCloud?.clinicId,ready=labEventsClinic===id&&labMatchesClinic===id;
   const entries=ready?labEvents.filter(x=>x.kind!=='opening'&&dateOK(x.paid_at,a,b)):[];
   const matched=entries.filter(x=>labMatches[String(x.id)]?.status==='manual');
   const pending=entries.filter(x=>!labMatches[String(x.id)]||labMatches[String(x.id)].status==='pending');
   return {heads:['Data','Parcela','Trabalho','Valor','Situação','Referência manual'],items:entries.map(x=>{const m=labMatches[String(x.id)];return [x.paid_at,x.id,'LAB-'+x.source_order_id,cash(x.amount),m?.status==='manual'?'Despesa manual conciliada':'Pendente de conferência',m?.manual_reference||'—']}),summary:ready?`Parcelas: ${entries.length} · Conciliadas manualmente: ${matched.length} (${cash(matched.reduce((t,x)=>t+n(x.amount),0))}) · Pendentes: ${pending.length} (${cash(pending.reduce((t,x)=>t+n(x.amount),0))}). Conciliação documental: não lança despesas nem altera o caixa. Saldos de abertura excluídos.`:'Clique em Carregar laboratório para consultar parcelas e conciliações. Nenhuma despesa é lançada.'};
  }
  if(type==='labhistory'){
   const ready=labEventsClinic===window.OralCloud?.clinicId;const items=ready?labEvents.filter(x=>dateOK(x.paid_at,a,b)):[];
   const total=items.reduce((t,x)=>t+n(x.amount),0);
   return {heads:['Identificador','Data','Trabalho','Tipo','Forma','Valor'],items:items.map(x=>[x.id,x.paid_at,'LAB-'+x.source_order_id,x.kind==='opening'?'Saldo anterior':'Pagamento individual',x.payment_method||'—',cash(x.amount)]),summary:ready?`Histórico individual: ${items.length} registro(s), total ${cash(total)} no período. Saldo anterior corresponde a pagamentos já cadastrados antes desta atualização. Os valores NÃO são lançados no caixa automaticamente.`:'Carregue o histórico para consultar pagamentos individuais. Nenhuma despesa foi criada.'};
  }
  if(type==='labreconcile'){
   const id=window.OralCloud?.clinicId, mirror=window.NexoLabRead;
   const ready=mirror?.loaded&&mirror.clinicId===id&&labSettlementClinic===id&&labEventsClinic===id;
   const orders=ready?(mirror.orders||[]).filter(o=>o.status!=='Cancelado'&&dateOK(o.received_at||o.due_at,a,b)):[];
   const items=orders.map(o=>{const cost=n(o.laboratory_cost),p=labPaidForOrder(o.id);return {o,cost,p,balance:Math.max(0,cost-p.paid),excess:Math.max(0,p.paid-cost)}});
   const total=items.reduce((t,x)=>t+x.cost,0),paid=items.reduce((t,x)=>t+x.p.paid,0),pending=items.reduce((t,x)=>t+x.balance,0);
   const excess=items.filter(x=>x.excess>0.009).length;
   return {heads:['Trabalho','Paciente','Laboratório','Custo','Pago (sem duplicar abertura)','Pendente','Diferença a conferir'],items:items.map(x=>['LAB-'+x.o.id,patient(x.o.patient_id),x.o.laboratory||'',cash(x.cost),cash(x.p.paid),cash(x.balance),x.excess>0.009?cash(x.excess):'—']),summary:ready?`Conciliação por trabalho: custo ${cash(total)} · pago ${cash(paid)} · pendente ${cash(pending)} · ${excess} trabalho(s) com pagamento acima do custo. O saldo de abertura do histórico e o pagamento legado são a MESMA origem e contam uma única vez. Valores de controle: NÃO geram despesas no caixa.`:'Clique em Carregar laboratório para consultar os dados. Nenhum lançamento financeiro foi criado.'};
  }
  if(type==='labexpenses'){
   const ready=labExpenseClinic===window.OralCloud?.clinicId;
   const items=ready?labExpenseRows.filter(x=>dateOK(x.paid_at,a,b)):[];
   const total=items.reduce((t,x)=>t+n(x.amount),0);
   return {heads:['Referência da parcela','Data','Paciente','Laboratório','Trabalho','Forma','Saída efetiva'],items:items.map(x=>[x.source_reference,x.paid_at,patient(x.patient_id),x.laboratory||'',x.work_description||'',x.payment_method||'',cash(x.amount)]),summary:ready?`Pagamentos individuais após implantação do histórico: ${cash(total)} · ${items.length} parcela(s) no período. Cada parcela aparece uma vez pelo seu ID. Saldos antigos (opening) são excluídos para não duplicar pagamentos históricos. Este é um razão auxiliar de saídas laboratoriais; NÃO foi inserido no caixa geral nem reconciliado com despesas manuais.`:'Clique em “Carregar laboratório” para consultar as saídas efetivas por parcela. Nenhum lançamento foi criado no caixa geral.'};
  }
  if(type==='labpayments')return {heads:['Informação'],items:[],summary:'Controle de pagamentos: utilize o painel interativo no relatório.'};
  if(type==='labcash'){
   const id=window.OralCloud?.clinicId;
   const ready=labCashClinic===id;
   const items=ready?labCashRows.filter(x=>dateOK(x.paid_at,a,b)):[];
   const total=items.reduce((t,x)=>t+n(x.paid_amount),0);
   const noDate=ready?labCashRows.filter(x=>n(x.paid_amount)>0&&!x.paid_at).length:0;
   return {heads:['Referência única','Data de pagamento','Paciente','Laboratório','Trabalho','Forma','Valor pago'],items:items.map(x=>[x.source_reference,x.paid_at,patient(x.patient_id),x.laboratory||'',x.work_description||'',x.payment_method||'',cash(x.paid_amount)]),summary:ready?`Saídas laboratoriais conciliadas no período: ${cash(total)} · ${items.length} registro(s) · ${noDate} sem data. Valores derivados dos pagamentos laboratoriais registrados, sem lançamentos duplicados. NÃO somar novamente a despesas manuais existentes. Não representa extrato bancário.`:'Clique em “Carregar pagamentos” para consultar os pagamentos laboratoriais. Nenhum lançamento foi criado.'};
  }
  if(type==='cashflow'){
   const id=window.OralCloud?.clinicId;
   const loaded=labExpenseClinic===id;
   const income=pay.filter(z=>n(z.x.valor)>0).map(z=>({date:z.x.data||'',kind:'Entrada · paciente',ref:String(z.v.id||''),description:patient(z.v.pid)+' — '+(z.v.proc||'Atendimento'),amount:n(z.x.valor)}));
   const expense=loaded?labExpenseRows.filter(x=>dateOK(x.paid_at,a,b)&&n(x.amount)>0).map(x=>({date:x.paid_at||'',kind:'Saída · laboratório',ref:x.source_reference||'',description:(x.laboratory||'Laboratório')+' — '+patient(x.patient_id),amount:-n(x.amount)})):[];
   const combined=[...income,...expense].sort((x,y)=>String(x.date).localeCompare(String(y.date))||x.kind.localeCompare(y.kind));
   const entradas=income.reduce((t,x)=>t+x.amount,0),saidas=expense.reduce((t,x)=>t-x.amount,0);
   return {heads:['Data','Tipo','Referência','Descrição','Entrada','Saída'],items:combined.map(x=>[x.date,x.kind,x.ref,x.description,x.amount>0?cash(x.amount):'—',x.amount<0?cash(-x.amount):'—']),summary:loaded?`Entradas registradas: ${cash(entradas)} · Pagamentos laboratoriais individuais: ${cash(saidas)} · Diferença parcial: ${cash(entradas-saidas)}. NÃO representa saldo bancário ou lucro: outras despesas, taxas e repasses não estão incluídos. Pagamentos antigos (opening) são excluídos. Nenhum lançamento é criado ou duplicado.`:'Carregue as parcelas do laboratório para incluir saídas. Entradas dos pacientes já carregadas: '+cash(entradas)+'. Resultado incompleto até carregar o laboratório.'};
  }
  if(type==='finance')return {heads:['Data da venda','Paciente','Procedimento','Venda','Recebido até hoje','Saldo atual'],items:sales.map(v=>[v.data,patient(v.pid),v.proc||'',cash(v.valor),cash(typeof recebido==='function'?recebido(v):0),cash(typeof saldoV==='function'?saldoV(v):0)]),summary:`Vendas realizadas no período: ${cash(salesTotal)} · Recebimentos registrados no período (inclusive de vendas anteriores): ${cash(receivedPeriod)} · Saldo atual das vendas realizadas no período: ${cash(balance)}. As colunas Recebido até hoje e Saldo atual refletem a situação atual de cada venda, não somente os pagamentos do período.`};
  if(type==='dentists')return {heads:['Data','Dentista','Procedimento','Produção','Comissão'],items:sales.map(v=>[v.data,dentist(v.dt),v.proc||'',cash(v.valor),cash(v.rep)]),summary:`Produção: ${cash(sales.reduce((t,v)=>t+n(v.valor),0))} · Comissões geradas: ${cash(sales.reduce((t,v)=>t+n(v.rep),0))}`};
  if(type==='procedures')return {heads:['Procedimento','Quantidade','Valor de vendas'],items:Object.values(sales.reduce((acc,v)=>{const key=v.proc||'Não informado';const x=acc[key]||(acc[key]={name:key,count:0,total:0});x.count++;x.total+=n(v.valor);return acc},{})).sort((x,y)=>y.total-x.total).map(x=>[x.name,x.count,cash(x.total)]),summary:`${sales.length} venda(s) no período`};
  const pts=(db.p||[]).filter(p=>dateOK(p.created_at||p.createdAt||p.dataCadastro||p.data_cadastro,a,b));
  return {heads:['Paciente','Data de cadastro'],items:pts.map(p=>[p.nome||'',String(p.created_at||p.createdAt||p.dataCadastro||p.data_cadastro).slice(0,10)]),summary:`${pts.length} paciente(s) com data de cadastro no período. Cadastros sem data não são contabilizados.`};
 }
 // Pagamentos laboratoriais: persistidos por referência única do trabalho, sem movimentar o caixa.
 let labSettlements={}; let labSettlementClinic=null; let labSettlementError='';
 let labMatches={};let labMatchesClinic=null;let labMatchesError='';
 async function loadLabMatches(){
  const id=window.OralCloud?.clinicId;if(!id||!allowed('labmatching'))throw Error('Sem acesso à conciliação.');
  labMatchesClinic=null;labMatches={};labMatchesError='';
  try{const r=await window.OralCloud.request('/rest/v1/rpc/nexodent_lab_cash_match_list',{method:'POST',body:{p_clinic:id}});
   if(window.OralCloud?.clinicId!==id)throw Error('Clínica alterada durante consulta.');
   for(const x of Array.isArray(r)?r:[])labMatches[String(x.event_id)]=x;
   labMatchesClinic=id;
  }catch(e){labMatchesError=e.message||String(e);throw e;}
 }
 async function markLabMatch(eventId){
  const id=window.OralCloud?.clinicId;
  if(!labWritable()||!allowed('labmatching')||labEventsClinic!==id||labMatchesClinic!==id)throw Error('Sem permissão ou dados desatualizados.');
  const event=labEvents.find(x=>String(x.id)===eventId&&x.kind!=='opening');if(!event)throw Error('Parcela inválida.');
  const current=labMatches[eventId];
  const reference=prompt('Referência da despesa JÁ cadastrada manualmente no caixa (número ou identificador). Deixe em branco para marcar como pendente:',current?.manual_reference||'');
  if(reference===null)return;
  const status=reference.trim()?'manual':'pending';
  if(!confirm(status==='manual'?'Vincular esta parcela à despesa manual '+reference.trim()+'? Nenhum lançamento será criado.':'Marcar parcela como pendente de conciliação?'))return;
  await window.OralCloud.request('/rest/v1/rpc/nexodent_lab_cash_match_set',{method:'POST',body:{p_clinic:id,p_event:eventId,p_status:status,p_reference:reference.trim()||null}});
  if(window.OralCloud?.clinicId!==id)return;
  await loadLabMatches();if(window.view?.h==='reports')window.render();
 }
 let labCashRows=[]; let labCashClinic=null; let labCashError='';
 let labEvents=[];let labEventsClinic=null;let labEventsError='';
 let labExpenseRows=[];let labExpenseClinic=null;let labExpenseError='';
 async function loadLabExpenses(){
  if(!allowed('labexpenses'))throw Error('Sem permissão para consultar saídas laboratoriais.');
  const id=window.OralCloud?.clinicId;if(!id)throw Error('Selecione uma clínica.');
  labExpenseClinic=null;labExpenseRows=[];labExpenseError='';
  try{
   const r=await window.OralCloud.request('/rest/v1/nexodent_lab_expense_ledger?select=source_reference,source_order_id,patient_id,laboratory,work_description,amount,paid_at,payment_method&clinic_id=eq.'+encodeURIComponent(id)+'&order=paid_at.desc&limit=5000');
   if(window.OralCloud?.clinicId!==id)throw Error('Clínica alterada durante a consulta.');
   labExpenseRows=Array.isArray(r)?r:[];labExpenseClinic=id;
  }catch(e){labExpenseError=e.message||String(e);throw e;}
 }

 async function loadLabEvents(){
  const id=window.OralCloud?.clinicId;if(!id||!allowed('labhistory'))throw Error('Sem acesso ao histórico.');
  labEventsClinic=null;labEvents=[];labEventsError='';
  try{const r=await window.OralCloud.request('/rest/v1/nexodent_lab_payment_events?select=id,source_order_id,amount,paid_at,payment_method,created_at,kind&clinic_id=eq.'+encodeURIComponent(id)+'&order=paid_at.desc&limit=5000');
   if(window.OralCloud?.clinicId!==id)throw Error('Clínica alterada durante a consulta.');
   labEvents=Array.isArray(r)?r:[];labEventsClinic=id;
  }catch(e){labEventsError=e.message||String(e);throw e;}
 }
 async function addLabEvent(orderId){
  if(!labWritable()||!allowed('labhistory'))throw Error('Sem permissão de edição.');
  const id=window.OralCloud.clinicId;const mirror=window.NexoLabRead;
  if(!mirror?.loaded||mirror.clinicId!==id||labEventsClinic!==id)throw Error('Carregue os dados do laboratório e o histórico antes de registrar.');
  const order=(mirror.orders||[]).find(o=>String(o.id)===String(orderId));
  if(!order||order.status==='Cancelado')throw Error('Trabalho cancelado ou inexistente.');
  const amount=Number(document.getElementById('nx-lab-new-amount-'+orderId)?.value);
  const date=document.getElementById('nx-lab-new-date-'+orderId)?.value;
  const method=document.getElementById('nx-lab-new-method-'+orderId)?.value;
  const events=labEvents.filter(x=>String(x.source_order_id)===String(orderId));
  const remaining=Math.max(0,n(order.laboratory_cost)-labPaidForOrder(orderId).paid);
  if(!Number.isFinite(amount)||amount<=0||Math.round(amount*100)>Math.round(remaining*100))throw Error('Informe um valor positivo até '+cash(remaining)+'.');
  if(!validDate(date)||!method)throw Error('Informe data e forma de pagamento.');
  if(!confirm('Registrar novo pagamento de '+cash(amount)+'? Esta operação cria histórico individual, mas NÃO lança despesa no caixa.'))return;
  await window.OralCloud.request('/rest/v1/rpc/nexodent_add_lab_payment_event',{method:'POST',body:{p_clinic:id,p_order_id:String(orderId),p_amount:amount,p_paid_at:date,p_method:method}});
  if(window.OralCloud.clinicId!==id)return;await loadLabEvents();if(window.view?.h==='reports')window.render();
 }
 async function loadLabCash(){
  if(!allowed('labcash'))throw Error('Acesso não autorizado.');
  const id=window.OralCloud?.clinicId;
  labCashClinic=null;labCashRows=[];labCashError='';
  try{
   const data=await window.OralCloud.request('/rest/v1/nexodent_lab_cash_reconciliation?select=source_reference,source_order_id,patient_id,laboratory,work_description,paid_amount,paid_at,payment_method&clinic_id=eq.'+encodeURIComponent(id)+'&limit=5000');
   if(window.OralCloud.clinicId!==id)throw Error('Clínica alterada durante a consulta.');
   labCashRows=Array.isArray(data)?data:[];labCashClinic=id;
  }catch(e){labCashError=e.message||String(e);throw e;}
 }

 // Conciliação: o evento de abertura representa o saldo legado, não uma segunda parcela.
 function labPaidForOrder(orderId){
  const events=labEvents.filter(e=>String(e.source_order_id)===String(orderId));
  const opening=events.filter(e=>e.kind==='opening').reduce((t,e)=>t+n(e.amount),0);
  const installments=events.filter(e=>e.kind!=='opening').reduce((t,e)=>t+n(e.amount),0);
  const legacy=n(labSettlements[String(orderId)]?.paid_amount);
  return {paid:Math.max(legacy,opening)+installments,opening:Math.max(legacy,opening),installments,hasOpening:opening>0&&legacy>0};
 }
 const labWritable=()=>!!window.OralCloud?.enabled && !!window.OralCloud?.clinicId && can('vd') && typeof pmLvl==='function' && pmLvl('vd')>=2;
 async function loadLabSettlements(){
  if(!labWritable())throw Error('É necessário acesso de edição ao financeiro e conexão Supabase.');
  const id=window.OralCloud.clinicId;
  labSettlementClinic=null;labSettlements={};labSettlementError='';
  try{
   const result=await window.OralCloud.request('/rest/v1/nexodent_lab_settlements?select=source_order_id,paid_amount,paid_at,payment_method,notes&clinic_id=eq.'+encodeURIComponent(id)+'&limit=1000');
   if(window.OralCloud.clinicId!==id)throw Error('A clínica foi alterada.');
   labSettlements=Object.fromEntries((result||[]).map(x=>[String(x.source_order_id),x]));labSettlementClinic=id;
  }catch(e){labSettlementError=e.message||String(e);throw e;}
 }
 async function settleLab(orderId){
  if(!labWritable()||!allowed('labpayments'))throw Error('Acesso não autorizado.');
  const id=window.OralCloud.clinicId;
  if(labSettlementClinic!==id)throw Error('Carregue os pagamentos desta clínica antes de editar.');
  const mirror=window.NexoLabRead;
  const order=mirror?.clinicId===id&&mirror.loaded?(mirror.orders||[]).find(o=>String(o.id)===String(orderId)):null;
  if(!order||order.status==='Cancelado'||n(order.laboratory_cost)<=0)throw Error('Trabalho inválido ou cancelado.');
  const amount=document.getElementById('nx-lab-amount-'+orderId)?.value;
  const date=document.getElementById('nx-lab-date-'+orderId)?.value;
  const method=document.getElementById('nx-lab-method-'+orderId)?.value?.trim()||'';
  const paid=Number(amount);
  if(!Number.isFinite(paid)||paid<0||paid>n(order.laboratory_cost))throw Error('Valor pago deve estar entre zero e o custo atual.');
  if(paid>0&&(!validDate(date)||!method))throw Error('Informe data válida e forma de pagamento.');
  const confirmed=confirm(`Confirmar registro de ${cash(paid)} pago ao laboratório?\nEsse registro NÃO movimentará automaticamente o caixa.`);
  if(!confirmed)return;
  await window.OralCloud.request('/rest/v1/rpc/nexodent_set_lab_payment',{method:'POST',body:{p_clinic:id,p_order_id:String(orderId),p_amount:paid,p_paid_at:paid?date:null,p_method:paid?method:null}});
  if(window.OralCloud.clinicId!==id)return;
  await loadLabSettlements();await loadLabEvents();if(window.view?.h==='reports')window.render();
 }
 function labPaymentHtml(a,b){
  const id=window.OralCloud?.clinicId;
  const mirror=window.NexoLabRead;
  const loaded=mirror?.loaded&&mirror.clinicId===id;
  const paidLoaded=labSettlementClinic===id;
  const orders=loaded?(mirror.orders||[]).filter(o=>o.status!=='Cancelado'&&n(o.laboratory_cost)>0&&dateOK(o.received_at||o.due_at,a,b)):[];
  const total=orders.reduce((v,o)=>v+n(o.laboratory_cost),0);
  const eventsLoaded=labEventsClinic===id;
  const paid=paidLoaded?orders.reduce((v,o)=>v+(eventsLoaded?labPaidForOrder(o.id).paid:0),0):0;
  const ready=loaded&&paidLoaded&&eventsLoaded;
  const lines=ready?orders.map(o=>{
   const st=labSettlements[String(o.id)]||{};
   const amount=labPaidForOrder(o.id).paid;const cost=n(o.laboratory_cost);
   const editable=labWritable();
   return `<tr><td>${safe('LAB-'+o.id)}</td><td>${safe(patient(o.patient_id))}</td><td>${safe(o.laboratory||'')}</td><td>${safe(o.work_description||'')}</td><td>${safe(cash(cost))}</td><td>${safe(cash(amount))}</td><td>${safe(cash(Math.max(0,cost-amount)))}</td><td>${editable?`<input style="width:100px" id="nx-lab-new-amount-${safe(o.id)}" type="number" min="0.01" max="${Math.max(0,cost-amount)}" step="0.01" placeholder="Nova parcela"><input id="nx-lab-new-date-${safe(o.id)}" type="date" value="${today()}"><select id="nx-lab-new-method-${safe(o.id)}">${['','Pix','Dinheiro','Transferência','Cartão','Boleto','Outro'].map(m=>`<option value="${m}">${m||'Forma'}</option>`).join('')}</select><button data-nx-lab-add="${safe(o.id)}" ${cost-amount<0.01?'disabled':''}>Registrar parcela</button>`:'Somente consulta'}</td></tr>`;
  }).join(''):'';
  return `<div class="card"><h2>Controle de pagamentos aos laboratórios</h2><p class="note">${ready?`Custo previsto: ${cash(total)} · Pago: ${cash(paid)} · Pendente: ${cash(Math.max(0,total-paid))}`:'Carregue os trabalhos e os pagamentos para consultar os valores.'} Cada parcela nova gera um registro individual. Pagamentos anteriores permanecem no controle legado e não são lançados novamente. Nenhum pagamento movimenta automaticamente o caixa. Não cadastre novamente como despesa sem conciliação.</p>${labSettlementError?`<p class="note">Erro: ${safe(labSettlementError)}</p>`:''}<button type="button" id="nx-lab-refresh">Carregar trabalhos e pagamentos</button><div style="overflow:auto"><table style="width:100%"><thead><tr>${['Referência','Paciente','Laboratório','Trabalho','Custo','Pago','Pendente','Pagamento'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${lines||'<tr><td colspan="8">Nenhum registro carregado no período.</td></tr>'}</tbody></table></div></div>`;
 }
 const kinds={labmatching:'Conciliação de parcelas com despesas manuais',cashflow:'Fluxo financeiro integrado (parcial)',labexpenses:'Razão auxiliar de saídas laboratoriais',labreconcile:'Conferência de custos e parcelas laboratoriais',labhistory:'Histórico individual de pagamentos laboratoriais',labcash:'Conciliação de saídas laboratoriais',labpayments:'Pagamentos aos laboratórios',finance:'Financeiro',dentists:'Dentistas e comissões',procedures:'Procedimentos',patients:'Novos pacientes',laboratory:'Custos do laboratório',labledger:'Obrigações laboratoriais'};
 function allowed(type){
  if(!commercial() || !Object.prototype.hasOwnProperty.call(kinds,type))return false;
  if(type==='patients')return can('pac');
  if(type==='labreconcile')return moduleAllowed('finance') && can('vd') && can('pac') && !!window.OralCloud?.enabled;
  if(type==='labmatching')return moduleAllowed('finance') && can('vd') && can('pac') && !!window.OralCloud?.enabled && labWritable();
  if(type==='cashflow')return moduleAllowed('finance') && can('vd') && can('pac') && !!window.OralCloud?.enabled;
  if(type==='labexpenses')return moduleAllowed('finance') && can('vd') && can('pac') && !!window.OralCloud?.enabled;
  if(type==='labhistory')return moduleAllowed('finance') && can('vd') && can('pac') && !!window.OralCloud?.enabled;
  if(type==='labcash')return moduleAllowed('finance') && can('vd') && can('pac') && !!window.OralCloud?.enabled;
  if(type==='labreconcile'){
   const id=window.OralCloud?.clinicId, mirror=window.NexoLabRead;
   const ready=mirror?.loaded&&mirror.clinicId===id&&labSettlementClinic===id&&labEventsClinic===id;
   const orders=ready?(mirror.orders||[]).filter(o=>o.status!=='Cancelado'&&dateOK(o.received_at||o.due_at,a,b)):[];
   const items=orders.map(o=>{const cost=n(o.laboratory_cost),p=labPaidForOrder(o.id);return {o,cost,p,balance:Math.max(0,cost-p.paid),excess:Math.max(0,p.paid-cost)}});
   const total=items.reduce((t,x)=>t+x.cost,0),paid=items.reduce((t,x)=>t+x.p.paid,0),pending=items.reduce((t,x)=>t+x.balance,0);
   const excess=items.filter(x=>x.excess>0.009).length;
   return {heads:['Trabalho','Paciente','Laboratório','Custo','Pago (sem duplicar abertura)','Pendente','Diferença a conferir'],items:items.map(x=>['LAB-'+x.o.id,patient(x.o.patient_id),x.o.laboratory||'',cash(x.cost),cash(x.p.paid),cash(x.balance),x.excess>0.009?cash(x.excess):'—']),summary:ready?`Conciliação por trabalho: custo ${cash(total)} · pago ${cash(paid)} · pendente ${cash(pending)} · ${excess} trabalho(s) com pagamento acima do custo. O saldo de abertura do histórico e o pagamento legado são a MESMA origem e contam uma única vez. Valores de controle: NÃO geram despesas no caixa.`:'Clique em Carregar laboratório para consultar os dados. Nenhum lançamento financeiro foi criado.'};
  }
  if(type==='labpayments')return moduleAllowed('finance') && can('vd') && can('pac') && !!window.OralCloud?.enabled && typeof window.NexoLabLoad==='function';
  if(type==='laboratory'||type==='labledger')return moduleAllowed('finance') && can('vd') && can('pac') && typeof window.NexoLabLoad==='function';
  if(type==='dentists')return moduleAllowed('finance') && moduleAllowed('commissions') && can('vd') && can('cm');
  return moduleAllowed('finance') && can('vd');
 }
 function current(){let type=view.reportType||'finance';if(!allowed(type))type=Object.keys(kinds).find(allowed);return type}
 window.nexoReportsHtml=function(){
  if(!clinicReady())return '<div class="card"><h2>Relatórios temporariamente indisponíveis</h2><p>Recarregue os dados da clínica selecionada antes de consultar relatórios.</p></div>';
  if(!commercial())return '<div class="card"><h2>Relatórios indisponíveis</h2><p>Este módulo não está incluído no plano da clínica.</p></div>';
  const type=current();if(!type)return '<div class="card"><h2>Sem acesso aos relatórios</h2><p>Solicite ao administrador as permissões necessárias.</p></div>';
  view.reportType=type;
  const [a,b]=[view.reportFrom||today().slice(0,7)+'-01',view.reportTo||today()];
  const report=rows(type,a,b);
  return `<div class="ov-page-head"><div><h1>Relatórios</h1><p class="sub">Dados carregados da clínica · somente leitura. Totais podem estar incompletos se o carregamento for parcial.</p></div></div>
  <div class="card" style="display:flex;flex-wrap:wrap;gap:12px;align-items:end">
   <label>Relatório<select id="nx-r-type">${Object.entries(kinds).filter(([k])=>allowed(k)).map(([k,v])=>`<option value="${k}" ${k===type?'selected':''}>${safe(v)}</option>`).join('')}</select></label>
   <label>De<input id="nx-r-from" type="date" value="${safe(a)}"></label><label>Até<input id="nx-r-to" type="date" value="${safe(b)}"></label>
   <button type="button" id="nx-r-apply">Consultar</button>${(type==='laboratory'||type==='labledger'||type==='labpayments'||type==='labcash'||type==='labhistory'||type==='labreconcile'||type==='labexpenses'||type==='cashflow'||type==='labmatching')?'<button type="button" class="ghost" id="nx-r-load-lab">Carregar laboratório</button>':''}<button type="button" class="ghost" id="nx-r-pdf">Imprimir / salvar PDF</button>
  </div>${type==='labmatching'&&labMatchesError?`<p class="note">Erro: ${safe(labMatchesError)}</p>`:''}${type==='labexpenses'&&labExpenseError?`<p class="note">${safe(labExpenseError)}</p>`:''}${type==='labcash'&&labCashError?`<p class="note">${safe(labCashError)}</p>`:''}${type==='labpayments'?labPaymentHtml(a,b):`<div class="card"><h2>${safe(kinds[type])}</h2><p class="note">${safe(report.summary)}</p><p class="note">${report.items.length} registro(s) · ${safe(a)} a ${safe(b)} · Os valores de comissões representam valores associados às vendas, não necessariamente pagamentos efetuados.</p>
  <div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr>${report.heads.map(x=>`<th style="text-align:left;padding:10px;border-bottom:1px solid #ddd">${safe(x)}</th>`).join('')}</tr></thead><tbody>${report.items.map(r=>`<tr>${r.map(x=>`<td style="padding:9px;border-bottom:1px solid #eee">${safe(x)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${report.heads.length}" style="padding:14px">Nenhum registro encontrado.</td></tr>`}</tbody></table></div>${type==='labmatching'&&labMatchesClinic===window.OralCloud?.clinicId?`<p class="note">Para vincular uma parcela a uma despesa manual existente, use o botão correspondente. Referências repetidas são bloqueadas no Supabase.</p>${labEvents.filter(x=>x.kind!=='opening'&&dateOK(x.paid_at,a,b)).map(x=>`<button type="button" data-nx-match="${safe(x.id)}" style="margin:4px">Conciliar ${safe(String(x.id).slice(0,8))} · ${safe(cash(x.amount))}</button>`).join('')}`:''}</div>`}`;
 };
 // Reavaliar relatórios já exibidos quando o administrador alterar o plano ou
 // as permissões. Isto é controle de interface; a proteção de dados exige RLS.
 window.addEventListener('nexodent:modules-updated',()=>{
  if(window.view?.h==='reports' && typeof window.render==='function')window.render();
 });
 document.addEventListener('click',async e=>{
  const match=e.target.closest('[data-nx-match]');if(match){e.preventDefault();e.stopImmediatePropagation();match.disabled=true;try{await markLabMatch(match.getAttribute('data-nx-match'));}catch(err){alert('Conciliação: '+(err.message||err));match.disabled=false;}return;}
  const refresh=e.target.closest('#nx-lab-refresh');const save=e.target.closest('[data-nx-lab-add]');
  if(!refresh&&!save)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(!clinicReady()||!allowed('labpayments'))return;
  const btn=refresh||save;btn.disabled=true;
  try{if(refresh){await window.NexoLabLoad(true);await loadLabSettlements();await loadLabEvents();if(window.view?.h==='reports')window.render();}
   else await addLabEvent(save.getAttribute('data-nx-lab-add'));
  }catch(err){alert('Laboratório: '+(err.message||err));btn.disabled=false;}
 },true);
 document.addEventListener('click',e=>{
  const apply=e.target.closest('#nx-r-apply'),pdf=e.target.closest('#nx-r-pdf'),load=e.target.closest('#nx-r-load-lab');if(!apply&&!pdf&&!load)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(!clinicReady() || !commercial())return;
  const type=document.getElementById('nx-r-type')?.value;
  if(load){if(!allowed(type))return;load.disabled=true;Promise.resolve(type==='labmatching'?Promise.all([loadLabEvents(),loadLabMatches()]):(type==='labexpenses'||type==='cashflow')?loadLabExpenses():type==='labcash'?loadLabCash():type==='labhistory'?loadLabEvents():window.NexoLabLoad(true)).then(()=>(type==='labpayments'||type==='labreconcile')?Promise.all([loadLabSettlements(),loadLabEvents()]):null).then(()=>render()).catch(err=>{alert('Falha ao carregar laboratório: '+(err.message||err));load.disabled=false});return;}
  if(!allowed(type))return;
  const [a,b]=dates();if(!validDate(a)||!validDate(b)||a>b){alert('Informe um período válido, com a data inicial anterior ou igual à final.');return}
  view.reportType=type;view.reportFrom=a;view.reportTo=b;
  if(apply){render();return}
  // Revalidar contexto e permissões imediatamente antes de exportar.
  if(!clinicReady() || !allowed(type))return;
  const r=rows(type,a,b);
  const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>${safe(kinds[type])}</title><style>body{font:12px Arial;margin:24px;color:#222}h1{color:#bd6000}table{border-collapse:collapse;width:100%}th,td{padding:7px;text-align:left;border-bottom:1px solid #ddd}th{background:#f2eee9}@page{size:A4 landscape;margin:12mm}</style><h1>NexoDent — ${safe(kinds[type])}</h1><p>Período: ${safe(a)} a ${safe(b)} · Dados carregados no navegador; podem estar incompletos.</p><p>${safe(r.summary)}</p><table><thead><tr>${r.heads.map(h=>`<th>${safe(h)}</th>`).join('')}</tr></thead><tbody>${r.items.map(row=>`<tr>${row.map(v=>`<td>${safe(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></html>`;
  const w=window.open('','_blank');if(!w){alert('Permita janelas pop-up para imprimir o relatório.');return}w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),400);
 },true);
})();
