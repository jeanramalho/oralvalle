/* Histórico individual de evolução: leitura autenticada via RPC; sem acesso direto à tabela privada. */
(()=>{
  const ready=()=>!!(window.OralCloud?.enabled&&OralCloud.clinicId&&typeof OralCloud.request==='function');
  const rowId=(patient,evolution)=>JSON.stringify([JSON.stringify([null,'p',['id',patient]]),'evol',['id',evolution]]);
  const formatDate=value=>{if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});};
  const text=(tag,value)=>{const node=document.createElement(tag);node.textContent=value==null?'—':String(value);return node;};
  function showModal(){
    const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.68);z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px';
    const panel=document.createElement('section');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Histórico de auditoria da evolução');panel.style.cssText='background:var(--card,#fff);color:var(--text,#222);border-radius:14px;max-width:680px;width:100%;max-height:85vh;overflow:auto;padding:20px;box-shadow:0 12px 45px #0006';
    const head=document.createElement('div');head.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:12px';
    const title=text('h2','📋 Histórico de auditoria');title.style.cssText='margin:0;color:#ea7000;font-size:20px';
    const close=text('button','Fechar ✕');close.type='button';close.className='sm';close.style.cssText='background:#ea7000;color:#fff';
    head.append(title,close);panel.append(head);overlay.append(panel);document.body.append(overlay);
    const previous=document.activeElement;const onKey=e=>{if(e.key==='Escape')dismiss();};
    function dismiss(){document.removeEventListener('keydown',onKey);overlay.remove();previous?.focus?.();}
    close.addEventListener('click',dismiss);overlay.addEventListener('click',e=>{if(e.target===overlay)dismiss();});document.addEventListener('keydown',onKey);close.focus();
    return panel;
  }
  async function openHistory(patient,evolution){
    const panel=showModal();const state=text('p','Consultando histórico no Supabase...');panel.append(state);
    try{
      if(!ready())throw Error('Conecte-se ao Supabase para consultar o histórico.');
      const rows=await OralCloud.request('/rest/v1/rpc/nexodent_evolution_audit_history',{method:'POST',body:{p_clinic:OralCloud.clinicId,p_evolution_id:rowId(patient,evolution)}});
      if(!Array.isArray(rows))throw Error('Resposta inválida da consulta de auditoria.');
      state.remove();
      if(!rows.length){panel.append(text('p','Nenhum evento de auditoria encontrado para esta evolução.'));return;}
      const first=rows[0];
      const info=document.createElement('div');info.style.cssText='padding:12px;background:rgba(234,112,0,.08);border-radius:8px;margin:14px 0;overflow-wrap:anywhere';
      for(const [label,value] of [['Dentista vinculado',first.dentist_name||'Não identificado'],['CRO',first.dentist_cro||'Não informado'],['Finalizada em',formatDate(first.finalized_at)],['Hash SHA-256',first.sha256||'Não disponível']]){
        const line=document.createElement('div');line.style.margin='5px 0';const strong=text('strong',label+': ');line.append(strong,text('span',value));info.append(line);
      }
      panel.append(info);
      const subtitle=text('h3','Eventos registrados');subtitle.style.cssText='font-size:16px;margin:14px 0 8px';panel.append(subtitle);
      for(const row of rows){
        const event=document.createElement('div');event.style.cssText='border-left:3px solid #ea7000;padding:9px 12px;margin:9px 0;background:rgba(127,127,127,.07);border-radius:5px;overflow-wrap:anywhere';
        const name=text('strong',row.action||'Evento');name.style.color='#ea7000';event.append(name);
        event.append(text('div','Data: '+formatDate(row.changed_at)));
        event.append(text('div','Usuário responsável (ID): '+(row.changed_by||'Não identificado')));
        panel.append(event);
      }
      panel.append(text('p','Histórico somente para consulta. O dentista vinculado à evolução pode ser diferente do usuário que realizou cada evento.'));
    }catch(err){state.textContent='Não foi possível consultar o histórico: '+(err?.message||String(err));}
  }
  function attach(){
    if(typeof cur!=='function')return;const patient=cur();if(!patient?.id)return;
    document.querySelectorAll('.evi [data-act="rmevol"]').forEach(del=>{
      const container=del.closest('.evi');if(!container)return;
      const existing=container.querySelector('[data-nexo-history]');
      if(existing){if(existing.dataset.patient===String(patient.id)&&existing.dataset.evolution===String(del.dataset.id))return;existing.remove();}
      const btn=text('button','📋 Ver histórico');btn.type='button';btn.className='ghost sm';btn.dataset.nexoHistory='1';btn.dataset.patient=String(patient.id);btn.dataset.evolution=String(del.dataset.id);btn.style.cssText='margin-right:6px;border-color:#ea7000;color:#ea7000';
      btn.addEventListener('click',()=>openHistory(btn.dataset.patient,btn.dataset.evolution));del.before(btn);
    });
  }
  let pending=false;new MutationObserver(()=>{if(pending)return;pending=true;setTimeout(()=>{pending=false;attach();},120);}).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach);else attach();
})();
