/* Persistência local centralizada. Uma integração remota futura precisará aguardar a gravação. */
function defPr(){return [['Avaliação / consulta',30],['Limpeza (profilaxia)',40],['Restauração',50],['Tratamento de canal',90],['Extração',40],['Clareamento',60],['Coroa / prótese',60],['Implante',90]].map(a=>({id:uid(),nome:a[0],min:String(a[1]),mat:'',lab:'',custo:'',par:'',parTipo:'reais',preco:'',parc:false}))}
function migrate(d){
  if(!d||typeof d!=='object')d={};
  if(!Array.isArray(d.p))d.p=[];
  ['ag','dt','vd','cp','lem','alugueis'].forEach(k=>{if(!Array.isArray(d[k]))d[k]=[]});
  d.lem.forEach(x=>{if(!x.id)x.id=uid();if(x.titulo===undefined)x.titulo='';if(x.data===undefined)x.data='';if(x.hora===undefined)x.hora='';if(x.tipo===undefined)x.tipo='Geral';if(x.obs===undefined)x.obs='';if(x.feito===undefined)x.feito=false});
  if(!Array.isArray(d.pr))d.pr=defPr();
  if(!Array.isArray(d.mt))d.mt=[];
  if(!d.cl||typeof d.cl!=='object')d.cl={};
  Object.keys(CL_DEF).forEach(k=>{if(d.cl[k]===undefined)d.cl[k]=CL_DEF[k]});
  d.mt.forEach(m=>{if(!m.id)m.id=uid();if(m.nome===undefined)m.nome='';if(m.un===undefined)m.un='un';if(m.preco===undefined)m.preco='';if(m.qtd===undefined||m.qtd==='')m.qtd='1'});
  d.hc=d.hc||{fix:'',pl:'',dias:'5',hdia:'8',occ:'70',mg:'30'};
  ['imp','cart','com','alu','eqp','luz','net'].forEach(k=>{if(d.hc[k]===undefined)d.hc[k]=''});
  d.meta=d.meta||{bk:''};
  d.pr.forEach(x=>{if(!Array.isArray(x.mats))x.mats=[];if(x.mats.length)x.mat=r2(matCostIn(x,d.mt)).toFixed(2);if(x.parc===undefined)x.parc=num(x.par)>0;if(x.parTipo===undefined)x.parTipo='reais';if(x.custo===undefined)x.custo=r2(num(x.mat)+num(x.lab)).toFixed(2)});
  d.dt.forEach(x=>{if(!x.modo)x.modo='fixo';x.base=x.base||'bruto';if(x.ativo===undefined)x.ativo=true});
  d.p.forEach(p=>{
    p.tel=pvFmtTel(p.tel);p.cpf=pvFmtCpf(p.cpf);
    p.orcs=p.orcs||[];p.trat=p.trat||[];p.trat.forEach(t=>{if(!t.id)t.id=uid();if(t.status===undefined)t.status='Pendente';if(!Array.isArray(t.mats))t.mats=[];if(t.obs===undefined)t.obs='';if(t.valor===undefined)t.valor='';if(t.custo===undefined){const m=procBy(t.proc);t.custo=m?(m.custo||r2(num(m.mat)+num(m.lab)).toFixed(2)):''}if(t.dt===undefined)t.dt='';});p.anam=p.anam||{c:{},med:'',queixa:'',ultima:''};p.anam.c=p.anam.c||{};p.olog=p.olog||[];p.dplan=p.dplan||[];p.evol=p.evol||[];p.arq=!!p.arq;
    p.orcs.forEach(o=>{o.itens=o.itens||[];o.desc=o.desc||'';o.val=o.val||'';o.cond=o.cond||'';o.itens.forEach(i=>{if(!i.id)i.id=uid();if(i.dt===undefined)i.dt='';if(i.obs===undefined)i.obs=''})});
  });
  const paid={};
  d.vd.forEach(x=>{
    x.valor=num(x.valor);x.rep=num(x.rep);x.mat=num(x.mat);x.lab=num(x.lab);
    if(!Array.isArray(x.pg)){x.pg=[{id:uid(),data:x.data,valor:x.valor,forma:'Não informada'}];if(x.pago)paid[x.dt]=(paid[x.dt]||0)+x.rep}
    delete x.pago;
  });
  Object.keys(paid).forEach(k=>{if(paid[k]>0)d.cp.push({id:uid(),dt:k,data:tdy(),valor:r2(paid[k]),obs:'Migrado das vendas antigas'})});
  d.ag.forEach(a=>{if(!a.dur)a.dur=30;if(!a.st)a.st='Agendado';if(a.dt===undefined)a.dt='';if(typeof a.tipo!=='string')a.tipo='';if(a.cadeira===undefined||!['1','2'].includes(String(a.cadeira)))a.cadeira='1'});
  return d;
}
function load() {
  let stored = null;
  let data = null;
  try {
    stored = localStorage.getItem('consultorio');
  } catch (error) {
    mem = true;
  }
  if (stored) {
    try {
      data = JSON.parse(stored);
    } catch (error) {
      bad = true;
      // Preserva o conteúdo ilegível antes de iniciar um estado vazio.
      try { localStorage.setItem('consultorio_corrompido', stored); } catch (_) {}
    }
  }
  db = migrate(data);
  try {
    (db.p || []).forEach((patient) => {
      patient.cpf = pvFmtCpf(patient.cpf);
      patient.tel = pvFmtTel(patient.tel);
    });
  } catch (error) {}
  try {
    localStorage.setItem('consultorio_t', '1');
    localStorage.removeItem('consultorio_t');
  } catch (error) {
    mem = true;
  }
}
let lastSaved=null,lastSavedPid=null;
const hhmm=d=>d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
function saveStatText(p){return(p&&lastSaved&&lastSavedPid===p.id)?'✓ Tudo salvo às '+hhmm(lastSaved):'✓ Salva automaticamente'}
function updSaveStat(){const el=document.getElementById('saveStat'),p=(typeof cur==='function')?cur():null;if(!el||!p)return;el.textContent=saveStatText(p);el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash')}
function toastSaved(t){let d=document.getElementById('savedToast');if(!d){d=document.createElement('div');d.id='savedToast';d.className='toast';d.setAttribute('role','status');document.body.appendChild(d)}d.textContent=t||'✓ Alterações salvas';clearTimeout(d._t);d._t=setTimeout(()=>d.remove(),1600)}
function save() {
  try {
    localStorage.setItem('consultorio', JSON.stringify(db));
    try {
      lastSaved = new Date();
      lastSavedPid = view && view.id || null;
      updSaveStat();
    } catch (_) {}
  } catch (error) {
    if (!mem) {
      mem = true;
      toast('Este navegador não está salvando os dados. Faça backup agora.', 4000);
    }
  }
}
