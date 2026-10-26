/* ===== Receituário ===== */
const RX_MODELOS=[['peq','Cirurgia pequena'],['long','Cirurgia longa'],['imp','Implantes'],['perio','Periogard (periodontia)'],['livre','Personalizada (em branco)']];
function rxBuild(model,alerg){
  const DIP12={n:'Dipirona sódica 500 mg - 12 comprimidos',d:'Tomar 1 comprimido de 6 em 6 horas, somente se houver dor ou febre.'};
  const DIP20={n:'Dipirona sódica 500 mg - 20 comprimidos',d:'Tomar 1 comprimido de 6 em 6 horas, somente se houver dor ou febre.'};
  const DEXA={n:'Dexametasona 4 mg - 4 comprimidos',d:'Tomar 2 comprimidos (8 mg) 1 hora antes do procedimento e, depois, 1 comprimido pela manhã, por 2 dias.'};
  const AMOX7={n:'Amoxicilina 500 mg - 21 cápsulas',d:'Tomar 1 cápsula de 8 em 8 horas, por 7 dias.'};
  const AMOXI={n:'Amoxicilina 500 mg - 25 cápsulas',d:'Tomar 4 cápsulas (2 g) 1 hora antes da cirurgia e, depois, 1 cápsula de 8 em 8 horas, por 7 dias.'};
  const AZI3={n:'Azitromicina 500 mg - 3 comprimidos',d:'Tomar 1 comprimido ao dia, por 3 dias.'};
  const AZII={n:'Azitromicina 500 mg - 4 comprimidos',d:'Tomar 1 comprimido 1 hora antes da cirurgia e, depois, 1 comprimido ao dia, por 3 dias.'};
  const CLX=dias=>({n:'Digluconato de clorexidina 0,12% (Periogard) - 1 frasco de 250 mL',d:'Bochechar 15 mL, sem diluir, por 1 minuto, 2 vezes ao dia, por '+dias+' dias. Iniciar 24 horas após a cirurgia. Não engolir.'});
  const abx=(n,i)=>alerg?(i?AZII:AZI3):(i?AMOXI:AMOX7);
  const GELO='Aplicar compressa de gelo por fora do rosto, 20 minutos sim e 20 minutos não, nas primeiras 48 horas.';
  let oral=[],top=[],ori=[];
  if(model==='peq'){
    oral=[abx(0,0),{n:'Nimesulida 100 mg - 6 comprimidos',d:'Tomar 1 comprimido de 12 em 12 horas, por 3 dias.'},DIP12];
    top=[CLX(7)];
    ori=['Repouso relativo nas primeiras 24 horas.',GELO,'Alimentação fria ou gelada e pastosa; evitar alimentos duros e quentes.','Não bochechar, não cuspir com força e não fumar nas primeiras 24 horas.','Evitar tocar a região operada. Escovar normalmente os demais dentes.','Em caso de sangramento persistente, febre, inchaço excessivo ou dor intensa, entrar em contato com o consultório.'];
  }else if(model==='long'){
    oral=[abx(0,0),DEXA,{n:'Nimesulida 100 mg - 10 comprimidos',d:'Tomar 1 comprimido de 12 em 12 horas, por 5 dias.'},DIP20];
    top=[CLX(7)];
    ori=['Repouso nas primeiras 48 horas e evitar esforço físico por 7 dias.',GELO,'Dieta líquida ou pastosa e fria nas primeiras 48 horas; evitar alimentos duros e quentes.','Não bochechar, não cuspir com força e não fumar nas primeiras 24 horas.','Manter a cabeça elevada ao dormir.','Retornar em 7 dias para remoção dos pontos.','Em caso de sangramento persistente, febre, inchaço excessivo ou dor intensa, entrar em contato com o consultório.'];
  }else if(model==='imp'){
    oral=[abx(0,1),DEXA,{n:'Ibuprofeno 600 mg - 9 comprimidos',d:'Tomar 1 comprimido de 8 em 8 horas, por 3 dias.'},DIP12];
    top=[CLX(14)];
    ori=['Repouso nas primeiras 48 horas e evitar esforço físico por 7 dias.',GELO,'Alimentação fria e pastosa, mastigando do lado oposto ao implante.','Não pressionar a região com a língua ou com os dedos e não usar prótese sobre o implante sem autorização.','Não fumar e não consumir bebida alcoólica durante a cicatrização.','Retornar em 7 a 10 dias para remoção dos pontos e avaliação.','Em caso de sangramento persistente, febre, inchaço excessivo ou dor intensa, entrar em contato com o consultório.'];
  }else if(model==='perio'){
    top=[{n:'Periogard (digluconato de clorexidina 0,12%) - 1 frasco de 250 mL',d:'Bochechar 15 mL, sem diluir, por 1 minuto, 2 vezes ao dia (manhã e noite), por 14 dias. Não engolir.'}];
    ori=['Aguardar 30 minutos após a escovação com creme dental antes de bochechar, e não enxaguar a boca com água logo em seguida.','Pode ocorrer alteração temporária do paladar e manchas amareladas nos dentes, que podem ser removidas na profilaxia.','Não usar por mais tempo do que o indicado.','Manter a higiene bucal e o uso do fio dental conforme orientado.'];
  }else{
    return 'USO ORAL\n1) \n   \n\nORIENTAÇÕES\n- ';
  }
  const out=[];let n=0;
  const blk=(h,l)=>{if(!l.length)return;out.push(h);l.forEach(x=>{n++;out.push(n+') '+x.n);out.push('   '+x.d);out.push('')})};
  blk('USO ORAL',oral);blk('USO TÓPICO',top);
  out.push('ORIENTAÇÕES');ori.forEach(x=>out.push('- '+x));
  return out.join('\n');
}
function rxGen(p,model){
  const cu=(db.rxm||{})[model];if(cu)return cu;
  const c=(p.anam&&p.anam.c)||{};
  return rxBuild(model,!!c['Alergia a penicilina']);
}
function rxState(p){
  if(!view.rx||view.rx.pid!==p.id){
    view.rx={pid:p.id,model:'peq',dt:docDtDef(),data:tdy(),texto:'',edited:false};
    view.rx.texto=rxGen(p,'peq');
  }
  return view.rx;
}
function rxHtml(p){
  const st=rxState(p),c=(p.anam&&p.anam.c)||{};
  const dts=db.dt.filter(d=>d.ativo!==false||d.id===st.dt),dd=db.dt.find(d=>d.id===st.dt);
  const av=[];
  const pen=/amoxicilina|ampicilina|penicilina|amoxicilina/i.test(st.texto);
  if(c['Alergia a penicilina']){av.push(pen?'Alergia a penicilina marcada na anamnese, mas a receita contém antibiótico da família da penicilina. Escolha o modelo de novo (o antibiótico é trocado automaticamente) ou edite o texto.':'Alergia a penicilina marcada na anamnese: o antibiótico alternativo já foi colocado. Confira antes de emitir.')}
  if(c['Gestante'])av.push('Gestante marcada na anamnese: revise anti-inflamatório e corticoide antes de emitir.');
  const cond=['Anticoagulante','Problemas de coagulação','Diabetes','Hipertensão','Problemas cardíacos'].filter(x=>c[x]);
  if(cond.length)av.push('Marcado na anamnese: '+cond.join(', ')+'. Confirme se anti-inflamatório e corticoide são adequados.');
  if(!p.cpf)av.push('CPF não cadastrado: preencha na aba Dados para ele sair no receituário.');
  const custom=!!(db.rxm||{})[st.model];
  return `<section class="card rx-card"><h2>Receituário</h2><p class="sub">Escolha o modelo: nome, CPF, data e dentista já entram automaticamente no documento.</p>
  <label for="rxModelo">Modelo</label><select id="rxModelo">${RX_MODELOS.map(m=>`<option value="${m[0]}"${st.model===m[0]?' selected':''}>${m[1]}</option>`).join('')}</select>
  <div class="row"><div><label for="rxDent">Dentista</label><select id="rxDent">${dentOpts(st.dt,'Sem dentista')}</select></div><div><label for="rxData">Data</label><input id="rxData" type="date" value="${esc(st.data)}"></div></div>
  ${dd?`<label for="rxCro">CRO do dentista</label><input id="rxCro" data-d="${dd.id}" data-f="cro" value="${esc(dd.cro||'')}" placeholder="Ex.: CRO-MG 12345" autocomplete="off">`:''}
  <div class="rx-dados"><div><small>Paciente</small><b>${esc(p.nome)}</b></div><div><small>CPF</small><b>${esc(p.cpf||'não informado')}</b></div><div><small>Nascimento</small><b>${p.nasc?esc(fd(p.nasc)):'não informado'}</b></div><div><small>Telefone</small><b>${esc(p.tel||'não informado')}</b></div></div>
  ${av.length?`<div class="rx-aviso">${av.map(x=>'<div>⚠ '+esc(x)+'</div>').join('')}</div>`:''}
  <label for="rxTexto">Prescrição${custom?' (seu modelo salvo)':''} - pode editar</label><textarea id="rxTexto" rows="16" spellcheck="false">${esc(st.texto)}</textarea>
  <p class="note" style="margin:6px 0 0">Doses sugeridas de uso comum. Confira e ajuste conforme o caso antes de emitir.</p>
  <div class="row" style="margin-top:12px;flex-wrap:wrap"><button class="sm" data-act="rxpdf">Baixar PDF</button><button class="ghost sm" data-act="rxprint">Abrir para imprimir</button><button class="ghost sm" data-act="rxsave">Salvar no prontuário</button></div>
  <div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="ghost sm" data-act="rxmodel">Salvar como meu modelo</button>${custom?'<button class="ghost sm" data-act="rxreset">Voltar ao modelo original</button>':''}</div></section>`;
}
async function rxDoc(p){
  if(!(await ensureJsPDF())){toast('Não foi possível carregar o gerador de PDF. Verifique a conexão e tente novamente.',3500);return null}
  const st=rxState(p),cl=Object.assign({},CL_DEF,db.cl||{}),dd=db.dt.find(d=>d.id===st.dt);
  const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'});
  const S=v=>String(v==null?'':v).replace(/[−–—]/g,'-').replace(/[^\u0000-\u00FF]/g,'?');
  const ORG=[217,106,0],GRAY=[239,239,239],L=15,R=195,W=R-L,MAXY=278;
  let y=12;
  const font=(s,z,col)=>{doc.setFont('helvetica',s);doc.setFontSize(z);doc.setTextColor(...(col||[17,17,17]))};
  const ensure=h=>{if(y+h>MAXY){doc.addPage();y=16;return true}return false};
  pdfLogo(doc,L,y);
  let iy=y+5;font('bold',13);doc.text(S(cl.nome),L+35,iy);iy+=5;font('normal',9);
  [cl.end,[cl.email,cl.tel].filter(Boolean).join(' / '),cl.cnpj&&('CNPJ '+cl.cnpj)].filter(Boolean).forEach(t=>{doc.text(S(t),L+35,iy);iy+=4});
  y+=24;doc.setDrawColor(230,230,230);doc.setLineWidth(.25);doc.line(L,y,R,y);
  y+=13;font('bold',18,ORG);doc.text(S(cl.rxTitulo||'RECEITUÁRIO'),105,y,{align:'center'});
  y+=7;doc.setFillColor(...GRAY);doc.roundedRect(L,y,W,21,2,2,'F');
  font('bold',10.5);doc.text('Paciente: ',L+4,y+7);const wl=doc.getTextWidth('Paciente: ');font('normal',10.5);doc.text(S(doc.splitTextToSize(S(p.nome),W-wl-50)[0]),L+4+wl,y+7);
  font('bold',10.5);doc.text('Data: ',R-42,y+7);font('normal',10.5);doc.text(S(fd(st.data)),R-42+doc.getTextWidth('Data: '),y+7);
  const camp=(l,v,x)=>{font('bold',10);doc.text(l+' ',x,y+15);const w=doc.getTextWidth(l+' ');font('normal',10);doc.text(S(v),x+w,y+15)};
  camp('CPF:',p.cpf||'-',L+4);camp('Nascimento:',p.nasc?fd(p.nasc):'-',L+62);camp('Telefone:',p.tel||'-',L+118);
  y+=21+10;
  String(st.texto||'').replace(/\r/g,'').split('\n').forEach(raw=>{
    const line=raw.replace(/\s+$/,'');
    if(!line.trim()){y+=2.5;return}
    if(/^[A-ZÀ-Ý ]{4,}:?$/.test(line.trim())){ensure(14);y+=3;font('bold',12,ORG);doc.text(S(line.trim()),L,y);y+=6;return}
    if(/^\d+\)/.test(line.trim())){font('bold',11);const t=doc.splitTextToSize(S(line.trim()),W);ensure(t.length*5+2);t.forEach(x=>{doc.text(x,L,y);y+=5});return}
    font('normal',10.5);const ind=/^\s{2,}/.test(raw)?5:0,t=doc.splitTextToSize(S(line.trim()),W-ind);
    ensure(t.length*4.8+1);t.forEach(x=>{doc.text(x,L+ind,y);y+=4.8});
  });
  const cidade=String(cl.rxCidade||'').trim()||String(cl.end||'').split(',').pop().trim(),dl=new Date(st.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'});
  ensure(46);y+=12;font('normal',10.5);doc.text(S((cidade?cidade+', ':'')+dl+'.'),L,y);
  y+=24;doc.setDrawColor(60,60,60);doc.setLineWidth(.3);doc.line(105-40,y,105+40,y);
  y+=5;font('bold',10.5);doc.text(S(dd?dd.nome:cl.nome),105,y,{align:'center'});
  if(dd&&dd.cro){y+=5;font('normal',10);doc.text(S(dd.cro.toUpperCase().startsWith('CRO')?dd.cro:'CRO: '+dd.cro),105,y,{align:'center'})}
  if(String(cl.rxRodape||'').trim()){y+=12;font('normal',9.5,[90,90,90]);doc.splitTextToSize(S(cl.rxRodape),W).forEach(x=>{ensure(5);doc.text(x,L,y);y+=4.6})}
  const N=doc.getNumberOfPages();if(N>1)for(let i=1;i<=N;i++){doc.setPage(i);font('normal',9,[119,119,119]);doc.text('página '+i+' de '+N,R,290,{align:'right'})}
  const nome=S(p.nome).replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_')||'paciente';
  const md=(RX_MODELOS.find(m=>m[0]===st.model)||['','Receita'])[1].replace(/[^\w]+/g,'_');
  return {doc,fname:'Receituario_'+nome+'_'+md+'.pdf'};
}
