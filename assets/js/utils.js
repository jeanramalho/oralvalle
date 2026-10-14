/* ===== utilidades ===== */
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const num=v=>{if(typeof v==='number')return isFinite(v)?v:0;let t=String(v==null?'':v).replace(/[^\d,.\-]/g,'');if(t.indexOf(',')>-1)t=t.replace(/\./g,'').replace(',','.');const n=parseFloat(t);return isFinite(n)?n:0};
const r2=n=>Math.round((n+Number.EPSILON)*100)/100;
const brl=n=>(Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const tdy=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const plusDays=n=>new Date(Date.now()+n*864e5-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const fd=d=>d?d.split('-').reverse().join('/'):'';
const hojeBR=()=>new Date().toLocaleDateString('pt-BR');
const brToIso=d=>{const m=String(d||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?m[3]+'-'+m[2]+'-'+m[1]:''};
const sum=(a,k)=>a.reduce((s,x)=>s+(Number(x[k])||0),0);
const mins=h=>{const a=String(h||'0:0').split(':');return (+a[0]||0)*60+(+a[1]||0)};
const hm=m=>String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
function toast(t,ms){const d=document.createElement('div');d.className='toast';d.setAttribute('role','status');d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),ms||1800)}
function copy(t,ok,cb){
  const done=()=>{toast(ok||'Copiado');if(cb)cb()};
  const fb=()=>{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy')?done():toast('Não foi possível copiar')}catch(e){toast('Não foi possível copiar')}a.remove()};
  try{navigator.clipboard.writeText(t).then(done,fb)}catch(e){fb()}
}
function waOpen(tel,msg){
  let d=String(tel||'').replace(/\D/g,'');if(d&&d.length<=11&&d.slice(0,2)!=='55')d='55'+d;
  const w=window.open('https://wa.me/'+d+'?text='+encodeURIComponent(msg),'_blank');
  if(w){try{w.opener=null}catch(e){}}else copy(msg,'Texto copiado (o navegador bloqueou o WhatsApp)');
}
function cpfOk(s){const d=String(s).replace(/\D/g,'');if(d.length!==11||/^(\d)\1+$/.test(d))return false;for(let t=9;t<11;t++){let v=0;for(let i=0;i<t;i++)v+=d[i]*(t+1-i);v=(v*10)%11%10;if(v!=d[t])return false}return true}

/* ===== Cadastro de paciente: busca inteligente + bloqueio de duplicidade ===== */
const pvNorm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const pvDig=v=>String(v||'').replace(/\D/g,'');
function pvLev(a,b){if(a===b)return 0;if(!a.length)return b.length;if(!b.length)return a.length;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const cur=[i];for(let k=1;k<=b.length;k++)cur[k]=Math.min(prev[k]+1,cur[k-1]+1,prev[k-1]+(a[i-1]===b[k-1]?0:1));prev=cur}return prev[b.length]}
function pvScore(q,nome){
  const n=pvNorm(nome);if(!q||!n)return 0;
  if(n===q)return 100;
  const qt=q.split(' '),nt=n.split(' ');let tot=0;
  for(const t of qt){
    let best=0;
    for(const w of nt){
      if(w===t)best=Math.max(best,10);
      else if(w.startsWith(t))best=Math.max(best,8);
      else if(t.length>=3&&w.includes(t))best=Math.max(best,5);
      else if(t.length>=4){const d=pvLev(t,w.slice(0,Math.max(t.length,w.length>t.length?t.length:w.length)));const dd=Math.min(d,pvLev(t,w));if(dd<=(t.length>=7?2:1))best=Math.max(best,6-dd)}
    }
    if(!best)return 0;
    tot+=best;
  }
  return tot/qt.length+(n.startsWith(q)?3:0);
}
/* devolve {nomeIgual, cpfIgual, cpfInvalido, telIgual, similares[]} */
function pvCheck(nome,cpf,tel,ignoreId){
  const q=pvNorm(nome),cd=pvDig(cpf),td=pvDig(tel);
  const outros=db.p.filter(p=>p.id!==ignoreId);
  const r={nomeIgual:null,cpfIgual:null,cpfInvalido:false,telIgual:null,similares:[]};
  if(q)r.nomeIgual=outros.find(p=>pvNorm(p.nome)===q)||null;
  if(cd){if(cd.length===11&&!cpfOk(cd))r.cpfInvalido=true;else if(cd.length===11)r.cpfIgual=outros.find(p=>pvDig(p.cpf)===cd)||null}
  if(td.length>=8)r.telIgual=outros.find(p=>pvDig(p.tel)===td)||null;
  if(q.length>=2)r.similares=outros.map(p=>({p,s:pvScore(q,p.nome)})).filter(x=>x.s>0&&x.p!==r.nomeIgual).sort((a,b)=>b.s-a.s||a.p.nome.localeCompare(b.p.nome,'pt-BR')).slice(0,5).map(x=>x.p);
  return r;
}
const pvMaskCpf=v=>{const d=pvDig(v).slice(0,11);return d.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/,'$1.$2.$3-$4')};
const pvTelDig=v=>{let d=pvDig(v);if(d.length>11&&d.startsWith('55'))d=d.slice(2);if(d.length>=11&&d[0]==='0'&&d.length<=12)d=d.slice(1);return d.slice(0,11)};
const pvMaskTel=v=>{const d=pvTelDig(v);if(!d)return '';if(d.length<=2)return '('+d;if(d.length<=6)return `(${d.slice(0,2)}) ${d.slice(2)}`;if(d.length<=10)return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`};
const pvFmtCpf=v=>pvDig(v).length===11?pvMaskCpf(v):(v||'');
const pvFmtTel=v=>{const raw=String(v||'').trim();if(!raw)return '';const d=pvTelDig(raw);if(d.length===10||d.length===11)return pvMaskTel(d);if(d.length===9)return d.slice(0,5)+'-'+d.slice(5);if(d.length===8)return d.slice(0,4)+'-'+d.slice(4);return raw}
function pvApplyMask(t,fn){
  const v=t.value,pos=t.selectionStart==null?v.length:t.selectionStart;
  const antes=pvDig(v.slice(0,pos)).length,m=fn(v);if(m===v)return;
  t.value=m;
  let c=0,i=0;if(antes>0){for(;i<m.length;i++){if(/\d/.test(m[i])&&++c===antes){i++;break}}}
  try{t.setSelectionRange(i,i)}catch(_){}
}
function pvBloqueios(r,cpfTxt){
  const b=[];
  if(r.nomeIgual)b.push(['Já existe um paciente com este nome',r.nomeIgual]);
  if(r.cpfIgual)b.push(['Este CPF já está cadastrado',r.cpfIgual]);
  if(r.cpfInvalido)b.push(['CPF inválido. Confira os números.',null]);
  else if(pvDig(cpfTxt).length>0&&pvDig(cpfTxt).length<11)b.push(['CPF incompleto (precisa de 11 números)',null]);
  return b;
}
function pvRender(){
  const n=$('nn'),c=$('nc'),t=$('nt'),box=$('pvBox'),btn=$('pvAdd');if(!n||!box)return;
  const r=pvCheck(n.value,c?c.value:'',t?t.value:'');
  const bl=pvBloqueios(r,c?c.value:'');
  const link=p=>`<button type="button" class="pv-hit" data-act="open" data-id="${p.id}"><b>${esc(p.nome)}</b><small>${esc(p.cpf?'CPF '+p.cpf:'Sem CPF')} · ${esc(pvFmtTel(p.tel)||'Sem telefone')}${p.arq?' · arquivado':''}</small></button>`;
  let h='';
  if(bl.length)h+=`<div class="pv-alert pv-block">${bl.map(([m,p])=>`<div>⛔ ${esc(m)}${p?':':''}</div>${p?link(p):''}`).join('')}<div class="pv-hint">O cadastro está bloqueado para evitar duplicidade.</div></div>`;
  if(r.telIgual&&!bl.some(x=>x[1]===r.telIgual))h+=`<div class="pv-alert pv-warn"><div>⚠ Este telefone já pertence a:</div>${link(r.telIgual)}<div class="pv-hint">Pode ser um familiar. Você ainda pode cadastrar.</div></div>`;
  if(r.similares.length)h+=`<div class="pv-alert pv-sim"><div>🔎 Pacientes parecidos já cadastrados — toque para abrir:</div>${r.similares.map(link).join('')}</div>`;
  box.innerHTML=h;
  if(btn){btn.disabled=!!bl.length||!n.value.trim();btn.style.opacity=btn.disabled?'.5':'';}
}
function selOpts(arr,v){return arr.map(a=>`<option value="${a[0]}"${a[0]===v?' selected':''}>${a[1]}</option>`).join('')}
function arm(id,fn){if(delArm===id){delArm=null;fn()}else{delArm=id;render()}}

