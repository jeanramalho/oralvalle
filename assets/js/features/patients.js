/* ===== telas: paciente ===== */
function fld(k,lbl,p,type){const v=k==='cpf'?pvFmtCpf(p[k]):k==='tel'?pvFmtTel(p[k]):p[k];const ex=k==='cpf'?' inputmode="numeric" maxlength="14" placeholder="000.000.000-00"':k==='tel'?' maxlength="15" placeholder="(00) 00000-0000"':'';return `<label>${lbl}</label><input data-k="${k}" type="${type||'text'}"${ex} value="${esc(v)}">`}
function tabDados(p){
  p.tel=pvFmtTel(p.tel);p.cpf=pvFmtCpf(p.cpf);
  const aviso=delArm===p.id?'Toque de novo para excluir definitivamente':'Excluir definitivamente';
  return `<div class="card">${fld('nome','Nome completo',p)}<div class="row" style="align-items:flex-start"><div style="min-width:0">${fld('tel','Telefone',p,'tel')}</div><div style="min-width:0">${fld('cpf','CPF',p)}</div></div>${fld('nasc','Data de nascimento',p,'date')}<label>Observações</label><textarea data-k="obs">${esc(p.obs)}</textarea><div class="ov-ortho-toggle"><label style="display:flex;align-items:center;gap:10px;margin-top:16px;cursor:pointer"><input type="checkbox" data-ortho="1" ${p.orthoMensal?'checked':''} style="width:18px;height:18px;flex:none"><strong>Paciente em tratamento ortodôntico — retorno mensal</strong></label><p class="note" style="margin:6px 0 0 28px">Após 1 mês da última consulta realizada, o paciente aparecerá automaticamente em Lembretes → Ortodontia, se não houver consulta futura marcada.</p></div></div>
  <button class="ghost" data-act="arq" style="width:100%">${p.arq?'Reativar paciente':'Arquivar paciente'}</button>
  ${p.arq?`<p class="note" style="margin-top:16px">O prontuário normalmente precisa ser guardado por muitos anos (confira o prazo exigido pelo seu conselho). Prefira manter arquivado. A exclusão não é permitida se houver vendas ou consultas ligadas ao paciente.</p><button class="danger" data-act="del" style="width:100%">${aviso}</button>`:''}`;
}
function tabAnam(p){
  const a=p.anam||(p.anam={c:{},med:'',queixa:'',ultima:''});a.c=a.c||{};
  const extras=Object.keys(a.c).filter(c=>!CHECKS.includes(c)&&a.c[c]);
  const checks=CHECKS.map(c=>{const on=a.c[c];return `<label class="chk${on?' on':''}"><input type="checkbox" data-c="${esc(c)}"${on?' checked':''}>${esc(c)}</label>`}).join('');
  const custom=extras.map(c=>`<span class="ov-anam-extra"><span>${esc(c)}</span><button type="button" class="ov-anam-extra-remove" data-act="rmcomorb" data-name="${esc(c)}" aria-label="Remover ${esc(c)}" title="Remover condição">×</button></span>`).join('');
  return '<h2>Histórico de saúde</h2>'+checks+
  `<div class="ov-anam-custom"><label style="display:block">Outras comorbidades e condições de saúde</label><div class="ov-anam-extra-list">${custom||'<span class="note">Nenhuma condição adicional cadastrada.</span>'}</div><div class="ov-anam-extra-add"><input id="ov-new-comorb" maxlength="120" autocomplete="off" placeholder="Ex.: Asma, epilepsia, hipotireoidismo" aria-label="Nova comorbidade"><button type="button" data-act="addcomorb">+ Adicionar</button></div><p class="note" style="margin:6px 0">Cada condição adicionada aparece como um balão junto ao histórico de saúde e fica salva na anamnese.</p></div>`+
  `<label>Medicamentos em uso</label><textarea data-a="med">${esc(a.med)}</textarea><label>Queixa principal</label><textarea data-a="queixa">${esc(a.queixa)}</textarea><label>Última consulta ao dentista</label><input data-a="ultima" value="${esc(a.ultima)}">`+sigHtml(p);
}
function sigHtml(p){
  return `<h2 style="margin-top:22px">Termo e assinatura do paciente</h2><div class="termo">${esc(TERMO)}</div><canvas id="sig" width="600" height="220" aria-label="Área de assinatura"></canvas><button class="ghost sm" data-act="sigclr">Limpar assinatura</button><p class="note" id="sigst">${p.sign?'Assinatura salva'+(p.signDate?' em '+esc(p.signDate):'')+', junto com o texto acima.':'Peça para o paciente ler o termo e assinar com o dedo.'}</p><p class="note" style="margin-top:4px">Texto-modelo genérico. Peça a um advogado para revisar antes de usar de fato.</p>`;
}
function initSig(){
  const c=$('sig'),p=cur();if(!c||!p)return;
  if(window.OralCloudFiles&&!OralCloudFiles.signatureReady(p,'sign'))return;
  const x=c.getContext('2d');let dr=false;x.fillStyle='#fff';x.fillRect(0,0,600,220);x.lineWidth=3;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#3F4650';
  if(p.sign){const im=new Image();im.onload=()=>x.drawImage(im,0,0);im.src=p.sign}
  const pt=e=>{const r=c.getBoundingClientRect();return [(e.clientX-r.left)*600/r.width,(e.clientY-r.top)*220/r.height]};
  c.onpointerdown=e=>{e.preventDefault();dr=true;try{c.setPointerCapture(e.pointerId)}catch(_){}const a=pt(e);x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(a[0]+.1,a[1]);x.stroke()};
  c.onpointermove=e=>{if(!dr)return;const a=pt(e);x.lineTo(a[0],a[1]);x.stroke()};
  c.onpointerup=c.onpointercancel=()=>{if(!dr)return;dr=false;const values={sign:c.toDataURL('image/png'),signDate:new Date().toLocaleString('pt-BR'),signTermo:TERMO};if(window.OralCloudFiles){OralCloudFiles.signature(p,'sign',values).catch(error=>toast(error.message,5000));return}Object.assign(p,values);save();$('sigst').textContent='Assinatura salva em '+p.signDate+', junto com o texto do termo.'};
}
function initEvolSig(){
  const c=$('evsig'),p=cur();if(!c||!p)return;
  if(window.OralCloudFiles&&!OralCloudFiles.signatureReady(p,'evolSign'))return;
  const x=c.getContext('2d');let dr=false;x.fillStyle='#fff';x.fillRect(0,0,600,180);x.lineWidth=3;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#3F4650';
  if(p.evolSign){const im=new Image();im.onload=()=>x.drawImage(im,0,0);im.src=p.evolSign}
  const pt=e=>{const r=c.getBoundingClientRect();return [(e.clientX-r.left)*600/r.width,(e.clientY-r.top)*180/r.height]};
  c.onpointerdown=e=>{e.preventDefault();dr=true;try{c.setPointerCapture(e.pointerId)}catch(_){}const a=pt(e);x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(a[0]+.1,a[1]);x.stroke()};
  c.onpointermove=e=>{if(!dr)return;e.preventDefault();const a=pt(e);x.lineTo(a[0],a[1]);x.stroke()};
  c.onpointerup=c.onpointercancel=()=>{if(!dr)return;dr=false;const values={evolSign:c.toDataURL('image/png'),evolSignDate:new Date().toLocaleString('pt-BR')};if(window.OralCloudFiles){OralCloudFiles.signature(p,'evolSign',values).catch(error=>toast(error.message,5000));return}Object.assign(p,values);save();const st=$('evsigst');if(st)st.textContent='Assinatura salva em '+p.evolSignDate};
}
function ologHtml(p){
  const l=(p.olog||[]).slice(-8).reverse();
  if(!l.length)return '';
  return '<h2 style="margin-top:20px;font-size:16px">Últimas alterações</h2>'+l.map(e=>`<div class="pg"><span>${esc(e.d)} · dente ${e.n}</span><span>${ODO[e.de][0]} → ${ODO[e.pa][0]}</span></div>`).join('');
}
function dentesTodos(){return [].concat(...Object.values(ARC).map(k=>[].concat(...k.map(q=>q[1]))))}
function evolHtml(p,only){
  // Cada lançamento é um registro independente: nunca substituir a evolução anterior.
  const l=(p.evol||[]).filter(e=>!only||String(e.n||'').split(/[,;\s]+/).filter(Boolean).includes(String(only))).slice()
    .sort((x,y)=>String(y.data||'').localeCompare(String(x.data||''))||String(y.id||'').localeCompare(String(x.id||'')));
  if(!l.length)return '<p class="note" style="margin:6px 0">Nenhum registro ainda.</p>';
  let h='',d='',idx=0;
  l.forEach(e=>{
    if(e.data!==d){d=e.data;h+=`<div class="evd">${fd(d)}</div>`}
    idx++;
    h+=`<div class="ag evi" style="align-items:flex-start;gap:12px;padding:12px;margin:6px 0;border:1px solid var(--line);border-radius:10px;background:var(--card)">
      <span style="flex:1;min-width:0"><small class="note" style="display:block;margin:0 0 4px">Registro ${idx}${e.n?' · '+(dLab(e.n)==='dentes'?'Dentes ':'Dente ')+esc(e.n):' · Geral'}${e.auto?' · Baixa do atendimento':''}</small><span style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(e.txt||'')}</span></span>
      <button class="danger sm" data-act="rmevol" data-id="${e.id}">${delArm===e.id?'Confirmar':'Excluir'}</button></div>`;
  });
  return h;
}
function toothPanel(p){
  const sel=view.tsel;
  if(!sel)return '<div class="card empty">Toque em um dente para ver a situação e registrar o que precisa ser feito nele.</div>';
  const v=(p.odo||{})[sel]||0,pl=(p.dplan||[]).filter(x=>String(x.n)===String(sel));
  const aF=pl.filter(x=>!x.feito),fe=pl.filter(x=>x.feito);
  return `<div class="card"><h2>Dente ${sel}</h2>
  <label>Situação</label><div class="sit">${ODO.map((x,i)=>`<button class="sm ${i===v?(x[1]||''):'ghost'}" data-act="tsit" data-v="${i}">${x[0]}</button>`).join('')}</div>
  <label>O que precisa ser feito</label>
  ${aF.length?aF.map(x=>`<div class="ag evi"><span>${esc(x.txt)}<small class="note" style="display:block;margin:0">Anotado em ${fd(x.data)}</small></span><span class="row" style="flex:none"><button class="sm" data-act="planok" data-id="${x.id}">Feito hoje</button><button class="danger sm" data-act="rmplan" data-id="${x.id}">${delArm===x.id?'Confirmar':'Excluir'}</button></span></div>`).join(''):'<p class="note" style="margin:0 0 6px">Nada pendente neste dente.</p>'}
  <div class="row" style="margin-top:8px"><input id="dpt" placeholder="Ex.: restauração na face oclusal" autocomplete="off" aria-label="O que precisa ser feito"><button data-act="addplan">Adicionar</button></div>
  ${fe.length?`<details style="margin-top:8px"><summary>Já realizado (${fe.length})</summary>${fe.map(x=>`<div class="pg"><span>${esc(x.txt)}</span><span>${fd(x.fdata)}</span></div>`).join('')}</details>`:''}
  <h2 style="font-size:16px;margin-top:16px">Evolução do dente ${sel}</h2>${evolHtml(p,sel)}</div>`;
}
function tabAgd(p){
  const ags=db.ag.filter(a=>a.pid===p.id).slice().sort((x,y)=>String(y.data||'').localeCompare(String(x.data||''))||mins(y.hora)-mins(x.hora));
  const st=a=>a.st||'Agendado',hoje=tdy();
  const comp=ags.filter(a=>st(a)==='Compareceu').length,falt=ags.filter(a=>st(a)==='Faltou').length,canc=ags.filter(a=>st(a)==='Cancelado').length;
  const prox=ags.filter(a=>a.data>=hoje&&['Agendado','Confirmado'].includes(st(a))).length;
  const box=(n,l,c)=>`<div style="flex:1;min-width:110px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card)"><div style="font-size:22px;font-weight:800;${c?'color:'+c:''}">${n}</div><div class="note" style="margin:0">${l}</div></div>`;
  const resumo=`<div class="row" style="gap:8px;margin-bottom:12px">${box(comp,'Atendimentos realizados','#D96A00')}${box(falt,'Faltas','#c0392b')}${box(canc,'Cancelamentos')}${box(prox,'Próximos agendados')}</div>`;
  const cls=x=>x==='Compareceu'||x==='Confirmado'?'badge stt-ok':x==='Faltou'?'badge stt-wr':'badge';
  const itens=ags.map(a=>{
    const s=st(a),inativo=s==='Faltou'||s==='Cancelado',ev=(p.evol||[]).some(e=>e.ag===a.id||(a.vid&&e.vid===a.vid));
    const fim=hm(mins(a.hora)+(a.dur||30));
    return `<div class="ag-appointment${s==='Compareceu'||s==='Confirmado'?' is-confirmed':''}" style="margin:6px 0${inativo?';opacity:.8':''}"><div class="ag-appointment-main"><div><strong>${esc(fd(a.data))} · ${esc(a.hora)}–${fim}</strong>${a.proc?' <span class="ag-proc">· '+esc(a.proc)+'</span>':''}${a.tipo?' <span class="ag-tipo">'+esc(a.tipo)+'</span>':''}<div class="ag-meta">${esc(dName(a.dt))} · Consultório ${esc(a.cadeira||'1')}${ev?' · Lançado na evolução':''}</div></div><span class="${cls(s)}">${esc(s)}</span></div><div class="ag-actions">${!inativo&&!a.vid?`<button class="ghost sm" data-act="agbaixa" data-id="${a.id}">Dar baixa</button>`:''}${a.vid?'<span class="badge stt-ok">Baixa feita</span>':''}${!inativo&&!a.vid&&s!=='Compareceu'?`<button class="ghost sm" data-act="agfalta" data-id="${a.id}">Marcar falta</button><button class="ghost sm" data-act="agcancel" data-id="${a.id}">Cancelar</button>`:''}${inativo?`<button class="ghost sm" data-act="agreativ" data-id="${a.id}">Reativar</button>`:''}</div></div>`}).join('');
  return `<div class="card"><h2>Agendamentos do paciente</h2><p class="note">Todos os atendimentos, faltas e cancelamentos. Ao dar baixa, o atendimento é lançado automaticamente na aba Evolução.</p>${resumo}${itens||'<p class="note" style="margin:6px 0">Nenhum agendamento para este paciente.</p>'}</div>`;
}
function evPendHtml(p){
  const l=(p.trat||[]).filter(x=>!x.vid&&x.status!=='Concluído'&&x.status!=='Cancelado');
  const rows=l.map((x,ix)=>{const m=itMult(x);return `<div class="pr-card pr-compact"><div class="pr-head"><span class="pr-av" aria-hidden="true">${ix+1}</span><div class="pr-nm">${esc(x.proc||'Tratamento')}${x.dente?' · '+dLab(x.dente)+' '+esc(x.dente):' · Geral'}<small>${m.q>1?brl(m.u)+' × '+m.q+' = ':''}${brl(x.valor)} · ${esc(dName(x.dt))}</small></div><button class="sm" data-act="trbaixa" data-id="${x.id}">Dar baixa</button></div>${x.obs?`<small class="note" style="display:block;margin:8px 0 0">${esc(x.obs)}</small>`:''}</div>`}).join('');
  return `<div class="card"><h2 style="margin:0 0 4px">Procedimentos do tratamento (${l.length})</h2><p class="note" style="margin:0 0 6px">Os procedimentos lançados na aba Tratamentos aparecem aqui. Ao dar baixa, o procedimento é concluído, a venda e a comissão são lançadas e o registro entra na evolução.</p>${rows||'<p class="note" style="margin:6px 0">Nenhum procedimento pendente. Lance novos na aba Tratamentos.</p>'}</div>`;
}
function tabOdo(p){
  const o=p.odo||{},k=view.dent||'perm',sel=String(view.tsel||''),pend=new Set([...(p.dplan||[]).filter(x=>!x.feito).map(x=>String(x.n)),...(p.trat||[]).filter(x=>!x.vid&&x.status!=='Concluído'&&x.status!=='Cancelado').flatMap(x=>trTeeth(x))]);
  const arch=`<h2>Odontograma</h2><div class="row" style="margin-bottom:10px"><button class="sm${k==='perm'?'':' ghost'}" data-act="dent" data-t="perm">Permanentes</button><button class="sm${k==='dec'?'':' ghost'}" data-act="dent" data-t="dec">Decíduos (leite)</button></div><p class="sub">Toque em um dente para escolher. O ponto laranja indica serviço pendente.</p>`+
  ARC[k].map(qd=>`<strong style="font-size:14px">${qd[0]}</strong><div class="arc${k==='dec'?' d5':''}" style="margin-top:4px">${qd[1].map(n=>{const v=o[n]||0;return `<button class="th${v?' s'+v:''}${sel===String(n)?' sel':''}" data-act="tooth" data-n="${n}" aria-label="Dente ${n}"><b>${n}</b><span>${ODO[v][2]}</span>${pend.has(String(n))?'<i class="dot"></i>':''}</button>`}).join('')}</div>`).join('')+
  `<div class="lg">${ODO.map(x=>`<span class="${x[1]}">${x[2]?x[2]+' ':''}${x[0]}</span>`).join('')}</div>`;
  const opts='<option value="">Geral (sem dente específico)</option>'+dentesTodos().map(n=>`<option value="${n}"${sel===String(n)?' selected':''}>Dente ${n}</option>`).join('');
  const lan=`<div class="card" style="margin-top:14px"><h2>Lançar evolução do dia</h2>
  <div class="row"><div><label for="evd">Data</label><input id="evd" type="date" value="${tdy()}"></div><div><label for="evn">Dente</label><select id="evn">${opts}</select></div></div>
  <label for="evt">Procedimento realizado e descrição</label><textarea id="evt" placeholder="Descreva este procedimento, materiais, conduta e observações. Cada salvamento será arquivado como um registro separado."></textarea>
  <button data-act="addevol" style="width:100%;margin-top:10px">Salvar evolução</button></div>`;
  const hist=`<div class="card"><h2 style="margin:0 0 12px">Evolução do paciente, dia a dia</h2><p class="note">Cada vez que salvar uma evolução, ela ficará registrada separadamente no histórico, junto com a data e o dente informado. Os registros anteriores serão mantidos.</p>${evolHtml(p)}<h3 style="margin-top:20px">Assinatura do paciente</h3><p class="note">Peça ao paciente para assinar no espaço abaixo. A assinatura ficará salva junto ao prontuário e poderá sair na impressão da evolução.</p><canvas id="evsig" width="600" height="180" aria-label="Assinatura do paciente na evolução" style="display:block;width:100%;max-width:600px;height:180px;background:#fff;border:1px solid var(--line);border-radius:8px;touch-action:none"></canvas><div class="row" style="margin-top:8px"><button class="ghost sm" data-act="evsigclr">Limpar assinatura</button><span class="note" id="evsigst">${p.evolSign?"Assinatura salva"+(p.evolSignDate?" em "+esc(p.evolSignDate):""):"Assinatura ainda não registrada"}</span></div><div style="display:flex;justify-content:flex-end;margin-top:16px;padding-top:12px;border-top:1px solid var(--line)"><button class="sm" data-act="printevol">Imprimir evolução completa</button></div></div>`;
  const lg=(p.olog||[]).length?`<details><summary>Histórico de mudanças de situação</summary><div id="olog">${ologHtml(p)}</div></details>`:'';
  return `${evPendHtml(p)}<div class="odo-grid" style="margin-top:14px"><div>${arch}${lan}</div><div>${toothPanel(p)}${hist}${lg}</div></div>`;
}
function cpText(o,it){
  if(!it.dt)return 'Escolha o dentista que vai executar.';
  const v=num(it.valor)*fac(o);if(!(v>0))return '';
  return 'Comissão prevista: '+brl(comCalc(it.dt,it.proc,v,qOf(it)).rep);
}
function orcSum(o){
  const d=num(o.desc);
  return (d>0?`<div class="tot" style="font-size:15px;font-weight:600;border:0;margin:0;padding:3px 0"><span>Subtotal</span><span>${brl(sub(o))}</span></div><div class="tot" style="font-size:15px;font-weight:600;border:0;margin:0;padding:3px 0"><span>Desconto</span><span>− ${brl(d)}</span></div>`:'')+`<div class="tot"><span>Total</span><span>${brl(total(o))}</span></div>`;
}
function obLaunch(p,it,vv,rc,forma,data,rep){
  const proc=it.proc||'',mm=comCalc(it.dt,proc,vv,qOf(it));
  const v={id:uid(),pid:p.id,dt:it.dt,proc,valor:r2(vv),mat:mm.mat,lab:mm.lab,rep:r2(rep),data,pg:[]};
  if(rc>0)v.pg.push({id:uid(),data,valor:r2(rc),forma});
  it.vid=v.id;
  (p.trat||[]).forEach(t=>{if(t.oiid===it.id&&!t.vid){t.vid=v.id;t.status='Concluído';t.rep=v.rep;t.data=v.data}});
  (p.evol=p.evol||[]).push({id:uid(),data,n:it.dente?String(it.dente):'',txt:(proc||'Atendimento')+' — realizado por '+dName(it.dt)+'.',auto:true,vid:v.id});
  db.vd.push(v);return v;
}
function obAllHtml(o){
  if(o.status!=='Aprovado')return '';
  const pend=o.itens.filter(it=>!it.vid);
  if(!o.itens.length)return '';
  if(!pend.length)return '<div class="ob-st ob-all"><span class="badge stt-ok">Baixa feita</span> <span class="note" style="margin:0">Todos os itens deste orçamento já tiveram baixa.</span></div>';
  const val=it=>r2(num(it.valor)*fac(o)),tot=r2(pend.reduce((a,it)=>a+val(it),0));
  if(view.obxAll!==o.id)return `<div class="ob-all"><button class="sm" style="width:100%" data-act="oball" data-o="${o.id}">Dar baixa em todo o orçamento (${pend.length} ${pend.length===1?'item':'itens'} · ${brl(tot)})</button></div>`;
  return `<div class="ob-all"><div class="ob-pay"><h4>Dar baixa em todo o orçamento</h4>
  ${pend.map(it=>`<div class="ob-li"><span>${esc(it.proc||'Procedimento')}${it.dente?' · dente '+esc(it.dente):''}<br><span class="note" style="margin:0">${esc(dName(it.dt))}</span></span><strong>${brl(val(it))}</strong></div>`).join('')}
  <div class="tot" style="margin-top:6px"><span>Total da baixa</span><span>${brl(tot)}</span></div>
  <div class="row" style="align-items:flex-start"><div><label for="oab">Recebido agora (R$)</label><input id="oab" inputmode="decimal" value="${tot.toFixed(2)}"></div><div><label for="oaf">Forma</label><select id="oaf">${FORMAS.map(f=>`<option>${f}</option>`).join('')}</select></div></div>
  <p class="note" style="margin:6px 0 0">Cada item vira uma venda em Vendas, com a comissão do dentista calculada. O valor recebido é distribuído na ordem dos itens. Se o paciente ainda não pagou, coloque 0.</p>
  <label for="oad">Data</label><input id="oad" type="date" value="${tdy()}">
  <div class="row" style="margin-top:10px"><button data-act="oballconf" data-o="${o.id}" style="flex:1">Confirmar baixa de tudo</button><button class="ghost" data-act="obcancel" style="flex:none">Cancelar</button></div></div></div>`;
}
function obCalc(it,v){return it.dt&&v>0?comCalc(it.dt,it.proc||'',v,qOf(it)).rep:0}
function obPanel(o,it,i){
  const key=o.id+':'+it.id;
  if(it.vid){
    const v=db.vd.find(x=>x.id===it.vid);
    if(!v)return '';
    const rc=recebido(v),sd=saldoV(v),st=sd<=0?['Pago','stt-ok']:rc>0?['Parcial','']:['A receber','stt-wr'];
    return `<div class="ob-st"><div class="row" style="flex-wrap:wrap;gap:8px"><span class="badge ${st[1]}" style="flex:none">${st[0]}</span><span class="note" style="margin:0;flex:1">Recebido ${brl(rc)} de ${brl(v.valor)}${sd>0?' · falta '+brl(sd):''} · já aparece em Vendas</span></div>
    ${sd>0?`<div class="row" style="margin-top:8px"><input data-rcv="${v.id}" inputmode="decimal" value="${sd.toFixed(2)}" aria-label="Valor recebido"><select data-rcvf="${v.id}" aria-label="Forma de pagamento">${FORMAS.map(f=>`<option>${f}</option>`).join('')}</select><button class="sm" data-act="rcv" data-id="${v.id}">Receber</button></div>`:''}</div>`;
  }
  if(view.obx!==key)return '';
  const val=r2(num(it.valor)*fac(o)),cr=obCalc(it,val);
  return `<div class="ob-pay"><h4>Dar baixa: ${esc(it.proc||'procedimento')}</h4>
  <div class="row" style="align-items:flex-start"><div><label for="obv" style="margin-top:0">Valor (R$)</label><input id="obv" inputmode="decimal" value="${val.toFixed(2)}"></div><div><label for="obr" style="margin-top:0">Comissão (R$)</label><input id="obr" inputmode="decimal" value="${cr?cr.toFixed(2):''}"></div></div>
  <div class="row" style="align-items:flex-start"><div><label for="obc">Recebido agora (R$)</label><input id="obc" inputmode="decimal" value="${val.toFixed(2)}"></div><div><label for="obf">Forma</label><select id="obf">${FORMAS.map(f=>`<option>${f}</option>`).join('')}</select></div></div>
  <p class="note" style="margin:6px 0 0">Se o paciente ainda não pagou, coloque 0. A venda é lançada em Vendas e a comissão só é liberada conforme o paciente paga.</p>
  <label for="obd">Data</label><input id="obd" type="date" value="${tdy()}">
  <div class="row" style="margin-top:10px"><button data-act="obconf" data-o="${o.id}" data-i="${i}" style="flex:1">Confirmar baixa</button><button class="ghost" data-act="obcancel" style="flex:none">Cancelar</button></div></div>`;
}
function itemHtml(o,it,i){
  const base=`data-o="${o.id}" data-i="${i}"`;
  return `<div class="oitem"><div class="oitem-h"><span class="oitem-n">Item ${i+1}</span></div><div class="it"><input placeholder="Procedimento" list="prl" ${base} data-f="proc" value="${esc(it.proc)}"><input placeholder="Dente" inputmode="numeric" ${base} data-f="dente" value="${esc(it.dente)}"><input placeholder="R$" inputmode="decimal" ${base} data-f="valor" value="${esc(it.valor)}"><button class="danger sm" aria-label="Remover item" data-act="rmi" data-o="${o.id}" data-i="${i}">×</button></div>
  <input style="margin-bottom:6px" placeholder="O que precisa ser feito (aparece na impressão)" ${base} data-f="obs" value="${esc(it.obs||'')}">
  <div class="row" style="margin-bottom:4px"><select ${base} data-f="dt" aria-label="Dentista que vai executar">${dentOpts(it.dt,'Dentista a definir')}</select>${it.vid?'<span class="badge stt-ok" style="flex:none">Baixa feita</span>':(o.status==='Aprovado'&&view.obx!==o.id+':'+it.id?`<button class="sm" data-act="obaixa" data-o="${o.id}" data-i="${i}">Dar baixa</button>`:'')}</div>
  ${obPanel(o,it,i)}
  ${qOf(it)>1?(()=>{const m=itMult(it);return `<div class="note" style="margin:0 0 6px">${brl(m.u)} × ${m.q} dentes = ${brl(m.t)}</div>`})():''}
  <div class="note oitem-last" data-cpi="${o.id}:${i}">${esc(cpText(o,it))}</div></div>`;
}
function orcHtml(o){
  const open=!!(view.orcOpen&&view.orcOpen[o.id]),nIt=o.itens.length,stc=o.status==='Aprovado'?'stt-ok':o.status==='Pendente'?'stt-wr':'';
  const head=`<button type="button" class="orc-h" data-act="otoggle" data-o="${o.id}" aria-expanded="${open}"><span class="orc-chev" aria-hidden="true">${open?'▾':'▸'}</span><span class="orc-t"><strong>${esc(o.data)}</strong><small>${nIt} ${nIt===1?'item':'itens'} · toque para ${open?'recolher':'abrir'}</small></span><span class="badge ${stc}" style="flex:none">${esc(o.status)}</span><strong class="orc-tot" data-ototal>${brl(total(o))}</strong></button>`;
  return `<div class="card orc-card" data-oid="${o.id}">${head}${open?`<div class="orc-body"><div class="row" style="margin-bottom:10px"><span style="flex:1"><strong>${esc(o.data)}</strong><br><span class="note" style="margin:0">Criado em</span></span><select data-o="${o.id}" data-f="status" aria-label="Situação do orçamento">${['Pendente','Aprovado','Recusado'].map(s=>`<option${o.status===s?' selected':''}>${s}</option>`).join('')}</select></div>
  ${obAllHtml(o)}${o.itens.map((it,i)=>itemHtml(o,it,i)).join('')}
  <div class="row" style="margin-top:8px"><button class="ghost sm" data-act="addi" data-o="${o.id}">Adicionar item</button></div>
  <div class="row" style="align-items:flex-start"><div><label>Desconto (R$)</label><input data-o="${o.id}" data-f="desc" inputmode="decimal" value="${esc(o.desc)}"></div><div><label>Válido até</label><input type="date" data-o="${o.id}" data-f="val" value="${esc(o.val)}"></div></div>
  <label>Condições de pagamento</label><input data-o="${o.id}" data-f="cond" placeholder="Ex.: entrada + 3x no cartão" value="${esc(o.cond)}">
  <div data-sum>${orcSum(o)}</div>
  <div class="row" style="margin-top:12px;flex-wrap:wrap"><button class="ghost sm" data-act="copy" data-o="${o.id}">Copiar texto</button><button class="ghost sm" data-act="owa" data-o="${o.id}">WhatsApp</button><button class="sm" data-act="pdf" data-o="${o.id}">Baixar PDF</button><button class="ghost sm" data-act="print" data-o="${o.id}">Imprimir</button></div></div>`:''}</div>`;
}
const prList=()=>`<datalist id="prl">${db.pr.map(x=>`<option value="${esc(x.nome)}">`).join('')}</datalist>`;
function tratStatus(x){return x.status==='Concluído'?['Concluído','stt-ok']:x.status==='Cancelado'?['Cancelado','']:['Pendente','stt-wr'];}
function trTeeth(x){return String(x.dente||'').split(/[,;\s]+/).filter(Boolean)}
function trList(p){const f=view.trFlt||'';let l=p.trat||[];if(f==='none')l=l.filter(x=>!x.oid);else if(f)l=l.filter(x=>x.oid===f);return l}
function trStatusMap(l){const m={};l.forEach(x=>{if(x.status==='Cancelado')return;trTeeth(x).forEach(n=>{const s=m[n]=m[n]||{};if(x.status==='Concluído')s.d=1;else s.p=1})});return m}
const trColor=s=>!s?'':(s.d&&s.p)?'#FFB56B':s.d?'#E8741A':'#BDBDBD';
const TP={
  inc:{r:'M9 29Q10 12 15 3Q20 12 21 29',c:'M6 29H24Q25 42 22 49Q15 52 8 49Q5 42 6 29Z'},
  can:{r:'M10 29Q11 12 15 2Q19 12 20 29',c:'M7 29H23Q24 41 15 51Q6 41 7 29Z'},
  pre:{r:'M8 29Q8 14 12 5Q15 11 15 20Q15 11 18 5Q22 14 22 29',c:'M5 29H25Q26 42 21 48Q15 51 9 48Q4 42 5 29Z'},
  mol:{r:'M4 29Q3 14 7 3Q11 14 12 27Q15 19 18 27Q19 14 23 3Q27 14 26 29',c:'M3 29H27Q28 43 24 49Q15 53 6 49Q2 43 3 29Z'},
  mol2:{r:'M5 29Q4 14 7 4Q11 15 13 29M17 29Q19 15 23 4Q26 14 25 29',c:'M3 29H27Q28 43 24 49Q15 53 6 49Q2 43 3 29Z'}
};
function toothBtn(n,dec,st,sel,up){
  const d=n%10;
  let k=dec?(d<=2?'inc':d===3?'can':'mol'):(d<=2?'inc':d===3?'can':d<=5?'pre':'mol');
  if(k==='mol'&&!up)k='mol2';
  const col=trColor(st),fill=col||'var(--sf)',T=TP[k];
  const tooth=`<svg class="tsvg" viewBox="0 0 30 54" aria-hidden="true"><g${up?'':' transform="translate(0,54) scale(1,-1)"'} style="stroke:var(--mut);stroke-width:1.2;stroke-linejoin:round"><path d="${T.r}" style="fill:none"/><path d="${T.c}" style="fill:${fill}"/></g></svg>`;
  const occ=`<svg class="osvg" viewBox="0 0 24 24" aria-hidden="true"><g style="stroke:${col?'#fff':'var(--mut)'};stroke-width:1.3"><rect x="1.5" y="1.5" width="21" height="21" rx="7" style="fill:${fill}"/><circle cx="12" cy="12" r="4.5" style="fill:none"/><path d="M4.5 4.5l4 4M19.5 4.5l-4 4M4.5 19.5l4-4M19.5 19.5l-4-4" style="fill:none"/></g></svg>`;
  const lb=`<span class="tn">${n}</span>`;
  return `<button type="button" class="tt${sel?' sel':''}" data-act="ttsel" data-n="${n}" aria-label="Dente ${n}">${up?lb+tooth+occ:occ+tooth+lb}</button>`;
}
function odxHtml(p,l){
  const dec=(view.dent||'perm')==='dec',A=ARC[dec?'dec':'perm'],st=trStatusMap(l),sel=new Set((view.trSel||[]).map(String));
  const half=(qd,up,right)=>`<div class="odx-q${right?' r':''}" style="--n:${qd[1].length}">${qd[1].map(n=>toothBtn(n,dec,st[String(n)],sel.has(String(n)),up)).join('')}</div>`;
  return `<div class="odx-wrap"><div class="odx-in${dec?' dec':''}"><div class="odx">${half(A[0],true,false)}${half(A[1],true,true)}</div><div class="odx-hr"></div><div class="odx">${half(A[2],false,false)}${half(A[3],false,true)}</div></div></div>`;
}
function trChips(){
  const s=(view.trSel||[]).slice().sort((a,b)=>a-b);
  return s.length?'<span class="note" style="margin:0">Dentes selecionados:</span> '+s.map(n=>`<span class="badge stt-wr">${n}</span>`).join(' '):'<span class="note" style="margin:0">Toque nos dentes para escolher. Sem dente marcado, o tratamento é geral.</span>';
}

