/* ===== campos em reais: mostram "R$ 1.234,56" e viram número simples ao digitar ===== */
const MONEY_ID=['tnv','tnc','mtp','vv','vr','vrc','obv','obr','obc','oab'];
function isMoney(el){
  if(!el||el.tagName!=='INPUT'||el.type==='date'||el.type==='checkbox')return false;
  if(MONEY_ID.includes(el.id))return true;
  const ds=el.dataset||{},f=ds.f;
  if('rcv' in ds||'cpv' in ds)return true;
  if(ds.o!==undefined)return f==='valor'||f==='desc';
  if(ds.tr!==undefined)return f==='valor'||f==='custo';
  if(ds.tt!==undefined||ds.tu!==undefined)return f==='val';
  if(ds.mt!==undefined)return f==='preco';
  if(ds.h!==undefined)return ['alu','eqp','luz','net','fix','pl'].includes(ds.h);
  if(ds.p!==undefined){
    if(['preco','custo','mat','lab'].includes(f))return true;
    if(f==='par'){const s=document.querySelector(`select[data-p="${ds.p}"][data-f="parTipo"]`);return !s||s.value!=='pct'}
  }
  return false;
}
function moneyFmt(el){const v=String(el.value).trim();if(v===''){if(!el.placeholder||el.placeholder==='R$'||el.placeholder==='Valor')el.placeholder='R$ 0,00';return}el.value=brl(num(v))}
function fmtMoney(root){(root||document).querySelectorAll('input').forEach(el=>{if(el!==document.activeElement&&isMoney(el))moneyFmt(el)})}
document.addEventListener('focusin',e=>{const el=e.target;if(isMoney(el)&&String(el.value).trim()!==''){const n=num(el.value);el.value=n?String(r2(n)).replace('.',','):''}});
document.addEventListener('focusout',e=>{const el=e.target;if(isMoney(el))moneyFmt(el)});

const cur=()=>db.p.find(x=>x.id===view.id);
const procBy=n=>db.pr.find(m=>m.nome===n);
const qOf=x=>{const q=Math.round(num(x&&x.qtd));return q>1?q:1};
/* valor unitário × quantidade = total (unit é recalculado se o total foi editado à mão) */
function itMult(i){const q=qOf(i),tot=num(i.valor);if(q>1){let u=num(i.unit);if(!(u>0)||Math.abs(r2(u*q)-r2(tot))>0.011)u=r2(tot/q);return {q,u,t:tot}}return {q:1,u:tot,t:tot}}
const dLab=d=>/[,;\s]/.test(String(d||'').trim())?'dentes':'dente';
function trGrp(x,f){
  const q=qOf(x);if(q<2)return;
  if(f==='valor'){x.unit=r2(num(x.valor)/q)}
  else if(f==='dente'){const n=String(x.dente||'').split(/[,;\s]+/).filter(Boolean).length,u=num(x.unit)||r2(num(x.valor)/q);x.unit=u;if(n>=2){x.qtd=n;x.valor=String(r2(u*n))}else{x.qtd=0;x.valor=String(r2(u))}}
}
const sub=o=>o.itens.reduce((s,i)=>s+num(i.valor),0);
const total=o=>Math.max(0,sub(o)-num(o.desc));
const fac=o=>{const s=sub(o);return s>0?total(o)/s:1};
const dName=id=>{const d=db.dt.find(x=>x.id===id);return d?d.nome:(id?'Dentista removido':'Sem dentista')};
const pName=id=>{const p=db.p.find(x=>x.id===id);return p?p.nome:'Paciente removido'};
const recebido=v=>v.pg.reduce((s,p)=>s+num(p.valor),0);
const saldoV=v=>Math.max(0,r2(num(v.valor)-recebido(v)));
const liberada=v=>{const val=num(v.valor);return val>0?num(v.rep)*Math.min(1,recebido(v)/val):0};
function defDt(){const a=db.dt.filter(d=>d.ativo!==false);return a.length===1?a[0].id:''}
function dentOpts(sel,blank){return (blank!==undefined?`<option value="">${blank}</option>`:'')+db.dt.filter(d=>d.ativo!==false||d.id===sel).map(d=>`<option value="${d.id}"${d.id===sel?' selected':''}>${esc(d.nome)}${d.ativo===false?' (arquivado)':''}</option>`).join('')}
function comCalc(dtId,procNome,valor,q){
  q=Math.max(1,Math.round(num(q))||1);
  const d=db.dt.find(x=>x.id===dtId),m=procBy(procNome),mat=m?num(m.mat):0,lab=m?num(m.lab):0,procCusto=m?num(m.custo):0;
  const h=hcCalc(db.hc);
  const min=m?num(m.min):0;
  const horaClinica=((m&&m.parc)?h.estr:h.custo)*min/60;
  const custoTotal=(procCusto+mat+lab+horaClinica)*q;
  const baseLiquida=Math.max(0,valor-custoTotal);
  let rep=0;
  if(d&&d.modo!=='nenhum'){
    if(d.modo==='fixo'&&m&&num(m.par)>0)rep=num(m.par)*q;
    else{rep=baseLiquida*num(d.pct)/100}
  }
  return {rep:r2(rep),mat:mat*q,lab:lab*q,procCusto:r2(procCusto*q),horaClinica:r2(horaClinica*q),custoTotal:r2(custoTotal),baseLiquida:r2(baseLiquida)};
}
function dtTot(id){
  const s=db.vd.filter(x=>x.dt===id),g=sum(s,'rep'),l=s.reduce((a,x)=>a+liberada(x),0),p=sum(db.cp.filter(c=>c.dt===id),'valor');
  return {g,l,p,apagar:Math.max(0,r2(l-p)),prev:Math.max(0,r2(g-l)),exc:Math.max(0,r2(p-l))};
}
function dtMoves(id){return db.vd.some(v=>v.dt===id)||db.cp.some(c=>c.dt===id)||db.ag.some(a=>a.dt===id)||db.p.some(p=>p.orcs.some(o=>o.itens.some(i=>i.dt===id)))}
function hcFix(h){return num(h.alu)+num(h.eqp)+num(h.luz)+num(h.net)+num(h.fix)}
function hcCalc(h){
  const hrs=num(h.dias)*num(h.hdia)*4.33*(num(h.occ)/100),fx=num(h.alu)+num(h.eqp)+num(h.luz)+num(h.net)+num(h.fix),pl=num(h.pl);
  const custo=hrs?(fx+pl)/hrs:0,estr=hrs?fx/hrs:0,pv=(num(h.mg)+num(h.imp)+num(h.cart))/100;
  return {hrs,custo,estr,pv,preco:pv<1?custo/(1-pv):0};
}
/* ===== materiais ===== */
/* ===== validade dos materiais ===== */
const MT_ALERTA_DIAS=30;
function mtDias(m){
  if(!m||!m.val)return null;
  const a=Date.parse(m.val+'T00:00:00Z'),b=Date.parse(tdy()+'T00:00:00Z');
  if(isNaN(a))return null;
  return Math.round((a-b)/86400000);
}
function mtStatus(m){
  const d=mtDias(m);
  if(m.ret)return {k:'ret',txt:'Retirado do estoque',d};
  if(d===null)return {k:'sem',txt:'Sem validade',d};
  if(d<0)return {k:'venc',txt:'Vencido há '+(-d)+' dia'+(d===-1?'':'s'),d};
  if(d===0)return {k:'venc',txt:'Vence hoje',d};
  if(d<=MT_ALERTA_DIAS)return {k:'perto',txt:'Vence em '+d+' dia'+(d===1?'':'s'),d};
  return {k:'ok',txt:'Válido até '+fd(m.val),d};
}
function mtAlertas(){
  return (db.mt||[]).flatMap(m=>Array.isArray(m.lotes)&&m.lotes.length?m.lotes.filter(l=>!l.ret&&num(l.qtd)>0).map(l=>({...m,val:l.val,ret:false,_lote:l.id,_qtd:l.qtd})):(!Array.isArray(m.lotes)&&m.val?[m]:[])).filter(m=>{const k=mtStatus(m).k;return k==='venc'||k==='perto'}).sort((a,b)=>mtDias(a)-mtDias(b));
}
function valAlertHtml(){
  if(!pmSee('mt'))return '';
  const l=mtAlertas();
  if(!l.length)return '';
  const venc=l.filter(m=>mtStatus(m).k==='venc').length;
  const tit=venc?(venc+' material'+(venc===1?' vencido':'is vencidos')+(l.length>venc?' e '+(l.length-venc)+' próximo'+(l.length-venc===1?'':'s')+' do vencimento':'')):(l.length+' material'+(l.length===1?' próximo':'is próximos')+' do vencimento');
  return `<div class="val-alert${venc?' venc':''}" role="alert"><div class="val-alert-head"><strong>⚠ ${tit} — retirar do estoque</strong><button class="ghost sm" type="button" data-act="nav" data-t="mt">Ver Tabela de Materiais</button></div>
  <div class="val-alert-list">${l.map(m=>{const st=mtStatus(m);return `<div class="val-alert-item"><span><strong>${esc(m.nome||'Material')}</strong><small>${st.txt} · ${m._qtd?m._qtd+' '+m.un+' · ':''}validade ${fd(m.val)}</small></span><button class="danger sm" type="button" data-act="retmt" data-id="${m.id}">Retirei do estoque</button></div>`}).join('')}</div></div>`;
}

const UNS=['un','ml','g','par','cm','caixa','tubo','seringa'];
const brl4=n=>(Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:4});
const mtUnit=m=>num(m.qtd)>0?num(m.preco)/num(m.qtd):0;
const mtBy=id=>(db.mt||[]).find(m=>m.id===id);
function matCostIn(x,mt){return (x.mats||[]).reduce((s,r)=>{const m=(mt||[]).find(y=>y.id===r.mid);return s+(m?mtUnit(m)*num(r.q):0)},0)}
const matCost=x=>matCostIn(x,db.mt);
function syncMat(x){if((x.mats||[]).length)x.mat=r2(matCost(x)).toFixed(2)}
const mtUsage=id=>db.pr.filter(x=>(x.mats||[]).some(r=>r.mid===id));
const procCustoBase=m=>num(m.custo)+num(m.mat)+num(m.lab);
function matSnap(m){return (m.mats||[]).map(r=>{const t=mtBy(r.mid);return t?{nome:t.nome,un:t.un,q:num(r.q),unit:mtUnit(t),sub:r2(mtUnit(t)*num(r.q))}:null}).filter(Boolean)}
function matLines(arr){return arr.map(a=>`<div class="pg" style="border:0;padding:2px 0"><span>${esc(a.nome)} × ${String(a.q).replace('.',',')} ${esc(a.un)}</span><span>${brl(a.sub)}</span></div>`).join('')}
function prCalc(x){
  const h=hcCalc(db.hc),parc=!!x.parc,ch=(parc?h.estr:h.custo)*num(x.min)/60;
  const parVal=parc?num(x.par):0,mat=num(x.mat),lab=num(x.lab),parPct=parc&&x.parTipo==='pct'?parVal:0;
  const par=parc&&x.parTipo!=='pct'?parVal:0;
  // A comissão percentual é calculada somente depois de descontar
  // custo do procedimento + hora clínica + materiais + laboratório do valor cobrado.
  const comPct=(parc&&parPct>0)?parPct:(parc&&!par)?num(db.hc.com):0;
  const impPct=num(db.hc.imp),cartPct=num(db.hc.cart),mgPct=num(db.hc.mg);
  const preco=num(x.preco);
  const procCusto=num(x.custo);
  const custoExecucao=procCusto+ch+mat+lab;
  const baseLiquida=Math.max(0,preco-custoExecucao);
  const comValorPct=baseLiquida*comPct/100;
  const outrosPct=(impPct+cartPct)/100;
  const custosFixos=custoExecucao+par;
  const lu=preco-custosFixos-comValorPct-preco*outrosPct;
  // Preço sugerido considerando comissão sobre a base líquida após todos os custos de execução.
  const den=1-outrosPct-(comPct/100)-mgPct/100;
  const sug=den>0.01?((custoExecucao)*(1-comPct/100)+par)/den:0;
  return {ch,mat,lab,procCusto,fixo:custosFixos,par,parPct,pct:(impPct+cartPct+comPct)/100,comPct,custoExecucao,comBase:baseLiquida,comValorPct,lu,mg:preco?lu/preco*100:0,sug,ok:den>0.01};
}

