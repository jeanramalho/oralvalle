/* ===== backup ===== */
const bkData=()=>JSON.stringify({app:'consultorio',v:2,exp:new Date().toISOString(),data:db});
function markBk(){db.meta.bk=new Date().toISOString();save()}
function bkHtml(){
  const acc=acHtml();
  const bk=db.meta.bk;
  return `<div class="card"><h2>Backup dos dados</h2><p class="sub" style="margin-bottom:8px">${bk?'Último backup: '+new Date(bk).toLocaleString('pt-BR'):'Nenhum backup feito ainda.'}</p>
  <p class="note" style="margin:0 0 12px">${db.p.length} paciente(s) e ${db.vd.length} venda(s) guardados neste navegador. Se limpar o navegador ou trocar de aparelho, tudo se perde. Faça backup toda semana. O arquivo contém CPF e dados de saúde: guarde em local seguro.</p>
  ${dl?'<button data-act="bksave" style="width:100%;margin-bottom:8px">Salvar arquivo de backup</button>':''}
  <button class="ghost" data-act="bktxt" style="width:100%">${view.bkt?'Ocultar texto do backup':'Mostrar texto do backup'}</button>
  ${view.bkt?`<textarea readonly id="bkt" aria-label="Texto do backup" style="margin-top:8px;font:12px/1.3 monospace;min-height:120px">${esc(bkData())}</textarea><button class="sm" data-act="bkcopy" style="margin-top:8px">Copiar texto</button>`:''}</div>
  <div class="card"><h2>Importar pacientes de outro sistema</h2>
  <p class="note" style="margin:0 0 8px">Importe uma lista de pacientes exportada do sistema antigo. Aceita arquivo CSV (Excel) ou JSON. Os pacientes serão adicionados sem apagar os dados atuais; registros com mesmo CPF, telefone ou nome serão ignorados para evitar duplicidade.</p>
  <label for="importPacFile" style="margin-top:0">Arquivo de pacientes (.csv ou .json)</label>
  <input id="importPacFile" type="file" accept=".csv,.txt,.json,text/csv,application/json">
  <p class="note">O arquivo deve conter, de preferência, colunas como Nome, Telefone, Data de nascimento, CPF e Observações. No CSV, use a primeira linha como cabeçalho.</p>
  </div>
  <div class="card"><h2>Restaurar backup</h2><p class="note" style="margin:0 0 8px">Escolha o arquivo ou cole o texto do backup. Restaurar substitui todos os dados atuais.</p>
  <label for="rstf" style="margin-top:0">Arquivo de backup</label><input id="rstf" type="file" accept=".json,application/json,text/plain">
  <label for="rst">Ou cole o texto aqui</label><textarea id="rst" style="font:12px/1.3 monospace">${esc(view.rst||'')}</textarea>
  <button class="${delArm==='rst'?'':'ghost'}" data-act="bkrst" style="width:100%;margin-top:12px">${delArm==='rst'?'Toque de novo para substituir TODOS os dados':'Restaurar dados'}</button></div>${acc}`;
}
function parseCSVPatients(text){
  const first=(text.split(/\r?\n/,1)[0]||'');
  const delim=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'&&quoted&&text[i+1]==='"'){field+='"';i++}
    else if(c==='"')quoted=!quoted;
    else if(c===delim&&!quoted){row.push(field.trim());field=''}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field.trim());if(row.some(v=>v!==''))rows.push(row);row=[];field=''}
    else field+=c;
  }
  row.push(field.trim());if(row.some(v=>v!==''))rows.push(row);
  if(rows.length<2)throw new Error('O CSV precisa ter cabeçalho e pelo menos um paciente.');
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const headers=rows.shift().map(norm);
  const find=(names)=>headers.findIndex(h=>names.some(n=>h===n||h.includes(n)));
  const ix={nome:find(['nomecompleto','nomepaciente','paciente','nome']),tel:find(['telefone','celular','whatsapp','fone','tel']),nasc:find(['datadenascimento','nascimento','datanasc']),cpf:find(['cpf']),obs:find(['observacoes','observacao','obs'])};
  if(ix.nome<0)throw new Error('Não encontrei a coluna Nome no cabeçalho do CSV.');
  return rows.map(r=>({nome:r[ix.nome]||'',tel:ix.tel>=0?(r[ix.tel]||''):'',nasc:ix.nasc>=0?(r[ix.nasc]||''):'',cpf:ix.cpf>=0?(r[ix.cpf]||''):'',obs:ix.obs>=0?(r[ix.obs]||''):''}));
}
function importPatients(records){
  if(!Array.isArray(records))throw new Error('O arquivo não contém uma lista de pacientes.');
  let added=0,skipped=0;
  const digits=v=>String(v||'').replace(/\D/g,'');
  const norm=v=>String(v||'').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  for(const r0 of records){
    const r=r0&&typeof r0==='object'?r0:{};
    const get=(names)=>{for(const k of Object.keys(r)){const nk=String(k).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');if(names.includes(nk))return r[k]}return ''};
    const nome=String(get(['nome','nomecompleto','nomepaciente','paciente'])||'').trim();
    if(!nome){skipped++;continue}
    const tel=String(get(['tel','telefone','celular','whatsapp','fone'])||'').trim();
    const cpf=String(get(['cpf','documento'])||'').trim();
    const nasc=String(get(['nasc','nascimento','datadenascimento','datanasc'])||'').trim();
    const obs=String(get(['obs','observacao','observacoes'])||'').trim();
    const duplicate=db.p.some(p=>(digits(cpf)&&digits(p.cpf)===digits(cpf))||(digits(tel)&&digits(p.tel)===digits(tel))||norm(p.nome)===norm(nome));
    if(duplicate){skipped++;continue}
    db.p.push({id:uid(),nome,tel:pvFmtTel(tel),nasc,cpf:pvFmtCpf(cpf),obs,orcs:[],trat:[],anam:{c:{},med:'',queixa:'',ultima:''},olog:[],dplan:[],evol:[],arq:false});
    added++;
  }
  if(!added){toast('Nenhum paciente novo importado. Verifique o arquivo ou possíveis duplicidades.',4000);return}
  save();view.h='pac';view.id=null;view.rst='';render();
  toast(`Importação concluída: ${added} adicionado(s), ${skipped} ignorado(s).`,5000);
}
function importPatientsFile(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const raw=String(reader.result||'');let records;
      if(/\.json$/i.test(file.name)||raw.trim().startsWith('{')||raw.trim().startsWith('[')){
        const parsed=JSON.parse(raw);
        records=Array.isArray(parsed)?parsed:(parsed.pacientes||parsed.patients||parsed.data?.pacientes||parsed.data?.patients||parsed.data?.p);
        if(!records&&Array.isArray(parsed.p))records=parsed.p;
        if(!Array.isArray(records))throw new Error('No JSON, preciso de uma lista chamada pacientes/patients ou de um backup que contenha a lista de pacientes.');
      }else records=parseCSVPatients(raw);
      importPatients(records);
    }catch(err){toast(err.message||'Não foi possível importar esse arquivo.',5000)}
  };
  reader.onerror=()=>toast('Não foi possível ler o arquivo selecionado.',3500);
  reader.readAsText(file,'UTF-8');
}
function restore(){
  let o;try{o=JSON.parse(view.rst||'')}catch(e){toast('Texto inválido: isto não é um backup.',3000);return}
  const d=(o&&o.app==='consultorio'&&o.data)?o.data:o;
  if(!d||!Array.isArray(d.p)){toast('Isto não parece um backup do consultório.',3000);return}
  if(delArm!=='rst'){delArm='rst';render();return}
  db=migrate(d);delArm=null;view.rst='';view.id=null;save();render();toast('Dados restaurados',2500);
}

