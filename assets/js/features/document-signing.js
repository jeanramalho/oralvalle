/* NexoDent: assinatura manuscrita visual em PDF; NÃO é ICP-Brasil. */
(()=>{
 const getDoc=async(type,p)=>type==='rx'?rxDoc(p):atDoc(p);
 const dentist=(type)=>{const st=type==='rx'?rxState(cur()):atState(cur());return db.dt.find(x=>x.id===st.dt)};
 async function exportForIcp(type,p){
   const d=dentist(type);
   if(!d){alert('Selecione um dentista no documento antes de continuar.');return}
   const result=await getDoc(type,p);if(!result)return;
   result.doc.save(result.fname.replace(/\.pdf$/i,'_PARA_ASSINAR_ICP.pdf'));
   alert('PDF SEM ASSINATURA DIGITAL gerado. Para assinar com ICP-Brasil, utilize um assinador compatível com seu certificado A1/A3. O NexoDent ainda não aplica nem verifica assinaturas ICP-Brasil. Depois, anexe o PDF assinado ao prontuário.');
 }
 async function open(type,p){
   const d=dentist(type);if(!d){alert('Selecione um dentista antes de assinar.');return}
   const result=await getDoc(type,p);if(!result)return;
   const cover=document.createElement('div');cover.style.cssText='position:fixed;inset:0;background:#0009;z-index:99999;display:flex;align-items:center;justify-content:center;padding:15px';
   const box=document.createElement('section');box.style.cssText='background:white;border-radius:14px;padding:20px;max-width:660px;width:100%;max-height:95vh;overflow:auto;color:#222';
   box.innerHTML='<h2 style="color:#d96a00">Assinatura manuscrita no documento</h2><p>Paciente: <b></b> · Dentista: <strong></strong></p><p style="font-size:13px">Esta assinatura é uma imagem inserida no PDF, não é assinatura digital ICP-Brasil. O dentista deve assinar pessoalmente após revisar o documento.</p><canvas width="600" height="180" style="width:100%;height:180px;touch-action:none;border:2px solid #e87918;border-radius:8px;background:white"></canvas><p><label><input type="checkbox"> Sou o profissional identificado e autorizo a inserção desta assinatura neste documento.</label></p><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-clear>Limpar</button><button type="button" data-save style="background:#ea7000;color:white">Baixar PDF com assinatura manuscrita</button><button type="button" data-close>Cancelar</button></div>';
   box.querySelector('b').textContent=p.nome||'';box.querySelector('strong').textContent=(d.nome||'')+' '+(d.cro||'');cover.appendChild(box);document.body.appendChild(cover);
   const canvas=box.querySelector('canvas'),ctx=canvas.getContext('2d');ctx.strokeStyle='#152238';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';let down=false,drawn=false;
   const point=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height]};
   canvas.addEventListener('pointerdown',e=>{down=true;canvas.setPointerCapture(e.pointerId);const [x,y]=point(e);ctx.beginPath();ctx.moveTo(x,y)});
   canvas.addEventListener('pointermove',e=>{if(!down)return;const [x,y]=point(e);ctx.lineTo(x,y);ctx.stroke();drawn=true});
   canvas.addEventListener('pointerup',()=>down=false);canvas.addEventListener('pointercancel',()=>down=false);
   box.querySelector('[data-clear]').onclick=()=>{ctx.clearRect(0,0,600,180);drawn=false};box.querySelector('[data-close]').onclick=()=>cover.remove();
   box.querySelector('[data-save]').onclick=async()=>{
     if(!drawn||!box.querySelector('input').checked){alert('O profissional deve assinar e confirmar a autorização.');return}
     const pdf=result.doc;const page=pdf.getNumberOfPages();pdf.setPage(page);
     // Área adicional exclusiva para a assinatura, sem sobrepor o texto clínico.
     pdf.addPage();pdf.setFontSize(13);pdf.text('ASSINATURA MANUSCRITA - ANEXO',15,20);pdf.setFontSize(10);
     pdf.text('Paciente: '+String(p.nome||'').slice(0,85),15,32);pdf.text('Profissional: '+String(d.nome||'').slice(0,80),15,39);
     pdf.text('CRO: '+String(d.cro||'não informado').slice(0,80),15,46);
     pdf.addImage(canvas.toDataURL('image/png'),'PNG',15,55,160,48);
     pdf.text('Registrada em: '+new Date().toLocaleString('pt-BR'),15,113);
     pdf.setFontSize(9);pdf.text('Assinatura manuscrita inserida como imagem. NÃO é assinatura digital ICP-Brasil.',15,124);
     const filename=result.fname.replace(/\.pdf$/i,'_ASSINATURA_MANUSCRITA.pdf');
     // Salvar somente após confirmação do Supabase. Não usar armazenamento local para prontuário.
     if(!window.OralCloud?.enabled || !window.OralCloudSync?.fileOperation || !window.OralCloud?.clinicId){
       alert('Não foi possível identificar a clínica conectada ao Supabase. O documento não foi arquivado.');return;
     }
     const button=box.querySelector('[data-save]');button.disabled=true;button.textContent='Salvando no prontuário...';
     try{
       const data=pdf.output('datauristring');
       const file={id:uid(),nome:filename,tipo:'application/pdf',categoria:'Documento assinado - '+(type==='rx'?'Receituário':'Atestado'),data,dataEnvio:hojeBR(),
         assinaturaTipo:'imagem manuscrita (não ICP-Brasil)',dentistaNome:d.nome||'',dentistaCro:d.cro||'',assinadoEm:new Date().toISOString()};
       await OralCloudSync.fileOperation(p.id,'append',{file});
       pdf.save(filename);
       cover.remove();
       alert('Documento arquivado no Supabase e PDF disponibilizado para download. A assinatura é manuscrita, NÃO ICP-Brasil.');
     }catch(error){
       alert('Falha ao salvar no Supabase: '+(error?.message||String(error))+'\nO documento NÃO foi confirmado como arquivado. Não feche a clínica antes de resolver a falha de sincronização.');
     }finally{button.disabled=false;button.textContent='Baixar PDF com assinatura manuscrita';}
   };
 }
 window.NexoDocumentSigning={open,exportForIcp};
})();
