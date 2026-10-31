/* ===== Tratamento por dente: unificado ou individual + vários procedimentos no mesmo orçamento ===== */
const ttSel=()=>(view.trSel||[]).map(String).sort((a,b)=>a-b);
const ttUni=()=>ttSel().length>=2&&(view.trMode||'uni')==='uni';
const ttBasket=()=>view.trBasket=view.trBasket||[];
const ttLineTot=l=>l.mult?r2(l.unit*l.q):r2(l.unit);
function ttCur(){
  const sel=ttSel();
  if(ttUni()){const u=view.trUni||{},un=num(u.val);return u.mult!==false?r2(un*sel.length):un}
  const td=view.trTd||{};return sel.reduce((a,n)=>a+num((td[n]||{}).val),0);
}
const ttGrand=()=>r2(ttBasket().reduce((a,l)=>a+ttLineTot(l),0)+ttCur());
function ttCalcHtml(){
  const n=ttSel().length,u=view.trUni||{},un=num(u.val);
  return u.mult!==false?`${brl(un)} × ${n} dentes = <b>${brl(r2(un*n))}</b>`:`Valor único para os ${n} dentes: <b>${brl(un)}</b>`;
}
function trBarInner(){const on=view.trForm||(view.trSel||[]).length||ttBasket().length;return `${on?'Salvar tratamento':'Adicionar Tratamento'}<span class="pl">${on?'✓':'+'}</span>`}
const ttProcOpts=cur=>'<option value="">Selecione o tratamento</option>'+db.pr.map(x=>`<option value="${esc(x.nome)}"${cur===x.nome?' selected':''}>${esc(x.nome)} · ${brl(x.preco||0)}</option>`).join('');
function ttPanelHtml(p){
  const sel=ttSel();
  if(!sel.length)return '';
  const td=view.trTd=view.trTd||{},uni=ttUni();
  const mode=sel.length>=2?`<div class="tt-mode"><button type="button" class="sm${uni?'':' ghost'}" data-act="ttmode" data-m="uni">Um tratamento para todos</button><button type="button" class="sm${uni?' ghost':''}" data-act="ttmode" data-m="ind">Um por dente</button></div>`:'';
  let body='';
  if(uni){
    const u=view.trUni=view.trUni||{proc:'',val:'',obs:'',mult:true},mult=u.mult!==false;
    body=`<div class="tt-row"><div class="tt-head"><strong>Dentes ${sel.join(', ')}</strong><span class="badge stt-wr">${sel.length} dentes</span></div>
    <label>Tratamento</label><select data-tu="1" data-f="proc">${ttProcOpts(u.proc)}</select>
    <label>O que precisa ser feito</label><textarea data-tu="1" data-f="obs" placeholder="Ex.: restauração em resina nos dentes selecionados" style="min-height:56px">${esc(u.obs)}</textarea>
    <label>${mult?'Valor unitário (por dente) (R$)':'Valor do tratamento (R$)'}</label><input data-tu="1" data-f="val" inputmode="decimal" placeholder="R$ 0,00" value="${esc(u.val)}">
    <label class="tt-chk"><input type="checkbox" data-tu="1" data-f="mult"${mult?' checked':''}> Multiplicar pela quantidade de dentes (${sel.length})</label>
    <div class="tt-calc" id="ttcalc">${ttCalcHtml()}</div></div>`;
  }else{
    const all=sel.length>1?`<label for="ttall" style="margin-top:0">Mesmo tratamento para todos os dentes (opcional)</label><select id="ttall">${ttProcOpts('')}</select>`:'';
    body=all+sel.map(n=>{const d=td[n]=td[n]||{proc:'',val:'',obs:''};
    return `<div class="tt-row" data-ttrow="${n}"><div class="tt-head"><strong>Dente ${n}</strong><button type="button" class="ghost sm" data-act="ttrm" data-n="${n}" aria-label="Remover dente ${n}">✕</button></div>
    <label>Tratamento</label><select data-tt="${n}" data-f="proc">${ttProcOpts(d.proc)}</select>
    <label>O que precisa ser feito</label><textarea data-tt="${n}" data-f="obs" placeholder="Ex.: restauração em resina na face oclusal" style="min-height:56px">${esc(d.obs)}</textarea>
    <label>Valor (R$)</label><input data-tt="${n}" data-f="val" inputmode="decimal" placeholder="R$ 0,00" value="${esc(d.val)}"></div>`}).join('');
  }
  return `<div class="tt-panel"><h3 style="margin:0 0 4px">${uni?'Tratamento unificado':'Tratamento por dente'}</h3><p class="note" style="margin:0 0 8px">${uni?'Os dentes selecionados entram juntos em um único tratamento. Informe o valor unitário e escolha se ele será multiplicado pela quantidade de dentes.':'Escolha o tratamento, descreva o que será feito e informe o valor de cada dente selecionado.'}</p>${mode}${body}
  <button type="button" class="ghost" data-act="ttmore" style="width:100%;margin-top:12px">＋ Adicionar outro procedimento neste orçamento</button></div>`;
}
function ttBasketHtml(p){
  const l=ttBasket();if(!l.length)return '';
  return `<div class="tt-panel"><h3 style="margin:0 0 4px">Procedimentos deste orçamento (${l.length})</h3><p class="note" style="margin:0 0 6px">Estes procedimentos serão salvos juntos na mesma proposta e sairão na mesma folha da impressão.</p>${l.map((x,ix)=>`<div class="tt-row pr-card"><div class="tt-head pr-head"><span class="pr-av" aria-hidden="true">${ix+1}</span><div class="pr-nm">${esc(x.proc)}</div><button type="button" class="ghost sm" data-act="ttbrm" data-id="${x.id}" aria-label="Remover procedimento">✕</button></div><div class="note" style="margin:4px 0 0">${x.dente?esc(dLab(x.dente)+' '+x.dente):'Geral'}${x.obs?' · '+esc(x.obs):''}</div><div style="margin-top:6px;font-weight:600">${x.mult&&x.q>1?brl(x.unit)+' × '+x.q+' dentes = ':''}${brl(ttLineTot(x))}</div></div>`).join('')}</div>`;
}
function ttSharedHtml(p){
  const sel=ttSel(),bk=ttBasket();
  if(!sel.length&&!bk.length)return '';
  const sh=view.trSh=view.trSh||{};
  const orcOpts=p.orcs.filter(o=>o.status!=='Recusado');
  const defOr=sh.or!==undefined?sh.or:(orcOpts[0]?orcOpts[0].id:'new'),so=v=>defOr===v?' selected':'';
  const nProc=bk.length+(sel.length?(ttUni()?1:sel.length):0);
  return `<div class="tt-panel">${sel.length?'':'<p class="note" style="margin:0 0 8px">Selecione no odontograma os dentes de outro procedimento para incluir neste orçamento, ou toque em Salvar tratamento.</p>'}
  <div class="row" style="align-items:flex-start"><div><label for="ttor" style="margin-top:0">Proposta (orçamento)</label><select id="ttor"><option value="new"${so('new')}>Nova proposta</option>${orcOpts.map(o=>`<option value="${o.id}"${so(o.id)}>${esc(o.data)} · ${brl(total(o))} · ${esc(o.status)}</option>`).join('')}<option value="none"${so('none')}>Não incluir em proposta</option></select></div><div><label for="ttd" style="margin-top:0">Dentista responsável</label><select id="ttd">${dentOpts(sh.dt!==undefined?sh.dt:defDt(),'Escolha o dentista')}</select></div></div>
  <div class="tt-tot"><span>Total (${nProc} ${nProc===1?'procedimento':'procedimentos'})</span><span id="tttotal">${brl(ttGrand())}</span></div></div>`;
}
function ttRefresh(){
  const p=cur();
  if(p){[['trbasket',ttBasketHtml],['trteeth',ttPanelHtml],['trshared',ttSharedHtml]].forEach(([id,fn])=>{const box=$(id);if(box){box.innerHTML=fn(p);fmtMoney(box)}})}
  const fm=$('trform');if(fm)fm.style.display=((view.trSel||[]).length||ttBasket().length)?'none':'';
  const bb=$('trbarbtn');if(bb)bb.innerHTML=trBarInner();
  const c=$('trchips');if(c)c.innerHTML=trChips();
}
function ttFocus(n){const e=(n&&document.querySelector('[data-ttrow="'+n+'"]'))||document.querySelector('.tt-row');if(e)e.scrollIntoView({behavior:'smooth',block:'center'})}
/* linhas da seleção atual (ou erro) */
function ttCollect(){
  const teeth=ttSel();if(!teeth.length)return {lines:[]};
  const u=view.trUni||{},td=view.trTd||{};
  if(ttUni()){
    if(!u.proc)return {err:['Selecione o tratamento']};
    if(!(num(u.val)>0))return {err:['Informe o valor unitário']};
    return {lines:[{proc:u.proc,dente:teeth.join(', '),unit:num(u.val),q:teeth.length,mult:u.mult!==false,obs:String(u.obs||'').trim()}]};
  }
  const lines=[];
  for(const n of teeth){const d=td[n]||{};
    if(!d.proc)return {err:['Dente '+n+': selecione o tratamento',n]};
    if(!(num(d.val)>0))return {err:['Dente '+n+': informe o valor',n]};
    lines.push({proc:d.proc,dente:n,unit:num(d.val),q:1,mult:false,obs:String(d.obs||'').trim()});
  }
  return {lines};
}
function ttSave(p){
  const c=ttCollect();
  if(c.err){toast(c.err[0],2800);ttFocus(c.err[1]);return}
  const lines=ttBasket().concat(c.lines);
  if(!lines.length)return;
  const sh=view.trSh||{},orcOpts=p.orcs.filter(o=>o.status!=='Recusado');
  const dt=sh.dt!==undefined?sh.dt:defDt();
  const oid=sh.or!==undefined?sh.or:(orcOpts[0]?orcOpts[0].id:'new');
  if(!dt){toast('Escolha o dentista responsável');const e=$('ttd');if(e)e.focus();return}
  p.trat=p.trat||[];
  let orc=null;
  if(oid==='new'){orc={id:uid(),data:new Date().toLocaleDateString('pt-BR'),status:'Pendente',itens:[],desc:'',val:plusDays(15),cond:''};p.orcs.unshift(orc)}
  else if(oid&&oid!=='none')orc=getO(p,oid);
  lines.forEach(l=>{
    const m=procBy(l.proc),k=l.mult?l.q:1,tot=ttLineTot(l),obs=l.obs||'';
    const mats=m?matSnap(m).map(z=>k>1?Object.assign({},z,{q:z.q*k,sub:r2(z.sub*k)}):z):[];
    const t={id:uid(),proc:l.proc,dente:l.dente,obs,valor:tot,custo:m?r2(procCustoBase(m)*k):0,mats,dt,status:'Pendente',rep:0,vid:null,data:''};
    if(l.mult&&l.q>1){t.qtd=l.q;t.unit=r2(l.unit)}
    if(orc){const it={id:uid(),proc:l.proc,dente:l.dente,valor:String(tot),obs,dt,tid:t.id};if(t.qtd){it.qtd=t.qtd;it.unit=t.unit}orc.itens.push(it);t.oid=orc.id;t.oiid=it.id}
    p.trat.push(t);
  });
  view.trSel=[];view.trTd={};view.trSh={};view.trUni=null;view.trBasket=[];view.trForm=false;view.trDraft=null;save();render();
  toast(lines.length>1?lines.length+' procedimentos adicionados'+(orc?' ao mesmo orçamento':''):'Tratamento adicionado'+(orc?' ao orçamento':''),2800);
}
const ttUpd=()=>{const c=$('ttcalc');if(c)c.innerHTML=ttCalcHtml();const e2=$('tttotal');if(e2)e2.textContent=brl(ttGrand())};
document.addEventListener('input',e=>{const t=e.target;if(!t.dataset||t.type==='checkbox')return;
  if(t.dataset.tu!==undefined){const u=view.trUni=view.trUni||{proc:'',val:'',obs:'',mult:true};u[t.dataset.f]=t.value;
    if(t.dataset.f==='val')ttUpd();return}
  if(t.dataset.tt===undefined)return;
  const td=view.trTd=view.trTd||{},d=td[t.dataset.tt]=td[t.dataset.tt]||{proc:'',val:'',obs:''};
  d[t.dataset.f]=t.value;
  if(t.dataset.f==='val')ttUpd();
});
document.addEventListener('change',e=>{const t=e.target;if(!t)return;
  if(t.dataset&&t.dataset.tu!==undefined){
    const u=view.trUni=view.trUni||{proc:'',val:'',obs:'',mult:true};
    if(t.dataset.f==='mult'){u.mult=t.checked;ttRefresh();return}
    if(t.dataset.f==='proc'){const m=procBy(t.value);u.proc=t.value;u.val=m?String(m.preco||''):'';
      const inp=document.querySelector('[data-tu][data-f="val"]');if(inp){inp.value=u.val;if(u.val)moneyFmt(inp)}
      ttUpd()}
    return}
  if(t.dataset&&t.dataset.tt!==undefined&&t.dataset.f==='proc'){
    const td=view.trTd=view.trTd||{},d=td[t.dataset.tt]=td[t.dataset.tt]||{proc:'',val:'',obs:''},m=procBy(t.value);
    d.proc=t.value;d.val=m?String(m.preco||''):'';
    const row=t.closest('.tt-row'),inp=row&&row.querySelector('[data-f="val"]');
    if(inp){inp.value=d.val;if(d.val)moneyFmt(inp);else inp.value=''}
    ttUpd();return}
  if(t.id==='ttall'){
    if(!t.value)return;const m=procBy(t.value),td=view.trTd=view.trTd||{};
    ttSel().forEach(n=>{const d=td[n]=td[n]||{proc:'',val:'',obs:''};d.proc=t.value;d.val=m?String(m.preco||''):''});
    ttRefresh();toast('Tratamento aplicado a todos os dentes',2000);return}
  if(t.id==='ttor'){(view.trSh=view.trSh||{}).or=t.value;return}
  if(t.id==='ttd'){(view.trSh=view.trSh||{}).dt=t.value;return}
});
function trMatPrev(sn){return sn.length?`<div class="termo" style="margin-top:8px"><strong>Materiais deste procedimento</strong>${matLines(sn)}<div class="tot" style="font-size:15px"><span>Total de materiais</span><span>${brl(sn.reduce((a,z)=>a+z.sub,0))}</span></div></div>`:''}
function trCom(x){return (!x.vid&&x.dt&&num(x.valor)>0)?'Comissão prevista: '+brl(comCalc(x.dt,x.proc,num(x.valor),qOf(x)).rep):''}
function syncItemToTrat(p,it){if(!it.tid)return;const t=(p.trat||[]).find(x=>x.id===it.tid);if(t&&!t.vid){t.valor=it.valor;t.dente=it.dente;t.obs=it.obs||'';t.dt=it.dt;t.qtd=it.qtd;t.unit=it.unit}}
function syncTratToItem(p,t){if(!t.oiid)return;const o=getO(p,t.oid),it=o&&o.itens.find(i=>i.id===t.oiid);if(it){it.valor=String(t.valor);it.dente=t.dente||'';it.obs=t.obs||'';it.dt=t.dt;it.qtd=t.qtd;it.unit=t.unit}}
/* Resumo clínico-financeiro por paciente; somente leitura, sem alterar baixas. */
/* Atualização 228: conferência clínica e financeira, sem alterar lançamentos. */
function trAuditoriaHtml(p){
  const rows=(p.trat||[]).filter(x=>x.status!=='Cancelado');
  const concluidos=rows.filter(x=>x.status==='Concluído'||!!x.vid);
  const semDentista=rows.filter(x=>!x.dt);
  const baixasSemRegistro=rows.filter(x=>x.status==='Concluído'&&!x.vid);
  const registrosSemBaixa=rows.filter(x=>!!x.vid&&x.status!=='Concluído');
  const custoRealizado=concluidos.reduce((v,x)=>v+num(x.custo),0);
  const receitaProduzida=concluidos.reduce((v,x)=>v+num(x.valor),0);
  const repasses=concluidos.reduce((v,x)=>v+num(x.rep),0);
  const margem=receitaProduzida-custoRealizado-repasses;
  return `<details class="card" style="margin-bottom:12px"><summary style="cursor:pointer;font-weight:700">Conferência de tratamentos e margem estimada</summary>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:12px">
  ${stat('Custo dos concluídos',brl(custoRealizado))}${stat('Repasses dos concluídos',brl(repasses))}${stat('Margem estimada',brl(margem))}${stat('Sem dentista',String(semDentista.length))}</div>
  <p class="note">Margem estimada = valor dos tratamentos concluídos menos custos cadastrados e comissões registradas. Não é lucro contábil nem saldo recebido.</p>
  ${baixasSemRegistro.length?`<p class="note" style="color:#a14c00">${baixasSemRegistro.length} tratamento(s) marcado(s) como concluído(s) sem registro de baixa.</p>`:''}
  ${registrosSemBaixa.length?`<p class="note" style="color:#a14c00">${registrosSemBaixa.length} tratamento(s) com baixa registrada, mas status diferente de concluído.</p>`:''}
  ${semDentista.length?`<p class="note" style="color:#a14c00">${semDentista.length} tratamento(s) sem dentista responsável definido.</p>`:''}
  <p class="note">Esta conferência é somente leitura: não gera pagamentos nem altera procedimentos.</p></details>`;
}
function trResumoHtml(p){
  const all=(p.trat||[]).filter(x=>x.status!=='Cancelado');
  const done=all.filter(x=>x.status==='Concluído'||!!x.vid);
  const pending=all.filter(x=>x.status!=='Concluído'&&!x.vid);
  const totalVal=all.reduce((a,x)=>a+num(x.valor),0);
  const doneVal=done.reduce((a,x)=>a+num(x.valor),0);
  const costs=all.reduce((a,x)=>a+num(x.custo),0);
  const reps=done.reduce((a,x)=>a+num(x.rep),0);
  const inconsistent=all.filter(x=>(x.status==='Concluído'&&!x.vid)||(x.vid&&x.status!=='Concluído'));
  return `<div class="card"><h2 style="margin-top:0">Resumo dos tratamentos</h2>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">
  ${stat('A realizar',String(pending.length))}${stat('Concluídos',String(done.length))}
  ${stat('Valor previsto',brl(totalVal))}${stat('Produção concluída',brl(doneVal))}
  ${stat('Custos previstos',brl(costs))}${stat('Comissões registradas',brl(reps))}</div>
  <p class="note" style="margin:10px 0 0">Valores de tratamentos cadastrados; não representam necessariamente pagamentos recebidos. Custos incluem estimativas dos procedimentos pendentes.</p>
  ${inconsistent.length?`<p class="note" style="color:#a14c00;margin:8px 0 0">Atenção: ${inconsistent.length} procedimento(s) com divergência entre status e registro de baixa. Confira antes de realizar novos lançamentos.</p>`:''}</div>`;
}
/* Atualização 229: conciliação somente leitura entre produção, recebimentos e repasses. */
function trConciliacaoHtml(p){
  const feitos=(p.trat||[]).filter(t=>t.vid&&t.status!=='Cancelado');
  const ids=new Set(feitos.map(t=>String(t.vid)));
  const vendas=(db.vd||[]).filter(v=>v.pid===p.id);
  const ligadas=vendas.filter(v=>ids.has(String(v.id)));
  const faltantes=feitos.filter(t=>!vendas.some(v=>String(v.id)===String(t.vid)));
  const repetidas=feitos.filter((t,i)=>feitos.findIndex(z=>String(z.vid)===String(t.vid))!==i);
  const prod=feitos.reduce((a,t)=>a+num(t.valor),0);
  const recebidoTotal=vendas.reduce((a,v)=>a+recebido(v),0);
  const saldo=vendas.reduce((a,v)=>a+saldoV(v),0);
  const comissoes=feitos.reduce((a,t)=>a+num(t.rep),0);
  const semDentista=feitos.filter(t=>!t.dt);
  const alertas=[];
  if(faltantes.length)alertas.push(faltantes.length+' baixa(s) sem atendimento financeiro correspondente');
  if(repetidas.length)alertas.push(repetidas.length+' referência(s) de baixa repetida(s)');
  if(semDentista.length)alertas.push(semDentista.length+' procedimento(s) concluído(s) sem dentista');
  return `<details class="card" style="margin-bottom:12px"><summary style="cursor:pointer;font-weight:700">Conciliação clínica e financeira</summary>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:12px">
  ${stat('Produção baixada',brl(prod))}${stat('Recebido',brl(recebidoTotal))}${stat('Saldo a receber',brl(saldo))}${stat('Comissões das baixas',brl(comissoes))}${stat('Baixas vinculadas',String(ligadas.length))}</div>
  <p class="note">Recebimentos e saldos consideram todos os atendimentos financeiros do paciente, inclusive registros não vinculados aos tratamentos desta lista. Produção e comissões consideram apenas tratamentos com baixa. Os totais têm bases diferentes e não devem ser subtraídos diretamente.</p>
  ${alertas.length?`<div role="status" style="border-left:3px solid #d97706;padding:8px 12px;margin-top:8px"><strong>Itens para conferência</strong><ul>${alertas.map(a=>`<li>${esc(a)}</li>`).join('')}</ul></div>`:'<p class="note" style="color:var(--ok)">Nenhuma inconsistência de vínculo identificada nesta verificação.</p>'}
  <p class="note">Painel somente leitura: não altera registros, pagamentos ou comissões.</p></details>`;
}
/* NexoDent 252: margem por procedimento, somente leitura. Custos laboratoriais
   são separados do custo-base e não geram despesas ou comissões. */
function trLabCostMap(p){
 const snap=window.NexoLabRead;
 if(!snap||!snap.loaded||snap.clinicId!==(window.OralCloud?.clinicId||'local'))return null;
 const ids=new Set((p.trat||[]).map(t=>String(t.id)));
 const map=new Map();
 (snap.orders||[]).forEach(o=>{
  if(String(o.patient_id)!==String(p.id)||!ids.has(String(o.treatment_id))||o.status==='Cancelado')return;
  const id=String(o.treatment_id),cost=Math.max(0,Number(o.laboratory_cost)||0);
  map.set(id,(map.get(id)||0)+cost);
 });
 return map;
}
function trMargemDetalhadaHtml(p){
 const map=trLabCostMap(p);
 if(!map)return `<details class="card" style="margin-bottom:12px"><summary style="cursor:pointer;font-weight:700">Margem por procedimento</summary><p class="note">Abra Laboratório para carregar os custos vinculados e depois retorne a Tratamentos.</p></details>`;
 const tratamentos=(p.trat||[]).filter(t=>t.status!=='Cancelado');
 const totals={valor:0,base:0,lab:0,rep:0};
 const linhas=tratamentos.map(t=>{
  const valor=num(t.valor),base=num(t.custo),lab=map.get(String(t.id))||0;
  const rep=t.vid?num(t.rep):0;
  const margem=valor-base-lab-rep;
  totals.valor+=valor;totals.base+=base;totals.lab+=lab;totals.rep+=rep;
  return `<tr><td>${esc(t.proc||'Procedimento')}</td><td>${esc(t.vid?'Concluído':t.status||'Pendente')}</td><td>${brl(valor)}</td><td>${brl(base)}</td><td>${brl(lab)}</td><td>${brl(rep)}</td><td>${brl(margem)}</td></tr>`;
 }).join('');
 const margem=totals.valor-totals.base-totals.lab-totals.rep;
 return `<details class="card" style="margin-bottom:12px"><summary style="cursor:pointer;font-weight:700">Margem por procedimento (com laboratório)</summary><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:12px">${stat('Valor dos tratamentos',brl(totals.valor))}${stat('Custo-base',brl(totals.base))}${stat('Laboratório',brl(totals.lab))}${stat('Comissões registradas',brl(totals.rep))}${stat('Margem estimada',brl(margem))}</div><div style="overflow-x:auto"><table style="width:100%;margin-top:12px"><thead><tr><th>Procedimento</th><th>Situação</th><th>Valor</th><th>Custo-base</th><th>Laboratório</th><th>Comissão</th><th>Margem</th></tr></thead><tbody>${linhas||'<tr><td colspan="7">Nenhum tratamento cadastrado.</td></tr>'}</tbody></table></div><p class="note">Projeção sobre valores cadastrados, inclusive tratamentos pendentes; não representa dinheiro recebido ou lucro contábil. O custo-base pode já incluir despesas laboratoriais lançadas manualmente: confira antes de interpretar a margem. Nenhum lançamento é criado ou alterado.</p></details>`;
}
/* NexoDent 251: consulta de trabalhos protéticos e custos sem criar lançamentos duplicados. */
function trLabResumoHtml(p){
 const snapshot=window.NexoLabRead;
 if(!snapshot||!snapshot.loaded||snapshot.clinicId!==(window.OralCloud?.clinicId||'local'))return `<details class="card"><summary>Laboratório vinculado aos tratamentos</summary><p class="note">Abra a aba Laboratório para carregar os trabalhos desta clínica. Depois retorne aos tratamentos.</p></details>`;
 const items=(snapshot.orders||[]).filter(o=>String(o.patient_id)===String(p.id)&&o.treatment_id);
 const trs=p.trat||[];
 const valid=items.filter(o=>trs.some(t=>String(t.id)===String(o.treatment_id)));
 const orphan=items.length-valid.length;
 const total=valid.filter(o=>o.status!=='Cancelado').reduce((n,o)=>n+(Number(o.laboratory_cost)||0),0);
 const rows=valid.map(o=>{const t=trs.find(x=>String(x.id)===String(o.treatment_id));return `<tr><td>${esc(t?.proc||'Procedimento')}</td><td>${esc(o.work_description||'')}</td><td>${esc(o.status||'')}</td><td>${brl(Number(o.laboratory_cost)||0)}</td></tr>`}).join('');
 return `<details class="card" style="margin-bottom:12px"><summary style="cursor:pointer;font-weight:700">Laboratório vinculado aos tratamentos (${valid.length})</summary><div style="margin-top:12px">${stat('Custos laboratoriais vinculados',brl(total))}${stat('Trabalhos vinculados',String(valid.length))}</div>${valid.length?`<div style="overflow-x:auto"><table style="width:100%;margin-top:12px"><thead><tr><th>Tratamento</th><th>Trabalho</th><th>Situação</th><th>Custo</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<p class="note">Nenhum trabalho vinculado a um tratamento deste paciente.</p>'}${orphan?`<p class="note" style="color:#a14c00">${orphan} vínculo(s) apontam para tratamentos não encontrados.</p>`:''}<p class="note">Consulta somente leitura. Os custos laboratoriais são exibidos separadamente dos custos cadastrados no tratamento para evitar dupla contagem. Não gera despesas, baixas ou comissões.</p></details>`;
}
function tratHtml(p){
  const all=p.trat||[],tr=trList(p),dr=view.trDraft||{},dec=(view.dent||'perm')==='dec';
  const orcOpts=p.orcs.filter(o=>o.status!=='Recusado');
  const flt=`<label for="trflt" style="margin-top:0">Filtrar por proposta</label><select id="trflt"><option value="">Todas as propostas</option>${p.orcs.map(o=>`<option value="${o.id}"${view.trFlt===o.id?' selected':''}>${esc(o.data)} · ${brl(total(o))} · ${esc(o.status)}</option>`).join('')}${all.some(x=>!x.oid)?`<option value="none"${view.trFlt==='none'?' selected':''}>Sem proposta</option>`:''}</select>`;
  const seg=`<div class="tp-seg"><button type="button" data-act="dent" data-t="perm" class="${dec?'':'on'}">Permanente</button><button type="button" data-act="dent" data-t="dec" class="${dec?'on':''}">Decíduos</button></div>`;
  const lg=`<div class="tp-lg"><span><i style="border-color:#E8741A;background:#E8741A"></i>Finalizado</span><span><i style="border-color:#FFB56B;background:#FFB56B"></i>Finalizado/A realizar</span><span><i style="border-color:#BDBDBD;background:#BDBDBD"></i>A realizar</span></div>`;
  const m=procBy(dr.tnp||''),defOr=dr.tnor!==undefined?dr.tnor:(orcOpts[0]?orcOpts[0].id:'new'),so=v=>defOr===v?' selected':'';
  const form=view.trForm?`<div class="card" id="trform"${((view.trSel||[]).length||(view.trBasket||[]).length)?' style="display:none"':''}><h2>Novo tratamento</h2>
    <label for="tnp" style="margin-top:0">Procedimento</label>
    <select id="tnp"><option value="">Selecione um procedimento cadastrado</option>${db.pr.map(x=>`<option value="${esc(x.nome)}"${dr.tnp===x.nome?' selected':''}>${esc(x.nome)} · ${brl(x.preco||0)}</option>`).join('')}</select>
    <div id="tnmat">${trMatPrev(m?matSnap(m):[])}</div>
    <label for="tnobs">O que precisa ser feito</label>
    <textarea id="tnobs" placeholder="Ex.: restauração em resina na face oclusal">${esc(dr.tnobs||'')}</textarea>
    <p class="note" style="margin:4px 0 0">Este texto aparece no orçamento impresso.</p>
    <div class="row" style="align-items:flex-start"><div><label for="tnv">Valor por dente (R$)</label><input id="tnv" inputmode="decimal" placeholder="Automático" value="${esc(dr.tnv||'')}"></div><div><label for="tnc">Custo por dente (R$)</label><input id="tnc" inputmode="decimal" placeholder="Automático" value="${esc(dr.tnc||'')}"></div></div>
    <div class="row" style="align-items:flex-start"><div><label for="tnor">Proposta (orçamento)</label><select id="tnor"><option value="new"${so('new')}>Nova proposta</option>${orcOpts.map(o=>`<option value="${o.id}"${so(o.id)}>${esc(o.data)} · ${brl(total(o))} · ${esc(o.status)}</option>`).join('')}<option value="none"${so('none')}>Não incluir em proposta</option></select></div><div><label for="tnd">Dentista responsável</label><select id="tnd">${dentOpts(dr.tnd!==undefined?dr.tnd:defDt(),'Escolha o dentista')}</select></div></div>
    <div style="margin-top:12px"><button class="ghost" type="button" data-act="trcancel" style="width:100%">Cancelar</button></div></div>`:'';
  const lista=tr.length?tr.map((x,ix)=>{
    const st=tratStatus(x),done=x.status==='Concluído',dis=done?'disabled':'',o=x.oid?p.orcs.find(z=>z.id===x.oid):null;
    return `<div class="card pr-card"><div class="pr-head"><span class="pr-av" aria-hidden="true">${ix+1}</span><div class="pr-nm">${esc(x.proc||'Tratamento')}${x.dente?' · '+dLab(x.dente)+' '+esc(x.dente):''}<small>Dentista: ${esc(dName(x.dt))}${o?' · Proposta '+esc(o.data):''}</small></div><span class="badge ${st[1]}" style="flex:none">${st[0]}</span></div>
    ${qOf(x)>1?(()=>{const m=itMult(x);return `<div class="tt-calc" style="margin-top:8px">${brl(m.u)} × ${m.q} dentes = <b>${brl(m.t)}</b></div>`})():''}
    <label>O que precisa ser feito</label><textarea data-tr="${x.id}" data-f="obs" style="min-height:56px" ${dis}>${esc(x.obs||'')}</textarea>
    <div class="row" style="margin-top:6px"><div><label style="margin-top:0">Valor</label><input data-tr="${x.id}" data-f="valor" inputmode="decimal" value="${esc(x.valor)}" ${dis}></div><div><label style="margin-top:0">Custo</label><input data-tr="${x.id}" data-f="custo" inputmode="decimal" value="${esc(x.custo)}" ${dis}></div></div>
    <div class="row"><div><label>Dente</label><input data-tr="${x.id}" data-f="dente" value="${esc(x.dente||'')}" ${dis}></div><div><label>Dentista</label><select data-tr="${x.id}" data-f="dt" ${dis}>${dentOpts(x.dt,'Escolha')}</select></div></div>
    ${(x.mats||[]).length?`<details style="margin-top:6px"><summary>Materiais deste procedimento (${brl(x.mats.reduce((a,m)=>a+num(m.sub),0))})</summary>${matLines(x.mats)}</details>`:''}
    <div class="note" data-trc="${x.id}" style="margin:4px 0 0">${trCom(x)}</div>
    ${x.vid?`<div class="note" style="margin:8px 0 0;color:var(--ok)">Baixa realizada em ${fd(x.data||'')} · dentista: ${esc(dName(x.dt))} · comissão registrada: ${brl(x.rep||0)}</div>`:`<div class="row" style="margin-top:10px;flex-wrap:wrap"><button class="sm" data-act="trbaixa" data-id="${x.id}">Dar baixa no procedimento</button><button class="danger sm" data-act="rmtr" data-id="${x.id}">${delArm===x.id?'Toque de novo para excluir':'Excluir'}</button></div>`}</div>`}).join(''):'<div class="empty">Nenhum tratamento cadastrado.</div>';
  const bar=`<div class="tr-bar"><button type="button" id="trbarbtn" class="tr-add" data-act="addtr">${trBarInner()}</button></div>`;
  return `${trResumoHtml(p)}${trLabResumoHtml(p)}${trMargemDetalhadaHtml(p)}${trAuditoriaHtml(p)}${trConciliacaoHtml(p)}<div class="card">${flt}<h2 style="margin-top:16px">Odontograma</h2>${seg}${odxHtml(p,tr)}${lg}<div id="trchips" style="margin-top:10px">${trChips()}</div><div id="trbasket">${ttBasketHtml(p)}</div><div id="trteeth">${ttPanelHtml(p)}</div><div id="trshared">${ttSharedHtml(p)}</div></div>${form}<h2>Tratamentos (${tr.length})</h2>${lista}${bar}`;
}
function tabOrc(p){
  return prList()+`<button data-act="addo" style="width:100%;margin-bottom:12px">Novo orçamento</button>`+(p.orcs.length?p.orcs.map(orcHtml).join(''):'<div class="empty">Nenhum orçamento para este paciente.</div>');
}
