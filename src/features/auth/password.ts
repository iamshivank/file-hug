import crypto from 'node:crypto';

/**
 * Password hashing via Node's built-in scrypt — no external dependency.
 * Stored format: `scrypt:<salt-hex>:<hash-hex>`.
 */

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS: crypto.ScryptOptions = { N: 16384, r: 8, p: 1 };

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

/** Hash a plaintext password for storage. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(password, salt);
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
}

/** Verify a plaintext password against a stored hash. Returns false on any malformed input. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  try {
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    const derived = await scryptAsync(password, salt);
    return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}
