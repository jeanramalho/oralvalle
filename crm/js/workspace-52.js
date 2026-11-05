(()=>{'use strict';
const list=document.getElementById('daily-list'),details=document.getElementById('crm-patient-details-52'),help=document.getElementById('crm-patient-help-52'),open=document.getElementById('crm-patient-open-52');
if(!list||!details||!open)return;
let selected=null;
const safe=s=>String(s??'');
const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=safe(value);return e};
function refresh(){const rows=Array.from(list.querySelectorAll('.daily-row'));rows.forEach((row,i)=>{row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-label','Selecionar '+(row.querySelector('strong')?.textContent||'paciente'));row.dataset.crmIndex=String(i);row.dataset.crmSelected=String(row===selected)});if(selected&&!rows.includes(selected)){selected=null;details.replaceChildren();help.textContent='Selecione um paciente da fila para visualizar os detalhes e iniciar o atendimento.';open.disabled=true}}
function select(row){if(!row)return;selected=row;refresh();const info=row.querySelector('strong')?.textContent||'Paciente';help.textContent=info;details.replaceChildren();const dl=document.createElement('dl');const fields=[['Situação',row.querySelectorAll('small')[0]?.textContent||'—'],['Próxima ação',row.querySelectorAll('small')[1]?.textContent||'—'],['Responsável e valor',row.querySelectorAll('small')[2]?.textContent||'—']];for(const [label,value] of fields){dl.append(text('dt',label),text('dd',value))}details.append(dl);open.disabled=false}
list.addEventListener('click',e=>{const row=e.target.closest('.daily-row');if(row&&list.contains(row))select(row)});
list.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('daily-row')){e.preventDefault();select(e.target)}});
open.addEventListener('click',()=>{if(!selected||!list.contains(selected))return;const button=selected.querySelector('.daily-row-actions button');button?.click()});
new MutationObserver(()=>queueMicrotask(refresh)).observe(list,{childList:true});refresh();
})();