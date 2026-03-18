const crypto = require('crypto');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const pw = crypto.randomBytes(16).toString('hex');
const alias = 'release';
const kf = 'release.keystore';

const propertiesContent = `storePassword=${pw}
keyPassword=${pw}
keyAlias=${alias}
storeFile=${kf}
`;

fs.writeFileSync(path.join(process.cwd(), 'android', 'keystore.properties'), propertiesContent);
console.log('Generated keystore.properties. Running keytool...');

try {
  execSync(`keytool -genkey -v -keystore android/${kf} -alias ${alias} -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=XitChat Release, OU=Development, O=XitChat, L=City, ST=State, C=US" -storepass ${pw} -keypass ${pw}`);
  console.log('Successfully generated release.keystore.');
} catch (e) {
  console.error('Failed to generate keystore:', e.message);
}
