(()=>{'use strict';
const root=document.querySelector('.crm-operations');if(!root)return;
const $=id=>document.getElementById(id), labels={overdue:'Retorno atrasado',no_date:'Sem próximo contato',no_owner:'Sem responsável',no_origin:'Sem origem',stale:'Sem atualização há 7 dias'};
let clinic=null,leads=[];
const fmt=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const date=v=>{if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d};
const day=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
function audit(x){if(x.stage==='Fechado'||x.stage==='Perdida')return [];
 const flags=[],now=day(),next=date(x.next_contact_at),updated=date(x.updated_at||x.created_at);
 if(next&&next<now)flags.push('overdue');if(!next)flags.push('no_date');
 if(!x.commercial_owner_id)flags.push('no_owner');if(!String(x.source||x.origin||'').trim())flags.push('no_origin');
 if(updated&&now-updated>=7*86400000)flags.push('stale');return flags;
}
function text(tag,value){const e=document.createElement(tag);e.textContent=String(value??'');return e}
function data(){return leads.map(x=>({x,flags:audit(x)})).filter(r=>r.flags.length)}
function selected(){const f=$('ops-filter').value,q=$('ops-search').value.trim().toLocaleLowerCase('pt-BR');return data().filter(r=>(f==='all'||r.flags.includes(f))&&(!q||String(r.x.name||r.x.patient_name||'').toLocaleLowerCase('pt-BR').includes(q)))}
function draw(){const all=data(),metrics=$('ops-metrics'),body=$('ops-rows');metrics.replaceChildren();body.replaceChildren();
 for(const [key,title] of [['all','Com pendências'],...Object.entries(labels).map(([k,v])=>[k,v])]){const card=document.createElement('div');card.append(text('span',title),text('strong',key==='all'?all.length:all.filter(r=>r.flags.includes(key)).length));metrics.append(card)}
 const rows=selected();$('ops-count').textContent=rows.length+' oportunidade(s) com pendências neste filtro.';
 for(const {x,flags} of rows.slice(0,150)){const tr=document.createElement('tr');tr.append(text('td',x.name||x.patient_name||'Sem nome'),text('td',x.stage||'—'));const td=document.createElement('td'),tags=document.createElement('div');tags.className='ops-tags';flags.forEach(f=>tags.append(text('em',labels[f])));td.append(tags);tr.append(td,text('td',x.next_contact_at?String(x.next_contact_at).slice(0,10).split('-').reverse().join('/'):'—'),text('td',fmt.format(Math.max(0,Number(x.estimated_value)||0))));body.append(tr)}
 if(rows.length>150){const tr=document.createElement('tr'),td=text('td','Exibindo 150 de '+rows.length+'. Use os filtros ou exporte o CSV.');td.colSpan=5;tr.append(td);body.append(tr)}
 if(!rows.length){const tr=document.createElement('tr'),td=text('td','Nenhuma pendência neste filtro.');td.colSpan=5;tr.append(td);body.append(tr)}
}
function csvCell(v){let s=String(v??'');if(/^[\s\u0000-\u001f]*[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
function exportCsv(){const lines=[['Paciente','Etapa','Pendências','Próximo contato','Valor estimado']];selected().forEach(({x,flags})=>lines.push([x.name||x.patient_name||'',x.stage||'',flags.map(f=>labels[f]).join('; '),String(x.next_contact_at||'').slice(0,10),Math.max(0,Number(x.estimated_value)||0).toFixed(2)]));const blob=new Blob(['\ufeff'+lines.map(r=>r.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='nexodent-pendencias-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
$('ops-filter').addEventListener('change',draw);$('ops-search').addEventListener('input',draw);$('ops-export').addEventListener('click',exportCsv);
function visibility(){root.hidden=document.querySelector('[data-crm-view="followup"]')?.getAttribute('aria-selected')!=='true'}
new MutationObserver(visibility).observe(document.getElementById('crm-tab-followup'),{attributes:true,attributeFilter:['aria-selected']});visibility();
window.addEventListener('nexocrm:leads-loaded',e=>{const d=e.detail||{};clinic=d.clinicId||null;leads=Array.isArray(d.leads)?d.leads:[];draw()});draw();
})();