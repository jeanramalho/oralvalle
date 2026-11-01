(()=>{'use strict';
const start=()=>{
 const pane=document.getElementById('nx-diagnostics');
 if(!pane||document.getElementById('nx-preventive-alerts'))return;
 const box=document.createElement('section');box.id='nx-preventive-alerts';box.style.marginTop='20px';
 const title=document.createElement('h2');title.textContent='Alertas preventivos — atualização 71';
 const info=document.createElement('p');info.textContent='Consulta manual, somente leitura, de até 100 eventos automáticos e ocorrências manuais. Não é monitoramento contínuo nem comprova a ausência de falhas.';
 const button=document.createElement('button');button.type='button';button.textContent='Verificar alertas';
 const status=document.createElement('p');status.setAttribute('role','status');
 const results=document.createElement('div');
 box.append(title,info,button,status,results);pane.appendChild(box);
 const add=(name,value)=>{const row=document.createElement('div');row.className='nx-result';const b=document.createElement('strong');b.textContent=name;row.append(b,document.createTextNode(' — '+value));results.appendChild(row)};
 button.addEventListener('click',async()=>{
  button.disabled=true;results.replaceChildren();status.textContent='Consultando registros...';
  try{
   if(!window.OralCloud||typeof window.OralCloud.request!=='function')throw Error('Conexão administrativa indisponível');
   const calls=await Promise.allSettled([
    window.OralCloud.request('/rest/v1/rpc/nexodent_admin_client_errors',{method:'POST',body:{p_limit:100}}),
    window.OralCloud.request('/rest/v1/rpc/nexodent_admin_incidents',{method:'POST',body:{p_action:'list',p_module:null,p_severity:null,p_description:null,p_id:null,p_status:null}})
   ]);
   const [a,b]=calls;const events=a.status==='fulfilled'&&Array.isArray(a.value)?a.value:null;
   const incidents=b.status==='fulfilled'&&Array.isArray(b.value)?b.value:null;
   if(!events)add('⚠️ Eventos automáticos','Consulta indisponível ou resposta inválida');
   if(!incidents)add('⚠️ Ocorrências manuais','Consulta indisponível ou resposta inválida');
   if(events){
    const recent=events.filter(e=>{const d=Date.parse(e.created_at);return Number.isFinite(d)&&d>=Date.now()-86400000});
    add(recent.length>=10?'🔴 Frequência elevada':recent.length?'🟡 Eventos recentes':'🟢 Sem eventos recentes na amostra',recent.length+' evento(s) nas últimas 24 horas (limite de 100 registros consultados)');
    const clinics=new Map();for(const e of events){const id=typeof e.clinic_id==='string'&&e.clinic_id?e.clinic_id:'Não identificada';clinics.set(id,(clinics.get(id)||0)+1)}
    add('Clínicas identificadas',String([...clinics.keys()].filter(k=>k!=='Não identificada').length));
    for(const [id,count] of [...clinics].sort((x,y)=>y[1]-x[1]).slice(0,5))add('Eventos por clínica',id+': '+count+' na amostra');
   }
   if(incidents){
    const open=incidents.filter(e=>!['corrigido','resolvido','closed','resolved'].includes(String(e.status||'').toLowerCase()));
    const severe=open.filter(e=>/critical|critico|crítico|alta|grave/.test(String(e.severity||'').toLowerCase()));
    add(severe.length?'🔴 Ocorrências graves abertas':'🟢 Sem ocorrências graves abertas na amostra',String(severe.length));
    add('Ocorrências abertas',String(open.length));
   }
   add('Comparação entre versões','Indisponível: os registros consultados não fornecem versão de origem confiável.');
   status.textContent=events&&incidents?'Consulta concluída.':'Consulta parcial: verifique as fontes indisponíveis.';
  }catch(_){status.textContent='Não foi possível executar a consulta.';}
  finally{button.disabled=false;}
 });
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
