/* ===== ações ===== */
const A={
  ovFinDetail:(b,d)=>ovFinDetail(d.t),
  ovFinPdf:()=>ovFinPdf(),
  logout:()=>doLogout(),
  pPage:(b,d)=>{view.pPage=Math.max(0,Number(d.p)||0);render();},
  vPage:(b,d)=>{view.vPage=Math.max(0,Number(d.p)||0);render();},
  agencerrar:(b,d)=>{
    const a=db.ag.find(x=>String(x.id)===String(d.id));if(!a)return;
    const resposta=prompt('Dar baixa no agendamento:\n1 - Compareceu (verde)\n2 - Faltou (vermelho)\n3 - Desmarcou (vermelho)\n\nDigite 1, 2 ou 3:');
    if(resposta===null)return;
    const status={'1':'Compareceu','2':'Faltou','3':'Cancelado'}[resposta.trim()];
    if(!status){toast('Escolha 1, 2 ou 3 para dar baixa.',3000);return;}
    a.st=status;save();render();toast(status==='Cancelado'?'Consulta desmarcada':status==='Faltou'?'Falta registrada':'Comparecimento registrado');
  },
  agfalta:(b,d)=>{const a=db.ag.find(x=>x.id===d.id);if(!a)return;a.st='Faltou';save();render();toast('Falta registrada')},
  agcancel:(b,d)=>{const a=db.ag.find(x=>x.id===d.id);if(!a)return;a.st='Cancelado';save();render();toast('Agendamento cancelado')},
  agreativ:(b,d)=>{const a=db.ag.find(x=>x.id===d.id);if(!a)return;const t={...a,st:'Agendado'};if(confl(t)){toast('Esse horário já está ocupado por outro atendimento.',3500);return}a.st='Agendado';save();render();toast('Agendamento reativado')},
  rxpdf:async (b,d,p)=>{if(!p)return;try{const r=await rxDoc(p);if(!r)return;r.doc.save(r.fname);toast('Receituário gerado',2200)}catch(e){console.error(e);toast('Não foi possível gerar o PDF',3000)}},
  rxprint:(b,d,p)=>{if(!p)return;try{const r=rxDoc(p);if(!r)return;const u=r.doc.output('bloburl'),w=window.open(u,'_blank');if(!w){r.doc.save(r.fname);toast('Pop-up bloqueado: o PDF foi baixado para você imprimir',3500)}}catch(e){console.error(e);toast('Não foi possível gerar o PDF',3000)}},
  rxsave:(b,d,p)=>{if(!p)return;try{const r=rxDoc(p);if(!r)return;const data=r.doc.output('datauristring').replace(/;filename=[^;]*;/,';');(p.arquivos=p.arquivos||[]).push({id:uid(),nome:r.fname,tipo:'application/pdf',categoria:'Receituário',data,dataEnvio:hojeBR()});save();render();toast('Receituário salvo no prontuário',3000)}catch(e){console.error(e);toast('Não foi possível salvar o receituário',3000)}},
  rxmodel:(b,d,p)=>{const st=view.rx;if(!st||st.model==='livre'&&!String(st.texto).trim())return;(db.rxm=db.rxm||{})[st.model]=st.texto;save();render();toast('Modelo salvo: será usado nos próximos receituários',3000)},
  cfgtab:(b,d)=>{view.cfgTab=d.t;render()},
  atpdf:async (b,d,p)=>{if(!p)return;try{const r=await atDoc(p);if(!r)return;r.doc.save(r.fname);toast('Atestado gerado',2200)}catch(e){console.error(e);toast('Não foi possível gerar o PDF',3000)}},
  atprint:(b,d,p)=>{if(!p)return;try{const r=atDoc(p);if(!r)return;const u=r.doc.output('bloburl'),w=window.open(u,'_blank');if(!w){r.doc.save(r.fname);toast('Pop-up bloqueado: o PDF foi baixado para você imprimir',3500)}}catch(e){console.error(e);toast('Não foi possível gerar o PDF',3000)}},
  atsave:(b,d,p)=>{if(!p)return;try{const r=atDoc(p);if(!r)return;const data=r.doc.output('datauristring').replace(/;filename=[^;]*;/,';');(p.arquivos=p.arquivos||[]).push({id:uid(),nome:r.fname,tipo:'application/pdf',categoria:'Atestado',data,dataEnvio:hojeBR()});save();render();toast('Atestado salvo no prontuário',3000)}catch(e){console.error(e);toast('Não foi possível salvar o atestado',3000)}},
  atreset:(b,d,p)=>{if(!view.at)return;view.at.edited=false;render();toast('Texto padrão restaurado',2200)},
  cfgattxt:()=>{db.cl=db.cl||{};db.cl.atTexto=AT_TXT_DEF;save();render();toast('Texto padrão do atestado restaurado',2500)},
  rxreset:(b,d,p)=>{const st=view.rx;if(!st||!p)return;if(db.rxm)delete db.rxm[st.model];st.texto=rxGen(p,st.model);st.edited=false;save();render();toast('Modelo original restaurado',2500)},
  cfglogorm:()=>{if(db.cl){db.cl.logo='';delete db.cl.logoW;delete db.cl.logoH;db.cl.semLogo=false}save();render();toast('Logo padrão restaurada',2500)},
  cfgnologo:()=>{if(!confirm('Remover todas as logos e deixar o sistema sem nenhuma imagem de logo?'))return;db.cl=db.cl||{};db.cl.logo='';db.cl.icone='';db.cl.semLogo=true;delete db.cl.logoW;delete db.cl.logoH;delete db.cl.iconeW;delete db.cl.iconeH;save();render();toast('Todas as logos foram removidas',2500)},
  cfgcolorreset:()=>{db.cl=db.cl||{};db.cl.corTema='#ff7a00';save();applyTheme();render();toast('Cor laranja padrão restaurada',2200)},
  cfgiconrm:()=>{if(db.cl){db.cl.icone='';delete db.cl.iconeW;delete db.cl.iconeH}save();render();toast('Ícone personalizado removido',2500)},
  agpick:(b,d)=>{const p=db.p.find(x=>x.id===d.id);if(!p)return;$('apn').value=p.nome;$('ap').value=p.id;const bx=$('apsug');bx.hidden=true;bx.innerHTML='';agAuto(p.id)},
  agstatus:(b,d)=>{const a=db.ag.find(x=>x.id===d.id);if(!a)return;a.st=a.st==='Confirmado'?'Compareceu':'Confirmado';save();render();},
  agedit:(b,d)=>{const a=db.ag.find(x=>x.id===d.id);if(!a)return;const h=prompt('Novo horário (HH:MM):',a.hora);if(h===null)return;if(!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(h)){toast('Informe o horário no formato HH:MM');return}const dur=prompt('Duração em minutos:',String(a.dur||30));if(dur===null)return;const n=Number(dur);if(!Number.isFinite(n)||n<5||n>480){toast('Duração inválida');return}const test={...a,hora:h,dur:n};if(confl(test)){toast('Esse horário conflita com outro atendimento do dentista ou consultório.');return}a.hora=h;a.dur=n;save();render();toast('Horário atualizado');},
  agslot:(b,d)=>{const h=$('ah'),c=$('acadeira');if(!h||!c){toast('Cadastre um paciente para poder agendar',3000);return}h.value=d.h;c.value=d.c;h.dataset.touched='1';$('ad').value=view.agDate||tdy();const f=h.closest('.card');if(f)f.scrollIntoView({behavior:'smooth',block:'center'});toast('Preenchido: '+d.h+' no Consultório '+d.c+'. Escolha o paciente e agende.',3200)},
  actab:(b,d)=>{view.acTab=['acesso','usuarios','recuperacao'].includes(d.t)?d.t:'acesso';view.newrec=view.acTab==='recuperacao'?view.newrec:'';render()},
  acpw:async()=>{const a=$('acp0').value,n=$('acp1').value,n2=$('acp2').value,e=pwOk(n,n2);if(e){toast(e,3000);return}
    const u=AUTH.users.find(x=>x.id===ME.id);if(!u||(await hashPw(a,u.salt))!==u.hash){toast('Senha atual incorreta',3000);return}
    u.salt=rnd(16);u.hash=await hashPw(n,u.salt);aSave();['acp0','acp1','acp2'].forEach(i=>$(i).value='');toast('Senha alterada')},
  acadd:async()=>{if(!ME||!ME.admin)return;const nome=$('acn').value.trim(),login=lgn($('acl').value),pw=$('acs').value;
    if(!nome||!login){toast('Preencha nome e usuário',3000);return}if(pw.length<6){toast('A senha precisa ter pelo menos 6 caracteres',3000);return}
    if(AUTH.users.some(x=>x.login===login)){toast('Já existe um usuário com esse nome de entrada',3000);return}
    const salt=rnd(16);AUTH.users.push({id:uid(),nome,login,salt,hash:await hashPw(pw,salt),admin:false,perms:pmDefault()});view.pmOpen=AUTH.users[AUTH.users.length-1].id;aSave();render();toast('Usuário adicionado. Defina o que ele pode ver e alterar.',3500)},
  acrm:(b,d)=>{if(!ME||!ME.admin||d.id===ME.id)return;arm(d.id,()=>{AUTH.users=AUTH.users.filter(x=>x.id!==d.id);aSave();render();toast('Usuário removido')})},
  acrec:async()=>{if(!ME||!ME.admin)return;const c=newCode(),s=rnd(16);AUTH.rec={salt:s,hash:await hashPw(recNorm(c),s)};aSave();view.newrec=c;render();toast('Novo código gerado. Anote agora.',3500)},
  nav:(b,d)=>{view.obx=null;view.obxAll=null;view.h=d.t;view.id=null;view.trForm=false;view.trDraft=null;view.link=null;view.novoPac=false;delArm=null;view.prOpen=null;if(d.t==='pf'){view.pfPid='';view.pfNew=false}if(d.t!=='cm')view.cmDent='';render();topo()},
  pfNew:()=>{view.pfNew=true;view.pfPid='';render()},
  pfCancel:()=>{view.pfNew=false;render()},
  pfOpen:(b,d)=>{if(d.oid)(view.orcOpen=view.orcOpen||{})[d.oid]=true;view.id=d.pid;view.tab='orc';view.trSel=[];view.trTd={};view.trSh={};view.trUni=null;view.trBasket=[];view.trForm=false;view.trDraft=null;view.trFlt='';delArm=null;render();topo()},
  pfCreate:()=>{const p=db.p.find(x=>x.id===view.pfPid);if(!p){toast('Selecione um paciente');return}
    p.orcs.unshift({id:uid(),data:new Date().toLocaleDateString('pt-BR'),status:'Pendente',itens:[{id:uid(),proc:'',dente:'',valor:'',dt:defDt()}],desc:'',val:plusDays(15),cond:''});
    save();view.pfNew=false;view.id=p.id;view.tab='orc';render();topo();toast('Proposta criada para '+p.nome)},
  avsok:(b,d)=>{avsList=avsList.filter(x=>x.id!==d.id);avsRender()},
  avsgo:(b,d)=>{const a=(db.ag||[]).find(x=>x.id===d.id);avsList=avsList.filter(x=>x.id!==d.id);view.h='ag';view.id=null;if(a)view.agDate=a.data;render();avsRender();topo()},
  avsperm:()=>{avsAudio();try{const r=Notification.requestPermission(res=>{});if(r&&r.then)r.then(()=>{render()});else render()}catch(e){toast('Não foi possível pedir permissão neste navegador.',3500)}},
  avstest:async()=>{avsAudio();avsBeep();try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(e){}const ok=await avsNotify('Teste de aviso','Assim chegará o aviso do horário do paciente.','teste');toast(ok?'Aviso de teste enviado':'Aviso na tela ativo. Notificação do celular ainda não ativada.',3500)},
  pfNext:()=>{const p=db.p.find(x=>x.id===view.pfPid);if(!p){toast('Selecione um paciente');return}toast('Paciente selecionado: '+p.nome)},
  addlem:()=>{
    const titulo=$('lemTitulo').value.trim();
    if(!titulo){toast('Escreva o lembrete antes de adicionar');$('lemTitulo').focus();return}
    db.lem=db.lem||[];
    db.lem.push({id:uid(),titulo,data:$('lemData').value||tdy(),hora:$('lemHora').value||'',tipo:$('lemTipo').value||'Geral',obs:$('lemObs').value.trim(),feito:false});
    save();render();toast('Lembrete adicionado');
  },
  togglelem:(b,d)=>{const x=(db.lem||[]).find(y=>y.id===d.id);if(!x)return;x.feito=!x.feito;delArm=null;save();render()},
  rmlem:(b,d)=>arm(d.id,()=>{db.lem=(db.lem||[]).filter(x=>x.id!==d.id);save();render();toast('Lembrete excluído')}),
  svw:(b,d)=>{view.sv=d.t;view.vPage=0;render()},
  cmdent:(b,d)=>{view.cmDent=d.id;render();topo()},
  cmback:()=>{view.cmDent='';render();},
  agf:(b,d)=>{view.ag=d.t;render()},
  agdate:(b,d)=>{const e=$('agDate');if(e&&e.value){const x=new Date(e.value+'T12:00:00');x.setDate(x.getDate()+num(d.d));view.agDate=x.toISOString().slice(0,10);render()}},
  agtoday:()=>{view.agDate=tdy();render()},
  arqt:()=>{view.arq=!view.arq;q='';render()},
  novoPac:()=>{view.novoPac=true;render();setTimeout(()=>$('nn')?.focus(),50)},
  cancelNovoPac:()=>{view.novoPac=false;render()},
  dent:(b,d)=>{view.dent=d.t;render()},
  add:()=>{const n=$('nn').value.trim();if(!n){toast('Digite o nome do paciente');return}
    const cpfTxt=($('nc')?$('nc').value:'').trim(),tel=$('nt').value.trim();
    const r=pvCheck(n,cpfTxt,tel),bl=pvBloqueios(r,cpfTxt);
    if(bl.length){pvRender();toast(bl[0][0]+(bl[0][1]?': '+bl[0][1].nome:''),4200);return}
    db.p.push({id:uid(),nome:n,tel:pvFmtTel(tel),nasc:'',cpf:pvFmtCpf(cpfTxt),obs:'',arq:false,anam:{c:{},med:'',queixa:'',ultima:''},orcs:[],trat:[],olog:[],dplan:[],evol:[]});save();q='';view.novoPac=false;render();toast('Paciente cadastrado')},
  open:async (b,d)=>{const patient=db.p.find(x=>String(x.id)===String(d.id));if(!patient)return;if(window.OralCloud?.enabled&&window.OralCloudData?.loadPatient&&!OralCloudData.patientLoaded(patient.id)){b.disabled=true;b.setAttribute('aria-busy','true');try{const details=await OralCloudData.loadPatient(patient.id);if(details)Object.assign(patient,details);OralCloudData.prepareDefaults(db)}catch(error){b.disabled=false;b.removeAttribute('aria-busy');toast('Não foi possível carregar o prontuário: '+(error.message||'erro de conexão'),5000);return}}view.id=d.id;view.tab='dados';view.trSel=[];view.trTd={};view.trSh={};view.trUni=null;view.trBasket=[];view.trForm=false;view.trDraft=null;view.trFlt='';delArm=null;render();topo()},
  back:()=>{view.id=null;delArm=null;render()},
  tab:(b,d)=>{if(d.t==='auditoria'&&!window.OralPatientAudit?.allowed())return;view.tab=d.t;delArm=null;render()},
  auditrefresh:()=>{const p=cur();if(p&&window.OralPatientAudit?.allowed())window.OralPatientAudit.refresh(p.id)},
  rmArquivo:(b,d,p)=>{if(!p)return;p.arquivos=(p.arquivos||[]).filter(x=>x.id!==d.id);save();render();toast('Arquivo removido do prontuário')},
  arq:(b,d,p)=>{p.arq=!p.arq;save();view.id=null;render();toast(p.arq?'Paciente arquivado':'Paciente reativado')},
  del:(b,d,p)=>{
    if(!p.arq){toast('Arquive o paciente antes de excluir');return}
    if(db.vd.some(v=>v.pid===p.id)||db.ag.some(a=>a.pid===p.id)){toast('Há vendas ou consultas ligadas a este paciente. Mantenha arquivado.',3500);return}
    arm(p.id,()=>{db.p=db.p.filter(x=>x.id!==p.id);save();view.id=null;render();toast('Paciente excluído')})},
  tooth:(b,d)=>{view.tsel=d.n;render()},
  ttsel:(b,d)=>{const s=(view.trSel||[]).map(String),i=s.indexOf(d.n);if(i>=0)s.splice(i,1);else s.push(d.n);view.trSel=s;b.classList.toggle('sel');ttRefresh()},
  ttmode:(b,d)=>{view.trMode=d.m;ttRefresh()},
  ttmore:(b,d,p)=>{const c=ttCollect();if(c.err){toast(c.err[0],2800);ttFocus(c.err[1]);return}
    if(!c.lines.length){toast('Selecione os dentes e o tratamento primeiro');return}
    c.lines.forEach(l=>{l.id=uid();ttBasket().push(l)});
    document.querySelectorAll('.tt.sel').forEach(x=>x.classList.remove('sel'));
    view.trSel=[];view.trTd={};view.trUni=null;ttRefresh();
    toast('Procedimento adicionado à lista. Selecione os dentes do próximo procedimento.',3200)},
  ttbrm:(b,d)=>{view.trBasket=ttBasket().filter(l=>l.id!==d.id);ttRefresh()},
  ttrm:(b,d)=>{view.trSel=(view.trSel||[]).map(String).filter(x=>x!==d.n);const bt=document.querySelector('.tt[data-n="'+d.n+'"]');if(bt)bt.classList.remove('sel');ttRefresh()},
  trcancel:()=>{view.trForm=false;view.trDraft=null;render()},
  tsit:(b,d,p)=>{const n=view.tsel;if(!n)return;const o=(p.odo=p.odo||{}),de=o[n]||0,pa=+d.v;if(de===pa)return;o[n]=pa;(p.olog=p.olog||[]).push({d:new Date().toLocaleDateString('pt-BR'),n:+n,de,pa});if(p.olog.length>200)p.olog.shift();save();render()},
  addplan:(b,d,p)=>{const t=$('dpt').value.trim();if(!t){toast('Descreva o que precisa ser feito');return}(p.dplan=p.dplan||[]).push({id:uid(),n:view.tsel,txt:t,feito:false,data:tdy()});save();render();toast('Anotado no dente '+view.tsel)},
  planok:(b,d,p)=>{const x=(p.dplan||[]).find(y=>y.id===d.id);if(!x)return;x.feito=true;x.fdata=tdy();(p.evol=p.evol||[]).push({id:uid(),data:tdy(),n:x.n,txt:x.txt});save();render();toast('Lançado na evolução de hoje')},
  rmplan:(b,d,p)=>arm(d.id,()=>{p.dplan=p.dplan.filter(x=>x.id!==d.id);save();render()}),
  addevol:(b,d,p)=>{const t=$('evt').value.trim();if(!t){toast('Descreva o que foi feito');return}(p.evol=p.evol||[]).push({id:uid(),data:$('evd').value||tdy(),n:$('evn').value,txt:t});save();render();toast('Evolução salva')},
  rmevol:(b,d,p)=>arm(d.id,()=>{p.evol=p.evol.filter(x=>x.id!==d.id);save();render()}),
  sigclr:(b,d,p)=>{p.sign='';p.signDate='';p.signTermo='';save();render()},
  addo:(b,d,p)=>{const nid=uid();(view.orcOpen=view.orcOpen||{})[nid]=true;p.orcs.unshift({id:nid,data:new Date().toLocaleDateString('pt-BR'),status:'Pendente',itens:[{id:uid(),proc:'',dente:'',valor:'',dt:defDt()}],desc:'',val:plusDays(15),cond:''});save();render()},
  addi:(b,d,p)=>{getO(p,d.o).itens.push({id:uid(),proc:'',dente:'',valor:'',dt:defDt()});save();render()},
  rmi:(b,d,p)=>{const o=getO(p,d.o),it=o.itens[+d.i];if(it&&it.vid){toast('Este item já teve baixa. Exclua a venda antes de remover.',3000);return}if(it&&it.tid){const t=(p.trat||[]).find(z=>z.id===it.tid);if(t){delete t.oid;delete t.oiid}}o.itens.splice(+d.i,1);save();render()},
  addtr:(b,d,p)=>{
    if((view.trSel||[]).length||ttBasket().length){ttSave(p);return}
    if(!view.trForm){view.trForm=true;view.trDraft=view.trDraft||{};render();setTimeout(()=>{const e=$('trform');if(e)e.scrollIntoView({behavior:'smooth',block:'center'})},60);return}
    const proc=$('tnp').value.trim(),dt=$('tnd').value,val=num($('tnv').value),custo=num($('tnc').value),obs=$('tnobs').value.trim(),oid=$('tnor').value,m=procBy(proc);
    if(!proc){toast('Selecione o procedimento');return}
    if(!dt){toast('Escolha o dentista responsável');return}
    if(!(val>0)){toast('Informe o valor do tratamento');return}
    p.trat=p.trat||[];
    const teeth=(view.trSel||[]).map(String).sort((a,b)=>a-b),list=teeth.length?teeth:[''];
    let orc=null;
    if(oid==='new'){orc={id:uid(),data:new Date().toLocaleDateString('pt-BR'),status:'Pendente',itens:[],desc:'',val:plusDays(15),cond:''};p.orcs.unshift(orc)}
    else if(oid&&oid!=='none')orc=getO(p,oid);
    list.forEach(n=>{
      const t={id:uid(),proc,dente:n,obs,valor:r2(val),custo:r2(custo),mats:m?matSnap(m):[],dt,status:'Pendente',rep:0,vid:null,data:''};
      if(orc){const it={id:uid(),proc,dente:n,valor:String(r2(val)),obs,dt,tid:t.id};orc.itens.push(it);t.oid=orc.id;t.oiid=it.id}
      p.trat.push(t);
    });
    view.trSel=[];view.trForm=false;view.trDraft=null;save();render();
    toast(list.length>1?list.length+' tratamentos adicionados':'Tratamento adicionado'+(orc?' ao orçamento':''),2400)},
  trbaixa:(b,d,p)=>{const x=(p.trat||[]).find(t=>t.id===d.id);if(!x)return;if(x.vid){toast('Este tratamento já teve baixa');return}if(!x.dt){toast('Escolha o dentista responsável');return}const val=r2(num(x.valor));if(!(val>0)){toast('Informe o valor do tratamento');return}const mm=comCalc(x.dt,x.proc,val,qOf(x)),rep=r2(mm.rep),v={id:uid(),pid:p.id,dt:x.dt,proc:x.proc,valor:val,mat:mm.mat,lab:mm.lab,rep,data:tdy(),pg:[]};db.vd.push(v);x.vid=v.id;x.status='Concluído';x.rep=rep;x.data=v.data;(p.evol=p.evol||[]).push({id:uid(),data:tdy(),n:x.dente||'',txt:(x.proc||'Procedimento')+(x.dente?' ('+dLab(x.dente)+' '+x.dente+')':'')+(x.obs?': '+x.obs:''),auto:true,vid:v.id,tid:x.id});if(x.oiid){const oo=getO(p,x.oid),ii=oo&&oo.itens.find(i=>i.id===x.oiid);if(ii)ii.vid=v.id}save();render();toast('Baixa realizada e comissão enviada para o dentista')},
  rmtr:(b,d,p)=>{const x=(p.trat||[]).find(t=>t.id===d.id);if(x&&x.vid){toast('Não é possível excluir um tratamento com baixa. Exclua a venda primeiro.',3000);return}arm(d.id,()=>{if(x&&x.oiid){const oo=getO(p,x.oid);if(oo)oo.itens=oo.itens.filter(i=>i.id!==x.oiid)}p.trat=p.trat.filter(y=>y.id!==d.id);save();render()})},
  copy:(b,d,p)=>copy(orcText(p,getO(p,d.o)),'Orçamento copiado'),
  owa:(b,d,p)=>waOpen(p.tel,orcText(p,getO(p,d.o))),
  print:(b,d,p)=>printOrc(p,getO(p,d.o)),
  pdf:(b,d,p)=>pdfOrc(p,getO(p,d.o)),
  obaixa:(b,d,p)=>{
    const o=getO(p,d.o),it=o.itens[+d.i];
    if(!it.dt){toast('Escolha o dentista que vai executar');return}
    const v=r2(num(it.valor)*fac(o));if(!(v>0)){toast('Informe o valor do item');return}
    view.obx=o.id+':'+it.id;view.obxAll=null;render()},
  obcancel:()=>{view.obx=null;view.obxAll=null;render()},
  lemtab:(b,d)=>{view.lemTab=d.t;render()},
  lemgo:()=>{view.lemTab='ret';view.h='lem';view.id=null;render();topo()},
  retwa:(b,d)=>{const p=db.p.find(x=>x.id===d.id);if(!p)return;waOpen(p.tel,retMsg(p,retLast(p)));p.retCont=tdy();save();render()},
  retok:(b,d)=>{const p=db.p.find(x=>x.id===d.id);if(!p)return;p.retCont=tdy();save();render();toast('Contato registrado',2000)},
  retall:()=>{view.retAll=!view.retAll;render()},
  cfgretmsg:()=>{db.cl=db.cl||{};db.cl.retMsg=RET_MSG_DEF;save();render();toast('Mensagem padrão restaurada',2500)},
  otoggle:(b,d)=>{view.orcOpen=view.orcOpen||{};view.orcOpen[d.o]=!view.orcOpen[d.o];view.obx=null;view.obxAll=null;render()},
  oball:(b,d,p)=>{
    const o=getO(p,d.o),pend=o.itens.filter(it=>!it.vid);
    const sd=pend.find(it=>!it.dt);if(sd){toast('Escolha o dentista do item "'+(sd.proc||'sem nome')+'" antes de dar baixa',3500);return}
    const sv=pend.find(it=>!(r2(num(it.valor)*fac(o))>0));if(sv){toast('Informe o valor do item "'+(sv.proc||'sem nome')+'"',3500);return}
    view.obx=null;view.obxAll=o.id;render()},
  oballconf:(b,d,p)=>{
    const o=getO(p,d.o),pend=o.itens.filter(it=>!it.vid);if(!pend.length)return;
    const val=it=>r2(num(it.valor)*fac(o)),tot=r2(pend.reduce((a,it)=>a+val(it),0));
    if(pend.some(it=>!it.dt)){toast('Há item sem dentista definido');return}
    let rest=$('oab').value.trim()===''?0:num($('oab').value);
    if(rest>tot+0.005){toast('O valor recebido é maior que o total da baixa ('+brl(tot)+')',3500);return}
    const forma=$('oaf').value,data=$('oad').value||tdy();
    pend.forEach(it=>{const vv=val(it),take=Math.min(rest,vv);rest=r2(rest-take);obLaunch(p,it,vv,r2(take),forma,data,obCalc(it,vv))});
    view.obxAll=null;save();render();toast(pend.length+(pend.length===1?' item baixado':' itens baixados')+': vendas lançadas e comissões registradas',3500)},
  obconf:(b,d,p)=>{
    const o=getO(p,d.o),it=o&&o.itens[+d.i];if(!it)return;
    if(it.vid){toast('Este item já teve baixa');return}
    if(!it.dt){toast('Escolha o dentista que vai executar');return}
    const vv=num($('obv').value);if(!(vv>0)){toast('Informe o valor do atendimento');return}
    const rc=$('obc').value.trim()===''?0:num($('obc').value);
    if(rc>vv+0.005){toast('O valor recebido é maior que o valor da venda');return}
    obLaunch(p,it,vv,rc,$('obf').value,$('obd').value||tdy(),num($('obr').value));
    view.obx=null;save();render();toast('Baixa feita: venda lançada e comissão registrada',3000)},
  addvd:()=>{
    const vv=num($('vv').value);if(!(vv>0)){toast('Informe o valor do atendimento');return}
    const dtid=$('vdn').value;if(!dtid){toast('Escolha o dentista');return}
    let rc=$('vrc').value.trim()===''?0:num($('vrc').value);
    if(rc>vv){toast('O valor recebido é maior que o valor da venda');return}
    const proc=$('vpr').value.trim(),mm=comCalc(dtid,proc,vv,(view.pre&&view.pre.qtd)||1),data=$('vdt').value||tdy(),pid=$('vp').value;
    const v={id:uid(),pid,dt:dtid,proc,valor:r2(vv),mat:mm.mat,lab:mm.lab,rep:r2(num($('vr').value)),data,pg:[]};
    if(rc>0)v.pg.push({id:uid(),data,valor:r2(rc),forma:$('vfm').value});
    const lk=view.link;
    if(lk&&lk.pid===pid){
      if(lk.oid){db.p.forEach(p=>p.orcs.forEach(o=>o.itens.forEach(i=>{if(i.id===lk.ii)i.vid=v.id})));db.p.forEach(p=>(p.trat||[]).forEach(t=>{if(t.oiid===lk.ii&&!t.vid){t.vid=v.id;t.status='Concluído';t.rep=v.rep;t.data=v.data}}))}
      if(lk.ag){const a=db.ag.find(x=>x.id===lk.ag);if(a){a.vid=v.id;a.st='Compareceu'}}
    }
    {const pt=db.p.find(x=>x.id===pid);
     if(pt){
       let dente='',ag=null;
       if(lk&&lk.pid===pid){
         if(lk.oid)db.p.forEach(q=>(q.orcs||[]).forEach(o=>o.itens.forEach(i=>{if(i.id===lk.ii&&i.dente)dente=String(i.dente)})));
         if(lk.ag)ag=db.ag.find(x=>x.id===lk.ag)||null;
       }
       const txt=(proc||'Atendimento')+' — realizado por '+dName(dtid)+'.'+(ag?'\nConsulta agendada: '+ag.hora+'–'+hm(mins(ag.hora)+(ag.dur||30))+'.':'');
       (pt.evol=pt.evol||[]).push({id:uid(),data,n:dente,txt,auto:true,vid:v.id,ag:ag?ag.id:undefined});
     }}
    view.link=null;db.vd.push(v);save();render();toast('Venda lançada e evolução atualizada')},
  rmvd:(b,d)=>arm(d.id,()=>{
    db.p.forEach(p=>p.orcs.forEach(o=>o.itens.forEach(i=>{if(i.vid===d.id)delete i.vid})));db.p.forEach(p=>(p.trat||[]).forEach(t=>{if(t.vid===d.id){t.vid=null;t.status='Pendente';t.rep=0;t.data=''}}));
    db.ag.forEach(a=>{if(a.vid===d.id){delete a.vid;if(a.st==='Compareceu')a.st='Confirmado'}});
    db.p.forEach(p=>{if(p.evol)p.evol=p.evol.filter(e=>!(e.auto&&e.vid===d.id))});
    db.vd=db.vd.filter(x=>x.id!==d.id);save();render()}),
  rcv:(b,d)=>{
    const v=db.vd.find(x=>x.id===d.id),inp=document.querySelector(`[data-rcv="${d.id}"]`),f=document.querySelector(`[data-rcvf="${d.id}"]`),val=num(inp.value);
    if(!(val>0)){toast('Informe o valor recebido');return}
    if(val>saldoV(v)+0.005){toast('Valor maior que o saldo ('+brl(saldoV(v))+')',3000);return}
    v.pg.push({id:uid(),data:tdy(),valor:r2(val),forma:f.value});save();render();toast('Recebimento registrado')},
  rmpg:(b,d)=>arm(d.pg,()=>{const v=db.vd.find(x=>x.id===d.id);v.pg=v.pg.filter(p=>p.id!==d.pg);save();render()}),
  adddt:()=>{const n=$('dn').value.trim();if(!n){toast('Digite o nome do dentista');return}
    db.dt.push({id:uid(),nome:n,modo:$('dm').value,pct:($('dp').value||'0').replace(',','.'),base:$('dbs').value,ativo:true});save();render();toast('Dentista cadastrado')},
  dtarq:(b,d)=>{const x=db.dt.find(y=>y.id===d.id);x.ativo=x.ativo===false;save();render()},
  rmdt:(b,d)=>arm(d.id,()=>{db.dt=db.dt.filter(x=>x.id!==d.id);save();render()}),
  cpay:(b,d)=>{
    const inp=document.querySelector(`[data-cpv="${d.id}"]`),val=num(inp.value),t=dtTot(d.id);
    if(!(val>0)){toast('Informe o valor pago');return}
    if(val>t.apagar+0.005){toast('Valor maior que o saldo a pagar ('+brl(t.apagar)+')',3000);return}
    const dI=document.querySelector(`[data-cpd="${d.id}"]`),oI=document.querySelector(`[data-cpo="${d.id}"]`);
    db.cp.push({id:uid(),dt:d.id,data:(dI&&dI.value)||tdy(),valor:r2(val),obs:oI?oI.value.trim():''});save();render();toast('Pagamento registrado')},
  rmcp:(b,d)=>arm(d.id,()=>{db.cp=db.cp.filter(c=>c.id!==d.id);save();render()}),
  addpr:()=>{const n={id:uid(),nome:'Novo procedimento',min:'30',mat:'',lab:'',custo:'',par:'',parTipo:'reais',preco:'',parc:false,mats:[]};db.pr.unshift(n);view.prOpen=n.id;save();render()},
  addmt:()=>{const nome=$('mtn').value.trim(),preco=num($('mtp').value),qtd=num($('mtq').value)||1,stock=num($('mts').value),val=$('mtv').value;if(!nome){toast('Digite o nome do material');return}if(!(preco>0)){toast('Informe o preço da embalagem');return}if(stock<0||!Number.isFinite(stock)){toast('Quantidade em estoque inválida');return}db.mt.push({id:uid(),nome,un:$('mtu').value,preco:String(preco),qtd:String(qtd),val:'',ret:false,lotes:stock>0?[{id:uid(),qtd:String(stock),val,ret:false}]:[]});save();render();toast('Material cadastrado')},
  addmtlot:(b,d)=>{const m=db.mt.find(y=>y.id===d.id),q=document.querySelector(`[data-newlot-q="${d.id}"]`),v=document.querySelector(`[data-newlot-v="${d.id}"]`);if(!m||!q)return;const n=num(q.value);if(!(n>0)||!Number.isFinite(n)){toast('Informe a quantidade do lote');return}m.lotes=m.lotes||[];m.lotes.push({id:uid(),qtd:String(n),val:v?.value||'',ret:false});save();render();toast('Lote adicionado')},
  togglemtlot:(b,d)=>{const m=db.mt.find(y=>y.id===d.id),l=m?.lotes?.find(x=>x.id===d.r);if(!l)return;l.ret=!l.ret;save();render();toast(l.ret?'Lote retirado do estoque':'Lote reativado')},
  retmt:(b,d)=>{const m=db.mt.find(y=>y.id===d.id);if(!m)return;const l=(m.lotes||[]).filter(x=>!x.ret).sort((a,b)=>(a.val||'9999').localeCompare(b.val||'9999'))[0];if(l)l.ret=true;else m.ret=true;save();render();toast('Lote retirado do estoque')},
  repmt:(b,d)=>{const m=db.mt.find(y=>y.id===d.id);if(!m)return;m.ret=false;save();render();toast('Material reativado')},
  rmmt:(b,d)=>{const u=mtUsage(d.id);if(u.length){toast('Este material é usado em '+u.length+' procedimento(s). Remova-o de lá antes de excluir.',3500);return}arm(d.id,()=>{db.mt=db.mt.filter(m=>m.id!==d.id);save();render();toast('Material excluído')})},
  addpm:(b,d)=>{const x=db.pr.find(y=>y.id===d.id),sel=$('pms-'+d.id);if(!x||!sel||!sel.value){toast('Escolha um material');return}x.mats=x.mats||[];const ex=x.mats.find(r=>r.mid===sel.value);if(ex)ex.q=String(num(ex.q)+1);else x.mats.push({id:uid(),mid:sel.value,q:'1'});syncMat(x);view.prOpen=x.id;save();render()},
  rmpm:(b,d)=>{const x=db.pr.find(y=>y.id===d.id);if(!x)return;x.mats=(x.mats||[]).filter(r=>r.id!==d.r);if(x.mats.length)syncMat(x);else x.mat='';view.prOpen=x.id;save();render()},
  prsearch:()=>{if(view.prq===undefined)view.prq='';else delete view.prq;render();setTimeout(()=>{const e=document.getElementById('prq');if(e){e.focus();e.select()}},0)},
  prmaterial:()=>{view.prMaterial=view.prMaterial===false;render();toast(view.prMaterial===false?'Custo de materiais ocultado':'Custo de materiais ativado')},
  prauto:()=>{let n=0;db.pr.forEach(x=>{const s=prCalc(x).sug;if(s>0){x.preco=s.toFixed(2);n++}});save();render();toast(n+' procedimento(s) precificado(s) automaticamente')},
  prprint:()=>{window.print()},
  evsigclr:(b,d,p)=>{p.evolSign='';p.evolSignDate='';save();render()},
  printevol:(b,d,p)=>printEvolucao(p),
  printficha:(b,d,p)=>printFicha(p),
  savebtn:(b,d,p)=>{const ae=document.activeElement;if(ae&&ae.blur)ae.blur();save();updSaveStat();toastSaved('✓ Tudo salvo neste paciente')},
  prshare:()=>{copy(window.location.href,'Link copiado')},
  rmpr:(b,d)=>arm(d.id,()=>{db.pr=db.pr.filter(x=>x.id!==d.id);save();render()}),
  usesug:(b,d)=>{const x=db.pr.find(y=>y.id===d.id);x.preco=prCalc(x).sug.toFixed(2);save();render()},
  addag:()=>{
    const ap=$('ap').value,ad=$('ad').value,ah=$('ah').value,dtid=$('adn').value,du=Math.max(5,num($('adu').value)||30),cadeira=$('acadeira').value||'1';
    if(!ap){toast('Digite o nome e escolha o paciente na lista',3500);const n=$('apn');if(n)n.focus();return}
    if(!ad||!ah){toast('Informe data e hora');return}
    const n={id:uid(),pid:ap,data:ad,hora:ah,dur:du,dt:dtid,proc:$('apr').value.trim(),tipo:($('atp')?$('atp').value.trim():''),cadeira,st:'Agendado'},c=confl(n),key=ad+ah+dtid+cadeira;
    if(c&&view.enc!==key){view.enc=key;toast('Conflito: '+pName(c.pid)+' às '+c.hora+' no '+(c.cadeira==='2'?'Consultório 2':'Consultório 1')+'. Toque de novo para encaixar mesmo assim.',4500);return}
    view.enc=null;db.ag.push(n);save();render();toast('Consulta agendada')},
  rmag:(b,d)=>arm(d.id,()=>{db.ag=db.ag.filter(x=>x.id!==d.id);save();render()}),
  agbaixa:(b,d)=>{const a=db.ag.find(x=>x.id===d.id),m=procBy(a.proc);view.pre={pid:a.pid,dt:a.dt,proc:a.proc,valor:m&&m.preco?m.preco:'',ag:a.id};view.h='vd';view.sv='dia';render();topo()},
  agwa:(b,d)=>{const a=db.ag.find(x=>x.id===d.id),p=db.p.find(x=>x.id===a.pid);
    waOpen(p?p.tel:'','Olá, '+(p?p.nome.split(' ')[0]:'')+'! Confirmando sua consulta em '+fd(a.data)+' às '+a.hora+(a.dt?' com '+dName(a.dt):'')+'. Podemos confirmar?')},
  bksave:async()=>{if(!dl)return;try{await dl.save({filename:'consultorio-backup-'+tdy()+'.json',data:bkData()});markBk();render();toast('Backup salvo')}catch(e){if(!e||e.code!=='declined')toast('Não foi possível salvar o arquivo. Use o texto do backup.',3500)}},
  bktxt:()=>{view.bkt=!view.bkt;render()},
  bkcopy:()=>copy(bkData(),'Backup copiado. Cole em um lugar seguro.',()=>{markBk();render()}),
  bkrst:()=>restore()
};

