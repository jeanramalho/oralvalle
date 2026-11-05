(()=>{'use strict';
const root=document.querySelector('.crm-insights');if(!root)return;
const el=id=>document.getElementById(id),cards=el('crm-insights-cards'),actions=el('crm-insights-actions'),quality=el('crm-insights-quality'),label=el('crm-insights-period-label'),period=el('crm-management-period');
let leads=[],clinic=null;
const fmt=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}),today=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
function parsed(v){if(!v)return null;const d=new Date(v);return Number.isNaN(d.valueOf())?null:d}
function month(d){return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`:''}
function rows(){const now=new Date(),key=period?.value||'all',selected=key==='month'?month(now):key==='previous'?month(new Date(now.getFullYear(),now.getMonth()-1,1)):null;return leads.filter(x=>!selected||month(parsed(x.created_at))===selected)}
const open=x=>x.stage!=='Fechado'&&x.stage!=='Perdida';
const value=x=>Math.max(0,Number(x.estimated_value)||0);
function card(title,n,sub){const e=document.createElement('div');e.className='crm-insights-card';for(const [tag,text] of [['span',title],['strong',n],['small',sub]]){const x=document.createElement(tag);x.textContent=String(text);e.append(x)}cards.append(e)}
function line(host,name,n){const e=document.createElement('div');e.className='crm-insights-line';const a=document.createElement('span'),b=document.createElement('strong');a.textContent=name;b.textContent=String(n);e.append(a,b);host.append(e)}
function draw(){const data=clinic?rows():[],active=data.filter(open),d=today(),now=Date.now();
const overdue=active.filter(x=>{const t=parsed(x.next_contact_at);return t&&t<d}),due=active.filter(x=>{const t=parsed(x.next_contact_at);return t&&t>=d&&t<new Date(d.getTime()+86400000)}),noDate=active.filter(x=>!x.next_contact_at),unassigned=active.filter(x=>!x.commercial_owner_id),stale=active.filter(x=>{const t=parsed(x.updated_at||x.created_at);return t&&now-t.getTime()>=7*86400000}),budgets=active.filter(x=>x.stage==='Orçamento');
const won=data.filter(x=>x.stage==='Fechado'),lost=data.filter(x=>x.stage==='Perdida'),total=data.length;
const noFollowUp=active.filter(x=>!x.next_contact_at&&!x.commercial_owner_id);
const sourceMissing=data.filter(x=>!String(x.source||'').trim());
cards.replaceChildren();actions.replaceChildren();quality.replaceChildren();
card('Fechamentos atuais',won.length,total?`${(won.length/total*100).toFixed(1).replace('.',',')}% da carteira`:'Sem oportunidades');
card('Valor estimado fechado',fmt.format(won.reduce((n,x)=>n+value(x),0)),'Não representa recebimentos');
card('Orçamentos em aberto',budgets.length,fmt.format(budgets.reduce((n,x)=>n+value(x),0))+' em negociação');
card('Oportunidades perdidas',lost.length,total?`${(lost.length/total*100).toFixed(1).replace('.',',')}% da carteira`:'Sem oportunidades');
line(actions,'1. Retornos vencidos — contatar primeiro',overdue.length);
line(actions,'2. Retornos agendados para hoje',due.length);
line(actions,'3. Sem atualização há 7 dias',stale.length);
line(actions,'4. Orçamentos ainda em negociação',budgets.length);
line(quality,'Oportunidades abertas sem data de retorno',noDate.length);
line(quality,'Oportunidades abertas sem responsável',unassigned.length);
line(quality,'Sem responsável e sem data',noFollowUp.length);
line(quality,'Oportunidades sem origem informada',sourceMissing.length);
label.textContent=period?.selectedOptions?.[0]?.textContent||'Todo o histórico';
}
period?.addEventListener('change',draw);
window.addEventListener('nexocrm:leads-loaded',e=>{clinic=e.detail?.clinicId||null;leads=clinic&&Array.isArray(e.detail?.leads)?e.detail.leads:[];draw()});draw();
})();
