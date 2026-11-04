(()=>{'use strict';
const el=()=>document.getElementById('integr-result');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const digits=s=>String(s??'').replace(/\D/g,'');
const norm=s=>String(s??'').trim().toLocaleLowerCase('pt-BR');
let seq=0;
function limpar(){seq++;if(el())el().textContent='Selecione um lead para consultar.'}
async function consultar(lead,clinicId,cloud){
 const target=el();if(!target||!clinicId||!cloud)return;
 const request=++seq;target.textContent='Consultando pacientes e agenda…';
 try{
  // Todas as consultas são restritas à clínica; o Supabase também aplica RLS.
  const url='clinic_id=eq.'+encodeURIComponent(clinicId);
  const patients=await cloud.request('/rest/v1/patients?'+url+'&select=id,nome,dados&limit=1000');
  if(request!==seq)return;
  const phone=digits(lead.phone);const name=norm(lead.name);
  // Não vincular automaticamente: nome ou telefone podem coincidir entre pessoas.
  const matches=(Array.isArray(patients)?patients:[]).filter(p=>{
    const pd=p.dados||{};const pn=digits(pd.tel);return (phone.length>=10&&pn.length>=10&&phone.slice(-10)===pn.slice(-10))||(name.length>=4&&norm(pd.nome||p.nome)===name);
  });
  const root=document.createElement('div');
  const heading=document.createElement('div');heading.className='warning';heading.textContent=matches.length?'Possíveis cadastros encontrados ('+matches.length+'). Confira os dados antes de vincular.':'Nenhum cadastro correspondente encontrado nesta consulta.';root.append(heading);
  if(patients.length===1000){const w=document.createElement('small');w.textContent='A consulta alcançou o limite de 1.000 registros. O resultado pode estar incompleto.';root.append(w)}
  if(matches.length){
   let appointments=[];let agendaError='';
   try{appointments=await cloud.request('/rest/v1/appointments?'+url+'&select=id,nome,status,patient_ref,dados&limit=1000')}catch(e){agendaError=e.message}
   if(request!==seq)return;
   for(const p of matches.slice(0,15)){
    const d=p.dados||{};const pid=String(d.id||p.id||'');
    const item=document.createElement('div');item.className='item';
    const title=document.createElement('strong');title.textContent=String(d.nome||p.nome||'Paciente sem nome');item.append(title);
    const sub=document.createElement('small');sub.textContent='Telefone cadastrado: '+String(d.tel||'não informado');item.append(sub);
    const linked=(Array.isArray(appointments)?appointments:[]).filter(a=>String(a.patient_ref||a.dados?.pid||'')===pid);
    const detail=document.createElement('small');detail.textContent='Agendamentos relacionados: '+linked.length+(linked.length?' • '+linked.slice(0,3).map(a=>[a.dados?.data||a.dados?.dt||'',a.dados?.hora||'',a.dados?.st||a.status||''].filter(Boolean).join(' ')).join(' | '):'');item.append(detail);root.append(item);
   }
   if(matches.length>15){const extra=document.createElement('small');extra.textContent='Exibindo os primeiros 15 resultados.';root.append(extra)}
   if(agendaError){const warn=document.createElement('small');warn.textContent='Agenda indisponível: '+agendaError;root.append(warn)}
  }
  const foot=document.createElement('small');foot.textContent='Orçamentos: vínculo com o paciente ainda não confirmado na estrutura atual. Nenhum orçamento foi associado automaticamente.';root.append(foot);
  target.replaceChildren(root);
 }catch(e){if(request===seq)target.textContent='Não foi possível consultar os dados: '+e.message}
}
window.NexoCRMIntegracao={consultar,limpar};
})();