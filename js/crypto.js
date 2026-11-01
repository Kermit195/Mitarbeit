// Verschlüsselung: PBKDF2 (SHA-256) → AES-GCM 256 Bit, alles über die Web Crypto API

const enc = new TextEncoder();
const dec = new TextDecoder();

export const ITERATIONS = 600000;
const MAX_ITERATIONS = 5000000;

export function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

export async function deriveKey(password, salt, iterations = ITERATIONS) {
  if (!(iterations > 0 && iterations <= MAX_ITERATIONS)) throw new Error('Ungültige Schlüsselparameter.');
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false, // Schlüssel ist nicht exportierbar
    ['encrypt', 'decrypt']
  );
}

// Der Klartext wird sofort (synchron) erzeugt – spätere Änderungen am Objekt beeinflussen ihn nicht.
export async function encryptJSON(key, obj) {
  const iv = randomBytes(12);
  const plain = enc.encode(JSON.stringify(obj));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  return { iv, ct };
}

export async function decryptJSON(key, iv, ct) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(dec.decode(plain));
}

export function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromB64(str) {
  const s = atob(str);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}
