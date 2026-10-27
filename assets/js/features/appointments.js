/* ===== agenda ===== */
function confl(n){
  return db.ag.find(a=>a.id!==n.id&&a.data===n.data&&['Cancelado','Faltou'].indexOf(a.st)<0&&((a.cadeira||'1')===String(n.cadeira||'1')||(a.dt&&n.dt&&a.dt===n.dt))&&mins(a.hora)<mins(n.hora)+n.dur&&mins(n.hora)<mins(a.hora)+(a.dur||30));
}
function agDefaults(date){
  const now=new Date(),isToday=date===tdy();
  let m=isToday?Math.ceil((now.getHours()*60+now.getMinutes())/30)*30:8*60;
  if(m>23*60+30)m=23*60+30;
  const hora=hm(m);
  const busy=c=>db.ag.some(a=>a.data===date&&['Cancelado','Faltou'].indexOf(a.st)<0&&String(a.cadeira||'1')===c&&mins(a.hora)<m+30&&m<mins(a.hora)+(a.dur||30));
  return {hora,cad:busy('1')&&!busy('2')?'2':'1'};
}
const agNorm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function agSug(){
  const i=$('apn'),box=$('apsug');if(!i||!box)return;
  const q=agNorm(i.value),pts=db.p.filter(p=>!p.arq);
  const hit=pts.find(p=>agNorm(p.nome)===q);
  $('ap').value=hit&&q?hit.id:'';
  if(!q){box.hidden=true;box.innerHTML='';return}
  const list=pts.filter(p=>agNorm(p.nome).includes(q)).sort((a,b)=>{const sa=agNorm(a.nome).startsWith(q)?0:1,sb=agNorm(b.nome).startsWith(q)?0:1;return sa-sb||a.nome.localeCompare(b.nome)}).slice(0,8);
  box.innerHTML=list.length?list.map(p=>`<button type="button" class="ag-sug-i" data-act="agpick" data-id="${p.id}">${esc(p.nome)}</button>`).join(''):'<div class="ag-sug-n">Nenhum paciente encontrado</div>';
  box.hidden=false;
  if(hit)agAuto(hit.id);
}
function agAuto(pid){
  const t=$('atp');if(!t||(t.value&&t.dataset.auto!=='1'))return;
  const p=db.p.find(x=>x.id===pid);
  const ja=db.ag.some(a=>a.pid===pid&&a.st!=='Cancelado')||(p&&((p.evol||[]).length||0)>0);
  t.value=ja?'Retorno':'Primeira consulta';t.dataset.auto='1';
}
document.addEventListener('input',e=>{const t=e.target;
  if(t.id==='apn')agSug();
  else if(t.id==='atp')delete t.dataset.auto;
  else if(t.id==='ah'||t.id==='acadeira'||t.id==='ad')t.dataset.touched='1';
});
document.addEventListener('change',e=>{const t=e.target;if(t.id==='ah'||t.id==='acadeira'||t.id==='ad')t.dataset.touched='1'});
document.addEventListener('focusin',e=>{const t=e.target;
  if(t.id==='apn'){
    const h=$('ah'),c=$('acadeira'),d=$('ad');
    if(h&&c&&d&&!h.dataset.touched&&!c.dataset.touched&&!d.dataset.touched){const f=agDefaults(d.value);h.value=f.hora;c.value=f.cad}
    if(t.value)agSug();
  }
});
document.addEventListener('click',e=>{const box=$('apsug');if(box&&!box.hidden&&!e.target.closest('#apsug')&&e.target.id!=='apn')box.hidden=true});
document.addEventListener('input',e=>{const t=e.target;
  if(t.id==='nc'||(t.dataset&&t.dataset.k==='cpf'))pvApplyMask(t,pvMaskCpf);
  if(t.id==='nt'||(t.dataset&&t.dataset.k==='tel'))pvApplyMask(t,pvMaskTel);
  if(t.id==='nn'||t.id==='nc'||t.id==='nt')pvRender();
});
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.pv-hit');if(b)view.novoPac=false},true);
document.addEventListener('input',e=>{const t=e.target;if(t.id==='rxTexto'&&view.rx){view.rx.texto=t.value;view.rx.edited=true}});
document.addEventListener('change',e=>{const t=e.target,p=cur();
  if(!p||!view.rx)return;
  if(t.id==='rxModelo'){view.rx.model=t.value;view.rx.texto=rxGen(p,t.value);view.rx.edited=false;render()}
  else if(t.id==='rxDent'){view.rx.dt=t.value;render()}
  else if(t.id==='rxData'){view.rx.data=t.value||tdy()}
});
/* nome do paciente na agenda: clicável (abre o prontuário) quando o usuário pode ver pacientes */
function agPatient(a){
  const nome=esc(pName(a.pid));
  const pode=(typeof pmLvl!=='function'||pmLvl('pac')>=1)&&db.p.some(p=>String(p.id)===String(a.pid));
  return pode?`<button type="button" class="ag-patient ag-patient-link" data-act="open" data-id="${a.pid}" title="Abrir prontuário">${nome}</button>`:`<span class="ag-patient">${nome}</span>`;
}
function agHtml(){
  const today=tdy(),pts=db.p.filter(p=>!p.arq),dts=db.dt.filter(d=>d.ativo!==false);
  const date=view.agDate||today, dent=view.agDent||'todos';
  const agDef=agDefaults(date);
  const form=pts.length?`<div class="card"><h2>Nova consulta</h2><div class="row"><div style="flex:2;position:relative"><label for="apn">Paciente</label><input id="apn" type="search" autocomplete="off" autocapitalize="words" placeholder="Digite o nome do paciente"><input type="hidden" id="ap" value=""><div id="apsug" class="ag-sug" hidden></div></div><div><label for="adn">Dentista</label><select id="adn">${dentOpts(defDt(),'Dentista a definir')}</select></div></div><div class="row"><div><label for="ad">Data</label><input id="ad" type="date" value="${date}"></div><div><label for="ah">Hora</label><input id="ah" type="time" value="${agDef.hora}"></div><div><label for="adu">Duração (min)</label><input id="adu" inputmode="numeric" value="30"></div><div><label for="acadeira">Consultório</label><select id="acadeira"><option value="1"${agDef.cad==='1'?' selected':''}>Consultório 1</option><option value="2"${agDef.cad==='2'?' selected':''}>Consultório 2</option></select></div></div><div class="row"><div><label for="apr">Procedimento</label><input id="apr" list="prl" placeholder="Ex.: limpeza, canal" autocomplete="off">${prList()}</div><div><label for="atp">Tipo de consulta</label><input id="atp" list="atpl" placeholder="Primeira consulta, Retorno..." autocomplete="off" maxlength="40"><datalist id="atpl"><option value="Primeira consulta"><option value="Retorno"><option value="Avaliação"><option value="Manutenção"><option value="Urgência"></datalist></div></div><div style="margin-top:12px"><button data-act="addag" style="width:100%">Agendar consulta</button></div></div>`:'<div class="empty">Cadastre um paciente para agendar consultas.</div>';
  const list=db.ag.filter(a=>a.data===date&&(!a.st||!['Cancelado','Faltou'].includes(a.st))&&(dent==='todos'||a.dt===dent)).slice().sort((a,b)=>mins(a.hora)-mins(b.hora));
  const dateNav=retBanner()+`<div class="card" style="margin-bottom:12px"><div class="row" style="align-items:center;justify-content:space-between;flex-wrap:wrap"><div><strong>Agenda do dia</strong><div class="note" style="margin:2px 0 0">${fd(date)}</div></div><div class="row" style="margin:0;align-items:center"><button class="ghost sm" data-act="agdate" data-d="-1">‹</button><input id="agDate" type="date" value="${date}" style="width:auto;min-width:145px"><button class="ghost sm" data-act="agdate" data-d="1">›</button><button class="sm" data-act="agtoday">Hoje</button></div></div><div class="row" style="margin-top:12px;align-items:center"><div><label for="agDent">Dentista</label><select id="agDent"><option value="todos">Todos os dentistas</option>${dts.map(d=>`<option value="${d.id}"${dent===d.id?' selected':''}>${esc(d.nome)}</option>`).join('')}</select></div><div class="note" style="margin:0">Dois consultórios: cada atendimento ocupa um consultório e o dentista não pode ter dois horários sobrepostos.</div></div></div>`;
  const SLOT0=7*60,SLOT1=20*60,STEP=30;
  const apCard=a=>{const ok=!['Cancelado','Faltou'].includes(a.st),confirmed=a.st==='Confirmado'||a.st==='Compareceu';const sub=[dName(a.dt),a.proc].filter(Boolean).join(' · ');return `<div class="ag-appointment ${confirmed?'is-confirmed':''}"><div class="ag-appointment-main"><div class="ag-l1"><strong>${esc(a.hora)}–${hm(mins(a.hora)+(a.dur||30))}</strong><span>·</span>${agPatient(a)}${a.tipo?`<span class="ag-tipo t1">${esc(a.tipo)}</span>`:''}</div><span class="ag-status">${esc(a.st||'Agendado')}</span></div><div class="ag-meta ag-l2">${a.tipo?`<span class="ag-tipo t2">${esc(a.tipo)}</span> `:''}${esc(sub)}</div><div class="ag-actions">${!confirmed&&ok?`<button class="sm ag-confirm" data-act="agstatus" data-id="${a.id}">Confirmar</button>`:''}${a.st==='Confirmado'?`<button class="sm ag-confirm" data-act="agstatus" data-id="${a.id}"><span class="lg">Marcar compareceu</span><span class="sh">Compareceu</span></button>`:''}${a.vid?'<span class="badge stt-ok">Baixa feita</span>':(ok?`<button class="ghost sm" data-act="agbaixa" data-id="${a.id}"><span class="lg">Dar baixa</span><span class="sh">Baixa</span></button>`:'')}${ok&&!a.vid&&a.st!=='Compareceu'?`<button class="ghost sm" data-act="agfalta" data-id="${a.id}">Faltou</button>`:''}<button class="danger sm" data-act="rmag" data-id="${a.id}" title="Remover" aria-label="Remover">✕</button></div></div>`};
  const ROW=96;
  const chairCard=(chair,label)=>{
    const rows=list.filter(a=>String(a.cadeira||'1')===chair);
    let T0=SLOT0,T1=SLOT1+STEP;
    rows.forEach(a=>{const s=mins(a.hora),e=Math.max(s+(a.dur||30),s+STEP);T0=Math.min(T0,Math.floor(s/STEP)*STEP);T1=Math.max(T1,Math.ceil(e/STEP)*STEP)});
    T1=Math.min(T1,24*60);
    const grid=[];
    const FREE=22,occ=m=>rows.some(a=>{const s0=mins(a.hora),e0=s0+(a.dur||30);return s0<m+STEP&&e0>m});
    const tops=[],hs=[];let acc=0;
    for(let m=T0;m<T1;m+=STEP){const o=occ(m),h=o?ROW:FREE;tops.push(acc);hs.push(h);acc+=h;
      grid.push(o?`<div class="slot has" style="height:${h}px"><div class="slot-h">${hm(m)}</div><div class="slot-b"></div></div>`:`<div class="slot thin" style="height:${h}px"><div class="slot-h">${hm(m)}</div><div class="slot-b"><button type="button" class="slot-free" data-act="agslot" data-h="${hm(m)}" data-c="${chair}">Livre</button></div></div>`)}
    const yOf=t=>{let k=Math.floor((t-T0)/STEP);k=Math.max(0,Math.min(hs.length-1,k));return tops[k]+((t-(T0+k*STEP))/STEP)*hs[k]};
    /* consultas lado a lado quando houver encaixe no mesmo horário */
    const items=[];let lanesEnd=[],cl=[],clEnd=0;
    const flush=()=>{cl.forEach(x=>{x.n=lanesEnd.length});items.push(...cl);cl=[];lanesEnd=[]};
    rows.forEach(a=>{const s0=mins(a.hora),s=Math.floor(s0/STEP)*STEP,e=Math.max(s0+(a.dur||30),s+STEP);if(cl.length&&s>=clEnd)flush();let l=lanesEnd.findIndex(x=>x<=s);if(l<0){l=lanesEnd.length;lanesEnd.push(e)}else lanesEnd[l]=e;clEnd=cl.length?Math.max(clEnd,e):e;cl.push({a,s,e,l})});flush();
    const blocks=items.map(x=>`<div class="ag-block${x.n>1?' ag-narrow':''}" style="top:${yOf(x.s)+1}px;height:${Math.max(ROW-2,yOf(x.e)-yOf(x.s)-2)}px;left:${x.l/x.n*100}%;width:${100/x.n}%">${apCard(x.a)}</div>`).join('');
    return `<section class="card" style="margin:0"><div class="ag"><span><strong>${label}</strong></span><span class="badge">${rows.length} atendimento${rows.length===1?'':'s'}</span></div><div class="slots ag-tgrid">${grid.join('')}<div class="ag-layer">${blocks}</div></div></section>`};
  return avsCardHtml()+dateNav+form+`<div class="ov-agenda-chairs">${chairCard('1','Consultório 1')}${chairCard('2','Consultório 2')}</div>`;
}
