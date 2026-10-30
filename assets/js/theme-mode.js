/* NexoDent 153 — aparência clara fixa em todos os dispositivos. */
(function(){
  'use strict';
  const ACCENT_KEY='nexodent:accent:device:v1';
  window.oralValleLocalAccent=function(){
    try {const c=localStorage.getItem(ACCENT_KEY);return /^#[0-9a-fA-F]{6}$/.test(c||'')?c:'#ff7a00'}
    catch(_){return '#ff7a00'}
  };
  window.oralValleSetLocalAccent=function(c){
    if(!/^#[0-9a-fA-F]{6}$/.test(c||''))return;
    try{localStorage.setItem(ACCENT_KEY,c)}catch(_){}
  };
  function enforceLight(){
    document.documentElement.setAttribute('data-ov-mode','light');
    document.documentElement.style.colorScheme='light';
  }
  enforceLight();
  // Mantém compatibilidade com chamadas antigas, sem permitir ativar o modo escuro.
  window.oralValleApplyTheme=function(){enforceLight()};
  document.addEventListener('DOMContentLoaded',enforceLight);
  window.addEventListener('pageshow',enforceLight);
})();
