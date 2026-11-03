// Verschlüsselte Sicherungsdatei erstellen und lesen
// Format 2: verschlüsselt mit dem Sicherungspasswort. Format 1 (alte Version): mit dem damaligen App-Passwort.
// Beide Formate werden identisch entschlüsselt (PBKDF2 → AES-GCM).

import { S, flush, migrate, getBackupKey } from './model.js';
import { encryptJSON, decryptJSON, deriveKey, toB64, fromB64 } from './crypto.js';
import { isoDate, pad } from './util.js';

export async function buildBackupFile() {
  await flush();
  const bk = await getBackupKey();
  const { iv, ct } = await encryptJSON(bk.key, S.data);
  const payload = {
    app: 'Mitarbeit',
    format: 2,
    schemaVersion: S.data.schemaVersion,
    created: new Date().toISOString(),
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: bk.iter, salt: toB64(bk.salt) },
    cipher: { name: 'AES-GCM', iv: toB64(iv) },
    data: toB64(ct),
  };
  const d = new Date();
  const name = `Mitarbeit-Sicherung-${isoDate(d)}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
  return new File([JSON.stringify(payload)], name, { type: 'application/json' });
}

// iPad: Teilen-Menü (z. B. „In Dateien sichern“, AirDrop). Sonst: normaler Download.
export async function shareFile(file) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file] });
    return 'shared';
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}

export async function parseBackup(file) {
  let p;
  try { p = JSON.parse(await file.text()); } catch { p = null; }
  if (!p || p.app !== 'Mitarbeit' || !p.kdf || !p.cipher || !p.data) {
    throw new Error('Diese Datei ist keine Mitarbeit-Sicherung.');
  }
  return p;
}

// Hinweis, welches Passwort die Datei braucht
export const backupPasswordHint = p => (p.format === 1
  ? 'Sicherung aus Version 1: Passwort ist das damalige App-Passwort.'
  : 'Passwort ist das Sicherungspasswort, das beim Erstellen galt.');

// Ergebnis: { data } oder null bei falschem Passwort
export async function decryptBackup(p, password) {
  const key = await deriveKey(password, fromB64(p.kdf.salt), Number(p.kdf.iterations));
  let data;
  try { data = await decryptJSON(key, fromB64(p.cipher.iv), fromB64(p.data)); } catch { return null; }
  return { data: migrate(data) };
}
