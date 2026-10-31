/* ===== comissões ===== */
function comHtml(){
  const m=view.cm||tdy().slice(0,7);
  const ds=db.dt.filter(d=>d.ativo!==false||dtMoves(d.id));
  let h=`<div class="tabs" style="margin-bottom:16px">${pmSee('dt')?'<button type="button" data-act="nav" data-t="dt">Dentistas</button>':''}<button type="button" class="on" data-act="nav" data-t="cm">Comissões</button></div><div class="card"><label for="cmm" style="margin:0 0 4px">Mês</label><input id="cmm" type="month" value="${m}"></div>`;
  if(!ds.length)return h+'<div class="empty">Cadastre um dentista na aba Dentistas para acompanhar comissões.</div>';

  // 253: conferência somente leitura; não modifica comissões nem pagamentos.
  const moves=db.vd.filter(v=>String(v.data||'').slice(0,7)===m);
  const missing=moves.filter(v=>!v.dt||!db.dt.some(d=>String(d.id)===String(v.dt)));
  const duplicateKeys=new Map();
  moves.forEach(v=>{const k=String(v.pid)+'|'+String(v.trid||v.tid||v.tratId||v.proc||'')+'|'+String(v.data||'');duplicateKeys.set(k,(duplicateKeys.get(k)||0)+1)});
  const suspects=[...duplicateKeys.values()].filter(n=>n>1).length;
  const paid=db.cp.filter(c=>String(c.data||'').slice(0,7)===m).reduce((n,c)=>n+num(c.valor),0);
  h+=`<details class="card" style="margin-bottom:12px"><summary style="cursor:pointer;font-weight:700">Conferência mensal de comissões</summary><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin-top:12px">${stat('Produção baixada',brl(sum(moves,'valor')))}${stat('Comissões geradas',brl(sum(moves,'rep')))}${stat('Pagamentos no mês',brl(paid))}${stat('Sem dentista válido',String(missing.length))}${stat('Possíveis repetições',String(suspects))}</div><p class="note">Pagamentos do mês podem quitar comissões de meses anteriores. Repetições são alertas para conferência, não confirmação de duplicidade. Nenhum registro é alterado.</p></details>`;
  const selected=view.cmDent||'';
  if(!selected){
    h+=`<div class="card"><h2 style="margin-top:0">Comissões por dentista</h2><p class="note">Clique no nome do dentista para visualizar todos os comissionamentos registrados para ele.</p>`;
    h+=ds.map(d=>{
      const vm=db.vd.filter(v=>v.dt===d.id&&v.data.slice(0,7)===m);
      const total=sum(vm,'rep');
      const production=sum(vm,'valor');
      const patients=new Set(vm.map(v=>v.pid)).size;
      return `<button class="card" data-act="cmdent" data-id="${d.id}" type="button" style="width:100%;text-align:left;margin:0 0 8px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px"><span><strong>${esc(d.nome)}</strong>${d.ativo===false?' <span class="badge">arquivado</span>':''}<br><span class="note" style="margin:2px 0 0">${vm.length} procedimento(s) · ${patients} paciente(s) · produção ${brl(production)}</span></span><span style="text-align:right"><strong style="color:var(--ac)">${brl(total)}</strong><br><span class="note" style="margin:2px 0 0">Comissão gerada</span></span></button>`;
    }).join('');
    h+=`</div>`;
    return h+`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">${stat('A pagar agora (todos)',ds.reduce((a,d)=>a+dtTot(d.id).apagar,0))}${stat('Prevista, aguardando pacientes',ds.reduce((a,d)=>a+dtTot(d.id).prev,0))}</div>`;
  }

  const d=ds.find(x=>x.id===selected);
  if(!d){view.cmDent='';return comHtml()}
  const t=dtTot(d.id);
  const vm=db.vd.filter(v=>v.dt===d.id&&v.data.slice(0,7)===m);
  const pm=db.cp.filter(c=>c.dt===d.id&&c.data.slice(0,7)===m);
  const liberado=vm.reduce((a,x)=>a+liberada(x),0);
  h+=`<div class="card"><div class="row" style="justify-content:space-between;align-items:center"><div><h2 style="margin:0">${esc(d.nome)}</h2>${d.ativo===false?' <span class="badge">arquivado</span>':''}</div><button class="ghost sm" data-act="cmback">Voltar aos dentistas</button></div>
  ${rw('Procedimentos no mês',String(vm.length))}${rw('Pacientes atendidos no mês',String(new Set(vm.map(v=>v.pid)).size))}${rw('Produção do mês',brl(sum(vm,'valor')))}${rw('Comissão gerada no mês',brl(sum(vm,'rep')))}${rw('Já liberada (paciente pagou)',brl(liberado))}${rw('Paga no mês',brl(sum(pm,'valor')))}
  <div class="tot" style="font-size:15px;font-weight:600"><span>Prevista, aguardando pacientes (geral)</span><span>${brl(t.prev)}</span></div>
  ${t.exc>0?rw('Pago adiantado (geral)',brl(t.exc)):''}
  <div class="tot" style="color:var(--ac)"><span>A pagar agora (geral)</span><span>${brl(t.apagar)}</span></div>
  ${t.apagar>0?`<div class="row" style="margin-top:8px"><input data-cpv="${d.id}" inputmode="decimal" value="${t.apagar.toFixed(2)}" aria-label="Valor a pagar"><button data-act="cpay" data-id="${d.id}">Registrar pagamento</button></div>`:'<p class="note" style="margin:8px 0 0">Nada a pagar agora.</p>'}
  ${pm.length?pm.map(c=>`<div class="pg"><span>${fd(c.data)} · pagamento${c.obs?' ('+esc(c.obs)+')':''}</span><span>${brl(c.valor)} <button class="danger sm" data-act="rmcp" data-id="${c.id}" aria-label="Remover pagamento">${delArm===c.id?'Confirmar':'×'}</button></span></div>`).join(''):''}
  <details open><summary>Comissionamentos do mês (${vm.length})</summary>${vm.length?vm.map(v=>`<div class="pg"><span>${fd(v.data)} · ${esc(pName(v.pid))}<br>${esc(v.proc||'Atendimento')} · ${brl(v.valor)} · ${esc(dName(v.dt))}</span><span style="text-align:right"><strong>${brl(v.rep)}</strong><br>${Math.round(Math.min(1,recebido(v)/(num(v.valor)||1))*100)}% recebido</span></div>`).join(''):'<p class="note" style="margin:0">Nenhum comissionamento neste mês.</p>'}</details></div>`;
  return h;
}

