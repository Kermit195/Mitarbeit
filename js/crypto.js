// Verschlüsselung über die Web Crypto API
// - Daten: AES-GCM 256 mit zufälligem Datenschlüssel
// - Datenschlüssel doppelt gesichert: PIN-Schlüssel (PBKDF2) + nicht exportierbarer Geräteschlüssel
// - Sicherungen: AES-GCM mit Schlüssel aus dem Sicherungspasswort (PBKDF2)

const enc = new TextEncoder();
const dec = new TextDecoder();

export const ITERATIONS = 600000;
const MAX_ITERATIONS = 5000000;

export function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

async function pbkdf2Base(password) {
  return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey', 'deriveBits']);
}

function checkIter(iterations) {
  if (!(iterations > 0 && iterations <= MAX_ITERATIONS)) throw new Error('Ungültige Schlüsselparameter.');
}

export async function deriveKey(password, salt, iterations = ITERATIONS) {
  checkIter(iterations);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    await pbkdf2Base(password),
    { name: 'AES-GCM', length: 256 },
    false, // nicht exportierbar
    ['encrypt', 'decrypt']
  );
}

// Rohe Schlüsselbits (für den Sicherungsschlüssel, der verschlüsselt gespeichert wird)
export async function deriveBits(password, salt, iterations = ITERATIONS) {
  checkIter(iterations);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, await pbkdf2Base(password), 256);
  return new Uint8Array(bits);
}

export function importAesKey(raw) {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

// Gerätegebundener Schlüssel: nicht exportierbar, wird als CryptoKey-Objekt in IndexedDB abgelegt
export function generateDeviceKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptBytes(key, bytes) {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  return { iv, ct };
}

export async function decryptBytes(key, iv, ct) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
}

// Der Klartext wird sofort (synchron) erzeugt – spätere Änderungen am Objekt beeinflussen ihn nicht.
export function encryptJSON(key, obj) {
  return encryptBytes(key, enc.encode(JSON.stringify(obj)));
}

export async function decryptJSON(key, iv, ct) {
  return JSON.parse(dec.decode(await decryptBytes(key, iv, ct)));
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
