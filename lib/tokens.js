import crypto from 'node:crypto';

/** Creates a random token. Only its hash is stored, so a database leak exposes no usable links. */
export function newToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}
