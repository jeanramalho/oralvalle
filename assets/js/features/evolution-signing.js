/* Assinatura manuscrita na impressão da evolução. Não é ICP-Brasil. */
(()=>{
  function open(p){
    const dentists=(db.dt||[]).filter(x=>x&&x.nome);
    if(!dentists.length){alert('Cadastre um dentista antes de assinar.');return;}
    const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;background:#0009;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
    const box=document.createElement('section');box.style.cssText='background:white;color:#222;padding:20px;border-radius:12px;max-width:660px;width:100%;max-height:94vh;overflow:auto';
    box.innerHTML='<h2 style="color:#dc6b00">Assinar evolução clínica</h2><p>Revise a evolução antes de assinar. A assinatura desenhada será incluída na impressão/PDF, mas NÃO é ICP-Brasil.</p><label>Dentista responsável</label><select data-dent style="width:100%;padding:10px;margin:8px 0"></select><canvas width="600" height="180" style="display:block;width:100%;height:180px;background:#fff;border:2px solid #ea7000;border-radius:8px;touch-action:none"></canvas><label style="display:block;margin:12px 0"><input type="checkbox" data-confirm> Sou o dentista selecionado, revisei o documento e autorizo esta assinatura.</label><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-clear>Limpar</button><button type="button" data-print style="background:#ea7000;color:white">Imprimir / salvar PDF assinado</button><button type="button" data-close>Cancelar</button></div>';
    const select=box.querySelector('[data-dent]');dentists.forEach(d=>{const o=document.createElement('option');o.value=String(d.id);o.textContent=(d.nome||'')+' · CRO '+(d.cro||'não informado');select.appendChild(o)});
    overlay.appendChild(box);document.body.appendChild(overlay);
    const c=box.querySelector('canvas'),ctx=c.getContext('2d');ctx.strokeStyle='#182638';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';let drawing=false,hasInk=false;
    const point=e=>{const r=c.getBoundingClientRect();return [(e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height]};
    c.addEventListener('pointerdown',e=>{drawing=true;c.setPointerCapture(e.pointerId);const [x,y]=point(e);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+.1,y+.1);ctx.stroke();hasInk=true});
    c.addEventListener('pointermove',e=>{if(!drawing)return;const [x,y]=point(e);ctx.lineTo(x,y);ctx.stroke();hasInk=true});
    c.addEventListener('pointerup',()=>drawing=false);c.addEventListener('pointercancel',()=>drawing=false);
    box.querySelector('[data-clear]').onclick=()=>{ctx.clearRect(0,0,c.width,c.height);hasInk=false};
    box.querySelector('[data-close]').onclick=()=>overlay.remove();
    box.querySelector('[data-print]').onclick=()=>{
      if(!hasInk||!box.querySelector('[data-confirm]').checked){alert('O dentista deve desenhar a assinatura e confirmar sua autorização.');return;}
      const d=dentists.find(x=>String(x.id)===select.value);if(!d)return;
      printEvolucao(p,{nome:d.nome||'',cro:d.cro||'',image:c.toDataURL('image/png'),when:new Date().toLocaleString('pt-BR')});overlay.remove();
    };
  }
  window.NexoEvolutionSigning={open};
})();
