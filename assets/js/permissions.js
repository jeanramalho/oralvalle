/* As permissões locais controlam a interface, não substituem autorização de servidor. */
const PM_MODS=[
 ['Clínica',[['ag','Agenda'],['pac','Pacientes'],['lem','Lembretes'],['dt','Dentistas'],['cm','Comissões'],['vd','Vendas e pagamentos recebidos']]],
 ['Negociação',[['pf','Proposta financeira']]],
 ['Precificação',[['hc','Custo hora clínica'],['pr','Procedimentos'],['mt','Tabela de materiais']]],
 ['Controle',[['bk','Backup e importação de dados']]],
 ['Dentro da ficha do paciente',[['pac.dados','Dados cadastrais'],['pac.anam','Anamnese'],['pac.odo','Evolução'],['pac.orc','Orçamentos'],['pac.trat','Tratamentos'],['pac.pag','Pagamentos'],['pac.agd','Agendamentos'],['pac.arquivos','Radiografias e documentos']]]
];
const PM_TABS=['dados','anam','odo','orc','trat','pag','agd','arquivos'];
const PM_ORDER=['ag','pac','lem','dt','cm','vd','pf','hc','pr','mt','bk'];
const PM_LV={none:0,view:1,edit:2};
const PM_LAB={none:'Oculto',view:'Só ver',edit:'Ver e alterar'};
const PM_SAFE=new Set(['actab','logout','nav','svw','ovFinDetail','ovFinPdf','pPage','vPage','otoggle','retall','lemtab','orthowa','lemgo','cmdent','cmback','agf','agdate','agtoday','arqt','dent','open','back','tab','copy','owa','print','pdf','printevol','printficha','rxpdf','rxprint','atpdf','atprint','atreset','prprint','prshare','bktxt','bkcopy','bksave','pfOpen','prsearch','avsok','avsgo','avsperm','avstest','savebtn','acpw']);
const PM_FREE_IDS=new Set(['q','pfQ','pendOnly','cmm']);
const pmKeys=()=>PM_MODS.flatMap(g=>g[1].map(x=>x[0]));
function pmUser(){return ME?(AUTH.users.find(x=>x.id===ME.id)||ME):null}
function permOf(u,key){
  if(!u)return 0;if(u.admin)return 2;
  if(key==='inicio')key='ag';
  if(key==='conta')return 2;
  if(key==='cfg')return 0;
  const p=u.perms;if(!p)return 2;
  const v=p[key];
  if(v===undefined)return key.indexOf('.')>0?2:0;
  return PM_LV[v]!==undefined?PM_LV[v]:0;
}
const pmLvl=k=>permOf(pmUser(),k);
const pmSee=k=>pmLvl(k)>=1;
function pmTabLvl(tab){
  const viaPf=view.h==='pf'&&pmLvl('pac')<1;
  if(viaPf)return tab==='orc'?pmLvl('pf'):0;
  return Math.min(pmLvl('pac'),permOf(pmUser(),'pac.'+tab));
}
const pmTabOk=k=>{const u=pmUser();return !u||u.admin||pmTabLvl(k)>=1};
function pmCur(){
  const u=pmUser();if(!u||u.admin)return 2;
  if(view.id)return pmTabLvl(view.tab);
  return pmLvl(view.h==='ortho'?'lem':view.h||'pac');
}
function pmFirst(){return PM_ORDER.find(k=>pmLvl(k)>=1)||'conta'}
function sanitizeView(){
  const u=pmUser();if(!u||u.admin)return;
  if(view.id){
    if(!(pmLvl('pac')>=1||(view.h==='pf'&&pmLvl('pf')>=1))){view.id=null}
    else{const t=PM_TABS.filter(pmTabOk);if(!t.length)view.id=null;else if(t.indexOf(view.tab)<0)view.tab=t[0]}
  }
  const h=view.h==='ortho'?'lem':view.h||'pac';
  if(h!=='conta'&&pmLvl(h)<1)view.h=pmFirst();
}
function pmAllowed(act,d){
  const u=pmUser();if(!u||u.admin)return true;
  if(act==='logout'||act==='acpw'||act==='actab')return true;
  if(act==='nav')return d.t==='inicio'||d.t==='conta'||pmLvl(d.t)>=1;
  if(act==='open')return pmLvl('pac')>=1;
  if(act==='pfOpen')return pmLvl('pf')>=1;
  if(act==='tab')return pmTabOk(d.t);
  if(act.slice(0,3)==='cfg'||act==='acadd'||act==='acrm'||act==='acrec'||act==='pmset')return false;
  if(PM_SAFE.has(act))return true;
  return pmCur()>=2;
}
function pmDeny(){toast(pmCur()===1?'Esta área está em modo somente visualização.':'Você não tem permissão para fazer isso.',3000)}
function pmCleanSide(h){return h.replace(/<div class="ov-section">[^<]*<\/div>\s*<nav class="ov-nav">\s*<\/nav>/g,'')}
function pmContaHtml(){return `<div class="ov-page-head"><div><h1>Minha conta</h1><p class="sub">Organize seus dados de acesso por seção.</p></div></div>${acHtml(true)}`}
function pmDefault(){const p={};pmKeys().forEach(k=>{p[k]=(k==='ag'||k==='pac'||k==='lem'||k.indexOf('pac.')===0)?'view':'none'});return p}
function pmGet(u,key){if(!u.perms)return 'edit';return u.perms[key]||(key.indexOf('.')>0?'edit':'none')}
function pmSeg(u,key,label){
  const c=pmGet(u,key);
  return `<div class="up-seg" role="radiogroup" aria-label="${esc(label)}">${['none','view','edit'].map(v=>`<label class="up-opt"><input type="radio" name="up_${u.id}_${key}" data-pmu="${u.id}" data-pmk="${key}" value="${v}"${c===v?' checked':''}><span>${PM_LAB[v]}</span></label>`).join('')}</div>`;
}
function pmCardHtml(){
  if(!ME||!ME.admin)return '';
  const us=AUTH.users.filter(x=>!x.admin);
  const list=us.length?us.map(u=>`<details class="up-user" data-pmd="${u.id}"${view.pmOpen===u.id?' open':''}><summary><strong>${esc(u.nome)}</strong><span class="note" style="margin:0">· ${esc(u.login)}</span></summary>
    <div class="up-body">
      <div class="up-quick"><span class="note" style="margin:0">Marcar tudo como:</span>${['none','view','edit'].map(m=>`<button type="button" class="ghost sm" data-act="pmset" data-id="${u.id}" data-m="${m}">${PM_LAB[m]}</button>`).join('')}</div>
      ${PM_MODS.map(g=>`<h3 class="up-h">${g[0]}</h3>${g[1].map(x=>`<div class="up-row"><span>${x[1]}</span>${pmSeg(u,x[0],x[1])}</div>`).join('')}`).join('')}
      <div style="margin-top:14px"><button type="button" class="danger sm" data-act="acrm" data-id="${u.id}">${delArm===u.id?'Confirmar remoção':'Remover usuário'}</button></div>
    </div></details>`).join(''):`<p class="note" style="margin:10px 0">Ainda não há usuários além do administrador. Crie um abaixo e depois escolha o que ele pode ver e alterar.</p>`;
  return `<section class="card cfg-card"><h2>Acesso dos usuários</h2>
    <p class="note" style="margin:0 0 4px">Escolha o que cada pessoa que entra com login pode ver e alterar. O administrador sempre tem acesso a tudo. Cada mudança é salva na hora.</p>
    <p class="note" style="margin:0 0 8px"><strong>Oculto</strong>: a função some do menu. <strong>Só ver</strong>: consulta e imprime, sem alterar nada. <strong>Ver e alterar</strong>: acesso completo à função.</p>
    ${list}
    <h3 class="up-h" style="margin-top:20px">Novo usuário</h3>
    <label for="acn" style="margin-top:0">Nome</label><input id="acn">
    <label for="acl">Usuário (para entrar)</label><input id="acl" autocapitalize="none">
    <label for="acs">Senha (mínimo 6 caracteres)</label><input id="acs" type="password" autocomplete="new-password">
    <button class="ghost" data-act="acadd" style="width:100%;margin-top:10px">Adicionar usuário</button>
    <p class="note" style="margin:8px 0 0">Todo usuário novo começa só podendo ver Agenda, Pacientes e Lembretes. Ajuste acima.</p>
  </section>`;
}
Object.assign(A,{pmset:(b,d)=>{
  if(!ME||!ME.admin)return;
  const u=AUTH.users.find(x=>x.id===d.id);if(!u||u.admin||PM_LV[d.m]===undefined)return;
  const p={};pmKeys().forEach(k=>{p[k]=d.m});u.perms=p;view.pmOpen=u.id;aSave();render();toast('Permissões atualizadas',2000);
}});
document.addEventListener('change',e=>{
  const t=e.target;if(!t||!t.dataset||t.dataset.pmu===undefined)return;
  if(!ME||!ME.admin)return;
  const u=AUTH.users.find(x=>x.id===t.dataset.pmu);if(!u||u.admin)return;
  if(!u.perms){const snap={};pmKeys().forEach(k=>{snap[k]=pmGet(u,k)});u.perms=snap}
  u.perms[t.dataset.pmk]=t.value;view.pmOpen=u.id;
  if(aSave())toast('Permissão salva',1400);
});
document.addEventListener('toggle',e=>{const d=e.target;if(d&&d.dataset&&d.dataset.pmd!==undefined){if(d.open)view.pmOpen=d.dataset.pmd;else if(view.pmOpen===d.dataset.pmd)view.pmOpen=null}},true);
function applyRO(){
  const u=pmUser(),ct=document.querySelector('.ov-content');
  if(LOCKED||!u||u.admin||!ct)return;
  const ro=pmCur()<2;
  ct.classList.toggle('ro-mode',ro);
  let note=ct.querySelector('.ro-note');
  if(!ro){if(note)note.remove();return}
  const inner=ct.querySelector('.ov-content-inner');
  if(!note&&inner){note=document.createElement('div');note.className='ro-note';note.setAttribute('role','status');note.textContent='Modo somente visualização: você pode consultar e imprimir esta área, mas não alterar.';inner.insertBefore(note,inner.firstChild)}
  ct.querySelectorAll('button[data-act]').forEach(b=>{if(!pmAllowed(b.dataset.act,b.dataset)){b.disabled=true;b.classList.add('ro-off')}});
  ct.querySelectorAll('input,select,textarea').forEach(el=>{if(PM_FREE_IDS.has(el.id)||el.closest('.pf-filters,[data-ro-ok]'))return;el.disabled=true});
}
let pmRaf=0;
new MutationObserver(()=>{if(pmRaf)return;pmRaf=requestAnimationFrame(()=>{pmRaf=0;applyRO()})}).observe(document.body,{childList:true,subtree:true});