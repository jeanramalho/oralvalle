'use strict';
// Inspeção transitória de PKCS#12: não assina, não persiste e não registra segredos.
const forge = require('node-forge');
const MAX = 1024 * 1024; // 1 MiB
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({error:'Método não permitido'}); }
  const auth = String(req.headers.authorization || '');
  const base = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!base || !anon) return res.status(503).json({error:'Autenticação não configurada no servidor'});
  if (!/^Bearer [\w.\-]+$/.test(auth)) return res.status(401).json({error:'Sessão necessária'});
  try {
    const verify = await fetch(base.replace(/\/$/,'')+'/auth/v1/user', {headers:{apikey:anon,Authorization:auth},signal:AbortSignal.timeout(8000)});
    if (!verify.ok) return res.status(401).json({error:'Sessão inválida'});
    const user = await verify.json();
    if (!user.id) return res.status(401).json({error:'Sessão inválida'});
    const {pfxBase64, password} = req.body || {};
    if (typeof pfxBase64 !== 'string' || typeof password !== 'string' || pfxBase64.length > Math.ceil(MAX*4/3)+8 || password.length>512) return res.status(400).json({error:'Dados inválidos ou arquivo acima de 1 MB'});
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(pfxBase64)) return res.status(400).json({error:'Arquivo inválido'});
    const raw = Buffer.from(pfxBase64,'base64');
    if (!raw.length || raw.length>MAX) return res.status(400).json({error:'Arquivo inválido ou muito grande'});
    let p12;
    try { p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(raw.toString('binary')), false, password); }
    catch (_) { return res.status(422).json({error:'Não foi possível abrir o certificado. Verifique a senha e o arquivo.'}); }
    const certs = p12.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag] || [];
    const keys = [forge.pki.oids.pkcs8ShroudedKeyBag,forge.pki.oids.keyBag].flatMap(t=>p12.getBags({bagType:t})[t]||[]);
    if (!certs.length || !keys.length) return res.status(422).json({error:'O arquivo não contém certificado e chave privada para assinatura'});
    const cert = certs[0].cert;
    const fields = cert.subject.attributes.map(a=>({name:a.shortName||a.name,value:String(a.value)}));
    const now = new Date();
    return res.status(200).json({titular:fields.find(x=>x.name==='CN')?.value||'Não identificado',inicio:cert.validity.notBefore.toISOString(),fim:cert.validity.notAfter.toISOString(),vigente:now>=cert.validity.notBefore&&now<=cert.validity.notAfter,possuiChavePrivada:true,observacao:'Inspeção de senha, certificado e datas. Não verifica revogação, cadeia ICP-Brasil ou identidade do usuário. Não realiza assinatura.'});
  } catch (_) { return res.status(500).json({error:'Falha na inspeção do certificado'}); }
};
