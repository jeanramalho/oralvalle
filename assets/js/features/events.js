document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;
  if(!pmAllowed(b.dataset.act,b.dataset)){pmDeny();return}
  const f=A[b.dataset.act];if(f)f(b,b.dataset,cur());
});
document.addEventListener('input',e=>{
  const t=e.target,p=cur();
  if(t.id==='q'){q=t.value;view.pPage=0;render();setTimeout(()=>{const e=document.getElementById('q');if(e){e.focus();e.setSelectionRange(q.length,q.length)}},0);return}
  if(t.id==='pendOnly'){view.pendOnly=t.checked;render();return}
  if(t.id==='pfQ'){view.pfQ=t.value;const pos=t.selectionStart;render();setTimeout(()=>{const e=document.getElementById('pfQ');if(e){e.focus();try{e.setSelectionRange(pos,pos)}catch(_){}}},0);return}
  if(t.id==='prq'){
    view.prq=t.value;
    const qv=String(view.prq||'').toLowerCase().trim();
    const cards=document.querySelectorAll('.proc-cards .proc-card');
    let visible=0;
    cards.forEach(card=>{
      const name=String(card.dataset.procName||'').toLowerCase();
      const show=!qv||name.includes(qv);
      card.style.display=show?'':'none';
      if(show) visible++;
    });
    let empty=document.querySelector('.proc-search-empty');
    if(!visible){
      if(!empty){empty=document.createElement('div');empty.className='empty proc-search-empty';document.querySelector('.proc-cards').appendChild(empty)}
      empty.textContent='Nenhum procedimento encontrado.';
      empty.style.display='';
    }else if(empty){empty.style.display='none'}
    return;
  }
  if(t.id==='rst'){view.rst=t.value;return}
  if(t.id==='vrc'){t.dataset.touched='1';return}
  if(t.id==='vpr'||t.id==='vv'||t.id==='vdn'){fillRep(t.id);return}
  if(t.id==='obv'&&view.obx){const it=(()=>{const [oid,iid]=view.obx.split(':'),pp=cur(),oo=pp&&getO(pp,oid);return oo&&oo.itens.find(x=>x.id===iid)})();const r=$('obr');if(it&&r){const c=obCalc(it,num(t.value));r.value=c?c.toFixed(2):''}return}
  if(t.id==='apr'){const m=procBy(t.value),du=$('adu');if(m&&m.min&&!du.dataset.touched)du.value=m.min;return}
  if(t.id==='adu'){t.dataset.touched='1';return}
  if(t.id==='cmm'){if(t.value){view.cm=t.value;render()}return}
if(['tnp','tnv','tnc','tnobs','tnor','tnd'].includes(t.id)){
  const dr=view.trDraft=view.trDraft||{};dr[t.id]=t.value;
  if(t.id==='tnp'){const m=procBy(t.value),pv=$('tnmat');if(m){dr.tnv=$('tnv').value=m.preco||'';dr.tnc=$('tnc').value=r2(procCustoBase(m)).toFixed(2);if(pv)pv.innerHTML=trMatPrev(matSnap(m))}else{dr.tnv=$('tnv').value='';dr.tnc=$('tnc').value='';if(pv)pv.innerHTML=''}fmtMoney(document)}
  return}
if(t.id==='trflt'){view.trFlt=t.value;render();return}
if(t.dataset&&t.dataset.cl!==undefined){db.cl=db.cl||{};db.cl[t.dataset.cl]=t.value;save();return}
  if(t.dataset.ag){const a=db.ag.find(y=>y.id===t.dataset.ag);a.st=t.value;save();render();return}
  if(t.dataset.d){const dd=db.dt.find(y=>y.id===t.dataset.d),f=t.dataset.f;dd[f]=(f==='pct')?t.value.replace(',','.'):t.value;save();return}
  if(t.id==='mtq-search'){view.mtq=t.value;render();setTimeout(()=>{const e=$('mtq-search');if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length)}},0);return}
  if(t.dataset.mt){const m=db.mt.find(y=>y.id===t.dataset.mt),f=t.dataset.f;if(!m)return;m[f]=(f==='nome'||f==='un'||f==='val')?t.value:t.value.replace(',','.');
    if(f==='val'){m.ret=false;const tg=document.querySelector(`[data-mtv="${m.id}"]`),stt=mtStatus(m);if(tg){tg.className='val-tag '+stt.k;tg.textContent=stt.k==='sem'?'Sem validade cadastrada':stt.txt+(m.val?' · '+fd(m.val):'')}const al=$('valAlert');if(al)al.innerHTML=valAlertHtml();save();return}
    db.pr.forEach(x=>{if((x.mats||[]).some(r=>r.mid===m.id)){syncMat(x)}});
    const bd=document.querySelector(`[data-mtc="${m.id}"]`);if(bd)bd.textContent=brl4(mtUnit(m))+' / '+m.un;save();return}
  if(t.dataset.pm){const x=db.pr.find(y=>y.id===t.dataset.pm),r=x&&(x.mats||[]).find(y=>y.id===t.dataset.mr);if(!r)return;r.q=t.value.replace(',','.');syncMat(x);
    const m=mtBy(r.mid),sb=document.querySelector(`[data-pms="${r.id}"]`);if(sb)sb.textContent=brl(m?mtUnit(m)*num(r.q):0);
    const tt=document.querySelector(`[data-pmt="${x.id}"] span:last-child`);if(tt)tt.textContent=brl(matCost(x));
    const rs=document.querySelector(`[data-pres="${x.id}"]`);if(rs)rs.innerHTML=prRes(x);save();return}
  if(t.dataset.pc){const x=db.pr.find(y=>y.id===t.dataset.pc);x.parc=t.checked;const r=document.querySelector(`[data-pres="${x.id}"]`);if(r)r.innerHTML=prRes(x);save();return}
  if(t.dataset.p){const x=db.pr.find(y=>y.id===t.dataset.p),f=t.dataset.f;x[f]=f==='nome'?t.value:t.value.replace(',','.');if(f==='parTipo'){view.prOpen=x.id;save();render();return}const r=document.querySelector(`[data-pres="${x.id}"]`);if(r)r.innerHTML=prRes(x);save();return}
  if(t.dataset.h){db.hc[t.dataset.h]=t.value.replace(',','.');$('hcr').innerHTML=hcRes(hcCalc(db.hc));const tf=$('hcfx');if(tf)tf.textContent=brl(hcFix(db.hc));save();return}
  if(!p)return;
  if(t.dataset.k&&(t.dataset.k==='nome'||t.dataset.k==='cpf')){
    const r=pvCheck(t.dataset.k==='nome'?t.value:p.nome,t.dataset.k==='cpf'?t.value:'',p.tel,p.id);
    const dup=t.dataset.k==='nome'?r.nomeIgual:r.cpfIgual;
    if(dup){t.dataset.dup='1';t.style.borderColor='#d33';toast((t.dataset.k==='nome'?'Já existe um paciente com este nome: ':'Este CPF já está cadastrado: ')+dup.nome,3500);return}
    t.dataset.dup='';t.style.borderColor='';
  }
  if(t.dataset.k){p[t.dataset.k]=t.value;if(t.dataset.k==='nome'){const h=document.querySelector('h1');if(h)h.firstChild.textContent=t.value}}
  else if(t.dataset.a){p.anam[t.dataset.a]=t.value}
  else if(t.dataset.c){p.anam.c[t.dataset.c]=t.checked;t.parentNode.classList.toggle('on',t.checked)}
  else if(t.dataset.tr){const x=(p.trat||[]).find(y=>y.id===t.dataset.tr);if(x&&!x.vid){const f=t.dataset.f;x[f]=(f==='valor'||f==='custo')?t.value.replace(',','.'):t.value;trGrp(x,f);syncTratToItem(p,x);const c=document.querySelector(`[data-trc="${x.id}"]`);if(c)c.textContent=trCom(x);save()}}
  else if(t.dataset.o){
    const o=getO(p,t.dataset.o),f=t.dataset.f;
    if(f==='status'){o.status=t.value;save();render();return}
    if(t.dataset.i!==undefined){
      const it=o.itens[+t.dataset.i];it[f]=f==='valor'?t.value.replace(',','.'):t.value;const hadQ=qOf(it)>1;trGrp(it,f);if(hadQ&&f==='dente'){const vf=t.parentNode.querySelector('[data-f="valor"]');if(vf){vf.value=it.valor;fmtMoney(t.parentNode)}}if(it.tid)syncItemToTrat(p,it);
      if(f==='proc'){const m=procBy(t.value);if(m&&m.preco&&!it.valor){it.valor=m.preco;const vf=t.parentNode.querySelector('[data-f="valor"]');if(vf)vf.value=m.preco}}
    }else{o[f]=f==='desc'?t.value.replace(',','.'):t.value}
    refreshOrc(t.closest('[data-oid]'),o);
  }
  save();
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset&&t.dataset.dup==='1'&&cur()){t.value=cur()[t.dataset.k]||'';t.dataset.dup='';t.style.borderColor='';toast('Valor duplicado desfeito. Mantido o dado original.',3000);return}
  if(t.dataset&&(t.dataset.k||t.dataset.a||t.dataset.c||t.dataset.tr)&&cur()){save();toastSaved('✓ Alterações salvas')}
  if(t.id==='importPacFile'&&t.files&&t.files[0]){importPatientsFile(t.files[0]);t.value='';return;}
  if(t.id==='arqFiles'&&t.files&&t.files.length){
    const p=cur();if(!p){toast('Abra o prontuário do paciente primeiro');return}
    const files=Array.from(t.files),cat=$('arqCategoria')?.value||'Documento';
    const max=1.5*1024*1024;
    const invalid=files.filter(f=>!(/^(image\/(jpeg|png|gif|webp|bmp|tiff)|application\/pdf)$/i.test(f.type))||f.size>max);
    if(invalid.length){toast('Use imagens ou PDFs de até 1,5 MB cada. Arquivos inválidos: '+invalid.map(f=>f.name).join(', '),5000)}
    const valid=files.filter(f=>!invalid.includes(f));
    if(!valid.length){t.value='';return}
    if(window.OralCloudFiles){t.disabled=true;OralCloudFiles.upload(p,valid,cat).catch(error=>toast(error.message,5000)).finally(()=>{t.disabled=false;t.value=''});return}
    let done=0,failed=0;
    valid.forEach(file=>{const r=new FileReader();r.onload=()=>{try{(p.arquivos=p.arquivos||[]).push({id:uid(),nome:file.name,tipo:file.type||'application/octet-stream',categoria:cat,data:String(r.result||''),dataEnvio:hojeBR()});save()}catch(err){failed++}done++;if(done===valid.length){render();toast(failed?'Alguns arquivos não puderam ser salvos. Tente arquivos menores.':'Arquivo(s) anexado(s) ao prontuário',3500)}};r.onerror=()=>{failed++;done++;if(done===valid.length){render();toast('Não foi possível ler todos os arquivos')}};r.readAsDataURL(file)});
    return;
  }
  if(t.dataset&&t.dataset.tr&&t.dataset.f==='dente'){render();return}
  if(t.id==='agDate'){view.agDate=t.value||tdy();render();return}
  if(t.id==='agDent'){view.agDent=t.value||'todos';render();return}
  if(t.dataset&&t.dataset.ag&&t.dataset.f==='st'){const a=db.ag.find(x=>x.id===t.dataset.ag);if(a){a.st=t.value;save();render()}return}
  if(t.id==='pfPaciente'){view.pfPid=t.value||'';if(view.pfNew){return}render();return}
  if(t.id==='avsOn'){avsCfg().on=t.checked;save();toast(t.checked?'Aviso de horário ativado':'Aviso de horário desativado',1800);return}
  if(t.id==='avsMin'){avsCfg().min=+t.value||15;save();toast('Aviso com '+t.value+' min de antecedência',1800);return}
  if(t.id==='pfSt'){view.pfSt=t.value;render();return}
  if(t.id==='pfFrom'){view.pfFrom=t.value;render();return}
  if(t.id==='pfTo'){view.pfTo=t.value;render();return}
  if(t.dataset&&t.dataset.lemCheck){const x=(db.lem||[]).find(y=>y.id===t.dataset.lemCheck);if(x){x.feito=t.checked;save();render()}return}
  if(t.dataset&&t.dataset.k==='cpf'&&t.value&&!cpfOk(t.value))toast('CPF inválido. Confira os números.',2800);
  if(t.id==='rstf'&&t.files&&t.files[0]){
    const r=new FileReader();
    r.onload=()=>{view.rst=String(r.result||'');delArm=null;render();toast('Arquivo lido. Confira e toque em Restaurar dados.',3000)};
    r.onerror=()=>toast('Não foi possível ler o arquivo');
    r.readAsText(t.files[0]);
  }
});
function removerConfirmacaoAutomatica(){
  const termos=['confirmação automática','confirmacao automatica','confirmação automática via whatsapp','confirmacao automatica via whatsapp'];
  document.querySelectorAll('button,a,li,div,span,section,article').forEach(el=>{
    const txt=(el.textContent||'').trim().toLowerCase();
    if(termos.some(t=>txt===t || txt.startsWith(t+' '))){
      const alvo=el.closest('.ov-nav-btn,button,a,li,.card,.panel')||el;
      if(alvo && alvo!==document.body) alvo.remove();
    }
  });
}
