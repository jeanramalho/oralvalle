/* ===== Retorno de pacientes (sem agendamento há X meses) ===== */
const isoL=d=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
function retMeses(){const n=parseInt((db.cl||{}).retMeses,10);return n>0?n:6}
function retCorte(){const d=new Date();d.setMonth(d.getMonth()-retMeses());return isoL(d)}
function retRecente(p){if(!p.retCont)return false;const d=new Date();d.setDate(d.getDate()-30);return p.retCont>=isoL(d)}
function retLast(p){
  const hoje=tdy();let last='';
  db.ag.forEach(a=>{if(a.pid===p.id&&a.st!=='Cancelado'&&a.st!=='Faltou'&&a.data&&a.data<=hoje&&a.data>last)last=a.data});
  db.vd.forEach(v=>{if(v.pid===p.id&&v.data&&v.data<=hoje&&v.data>last)last=v.data});
  return last;
}
function retLista(){
  const hoje=tdy(),corte=retCorte(),out=[],never=[];
  db.p.forEach(p=>{
    if(p.arq)return;
    if(db.ag.some(a=>a.pid===p.id&&a.st!=='Cancelado'&&a.st!=='Faltou'&&a.data>hoje))return;
    const last=retLast(p);
    if(!last){never.push(p);return}
    if(last<=corte)out.push({p,last});
  });
  out.sort((a,b)=>(retRecente(a.p)-retRecente(b.p))||a.last.localeCompare(b.last));
  never.sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR'));
  return {out,never};
}
function retPend(){return retLista().out.filter(x=>!retRecente(x.p)).length}
function retMsg(p,last){
  const cl=Object.assign({},CL_DEF,db.cl||{}),pn=String(p.nome||'').trim().split(/\s+/)[0]||'paciente',u=last?last.slice(5,7)+'/'+last.slice(0,4):'';
  return String(cl.retMsg||RET_MSG_DEF).replace(/\s*\(\{ultima\}\)/g,u?' ('+u+')':'').replace(/\{nome\}/g,pn).replace(/\{clinica\}/g,cl.nome||'clínica').replace(/\{ultima\}/g,u);
}
function mesesDesde(iso){const n=new Date(),t=new Date(iso+'T12:00:00');let m=(n.getFullYear()-t.getFullYear())*12+n.getMonth()-t.getMonth();if(n.getDate()<t.getDate())m--;return Math.max(m,0)}
function retBanner(){
  if(typeof pmLvl==='function'&&pmLvl('lem')<1)return '';
  const n=retPend();if(!n)return '';
  return `<div class="card" style="margin-bottom:12px;border-color:var(--ac)"><div class="row" style="align-items:center"><div style="flex:1"><strong>${n} ${n===1?'paciente sem retorno':'pacientes sem retorno'} há mais de ${retMeses()} meses</strong><div class="note" style="margin:2px 0 0">Chame no WhatsApp para reagendar.</div></div><button class="sm" data-act="lemgo" style="flex:none">Ver lista</button></div></div>`;
}
function retHtml(){
  const {out,never}=retLista(),pend=out.filter(x=>!retRecente(x.p)).length,N=retMeses(),lim=view.retAll?out.length:8;
  const row=(p,last)=>{
    const tel=String(p.tel||'').replace(/\D/g,''),rec=retRecente(p);
    return `<div class="ret-it"><div class="ret-i"><strong>${esc(p.nome)}</strong><small>${last?'Última visita: '+esc(fd(last))+' · há '+mesesDesde(last)+' meses':'Nenhuma consulta registrada'}${tel?' · '+esc(p.tel):' · sem telefone'}</small>${rec?`<span class="badge stt-ok" style="margin-top:4px">Contatado em ${esc(fd(p.retCont))}</span>`:''}</div>
    <div class="ret-act">${tel?`<button class="sm" data-act="retwa" data-id="${p.id}">WhatsApp</button>`:''}<button class="ghost sm" data-act="retok" data-id="${p.id}">${rec?'Contatar de novo':'Marcar contatado'}</button><button class="ghost sm" data-act="open" data-id="${p.id}">Ver ficha</button></div></div>`;
  };
  return `<section class="card ret-card"><h2>Pacientes sem retorno há mais de ${N} meses${out.length?` (${out.length})`:''}</h2>
  <p class="sub" style="margin:0 0 6px">Pacientes sem consulta marcada para o futuro e com a última visita há ${N} meses ou mais. Quem foi contatado nos últimos 30 dias vai para o fim da lista. O prazo e a mensagem ficam em Configurações > Empresa.</p>
  ${pend?`<span class="badge stt-wr">${pend} para contatar</span>`:''}
  ${out.length?out.slice(0,lim).map(x=>row(x.p,x.last)).join(''):'<p class="note" style="margin:8px 0 0">Nenhum paciente nessa situação. Tudo em dia!</p>'}
  ${out.length>8?`<button class="ghost sm" data-act="retall" style="margin-top:10px">${view.retAll?'Mostrar menos':'Mostrar todos ('+out.length+')'}</button>`:''}
  ${never.length?`<details style="margin-top:12px"><summary>Sem nenhuma consulta registrada (${never.length})</summary><p class="note" style="margin:6px 0 0">Cadastrados que nunca foram agendados. Não dá para saber há quanto tempo estão assim.</p>${never.map(p=>row(p,'')).join('')}</details>`:''}</section>`;
}
function lembretesHtml(){
  const list=(db.lem||[]).slice().sort((a,b)=>{
    const da=(a.data||'9999-12-31')+' '+(a.hora||'23:59');
    const dbb=(b.data||'9999-12-31')+' '+(b.hora||'23:59');
    return Number(a.feito)-Number(b.feito)||da.localeCompare(dbb);
  });
  const hoje=tdy();
  const pend=list.filter(x=>!x.feito).length;
  const TIPOS=['Geral','Paciente','Financeiro','Agenda','Administrativo','Retorno'],rp=retPend();
  const tabs=[['todos','Todos',pend],['ret','Sem retorno',rp]].concat(TIPOS.map(t=>[t,t,list.filter(x=>!x.feito&&(x.tipo||'Geral')===t).length]));
  const T=tabs.some(x=>x[0]===view.lemTab)?view.lemTab:'todos';
  const shown=T==='todos'?list:list.filter(x=>(x.tipo||'Geral')===T),tipoSel=TIPOS.includes(T)?T:'Geral';
  const tabsHtml=`<div class="lem-tabs" role="tablist" aria-label="Assuntos dos lembretes">${tabs.map(x=>`<button type="button" role="tab" aria-selected="${T===x[0]}" class="${T===x[0]?'on':''}" data-act="lemtab" data-t="${x[0]}">${x[1]}${x[2]?` <span class="lem-n">${x[2]}</span>`:''}</button>`).join('')}</div>`;
  const retNote=`<div class="card" style="margin-bottom:12px;border-color:var(--ac)"><div class="row" style="align-items:center"><div style="flex:1"><strong>${rp} ${rp===1?'paciente sem retorno':'pacientes sem retorno'} há mais de ${retMeses()} meses</strong></div><button class="sm" data-act="lemtab" data-t="ret" style="flex:none">Ver lista</button></div></div>`;
  return `<div class="ov-page-head"><div><h1>Lembretes</h1><p class="sub">Anote tarefas, retornos e assuntos importantes da clínica.</p></div><span class="badge" style="font-size:14px;padding:7px 12px">${pend} pendente${pend===1?'':'s'}</span></div>
  ${tabsHtml}${T==='ret'?retHtml():`${T==='todos'&&rp?retNote:''}
  <div class="ov-reminder-grid">
    <section class="ov-reminder-form">
      <h2>Novo lembrete</h2>
      <label for="lemTitulo">O que você precisa lembrar?</label>
      <input id="lemTitulo" placeholder="Ex.: Ligar para paciente sobre retorno" autocomplete="off">
      <div class="row">
        <div><label for="lemData">Data</label><input id="lemData" type="date" value="${hoje}"></div>
        <div><label for="lemHora">Hora</label><input id="lemHora" type="time"></div>
      </div>
      <label for="lemTipo">Tipo</label>
      <select id="lemTipo">${TIPOS.map(t=>`<option${t===tipoSel?' selected':''}>${t}</option>`).join('')}</select>
      <label for="lemObs">Observação</label>
      <textarea id="lemObs" placeholder="Detalhes do lembrete..."></textarea>
      <button data-act="addlem" style="width:100%;margin-top:12px">Adicionar lembrete</button>
    </section>
    <section>
      ${shown.length?`<div class="ov-reminder-list">${shown.map(x=>{
        const when=x.data?(fd(x.data)+(x.hora?' · '+x.hora:'')): 'Sem data';
        const cls=x.feito?' done':'';
        return `<article class="ov-reminder-item${cls}">
          <div class="ov-reminder-top">
            <input class="ov-reminder-check" type="checkbox" data-lem-check="${x.id}" ${x.feito?'checked':''} aria-label="Concluir lembrete">
            <div class="ov-reminder-title">${esc(x.titulo||'Lembrete sem título')}</div>
          </div>
          <div class="ov-reminder-meta"><span class="ov-reminder-pill">${esc(x.tipo||'Geral')}</span><span class="ov-reminder-pill">${esc(when)}</span></div>
          ${x.obs?`<div class="ov-reminder-note">${esc(x.obs)}</div>`:''}
          <div class="ov-reminder-actions"><button class="ghost sm" data-act="togglelem" data-id="${x.id}">${x.feito?'Reabrir':'Concluir'}</button><button class="danger sm" data-act="rmlem" data-id="${x.id}">${delArm===x.id?'Confirmar exclusão':'Excluir'}</button></div>
        </article>`;}).join('')}</div>`:
      `<div class="ov-reminder-empty"><strong>${T==='todos'?'Nenhum lembrete cadastrado':'Nenhum lembrete em '+T}</strong>Use o formulário ao lado para escrever um lembrete.</div>`}
    </section>
  </div>`}`;
}
function home(){
  const n=view.h||'ag',fn={inicio:agHtml,pac:homePac,pf:pfListHtml,ag:agHtml,lem:lembretesHtml,vd:vdHtml,dt:dtHtml,cm:comHtml,pr:prHtml,mt:mtHtml,hc:hcHtml,bk:bkHtml,cfg:cfgHtml,conta:pmContaHtml}[n]||homePac;
  const content=fn();
  return `<div class="ov-content-inner">${content}</div>`;
}
function ovShell(content,active){
  return `<div class="ov-shell">${ovTop()}${ovSidebar(active)}<div id="oral-mobile-nav" class="ov-mobile-nav">${ovSidebar(active)}</div><main class="ov-content"><div id="valAlert">${valAlertHtml()}</div>${content}</main></div>`;
}

function listHtml(){
  const l=db.p.filter(p=>!p.arq&&p.nome.toLowerCase().indexOf(q.toLowerCase())>-1).sort((a,b)=>a.nome.localeCompare(b.nome));
  const tot=db.p.filter(p=>!p.arq).length;
  if(!tot)return '<div class="empty">Nenhum paciente cadastrado ainda.</div>';
  if(!l.length)return '<div class="empty">Nenhum paciente encontrado.</div>';
  return l.map(p=>`<button class="pt" data-act="open" data-id="${p.id}"><span>${esc(p.nome)}<small>${esc(pvFmtTel(p.tel)||'Sem telefone')}</small></span><span class="badge">${p.orcs.length} orç.</span></button>`).join('');
}
function homePac(){
  const active=db.p.filter(p=>!p.arq);
  const pending=(db.vd||[]).filter(v=>saldoV(v)>0.005);
  const pendingIds=new Set(pending.map(v=>v.pid));
  const filtered=active.filter(p=>{
    const match=p.nome.toLowerCase().includes(String(q||'').toLowerCase().trim());
    const pend=!view.pendOnly||pendingIds.has(p.id);
    return match&&pend;
  }).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  const novo=view.novoPac?`<div class="card ov-patient-form"><h2>Adicionar novo paciente</h2><label for="nn">Nome completo</label><input id="nn" autocomplete="off" placeholder="Digite o nome para buscar ou cadastrar"><div class="row" style="align-items:flex-start"><div style="min-width:0"><label for="nc">CPF (opcional)</label><input id="nc" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" maxlength="14"></div><div style="min-width:0"><label for="nt">Telefone</label><input id="nt" type="tel" inputmode="tel" autocomplete="off" placeholder="(00) 00000-0000" maxlength="15"></div></div><div id="pvBox"></div><div class="row" style="margin-top:12px"><button id="pvAdd" data-act="add" style="flex:1" disabled>Cadastrar paciente</button><button class="ghost" data-act="cancelNovoPac" style="flex:1">Cancelar</button></div></div>`:'';
  const pageSize=50, pages=Math.max(1,Math.ceil(filtered.length/pageSize));
  view.pPage=Math.min(Math.max(0,Number(view.pPage)||0),pages-1);
  const pageRows=filtered.slice(view.pPage*pageSize,(view.pPage+1)*pageSize);
  const rows=pageRows.length?pageRows.map(p=>`<button class="ov-patient-row" data-act="open" data-id="${p.id}"><span><span class="ov-patient-row-name">${esc(p.nome)}</span><small>${esc(pvFmtTel(p.tel)||'Sem telefone')}</small></span><span class="ov-patient-arrow">›</span></button>`).join(''):`<div class="ov-patient-empty">${active.length?'Nenhum paciente encontrado.':'Nenhum paciente cadastrado ainda.'}</div>`;
  const pager=filtered.length>pageSize?`<div class="row ov-patient-pager" style="justify-content:space-between;margin-top:12px"><span class="note" style="margin:0">Página ${view.pPage+1} de ${pages} · ${filtered.length} pacientes</span><span class="row" style="flex:none;gap:6px"><button class="ghost sm" data-act="pPage" data-p="${view.pPage-1}"${view.pPage===0?' disabled':''}>Anterior</button><button class="ghost sm" data-act="pPage" data-p="${view.pPage+1}"${view.pPage>=pages-1?' disabled':''}>Próxima</button></span></div>`:'';
  return `<div class="ov-patients-page">
    <div class="ov-page-head"><div><h1>Pacientes</h1><p class="sub">Home</p></div></div>
    ${novo}
    <section class="ov-patients-panel">
      <div class="ov-patients-head">
        <div class="ov-patients-count">${active.length} ${active.length===1?'paciente':'pacientes'}</div>
        <div class="ov-patients-actions"><button class="ov-patients-settings" aria-label="Configurações">⚙</button><button class="ov-new-patient" data-act="novoPac">Novo Paciente <b>+</b></button></div>
      </div>
      <div class="ov-patient-search"><input id="q" type="search" placeholder="Pesquisar pelo nome" value="${esc(q)}" aria-label="Pesquisar pelo nome"></div>
      <div class="ov-patient-filter"><span>Filtrar:</span><label><input id="pendOnly" type="checkbox" ${view.pendOnly?'checked':''}> Pacientes com pagamento pendente</label></div>
    </section>
    <div class="ov-patient-list" id="list">${rows}</div>${pager}
  </div>`;
}

