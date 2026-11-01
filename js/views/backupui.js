// Abläufe „Sicherung erstellen“ und „Sicherung laden“

import { h } from '../util.js';
import { S, save, replaceData } from '../model.js';
import { buildBackupFile, shareFile, parseBackup, decryptBackup } from '../backup.js';
import { openSheet, toast, btn, formDialog, alertDialog, confirmDialog } from '../ui.js';
import { render, go } from '../nav.js';
import { clearUndo } from '../undo.js';

export async function createBackupFlow() {
  let file;
  try { file = await buildBackupFile(); } catch (err) { alertDialog('Fehler', 'Sicherung konnte nicht erstellt werden: ' + err.message); return; }
  const kb = Math.max(1, Math.round(file.size / 1024));
  // Das Teilen-Menü muss direkt durch einen Fingertipp geöffnet werden – daher zweiter Schritt.
  const s = openSheet('Sicherung bereit', [
    h('p', h('strong', file.name), ` (${kb} KB)`),
    h('p.muted', 'Die Datei ist mit dem App-Passwort verschlüsselt. Im Teilen-Menü z. B. „In Dateien sichern“ wählen und anschließend auf einen eigenen Datenträger (USB-Stick, eigener Rechner per AirDrop) übertragen. Datenschutzvorgaben der Schule beachten.'),
    h('div.btnrow',
      btn('Abbrechen', () => s.close(), 'ghost'),
      btn('Teilen / Sichern …', async () => {
        try {
          const how = await shareFile(file);
          S.data.settings.lastBackup = Date.now();
          save();
          s.close();
          toast(how === 'shared' ? 'Sicherung übergeben.' : 'Sicherung heruntergeladen.');
          render();
        } catch (err) {
          if (err && err.name === 'AbortError') return;
          toast('Teilen fehlgeschlagen: ' + (err && err.message ? err.message : err));
        }
      }, 'primary')),
  ], { small: true });
}

export function restoreFlow() {
  const input = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  document.body.append(input);
  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.remove();
    if (!file) return;
    let p;
    try { p = await parseBackup(file); } catch (err) { alertDialog('Sicherung laden', err.message); return; }
    const res = await formDialog({
      title: 'Sicherung laden',
      intro: h('div',
        h('p', `Sicherung vom ${new Date(p.created).toLocaleString('de-DE')}.`),
        h('p.warnbox', 'Achtung: Alle aktuellen Daten auf diesem Gerät werden durch die Sicherung ersetzt. Das App-Passwort bleibt unverändert.')),
      fields: [{ name: 'pw', label: 'Passwort der Sicherung', type: 'password', required: true }],
      ok: 'Weiter',
    });
    if (!res) return;
    let out;
    try { out = await decryptBackup(p, res.pw); } catch (err) { alertDialog('Fehler', err.message); return; }
    if (!out) { alertDialog('Falsches Passwort', 'Die Sicherung konnte mit diesem Passwort nicht entschlüsselt werden.'); return; }
    const ok = await confirmDialog('Wirklich alle aktuellen Daten durch diese Sicherung ersetzen?', { ok: 'Ersetzen', danger: true });
    if (!ok) return;
    clearUndo();
    await replaceData(out.data);
    toast('Sicherung geladen.');
    go({ name: 'start' });
  });
  input.click();
}
