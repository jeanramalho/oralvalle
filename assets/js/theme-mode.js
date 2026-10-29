/* Seleção de aparência por dispositivo. Não interfere em dados clínicos. */
(function(){
 'use strict';
 const KEY='oralvalle:appearance:v1';
 const ACCENT_KEY='nexodent:accent:device:v1';
 window.oralValleLocalAccent=function(){
   try {const c=localStorage.getItem(ACCENT_KEY);return /^#[0-9a-fA-F]{6}$/.test(c||'')?c:'#ff7a00'}catch(_){return '#ff7a00'}
 };
 window.oralValleSetLocalAccent=function(c){
   if(!/^#[0-9a-fA-F]{6}$/.test(c||''))return;
   try{localStorage.setItem(ACCENT_KEY,c)}catch(_){}
 };
 function saved(){try{return localStorage.getItem(KEY)==='dark'?'dark':'light'}catch(_){return 'light'}}
 function apply(mode,persist){
   const value=mode==='dark'?'dark':'light';
   document.documentElement.setAttribute('data-ov-mode',value);
   if(persist){try{localStorage.setItem(KEY,value)}catch(_){}}
   document.querySelectorAll('input[data-ov-theme-choice]').forEach(function(el){el.checked=el.value===value});
 }
 apply(saved(),false);
 // Captura a seleção antes dos delegadores globais da aplicação.
 document.addEventListener('change',function(event){
   const el=event.target;
   if(el && el.matches && el.matches('input[data-ov-theme-choice]'))apply(el.value,true);
 },true);
 document.addEventListener('click',function(event){
   const el=event.target;
   if(el && el.matches && el.matches('input[data-ov-theme-choice]'))apply(el.value,true);
 },true);
 window.addEventListener('storage',function(event){if(event.key===KEY)apply(saved(),false)});
 window.oralValleApplyTheme=apply;
})();
