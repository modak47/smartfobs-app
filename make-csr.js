const forge = require('node-forge');
const fs = require('fs');

// Generate a 2048-bit keypair
const keys = forge.pki.rsa.generateKeyPair(2048);
const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);

// Create the specific CSR HSBC needs
const csr = forge.pki.createCertificationRequest();
csr.publicKey = keys.publicKey;
csr.setSubject([
  { name: 'commonName', value: 'smartfobs-app' },
  { name: 'countryName', value: 'GB' },
  { name: 'localityName', value: 'Brighton' },
  { name: 'organizationName', value: 'Smartfobs' },
  { name: 'organizationalUnitName', value: 'Development' }
]);

// Sign the certificate request with your private key
csr.sign(keys.privateKey);
const csrPem = forge.pki.certificationRequestToPem(csr);

// Save the files directly to your folder
fs.writeFileSync('private.key', privateKeyPem);
fs.writeFileSync('eidas.csr', csrPem);

console.log('✅ Success! private.key and eidas.csr have been created perfectly.');
