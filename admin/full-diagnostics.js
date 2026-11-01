(()=>{'use strict';
// NexoDent 80: somente leitura; não chama operações de escrita nem executa código dos módulos.
const pane=document.getElementById('nx-diagnostics');if(!pane)return;
const box=document.createElement('section');box.style.marginTop='18px';
const title=document.createElement('h2');title.textContent='Diagnóstico consolidado — versão 80';
const info=document.createElement('p');info.textContent='Verifica disponibilidade e conteúdo básico de componentes. Não simula cadastros, pagamentos, assinaturas ou permissões do servidor. Nenhum dado clínico é alterado.';
const button=document.createElement('button');button.type='button';button.textContent='Executar diagnóstico consolidado';
const exportButton=document.createElement('button');exportButton.type='button';exportButton.className='secondary';exportButton.textContent='Exportar resultado JSON';exportButton.disabled=true;exportButton.style.marginLeft='8px';
const status=document.createElement('p');status.setAttribute('role','status');const results=document.createElement('div');
box.append(title,info,button,exportButton,status,results);pane.append(box);
const modules=[
 ['Pacientes','/assets/js/features/patients.js'],['Anamnese / permissões','/assets/js/features/permissions.js'],
 ['Agenda','/assets/js/features/appointments.js'],['Tratamentos','/assets/js/features/treatments.js'],
 ['Financeiro / pagamentos','/assets/js/features/payments.js'],['Comissões','/assets/js/features/commissions.js'],
 ['Laboratório','/assets/js/features/laboratory.js'],['Documentos / arquivos','/assets/js/features/cloud-files.js'],
 ['Prescrições','/assets/js/features/prescriptions.js'],['PDF','/assets/js/features/pdf.js'],
 ['Assinaturas','/assets/js/features/signatures.js'],['Assinatura de evolução','/assets/js/features/evolution-signing.js'],
 ['Certificados','/assets/js/features/certificates.js'],['Monitoramento','/assets/js/monitoring/client-errors.js'],
 ['Biblioteca PDF local','/assets/vendor/jspdf.umd.min.js'],['Admin: relatórios','/admin/version-reports.js']
];
let last=null;
async function checkFile(name,path){const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),8000);
 try{const res=await fetch(path,{method:'GET',credentials:'same-origin',cache:'no-store',signal:ctrl.signal});
 if(!res.ok)return {name,state:'falha',detail:'HTTP '+res.status};
 const type=(res.headers.get('content-type')||'').toLowerCase();const body=await res.text();
 const htmlLike=/^\s*(?:<!doctype html|<html\b)/i.test(body)||type.includes('text/html');
 if(htmlLike)return{name,state:'falha',detail:'Servidor retornou HTML no lugar de JavaScript'};
 if(!body.trim())return{name,state:'falha',detail:'Arquivo vazio'};
 return{name,state:'aprovado',detail:'Arquivo JavaScript disponível ('+body.length+' caracteres). Não comprova funcionamento.'};
 }catch(e){return{name,state:'falha',detail:e?.name==='AbortError'?'Tempo limite (8s)':'Falha de rede'};}finally{clearTimeout(timer)}}
button.addEventListener('click',async()=>{button.disabled=true;exportButton.disabled=true;results.replaceChildren();status.textContent='Verificando componentes...';
 const items=[];
 const elements=['nx-overview','nx-diagnostics','nx-errors','nx-reports','nx-clinics'];
 items.push({name:'Navegação administrativa',state:elements.every(id=>!!document.getElementById(id))?'aprovado':'falha',detail:'Estrutura das cinco abas (não simula cliques)'});
 items.push({name:'Cliente de requisições',state:typeof window.OralCloud?.request==='function'?'aprovado':'atenção',detail:'Disponibilidade local; não comprova autenticação ou autorização'});
 for(const [name,path] of modules)items.push(await checkFile(name,path));
 const counts={aprovado:0,atenção:0,falha:0};items.forEach(item=>{counts[item.state]++;const row=document.createElement('div');row.className='nx-result';row.textContent=(item.state==='aprovado'?'🟢':item.state==='falha'?'🔴':'🟡')+' '+item.name+' — '+item.detail;results.append(row)});
 last={suite:'NexoDent Admin — diagnóstico consolidado',version:'80',executed_at:new Date().toISOString(),scope:'somente leitura; disponibilidade de componentes e estrutura do painel',counts,items,limitations:['Não valida fluxos reais de cadastro, pagamentos, PDFs ou assinaturas','Não verifica políticas RLS ou permissões reais','Não garante ausência de bugs']};
 status.textContent=`${counts.aprovado} aprovados, ${counts.atenção} avisos, ${counts.falha} falhas. Testes funcionais reais ainda requerem ambiente isolado.`;
 exportButton.disabled=false;button.disabled=false;
 });
exportButton.addEventListener('click',()=>{if(!last)return;const blob=new Blob([JSON.stringify(last,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nexodent-diagnostico-80.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
})();
