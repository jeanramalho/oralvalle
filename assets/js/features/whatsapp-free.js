/* NexoDent: mensagens manuais de WhatsApp, sem API paga. */
(function(){
 const defaults={
 consulta:n=>`Olá, ${n}! Tudo bem? Aqui é da clínica. Gostaríamos de confirmar sua próxima consulta. Pode nos confirmar sua presença?`,
 lembrete:n=>`Olá, ${n}! Passando para lembrar da sua consulta. Se precisar remarcar, responda por aqui.`,
 retorno:n=>`Olá, ${n}! Tudo bem? Gostaríamos de saber se deseja agendar seu retorno.`,
 pos:n=>`Olá, ${n}! Estamos entrando em contato para saber como você está após o atendimento. Se tiver alguma dúvida, estamos à disposição.`,
 aniversario:n=>`Feliz aniversário, ${n}! Desejamos muita saúde e alegrias!`,
 personalizada:n=>`Olá, ${n}! Tudo bem?`
 };
 const STORAGE='nexodent_wa_templates_v1';
 function read(){try{const v=JSON.parse(localStorage.getItem(STORAGE)||'{}');return v&&typeof v==='object'?v:{}}catch(_){return {}}}
 function templates(){return Object.assign({},defaults,read())}
 function renderTemplate(key,name){const v=templates()[key];return typeof v==='string'?v.replaceAll('{nome}',name):v(name)}
 window.nexoWaSettingsHtml=function(){const saved=read();return `<div class="ov-page-head"><div><h1>WhatsApp</h1><p class="sub">Configure suas mensagens para envio manual e gratuito.</p></div></div><section class="card" style="border-top:4px solid #f97316"><h2>Modelos de mensagens</h2><p class="note">Use <strong>{nome}</strong> para inserir o primeiro nome do paciente. As alterações são salvas somente neste navegador. Não há sincronização entre computadores nem envio automático.</p>${Object.entries({consulta:'Confirmação de consulta',lembrete:'Lembrete',retorno:'Retorno',pos:'Pós-atendimento',aniversario:'Aniversário',personalizada:'Personalizada'}).map(([k,label])=>`<label for="wa-setting-${k}">${label}</label><textarea id="wa-setting-${k}" rows="3" data-wa-key="${k}">${escapeHtml(typeof saved[k]==='string'?saved[k]:defaults[k]('{nome}'))}</textarea>`).join('')}<div class="row" style="margin-top:15px;gap:10px;flex-wrap:wrap"><button type="button" id="wa-settings-save" style="background:#f97316;color:#fff">Salvar mensagens</button><button type="button" id="wa-settings-reset" class="ghost">Restaurar padrões</button></div><p class="note">O WhatsApp será aberto para revisão e envio manual. Não coloque informações clínicas sensíveis nas mensagens sem necessidade.</p></section>`};
 function escapeHtml(t){return String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function patient(){try{return typeof cur==='function'?cur():null}catch(_){return null}}
 function update(){const p=patient(),sel=document.getElementById('nexo-wa-template'),msg=document.getElementById('nexo-wa-msg');if(!p||!sel||!msg)return;const first=String(p.nome||'').trim().split(/\s+/)[0]||'paciente';msg.value=renderTemplate(sel.value,first)}
 document.addEventListener('change',e=>{if(e.target.id==='nexo-wa-template')update()});
 document.addEventListener('click',e=>{
 if(e.target.closest('#wa-settings-save')){const next={};document.querySelectorAll('[data-wa-key]').forEach(el=>next[el.dataset.waKey]=el.value);try{localStorage.setItem(STORAGE,JSON.stringify(next));alert('Mensagens salvas neste navegador.')}catch(_){alert('Não foi possível salvar neste navegador.')}return}
 if(e.target.closest('#wa-settings-reset')){if(!confirm('Restaurar todas as mensagens padrão?'))return;localStorage.removeItem(STORAGE);if(typeof render==='function')render();return}
 const b=e.target.closest('#nexo-wa-open,#nexo-wa-copy');if(!b)return;const p=patient(),msg=document.getElementById('nexo-wa-msg');if(!p||!msg)return;const value=msg.value.trim();if(!value){alert('Escreva uma mensagem primeiro.');return}if(b.id==='nexo-wa-copy'){if(typeof copy==='function')copy(value);else navigator.clipboard.writeText(value);return}const digits=String(p.tel||'').replace(/\D/g,'');if(digits.length!==10&&digits.length!==11&&!(digits.startsWith('55')&&(digits.length===12||digits.length===13))){alert('Cadastre um telefone válido com DDD nos dados do paciente.');return}waOpen(p.tel,value)});
 const obs=new MutationObserver(()=>{const sel=document.getElementById('nexo-wa-template'),msg=document.getElementById('nexo-wa-msg');if(sel&&msg&&!msg.dataset.nexoReady){msg.dataset.nexoReady='1';update()}});
 document.addEventListener('DOMContentLoaded',()=>obs.observe(document.body,{childList:true,subtree:true}));
})();
