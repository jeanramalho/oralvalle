/* ===== vendas ===== */
function stat(l,v,n){return `<div class="card" style="margin:0"><div class="note" style="margin:0">${l}</div><strong style="font-size:20px">${brl(v)}</strong>${n?`<div class="note" style="margin:0">${n}</div>`:''}</div>`}
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
  ${x.pg.map(p=>`<div class="pg"><span>${fd(p.data)} · ${esc(p.forma)}</span><span>${brl(p.valor)} <button class="danger sm" data-act="rmpg" data-id="${x.id}" data-pg="${p.id}" aria-label="Remover recebimento">${delArm===p.id?'Confirmar':'×'}</button></span></div>`).join('')}
  ${sd>0?`<div class="row" style="margin-top:8px"><input data-rcv="${x.id}" inputmode="decimal" value="${sd.toFixed(2)}" aria-label="Valor recebido"><select data-rcvf="${x.id}" aria-label="Forma de pagamento">${FORMAS.map(f=>`<option>${f}</option>`).join('')}</select><button class="sm" data-act="rcv" data-id="${x.id}">Receber</button></div>`:''}
  <button class="danger sm" data-act="rmvd" data-id="${x.id}" style="margin-top:8px">${delArm===x.id?'Toque de novo para excluir':'Excluir venda'}</button></div>`;
}
function vdHtml(){
  const t=tdy(),m=t.slice(0,7),sv=view.sv||'dia';
  let pre={};
  if(view.pre){pre=view.pre;view.pre=null;view.link=(pre.oid||pre.ag)?{oid:pre.oid,ii:pre.ii,ag:pre.ag,pid:pre.pid}:null}
  const dia=db.vd.filter(x=>x.data===t),mes=db.vd.filter(x=>x.data.slice(0,7)===m);
  let recMes=0;db.vd.forEach(v=>v.pg.forEach(p=>{if((p.data||'').slice(0,7)===m)recMes+=num(p.valor)}));
  const aRec=db.vd.reduce((s,v)=>s+saldoV(v),0);
  let h='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">'+stat('Vendas de hoje',sum(dia,'valor'),dia.length+' atendimento(s)')+stat('Vendas do mês',sum(mes,'valor'),mes.length+' atendimento(s)')+stat('Recebido no mês',recMes)+stat('A receber de pacientes',aRec)+stat('Comissões do mês',sum(mes,'rep'))+stat('Sobra após comissões (mês)',sum(mes,'valor')-sum(mes,'rep'))+'</div>';
  const pts=db.p.filter(p=>!p.arq||p.id===pre.pid),dts=db.dt.filter(d=>d.ativo!==false||d.id===pre.dt);
  if(!pts.length||!dts.length)h+='<div class="empty">Cadastre ao menos um paciente e um dentista ativo para lançar vendas.</div>';
  else{
    const dsel=pre.dt||defDt(),val=pre.valor?String(pre.valor):'',cr=(dsel&&val)?comCalc(dsel,pre.proc||'',num(val),pre.qtd).rep:0;
    h+=`<div class="card"><h2>Dar baixa no atendimento</h2>${pre.ag||pre.oid?'<p class="note" style="margin:0 0 4px">Dados preenchidos a partir da '+(pre.ag?'agenda':'aprovação do orçamento')+'. Confira antes de lançar.</p>':''}<label for="vp">Paciente</label><select id="vp">${pts.map(p=>`<option value="${p.id}"${p.id===pre.pid?' selected':''}>${esc(p.nome)}</option>`).join('')}</select><label for="vdn">Dentista que executou</label><select id="vdn">${dentOpts(dsel)}</select><label for="vpr">Procedimento</label><input id="vpr" list="prl" placeholder="Escolha ou digite" value="${esc(pre.proc||'')}" autocomplete="off">${prList()}
    <div class="row"><div><label for="vv">Valor (R$)</label><input id="vv" inputmode="decimal" value="${esc(val)}"></div><div><label for="vr">Comissão (R$)</label><input id="vr" inputmode="decimal" value="${cr?cr.toFixed(2):''}"></div></div>
    <p class="note" style="margin:6px 0 0">A comissão percentual é calculada somente após descontar hora clínica, materiais e laboratório. Você pode ajustar o valor.</p>
    <div class="row"><div><label for="vrc">Recebido agora (R$)</label><input id="vrc" inputmode="decimal" value="${val}"></div><div><label for="vfm">Forma</label><select id="vfm">${FORMAS.map(f=>`<option>${f}</option>`).join('')}</select></div></div>
    <p class="note" style="margin:6px 0 0">Se o paciente ainda não pagou, coloque 0. A comissão só fica liberada conforme o paciente paga.</p>
    <label for="vdt">Data</label><input id="vdt" type="date" value="${t}"><div style="margin-top:12px"><button data-act="addvd" style="width:100%">Dar baixa e lançar venda</button></div></div>`;
  }
  h+=`<div class="row" style="margin-bottom:10px"><button class="sm${sv==='dia'?'':' ghost'}" data-act="svw" data-t="dia">Hoje</button><button class="sm${sv==='mes'?'':' ghost'}" data-act="svw" data-t="mes">Mês</button><button class="sm${sv==='rec'?'':' ghost'}" data-act="svw" data-t="rec">A receber</button></div>`;
  const l=(sv==='dia'?dia:sv==='mes'?mes:db.vd.filter(v=>saldoV(v)>0)).slice().reverse();
  const pageSize=50,pages=Math.max(1,Math.ceil(l.length/pageSize));
  view.vPage=Math.min(Math.max(0,Number(view.vPage)||0),pages-1);
  const visible=l.slice(view.vPage*pageSize,(view.vPage+1)*pageSize);
  const pager=l.length>pageSize?`<div class="row" style="justify-content:space-between;margin-top:12px"><span class="note" style="margin:0">Página ${view.vPage+1} de ${pages} · ${l.length} lançamentos</span><span class="row" style="flex:none;gap:6px"><button class="ghost sm" data-act="vPage" data-p="${view.vPage-1}"${view.vPage===0?' disabled':''}>Anterior</button><button class="ghost sm" data-act="vPage" data-p="${view.vPage+1}"${view.vPage>=pages-1?' disabled':''}>Próxima</button></span></div>`:'';
  return h+(visible.length?visible.map(vdCard).join(''):'<div class="empty">'+(sv==='rec'?'Nenhum valor a receber.':'Nenhuma venda '+(sv==='dia'?'hoje.':'neste mês.'))+'</div>')+pager;
}

