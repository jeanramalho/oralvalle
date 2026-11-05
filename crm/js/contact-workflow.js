(()=>{'use strict';
const form=document.getElementById('form'),dialog=document.getElementById('editor');
if(!form||!dialog)return;
const log=document.getElementById('contact_log'),type=document.getElementById('contact_type'),hint=document.getElementById('crm-contact-hint');
const date=form.elements.namedItem('next_contact_at');
if(!log||!type||!date)return;
function offset(days){if(days===''){date.value='';return}const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+Number(days));date.value=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function clearSelection(){document.querySelectorAll('[data-contact-result]').forEach(b=>b.setAttribute('aria-pressed','false'))}
document.querySelectorAll('[data-contact-result]').forEach(button=>button.addEventListener('click',()=>{
 const label=button.dataset.contactResult;
 // Do not overwrite a note written by the employee.
 if(log.value.trim()&&!window.confirm('Substituir o texto do novo contato pelo resultado selecionado?'))return;
 log.value=label;clearSelection();button.setAttribute('aria-pressed','true');
 if(button.dataset.contactDays!=='')offset(button.dataset.contactDays);
 else date.value='';
 hint.textContent=label==='Sem interesse'?'Registre o resultado e avalie marcar “Não deseja receber contatos comerciais”. Não altera automaticamente a etapa.':'Resultado preparado. Confira a data de retorno e clique em Salvar.';
 log.focus();
}));
document.querySelectorAll('[data-return-days]').forEach(button=>button.addEventListener('click',()=>{offset(button.dataset.returnDays);hint.textContent=date.value?'Retorno definido para '+date.value.split('-').reverse().join('/')+'. Salve para confirmar.':'Retorno removido. Salve para confirmar.'}));
// Editor is reused across patients; reset the visual selection without touching stored data.
const observer=new MutationObserver(()=>{if(dialog.open){clearSelection();hint.textContent='Selecione um resultado, ajuste a data e salve normalmente.'}});
observer.observe(dialog,{attributes:true,attributeFilter:['open']});
})();