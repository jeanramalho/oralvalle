/* ===== telas: início ===== */
function banner(){
  let h='';
  if(bad)h+='<div class="card bn"><strong>Os dados salvos estavam ilegíveis.</strong><br>Uma cópia foi guardada à parte no navegador. Se você tem um backup, restaure-o na aba Backup.</div>';
  if(mem)h+='<div class="card bn"><strong>Este navegador não está salvando os dados.</strong><br>Tudo o que você digitar será perdido ao fechar. Faça um backup agora.</div>';
  else if((db.p.length||db.vd.length)&&view.h!=='bk'){
    const bk=db.meta.bk,dias=bk?Math.floor((Date.now()-new Date(bk).getTime())/864e5):null;
    if(dias===null||dias>=7)h+=`<div class="card bn"><strong>${dias===null?'Você ainda não fez backup.':'Último backup há '+dias+' dias.'}</strong><br>Os dados ficam só neste navegador. <button class="ghost sm" data-act="nav" data-t="bk" style="margin-top:8px">Fazer backup</button></div>`;
  }
  return h;
}
const NAV=[['pac','Pacientes'],['ag','Agenda'],['vd','Vendas'],['dt','Dentistas'],['cm','Comissões'],['pr','Procedimentos'],['hc','Hora clínica'],['bk','Backup']];
function ovIcon(name){
  const P={
    ag:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
    pac:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    lem:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    dt:'<path d="M7 3C4.5 3 3 5 3 7.5c0 2 1 3.5 1.5 5.5.5 2 .7 4.5 1.5 7 .3 1 1.7 1 2-.2.4-1.8.8-4.3 2-4.3s1.6 2.5 2 4.3c.3 1.2 1.7 1.2 2 .2.8-2.5 1-5 1.5-7 .5-2 1.5-3.5 1.5-5.5C21 5 19.5 3 17 3c-1.8 0-3 1-5 1S8.8 3 7 3z"/>',
    cm:'<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    pg:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    vd:'<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M2 3h3l2.7 11.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"/>',
    hc:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pr:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 13 2 2 4-4"/>',
    mt:'<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3.3 7.5 12 12.5l8.7-5M12 22V12.5"/>',
    pf:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 10.5v7M14 12c-.4-.5-1.1-.8-2-.8-1.1 0-1.9.5-1.9 1.3 0 1.9 3.9.9 3.9 2.8 0 .8-.8 1.4-2 1.4-.9 0-1.6-.3-2-.8"/>',
    cfg:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    bk:'<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 11 3.7 3.7 0 0 1 18 18"/><path d="M12 20v-8M9 14.5l3-3 3 3"/>'
  };
  return P[name]?`<svg viewBox="0 0 24 24" aria-hidden="true">${P[name]}</svg>`:'•';
}
function lemPendN(){return (db.lem||[]).filter(x=>!x.feito).length+(typeof ovBirthdayToday==='function'?ovBirthdayToday().length:0)}
function ovSidebar(active){
  const item=(id,label,ic)=>!pmSee(id)?'':`<button class="ov-nav-btn${active===id?' on':''}" data-act="nav" data-t="${id}"><span class="ico">${ovIcon(ic||id)}</span><span>${label}</span>${id==='lem'&&lemPendN()?`<span class="nav-dot" title="Lembretes pendentes" aria-label="${lemPendN()} lembrete(s) pendente(s)">${lemPendN()}</span>`:''}${id==='mt'&&mtAlertas().length?`<span class="nav-dot" title="Materiais vencidos ou próximos do vencimento">${mtAlertas().length}</span>`:''}</button>`;
  return pmCleanSide(`<aside class="ov-sidebar">
    <div class="ov-side-title">Sorrir é o melhor tratamento</div>
    <div class="ov-section">Clínica</div>
    <nav class="ov-nav">
      ${item('ag','Agenda')}
      ${item('pac','Pacientes')}
      ${pmSee('lem')?`<button class="ov-nav-btn${active==='ortho'?' on':''}" data-act="orthonav"><span class="ico">◷</span><span>Ortodontia</span></button>`:''}
      ${pmSee('lem')?`<button class="ov-nav-btn${active==='impl'?' on':''}" data-act="implnav"><span class="ico">◈</span><span>Implantodontia</span></button>`:''}
      ${pmSee('lem')?`<button class="ov-nav-btn${active==='prot'?' on':''}" data-act="protnav"><span class="ico">◇</span><span>Prótese</span></button>`:''}
      ${item('lem','Lembretes')}
      ${item('wa','WhatsApp','pac')}
      ${item('sigdoc','Documentos e Assinaturas','pr')}
      ${item('dt','Dentistas')}
      ${item('cm','Comissões')}
      ${item('vd','Pagamentos Recebidos','pg')}
      ${item('vd','Vendas')}
      ${pmSee('vd')||pmSee('cm')||pmSee('pac')?`<button class="ov-nav-btn${active==='reports'?' on':''}" data-act="nav" data-t="reports"><span class="ico">▥</span><span>Relatórios</span></button>`:''}
    </nav>
    <div class="ov-section">Negociação</div>
    <nav class="ov-nav">
      ${item('pf','Proposta Financeira')}
    </nav>
    <div class="ov-section">Precificação</div>
    <nav class="ov-nav">
      ${item('hc','Custo Hora Clínica')}
      ${item('pr','Procedimentos')}
      ${item('mt','Tabela de Materiais')}
    </nav>
    <div class="ov-section">Controle</div>
    <nav class="ov-nav">${item('bk','Backup')}${item('cfg','Configurações')}${item('conta','Minha conta','pac')}</nav>
  </aside>`);
}
function topCl(){return Object.assign({},CL_DEF,db.cl||{})}
function ovTop(){
  return `<header class="ov-top"><button type="button" class="ov-mobile-menu" aria-label="Abrir menu" aria-expanded="false" aria-controls="oral-mobile-nav">☰ <span>Menu</span></button>
    <div class="ov-brand">
      <img class="nexo-header-symbol" src="./assets/img/nexodent-symbol.png" alt="" />
      <div class="nexo-header-name"><strong>Nexodent</strong><small>Sistema de Gestão Odontológica</small></div>
    </div>
    <div class="ov-user">
      <div class="ov-user-name">${esc(ME?ME.nome:'')} <span style="font-size:13px">⌄</span><small>${esc(topCl().marca)}</small></div>
      <div class="ov-top-icons"><button type="button" class="ov-sair" data-act="logout">Sair</button></div>
    </div>
  </header>`;
}
function ovDashboard(){
  const today=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long'});
  return `<div class="ov-page-head"><div><h1>Dashboard</h1><p class="sub">Visão geral da clínica</p></div></div>
  <div class="ov-quick">
    <button class="ov-tile light" data-act="nav" data-t="hc"><span class="ov-tile-icon">◷</span><span class="ov-tile-title">Custo Hora<br>Clínica</span></button>
    <button class="ov-tile" data-act="nav" data-t="pr"><span class="ov-tile-icon">♢</span><span class="ov-tile-title">Procedimentos</span></button>
      <button class="ov-tile" data-act="nav" data-t="pac"><span class="ov-tile-icon">▤</span><span class="ov-tile-title">Anamnese, Receita,<br>Atestado e Contrato</span></button>
  </div>
  <div class="ov-banner">Assine a melhor versão do <strong>QiDent</strong> para sua clínica ter <strong>lucro de verdade.</strong><button>Ver planos</button></div>
  <div class="ov-grid">
    <section class="ov-panel">
      <div class="ov-panel-head"><h2>Agenda do dia</h2><span class="ov-date">${today}</span></div>
      ${db.ag.filter(a=>a.data===tdy()).length?`<div>${db.ag.filter(a=>a.data===tdy()).slice(0,6).map(a=>`<div class="card"><strong>${esc(a.hora)} · ${esc(pName(a.pid))}</strong><div class="note">${esc(a.proc||'Consulta')} · ${esc(dName(a.dt))}</div></div>`).join('')}</div>`:
      `<div class="ov-agenda-empty"><div class="ov-empty-box"><div class="ov-empty-icon">♙</div><div class="ov-empty-title">Nenhum atendimento agendado</div><button class="ov-add" data-act="nav" data-t="ag">Agendar atendimento <b>+</b></button></div></div>`}
    </section>

  </div>`;
}
