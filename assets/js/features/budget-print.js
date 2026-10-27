function printOrc(p,o){
  const cl=Object.assign({},CL_DEF,db.cl||{}),pa=$('printarea');
  const sel=new Set();o.itens.forEach(i=>String(i.dente||'').split(/[,;\s]+/).forEach(x=>{const v=parseInt(x,10);if(v)sel.add(v)}));
  const hasDec=[...sel].some(n=>(n>=51&&n<=55)||(n>=61&&n<=65)||(n>=71&&n<=75)||(n>=81&&n<=85));
  const rows=o.itens.map(i=>{const m=itMult(i);return `<tr><td>- ${esc(i.proc||'Procedimento')}${i.dente?` <span class="pr-dn">(${dLab(i.dente)} ${esc(i.dente)})</span>`:''}${i.obs?`<div class="pr-ob">${esc(i.obs)}</div>`:''}</td><td class="c">${m.q}</td><td class="r">${nbr(m.u)}</td><td class="r">${nbr(m.t)}</td></tr>`}).join('');
  pa.innerHTML=`<style id="pp-page">@page{size:A4;margin:10mm 12mm 16mm;@bottom-right{content:"página " counter(page) " de " counter(pages);font:9pt Arial,sans-serif;color:#777}}
/* ===== Procedimentos: mesmo padrão visual dos Dentistas cadastrados ===== */
.pr-card,.proc-cards .proc-card.pr-card{background:var(--bg,#fff) !important;border:1.5px solid var(--ln,#e3e3e3) !important;border-left:6px solid var(--ac,#ff7a00) !important;border-radius:14px !important;padding:14px !important;margin:0 0 22px !important;box-shadow:0 1px 4px rgba(0,0,0,.07) !important}
.pr-head{display:flex;align-items:center;gap:12px;padding-bottom:12px;margin-bottom:4px;border-bottom:1.5px solid var(--ln,#e3e3e3)}
.pr-av{flex:none;width:42px;height:42px;border-radius:50%;background:var(--ac,#ff7a00);color:var(--acf,#fff);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px}
.pr-nm{flex:1;min-width:0;font-weight:800;font-size:17px}
.pr-nm small{display:block;font-weight:400;font-size:13px;color:var(--mut,#6b7280)}
.pr-compact{padding:12px 14px !important;margin-bottom:14px !important}
.pr-compact .pr-head{border-bottom:0;padding-bottom:0;margin-bottom:0}
.tt-row.pr-card{margin-top:0 !important}
.tt-head.pr-head strong{font-size:17px}
/* tela Procedimentos (precificação) */
.proc-card.pr-card .proc-card-main{padding-bottom:12px;border-bottom:1.5px solid var(--ln,#e3e3e3)}
.pr-headline{display:flex;align-items:center;gap:12px;min-width:0}
.pr-headline .proc-name{font-weight:800;font-size:17px}
.pr-headline .proc-meta{margin-top:2px;font-size:13px}
.proc-card.pr-card .proc-edit{border-top:0;margin-top:10px;padding-top:0}
.proc-cards,.proc-cards.proc-cards{display:block !important}

/* ===== aba Pagamentos ===== */
.ov-patient-wrap .tabs{overflow-x:auto;-webkit-overflow-scrolling:touch}
.ov-patient-wrap .tabs button{flex:1 0 auto;white-space:nowrap;padding-left:10px;padding-right:10px}
.pg-top,.pg-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0 12px}
.pg-top>div,.pg-sum>div{background:#fff;border:1.5px solid var(--ln);border-radius:12px;padding:10px 12px}
.pg-sum>div{background:var(--sf,#fff);padding:8px 10px}
.pg-top small,.pg-sum small{display:block;font-size:12px;color:var(--mut)}
.pg-top b,.pg-sum b{font-size:18px}.pg-sum b{font-size:16px}
.pg-top b.ok,.pg-sum b.ok{color:var(--ok)}.pg-top b.wr,.pg-sum b.wr{color:var(--wr)}
.pg-bar{height:8px;border-radius:99px;background:#e9e9e9;overflow:hidden;margin:2px 0 10px}
.pg-bar i{display:block;height:100%;background:var(--ac);border-radius:99px}
.pg-card h3,.pg-plan h3,.pg-form h3,.pg-list h3{margin:12px 0 6px;font-size:15px}
.pg-card .pg-list .pg{color:var(--ink)}
.pg-par{border:1.5px solid var(--ln);border-radius:10px;padding:10px 12px;margin-bottom:8px;background:#fff}
.pg-par.ok{border-color:var(--ok);background:#fff8ef}.pg-par.late{border-color:var(--wr)}
.pg-par-h{display:flex;justify-content:space-between;align-items:center;gap:8px}
.pg-form{margin-top:12px;padding-top:10px;border-top:1.5px solid var(--ln)}
.pg-parc{margin-top:10px}.pg-parc summary{cursor:pointer;color:var(--ac);font-weight:700}
.pg-geral{border-left:6px solid var(--ac)}
@media (max-width:520px){.pg-top b{font-size:15px}.pg-sum b{font-size:14px}}

/* Procedimentos: cartões separados visualmente, no padrão da aba Dentistas */
.proc-cards .proc-card{
  background:var(--ov-bg,#f5f5f5);
  border:1.5px solid var(--ov-line,#ececec);
  border-left:6px solid var(--ov-orange,#ff7a00);
  border-radius:14px;
  padding:14px;
  margin:0 0 22px;
  box-shadow:0 1px 4px rgba(0,0,0,.07);
}
.proc-cards .proc-card-main{
  padding-bottom:12px;
  margin-bottom:4px;
  border-bottom:1.5px solid var(--ov-line,#ececec);
}
.proc-cards .proc-edit{
  margin-top:10px;
  padding-top:10px;
  border-top:0;
}
.proc-cards .proc-edit .card{
  border:0;
  box-shadow:none;
  background:transparent;
}
</style>
  <div class="pr"><div class="pr-head">${cl.semLogo?'':`<img src="${clLogoSrc()}" alt="Logo da clínica">`}<div class="pr-info"><strong>${esc(cl.nome)}</strong>${cl.end?`<div>${esc(cl.end)}</div>`:''}${(cl.email||cl.tel)?`<div>${[cl.email,cl.tel].filter(Boolean).map(esc).join(' / ')}</div>`:''}${cl.cnpj?`<div>${esc(cl.cnpj)}</div>`:''}</div></div>
  <h1 class="pr-title">Proposta Financeira</h1>
  <div class="pr-pac"><div class="pr-box" style="flex:1"><small>Nome do Paciente</small><b>${esc(p.nome)}</b></div><div class="pr-box"><small>Telefone</small><b>${esc(p.tel||'—')}</b></div></div>
  <h2 class="pr-h">Odontograma</h2><div class="pr-odos">${prOdo(sel,false)}${hasDec?prOdo(sel,true):''}</div>
  <table class="pr-tb"><thead><tr><th>Tratamentos</th><th class="c">Qtd.</th><th class="r">Valor unit.</th><th class="r">Valor total</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="pr-tot">${num(o.desc)>0?`<div class="s"><span>Subtotal</span><span>${brl(sub(o))}</span></div><div class="s"><span>Desconto</span><span>− ${brl(o.desc)}</span></div>`:''}<div class="t"><span>Total</span><span>${brl(total(o))}</span></div></div>
  <h2 class="pr-h">Forma de Pagamento</h2><div class="pr-pg">${esc(o.cond||'A combinar')}</div>${o.val?`<div class="pr-val">Proposta válida até ${fd(o.val)}.</div>`:''}
  <div class="pr-sign">${esc(cl.nome)} , ${hojeBR()}.</div></div>`;
  document.body.classList.add('pp');
  const end=()=>{document.body.classList.remove('pp');pa.innerHTML='';window.removeEventListener('afterprint',end)};
  window.addEventListener('afterprint',end);
  document.addEventListener('pointerdown',end,{once:true});
  setTimeout(end,60000);
  let opened=false;const bp=()=>{opened=true;window.removeEventListener('beforeprint',bp)};window.addEventListener('beforeprint',bp);
  setTimeout(()=>{window.removeEventListener('beforeprint',bp);if(!opened)toast('A janela de impressão não abriu neste navegador. Use o botão Baixar PDF.',5000)},900);
  // Aguarda a imagem do cabeçalho antes de abrir a prévia de impressão.
  // Evita que a impressão seja renderizada sem a logo durante o carregamento.
  const printReady=()=>{try{window.print()}catch(e){end();toast('Impressão indisponível aqui. Use o botão Baixar PDF.',4000)}};
  const logo=pa.querySelector('.pr-head img');
  if(logo && !logo.complete){
    let done=false;
    const ready=()=>{if(done)return;done=true;printReady()};
    logo.addEventListener('load',ready,{once:true});
    logo.addEventListener('error',ready,{once:true});
    setTimeout(ready,1500);
  }else{printReady()}
}
