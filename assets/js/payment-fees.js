/* Oral Valle 062: taxas editáveis e histórico imutável por recebimento. */
const OV_FEE_FORMS=['Pix','Dinheiro','Débito','Crédito à vista',...Array.from({length:11},(_,i)=>`Crédito ${i+2}x`),'Crédito','Boleto','Financiamento','Outro'];
function ovFeeRates(){
  if(!db.taxasPagamento||typeof db.taxasPagamento!=='object'||Array.isArray(db.taxasPagamento))db.taxasPagamento={};
  return db.taxasPagamento;
}
function ovFeePct(forma){
  const rates=ovFeeRates();const key=forma==='Crédito'?'Crédito à vista':forma;
  const n=Number(rates[key]);return Number.isFinite(n)&&n>=0&&n<=100?n:0;
}
function ovFeeMake(valor,forma,data,id,override){
  const bruto=r2(Number(valor));const raw=override===undefined||override===null||override===''?ovFeePct(forma):Number(override);
  const taxaPct=Number.isFinite(raw)&&raw>=0&&raw<=100?raw:0;
  const taxaValor=r2(bruto*taxaPct/100);
  return {id:id||uid(),data,valor:bruto,forma,taxaPct,taxaValor,liquido:r2(bruto-taxaValor)};
}
function ovFeeTax(p){return Number.isFinite(Number(p.taxaValor))?Number(p.taxaValor):0}
function ovFeeNet(p){return r2(num(p.valor)-ovFeeTax(p))}
function ovFeeSummary(p){return `<small class="note" style="display:block;margin:3px 0">Taxa ${brl(ovFeeTax(p))} (${Number(p.taxaPct)||0}%) · <b>Líquido ${brl(ovFeeNet(p))}</b></small>`}
function ovFeeOptions(sel){return OV_FEE_FORMS.map(f=>`<option${f===sel?' selected':''}>${f}</option>`).join('')}
function ovFeeSettings(){
 const rows=OV_FEE_FORMS.filter(f=>f!=='Crédito'&&f!=='Outro').map(f=>`<label style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin:5px 0"><span>${esc(f)}</span><span style="display:flex;align-items:center;gap:5px"><input type="number" min="0" max="100" step="0.01" inputmode="decimal" data-fee-rate="${esc(f)}" value="${ovFeePct(f)}" style="max-width:100px">%</span></label>`).join('');
 return `<details class="card" style="margin-bottom:12px"><summary style="cursor:pointer;font-weight:700">⚙️ Configurar taxas das formas de pagamento</summary><p class="note">Taxas padrão em %. Edite e salve. Cada recebimento mantém a taxa aplicada na data, mesmo após alterações.</p><div style="max-width:500px">${rows}</div><button class="sm" data-act="ovFeeSave" type="button" style="margin-top:10px">Salvar taxas</button></details>`;
}
function ovFeeSalePreview(){return `<div class="row" style="align-items:flex-end;margin-top:7px"><div><label for="ovFeeOverride">Taxa desta venda (%) — editável</label><input id="ovFeeOverride" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="0"></div><div id="ovFeePreview" role="status" class="note" style="margin:0">Taxa: R$ 0,00 · Líquido: R$ 0,00</div></div>`}
function ovFeeUpdatePreview(reset){const f=document.getElementById('vfm'),a=document.getElementById('vrc'),t=document.getElementById('ovFeeOverride'),box=document.getElementById('ovFeePreview');if(!f||!a||!t||!box)return;
 if(reset)t.value=String(ovFeePct(f.value));const n=Number(t.value);const val=num(a.value);if(!Number.isFinite(n)||n<0||n>100){box.textContent='Taxa inválida (0 a 100%)';return}const fee=r2(val*n/100);box.textContent='Taxa: '+brl(fee)+' · Líquido da clínica: '+brl(val-fee);
}
document.addEventListener('input',e=>{if(e.target.matches('#vrc,#ovFeeOverride'))ovFeeUpdatePreview(false)});
document.addEventListener('change',e=>{if(e.target.matches('#vfm'))ovFeeUpdatePreview(true)});
function ovFeeSaveAction(){const r=ovFeeRates();for(const el of document.querySelectorAll('[data-fee-rate]')){const n=Number(el.value);if(el.value===''||!Number.isFinite(n)||n<0||n>100){toast('Informe taxas entre 0 e 100%');return}r[el.dataset.feeRate]=n}save();toast('Taxas de pagamento salvas');render()}

document.addEventListener('DOMContentLoaded',()=>ovFeeUpdatePreview(true));
