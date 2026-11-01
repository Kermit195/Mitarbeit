// Ersteinrichtung (Passwort festlegen) und Sperrbildschirm

import { h } from '../util.js';
import { S, setupPassword, setupWithKey, unlock, wipeAll } from '../model.js';
import { parseBackup, decryptBackup } from '../backup.js';
import { render } from '../nav.js';
import { confirmDialog, formDialog, alertDialog, toast, btn } from '../ui.js';

export function renderAuth(root) {
  if (!S.meta) renderSetup(root);
  else renderLock(root);
}

const logo = () => h('div.auth-logo', h('img', { src: 'icons/icon-192.png', alt: '', width: 72, height: 72 }), h('h1', 'Mitarbeit'));

function renderSetup(root) {
  const pw1 = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'mindestens 8 Zeichen' });
  const pw2 = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Passwort wiederholen' });
  const ack = h('input', { type: 'checkbox' });
  const msg = h('p.error');
  const submit = h('button.btn.primary.big', { type: 'submit' }, 'Passwort festlegen und starten');

  const form = h('form.auth-card', {
    onSubmit: async e => {
      e.preventDefault();
      msg.textContent = '';
      if (pw1.value.length < 8) { msg.textContent = 'Das Passwort muss mindestens 8 Zeichen lang sein.'; return; }
      if (pw1.value !== pw2.value) { msg.textContent = 'Die beiden Passwörter stimmen nicht überein.'; return; }
      if (!ack.checked) { msg.textContent = 'Bitte den Hinweis zur fehlenden Wiederherstellung bestätigen.'; return; }
      submit.disabled = true;
      submit.textContent = 'Wird eingerichtet …';
      try {
        await setupPassword(pw1.value);
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
        render();
      } catch (err) {
        msg.textContent = 'Fehler beim Einrichten: ' + err.message;
        submit.disabled = false;
        submit.textContent = 'Passwort festlegen und starten';
      }
    },
  },
    h('h2', 'Willkommen'),
    h('p', 'Alle Daten bleiben ausschließlich auf diesem Gerät. Sie werden mit dem App-Passwort verschlüsselt (AES-GCM). Es gibt keinen Server, keine Cloud und keine Datenübertragung.'),
    h('div.warnbox', h('strong', 'Wichtig: Ohne Passwort ist keine Wiederherstellung möglich.'),
      h('p', 'Wird das Passwort vergessen, kann niemand die Daten wieder öffnen – auch nicht über eine Sicherung. Passwort bitte sicher notieren.')),
    h('label.field', h('span', 'App-Passwort'), pw1),
    h('label.field', h('span', 'Passwort wiederholen'), pw2),
    h('label.check', ack, h('span', 'Ich habe verstanden, dass ein vergessenes Passwort nicht wiederhergestellt werden kann.')),
    msg,
    submit);

  root.append(h('div.auth', logo(), form,
    h('div.auth-foot', h('span', 'Bereits eine Sicherung vorhanden? '),
      btn('Aus Sicherung wiederherstellen', restoreAsNew, 'link'))));
}

function restoreAsNew() {
  const input = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  document.body.append(input);
  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.remove();
    if (!file) return;
    let p;
    try { p = await parseBackup(file); } catch (err) { alertDialog('Sicherung laden', err.message); return; }
    const res = await formDialog({
      title: 'Sicherung wiederherstellen',
      intro: `Sicherung vom ${new Date(p.created).toLocaleString('de-DE')}. Das Passwort dieser Sicherung wird danach das App-Passwort.`,
      fields: [{ name: 'pw', label: 'Passwort der Sicherung', type: 'password', required: true }],
      ok: 'Wiederherstellen',
    });
    if (!res) return;
    try {
      const out = await decryptBackup(p, res.pw);
      if (!out) { alertDialog('Falsches Passwort', 'Die Sicherung konnte mit diesem Passwort nicht entschlüsselt werden.'); return; }
      await setupWithKey(out.key, out.salt, out.iter, out.data);
      render();
      toast('Sicherung wiederhergestellt.');
    } catch (err) {
      alertDialog('Fehler', err.message);
    }
  });
  input.click();
}

let fails = 0;
let blockedUntil = 0;

function renderLock(root) {
  const pw = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'App-Passwort' });
  const msg = h('p.error');
  const submit = h('button.btn.primary.big', { type: 'submit' }, 'Entsperren');
  const form = h('form.auth-card', {
    onSubmit: async e => {
      e.preventDefault();
      msg.textContent = '';
      const wait = Math.ceil((blockedUntil - Date.now()) / 1000);
      if (wait > 0) { msg.textContent = `Bitte ${wait} Sekunden warten.`; return; }
      if (!pw.value) return;
      submit.disabled = true;
      submit.textContent = 'Wird entsperrt …';
      let ok = false;
      try {
        ok = await unlock(pw.value);
      } catch (err) {
        msg.textContent = err.message;
        submit.disabled = false;
        submit.textContent = 'Entsperren';
        return;
      }
      if (ok) {
        fails = 0;
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
        render();
        return;
      }
      fails++;
      if (fails >= 3) blockedUntil = Date.now() + Math.min(60000, 2000 * 2 ** (fails - 3));
      msg.textContent = 'Falsches Passwort.';
      pw.value = '';
      submit.disabled = false;
      submit.textContent = 'Entsperren';
      pw.focus();
    },
  },
    h('h2', 'Gesperrt'),
    h('p.muted', 'Die Daten sind verschlüsselt. Zum Öffnen das App-Passwort eingeben.'),
    h('label.field', h('span', 'App-Passwort'), pw),
    msg,
    submit);
  root.append(h('div.auth', logo(), form, h('div.auth-foot', btn('Passwort vergessen?', forgot, 'link'))));
  setTimeout(() => pw.focus(), 50);
}

async function forgot() {
  const ok = await confirmDialog(
    h('div', h('p', 'Ohne Passwort können die Daten nicht entschlüsselt werden. Es gibt keine Hintertür.'),
      h('p', 'Möglich ist nur ein Neustart: Alle Daten auf diesem Gerät werden gelöscht. Anschließend kann eine Sicherung geladen werden – dafür wird das Passwort benötigt, das beim Erstellen der Sicherung galt.')),
    { title: 'Passwort vergessen', ok: 'Weiter zum Löschen', danger: true });
  if (!ok) return;
  const res = await formDialog({
    title: 'Alle Daten löschen?',
    intro: 'Zur Bestätigung bitte LÖSCHEN eintippen.',
    fields: [{ name: 'w', label: 'Bestätigung', required: true }],
    ok: 'Alles löschen', danger: true,
    validate: o => (o.w.toUpperCase() === 'LÖSCHEN' ? null : 'Bitte genau „LÖSCHEN“ eintippen.'),
  });
  if (!res) return;
  await wipeAll();
  render();
}
