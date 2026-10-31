/* ===== aba Pagamentos do paciente (baixa integral, parcial ou parcelada, com data) ===== */
const pgSt=v=>{const sd=saldoV(v),rc=recebido(v);return sd<=0?['Pago','stt-ok']:rc>0?['Parcial','']:['A receber','stt-wr']};
const pgPlano=v=>(Array.isArray(v.plano)?v.plano:[]).slice().sort((a,b)=>String(a.venc).localeCompare(String(b.venc)));
const pgParPg=(v,par)=>par.pgid?v.pg.find(x=>x.id===par.pgid):null;
function pgAddMes(iso,n){const [y,m,d]=iso.split('-').map(Number);const t=new Date(y,m-1+n,1);const last=new Date(t.getFullYear(),t.getMonth()+1,0).getDate();t.setDate(Math.min(d,last));return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')}
const pgFormas=sel=>ovFeeOptions(sel);
function pgPlanoHtml(v){
  const pl=pgPlano(v);if(!pl.length)return '';
  const hoje=tdy();
  const linhas=pl.map((par,i)=>{
    const pg=pgParPg(v,par);
    if(pg)return `<div class="pg-par ok"><div class="pg-par-h"><b>Parcela ${i+1}/${pl.length}</b><span class="badge stt-ok">Paga em ${fd(pg.data)}</span></div><div class="note" style="margin:2px 0 0">Vencimento ${fd(par.venc)} · ${esc(pg.forma)} · ${brl(pg.valor)}</div></div>`;
    const atr=par.venc<hoje;
    return `<div class="pg-par${atr?' late':''}"><div class="pg-par-h"><b>Parcela ${i+1}/${pl.length}</b><span class="badge ${atr?'stt-wr':''}">${atr?'Atrasada':'Pendente'}</span></div><div class="note" style="margin:2px 0 6px">Vence em ${fd(par.venc)} · ${brl(par.valor)}</div>
      <div class="row" style="align-items:flex-end"><div><label style="margin-top:0">Recebida em</label><input type="date" data-pgpd="${par.id}" value="${hoje}"></div><div><label style="margin-top:0">Forma</label><select data-pgpf="${par.id}">${pgFormas()}</select></div><button class="sm" data-act="pgpar" data-id="${v.id}" data-par="${par.id}">Dar baixa</button></div></div>`}).join('');
  const abertas=pl.some(x=>!pgParPg(v,x));
  return `<div class="pg-plan"><h3>Parcelamento (${pl.length}x)</h3>${linhas}${abertas?`<button class="ghost sm" data-act="pgplanrm" data-id="${v.id}" style="margin-top:6px">${delArm==='pl'+v.id?'Toque de novo para cancelar parcelas em aberto':'Cancelar parcelas em aberto'}</button>`:''}</div>`;
}
function pgCard(v,i){
  const rc=recebido(v),sd=saldoV(v),st=pgSt(v),val=num(v.valor),pct=val>0?Math.min(100,Math.round(rc/val*100)):0,hoje=tdy();
  const pays=v.pg.slice().sort((a,b)=>String(a.data).localeCompare(String(b.data))).map(x=>`<div class="pg"><span>📅 <b>${fd(x.data)}</b> · ${esc(x.forma||'')}${ovFeeSummary(x)}</span><span>${brl(x.valor)} <button class="danger sm" data-act="rmpg" data-id="${v.id}" data-pg="${x.id}" aria-label="Remover recebimento">${delArm===x.id?'Confirmar':'×'}</button></span></div>`).join('');
  const form=sd>0?`<div class="pg-form"><h3>Dar baixa neste atendimento</h3>
    <div class="row" style="align-items:flex-end"><div><label style="margin-top:0">Valor recebido (R$)</label><input data-pgv="${v.id}" inputmode="decimal" value="${sd.toFixed(2).replace('.',',')}"></div><div><label style="margin-top:0">Data do pagamento</label><input type="date" data-pgd="${v.id}" value="${hoje}"></div></div>
    <div class="row" style="align-items:flex-end;margin-top:8px"><div><label style="margin-top:0">Forma</label><select data-pgf="${v.id}">${pgFormas()}</select></div><button class="sm" data-act="pgrcv" data-id="${v.id}">Receber</button></div>
    <p class="note" style="margin:6px 0 0">Valor igual ao que falta = pagamento integral. Valor menor = pagamento parcial (o restante continua em aberto).</p>
    <details class="pg-parc"><summary>Parcelar o saldo de ${brl(sd)}</summary><div class="row" style="align-items:flex-end;margin-top:8px"><div><label style="margin-top:0">Nº de parcelas</label><select data-pgn="${v.id}">${[2,3,4,5,6,7,8,9,10,11,12].map(n=>`<option>${n}</option>`).join('')}</select></div><div><label style="margin-top:0">1º vencimento</label><input type="date" data-pgfst="${v.id}" value="${pgAddMes(hoje,1)}"></div></div><button class="ghost sm" data-act="pgplan" data-id="${v.id}" style="margin-top:8px;width:100%">Gerar parcelas</button><p class="note" style="margin:6px 0 0">As parcelas vencem de mês em mês. Cada uma recebe a baixa com a data em que foi paga.</p></details></div>`:'';
  return `<div class="pr-card pg-card"><div class="pr-head"><span class="pr-av" aria-hidden="true">${i+1}</span><div class="pr-nm">${esc(v.proc||'Atendimento')}<small>${fd(v.data)} · ${esc(dName(v.dt))}</small></div><span class="badge ${st[1]}">${st[0]}</span></div>
  <div class="pg-sum"><div><small>Valor</small><b>${brl(val)}</b></div><div><small>Recebido</small><b class="ok">${brl(rc)}</b></div><div><small>Falta</small><b class="${sd>0?'wr':''}">${brl(sd)}</b></div></div>
  <div class="pg-bar" aria-label="${pct}% recebido"><i style="width:${pct}%"></i></div>
  ${pays?`<div class="pg-list"><h3>Recebimentos (${v.pg.length})</h3>${pays}</div>`:'<p class="note" style="margin:8px 0 0">Nenhum recebimento registrado.</p>'}
  ${pgPlanoHtml(v)}${form}</div>`;
}
function tabPag(p){
  const vs=db.vd.filter(v=>v.pid===p.id).sort((a,b)=>String(b.data).localeCompare(String(a.data)));
  const tot=vs.reduce((s,v)=>s+num(v.valor),0),rec=vs.reduce((s,v)=>s+recebido(v),0),sd=vs.reduce((s,v)=>s+saldoV(v),0);
  const all=[];vs.forEach(v=>v.pg.forEach(x=>all.push({v,x})));all.sort((a,b)=>String(b.x.data).localeCompare(String(a.x.data)));
  const resumo=`<h3 style="margin:8px 0 10px">Resumo financeiro do paciente</h3><div class="pg-top"><div><small>Valor total a pagar</small><b>${brl(tot)}</b></div><div><small>Valor já pago</small><b class="ok">${brl(rec)}</b></div><div><small>Valor que falta pagar</small><b class="${sd>0?'wr':''}">${brl(sd)}</b></div></div>`;
  // 253: conciliação de recebimentos por atendimento, somente leitura.
  const inconsistencias=vs.filter(v=>recebido(v)>num(v.valor)+0.01);
  const semDentista=vs.filter(v=>!v.dt||!db.dt.some(d=>String(d.id)===String(v.dt)));
  const audit=`<details class="card" style="margin-bottom:12px"><summary style="cursor:pointer;font-weight:700">Conferência financeira dos atendimentos</summary><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin-top:12px">${stat('Atendimentos com baixa',String(vs.length))}${stat('Recebido',brl(rec))}${stat('Saldo a receber',brl(sd))}${stat('Recebimento acima do valor',String(inconsistencias.length))}${stat('Sem dentista válido',String(semDentista.length))}</div>${inconsistencias.length?`<p class="note" style="color:#a14c00">Confira: ${inconsistencias.map(v=>esc(v.proc||'Atendimento')).join(', ')}</p>`:''}<p class="note">Valores calculados sobre atendimentos com baixa. Tratamentos ainda não realizados não estão incluídos. Esta conferência não cria lançamentos.</p></details>`;
  if(!vs.length)return `<h2 class="dt-title" style="margin-top:6px">Pagamentos de ${esc(p.nome)}</h2>${resumo}<div class="empty">Ainda não há atendimentos com baixa para este paciente. Quando um procedimento receber baixa (aba Tratamentos ou Evolução), ele aparece aqui para você registrar os pagamentos.</div>`;
  const geral=sd>0?`<div class="card pg-geral"><h3 style="margin:0 0 4px">Receber um valor do paciente</h3><p class="note" style="margin:0 0 6px">O valor é aplicado primeiro nos atendimentos mais antigos. Use quando o paciente paga de uma vez por vários procedimentos.</p><div class="row" style="align-items:flex-end"><div><label style="margin-top:0">Valor (R$)</label><input id="pgGV" inputmode="decimal" value="${sd.toFixed(2).replace('.',',')}"></div><div><label style="margin-top:0">Data</label><input id="pgGD" type="date" value="${tdy()}"></div></div><div class="row" style="align-items:flex-end;margin-top:8px"><div><label style="margin-top:0">Forma</label><select id="pgGF">${pgFormas()}</select></div><button class="sm" data-act="pgall">Receber</button></div></div>`:'<div class="card"><b style="color:var(--ok)">✓ Paciente em dia: nada a receber no momento.</b></div>';
  const porData={};
  all.forEach(({v,x})=>{const data=x.data||'sem-data';(porData[data]||(porData[data]=[])).push({v,x})});
  const ext=all.length?`<div class="card"><h3 style="margin:0 0 8px">Histórico de pagamentos por data (${all.length} recebimentos)</h3>${Object.keys(porData).sort((a,b)=>String(b).localeCompare(String(a))).map(data=>{const itens=porData[data],soma=itens.reduce((s,{x})=>s+num(x.valor),0);return `<section class="pg-date-group" style="border:1px solid var(--ln);border-radius:10px;padding:12px;margin:8px 0;background:#fff"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:6px"><strong>📅 ${data==='sem-data'?'Data não informada':fd(data)}</strong><strong>Total do dia: ${brl(soma)}</strong></div>${itens.map(({v,x})=>`<div class="pg"><span>${esc(v.proc||'Atendimento')}<br><span class="note" style="margin:0">${esc(x.forma||'Forma não informada')}</span></span><span><b>${brl(x.valor)}</b></span></div>`).join('')}</section>`}).join('')}<div class="tot"><span>Total já pago</span><span>${brl(rec)}</span></div><div class="tot"><span>Saldo que falta pagar</span><span>${brl(sd)}</span></div></div>`:'';
  return `<h2 class="dt-title" style="margin-top:6px">Pagamentos de ${esc(p.nome)}</h2>${resumo}${audit}${geral}<h2 class="dt-title">Atendimentos (${vs.length})</h2>${vs.map(pgCard).join('')}${ext}`;
}
Object.assign(A,{
  pgrcv:(b,d)=>{
    const v=db.vd.find(x=>x.id===d.id);if(!v)return;
    const q=a=>document.querySelector(`[${a}="${d.id}"]`),val=num(q('data-pgv').value),data=q('data-pgd').value||tdy(),forma=q('data-pgf').value;
    if(!(val>0)){toast('Informe o valor recebido');return}
    if(val>saldoV(v)+0.005){toast('Valor maior que o que falta ('+brl(saldoV(v))+')',3000);return}
    v.pg.push(ovFeeMake(val,forma,data));save();render();toast(saldoV(v)<=0?'Pago por completo em '+fd(data):'Recebimento parcial registrado em '+fd(data),2600)},
  pgall:(b,d,p)=>{
    let val=num($('pgGV').value);const data=$('pgGD').value||tdy(),forma=$('pgGF').value;
    if(!(val>0)){toast('Informe o valor recebido');return}
    const vs=db.vd.filter(v=>v.pid===p.id&&saldoV(v)>0).sort((a,b)=>String(a.data).localeCompare(String(b.data)));
    const max=vs.reduce((s,v)=>s+saldoV(v),0);
    if(val>max+0.005){toast('Valor maior que o total a receber ('+brl(max)+')',3000);return}
    vs.forEach(v=>{if(val<=0.004)return;const u=Math.min(val,saldoV(v));v.pg.push(ovFeeMake(u,forma,data));val=r2(val-u)});
    save();render();toast('Recebimento registrado em '+fd(data),2600)},
  pgplan:(b,d)=>{
    const v=db.vd.find(x=>x.id===d.id);if(!v)return;
    const sd=saldoV(v);if(!(sd>0)){toast('Nada a parcelar');return}
    const n=parseInt(document.querySelector(`[data-pgn="${d.id}"]`).value,10)||2,ini=document.querySelector(`[data-pgfst="${d.id}"]`).value||pgAddMes(tdy(),1);
    const pagas=(v.plano||[]).filter(x=>pgParPg(v,x)),base=r2(sd/n),pl=[];
    for(let i=0;i<n;i++)pl.push({id:uid(),venc:pgAddMes(ini,i),valor:i<n-1?base:r2(sd-base*(n-1))});
    v.plano=pagas.concat(pl);save();render();toast('Parcelamento em '+n+'x gerado',2400)},
  pgplanrm:(b,d)=>arm('pl'+d.id,()=>{const v=db.vd.find(x=>x.id===d.id);if(v){v.plano=(v.plano||[]).filter(x=>pgParPg(v,x))}save();render();toast('Parcelas em aberto canceladas')}),
  pgpar:(b,d)=>{
    const v=db.vd.find(x=>x.id===d.id),par=v&&(v.plano||[]).find(x=>x.id===d.par);if(!par)return;
    const data=document.querySelector(`[data-pgpd="${d.par}"]`).value||tdy(),forma=document.querySelector(`[data-pgpf="${d.par}"]`).value;
    const val=Math.min(num(par.valor),saldoV(v));if(!(val>0)){toast('Este atendimento já está quitado');return}
    const id=uid();v.pg.push(ovFeeMake(val,forma,data,id));par.pgid=id;save();render();toast('Parcela recebida em '+fd(data),2400)}
});

A.ovFeeSave=ovFeeSaveAction;
A.ovFinanceSave=ovFinanceSaveAction;
