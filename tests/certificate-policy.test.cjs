'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {isCorporateCertificate} = require('../api/certificate-policy');
const forge = {
  asn1: { toDer: value => ({getBytes: () => value}), oidToDer: oid => ({getBytes: () => `OID:${oid}`}) },
  pki: {certificateToAsn1: cert => cert.der || ''}
};
test('bloqueia CNPJ formatado no titular', () => {
  assert.equal(isCorporateCertificate({subject:{attributes:[{value:'Empresa 12.345.678/0001-90'}]}},forge),true);
});
test('bloqueia OID de CNPJ na extensão ASN.1 sem texto legível', () => {
  assert.equal(isCorporateCertificate({subject:{attributes:[]},der:'\0OID:2.16.76.1.3.3\0'},forge),true);
});
test('não identifica pessoa física sem indicador empresarial', () => {
  assert.equal(isCorporateCertificate({subject:{attributes:[{value:'Dentista'}]},der:'sem-oid'},forge),false);
});
