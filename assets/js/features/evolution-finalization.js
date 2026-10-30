/* Finalização individual de evoluções. O Supabase é a autoridade sobre o bloqueio. */
(()=>{
  const cache=new Map();
  const ready=()=>!!(window.OralCloud?.enabled&&OralCloud.clinicId&&typeof OralCloud.request==='function');
  const rowId=(patient,evolution)=>JSON.stringify([JSON.stringify([null,'p',['id',patient]]),'evol',['id',evolution]]);
  const call=(name,body)=>OralCloud.request('/rest/v1/rpc/'+name,{method:'POST',body});
  const key=(patient,evolution)=>String(OralCloud.clinicId)+'|'+rowId(patient,evolution);
  async function status(patient,evolution,force=false){
    const k=key(patient,evolution);
    if(!force&&cache.has(k))return cache.get(k);
    const result=await call('nexodent_evolution_status',{p_clinic:OralCloud.clinicId,p_record_id:rowId(patient,evolution)});
    const value=Array.isArray(result)?result[0]:result;
    if(!value||typeof value.is_finalized!=='boolean')throw Error('Resposta inválida ao consultar a finalização.');
    cache.set(k,value);return value;
  }
  function mark(container,value){
    const del=container.querySelector('[data-act="rmevol"]');
    const btn=container.querySelector('[data-nexo-finalize]');
    if(value.is_finalized){
      if(del){del.disabled=true;del.hidden=true;}
      if(btn){btn.disabled=true;btn.textContent='🔒 Finalizada';btn.title='Finalizada em '+(value.finalized_at||'');}
    }else if(btn){btn.disabled=false;btn.textContent='🟠 Finalizar evolução';}
  }
  async function attach(){
    if(!ready()||typeof cur!=='function')return;
    const patient=cur();if(!patient?.id)return;
    const list=document.querySelectorAll('.evi [data-act="rmevol"]');
    for(const del of list){
      const container=del.closest('.evi');if(!container||container.dataset.nexoFinalizeInit)return;
      container.dataset.nexoFinalizeInit='1';
      const evolution=del.dataset.id;
      const btn=document.createElement('button');btn.type='button';btn.className='sm';
      btn.dataset.nexoFinalize='1';btn.textContent='Verificando...';btn.disabled=true;
      btn.style.cssText='background:#ea7000;color:#fff;margin-right:6px';
      del.before(btn);
      const owner=patient.id;
      btn.addEventListener('click',async()=>{
        if(!ready()){alert('Conecte-se ao Supabase para finalizar.');return;}
        btn.disabled=true;
        try{
          const state=await status(owner,evolution,true);
          if(state.is_finalized){mark(container,state);return;}
          if(!confirm('Finalizar esta evolução clínica permanentemente? Após a confirmação, o registro não poderá ser editado nem excluído.'))return;
          const result=await call('nexodent_finalize_evolution',{p_clinic:OralCloud.clinicId,p_record_id:rowId(owner,evolution)});
          const item=Array.isArray(result)?result[0]:result;
          if(!item?.finalized_at)throw Error('O Supabase não confirmou a finalização.');
          const finalized={is_finalized:true,finalized_at:item.finalized_at};cache.set(key(owner,evolution),finalized);
          mark(container,finalized);alert('Evolução finalizada e protegida no Supabase.');
        }catch(error){alert('Não foi possível finalizar: '+(error?.message||String(error)));}
        finally{if(!cache.get(key(owner,evolution))?.is_finalized)btn.disabled=false;}
      });
      status(owner,evolution).then(value=>mark(container,value)).catch(error=>{
        btn.textContent='Finalização indisponível';btn.title=error?.message||String(error);
        // Em caso de falha de consulta, a interface não deve autorizar exclusão.
        del.disabled=true;del.title='Não foi possível verificar a proteção deste registro.';
      });
    }
  }
  // Impede exclusão via clique mesmo se a interface estiver desatualizada.
  document.addEventListener('click',async event=>{
    const del=event.target.closest?.('[data-act="rmevol"]');
    if(!del||!ready())return;
    event.preventDefault();event.stopImmediatePropagation();
    const patient=typeof cur==='function'?cur():null;
    if(!patient?.id)return;
    try{
      const state=await status(patient.id,del.dataset.id,true);
      if(state.is_finalized){alert('Esta evolução está finalizada e não pode ser excluída.');return;}
      // A ação original é disparada somente após a consulta positiva ao servidor.
      if(typeof A!=='undefined'&&typeof A.rmevol==='function')A.rmevol(del,{id:del.dataset.id},patient);
      else alert('Não foi possível validar a ação de exclusão.');
    }catch(error){alert('Exclusão bloqueada: não foi possível verificar a finalização no Supabase. '+(error?.message||''));}
  },true);
  let pending=false;
  new MutationObserver(()=>{if(pending)return;pending=true;setTimeout(()=>{pending=false;attach();},100);}).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach);else attach();
})();
