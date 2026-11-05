(()=>{'use strict';
// Somente alterna a visibilidade das seções existentes; não move nem recria nós.
const views={
 overview:['.metrics','.crm-priorities'],
 opportunities:['.board-heading','#board','#pending-budgets'],
 followup:['.followups','.crm-tasks','.recovery','.crm-daily'],
 reports:['.crm-productivity','.employee-performance','.sales-report']
};
const app=document.getElementById('app'),panel=document.getElementById('crm-view-panel');
const tabs=Array.from(document.querySelectorAll('.crm-view-tabs [data-crm-view]'));
if(!app||!panel||tabs.length!==4)return;
// Orçamentos pendentes e consulta integrada ficam na área Oportunidades.
const children=Array.from(panel.children);
const sections={
 overview:children.filter(n=>n.matches('.metrics,.crm-priorities,.crm-goals')),
 opportunities:children.filter(n=>n.matches('.board-heading,#board')||n.matches('section')&&!!n.querySelector('#pending-budgets,#integr-result')),
 followup:children.filter(n=>n.matches('.followups,.crm-tasks,.recovery,.crm-daily')),
 reports:children.filter(n=>n.matches('.crm-productivity,.employee-performance,.sales-report'))
};
function activate(name,focus=false){
 if(!sections[name])return;
 for(const [key,nodes] of Object.entries(sections))for(const node of nodes)node.hidden=key!==name;
 for(const tab of tabs){const selected=tab.dataset.crmView===name;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;if(selected){panel.setAttribute('aria-labelledby',tab.id);if(focus)tab.focus();}}
 try{sessionStorage.setItem('nexodent-crm-view',name)}catch(_){ }
}
for(const tab of tabs){tab.addEventListener('click',()=>activate(tab.dataset.crmView));tab.addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();const i=tabs.indexOf(tab),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;activate(tabs[next].dataset.crmView,true)})}
let initial='overview';try{initial=sessionStorage.getItem('nexodent-crm-view')||initial}catch(_){ }
activate(initial);
})();
