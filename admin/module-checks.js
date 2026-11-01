(()=>{'use strict';
// Diagnóstico adicional isolado: não altera dados nem funções existentes.
const pane=document.getElementById('nx-diagnostics');if(!pane)return;
const box=document.createElement('section');box.style.marginTop='18px';
const title=document.createElement('h2');title.textContent='Verificação de módulos (somente leitura)';
const info=document.createElement('p');info.textContent='Confere a disponibilidade de arquivos dos módulos. Não testa cadastro, assinatura, cálculos ou permissões reais.';
const button=document.createElement('button');button.type='button';button.textContent='Verificar módulos';
const status=document.createElement('p');status.setAttribute('role','status');
const results=document.createElement('div');
box.append(title,info,button,status,results);pane.appendChild(box);
const modules=[
 ['Pacientes','/assets/js/features/patients.js'],
 ['Agenda','/assets/js/features/appointments.js'],
 ['Laboratório','/assets/js/features/laboratory.js'],
 ['Documentos e PDFs','/assets/js/features/cloud-files.js']
];
button.addEventListener('click',async()=>{
 button.disabled=true;results.replaceChildren();let ok=0;
 try{for(const [name,path] of modules){let detail='';let passed=false;
  try{const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),7000);
   let response;try{response=await fetch(path,{cache:'no-store',credentials:'same-origin',signal:ctrl.signal})}finally{clearTimeout(timer)}
   const type=response.headers.get('content-type')||'';
   const body=response.ok?await response.text():'';
   passed=response.ok&&body.trim().length>0&&!/<\s*(?:!doctype\s+html|html|head|body)\b/i.test(body.slice(0,500));
   detail=passed?'Arquivo disponível':'Não confirmado (HTTP '+response.status+')';
  }catch(e){detail=e.name==='AbortError'?'Tempo limite':'Falha de acesso ao arquivo'}
  if(passed)ok++;const row=document.createElement('div');row.className='nx-result '+(passed?'nx-ok':'nx-fail');row.textContent=(passed?'✓ ':'! ')+name+' — '+detail;results.appendChild(row);
 }status.textContent=ok+' de '+modules.length+' arquivos confirmados. Isso não garante funcionamento dos módulos.';
 }finally{button.disabled=false}
});
})();