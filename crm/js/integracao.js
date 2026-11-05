(()=>{'use strict';
const el=()=>document.getElementById('integr-result');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const digits=s=>String(s??'').replace(/\D/g,'');
// Somente valores numericos inequivocos sao exibidos como moeda.
// O campo legado dados.val pode conter datas ou textos, que nao sao valores financeiros.
const money=v=>{
 if(typeof v==='number')return Number.isFinite(v)?v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):null;
 const raw=String(v??'').trim();
 if(!raw||/^\d{4}-\d{2}-\d{2}(?:[T\s]|$)/.test(raw))return null;
 const cleaned=raw.replace(/^R\$\s*/i,'').replace(/\s/g,'');
 if(!/^-?[\d.,]+$/.test(cleaned))return null;
 let normalized=cleaned;
 if(cleaned.includes(',')&&cleaned.includes('.')){
  normalized=cleaned.lastIndexOf(',')>cleaned.lastIndexOf('.')?cleaned.replace(/\./g,'').replace(',','.'):cleaned.replace(/,/g,'');
 }else if(cleaned.includes(',')){
  normalized=cleaned.replace(',','.');
 }else if(/^\d{1,3}(?:\.\d{3})+$/.test(cleaned)){
  normalized=cleaned.replace(/\./g,'');
 }
 const n=Number(normalized);
 return Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):null;
};
// Exibe somente campos financeiros explícitos; nunca interpreta datas como valores.
// Mesmo modelo do NexoDent: budget_items guarda os procedimentos; dados.desc e desconto.
const amount=v=>{
 if(typeof v==='number')return Number.isFinite(v)?v:null;
 if(typeof v!=='string')return null;
 const raw=v.trim().replace(/^R\$\s*/i,'').replace(/\s/g,'');
 if(!raw||!/^\d[\d.,]*$/.test(raw))return null;
 let n=raw;
 if(n.includes(',')&&n.includes('.'))n=n.lastIndexOf(',')>n.lastIndexOf('.')?n.replace(/\./g,'').replace(',','.'):n.replace(/,/g,'');
 else if(n.includes(','))n=n.replace(',','.');
 else if(/^\d{1,3}(?:\.\d{3})+$/.test(n))n=n.replace(/\./g,'');
 const parsed=Number(n);return Number.isFinite(parsed)?parsed:null;
};
const budgetDetails=(b,byBudget)=>{
 const d=b.dados&&typeof b.dados==='object'?b.dados:{};
 const items=byBudget.get(String(b.id))||[];
 const names=items.filter(x=>x.kind==='object'&&x.slot==='itens').map(x=>x.dados).filter(x=>x&&typeof x==='object')
  .map(x=>String(x.proc||x.procedimento||x.nome||'').trim()).filter(Boolean);
 const financialItems=items.filter(x=>x.kind==='object'&&x.slot==='itens'&&Number(x.position)>=0);
 // Os registros kind=array, position=-1 sao marcadores da lista, nao procedimentos.
 // amount e o campo financeiro explicito; dados.valor e usado apenas como alternativa.
 const values=financialItems.map(x=>amount(x.amount)??amount(x.dados?.valor));
 const complete=financialItems.length>0&&values.every(v=>v!==null);
 const discount=amount(d.desc??0);
 const total=complete&&discount!==null&&values.length?Math.max(0,values.reduce((sum,v)=>sum+v,0)-discount):null;
 return {description:names.slice(0,3).join(' · ')||(items.length?'Procedimentos sem nome':'Sem procedimentos cadastrados'),
  value:total===null?'Valor não identificado':money(total)};
};
const loadItems=async(clinicId,cloud,budgets)=>{
 const ids=new Set(budgets.map(b=>String(b.id||'')).filter(Boolean));
 const result=new Map();
 if(!ids.size)return result;
 // Identificadores legados sao JSON com barras e aspas. Filtrar com
 // parent_id=in.(...) no PostgREST pode produzir correspondencias incompletas.
 // Consultamos os itens da clinica em paginas e vinculamos por igualdade exata.
 const pageSize=500,maxPages=20;
 for(let page=0;page<maxPages;page++){
  const offset=page*pageSize;
  const query='/rest/v1/budget_items?clinic_id=eq.'+encodeURIComponent(clinicId)+
   '&kind=eq.object&slot=eq.itens&position=gte.0'+
   '&select=parent_id,position,kind,slot,amount,dados&order=id.asc&limit='+pageSize+'&offset='+offset;
  const rows=await cloud.request(query);
  if(!Array.isArray(rows))throw new Error('Resposta inválida ao consultar itens dos orçamentos.');
  for(const row of rows){
   const key=String(row.parent_id||'');
   if(!ids.has(key))continue;
   if(!result.has(key))result.set(key,[]);
   result.get(key).push(row);
  }
  if(rows.length<pageSize)return result;
 }
 throw new Error('Limite de consulta de itens atingido. Valores não calculados para evitar dados incompletos.');
};
const budgetStatus=b=>{
 const candidates=[b.status,b.dados?.status];
 const values=candidates.map(v=>String(v??'').trim()).filter(v=>v&&!/^sem status$/i.test(v));
 return values[0]||'Não informado';
};
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
    const detail=document.createElement('small');detail.textContent='Agendamentos relacionados: '+linked.length+(linked.length?' • '+linked.slice(0,3).map(a=>[a.dados?.data||a.dados?.dt||'',a.dados?.hora||'',a.dados?.st||a.status||''].filter(Boolean).join(' ')).join(' | '):'');item.append(detail);
    // parent_id é texto JSON: [null,"p",["id",ID_DO_PACIENTE]]. A comparação exata evita cruzar pacientes.
    const parent=JSON.stringify([null,'p',['id',pid]]);
    const q='/rest/v1/budgets?clinic_id=eq.'+encodeURIComponent(clinicId)+'&parent_id=eq.'+encodeURIComponent(parent)+'&select=id,status,dados&limit=1000';
    const budgetTitle=document.createElement('strong');budgetTitle.textContent='Orçamentos';budgetTitle.style.display='block';budgetTitle.style.marginTop='9px';item.append(budgetTitle);
    try{
      const budgets=await cloud.request(q);
      if(request!==seq)return;
      const list=Array.isArray(budgets)?budgets:[];
      const itemsByBudget=await loadItems(clinicId,cloud,list);
      const summary=document.createElement('small');summary.textContent=list.length+' orçamento(s) relacionado(s)'+(list.length===1000?' (limite de consulta atingido)':'');item.append(summary);
      const pending=list.filter(b=>norm(budgetStatus(b)).includes('pendente'));
      if(pending.length){const tag=document.createElement('small');tag.className='warning';tag.textContent=pending.length+' orçamento(s) pendente(s) para acompanhamento';item.append(tag)}
      for(const b of list.slice(0,15)){
        const bd=b.dados||{};const row=document.createElement('small');
        const details=budgetDetails(b,itemsByBudget);
        row.textContent=[budgetStatus(b),details.description,details.value].filter(Boolean).join(' • ');
        item.append(row);
      }
      if(list.length>15){const more=document.createElement('small');more.textContent='Exibindo 15 de '+list.length+' orçamentos.';item.append(more)}
    }catch(e){const warn=document.createElement('small');warn.className='warning';warn.textContent='Orçamentos indisponíveis: '+e.message;item.append(warn)}
    root.append(item);
   }
   if(matches.length>15){const extra=document.createElement('small');extra.textContent='Exibindo os primeiros 15 resultados.';root.append(extra)}
   if(agendaError){const warn=document.createElement('small');warn.textContent='Agenda indisponível: '+agendaError;root.append(warn)}
  }
  const foot=document.createElement('small');foot.textContent='Consulta somente leitura. Correspondências por nome/telefone exigem conferência; nenhum vínculo automático foi criado.';root.append(foot);
  target.replaceChildren(root);
 }catch(e){if(request===seq)target.textContent='Não foi possível consultar os dados: '+e.message}
}

let pendingSeq=0;
async function listarPendentes(clinicId,cloud){
 const target=document.getElementById('pending-budgets');if(!target)return;
 const current=++pendingSeq;target.textContent='Consultando orçamentos pendentes…';
 try{
  const scope='clinic_id=eq.'+encodeURIComponent(clinicId);
  const [budgets,patients]=await Promise.all([
   cloud.request('/rest/v1/budgets?'+scope+'&select=id,parent_id,status,dados&limit=1000'),
   cloud.request('/rest/v1/patients?'+scope+'&select=id,nome,dados&limit=1000')
  ]);
  if(current!==pendingSeq)return;
  const all=Array.isArray(budgets)?budgets:[],ps=Array.isArray(patients)?patients:[];
  const byParent=new Map();
  for(const p of ps){const id=String(p.dados?.id||p.id||'');if(id)byParent.set(JSON.stringify([null,'p',['id',id]]),p)}
  const pending=all.filter(b=>norm(budgetStatus(b)).includes('pendente'));
  const itemsByBudget=await loadItems(clinicId,cloud,pending);
  if(current!==pendingSeq)return;
  const root=document.createElement('div');
  const summary=document.createElement('p');summary.textContent=pending.length+' orçamento(s) com status pendente encontrados nesta consulta.';root.append(summary);
  if(all.length===1000||ps.length===1000){const w=document.createElement('small');w.className='warning';w.textContent='Limite de 1.000 registros atingido: resultados podem estar incompletos.';root.append(w)}
  const seen=new Set();
  for(const b of pending.slice(0,60)){
   if(seen.has(String(b.id)))continue;seen.add(String(b.id));
   const row=document.createElement('div');row.className='item';
   const p=byParent.get(String(b.parent_id||''));
   const title=document.createElement('strong');title.textContent=p?String(p.dados?.nome||p.nome||'Paciente sem nome'):'Paciente não identificado (verificar vínculo)';row.append(title);
   const info=document.createElement('small');const d=b.dados||{};
   const details=budgetDetails(b,itemsByBudget);
   info.textContent=[budgetStatus(b),details.description,details.value].filter(Boolean).join(' • ');row.append(info);
   const ref=document.createElement('small');ref.textContent='Registro de orçamento identificado no NexoDent';row.append(ref);
   root.append(row);
  }
  if(pending.length>60){const more=document.createElement('small');more.textContent='Exibindo 60 de '+pending.length+' registros pendentes.';root.append(more)}
  const note=document.createElement('small');note.textContent='Somente leitura. Os valores exibidos não são somados ao funil e não criam leads.';root.append(note);
  target.replaceChildren(root);
 }catch(e){if(current===pendingSeq)target.textContent='Não foi possível consultar orçamentos: '+e.message}
}
function cancelarPendentes(){pendingSeq++;const target=document.getElementById('pending-budgets');if(target)target.textContent='Aguardando consulta…'}
window.NexoCRMIntegracao={consultar,limpar,listarPendentes,cancelarPendentes};
})();