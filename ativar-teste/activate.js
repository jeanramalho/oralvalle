(() => { 'use strict';
 const $=id=>document.getElementById(id); const message=t=>$('message').textContent=t;
 async function activate(){
   const result=await OralCloud.request('/rest/v1/rpc/nexodent_activate_approved_trial',{method:'POST',body:{}});
   message('Teste ativado! Seus 15 dias começaram agora. Acesse o Nexodent com esta conta.');
   return result;
 }
 $('register').onclick=async()=>{
   try{ if($('senha').value.length<8)throw Error('A senha precisa ter pelo menos 8 caracteres.');
     await OralCloud.signup($('nome').value.trim(),$('email').value.trim(),$('senha').value);
     message('Cadastro enviado. Confirme seu e-mail e volte aqui para entrar e ativar o teste.');
   }catch(e){message(e.message)}
 };
 $('enter').onclick=async()=>{
   try{await OralCloud.login($('email').value.trim(),$('senha').value,false);await activate()}
   catch(e){message(e.message)}
 };
 OralCloud.restoreSession().then(s=>{if(s)return activate()}).catch(e=>message(e.message));
})();