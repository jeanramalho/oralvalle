/* ===== procedimentos, hora clínica ===== */
function rw(l,v){return `<div class="tot" style="font-size:15px;font-weight:600;border:0;margin:0;padding:3px 0"><span>${l}</span><span>${v}</span></div>`}
function prRes(x){
  const r=prCalc(x),pr=num(x.preco),h=db.hc;
  let s=rw('Custo do procedimento',brl(r.procCusto))+rw((x.parc?'Estrutura da clínica (':'Hora clínica (')+num(x.min)+' min)',brl(r.ch))+rw('Material',brl(r.mat))+rw('Laboratório',brl(r.lab));
  s+=rw('Custo total de execução',brl(r.custoExecucao));
  if(r.par>0)s+=rw('Comissão fixa do dentista',brl(r.par));
  if(pr>0&&r.parPct>0){
    s+=rw('Base da comissão ('+r.parPct+'%)',brl(Math.max(0,pr-r.custoExecucao)));
    s+=rw('Comissão do dentista ('+r.parPct+'%)',brl(r.comValorPct));
  }
  if(pr>0){
    if(num(h.imp)>0)s+=rw('Impostos ('+num(h.imp)+'%)',brl(pr*num(h.imp)/100));
    if(num(h.cart)>0)s+=rw('Taxa de cartão ('+num(h.cart)+'%)',brl(pr*num(h.cart)/100));
    if(r.comPct>0&&!r.parPct)s+=rw('Comissão média ('+r.comPct+'%) sobre base líquida',brl(r.comValorPct));
  }
  s+=`<div class="tot"><span>Custo total${pr>0?'':' (sem impostos e taxas)'}</span><span>${brl(r.fixo+pr*r.pct)}</span></div>`;
  if(pr>0)s+=`<div class="tot" style="color:${r.lu<0?'var(--wr)':'var(--ok)'}"><span>Lucro</span><span>${brl(r.lu)} (${r.mg.toFixed(0)}% do preço)</span></div>`;
  else s+='<p class="note" style="margin:8px 0 0">Informe o preço cobrado para ver o lucro.</p>';
  s+=r.ok?`<div class="row" style="margin-top:8px"><span class="note" style="margin:0">Sugerido: ${brl(r.sug)}</span><button class="ghost sm" data-act="usesug" data-id="${x.id}">Usar sugerido</button></div>`:'<p class="note" style="color:var(--wr)">Impostos, taxas, comissão e margem desejada somam 100% ou mais. Nenhum preço fecha a conta; revise a aba Hora clínica.</p>';
  return s;
}
const PF_ST=[['','Todas'],['Pendente','Em aberto'],['Aprovado','Aprovadas'],['Recusado','Recusadas']];
const pfIso=s=>{const m=String(s||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):''};
function pfAll(){
  const l=[];
  db.p.filter(p=>!p.arq).forEach(p=>(p.orcs||[]).forEach(o=>l.push({p,o,iso:pfIso(o.data)})));
  return l;
}
function pfListHtml(){
  const group=view.pfGroup||'proposal',st=view.pfSt||'',de=view.pfFrom||'',ate=view.pfTo||'',qq=String(view.pfQ||'').toLowerCase().trim();
  const all=pfAll();
  const l=all.filter(x=>(group==='approved'?x.o.status==='Aprovado':group==='lost'?x.o.status==='Recusado':x.o.status!=='Aprovado'&&x.o.status!=='Recusado')&&(!st||x.o.status===st)&&(!de||(x.iso&&x.iso>=de))&&(!ate||(x.iso&&x.iso<=ate))&&(!qq||x.p.nome.toLowerCase().includes(qq)))
    .sort((a,b)=>String(b.iso).localeCompare(String(a.iso))||a.p.nome.localeCompare(b.p.nome,'pt-BR'));
  const soma=l.reduce((t,x)=>t+total(x.o),0),pacs=new Set(l.map(x=>x.p.id)).size;
  const cls=s=>s==='Aprovado'?'pf-ok':s==='Recusado'?'pf-no':'pf-open';
  const lab=s=>s==='Pendente'||!s?'Proposta':s==='Aprovado'?'Aprovado':s==='Recusado'?'Perdida':s;
  const pts=db.p.filter(p=>!p.arq).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  const novo=view.pfNew?`<div class="card pf-new"><h2 style="margin-top:0">Nova proposta financeira</h2><label for="pfPaciente" style="margin-top:0">Paciente</label><select id="pfPaciente"><option value="">Selecionar paciente</option>${pts.map(x=>`<option value="${x.id}"${x.id===view.pfPid?' selected':''}>${esc(x.nome)}</option>`).join('')}</select><div class="row" style="margin-top:12px"><button data-act="pfCreate" style="flex:1">Criar proposta</button><button class="ghost" data-act="pfCancel" style="flex:1">Cancelar</button></div></div>`:'';
  const cards=l.length?l.map(x=>{const n=x.o.itens.length;const contacted=Boolean(x.o.contatoRealizado),secondContact=Boolean(x.o.segundoContato),improved=Boolean(x.o.propostaMelhorada);return `<article class="pf-entry"><button type="button" class="pf-card" data-act="pfOpen" data-pid="${x.p.id}" data-oid="${x.o.id}"><span class="pf-top"><span class="pf-ic" aria-hidden="true">${ovIcon('dt')}</span><span class="pf-who"><b>${esc(x.p.nome)}</b><small>${n} ${n===1?'procedimento':'procedimentos'}</small></span><span class="pf-badge ${cls(x.o.status)}">${esc(lab(x.o.status))}</span></span><span class="pf-bot"><b>${brl(total(x.o))}</b><small>${esc(x.o.data||'')}</small></span></button><div class="pf-followups" aria-label="Acompanhamento da proposta"><label class="pf-followup"><input type="checkbox" data-pf-follow="contatoRealizado" data-pid="${x.p.id}" data-oid="${x.o.id}"${contacted?' checked':''}><span>1º contato</span></label><label class="pf-followup"><input type="checkbox" data-pf-follow="segundoContato" data-pid="${x.p.id}" data-oid="${x.o.id}"${secondContact?' checked':''}><span>2º contato</span></label><label class="pf-followup"><input type="checkbox" data-pf-follow="propostaMelhorada" data-pid="${x.p.id}" data-oid="${x.o.id}"${improved?' checked':''}><span>Proposta melhorada</span></label></div><div style="padding:0 14px 14px"><label for="pf-obs-${esc(x.o.id)}" style="display:block;margin:0 0 5px;font-weight:600">Observações internas</label><textarea id="pf-obs-${esc(x.o.id)}" data-pf-obs="1" data-pid="${esc(x.p.id)}" data-oid="${esc(x.o.id)}" placeholder="Informações relatadas pelo paciente, negociações, preferências..." rows="3" style="width:100%;box-sizing:border-box;resize:vertical">${esc(x.o.observacoesInternas||'')}</textarea><small class="note">Uso interno — não aparece no documento impresso.</small></div></article>`}).join(''):`<div class="ov-patient-empty">${all.length?'Nenhuma proposta encontrada com esses filtros.':'Nenhum paciente fez orçamento ainda.'}</div>`;
  const proposalCount=all.filter(x=>x.o.status!=='Aprovado'&&x.o.status!=='Recusado').length,approvedCount=all.filter(x=>x.o.status==='Aprovado').length,lostCount=all.filter(x=>x.o.status==='Recusado').length;
  const options=group==='approved'?[['Aprovado','Aprovado']]:group==='lost'?[['Recusado','Perdida']]:[['','Todas as propostas'],['Pendente','Proposta']];
  return `<div class="ov-page-head"><div><h1>Propostas Financeiras</h1><p class="sub">Home</p></div></div>
  <div class="pf-view-tabs" role="group" aria-label="Visualizar propostas"><button type="button" class="pf-view-tab ${group==='proposal'?'on':''}" data-act="pfShow" data-t="proposal" aria-pressed="${group==='proposal'}">Proposta (${proposalCount})</button><button type="button" class="pf-view-tab ${group==='approved'?'on':''}" data-act="pfShow" data-t="approved" aria-pressed="${group==='approved'}">✓ Aprovado (${approvedCount})</button><button type="button" class="pf-view-tab ${group==='lost'?'on':''}" data-act="pfShow" data-t="lost" aria-pressed="${group==='lost'}">Perdida (${lostCount})</button></div>
  <div class="card pf-filters">
    <div><label for="pfSt" style="margin-top:0">Situação</label><select id="pfSt">${options.map(o=>`<option value="${o[0]}"${(group==='approved'?'Aprovado':group==='lost'?'Recusado':st)===o[0]?' selected':''}>${o[1]}</option>`).join('')}</select></div>
    <div><label for="pfFrom" style="margin-top:0">De</label><input id="pfFrom" type="date" value="${esc(de)}"></div>
    <div><label for="pfTo" style="margin-top:0">Até</label><input id="pfTo" type="date" value="${esc(ate)}"></div>
    <div class="pf-q"><label for="pfQ" style="margin-top:0">Paciente</label><input id="pfQ" type="search" placeholder="Buscar pelo nome" autocomplete="off" value="${esc(view.pfQ||'')}"></div>
  </div>
  <div class="pf-bar"><span class="pf-sum">${l.length} ${l.length===1?'proposta':'propostas'} · ${pacs} ${pacs===1?'paciente':'pacientes'} · ${brl(soma)}</span><button class="ov-new-patient" data-act="pfNew">Proposta Financeira <b>+</b></button></div>
  ${novo}<div class="pf-list">${cards}</div>`;
}
function pfHtml(){
  const pts=db.p.filter(p=>!p.arq).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  const pid=view.pfPid||'';
  const p=pts.find(x=>x.id===pid);
  const tabs=[['pac','Paciente','♙'],['trat','Tratamento','♢'],['neg','Negociação','▱'],['ate','Atendimento','▣']];
  return `<div class="ov-proposal">
    <div class="ov-proposal-head">
      <div class="ov-proposal-title">Proposta Financeira</div>
      <button class="ov-proposal-close" data-act="nav" data-t="inicio" aria-label="Fechar">×</button>
      <div style="position:absolute;left:0;right:0;bottom:-1px"></div>
    </div>
    <div class="ov-proposal-tabs">${tabs.map(t=>`<button class="ov-proposal-tab${t[0]==='pac'?' on':''}" type="button"><span class="ov-proposal-icon">${t[2]}</span><span>${t[1]}</span></button>`).join('')}</div>
    <div class="ov-proposal-body">
      <label class="ov-proposal-label" for="pfPaciente">Paciente</label>
      <select id="pfPaciente" class="ov-proposal-select" aria-label="Selecionar paciente">
        <option value="">Selecionar paciente</option>
        ${pts.map(x=>`<option value="${x.id}"${x.id===pid?' selected':''}>${esc(x.nome)}</option>`).join('')}
      </select>
      <div class="ov-proposal-label">Paciente</div>
      <div class="ov-proposal-card">
        <label for="pfTel">Celular</label>
        <input id="pfTel" type="tel" placeholder="(00) 0000-00000" value="${esc(p?p.tel||'':'')}" ${p?'':'disabled'}>
        <label for="pfNome">Nome</label>
        <input id="pfNome" placeholder="Nome do paciente" value="${esc(p?p.nome:'')}" ${p?'':'disabled'}>
      </div>
    </div>
    <div class="ov-proposal-footer"><button class="ov-proposal-next${p?' enabled':''}" data-act="pfNext" ${p?'':'disabled'}>Avançar&nbsp;&nbsp;→</button></div>
  </div>`;
}
function pmHtml(x){
  const mats=x.mats||[],hasMt=(db.mt||[]).length>0;
  const rows=mats.map(r=>{const m=mtBy(r.mid);
    return `<div class="pm"><span class="pm-name">${m?esc(m.nome):'(material removido)'}<small>${m?brl4(mtUnit(m))+' / '+esc(m.un):''}</small></span><input data-pm="${x.id}" data-mr="${r.id}" inputmode="decimal" aria-label="Quantidade" value="${esc(r.q)}"><span class="pm-sub" data-pms="${r.id}">${brl(m?mtUnit(m)*num(r.q):0)}</span><button class="danger sm" type="button" aria-label="Remover material" data-act="rmpm" data-id="${x.id}" data-r="${r.id}">×</button></div>`}).join('');
  const add=hasMt?`<div class="row" style="margin-top:6px"><select id="pms-${x.id}" aria-label="Material">${db.mt.slice().sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(m=>`<option value="${m.id}">${esc(m.nome)} (${esc(m.un)})</option>`).join('')}</select><button class="ghost sm" type="button" data-act="addpm" data-id="${x.id}">Adicionar</button></div>`
    :`<p class="note" style="margin:6px 0 0">Nenhum material cadastrado. <button class="ghost sm" type="button" data-act="nav" data-t="mt">Cadastrar na Tabela de Materiais</button></p>`;
  const manual=mats.length?`<div class="tot" style="font-size:15px" data-pmt="${x.id}"><span>Total de materiais</span><span>${brl(matCost(x))}</span></div>`
    :`<div style="margin-top:8px"><label>Material avulso (R$)</label><input data-p="${x.id}" data-f="mat" inputmode="decimal" value="${esc(x.mat)}"><p class="note" style="margin:4px 0 0">Ao adicionar materiais da tabela acima, este valor passa a ser calculado automaticamente.</p></div>`;
  return `<div class="card" style="margin-top:10px;background:transparent"><h2 style="font-size:16px">Materiais usados</h2>${rows}${add}${manual}</div>`;
}
function mtCard(m){
  const use=mtUsage(m.id).length;
  const lotes=Array.isArray(m.lotes)?m.lotes:[];
  const total=lotes.reduce((n,l)=>n+(l.ret?0:Math.max(0,num(l.qtd))),0);
  const fi=(k,l,ex)=>`<div><label style="margin-top:6px">${l}</label><input data-mt="${m.id}" data-f="${k}" ${ex||''} value="${esc(m[k]||'')}"></div>`;
  return `<article class="card ov-mt-card"><div class="ag"><strong>${esc(m.nome||'Material')}</strong><span class="badge" data-mtc="${m.id}">${brl4(mtUnit(m))} / ${esc(m.un)}</span></div>
  <div class="note" style="margin:2px 0 4px">${use?'Usado em '+use+' procedimento(s)':'Ainda não usado em procedimentos'}</div>
  <div class="ov-mt-stock"><strong>Em estoque: ${total.toLocaleString('pt-BR')} ${esc(m.un)}</strong><span>${lotes.length} lote(s) cadastrado(s)</span></div>
  <div class="ov-mt-table-wrap"><table class="ov-mt-table"><thead><tr><th>Lote</th><th>Quantidade em estoque</th><th>Validade</th><th>Situação</th><th>Ação</th></tr></thead><tbody>${lotes.length?lotes.map((l,i)=>{const st=mtStatus({val:l.val,ret:l.ret});return `<tr><td>${i+1}</td><td><input type="number" min="0" step="any" aria-label="Quantidade do lote ${i+1}" data-mtl="${m.id}" data-lid="${l.id}" data-lf="qtd" value="${esc(l.qtd)}"></td><td><input type="date" aria-label="Validade do lote ${i+1}" data-mtl="${m.id}" data-lid="${l.id}" data-lf="val" value="${esc(l.val||'')}"></td><td><span class="val-tag ${st.k}">${st.txt}</span></td><td><button type="button" class="ghost sm" data-act="togglemtlot" data-id="${m.id}" data-r="${l.id}">${l.ret?'Reativar':'Retirar'}</button></td></tr>`}).join(''):'<tr><td colspan="5" class="note">Nenhum lote cadastrado. Adicione abaixo a quantidade e a validade de cada lote.</td></tr>'}</tbody></table></div>
  <div class="ov-mt-newlot"><label>Quantidade do novo lote<input type="number" min="0.01" step="any" data-newlot-q="${m.id}" placeholder="Ex.: 50"></label><label>Validade do novo lote<input type="date" data-newlot-v="${m.id}"></label><button type="button" class="ghost sm" data-act="addmtlot" data-id="${m.id}">+ Adicionar lote</button></div>
  <details><summary>Editar material e preço</summary>${fi('nome','Nome')}
    <div class="row" style="align-items:flex-start">${fi('preco','Preço da embalagem (R$)','inputmode="decimal"')}${fi('qtd','Quantidade por embalagem','inputmode="decimal"')}<div><label style="margin-top:6px">Unidade</label><select data-mt="${m.id}" data-f="un">${UNS.map(u=>`<option${m.un===u?' selected':''}>${u}</option>`).join('')}</select></div></div>
    <p class="note">Quantidade por embalagem serve para calcular o custo unitário. O estoque é controlado separadamente por lotes.</p>
    <div style="margin-top:10px;display:flex;justify-content:flex-end"><button class="danger sm" type="button" data-act="rmmt" data-id="${m.id}">${delArm===m.id?'Confirmar exclusão':'Excluir material'}</button></div>
  </details></article>`;
}
function mtHtml(){
  const query=String(view.mtq||'').toLowerCase().trim();
  const list=db.mt.filter(m=>!query||String(m.nome).toLowerCase().includes(query)).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  return `<h1>Tabela de Materiais</h1><p class="sub">Controle a quantidade disponível por lote e registre quantas unidades possuem cada data de vencimento. O preço por embalagem continua sendo usado no cálculo dos procedimentos.</p>
  <div class="card"><h2>Novo material</h2>
    <label for="mtn">Nome</label><input id="mtn" placeholder="Ex.: Luva de procedimento">
    <div class="row" style="align-items:flex-start"><div><label for="mtp">Preço da embalagem (R$)</label><input id="mtp" inputmode="decimal" placeholder="Ex.: 40,00"></div><div><label for="mtq">Quantidade por embalagem</label><input id="mtq" inputmode="decimal" placeholder="Ex.: 100"></div><div><label for="mtu">Unidade</label><select id="mtu">${UNS.map(u=>`<option>${u}</option>`).join('')}</select></div></div>
    <div class="row" style="align-items:flex-start"><div><label for="mts">Quantidade inicial em estoque</label><input id="mts" type="number" min="0" step="any" placeholder="Ex.: 200"></div><div><label for="mtv">Validade do primeiro lote</label><input id="mtv" type="date"></div></div>
    <p class="note">Para mais de uma validade, cadastre o material e depois use “Adicionar lote”. Os alertas de vencimento consideram cada lote.</p>
    <div style="margin-top:12px"><button data-act="addmt" style="width:100%">Adicionar material</button></div></div>
  ${db.mt.length?`<input id="mtq-search" type="search" placeholder="Buscar material" value="${esc(view.mtq||'')}" style="margin-bottom:12px">`:''}
  <h2>Meus materiais (${db.mt.length})</h2>
  ${list.length?list.map(mtCard).join(''):'<div class="empty">'+(db.mt.length?'Nenhum material encontrado.':'Nenhum material cadastrado ainda.')+'</div>'}`;
}
function prHtml(){
  const query=String(view.prq||'').toLowerCase().trim();
  const list=db.pr.filter(x=>!query||String(x.nome||'').toLowerCase().includes(query));
  const count=db.pr.length;
  const cards=list.map((x)=>{
    const r=prCalc(x), price=num(x.preco), mg=price?r.mg:0;
    const cls=price?(mg>=25?'good':mg>=0?'':'warn'):'';
    const f=(k,l)=>`<div><label>${l}</label><input data-p="${x.id}" data-f="${k}" inputmode="decimal" value="${esc(x[k])}"></div>`;
    const tone=!price?'none':mg>=25?'good':mg>=0?'mid':'neg';
    const toneTxt={none:'Sem preço',good:'Margem boa',mid:'Margem baixa',neg:'Prejuízo'}[tone];
    const idx=db.pr.indexOf(x)+1, nm=(x.mats||[]).length, minN=num(x.min);
    return `<article class="proc-card pr-card pcx pcx-${tone}" data-proc-name="${esc(String(x.nome||'').toLowerCase())}">
      <div class="pcx-top"><span class="pcx-num" aria-hidden="true">${idx}</span>
        <div class="pcx-id"><div class="pcx-name">${esc(x.nome||'Novo procedimento')}</div>
          <div class="pcx-chips"><span class="pcx-chip">⏱ ${minN||0} min</span><span class="pcx-chip">${nm?nm+' material(is) · '+brl(r.mat):'Sem materiais'}</span>${x.parc?'<span class="pcx-chip pcx-chip-p">Parceiro</span>':''}</div></div>
        <div class="pcx-price"><b>${price?brl(price):'—'}</b><span class="pcx-tag">${toneTxt}</span></div></div>
      <div class="pcx-stats">
        <div><small>Custo</small><b>${price||r.fixo?brl(r.fixo+(r.comValorPct||0)):'—'}</b></div>
        <div><small>Lucro</small><b class="pcx-lu">${price?brl(r.lu):'—'}</b></div>
        <div><small>Margem</small><b class="pcx-mg">${price?mg.toFixed(1).replace('.',',')+'%':'—'}</b></div>
      </div>
      <details class="proc-edit"${view.prOpen===x.id?' open':''}><summary>Editar cadastro</summary><div class="card"><label>Procedimento</label><input data-p="${x.id}" data-f="nome" value="${esc(x.nome)}"><div class="row" style="align-items:flex-start">${f('min','Tempo (min)')}${f('preco','Valor cobrado (R$)')}</div><div class="row" style="align-items:flex-start">${f('custo','Outros custos do procedimento (R$)')}${f('lab','Laboratório (R$)')}</div>${pmHtml(x)}<div class="row" style="align-items:flex-start"><div><label>Comissionamento</label><div class="row" style="align-items:flex-start"><select data-p="${x.id}" data-f="parTipo" aria-label="Tipo de comissão"><option value="reais"${(x.parTipo||'reais')==='reais'?' selected':''}>R$</option><option value="pct"${x.parTipo==='pct'?' selected':''}>%</option></select><input data-p="${x.id}" data-f="par" inputmode="decimal" value="${esc(x.par)}" placeholder="Valor"></div></div></div><label class="chk" style="margin-top:10px"><input type="checkbox" data-pc="${x.id}"${x.parc?' checked':''}>Executado por dentista parceiro</label><div data-pres="${x.id}" style="margin-top:10px">${prRes(x)}</div><div style="margin-top:14px;padding-top:12px;border-top:1px solid #eee;display:flex;justify-content:flex-end"><button class="danger sm" data-act="rmpr" data-id="${x.id}" type="button">${delArm===x.id?'Confirmar exclusão':'Excluir procedimento'}</button></div></div></details>
    </article>`;
  }).join('');
  return `<div class="proc-page">
    <div class="proc-toolbar proc-toolbar-search-only">
      <div class="proc-toolbar-right"><input class="proc-search-input" id="prq" type="search" placeholder="Buscar procedimento" value="${esc(view.prq||'')}"></div>
    </div>
    <div class="proc-list-head"><div class="proc-list-title">Meus Procedimentos (${count})</div><button class="proc-add" data-act="addpr">Precificar <span class="proc-add-plus">+</span></button></div>
    <div class="proc-cards">${cards||'<div class="empty">Nenhum procedimento encontrado.</div>'}</div>
  </div>`;
}
function hcRes(r){
  return `<div class="tot" style="border:0;margin:0;padding:0"><span>Horas produtivas por mês</span><span>${r.hrs.toFixed(1).replace('.',',')} h</span></div><div class="tot"><span>Custo da hora clínica</span><span>${brl(r.custo)}</span></div><div class="tot" style="font-size:15px;font-weight:600"><span>Só a estrutura (sem pró-labore)</span><span>${brl(r.estr)}</span></div><div class="tot"><span>Hora com margem e impostos</span><span>${r.pv<1?brl(r.preco):'inviável'}</span></div><p class="note">Margem é a parte do preço de venda que sobra como lucro (30% significa R$ 30 de lucro a cada R$ 100 cobrados). Não inclui materiais e laboratório. A "estrutura" é usada nos procedimentos feitos por dentista parceiro, porque o pró-labore é o seu trabalho.</p>`;
}
function hcHtml(){
  const h=db.hc,f=(k,l,hint)=>`<div class="hc-f"><label>${l}</label><input data-h="${k}" inputmode="decimal" value="${esc(h[k])}">${hint?`<div class="hc-hint">${hint}</div>`:''}</div>`;
  return `<div class="hc-wrap">
  <div class="hc-col">
    <div class="card"><h2 style="margin-top:0">Custos fixos por mês (R$)</h2><p class="note" style="margin:0">Preencha cada custo separado. Não inclua impostos.</p>
      <div class="hc-grid">${f('alu','Aluguel')}${f('eqp','Equipe (salários e encargos)')}${f('luz','Luz')}${f('net','Internet')}${f('fix','Outros custos fixos')}</div>
      <div class="tot"><span>Total de custos fixos</span><span id="hcfx">${brl(hcFix(h))}</span></div></div>
    <div class="card"><h2 style="margin-top:0">Pró-labore e agenda</h2>
      <div class="hc-grid">${f('pl','Pró-labore desejado por mês (R$)')}${f('dias','Dias de atendimento por semana')}${f('hdia','Horas clínicas por dia')}${f('occ','Taxa de ocupação da agenda (%)')}</div></div>
    <div class="card"><h2 style="margin-top:0">Impostos, taxas e margem</h2>
      <div class="hc-grid">${f('imp','Impostos sobre o faturamento (%)')}${f('cart','Taxa média de cartão (%)')}${f('com','Comissão média de parceiros (%)','Usada quando o procedimento não tem comissão fixa')}${f('mg','Margem de lucro desejada (%)','Parte do preço de venda que sobra como lucro')}</div></div>
  </div>
  <div class="hc-col hc-side"><div class="card" id="hcr" style="margin-bottom:0">${hcRes(hcCalc(h))}</div></div>
  </div>`;
}

