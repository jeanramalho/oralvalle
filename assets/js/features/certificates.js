/* ===== Atestado ===== */
function docDtDef(){const id=(db.cl||{}).docDent;return id&&db.dt.some(d=>d.id===id&&d.ativo!==false)?id:(defDt()||'')}
function atFill(p,st){
  const cl=Object.assign({},CL_DEF,db.cl||{}),n=parseInt(st.dias,10),af=n>0?', necessitando de afastamento de suas atividades por '+n+(n===1?' dia':' dias'):'';
  return String(cl.atTexto||AT_TXT_DEF).replace(/\{paciente\}/g,p.nome||'').replace(/\{cpf\}/g,p.cpf||'não informado').replace(/\{data\}/g,fd(st.data)).replace(/\{dias\}/g,n>0?String(n):'').replace(/\{afastamento\}/g,af);
}
function atState(p){
  if(!view.at||view.at.pid!==p.id){
    const cl=Object.assign({},CL_DEF,db.cl||{});
    view.at={pid:p.id,dt:docDtDef(),data:tdy(),dias:String(cl.atDias||''),texto:'',edited:false};
  }
  return view.at;
}
function atHtml(p){
  const st=atState(p);if(!st.edited)st.texto=atFill(p,st);
  return `<section class="card rx-card"><h2>Atestado</h2><p class="sub">Nome, CPF, data e dentista entram automaticamente. O texto padrão é definido em Configurações.</p>
  <div class="row" style="align-items:flex-start"><div><label for="atDent">Dentista</label><select id="atDent">${dentOpts(st.dt,'Sem dentista')}</select></div><div><label for="atData">Data</label><input id="atData" type="date" value="${esc(st.data)}"></div><div><label for="atDias">Dias de afastamento</label><input id="atDias" inputmode="numeric" value="${esc(st.dias)}" placeholder="0"></div></div>
  <label for="atTexto">Texto do atestado - pode editar</label><textarea id="atTexto" rows="6" spellcheck="false">${esc(st.texto)}</textarea>
  ${st.edited?'<button class="ghost sm" data-act="atreset" style="margin-top:8px">Voltar ao texto padrão</button>':''}
  <div class="row" style="margin-top:12px;flex-wrap:wrap"><button class="sm" data-act="atpdf">Baixar PDF</button><button class="ghost sm" data-act="atprint">Abrir para imprimir</button><button class="ghost sm" data-act="atsave">Salvar no prontuário</button></div></section>`;
}
async function atDoc(p){
  if(!(await ensureJsPDF())){toast('Não foi possível carregar o gerador de PDF. Verifique a conexão e tente novamente.',3500);return null}
  const st=atState(p),cl=Object.assign({},CL_DEF,db.cl||{}),dd=db.dt.find(d=>d.id===st.dt);
  const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'});
  const S=v=>String(v==null?'':v).replace(/[−–—]/g,'-').replace(/[^\u0000-\u00FF]/g,'?');
  const ORG=[217,106,0],L=15,R=195,W=R-L,MAXY=278;
  let y=12;
  const font=(sy,z,col)=>{doc.setFont('helvetica',sy);doc.setFontSize(z);doc.setTextColor(...(col||[17,17,17]))};
  const ensure=h=>{if(y+h>MAXY){doc.addPage();y=16;return true}return false};
  pdfLogo(doc,L,y);
  let iy=y+5;font('bold',13);doc.text(S(cl.nome),L+35,iy);iy+=5;font('normal',9);
  [cl.end,[cl.email,cl.tel].filter(Boolean).join(' / '),cl.cnpj&&('CNPJ '+cl.cnpj)].filter(Boolean).forEach(t=>{doc.text(S(t),L+35,iy);iy+=4});
  y+=24;doc.setDrawColor(230,230,230);doc.setLineWidth(.25);doc.line(L,y,R,y);
  y+=16;font('bold',18,ORG);doc.text(S(cl.atTitulo||'ATESTADO ODONTOLÓGICO'),105,y,{align:'center'});
  y+=20;font('normal',12);
  String(st.texto||'').replace(/\r/g,'').split('\n').forEach(raw=>{
    if(!raw.trim()){y+=4;return}
    const t=doc.splitTextToSize(S(raw.trim()),W);ensure(t.length*7+2);t.forEach(x=>{doc.text(x,L,y);y+=7});y+=2;
  });
  const cidade=String(cl.rxCidade||'').trim()||String(cl.end||'').split(',').pop().trim(),dl=new Date(st.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'});
  ensure(46);y+=14;font('normal',11);doc.text(S((cidade?cidade+', ':'')+dl+'.'),L,y);
  y+=24;doc.setDrawColor(60,60,60);doc.setLineWidth(.3);doc.line(105-40,y,105+40,y);
  y+=5;font('bold',10.5);doc.text(S(dd?dd.nome:cl.nome),105,y,{align:'center'});
  if(dd&&dd.cro){y+=5;font('normal',10);doc.text(S(dd.cro.toUpperCase().startsWith('CRO')?dd.cro:'CRO: '+dd.cro),105,y,{align:'center'})}
  if(String(cl.atRodape||'').trim()){y+=12;font('normal',9.5,[90,90,90]);doc.splitTextToSize(S(cl.atRodape),W).forEach(x=>{ensure(5);doc.text(x,L,y);y+=4.6})}
  const nome=S(p.nome).replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_')||'paciente';
  return {doc,fname:'Atestado_'+nome+'.pdf'};
}
document.addEventListener('input',e=>{const t=e.target;if(t.id==='atTexto'&&view.at){view.at.texto=t.value;view.at.edited=true}});
document.addEventListener('change',e=>{const t=e.target,p=cur();
  if(!p||!view.at)return;
  if(t.id==='atDent'){view.at.dt=t.value;render()}
  else if(t.id==='atData'){view.at.data=t.value||tdy();render()}
  else if(t.id==='atDias'){view.at.dias=t.value.replace(/\D/g,'');render()}
});
function tabArquivos(p){
  const arq=Array.isArray(p.arquivos)?p.arquivos:[];
  const lista=arq.length?`<div class="ov-file-grid">${arq.map((f,i)=>`<article class="ov-file-card"><div class="ov-file-preview">${String(f.tipo||'').startsWith('image/')?`<a href="${f.data}" target="_blank" rel="noopener"><img src="${f.data}" alt="${esc(f.nome)}"></a>`:`<div class="ov-file-doc">PDF<br>▤</div>`}</div><div class="ov-file-name" title="${esc(f.nome)}">${esc(f.nome)}</div><div class="ov-file-meta">${esc(f.categoria||'Documento')} · ${esc(f.dataEnvio||'')}</div><div class="row" style="margin-top:8px"><a class="ghost sm ov-file-open" href="${f.data}" target="_blank" rel="noopener">Abrir</a><button class="danger sm" data-act="rmArquivo" data-id="${f.id}">Excluir</button></div></article>`).join('')}</div>`:'<div class="ov-patient-empty">Nenhuma radiografia, imagem ou documento anexado.</div>';
  return rxHtml(p)+atHtml(p)+`<section class="card"><h2>Radiografias, imagens e documentos</h2><p class="sub">Anexe radiografias, atestados, exames e outros arquivos ao prontuário deste paciente.</p><label for="arqCategoria">Tipo de arquivo</label><select id="arqCategoria"><option>Radiografia</option><option>Atestado</option><option>Receituário</option><option>Imagem clínica</option><option>Exame</option><option>Outro documento</option></select><label for="arqFiles">Selecionar arquivos (imagem ou PDF)</label><input id="arqFiles" type="file" accept="image/*,application/pdf" multiple><p class="note" style="margin-top:6px">Para evitar que o navegador fique sem espaço, cada arquivo pode ter até 1,5 MB. Os anexos ficam salvos neste navegador; faça backups regularmente.</p></section><h2>Arquivos anexados (${arq.length})</h2>${lista}`;
}
function patient(){
  const p=cur();if(!p){view.id=null;return home()}
  const t=view.tab;
  return `<div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><button class="ghost sm" data-act="back">‹ Pacientes</button><button class="sm" data-act="printficha">🖨 Imprimir ficha completa</button></div><h1>${esc(p.nome)}${p.arq?' <span class="badge">arquivado</span>':''}</h1><p class="sub">${esc(pvFmtTel(p.tel)||'Sem telefone')}</p><button type="button" class="save-chip" id="saveStat" data-act="savebtn" title="Toque para salvar agora" aria-live="polite">${saveStatText(p)}</button>`+
  '<div class="tabs">'+[['dados','Dados'],['anam','Anamnese'],['odo','Evolução'],['orc','Orçamentos'],['trat','Tratamentos'],['pag','Pagamentos'],['agd','Agendamentos'],['arquivos','Radiografias e documentos']].filter(x=>pmTabOk(x[0])).map(x=>`<button data-act="tab" data-t="${x[0]}" class="${t===x[0]?'on':''}">${x[1]}</button>`).join('')+'</div>'+
  (t==='dados'?tabDados(p):t==='anam'?tabAnam(p):t==='odo'?tabOdo(p):t==='orc'?tabOrc(p):t==='arquivos'?tabArquivos(p):t==='agd'?tabAgd(p):t==='pag'?tabPag(p):tratHtml(p));
}
function orcText(p,o){
  const l=['Orçamento – '+p.nome,hojeBR()+(o.val?' · válido até '+fd(o.val):''),''];
  o.itens.forEach(i=>{const m=itMult(i);l.push('• '+(i.proc||'Procedimento')+(i.dente?' ('+dLab(i.dente)+' '+i.dente+')':'')+': '+(m.q>1?m.q+' × '+brl(m.u)+' = ':'')+brl(i.valor)+(i.obs?' – '+i.obs:''))});
  if(num(o.desc)>0)l.push('','Subtotal: '+brl(sub(o)),'Desconto: − '+brl(o.desc));
  l.push('','Total: '+brl(total(o)));
  if(o.cond)l.push('Condições: '+o.cond);
  return l.join('\n');
}
