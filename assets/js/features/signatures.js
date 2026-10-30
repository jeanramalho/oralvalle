/* NexoDent — protótipo local de coleta de assinaturas. NÃO é assinatura digital ICP-Brasil. */
(function(){
 'use strict';
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const types=['Termo de consentimento','Contrato de tratamento','Orçamento','Declaração','Outro documento'];
 let signatures={dentista:null,paciente:null}, signedAt={};
 function clear(){signatures={dentista:null,paciente:null};signedAt={};}
 window.nexoSignHtml=function(){
  const patients=(db.p||[]).filter(p=>!p.arq),dentists=(db.dt||[]).filter(d=>d.ativo!==false);
  return `<div class="ov-page-head"><div><h1>Documentos e Assinaturas</h1><p class="sub">Coleta manual gratuita de assinaturas — versão de testes.</p></div></div>
  <section class="card" style="border-top:4px solid #f97316;max-width:980px">
   <p class="note" style="padding:12px;background:#fff3e8;border-radius:8px"><strong>Atenção:</strong> este módulo é um protótipo local. Não salva documentos assinados no Supabase, não oferece trilha de auditoria verificável, não comprova identidade e <strong>não realiza assinatura digital ICP-Brasil</strong>. Não use como substituto de assinaturas exigidas por lei em receitas, atestados ou documentos clínicos. Imprima e colha assinatura física quando necessário.</p>
   <div class="row"><div><label>Paciente</label><select id="ns-patient"><option value="">Selecione</option>${patients.map(p=>`<option value="${e(p.id)}">${e(p.nome)}</option>`).join('')}</select></div><div><label>Dentista</label><select id="ns-dentist"><option value="">Selecione</option>${dentists.map(d=>`<option value="${e(d.id)}">${e(d.nome)}${d.cro?' — '+e(d.cro):''}</option>`).join('')}</select></div></div>
   <label>Tipo de documento</label><select id="ns-type">${types.map(t=>`<option>${e(t)}</option>`).join('')}</select>
   <label>Título</label><input id="ns-title" maxlength="160" placeholder="Ex.: Consentimento para procedimento">
   <label>Texto do documento</label><textarea id="ns-body" rows="9" placeholder="Digite ou cole o conteúdo do documento. Revise com o profissional responsável antes da assinatura."></textarea>
   ${['dentista','paciente'].map(role=>`<div style="margin-top:20px"><h3>Assinatura do ${role}</h3><p class="note">Assine usando mouse, dedo ou caneta digital. A imagem só fica nesta página até imprimir ou sair.</p><canvas id="ns-${role}" width="700" height="160" aria-label="Área para assinatura do ${role}" style="display:block;width:100%;max-width:700px;height:160px;background:#fff;border:2px solid #f97316;border-radius:10px;touch-action:none"></canvas><div class="row" style="margin-top:8px"><button type="button" class="ghost sm" data-ns-clear="${role}">Limpar assinatura</button><span id="ns-status-${role}" class="note">Ainda não assinou</span></div></div>`).join('')}
   <label style="display:block;margin-top:18px"><input type="checkbox" id="ns-consent"> Confirmo que as pessoas identificadas revisaram o conteúdo e concordaram em registrar suas assinaturas nesta tela.</label>
   <div class="row" style="margin-top:18px;flex-wrap:wrap"><button type="button" id="ns-print" style="background:#f97316">Gerar versão para impressão / PDF</button><button type="button" class="ghost" id="ns-reset">Limpar formulário</button></div>
   <p class="note">Para salvar como PDF, escolha “Salvar como PDF” na janela de impressão. Não há envio automático, armazenamento central ou validação criptográfica.</p>
  </section>`;
 };
 function setup(canvas){if(!canvas||canvas.dataset.ready)return;canvas.dataset.ready='1';const ctx=canvas.getContext('2d'),role=canvas.id.slice(3);ctx.strokeStyle='#222';ctx.lineWidth=2.2;ctx.lineCap='round';ctx.lineJoin='round';let drawing=false,changed=false;
  const pos=ev=>{const r=canvas.getBoundingClientRect();return {x:(ev.clientX-r.left)*canvas.width/r.width,y:(ev.clientY-r.top)*canvas.height/r.height}};
  canvas.addEventListener('pointerdown',ev=>{drawing=true;canvas.setPointerCapture(ev.pointerId);const p=pos(ev);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.01,p.y+.01);ctx.stroke();changed=true});
  canvas.addEventListener('pointermove',ev=>{if(!drawing)return;const p=pos(ev);ctx.lineTo(p.x,p.y);ctx.stroke()});
  const finish=()=>{if(!drawing)return;drawing=false;if(changed){signatures[role]=canvas.toDataURL('image/png');signedAt[role]=new Date().toISOString();const el=document.getElementById('ns-status-'+role);if(el)el.textContent='Assinatura capturada nesta sessão';}};
  canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);
 }
 const obs=new MutationObserver(()=>{['dentista','paciente'].forEach(r=>setup(document.getElementById('ns-'+r)))});
 document.addEventListener('DOMContentLoaded',()=>obs.observe(document.body,{childList:true,subtree:true}));
 document.addEventListener('click',ev=>{
  const c=ev.target.closest('[data-ns-clear]');if(c){const r=c.dataset.nsClear,cv=document.getElementById('ns-'+r);cv?.getContext('2d').clearRect(0,0,cv.width,cv.height);signatures[r]=null;delete signedAt[r];document.getElementById('ns-status-'+r).textContent='Ainda não assinou';return}
  if(ev.target.closest('#ns-reset')){if(confirm('Limpar texto e assinaturas desta sessão?')){clear();render()}return}
  if(!ev.target.closest('#ns-print'))return;
  const get=id=>document.getElementById(id),patient=(db.p||[]).find(p=>String(p.id)===get('ns-patient').value),dentist=(db.dt||[]).find(d=>String(d.id)===get('ns-dentist').value);
  const title=get('ns-title').value.trim(),body=get('ns-body').value.trim();
  if(!patient||!dentist||!title||!body){alert('Selecione paciente, dentista e preencha título e conteúdo.');return}
  if(!get('ns-consent').checked){alert('Confirme a concordância antes de gerar o documento.');return}
  if(!signatures.dentista||!signatures.paciente){alert('Colete as duas assinaturas ou imprima o documento sem usar este módulo e colha assinaturas físicas.');return}
  const date=new Date().toLocaleString('pt-BR');const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${e(title)}</title><style>body{font:15px Arial,sans-serif;color:#222;max-width:780px;margin:35px auto;line-height:1.5}h1{color:#d65b0a}article{white-space:pre-wrap;min-height:220px}.sign{display:flex;gap:30px;margin-top:50px}.sign>div{flex:1}.sign img{width:100%;height:85px;object-fit:contain;border-bottom:1px solid #555}.note{font-size:11px;color:#555;margin-top:40px}@media print{body{margin:15mm}}</style></head><body><h1>${e(title)}</h1><p><b>Tipo:</b> ${e(get('ns-type').value)}<br><b>Paciente:</b> ${e(patient.nome)}<br><b>Dentista:</b> ${e(dentist.nome)} — ${e(dentist.cro||'CRO não informado')}<br><b>Gerado em:</b> ${e(date)}</p><article>${e(body)}</article><div class="sign"><div><img src="${signatures.dentista}"><b>${e(dentist.nome)}</b><br>Assinatura eletrônica simples (imagem)<br><small>${e(new Date(signedAt.dentista).toLocaleString('pt-BR'))}</small></div><div><img src="${signatures.paciente}"><b>${e(patient.nome)}</b><br>Assinatura eletrônica simples (imagem)<br><small>${e(new Date(signedAt.paciente).toLocaleString('pt-BR'))}</small></div></div><p class="note">Registro de teste gerado localmente no navegador. Não contém assinatura digital ICP-Brasil nem verificação independente de autoria ou integridade.</p></body></html>`;
  const blob=new Blob([html],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='nexodent-documento-para-impressao.html';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  alert('Arquivo HTML para impressão gerado. Abra-o e use Ctrl+P → Salvar como PDF. Não equivale a assinatura digital certificada.');
 });
})();
