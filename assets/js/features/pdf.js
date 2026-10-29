/* ===== PDF direto (sem depender da janela de impressão) ===== */
function pdfPath(doc,d,T,fill,stroke){
  const tk=d.match(/[MHVLQZ]|-?\d+(?:\.\d+)?/g)||[];let i=0,cx=0,cy=0,sx=0,sy=0,sub=null;
  const flush=()=>{if(sub&&sub.segs.length){doc.lines(sub.segs,sub.x,sub.y,[1,1],'FD',true)}sub=null};
  doc.setFillColor(...fill);doc.setDrawColor(...stroke);
  const nx=()=>parseFloat(tk[i++]);
  while(i<tk.length){
    const c=tk[i++];
    if(c==='M'){flush();cx=nx();cy=nx();sx=cx;sy=cy;const p=T(cx,cy);sub={x:p[0],y:p[1],segs:[],px:p[0],py:p[1]}}
    else if(c==='H'){const x=nx(),p=T(x,cy);sub.segs.push([p[0]-sub.px,p[1]-sub.py]);sub.px=p[0];sub.py=p[1];cx=x}
    else if(c==='V'){const y=nx(),p=T(cx,y);sub.segs.push([p[0]-sub.px,p[1]-sub.py]);sub.px=p[0];sub.py=p[1];cy=y}
    else if(c==='L'){const x=nx(),y=nx(),p=T(x,y);sub.segs.push([p[0]-sub.px,p[1]-sub.py]);sub.px=p[0];sub.py=p[1];cx=x;cy=y}
    else if(c==='Q'){const x1=nx(),y1=nx(),x=nx(),y=nx();
      const a=T(cx+2/3*(x1-cx),cy+2/3*(y1-cy)),b=T(x+2/3*(x1-x),y+2/3*(y1-y)),e=T(x,y);
      sub.segs.push([a[0]-sub.px,a[1]-sub.py,b[0]-sub.px,b[1]-sub.py,e[0]-sub.px,e[1]-sub.py]);sub.px=e[0];sub.py=e[1];cx=x;cy=y}
    else if(c==='Z'){cx=sx;cy=sy}
  }
  flush();
}
function pdfTooth(doc,n,dec,up,on,x,y,w){
  const d=n%10;let k=dec?(d<=2?'inc':d===3?'can':'mol'):(d<=2?'inc':d===3?'can':d<=5?'pre':'mol');
  if(k==='mol'&&!up)k='mol2';
  const sc=w/30,T=(px,py)=>[x+px*sc,up?y+py*sc:y+(54-py)*sc],fill=on?[255,196,122]:[255,255,255],stroke=on?[184,92,0]:[34,34,34];
  doc.setLineWidth(.2);pdfPath(doc,TP[k].r,T,fill,stroke);pdfPath(doc,TP[k].c,T,fill,stroke);
}
function pdfOdo(doc,sel,dec,x0,y0,W){
  const A=ARC[dec?'dec':'perm'],n=A[0][1].length,gap=3,cell=(W-6-gap)/(2*n),tw=cell*.84,th=tw*54/30;
  const H=18.5+2*th;
  doc.setDrawColor(119,119,119);doc.setLineWidth(.25);doc.roundedRect(x0,y0,W,H,3,3,'S');
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(119,119,119);doc.text(dec?'Dentes Decíduos':'Dentes Permanentes',x0+3,y0+4);
  const num=(v,cx,yy,on)=>{doc.setFont('helvetica',on?'bold':'normal');doc.setFontSize(7);doc.setTextColor(...(on?[184,92,0]:[136,136,136]));doc.text(String(v),cx,yy,{align:'center'})};
  const rowY=[y0+4+3.5+3.5,y0+4+3.5+3.5+th+2];
  [[A[0],A[1],true],[A[2],A[3],false]].forEach(([a,b,up],r)=>{
    [a,b].forEach((q,qi)=>q[1].forEach((v,j)=>{
      const cx=x0+3+(qi*n+j)*cell+(qi?gap:0)+cell/2,on=sel.has(v);
      pdfTooth(doc,v,dec,up,on,cx-tw/2,rowY[r],tw);
      num(v,cx,up?rowY[0]-1.3:rowY[1]+th+3,on);
    }));
  });
  return H;
}
async function pdfOrc(p,o){
  if(!(await ensureJsPDF())){toast('Não foi possível carregar o gerador de PDF. Verifique a conexão e tente novamente.',3500);return}
  try{
  const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'}),cl=Object.assign({},CL_DEF,db.cl||{});
  const S=v=>String(v==null?'':v).replace(/[−–—]/g,'-').replace(/[^\u0000-\u00FF]/g,'?');
  const NAVY=[217,106,0],GRAY=[239,239,239],L=12,R=198,W=R-L,MAXY=280;
  let y=10;
  const font=(st,sz,col)=>{doc.setFont('helvetica',st);doc.setFontSize(sz);doc.setTextColor(...(col||[17,17,17]))};
  const ensure=h=>{if(y+h>MAXY){doc.addPage();y=14;return true}return false};
  const sel=new Set();o.itens.forEach(i=>String(i.dente||'').split(/[,;\s]+/).filter(Boolean).forEach(x=>{const v=parseInt(x,10);if(v)sel.add(v)}));
  const hasDec=[...sel].some(n=>(n>=51&&n<=55)||(n>=61&&n<=65)||(n>=71&&n<=75)||(n>=81&&n<=85));
  // cabeçalho
  pdfLogo(doc,L,y);
  let iy=y+5;font('bold',13);doc.text(S(cl.nome),L+35,iy);iy+=5;font('normal',9);
  [cl.end,[cl.email,cl.tel].filter(Boolean).join(' / '),cl.cnpj].filter(Boolean).forEach(t=>{doc.text(S(t),L+35,iy);iy+=4})
  y+=22;doc.setDrawColor(230,230,230);doc.setLineWidth(.25);doc.line(L,y,R,y);
  // título
  y+=17;font('bold',22);doc.text('Proposta Financeira',105,y,{align:'center'});
  // paciente
  y+=9;doc.setFillColor(...GRAY);doc.roundedRect(L,y,132,17,2,2,'F');doc.roundedRect(L+136,y,W-136,17,2,2,'F');
  font('normal',10);doc.text('Nome do Paciente',L+4,y+5.5);doc.text('Telefone',L+140,y+5.5);
  font('bold',13,NAVY);doc.text(S(doc.splitTextToSize(S(p.nome),122)[0]),L+4,y+12.5);doc.text(S(p.tel||'-'),L+140,y+12.5);
  y+=17+9;
  // odontograma
  font('bold',13.5,NAVY);doc.text('Odontograma',L,y+4);y+=7;
  const h1=pdfOdo(doc,sel,false,L,y,118);let h2=0;if(hasDec)h2=pdfOdo(doc,sel,true,L+121,y,W-121);
  y+=Math.max(h1,h2)+8;
  // tabela
  const head=()=>{doc.setFillColor(...GRAY);doc.rect(L,y,W,9.5,'F');font('bold',13,NAVY);doc.text('Tratamentos',L+3,y+6.4);doc.text('Qtd.',R-84,y+6.4,{align:'center'});doc.text('Valor unit.',R-34,y+6.4,{align:'right'});doc.text('Total',R-3,y+6.4,{align:'right'});y+=9.5};
  ensure(9.5+16);head();
  o.itens.forEach((it,idx)=>{
    font('normal',11);const main=doc.splitTextToSize(S('- '+(it.proc||'Procedimento')),96);
    const dn=it.dente?S('('+dLab(it.dente)+' '+it.dente+')'):'';const mm=itMult(it);
    let dnNewLine=false;if(dn){font('normal',11);const lw=doc.getTextWidth(main[main.length-1]);font('normal',9.5);if(lw+doc.getTextWidth(dn)+3>96)dnNewLine=true}
    font('normal',9.5);const ob=it.obs?doc.splitTextToSize(S(it.obs),96):[];
    const nL=main.length+(dnNewLine?1:0),h=nL*4.8+ob.length*4.1+(ob.length?1:0)+7;
    if(ensure(h)){head()}
    if(idx%2===1){doc.setFillColor(244,244,244);doc.rect(L,y,W,h,'F')}
    let ty=y+6;font('normal',11);main.forEach((t,k)=>{doc.text(t,L+3,ty);if(k<main.length-1)ty+=4.8});
    if(dn){if(dnNewLine){ty+=4.8;font('normal',9.5,[85,85,85]);doc.text(dn,L+3,ty)}else{font('normal',11);const lw=doc.getTextWidth(main[main.length-1]);font('normal',9.5,[85,85,85]);doc.text(dn,L+3+lw+2,ty)}}
    font('normal',9.5,[68,68,68]);ob.forEach(t=>{ty+=4.1;doc.text(t,L+3,ty)});
    font('normal',11);doc.text(String(mm.q),R-84,y+6,{align:'center'});doc.text(S(nbr(mm.u)),R-34,y+6,{align:'right'});doc.text(S(nbr(mm.t)),R-3,y+6,{align:'right'});
    y+=h;
  });
  y+=4;
  // total
  const disc=num(o.desc)>0,th=disc?22:10.5;ensure(th+30);
  doc.setFillColor(...GRAY);doc.roundedRect(L,y,W,th,1.5,1.5,'F');
  const pair=(lab,val,yy,st,sz,col)=>{font(st,sz,col);const vw=doc.getTextWidth(val);doc.text(val,R-3,yy,{align:'right'});doc.text(lab,R-3-vw-6,yy,{align:'right'})};
  let ty=y+6.8;if(disc){pair('Subtotal',S(brl(sub(o))),ty,'normal',10.5,[51,51,51]);ty+=5;pair('Desconto','- '+S(brl(o.desc)),ty,'normal',10.5,[51,51,51]);ty+=6.5}
  pair('Total',S(brl(total(o))),ty,'bold',13.5,NAVY);
  y+=th+9;
  // pagamento
  ensure(26);font('bold',13.5,NAVY);doc.text('Forma de Pagamento',L,y);y+=6;
  font('normal',11);doc.splitTextToSize(S(String(o.cond||'A combinar').toUpperCase()),W).forEach(t=>{doc.text(t,L,y);y+=4.8});
  if(o.val){font('normal',10,[68,68,68]);doc.text(S('Proposta válida até '+fd(o.val)+'.'),L,y+1);y+=5}
  y+=12;ensure(8);font('normal',11);doc.text(S(cl.nome+' , '+hojeBR()+'.'),L,y);
  // rodapé
  const N=doc.getNumberOfPages();
  for(let i=1;i<=N;i++){doc.setPage(i);font('normal',9,[119,119,119]);doc.text('página '+i+' de '+N,R,290,{align:'right'})}
  const nome=S(p.nome).replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_')||'paciente';
  doc.save('Proposta_'+nome+'.pdf');toast('PDF gerado',2200);
  }catch(e){console.error(e);toast('Não foi possível gerar o PDF. Use Copiar texto.',3500)}
}

function clLogoSrc(){const c=db.cl||{};return c.logo||CL_LOGO}
function pdfLogo(doc,x,y){
  const c=db.cl||{};
  if(c.semLogo)return;
  try{
    if(c.logo){const w0=c.logoW||150,h0=c.logoH||102,k=Math.min(34/w0,20/h0);doc.addImage(c.logo,'PNG',x,y,w0*k,h0*k)}
    else doc.addImage(CL_LOGO,'PNG',x,y,27,27*102/150);
  }catch(e){}
}
function cfgRefreshTop(){const t=document.querySelector('.ov-top');if(t)t.outerHTML=ovTop()}
function applyTheme(){
  const c=window.oralValleLocalAccent ? window.oralValleLocalAccent() : '#ff7a00';
  const shade=(hex,amt)=>{hex=String(hex||'#ff7a00').replace('#','');if(hex.length!==6)return '#ff920f';const n=parseInt(hex,16);let r=Math.max(0,Math.min(255,(n>>16)+amt)),g=Math.max(0,Math.min(255,((n>>8)&255)+amt)),b=Math.max(0,Math.min(255,(n&255)+amt));return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('')};
  document.documentElement.style.setProperty('--ac',c);document.documentElement.style.setProperty('--ov-orange',c);document.documentElement.style.setProperty('--ov-orange-2',shade(c,18));document.documentElement.style.setProperty('--ov-orange-3',shade(c,38));
  // A barra de titulo do app instalado deve ter exatamente a mesma cor do cabecalho.
  // Nao usar corTema aqui: ela pode ser diferente do laranja fixo do cabecalho.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content','#c56800');
}
function cfgHtml(){
  const cl=Object.assign({},CL_DEF,db.cl||{});
  const CT=[['empresa','Empresa'],['financeiro','Financeiro'],['docs','Documentos'],['visual','Aparência'],['acesso','Acessos']],T=CT.some(x=>x[0]===view.cfgTab)?view.cfgTab:'empresa';
  const cfgTabs='<div class="tabs" role="tablist">'+CT.map(x=>`<button type="button" role="tab" aria-selected="${T===x[0]}" data-act="cfgtab" data-t="${x[0]}" class="${T===x[0]?'on':''}">${x[1]}</button>`).join('')+'</div>';
  const f=(k,l,ex,hint)=>`<label for="cl_${k}">${l}</label><input id="cl_${k}" data-cl="${k}" ${ex||''} value="${esc(cl[k])}">${hint?`<p class="note" style="margin:4px 0 0">${hint}</p>`:''}`;
  return `<div class="cfg-page"><div class="ov-page-head"><div><h1>Configurações</h1><p class="sub">Logo e dados da empresa usados no sistema, orçamentos, receituários, atestados e fichas impressas.</p></div></div>
  ${cfgTabs}${T==='financeiro'?ovFinanceSettings():''}${T==='acesso'?pmCardHtml():''}${T==='visual'?`<section class="card cfg-card"><h2>Modo de aparência</h2><p class="note">Escolha como visualizar o sistema neste dispositivo. A preferência fica salva no navegador.</p><div style="display:flex;gap:16px;flex-wrap:wrap"><label style="display:flex;align-items:center;gap:8px"><input type="radio" name="ov-theme" data-ov-theme-choice value="light" style="width:20px;min-height:20px" ${document.documentElement.getAttribute('data-ov-mode')!=='dark'?'checked':''}> ☀️ Modo claro</label><label style="display:flex;align-items:center;gap:8px"><input type="radio" name="ov-theme" data-ov-theme-choice value="dark" style="width:20px;min-height:20px" ${document.documentElement.getAttribute('data-ov-mode')==='dark'?'checked':''}> 🌙 Modo escuro</label></div></section><section class="card cfg-card"><h2>Cor do sistema</h2><label for="cfgColor">Escolha a cor principal</label><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><input id="cfgColor" type="color" value="${esc(window.oralValleLocalAccent ? window.oralValleLocalAccent() : '#ff7a00')}" style="width:70px;height:48px;padding:3px;min-height:48px"><span class="note" style="margin:0">A cor será aplicada aos botões, destaques e cabeçalho do sistema.</span></div><button class="ghost sm" data-act="cfgcolorreset" style="margin-top:10px">Restaurar cor laranja padrão</button></section>
  <section class="card cfg-card"><h2>Ícone no topo do sistema</h2>
    <div class="cfg-logo"><div class="cfg-logo-prev"><img src="${cl.icone||''}" alt="Ícone atual" ${cl.icone?'':'style="display:none"'}></div>
    <div style="flex:1;min-width:200px"><label for="cfgIcon" style="margin-top:0">Enviar ícone (PNG ou WebP com transparência; JPG não mantém fundo transparente)</label><input id="cfgIcon" type="file" accept="image/png,image/jpeg,image/webp">
    <p class="note" style="margin:6px 0 0">Este ícone aparece ao lado do nome da empresa no topo. Você pode configurá-lo separadamente da logo usada nos documentos.</p>
    ${cl.icone?'<button class="ghost sm" data-act="cfgiconrm" style="margin-top:8px">Remover ícone personalizado</button>':'<p class="note" style="margin:6px 0 0">Usando o ícone padrão ou a logo já cadastrada.</p>'}</div></div>
  </section>
  <section class="card cfg-card"><h2>Logo dos documentos</h2>
    <div class="cfg-logo"><div class="cfg-logo-prev"><img src="${cl.semLogo?'':clLogoSrc()}" alt="Logo atual" ${cl.semLogo?'style="display:none"':''}></div>
    <div style="flex:1;min-width:200px"><label for="cfgLogo" style="margin-top:0">Enviar nova logo (PNG ou WebP com transparência; JPG não mantém fundo transparente)</label><input id="cfgLogo" type="file" accept="image/png,image/jpeg,image/webp">
    <p class="note" style="margin:6px 0 0">Ela aparece no topo do sistema e nos documentos em PDF e impressos. Prefira uma imagem com fundo transparente ou branco.</p>
    ${cl.logo?'<button class="ghost sm" data-act="cfglogorm" style="margin-top:8px">Voltar à logo padrão</button>':(cl.semLogo?'<p class="note" style="margin:6px 0 0">Nenhuma logo está sendo exibida.</p>':'<p class="note" style="margin:6px 0 0">Usando a logo padrão.</p>')}</div></div>
  </section>
  <section class="card cfg-card"><h2>Remover todas as logos</h2><p class="note" style="margin-top:0">Remove a logo dos documentos, o ícone do cabeçalho e também a ilustração padrão. O sistema ficará sem nenhuma imagem de logo.</p><button class="danger sm" data-act="cfgnologo">Remover todas as logos</button></section>`:''}${T==='empresa'?`
  <section class="card cfg-card"><h2>Dados da empresa</h2><p class="note" style="margin:0 0 4px">Alterações são salvas automaticamente.</p>
    ${f('nome','Nome da clínica (nos documentos)')}${f('marca','Nome da empresa no topo do sistema')}${f('sub','Subtítulo no topo do sistema (opcional)')}${f('end','Endereço')}${f('email','E-mail','type="email"')}${f('tel','Telefone','inputmode="tel"')}${f('cnpj','CNPJ')}
  </section>
  <section class="cfg-card card"><h2>Retorno de pacientes</h2><p class="note" style="margin:0 0 4px">Lista de pacientes que não voltam à clínica, em Lembretes, com aviso na Agenda.</p>
    <label for="cl_retMeses">Avisar quando passar de</label><select id="cl_retMeses" data-cl="retMeses">${[3,4,6,9,12].map(n=>`<option value="${n}"${String(cl.retMeses)===String(n)?' selected':''}>${n} meses sem consulta</option>`).join('')}</select>
    <label for="cl_retMsg">Mensagem do WhatsApp</label><textarea id="cl_retMsg" data-cl="retMsg" rows="5">${esc(cl.retMsg)}</textarea>
    <p class="note" style="margin:4px 0 0">Campos automáticos: {nome} (primeiro nome), {clinica} e {ultima} (mês/ano da última visita).</p>
    <button class="ghost sm" data-act="cfgretmsg" style="margin-top:8px">Restaurar mensagem padrão</button>
  </section>`:''}${T==='docs'?`
  <section class="cfg-card card"><h2>Receituário e atestado: informações padrão</h2><p class="note" style="margin:0 0 4px">Valem para todos os pacientes e já vêm preenchidos nos documentos. Alterações são salvas automaticamente.</p>
    <label for="cl_docDent">Dentista padrão</label><select id="cl_docDent" data-cl="docDent">${dentOpts(cl.docDent,'Escolher na hora de emitir')}</select>
    <p class="note" style="margin:4px 0 0">Vem selecionado no receituário e no atestado; o CRO sai junto, conforme o cadastro do dentista.</p>
    ${f('rxCidade','Cidade da data e assinatura','placeholder="Ex.: Teófilo Otoni/MG"','Se ficar em branco, usa a cidade do endereço da clínica.')}
    <h3 style="margin:18px 0 0">Receituário</h3>
    ${f('rxTitulo','Título do documento')}
    <label for="cl_rxRodape">Texto fixo no final (opcional)</label><textarea id="cl_rxRodape" data-cl="rxRodape" rows="3" placeholder="Ex.: Receita válida por 30 dias. Em caso de dúvida, ligue para a clínica.">${esc(cl.rxRodape)}</textarea>
    <h3 style="margin:18px 0 0">Atestado</h3>
    ${f('atTitulo','Título do documento')}
    ${f('atDias','Dias de afastamento padrão','inputmode="numeric"','Deixe em branco para o atestado sair sem informar afastamento.')}
    <label for="cl_atTexto">Texto padrão do atestado</label><textarea id="cl_atTexto" data-cl="atTexto" rows="5">${esc(cl.atTexto)}</textarea>
    <p class="note" style="margin:4px 0 0">Campos automáticos: {paciente}, {cpf}, {data}, {dias} e {afastamento} (vira "necessitando de afastamento de suas atividades por N dias" quando houver dias informados).</p>
    <button class="ghost sm" data-act="cfgattxt" style="margin-top:8px">Restaurar texto padrão</button>
    <label for="cl_atRodape">Texto fixo no final (opcional)</label><textarea id="cl_atRodape" data-cl="atRodape" rows="3" placeholder="Ex.: Este atestado não possui validade sem assinatura e carimbo do profissional.">${esc(cl.atRodape)}</textarea>
  </section>`:''}</div>`;
}
document.addEventListener('change',e=>{const t=e.target;
  if(t.id==='cfgColor'){window.oralValleSetLocalAccent(t.value);applyTheme();cfgRefreshTop();toast('Cor do sistema atualizada',2200);return}
  if(t.dataset&&t.dataset.cl!==undefined&&t.closest&&t.closest('.cfg-card')){setTimeout(cfgRefreshTop,0);return}
  if((t.id==='cfgIcon'||t.id==='cfgLogo')&&t.files&&t.files[0]){
    const isIcon=t.id==='cfgIcon';
    const f=t.files[0];
    if(!/^image\/(png|jpeg|webp)$/i.test(f.type)){toast('Use uma imagem PNG, JPG ou WebP',3000);t.value='';return}
    const r=new FileReader();
    r.onload=()=>{const im=new Image();
      im.onload=()=>{try{
        const M=500,k=Math.min(1,M/Math.max(im.width,im.height)),w=Math.max(1,Math.round(im.width*k)),h=Math.max(1,Math.round(im.height*k));
        const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);
        db.cl=db.cl||{};db.cl.semLogo=false;if(isIcon){db.cl.icone=c.toDataURL('image/png');db.cl.iconeW=w;db.cl.iconeH=h}else{db.cl.logo=c.toDataURL('image/png');db.cl.logoW=w;db.cl.logoH=h}save();render();toast(isIcon?'Ícone alterado — aguarde a confirmação do Supabase':'Logo alterada — aguarde a confirmação do Supabase antes de atualizar a página',4500)
      }catch(err){console.error(err);toast('Não foi possível usar essa imagem',3000)}};
      im.onerror=()=>toast('Não foi possível abrir a imagem',3000);im.src=String(r.result)};
    r.onerror=()=>toast('Não foi possível ler o arquivo',3000);r.readAsDataURL(f);t.value='';
  }
});
function clHtml(){
  const cl=Object.assign({},CL_DEF,db.cl||{});
  const f=(k,l,ex)=>`<label for="cl_${k}">${l}</label><input id="cl_${k}" data-cl="${k}" ${ex||''} value="${esc(cl[k])}">`;
  return `<div class="card"><h2>Dados da clínica</h2><p class="note" style="margin:0 0 6px">Aparecem no cabeçalho do orçamento impresso.</p>${f('nome','Nome da clínica')}${f('end','Endereço')}${f('email','E-mail','type="email"')}${f('tel','Telefone','inputmode="tel"')}${f('cnpj','CNPJ')}</div>`;
}
function getO(p,id){return p.orcs.find(o=>o.id===id)}
function refreshOrc(card,o){
  if(!card)return;
  const s=card.querySelector('[data-sum]');if(s)s.innerHTML=orcSum(o);
  const tt=card.querySelector('[data-ototal]');if(tt)tt.textContent=brl(total(o));
  card.querySelectorAll('[data-cpi]').forEach(n=>{const i=+n.dataset.cpi.split(':')[1];if(o.itens[i])n.textContent=cpText(o,o.itens[i])});
}

