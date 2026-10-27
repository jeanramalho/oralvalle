/* ===== LOGIN / ACESSO ===== */
let LOCKED=true,ME=null,idleT=null,AUTH={users:[],rec:null};
// Exposição somente de leitura do usuário atual para módulos de interface.
window.OralCurrentUser = () => ME;
const AK='consultorio_auth',SK='consultorio_sess',FK='consultorio_lkfail';
function aLoad(){try{const a=JSON.parse(localStorage.getItem(AK));if(a&&Array.isArray(a.users))return a}catch(e){}return{users:[],rec:null}}
function aSave(){try{localStorage.setItem(AK,JSON.stringify(AUTH));return true}catch(e){toast('Não foi possível salvar o acesso neste navegador',3500);return false}}
const hexs=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
function rnd(n){const a=new Uint8Array(n);try{crypto.getRandomValues(a)}catch(e){for(let i=0;i<n;i++)a[i]=Math.floor(Math.random()*256)}return hexs(a)}
async function hashPw(pw,salt){
  try{if(window.crypto&&crypto.subtle){const enc=new TextEncoder(),k=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveBits']);return hexs(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:150000,hash:'SHA-256'},k,256))}}catch(e){}
  let h1=0xdeadbeef,h2=0x41c6ce57;const s=salt+pw;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677)}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return 'f'+(4294967296*(2097151&h2)+(h1>>>0)).toString(16)
}
const lgn=v=>String(v||'').trim().toLowerCase();
const recNorm=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const newCode=()=>{const c=rnd(6).toUpperCase();return c.slice(0,4)+'-'+c.slice(4,8)+'-'+c.slice(8,12)};
function sGet(){try{let s=JSON.parse(sessionStorage.getItem(SK)||'null');if(s)return s;s=JSON.parse(localStorage.getItem(SK+'_l')||'null');if(s&&s.exp>Date.now())return s}catch(e){}return null}
function sSet(uid,keep){try{sessionStorage.setItem(SK,JSON.stringify({uid,keep:!!keep}));if(keep)localStorage.setItem(SK+'_l',JSON.stringify({uid,keep:true,exp:Date.now()+30*864e5}))}catch(e){}}
function sClear(){try{sessionStorage.removeItem(SK);localStorage.removeItem(SK+'_l')}catch(e){}}
function failGet(){try{return JSON.parse(localStorage.getItem(FK)||'{}')}catch(e){return{}}}
function failSet(o){try{localStorage.setItem(FK,JSON.stringify(o))}catch(e){}}
function idleReset(){clearTimeout(idleT);if(ME&&!ME.keep&&!LOCKED)idleT=setTimeout(()=>doLogout('Sessão bloqueada por inatividade.'),30*60*1000)}
['click','keydown','touchstart'].forEach(ev=>document.addEventListener(ev,idleReset,{passive:true}));

function lockShow(mode,msg,code){
  LOCKED=true;clearTimeout(idleT);
  let el=document.getElementById('lock');
  if(!el){el=document.createElement('div');el.id='lock';document.body.appendChild(el);
    el.addEventListener('click',e=>{const b=e.target.closest('[data-lk]');if(b&&LK[b.dataset.lk])LK[b.dataset.lk](b)});
    el.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'){const p=el.querySelector('[data-primary]');if(p)p.click()}})}
  const app=$('app');app.innerHTML='';app.style.display='none';
  const err=msg?`<div class="lk-err" role="alert">${esc(msg)}</div>`:'';
  const _c=topCl(),logo=`<div class="lk-brand">${_c.logo?`<img src="${esc(_c.logo)}" alt="" style="display:block;margin:0 auto 6px;max-height:64px;max-width:200px;object-fit:contain">`:''}<strong>${esc(_c.marca)}</strong><span>${esc(_c.sub)}</span></div>`;
  let body='';
  if(mode==='setup')body=`<h1>Criar acesso</h1><p class="lk-t">Primeiro acesso. Crie o usuário administrador do sistema.</p>${err}
    <label for="lknome">Seu nome</label><input id="lknome" autocomplete="name">
    <label for="lkuser">Usuário (para entrar)</label><input id="lkuser" autocomplete="username" autocapitalize="none">
    <label for="lkpw">Senha (mínimo 6 caracteres)</label><input id="lkpw" type="password" autocomplete="new-password">
    <label for="lkpw2">Repita a senha</label><input id="lkpw2" type="password" autocomplete="new-password">
    <button data-lk="setup" data-primary>Criar acesso</button>`;
  else if(mode==='code')body=`<h1>Código de recuperação</h1><p class="lk-t">Anote este código em local seguro. Se você esquecer a senha, é a <strong>única forma</strong> de voltar a entrar. Ele não será mostrado de novo.</p><div class="lk-code">${esc(code)}</div><button data-lk="codeok" data-primary>Anotei, continuar</button>`;
  else if(mode==='forgot')body=`<h1>Redefinir senha</h1><p class="lk-t">Digite o código de recuperação e escolha uma nova senha para o administrador.</p>${err}
    <label for="lkcode">Código de recuperação</label><input id="lkcode" autocapitalize="characters" autocomplete="off" placeholder="XXXX-XXXX-XXXX">
    <label for="lkpw">Nova senha</label><input id="lkpw" type="password" autocomplete="new-password">
    <label for="lkpw2">Repita a nova senha</label><input id="lkpw2" type="password" autocomplete="new-password">
    <button data-lk="reset" data-primary>Redefinir senha</button><button class="lk-link" data-lk="tologin">Voltar</button>`;
  else body=`<h1>Entrar</h1>${err}
    <label for="lkuser">Usuário</label><input id="lkuser" autocomplete="username" autocapitalize="none">
    <label for="lkpw">Senha</label><input id="lkpw" type="password" autocomplete="current-password">
    <label class="lk-chk"><input id="lkkeep" type="checkbox"> Manter conectado neste aparelho</label>
    <button data-lk="login" data-primary>Entrar</button><button class="lk-link" data-lk="toforgot">Esqueci a senha</button>`;
  el.innerHTML=`<div class="lk-box">${logo}${body}</div>`;
  const f=el.querySelector('input');if(f)setTimeout(()=>f.focus(),50);
}
function unlock(user,keep){
  ME=Object.assign({},user,{keep:!!keep});LOCKED=false;
  const el=document.getElementById('lock');if(el)el.remove();
  $('app').style.display='';render();idleReset();
}
function doLogout(msg){
  sClear();ME=null;LOCKED=true;view.id=null;view.h='pac';view.trForm=false;view.trDraft=null;delArm=null;
  lockShow('login',msg||'');
}
function authBoot(){
  AUTH=aLoad();
  if(!AUTH.users.length){lockShow('setup');return}
  const s=sGet(),u=s&&AUTH.users.find(x=>x.id===s.uid);
  if(u)unlock(u,s.keep);else lockShow('login');
}
const pwOk=(a,b)=>{if(String(a).length<6)return 'A senha precisa ter pelo menos 6 caracteres.';if(a!==b)return 'As senhas não são iguais.';return ''};
const LK={
  tologin:()=>lockShow('login'),
  toforgot:()=>lockShow('forgot'),
  async setup(b){
    const nome=$('lknome').value.trim(),login=lgn($('lkuser').value),pw=$('lkpw').value,pw2=$('lkpw2').value;
    if(!nome||!login){lockShow('setup','Preencha o nome e o usuário.');return}
    const e=pwOk(pw,pw2);if(e){lockShow('setup',e);return}
    b.disabled=true;
    const salt=rnd(16),hash=await hashPw(pw,salt),code=newCode(),rs=rnd(16),rh=await hashPw(recNorm(code),rs);
    AUTH={users:[{id:uid(),nome,login,salt,hash,admin:true}],rec:{salt:rs,hash:rh}};
    if(!aSave()){lockShow('setup','Este navegador não permite salvar o acesso. Saia do modo privado e tente de novo.');return}
    ME=AUTH.users[0];lockShow('code','',code);
  },
  codeok:()=>{sSet(AUTH.users[0].id,false);unlock(AUTH.users[0],false)},
  async login(b){
    const fl=failGet();if(fl.until&&fl.until>Date.now()){lockShow('login','Muitas tentativas. Aguarde '+Math.ceil((fl.until-Date.now())/1000)+' segundos.');return}
    const login=lgn($('lkuser').value),pw=$('lkpw').value,keep=$('lkkeep').checked;
    b.disabled=true;
    const u=AUTH.users.find(x=>x.login===login);
    const ok=u&&(await hashPw(pw,u.salt))===u.hash;
    if(!ok){const n=(fl.n||0)+1;failSet(n>=5?{n:0,until:Date.now()+30000}:{n});lockShow('login','Usuário ou senha incorretos.');return}
    failSet({});sSet(u.id,keep);unlock(u,keep);
  },
  async reset(){
    const code=recNorm($('lkcode').value),pw=$('lkpw').value,pw2=$('lkpw2').value;
    const e=pwOk(pw,pw2);if(e){lockShow('forgot',e);return}
    if(!AUTH.rec||(await hashPw(code,AUTH.rec.salt))!==AUTH.rec.hash){lockShow('forgot','Código de recuperação incorreto.');return}
    const adm=AUTH.users.find(x=>x.admin)||AUTH.users[0];
    adm.salt=rnd(16);adm.hash=await hashPw(pw,adm.salt);aSave();failSet({});
    lockShow('login','Senha redefinida. Entre com a nova senha.');
  }
};
function acHtml(withTabs=false){
  if(!ME)return '';
  const adm=!!ME.admin;
  const tab=withTabs?((adm||!['usuarios','recuperacao'].includes(view.acTab))?(view.acTab||'acesso'):'acesso'):'all';
  const users=adm?AUTH.users.map(u=>`<div class="pg" style="align-items:center"><span><strong>${esc(u.nome)}</strong><br><span class="note" style="margin:0">${esc(u.login)}${u.admin?' · administrador':''}</span></span>${u.id===ME.id?'<span class="note" style="margin:0">você</span>':`<button class="danger sm" data-act="acrm" data-id="${u.id}">${delArm===u.id?'Confirmar':'Remover'}</button>`}</div>`).join(''):'';
  const tabs=withTabs?`<div class="row" role="tablist" aria-label="Seções da minha conta" style="gap:8px;flex-wrap:wrap;margin-bottom:14px">
    <button type="button" class="${tab==='acesso'?'':'ghost'}" data-act="actab" data-t="acesso" role="tab" aria-selected="${tab==='acesso'}">Meu acesso</button>
    ${adm?`<button type="button" class="${tab==='usuarios'?'':'ghost'}" data-act="actab" data-t="usuarios" role="tab" aria-selected="${tab==='usuarios'}">Usuários</button><button type="button" class="${tab==='recuperacao'?'':'ghost'}" data-act="actab" data-t="recuperacao" role="tab" aria-selected="${tab==='recuperacao'}">Recuperação</button>`:''}
  </div>`:'';
  const acesso=(tab==='acesso'||tab==='all')?`<section role="tabpanel"><h2>Dados de acesso</h2>
    <p class="note" style="margin:0 0 10px">Conectado como <strong>${esc(ME.nome)}</strong> (${esc(ME.login)})${adm?' · administrador':''}.</p>
    <button class="ghost" data-act="logout" style="width:100%">Sair do sistema</button>
    <h2 style="margin-top:18px">Alterar minha senha</h2>
    <label for="acp0" style="margin-top:0">Senha atual</label><input id="acp0" type="password" autocomplete="current-password">
    <label for="acp1">Nova senha</label><input id="acp1" type="password" autocomplete="new-password">
    <label for="acp2">Repita a nova senha</label><input id="acp2" type="password" autocomplete="new-password">
    <button class="ghost" data-act="acpw" style="width:100%;margin-top:10px">Alterar senha</button>
    <p class="note" style="margin:14px 0 0">O login protege o uso do sistema neste aparelho. Os dados continuam salvos no navegador. Para proteção total e uso em vários aparelhos, é preciso um servidor.</p></section>`:'';
  const usuarios=(tab==='usuarios'||tab==='all')&&adm?`<section role="tabpanel"><h2>Usuários cadastrados</h2>${users||'<p class="note">Nenhum outro usuário cadastrado.</p>'}
    <h2 style="margin-top:18px;font-size:16px">Adicionar usuário</h2>
    <label for="acn" style="margin-top:0">Nome</label><input id="acn" autocomplete="name">
    <label for="acl">Usuário (para entrar)</label><input id="acl" autocapitalize="none" autocomplete="username">
    <label for="acs">Senha (mínimo 6 caracteres)</label><input id="acs" type="password" autocomplete="new-password">
    <button class="ghost" data-act="acadd" style="width:100%;margin-top:10px">Adicionar usuário</button></section>`:'';
  const recuperacao=(tab==='recuperacao'||tab==='all')&&adm?`<section role="tabpanel"><h2>Código de recuperação</h2>
    <p class="note" style="margin:0 0 8px">Gere um novo código se perdeu o anterior. O código antigo deixa de valer. Anote o novo código em um local seguro.</p>
    ${view.newrec?`<div class="lk-code" style="font-size:20px">${esc(view.newrec)}</div>`:''}
    <button class="ghost" data-act="acrec" style="width:100%">Gerar novo código</button></section>`:'';
  return `<div class="card">${tabs}${acesso}${usuarios}${recuperacao}</div>`;
}

