 'use strict';
// Assinador PDF transitório. Não persiste arquivo, certificado ou senha.
const { PDFDocument } = require('pdf-lib');
const { pdflibAddPlaceholder } = require('@signpdf/placeholder-pdf-lib');
const { SignPdf } = require('@signpdf/signpdf');
const { P12Signer } = require('@signpdf/signer-p12');
const MAX_PDF=5*1024*1024, MAX_P12=1024*1024;
function decode(input, max) {
 if(typeof input!=='string'||input.length>Math.ceil(max*4/3)+8||!input.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(input)) throw new Error('Arquivo inválido');
 const buf=Buffer.from(input,'base64'); if(!buf.length||buf.length>max)throw new Error('Arquivo acima do limite'); return buf;
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método não permitido'});}
 const base=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY;
 if(!base||!anon)return res.status(503).json({error:'Autenticação não configurada'});
 const auth=String(req.headers.authorization||'');
 if(!/^Bearer [\w.\-]+$/.test(auth))return res.status(401).json({error:'Sessão necessária'});
 try{
  const v=await fetch(base.replace(/\/$/,'')+'/auth/v1/user',{headers:{apikey:anon,Authorization:auth},signal:AbortSignal.timeout(8000)});
  if(!v.ok)return res.status(401).json({error:'Sessão inválida'});
  const user=await v.json();if(!user.id)return res.status(401).json({error:'Sessão inválida'});
  const {pdfBase64,pfxBase64,password,acknowledge}=req.body||{};
  if(acknowledge!==true||typeof password!=='string'||!password||password.length>512)return res.status(400).json({error:'Confirme a autorização do titular e informe a senha'});
  const pdf=decode(pdfBase64,MAX_PDF),p12=decode(pfxBase64,MAX_P12);
  if(pdf.subarray(0,5).toString()!=='%PDF-')return res.status(400).json({error:'Arquivo não é PDF'});
  // Não é permitido usar esta rota para e-CNPJ sem controle de administrador implementado.
  const forge=require('node-forge');let pkcs;
  try{pkcs=forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(p12.toString('binary')),false,password);}catch(_){return res.status(422).json({error:'Certificado ou senha inválidos'});}
  const bags=pkcs.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]||[];
  const cert=bags[0]?.cert;if(!cert)return res.status(422).json({error:'Certificado não encontrado'});
  const subject=cert.subject.attributes.map(x=>String(x.value)).join(' ');
  if(/(?:^|\D)\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}(?:\D|$)/.test(subject))return res.status(403).json({error:'e-CNPJ indisponível nesta etapa: falta validar o perfil de administrador'});
  const now=new Date();if(now<cert.validity.notBefore||now>cert.validity.notAfter)return res.status(422).json({error:'Certificado fora da validade'});
  const doc=await PDFDocument.load(pdf,{ignoreEncryption:false});
  pdflibAddPlaceholder({pdfDoc:doc,reason:'Assinatura digital de documento',name:cert.subject.getField('CN')?.value||'Titular',contactInfo:'',location:'Brasil',signatureLength:16000});
  const prepared=Buffer.from(await doc.save({useObjectStreams:false}));
  const signed=await new SignPdf().sign(prepared,new P12Signer(p12,{passphrase:password}));
  res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition','attachment; filename="nexodent-assinado.pdf"');
  return res.status(200).send(signed);
 }catch(err){return res.status(422).json({error:'Não foi possível assinar o PDF. Confira se é um PDF válido e se o certificado A1 é compatível.'});}
};
