/* Preferência visual por navegador, sem gravar informações no banco da clínica. */
(function(){
  'use strict';
  const KEY='oralvalle:appearance:v1';
  function current(){try{return localStorage.getItem(KEY)==='dark'?'dark':'light'}catch(_){return 'light'}}
  function set(mode){
    const selected=mode==='dark'?'dark':'light';
    document.documentElement.setAttribute('data-ov-mode',selected);
    try{localStorage.setItem(KEY,selected)}catch(_){}
    document.querySelectorAll('[data-ov-theme-choice]').forEach(el=>{el.checked=el.value===selected});
  }
  set(current());
  document.addEventListener('change',function(e){
    if(e.target && e.target.matches('[data-ov-theme-choice]'))set(e.target.value);
  });
  window.addEventListener('storage',function(e){if(e.key===KEY)set(current())});
})();
