(()=>{'use strict';
const root=document.querySelector('.crm-management');if(!root)return;
const cards=document.getElementById('crm-management-cards'),funnel=document.getElementById('crm-management-funnel'),health=document.getElementById('crm-management-health'),period=document.getElementById('crm-management-period');
let current=[];const stages=['Novo lead','Contatado','Agendado','Avaliado','Orçamento','Fechado','Perdida'];
const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const day=v=>{if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d};
function draw(){const now=new Date(),first=new Date(now.getFullYear(),now.getMonth(),1),last=new Date(now.getFullYear(),now.getMonth()-1,1);
const rows=current.filter(x=>{const d=day(x.created_at);if(period.value==='all')return true;if(!d)return false;return period.value==='month'?d>=first:d>=last&&d<first});
const active=rows.filter(x=>x.stage!=='Fechado'&&x.stage!=='Perdida'),won=rows.filter(x=>x.stage==='Fechado'),lost=rows.filter(x=>x.stage==='Perdida');
const sum=arr=>arr.reduce((a,x)=>a+(Number(x.estimated_value)||0),0);
const due=active.filter(x=>{const d=day(x.next_contact_at);return d&&d<new Date(now.getFullYear(),now.getMonth(),now.getDate())});
const unassigned=active.filter(x=>!x.commercial_owner_id);
const stalled=active.filter(x=>{const d=day(x.updated_at||x.created_at);return d&&(now-d)>=7*86400000});
const rate=rows.length?won.length/rows.length*100:0;
const data=[['Oportunidades',rows.length,'Criadas no período'],['Em negociação',active.length,'Etapas ainda abertas'],['Fechadas',won.length,'Etapa atual: Fechado'],['Conversão da carteira',rate.toFixed(1).replace('.',',')+'%','Fechadas / oportunidades'],['Valor fechado estimado',money(sum(won)),'Não é receita recebida'],['Valor em negociação',money(sum(active)),'Soma dos valores estimados']];
cards.replaceChildren(...data.map(([label,value,help])=>{const c=document.createElement('div');c.className='crm-management-card';for(const [tag,txt] of [['span',label],['strong',String(value)],['small',help]]){const e=document.createElement(tag);e.textContent=txt;c.append(e)}return c}));
function line(label,value,max,host){const wrap=document.createElement('div'),row=document.createElement('div'),a=document.createElement('span'),b=document.createElement('strong'),track=document.createElement('div'),fill=document.createElement('div');row.className='crm-management-row';a.textContent=label;b.textContent=String(value);row.append(a,b);track.className='crm-management-track';fill.className='crm-management-fill';fill.style.width=(max?Math.max(0,Math.min(100,value/max*100)):0)+'%';track.append(fill);wrap.append(row,track);host.append(wrap)}
funnel.replaceChildren();for(const stage of stages)line(stage,rows.filter(x=>x.stage===stage).length,Math.max(1,rows.length),funnel);
health.replaceChildren();for(const [label,arr] of [['Retornos atrasados',due],['Sem responsável',unassigned],['Sem atualização há 7 dias',stalled],['Oportunidades perdidas',lost]])line(label,arr.length,Math.max(1,rows.length),health);
}
period.addEventListener('change',draw);
window.addEventListener('nexocrm:leads-loaded',e=>{current=Array.isArray(e.detail?.leads)?e.detail.leads:[];draw()});
})();