const iv = '0102030405060708';
const presetKey = '0CoJUm6Qyw8W8jud';
const base62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const publicKey = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB
-----END PUBLIC KEY-----`;

function aesEncrypt(text, key, ivStr) {
  const cipher = forge.cipher.createCipher('AES-CBC', key);
  cipher.start({ iv: ivStr });
  cipher.update(forge.util.createBuffer(forge.util.encodeUtf8(text)));
  cipher.finish();
  return forge.util.encode64(cipher.output.getBytes());
}

function rsaEncrypt(str, pemPublicKey) {
  const k = forge.pki.publicKeyFromPem(pemPublicKey);
  const encrypted = k.encrypt(str, 'NONE');
  return forge.util.bytesToHex(encrypted);
}

export function weapi(obj) {
  const text = JSON.stringify(obj);
  let secretKey = '';
  for (let i = 0; i < 16; i++) secretKey += base62.charAt(Math.floor(Math.random() * 62));
  return {
    params: aesEncrypt(aesEncrypt(text, presetKey, iv), secretKey, iv),
    encSecKey: rsaEncrypt(secretKey.split('').reverse().join(''), publicKey)
  };
}
