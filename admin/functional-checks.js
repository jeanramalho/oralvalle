(()=>{'use strict';
// Verificações locais e não destrutivas. Nenhum teste grava no banco.
const pane=document.getElementById('nx-diagnostics');if(!pane)return;
const section=document.createElement('section');section.style.marginTop='18px';
const heading=document.createElement('h2');heading.textContent='Testes funcionais seguros';
const description=document.createElement('p');description.textContent='Testes de interface e disponibilidade, somente leitura. Não comprovam operações reais, permissões no servidor ou geração/assinatura de PDFs.';
const button=document.createElement('button');button.type='button';button.textContent='Executar testes seguros';
const status=document.createElement('p');status.setAttribute('role','status');
const results=document.createElement('div');section.append(heading,description,button,status,results);pane.appendChild(section);
const checks=[
 ['Navegação do Admin',()=>['overview','diagnostics','errors','reports','clinics'].every(n=>!!document.getElementById('nx-'+n)),'Presença dos painéis, sem clicar ou alterar a navegação'],
 ['Controles administrativos',()=>!!document.getElementById('nx-run')&&!!document.getElementById('nx-export'),'Botões de diagnóstico e exportação disponíveis'],
 ['Interface de autenticação',()=>typeof window.OralCloud?.request==='function','Cliente de requisições carregado; não valida permissões do servidor'],
 ['Registro de ocorrências',()=>!!document.getElementById('nx-incident-form')&&!!document.getElementById('nx-incident-list'),'Componentes da central de erros presentes'],
 ['Listagem de clínicas',()=>!!document.getElementById('clinics'),'Contêiner de clínicas presente']
];
const files=[['Agenda (arquivo)','/assets/js/features/appointments.js'],['Pacientes (arquivo)','/assets/js/features/patients.js'],['Laboratório (arquivo)','/assets/js/features/laboratory.js'],['Documentos e PDFs (arquivo)','/assets/js/features/cloud-files.js']];
function add(name,ok,detail){const row=document.createElement('div');row.className='nx-result '+(ok?'nx-ok':'nx-fail');row.textContent=(ok?'✓ ':'! ')+name+' — '+detail;results.appendChild(row);return ok?1:0}
async function exists(path){const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),6000);try{const response=await fetch(path,{method:'GET',cache:'no-store',credentials:'same-origin',signal:ctrl.signal});if(!response.ok)return false;const body=await response.text();return body.trim().length>0&&!/<\s*(?:!doctype\s+html|html|head|body)\b/i.test(body.slice(0,500))}catch{return false}finally{clearTimeout(timeout)}}
button.addEventListener('click',async()=>{button.disabled=true;results.replaceChildren();let passed=0;try{for(const [name,fn,detail] of checks){let ok=false;try{ok=!!fn()}catch{}passed+=add(name,ok,detail)}for(const [name,path] of files){passed+=add(name,await exists(path),'Verificação de arquivo; não executa o fluxo de trabalho')}status.textContent=`${passed} de ${checks.length+files.length} verificações aprovadas. Nenhum dado foi alterado.`}finally{button.disabled=false}});
})();
