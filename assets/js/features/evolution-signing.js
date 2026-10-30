/* Assinatura manuscrita na impressão da evolução. Não é ICP-Brasil. */
(()=>{
  function open(p){
    const dentists=(db.dt||[]).filter(x=>x&&x.nome);
    if(!dentists.length){alert('Cadastre um dentista antes de assinar.');return;}
    const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;background:#0009;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
    const box=document.createElement('section');box.style.cssText='background:white;color:#222;padding:20px;border-radius:12px;max-width:660px;width:100%;max-height:94vh;overflow:auto';
    box.innerHTML='<h2 style="color:#dc6b00">Assinar evolução clínica</h2><p>Revise a evolução antes de assinar. A assinatura desenhada será incluída na impressão/PDF, mas NÃO é ICP-Brasil.</p><label>Dentista responsável</label><select data-dent style="width:100%;padding:10px;margin:8px 0"></select><canvas width="600" height="180" style="display:block;width:100%;height:180px;background:#fff;border:2px solid #ea7000;border-radius:8px;touch-action:none"></canvas><label style="display:block;margin:12px 0"><input type="checkbox" data-confirm> Sou o dentista selecionado, revisei o documento e autorizo esta assinatura.</label><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-clear>Limpar</button><button type="button" data-print style="background:#ea7000;color:white">Imprimir / salvar PDF assinado</button><button type="button" data-archive style="background:#b85800;color:white">Arquivar PDF assinado no Supabase</button><button type="button" data-close>Cancelar</button></div>';
    const select=box.querySelector('[data-dent]');dentists.forEach(d=>{const o=document.createElement('option');o.value=String(d.id);o.textContent=(d.nome||'')+' · CRO '+(d.cro||'não informado');select.appendChild(o)});
    overlay.appendChild(box);document.body.appendChild(overlay);
    const c=box.querySelector('canvas'),ctx=c.getContext('2d');ctx.strokeStyle='#182638';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';let drawing=false,hasInk=false;
    const point=e=>{const r=c.getBoundingClientRect();return [(e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height]};
    c.addEventListener('pointerdown',e=>{drawing=true;c.setPointerCapture(e.pointerId);const [x,y]=point(e);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+.1,y+.1);ctx.stroke();hasInk=true});
    c.addEventListener('pointermove',e=>{if(!drawing)return;const [x,y]=point(e);ctx.lineTo(x,y);ctx.stroke();hasInk=true});
    c.addEventListener('pointerup',()=>drawing=false);c.addEventListener('pointercancel',()=>drawing=false);
    box.querySelector('[data-clear]').onclick=()=>{ctx.clearRect(0,0,c.width,c.height);hasInk=false};
    box.querySelector('[data-close]').onclick=()=>overlay.remove();
    box.querySelector('[data-archive]').onclick=async()=>{
      if(!hasInk||!box.querySelector('[data-confirm]').checked){alert('O dentista deve desenhar a assinatura e confirmar sua autorização.');return;}
      const d=dentists.find(x=>String(x.id)===select.value);if(!d)return;
      if(!window.OralCloud?.enabled||!window.OralCloud?.clinicId||!window.OralCloudSync?.fileOperation){alert('Conecte a clínica ao Supabase antes de arquivar.');return;}
      if(!window.jspdf?.jsPDF){alert('Biblioteca de PDF não disponível.');return;}
      const button=box.querySelector('[data-archive]');button.disabled=true;button.textContent='Arquivando...';
      try{
        const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'});
        const now=new Date(),stamp=now.toLocaleString('pt-BR');
        const cl=Object.assign({},typeof CL_DEF!=='undefined'?CL_DEF:{},db.cl||{});
        let y=20;
        const page=()=>{doc.addPage();y=20;};
        const line=(txt,size=10,bold=false)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);const rows=doc.splitTextToSize(String(txt||''),178);for(const row of rows){if(y>274)page();doc.text(row,16,y);y+=size*.49+1.7;}};
        line(cl.nome||'Clínica odontológica',12,true);line('EVOLUÇÃO CLÍNICA — CÓPIA PARA ARQUIVAMENTO',13,true);
        line('Paciente: '+(p.nome||'')+' | ID: '+p.id);line('Dentista: '+(d.nome||'')+' | CRO: '+(d.cro||'não informado'));
        line('Documento emitido em: '+stamp);y+=5;
        const entries=(p.evol||[]).slice().sort((a,b)=>String(a.data||'').localeCompare(String(b.data||'')));
        if(!entries.length)line('Nenhuma evolução registrada.');
        entries.forEach((e,i)=>{if(y>260)page();line('Registro '+(i+1)+' — '+(e.data||'')+(e.n?' — Dente '+e.n:''),10,true);line(e.txt||'Sem descrição');y+=3;});
        if(y>224)page();y+=6;line('Assinatura manuscrita do dentista:',10,true);
        doc.addImage(c.toDataURL('image/png'),'PNG',16,y,110,33);y+=38;
        line('Profissional: '+(d.nome||'')+' | CRO: '+(d.cro||''));line('Autorizada em: '+stamp);
        line('Assinatura desenhada como imagem. NÃO é assinatura digital ICP-Brasil.',9);
        const filename='Evolucao_assinada_'+String(p.id).replace(/[^a-zA-Z0-9_-]/g,'_')+'_'+now.toISOString().replace(/[:.]/g,'-')+'.pdf';
        const bytes=doc.output('arraybuffer');
        const digest=await crypto.subtle.digest('SHA-256',bytes);
        const sha256=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
        const file={id:uid(),nome:filename,tipo:'application/pdf',categoria:'Evolução clínica assinada (manuscrita)',data:doc.output('datauristring'),dataEnvio:hojeBR(),assinaturaTipo:'imagem manuscrita (não ICP-Brasil)',dentistaNome:d.nome||'',dentistaCro:d.cro||'',assinadoEm:now.toISOString(),sha256};
        await window.OralCloudSync.fileOperation(p.id,'append',{file});
        doc.save(filename);overlay.remove();
        alert('Cópia da evolução arquivada no Supabase. Confirme sua presença em Arquivos do paciente. Esta operação NÃO bloqueia edições do prontuário original.');
      }catch(error){alert('Não foi possível confirmar o arquivamento: '+(error?.message||String(error)));}
      finally{button.disabled=false;button.textContent='Arquivar PDF assinado no Supabase';}
    };
    box.querySelector('[data-print]').onclick=()=>{
      if(!hasInk||!box.querySelector('[data-confirm]').checked){alert('O dentista deve desenhar a assinatura e confirmar sua autorização.');return;}
      const d=dentists.find(x=>String(x.id)===select.value);if(!d)return;
      printEvolucao(p,{nome:d.nome||'',cro:d.cro||'',image:c.toDataURL('image/png'),when:new Date().toLocaleString('pt-BR')});overlay.remove();
    };
  }
  window.NexoEvolutionSigning={open};
})();
