/* NexoDent 143: upload de PDF NÃO ASSINADO para área privada de preparação.
 * A função Edge é a única responsável por validar autorização, calcular hash e armazenar.
 * Não vincula automaticamente ao prontuário e não comprova assinatura digital.
 */
(()=>{
  'use strict';
  const FN='nexodent-upload-assinatura-pdf';
  const TYPES=[['ANAMNESE','Anamnese'],['CONSENTIMENTO','Termo de consentimento'],['CONTRATO','Contrato'],['PLANO_TRATAMENTO','Plano de tratamento'],['ORCAMENTO','Orçamento'],['EVOLUCAO','Evolução clínica'],['OUTRO','Outro documento']];
  const state={clinic:null,allowed:false,pending:false};
  function cloudReady(){return !!(window.OralCloud?.enabled&&OralCloud.clinicId&&OralCloud.session&&OralCloud.config?.url);}
  async function permission(){
    if(!cloudReady())return false;
    const id=OralCloud.clinicId;
    if(state.clinic===id)return state.allowed;
    state.clinic=id;state.allowed=false;
    try{state.allowed=(await OralCloud.request('/rest/v1/rpc/nexodent_can_use_ecnpj',{method:'POST',body:{p_clinic:id}}))===true;}
    catch(e){console.warn('Permissão de upload indisponível:',e?.message||e);}
    return state.allowed;
  }
  function notify(message){if(typeof window.toast==='function')window.toast(message,5500);else alert(message);}
  async function upload(file,type,button,status){
    if(state.pending)return;
    if(!file||file.type!=='application/pdf'||file.size>10*1024*1024||file.size<5){notify('Selecione um PDF válido de até 10 MB.');return;}
    if(!cloudReady()||!(await permission())){notify('Apenas o administrador ativo pode enviar documentos para assinatura.');return;}
    state.pending=true;button.disabled=true;status.textContent='Enviando PDF ao Supabase...';
    try{
      // Atualiza token vencido pelo mecanismo de sessão do próprio NexoDent.
      await OralCloud.request('/auth/v1/user');
      const token=OralCloud.session?.access_token;
      if(!token)throw Error('Sessão inválida. Entre novamente.');
      const body=new FormData();body.append('file',file,file.name);body.append('clinic_id',OralCloud.clinicId);body.append('document_type',type);
      const base=OralCloud.config.url.replace(/\/$/,'');
      const response=await fetch(base+'/functions/v1/'+FN,{method:'POST',headers:{Authorization:'Bearer '+token,apikey:OralCloud.config.publishableKey},body,cache:'no-store'});
      const raw=await response.text();let result;try{result=JSON.parse(raw)}catch(_){result={error:raw.slice(0,150)||'Resposta inválida'};}
      if(!response.ok)throw Error((result?.error||'Erro no envio')+' (HTTP '+response.status+')');
      if(result?.status!=='STORED_UNSIGNED'||!result?.document_id||!/^[a-f0-9]{64}$/i.test(result?.sha256||''))throw Error('Resposta inesperada da função. Confira os registros no Supabase.');
      status.textContent='PDF armazenado, ainda NÃO assinado. ID: '+result.document_id+' · SHA-256: '+result.sha256;
      notify('PDF armazenado com sucesso. Ainda não foi assinado nem vinculado ao prontuário.');
    }catch(e){status.textContent='Falha: '+(e?.message||String(e));notify(status.textContent);}
    finally{state.pending=false;button.disabled=false;}
  }
  function modal(){
    const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;z-index:100001;background:#0009;display:flex;align-items:center;justify-content:center;padding:15px';
    const box=document.createElement('section');box.style.cssText='width:min(580px,100%);background:#fff;color:#222;border-radius:16px;padding:22px;box-shadow:0 18px 60px #0004';
    const h=document.createElement('h2');h.textContent='📄 Enviar PDF para assinatura';h.style.color='#db6b00';box.append(h);
    const note=document.createElement('p');note.textContent='Etapa de preparação: o PDF será armazenado em área privada, SEM assinatura e SEM vínculo automático com este paciente. Use apenas PDF fictício nos testes.';box.append(note);
    const label=document.createElement('label');label.textContent='Tipo de documento';label.style.display='block';
    const select=document.createElement('select');select.style.cssText='display:block;width:100%;padding:10px;margin:7px 0 15px';for(const [value,title] of TYPES){const option=document.createElement('option');option.value=value;option.textContent=title;select.append(option);}label.append(select);box.append(label);
    const fileLabel=document.createElement('label');fileLabel.textContent='Arquivo PDF (máximo 10 MB)';fileLabel.style.display='block';const input=document.createElement('input');input.type='file';input.accept='application/pdf,.pdf';input.style.cssText='display:block;width:100%;margin:8px 0 15px';fileLabel.append(input);box.append(fileLabel);
    const status=document.createElement('p');status.style.cssText='font-size:12px;overflow-wrap:anywhere';status.setAttribute('role','status');box.append(status);
    const send=document.createElement('button');send.type='button';send.textContent='🟠 Enviar PDF';send.style.cssText='background:#ea7200;color:white;padding:10px 16px;border:0;border-radius:8px;margin-right:8px';
    const close=document.createElement('button');close.type='button';close.textContent='Fechar';close.onclick=()=>{if(!state.pending)overlay.remove()};
    send.onclick=()=>upload(input.files?.[0],select.value,send,status);box.append(send,close);overlay.append(box);document.body.append(overlay);
  }
  const old=window.tabArquivos;
  if(typeof old!=='function')return;
  window.tabArquivos=function(patient){
    const html=old(patient);
    if(!cloudReady())return html;
    // Renderização da aba ocorre de forma síncrona; a permissão será checada antes de abrir.
    const slot='<div id="nexo-signature-upload-slot"></div>';
    return html.includes(slot)?html.replace(slot,'<div style="margin:14px 0;padding:12px;border:1px solid #f2b47e;border-radius:10px;background:#fff8f1"><strong>📄 Preparar PDF para assinatura</strong><p style="font-size:12px">Envio de teste ao Storage privado; ainda não vincula ao paciente e não assina.</p><button type="button" data-act="nexopdfupload" style="background:#e97713;color:white">📄 Enviar PDF para assinatura (administrador)</button></div>'):html;
  };
  // Captura o clique independentemente do roteador global A, que pode não
  // estar exposto em window quando este módulo é carregado.
  document.addEventListener('click', async (event) => {
    const button = event.target?.closest?.('[data-act="nexopdfupload"]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.disabled) return;
    button.disabled = true;
    try {
      if (!(await permission())) {
        notify('Acesso exclusivo do administrador ativo.');
        return;
      }
      modal();
    } catch (error) {
      notify('Não foi possível abrir o envio: ' + (error?.message || String(error)));
    } finally {
      button.disabled = false;
    }
  }, true);
})();
