'use strict';
// Política conservadora: certificados de pessoa jurídica permanecem bloqueados
// até existir autorização administrativa verificada no servidor.
const CNPJ_OID = '2.16.76.1.3.3'; // ICP-Brasil: CNPJ da pessoa jurídica
function isCorporateCertificate(cert, forge) {
  if (!cert || !forge) throw new Error('Certificado não disponível para classificação');
  const attrs = [...(cert.subject?.attributes || []), ...(cert.issuer?.attributes || [])];
  const subject = (cert.subject?.attributes || []).map(a => String(a.value || '')).join(' ');
  if (/(?:^|\D)\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}(?:\D|$)/.test(subject)) return true;
  // Atributos customizados e extensões ASN.1 podem carregar CNPJ sem pontuação.
  if (attrs.some(a => a.type === CNPJ_OID)) return true;
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const oid = forge.asn1.oidToDer(CNPJ_OID).getBytes();
  return der.includes(oid);
}
module.exports = { isCorporateCertificate };
