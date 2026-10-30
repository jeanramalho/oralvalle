/* NexoDent: mensagens manuais de WhatsApp, sem API paga. */
(function(){
 const templates={
 consulta:n=>`Olá, ${n}! Tudo bem? Aqui é da clínica. Gostaríamos de confirmar sua próxima consulta. Pode nos confirmar sua presença?`,
 lembrete:n=>`Olá, ${n}! Passando para lembrar da sua consulta. Se precisar remarcar, responda por aqui.`,
 retorno:n=>`Olá, ${n}! Tudo bem? Gostaríamos de saber se deseja agendar seu retorno.`,
 pos:n=>`Olá, ${n}! Estamos entrando em contato para saber como você está após o atendimento. Se tiver alguma dúvida, estamos à disposição.`,
 aniversario:n=>`Feliz aniversário, ${n}! Desejamos muita saúde e alegrias!`,
 personalizada:n=>`Olá, ${n}! Tudo bem?`
 };
 function patient(){try{return typeof cur==='function'?cur():null}catch(_){return null}}
 function update(){const p=patient(),sel=document.getElementById('nexo-wa-template'),msg=document.getElementById('nexo-wa-msg');if(!p||!sel||!msg)return;const first=String(p.nome||'').trim().split(/\s+/)[0]||'paciente';msg.value=templates[sel.value](first)}
 document.addEventListener('change',e=>{if(e.target.id==='nexo-wa-template')update()});
 document.addEventListener('click',e=>{const b=e.target.closest('#nexo-wa-open,#nexo-wa-copy');if(!b)return;const p=patient(),msg=document.getElementById('nexo-wa-msg');if(!p||!msg)return;const value=msg.value.trim();if(!value){alert('Escreva uma mensagem primeiro.');return}if(b.id==='nexo-wa-copy'){if(typeof copy==='function')copy(value);else navigator.clipboard.writeText(value);return}const digits=String(p.tel||'').replace(/\D/g,'');if(digits.length!==10&&digits.length!==11&&!(digits.startsWith('55')&&(digits.length===12||digits.length===13))){alert('Cadastre um telefone válido com DDD nos dados do paciente.');return}waOpen(p.tel,value)});
 const obs=new MutationObserver(()=>{const sel=document.getElementById('nexo-wa-template'),msg=document.getElementById('nexo-wa-msg');if(sel&&msg&&!msg.dataset.nexoReady){msg.dataset.nexoReady='1';update()}});
 document.addEventListener('DOMContentLoaded',()=>obs.observe(document.body,{childList:true,subtree:true}));
})();
