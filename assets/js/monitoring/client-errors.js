/* NexoDent 66: telemetria minima. Nunca transmite mensagem, stack, URL ou dados clinicos. */
(()=>{'use strict';let sent=0;const seen=new Set();
function emit(kind){if(sent>=8||seen.has(kind))return;seen.add(kind);sent++;
  const send=()=>{if(typeof window.OralCloud?.request!=='function')return;
    window.OralCloud.request('/rest/v1/rpc/nexodent_report_client_error',{method:'POST',body:{p_kind:kind,p_area:'app'}}).catch(()=>{});
  };setTimeout(send,0);
}
window.addEventListener('error',e=>{if(e.target&&e.target!==window)return;emit('javascript')},true);
window.addEventListener('unhandledrejection',()=>emit('promise'));
})();
