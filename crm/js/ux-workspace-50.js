(()=>{'use strict';
// Somente navegação e foco. Não modifica formulários, requisições ou registros.
const quick=Array.from(document.querySelectorAll('[data-quick-view]'));
const tabs=Array.from(document.querySelectorAll('.crm-view-tabs [data-crm-view]'));
const search=document.getElementById('search');
function sync(){const selected=tabs.find(t=>t.getAttribute('aria-selected')==='true');quick.forEach(b=>{if(b.dataset.quickView===selected?.dataset.crmView)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')})}
function navigate(view){const tab=tabs.find(t=>t.dataset.crmView===view);if(!tab)return;tab.click();sync();const main=document.querySelector('.crm-view-tabs');if(main&&window.matchMedia('(max-width:780px)').matches)main.scrollIntoView({behavior:'smooth',block:'start'})}
quick.forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.quickView)));
document.getElementById('crm-quick-search')?.addEventListener('click',()=>{navigate('opportunities');search?.focus();search?.select()});
const observer=new MutationObserver(sync);tabs.forEach(t=>observer.observe(t,{attributes:true,attributeFilter:['aria-selected']}));sync();
document.addEventListener('keydown',e=>{if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.shiftKey)return;const target=e.target;if(target?.closest?.('input,textarea,select,[contenteditable="true"]')||document.querySelector('dialog[open]'))return;
if(e.altKey&&/^[1-4]$/.test(e.key)){e.preventDefault();navigate(['overview','opportunities','followup','reports'][Number(e.key)-1])}
else if(!e.altKey&&e.key==='/'){e.preventDefault();navigate('opportunities');search?.focus();search?.select()}
});
})();
