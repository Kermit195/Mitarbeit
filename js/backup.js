// Verschlüsselte Sicherungsdatei erstellen und lesen

import { S, flush, migrate } from './model.js';
import { encryptJSON, decryptJSON, deriveKey, toB64, fromB64 } from './crypto.js';
import { isoDate, pad } from './util.js';

export async function buildBackupFile() {
  await flush();
  const { iv, ct } = await encryptJSON(S.key, S.data);
  const payload = {
    app: 'Mitarbeit',
    format: 1,
    schemaVersion: S.data.schemaVersion,
    created: new Date().toISOString(),
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: S.meta.iter, salt: toB64(S.meta.salt) },
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

// Ergebnis: { data, key, salt, iter } oder null bei falschem Passwort
export async function decryptBackup(p, password) {
  const salt = fromB64(p.kdf.salt);
  const iter = Number(p.kdf.iterations);
  const key = await deriveKey(password, salt, iter);
  let data;
  try { data = await decryptJSON(key, fromB64(p.cipher.iv), fromB64(p.data)); } catch { return null; }
  return { data: migrate(data), key, salt, iter };
}
