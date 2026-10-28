/* ===== vendas ===== */
function stat(l,v,n){return `<div class="card" style="margin:0"><div class="note" style="margin:0">${l}</div><strong style="font-size:20px">${brl(v)}</strong>${n?`<div class="note" style="margin:0">${n}</div>`:''}</div>`}
/* Detalhamento financeiro: as seis métricas usam exatamente os dados do painel. */
function ovFinCard(label,value,sub,type){
  return `<button type="button" data-act="ovFinDetail" data-t="${type}" aria-haspopup="dialog" title="Ver detalhes: ${esc(label)}" class="card" style="margin:0;display:block;text-align:left;width:100%;color:inherit;font:inherit;cursor:pointer"><span class="note" style="display:block;margin:0">${esc(label)} ↗</span><strong style="font-size:20px">${brl(value)}</strong>${sub?`<span class="note" style="display:block;margin:0">${esc(sub)}</span>`:''}</button>`;
}
function ovFinDetail(type){
  const today=tdy(),month=today.slice(0,7);
  const all=db.vd||[];
  const monthly=all.filter(v=>String(v.data||'').slice(0,7)===month);
  const todaySales=all.filter(v=>v.data===today);
  const payments=all.flatMap(v=>(v.pg||[]).filter(p=>String(p.data||'').slice(0,7)===month).map(p=>({v,p})));
  const pending=all.filter(v=>saldoV(v)>0);
  const types={today:['Vendas de hoje',todaySales,'sale'],month:['Vendas do mês',monthly,'sale'],received:['Recebido no mês',payments,'payment'],pending:['A receber de pacientes',pending,'pending'],commission:['Comissões do mês',monthly,'commission'],net:['Sobra após comissões (mês)',monthly,'net']};
  const selected=types[type];if(!selected)return;
  const [title,items,kind]=selected;
  const amount=kind==='payment'?payments.reduce((s,x)=>s+num(x.p.valor),0):kind==='pending'?pending.reduce((s,v)=>s+saldoV(v),0):kind==='commission'?sum(monthly,'rep'):kind==='net'?sum(monthly,'valor')-sum(monthly,'rep'):sum(items,'valor');
  const headers=kind==='payment'?['Data do recebimento','Paciente','Procedimento','Forma','Recebido']:kind==='pending'?['Data da venda','Paciente','Procedimento','Recebido','Pendente']:kind==='commission'?['Data','Paciente','Dentista','Procedimento','Comissão']:kind==='net'?['Data','Paciente','Venda','Comissão','Sobra']:['Data','Paciente','Procedimento','Valor'];
  const cells=(v,arr,index)=>`<tr style="background:${index%2===0?'#25292b':'#17191b'}">`+arr.map((x,i)=>`<td style="padding:11px 10px;${i===arr.length-1?'text-align:right;white-space:nowrap':''};border-bottom:1px solid #383c3e">${esc(x)}</td>`).join('')+'</tr>';
  const rows=items.map((item,index)=>{
    const v=kind==='payment'?item.v:item;
    if(kind==='payment')return cells(v,[fd(item.p.data),pName(v.pid),v.proc||'Atendimento',item.p.forma||'—',brl(item.p.valor)],index);
    if(kind==='pending')return cells(v,[fd(v.data),pName(v.pid),v.proc||'Atendimento',brl(recebido(v)),brl(saldoV(v))],index);
    if(kind==='commission')return cells(v,[fd(v.data),pName(v.pid),dName(v.dt),v.proc||'Atendimento',brl(v.rep)],index);
    if(kind==='net')return cells(v,[fd(v.data),pName(v.pid),brl(v.valor),brl(v.rep),brl(num(v.valor)-num(v.rep))],index);
    return cells(v,[fd(v.data),pName(v.pid),v.proc||'Atendimento',brl(v.valor)],index);
  }).join('');
  // A exportação reutiliza exatamente os dados apresentados na janela.
  const reportRows=items.map(item=>{
    const v=kind==='payment'?item.v:item;
    if(kind==='payment')return [fd(item.p.data),pName(v.pid),v.proc||'Atendimento',item.p.forma||'—',brl(item.p.valor)];
    if(kind==='pending')return [fd(v.data),pName(v.pid),v.proc||'Atendimento',brl(recebido(v)),brl(saldoV(v))];
    if(kind==='commission')return [fd(v.data),pName(v.pid),dName(v.dt),v.proc||'Atendimento',brl(v.rep)];
    if(kind==='net')return [fd(v.data),pName(v.pid),brl(v.valor),brl(v.rep),brl(num(v.valor)-num(v.rep))];
    return [fd(v.data),pName(v.pid),v.proc||'Atendimento',brl(v.valor)];
  });
  window.ovFinCurrentReport={title,headers,rows:reportRows,total:brl(amount),count:items.length,period:month};
  const dialog=document.getElementById('ov-fin-detail-dialog');if(!dialog)return;
  dialog.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><h2 id="ov-fin-detail-title" style="margin:0">${esc(title)}</h2><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="sm" data-act="ovFinPdf">⬇ Gerar PDF</button><form method="dialog"><button type="submit" class="ghost sm">✕ Fechar</button></form></div></div><p class="note" style="margin:12px 0">${items.length} registro(s) · Total: <strong>${brl(amount)}</strong></p><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;text-align:left;font-size:14px"><thead><tr style="background:#38302a;color:#ffb36b">${headers.map(h=>`<th style="padding:10px 8px;white-space:nowrap">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${headers.length}" style="padding:16px">Nenhum registro encontrado.</td></tr>`}</tbody></table></div><p style="text-align:right"><strong>Total: ${brl(amount)}</strong></p>`;
  if(!dialog.open)dialog.showModal();
}
async function ovFinPdf(){
  const report=window.ovFinCurrentReport;
  if(!report){toast('Abra um cartão financeiro antes de gerar o PDF.',3000);return;}
  if(!(await ensureJsPDF())){toast('Não foi possível carregar o gerador de PDF. Verifique sua conexão.',3500);return;}
  try{
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const clean=x=>String(x==null?'':x).replace(/[−–—]/g,'-').replace(/[^\u0000-\u00FF]/g,'?');
    const widths=report.headers.length===4?[31,77,126,39]:[31,65,74,58,39];
    const left=12,right=285;
    let y=15,page=1;
    function heading(){
      doc.setFillColor(201,99,0);doc.rect(0,0,297,9,'F');
      doc.setFont('helvetica','bold');doc.setTextColor(35,35,35);doc.setFontSize(15);
      doc.text('ORAL VALLE - '+clean(report.title),left,18);
      doc.setFont('helvetica','normal');doc.setFontSize(9);
      doc.text('Periodo: '+clean(report.period)+'   |   Registros: '+report.count+'   |   Total: '+clean(report.total),left,25);
      y=32;doc.setFillColor(235,235,235);doc.rect(left,y-5,right-left,9,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(9);
      let x=left;report.headers.forEach((h,i)=>{doc.text(clean(h),x+2,y,{maxWidth:widths[i]-4});x+=widths[i]});
      y+=8;
    }
    heading();
    for(let idx=0;idx<report.rows.length;idx++){
      const row=report.rows[idx];
      doc.setFont('helvetica','normal');doc.setFontSize(9);
      const lines=row.map((cell,i)=>doc.splitTextToSize(clean(cell),widths[i]-4));
      const height=Math.max(9,...lines.map(l=>l.length*4+4));
      if(y+height>190){doc.setFontSize(8);doc.text('Pagina '+page,270,204);doc.addPage();page++;heading()}
      if(idx%2===0){doc.setFillColor(247,247,247);doc.rect(left,y-5,right-left,height,'F')}
      doc.setTextColor(30,30,30);
      let x=left;lines.forEach((l,i)=>{doc.text(l,x+2,y);x+=widths[i]});
      y+=height;
    }
    if(!report.rows.length){doc.setFontSize(10);doc.text('Nenhum registro encontrado.',left+2,y+3)}
    doc.setFont('helvetica','bold');doc.setFontSize(10);
    if(y+12>190){doc.addPage();page++;heading()}
    doc.text('TOTAL: '+clean(report.total),right,y+7,{align:'right'});
    doc.setFontSize(8);doc.text('Pagina '+page,270,204);
    const filename='oralvalle_'+report.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_')+'_'+report.period+'.pdf';
    doc.save(filename);
  }catch(e){console.error(e);toast('Não foi possível gerar o PDF.',3500)}
}
function fillRep(src){
  const pn=$('vpr').value.trim();
  if(src==='vpr'){const m=procBy(pn);if(m&&m.preco&&!$('vv').value)$('vv').value=m.preco}
  const vv=num($('vv').value),c=comCalc($('vdn').value,pn,vv,(view.pre&&view.pre.qtd)||1);
  $('vr').value=c.rep?c.rep.toFixed(2):'';
  const rc=$('vrc');if(!rc.dataset.touched)rc.value=vv?vv.toFixed(2):'';
  fmtMoney(document);
}
function vdCard(x){
  const rc=recebido(x),sd=saldoV(x),st=sd<=0?['Pago','stt-ok']:rc>0?['Parcial','']:['A receber','stt-wr'];
  return `<div class="card"><div class="ag"><span><strong>${fd(x.data)} · ${esc(pName(x.pid))}</strong><br>${esc(x.proc||'Atendimento')} · ${esc(dName(x.dt))}</span><span style="text-align:right"><strong>${brl(x.valor)}</strong><br><span class="note" style="margin:0">Comissão ${brl(x.rep)}</span></span></div>
  <div class="row" style="margin:8px 0 4px;flex-wrap:wrap"><span class="badge ${st[1]}" style="flex:none">${st[0]}</span><span class="note" style="margin:0">Recebido ${brl(rc)} de ${brl(x.valor)}</span></div>
  ${x.pg.map(p=>`<div class="pg"><span>${fd(p.data)} · ${esc(p.forma)}${ovFeeSummary(p)}</span><span>${brl(p.valor)} <button class="danger sm" data-act="rmpg" data-id="${x.id}" data-pg="${p.id}" aria-label="Remover recebimento">${delArm===p.id?'Confirmar':'×'}</button></span></div>`).join('')}
  ${sd>0?`<div class="row" style="margin-top:8px"><input data-rcv="${x.id}" inputmode="decimal" value="${sd.toFixed(2)}" aria-label="Valor recebido"><select data-rcvf="${x.id}" aria-label="Forma de pagamento">${ovFeeOptions()}</select><button class="sm" data-act="rcv" data-id="${x.id}">Receber</button></div>`:''}
  <button class="danger sm" data-act="rmvd" data-id="${x.id}" style="margin-top:8px">${delArm===x.id?'Toque de novo para excluir':'Excluir venda'}</button></div>`;
}
function vdHtml(){
  const t=tdy(),m=t.slice(0,7),sv=view.sv||'dia';
  let pre={};
  if(view.pre){pre=view.pre;view.pre=null;view.link=(pre.oid||pre.ag)?{oid:pre.oid,ii:pre.ii,ag:pre.ag,pid:pre.pid}:null}
  const dia=db.vd.filter(x=>x.data===t),mes=db.vd.filter(x=>x.data.slice(0,7)===m);
  let recMes=0;db.vd.forEach(v=>v.pg.forEach(p=>{if((p.data||'').slice(0,7)===m)recMes+=num(p.valor)}));
  const aRec=db.vd.reduce((s,v)=>s+saldoV(v),0);
  const taxasMes=db.vd.reduce((s,v)=>s+(v.pg||[]).filter(p=>String(p.data||'').slice(0,7)===m).reduce((a,p)=>a+ovFeeTax(p),0),0);
  let h=ovFeeSettings()+'<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px">'+ovFinCard('Vendas de hoje',sum(dia,'valor'),dia.length+' atendimento(s)','today')+ovFinCard('Vendas do mês',sum(mes,'valor'),mes.length+' atendimento(s)','month')+ovFinCard('Recebido no mês',recMes,'','received')+ovFinCard('A receber de pacientes',aRec,'','pending')+ovFinCard('Comissões do mês',sum(mes,'rep'),'','commission')+ovFinCard('Sobra após comissões (mês)',sum(mes,'valor')-sum(mes,'rep'),'','net')+'</div>';
  h+=`<div class="card" style="margin:10px 0"><b>Taxas da operadora no mês: ${brl(taxasMes)}</b><br><b>Recebimento líquido do mês: ${brl(recMes-taxasMes)}</b><p class="note" style="margin:4px 0 0">Recebido bruto menos taxas registradas. Não representa saldo bancário conciliado.</p></div>`;
  h+='<dialog id="ov-fin-detail-dialog" aria-labelledby="ov-fin-detail-title" style="width:min(900px,94vw);max-height:85vh;overflow:auto;border:1px solid #555;border-radius:14px;background:#191b1c;color:#eee;padding:20px;box-shadow:0 16px 60px #0009"></dialog>';
  const pts=db.p.filter(p=>!p.arq||p.id===pre.pid),dts=db.dt.filter(d=>d.ativo!==false||d.id===pre.dt);
  if(!pts.length||!dts.length)h+='<div class="empty">Cadastre ao menos um paciente e um dentista ativo para lançar vendas.</div>';
  else{
    const dsel=pre.dt||'',val=pre.valor?String(pre.valor):'',cr=(dsel&&val)?comCalc(dsel,pre.proc||'',num(val),pre.qtd).rep:0;
    h+=`<div class="card"><h2>Dar baixa no atendimento</h2>${pre.ag||pre.oid?'<p class="note" style="margin:0 0 4px">Dados preenchidos a partir da '+(pre.ag?'agenda':'aprovação do orçamento')+'. Confira antes de lançar.</p>':''}<label for="vp">Paciente</label><select id="vp" onchange="var b=document.querySelector('[data-act=addvd]');if(b)b.disabled=!this.value"><option value="">Selecione o paciente</option>${pts.map(p=>`<option value="${p.id}"${p.id===pre.pid?' selected':''}>${esc(p.nome)}</option>`).join('')}</select><label for="vdn">Dentista que executou</label><select id="vdn">${dentOpts(dsel,'Selecione o dentista')}</select><label for="vpr">Procedimento</label><input id="vpr" list="prl" placeholder="Escolha ou digite" value="${esc(pre.proc||'')}" autocomplete="off">${prList()}
    <div class="row"><div><label for="vv">Valor (R$)</label><input id="vv" inputmode="decimal" value="${esc(val)}"></div><div><label for="vr">Comissão (R$)</label><input id="vr" inputmode="decimal" value="${cr?cr.toFixed(2):''}"></div></div>
    <p class="note" style="margin:6px 0 0">A comissão percentual é calculada somente após descontar hora clínica, materiais e laboratório. Você pode ajustar o valor.</p>
    <div class="row"><div><label for="vrc">Recebido agora (R$)</label><input id="vrc" inputmode="decimal" value="${val}"></div><div><label for="vfm">Forma</label><select id="vfm">${ovFeeOptions()}</select></div></div>
    ${ovFeeSalePreview()}
    <p class="note" style="margin:6px 0 0">O paciente quita o valor bruto pago; a taxa da operadora é descontada apenas do líquido da clínica. Se ainda não pagou, coloque 0.</p>
    <label for="vdt">Data</label><input id="vdt" type="date" value="${t}"><div style="margin-top:12px"><button data-act="addvd" style="width:100%"${pre.pid?'':' disabled'}>Dar baixa e lançar venda</button></div></div>`;
  }
  h+=`<div class="row" style="margin-bottom:10px"><button class="sm${sv==='dia'?'':' ghost'}" data-act="svw" data-t="dia">Hoje</button><button class="sm${sv==='mes'?'':' ghost'}" data-act="svw" data-t="mes">Mês</button><button class="sm${sv==='rec'?'':' ghost'}" data-act="svw" data-t="rec">A receber</button></div>`;
  const l=(sv==='dia'?dia:sv==='mes'?mes:db.vd.filter(v=>saldoV(v)>0)).slice().reverse();
  const pageSize=50,pages=Math.max(1,Math.ceil(l.length/pageSize));
  view.vPage=Math.min(Math.max(0,Number(view.vPage)||0),pages-1);
  const visible=l.slice(view.vPage*pageSize,(view.vPage+1)*pageSize);
  const pager=l.length>pageSize?`<div class="row" style="justify-content:space-between;margin-top:12px"><span class="note" style="margin:0">Página ${view.vPage+1} de ${pages} · ${l.length} lançamentos</span><span class="row" style="flex:none;gap:6px"><button class="ghost sm" data-act="vPage" data-p="${view.vPage-1}"${view.vPage===0?' disabled':''}>Anterior</button><button class="ghost sm" data-act="vPage" data-p="${view.vPage+1}"${view.vPage>=pages-1?' disabled':''}>Próxima</button></span></div>`:'';
  return h+(visible.length?visible.map(vdCard).join(''):'<div class="empty">'+(sv==='rec'?'Nenhum valor a receber.':'Nenhuma venda '+(sv==='dia'?'hoje.':'neste mês.'))+'</div>')+pager;
}
