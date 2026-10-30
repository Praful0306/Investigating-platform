import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';

export const PROJECT = 'mystery-room-test';
export const ISSUER = `https://securetoken.google.com/${PROJECT}`;

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

// A stand-in for Google: our own RSA key pair, its public half as a JWKS (what the server would download from Google),
// and a `mint` that signs tokens shaped like real Firebase ID tokens. Any claim can be overridden; `null` removes it.
export async function makeIdp() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
  const jwks = createLocalJWKSet({ keys: [jwk] });

  const claims = (over = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const all = {
      iss: ISSUER, aud: PROJECT, sub: 'user-uid-1', iat: now - 10, exp: now + 3600, auth_time: now - 10,
      email: 'detective@example.com', name: 'Dana Detective', picture: 'https://example.com/me.png',
      firebase: { identities: { email: ['detective@example.com'] }, sign_in_provider: 'password' },
      ...over,
    };
    return Object.fromEntries(Object.entries(all).filter(([, v]) => v !== null));
  };

  async function mint(over = {}, { key = privateKey, alg = 'RS256', kid = 'test-key' } = {}) {
    return new SignJWT(claims(over)).setProtectedHeader({ alg, kid, typ: 'JWT' }).sign(key);
  }

  // a token with no signature at all ("alg": "none")
  const unsigned = (over = {}) => `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims(over))}.`;

  // a second signing key of another algorithm (RS512) whose JWK carries no "alg": a server that does not pin RS256
  // would trust a token signed with it
  const other = await generateKeyPair('RS512');
  const jwk512 = { ...(await exportJWK(other.publicKey)), kid: 'key-512', use: 'sig' };
  const jwks512 = createLocalJWKSet({ keys: [jwk512] });
  const mint512 = (over = {}) => new SignJWT(claims(over)).setProtectedHeader({ alg: 'RS512', kid: 'key-512', typ: 'JWT' }).sign(other.privateKey);

  return { jwks, mint, unsigned, privateKey, jwk, jwks512, mint512 };
}
