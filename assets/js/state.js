/* Estado compartilhado pelas telas; carregado antes dos demais scripts. */
let db={p:[],lem:[]},view={id:null,tab:'dados',h:'ag',arq:false,sv:'dia',ag:'prox',pre:null,link:null},q='',delArm=null,mem=false,bad=false,dl=null;
const CHECKS=['Diabetes','Hipertensão','Problemas cardíacos','Alergia a anestésico','Alergia a penicilina','Anticoagulante','Gestante','Fumante','Problemas de coagulação'];
const ODO=[['Saudável','',''],['Cárie','s1','C'],['Restaurado','s2','R'],['Canal','s3','T'],['Extraído','s4','X'],['Implante','s5','I']];
const ARC={
  perm:[['Superior direito',[18,17,16,15,14,13,12,11]],['Superior esquerdo',[21,22,23,24,25,26,27,28]],['Inferior direito',[48,47,46,45,44,43,42,41]],['Inferior esquerdo',[31,32,33,34,35,36,37,38]]],
  dec:[['Superior direito',[55,54,53,52,51]],['Superior esquerdo',[61,62,63,64,65]],['Inferior direito',[85,84,83,82,81]],['Inferior esquerdo',[71,72,73,74,75]]]
};
const FORMAS=['Pix','Dinheiro','Débito','Crédito','Boleto','Outro'];
const STAT=['Agendado','Confirmado','Compareceu','Faltou','Cancelado'];
const MODOS=[['pct','Percentual do atendimento'],['fixo','Valor fixo do procedimento (se houver); senão percentual'],['nenhum','Sem comissão (sócio/dono)']];
const BASES=[['bruto','Sobre o valor total do atendimento'],['liq','Sobre o valor menos material e laboratório']];
const TERMO='Autorizo a clínica a tratar meus dados pessoais e de saúde (inclusive CPF, histórico de saúde, odontograma e esta assinatura) exclusivamente para atendimento, prontuário, agendamento e cobrança, conforme a LGPD (Lei 13.709/2018). Declaro que as informações da anamnese são verdadeiras.';

