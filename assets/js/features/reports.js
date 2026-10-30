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
  if (reportClinic !== id) return false; // Exige reinicialização após troca de clínica
  return true;
 }
 window.addEventListener('nexodent:modules-updated', e => {
  // A atualização de permissões não prova que os dados da nova clínica
  // já foram carregados; não redefinir o contexto de dados aqui.
 });
 const moduleAllowed = key => window.NexoModules?.isAllowed(key) !== false;
 const dateOK=(s,a,b)=>!!s && String(s).slice(0,10)>=a && String(s).slice(0,10)<=b;
 const validDate=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===s;};
 const n=v=>{const value=typeof num==='function'?num(v):Number(v);return Number.isFinite(Number(value))?Number(value):0};
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
  if(type==='finance')return {heads:['Data da venda','Paciente','Procedimento','Venda','Recebido até hoje','Saldo atual'],items:sales.map(v=>[v.data,patient(v.pid),v.proc||'',cash(v.valor),cash(typeof recebido==='function'?recebido(v):0),cash(typeof saldoV==='function'?saldoV(v):0)]),summary:`Vendas realizadas no período: ${cash(salesTotal)} · Recebimentos registrados no período (inclusive de vendas anteriores): ${cash(receivedPeriod)} · Saldo atual das vendas realizadas no período: ${cash(balance)}. As colunas Recebido até hoje e Saldo atual refletem a situação atual de cada venda, não somente os pagamentos do período.`};
  if(type==='dentists')return {heads:['Data','Dentista','Procedimento','Produção','Comissão'],items:sales.map(v=>[v.data,dentist(v.dt),v.proc||'',cash(v.valor),cash(v.rep)]),summary:`Produção: ${cash(sales.reduce((t,v)=>t+n(v.valor),0))} · Comissões geradas: ${cash(sales.reduce((t,v)=>t+n(v.rep),0))}`};
  if(type==='procedures')return {heads:['Procedimento','Quantidade','Valor de vendas'],items:Object.values(sales.reduce((acc,v)=>{const key=v.proc||'Não informado';const x=acc[key]||(acc[key]={name:key,count:0,total:0});x.count++;x.total+=n(v.valor);return acc},{})).sort((x,y)=>y.total-x.total).map(x=>[x.name,x.count,cash(x.total)]),summary:`${sales.length} venda(s) no período`};
  const pts=(db.p||[]).filter(p=>dateOK(p.created_at||p.createdAt||p.dataCadastro||p.data_cadastro,a,b));
  return {heads:['Paciente','Data de cadastro'],items:pts.map(p=>[p.nome||'',String(p.created_at||p.createdAt||p.dataCadastro||p.data_cadastro).slice(0,10)]),summary:`${pts.length} paciente(s) com data de cadastro no período. Cadastros sem data não são contabilizados.`};
 }
 const kinds={finance:'Financeiro',dentists:'Dentistas e comissões',procedures:'Procedimentos',patients:'Novos pacientes'};
 function allowed(type){
  if(!commercial() || !Object.prototype.hasOwnProperty.call(kinds,type))return false;
  if(type==='patients')return can('pac');
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
  if(!validDate(a)||!validDate(b)||a>b)return '<div class="card"><h2>Período inválido</h2><p>Selecione uma data inicial anterior ou igual à final.</p></div>';
  const report=rows(type,a,b);
  return `<div class="ov-page-head"><div><h1>Relatórios</h1><p class="sub">Dados carregados da clínica · somente leitura. Totais podem estar incompletos se o carregamento for parcial.</p></div></div>
  <div class="card" style="display:flex;flex-wrap:wrap;gap:12px;align-items:end">
   <label>Relatório<select id="nx-r-type">${Object.entries(kinds).filter(([k])=>allowed(k)).map(([k,v])=>`<option value="${k}" ${k===type?'selected':''}>${safe(v)}</option>`).join('')}</select></label>
   <label>De<input id="nx-r-from" type="date" value="${safe(a)}"></label><label>Até<input id="nx-r-to" type="date" value="${safe(b)}"></label>
   <button type="button" id="nx-r-apply">Consultar</button><button type="button" class="ghost" id="nx-r-pdf">Imprimir / salvar PDF</button>
  </div><div class="card"><h2>${safe(kinds[type])}</h2><p class="note">${safe(report.summary)}</p><p class="note">${report.items.length} registro(s) · ${safe(a)} a ${safe(b)} · Os valores de comissões representam valores associados às vendas, não necessariamente pagamentos efetuados.</p>
  <div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr>${report.heads.map(x=>`<th style="text-align:left;padding:10px;border-bottom:1px solid #ddd">${safe(x)}</th>`).join('')}</tr></thead><tbody>${report.items.map(r=>`<tr>${r.map(x=>`<td style="padding:9px;border-bottom:1px solid #eee">${safe(x)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${report.heads.length}" style="padding:14px">Nenhum registro encontrado.</td></tr>`}</tbody></table></div></div>`;
 };
 // Reavaliar relatórios já exibidos quando o administrador alterar o plano ou
 // as permissões. Isto é controle de interface; a proteção de dados exige RLS.
 window.addEventListener('nexodent:modules-updated',()=>{
  if(window.view?.h==='reports' && typeof window.render==='function')window.render();
 });
 document.addEventListener('click',e=>{
  const apply=e.target.closest('#nx-r-apply'),pdf=e.target.closest('#nx-r-pdf');if(!apply&&!pdf)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(!clinicReady() || !commercial())return;
  const type=document.getElementById('nx-r-type')?.value;
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
