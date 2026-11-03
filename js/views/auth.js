// Anmeldung: Ersteinrichtung, Umstieg vom alten App-Passwort, Wiederherstellen, Entsperren mit PIN

import { h } from '../util.js';
import {
  S, isLegacy, setupNew, unlock, wipeAll, verifyLegacy, completeLegacyUpgrade, getAttempts,
} from '../model.js';
import { parseBackup, decryptBackup, backupPasswordHint } from '../backup.js';
import { render } from '../nav.js';
import { confirmDialog, formDialog, alertDialog, toast, btn } from '../ui.js';
import { pinPad, weakPin } from './pinpad.js';

// Laufender Einrichtungs-Ablauf: { mode: 'fresh' | 'legacy' | 'restore', step, pin, data }
let flow = null;

export function renderAuth(root) {
  if (S.legacyPending && (!flow || flow.mode !== 'legacy')) flow = { mode: 'legacy', step: 'pin1' };
  if (flow) renderCredentials(root);
  else if (!S.meta) renderWelcome(root);
  else if (isLegacy()) renderLegacyLogin(root);
  else renderPinLock(root);
}

const logo = () => h('div.auth-logo', h('img', { src: 'icons/icon-192.png', alt: '', width: 72, height: 72 }), h('h1', 'Mitarbeit'));
const persist = () => { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); };

// ---------- Erster Start ----------

function renderWelcome(root) {
  root.append(h('div.auth', logo(), h('div.auth-card',
    h('h2', 'Willkommen'),
    h('p', 'Alle Daten bleiben ausschließlich auf diesem Gerät und werden verschlüsselt. Es gibt keinen Server, keine Cloud und keine Datenübertragung.'),
    h('p', 'Zum Einrichten werden zwei Dinge festgelegt:'),
    h('ul.plain',
      h('li', h('strong', 'PIN (4 Ziffern)'), ' – zum Entsperren der App auf diesem iPad.'),
      h('li', h('strong', 'Sicherungspasswort (mind. 10 Zeichen)'), ' – verschlüsselt die Sicherungsdateien.')),
    btn('Einrichten', () => { flow = { mode: 'fresh', step: 'pin1' }; render(); }, 'primary big')),
  h('div.auth-foot', h('span', 'Bereits eine Sicherung vorhanden? '), btn('Aus Sicherung wiederherstellen', restoreAsNew, 'link'))));
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
      intro: `Sicherung vom ${new Date(p.created).toLocaleString('de-DE')}. ${backupPasswordHint(p)}`,
      fields: [{ name: 'pw', label: 'Passwort der Sicherung', type: 'password', required: true }],
      ok: 'Weiter',
    });
    if (!res) return;
    try {
      const out = await decryptBackup(p, res.pw);
      if (!out) { alertDialog('Falsches Passwort', 'Die Sicherung konnte mit diesem Passwort nicht entschlüsselt werden.'); return; }
      flow = { mode: 'restore', step: 'pin1', data: out.data };
      render();
      toast('Sicherung entschlüsselt – jetzt PIN und Sicherungspasswort festlegen.');
    } catch (err) {
      alertDialog('Fehler', err.message);
    }
  });
  input.click();
}

// ---------- PIN und Sicherungspasswort festlegen ----------

function renderCredentials(root) {
  const intro = {
    fresh: 'Neu einrichten',
    legacy: 'Umstellung auf PIN und Sicherungspasswort',
    restore: 'Wiederherstellen',
  }[flow.mode];
  const card = h('div.auth-card');
  root.append(h('div.auth', logo(), card,
    h('div.auth-foot', btn('Abbrechen', () => { flow = null; S.legacyPending = null; render(); }, 'link'))));

  if (flow.step === 'pin1' || flow.step === 'pin2') {
    const first = flow.step === 'pin1';
    const pad = pinPad({
      onComplete: pin => {
        if (first) {
          if (weakPin(pin)) { pad.reset('Diese PIN ist zu leicht zu erraten. Bitte eine andere wählen.', true); return; }
          flow.pin = pin; flow.step = 'pin2'; render();
        } else if (pin === flow.pin) {
          flow.step = 'bpw'; render();
        } else {
          flow.pin = null; flow.step = 'pin1'; flow.err = 'Die PINs stimmen nicht überein. Bitte neu festlegen.'; render();
        }
      },
    });
    card.append(
      h('p.step-label', `${intro} · Schritt ${first ? 1 : 2} von 3`),
      h('h2', first ? 'PIN festlegen' : 'PIN wiederholen'),
      h('p.muted', first ? '4 Ziffern zum Entsperren der App auf diesem iPad.' : 'Zur Bestätigung dieselbe PIN noch einmal eingeben.'),
      pad.el);
    if (flow.err) { pad.reset(flow.err, true); flow.err = null; }
    return;
  }

  // Schritt 3: Sicherungspasswort
  const pw1 = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'mindestens 10 Zeichen' });
  const pw2 = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'wiederholen' });
  const ack = h('input', { type: 'checkbox' });
  const msg = h('p.error');
  const submit = h('button.btn.primary.big', { type: 'submit' }, 'Fertig');
  card.append(h('form', {
    onSubmit: async e => {
      e.preventDefault();
      msg.textContent = '';
      if (pw1.value.length < 10) { msg.textContent = 'Das Sicherungspasswort muss mindestens 10 Zeichen lang sein.'; return; }
      if (pw1.value !== pw2.value) { msg.textContent = 'Die beiden Passwörter stimmen nicht überein.'; return; }
      if (!ack.checked) { msg.textContent = 'Bitte den Hinweis bestätigen.'; return; }
      submit.disabled = true;
      submit.textContent = 'Wird verschlüsselt …';
      try {
        if (flow.mode === 'legacy') await completeLegacyUpgrade(flow.pin, pw1.value);
        else if (flow.mode === 'restore') await setupNew(flow.pin, pw1.value, flow.data);
        else await setupNew(flow.pin, pw1.value);
        const mode = flow.mode;
        flow = null;
        persist();
        render();
        toast(mode === 'legacy' ? 'Umstellung abgeschlossen. Bitte gleich eine neue Sicherung erstellen.' : 'Eingerichtet.');
      } catch (err) {
        msg.textContent = 'Fehler: ' + err.message;
        submit.disabled = false;
        submit.textContent = 'Fertig';
      }
    },
  },
    h('p.step-label', `${intro} · Schritt 3 von 3`),
    h('h2', 'Sicherungspasswort festlegen'),
    h('p.muted', 'Damit werden die Sicherungsdateien verschlüsselt. Es wird zum Wiederherstellen einer Sicherung gebraucht, z. B. auf einem neuen iPad.'),
    h('div.warnbox', h('strong', 'Ohne Sicherungspasswort lassen sich Sicherungen nicht wiederherstellen.'),
      h('p', 'Niemand kann eine Sicherung ohne dieses Passwort öffnen. Bitte sicher notieren – getrennt vom iPad.')),
    h('label.field', h('span', 'Sicherungspasswort'), pw1),
    h('label.field', h('span', 'Sicherungspasswort wiederholen'), pw2),
    h('label.check', ack, h('span', 'Ich habe das Sicherungspasswort notiert und verstanden, dass es nicht wiederhergestellt werden kann.')),
    msg,
    submit));
}

// ---------- Umstieg von Version 1 ----------

let legacyFails = 0;

function renderLegacyLogin(root) {
  const pw = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'bisheriges App-Passwort' });
  const msg = h('p.error');
  const submit = h('button.btn.primary.big', { type: 'submit' }, 'Weiter');
  root.append(h('div.auth', logo(), h('form.auth-card', {
    onSubmit: async e => {
      e.preventDefault();
      if (!pw.value) return;
      msg.textContent = '';
      submit.disabled = true;
      submit.textContent = 'Wird geprüft …';
      const ok = await verifyLegacy(pw.value).catch(() => false);
      if (ok) { flow = { mode: 'legacy', step: 'pin1' }; render(); return; }
      legacyFails++;
      await new Promise(r => setTimeout(r, Math.min(30000, 500 * 2 ** legacyFails)));
      msg.textContent = 'Falsches Passwort.';
      pw.value = '';
      submit.disabled = false;
      submit.textContent = 'Weiter';
    },
  },
    h('p.step-label', 'Update auf Version 2'),
    h('h2', 'Einmalige Umstellung'),
    h('p', 'Die App wird künftig mit einer 4-stelligen PIN entsperrt. Sicherungen werden mit einem eigenen Sicherungspasswort verschlüsselt.'),
    h('p.muted', 'Bitte zuerst einmalig das bisherige App-Passwort eingeben. Die alten Daten bleiben als interne Kopie erhalten.'),
    h('label.field', h('span', 'Bisheriges App-Passwort'), pw),
    msg,
    submit)));
  setTimeout(() => pw.focus(), 50);
}

// ---------- Entsperren ----------

function renderPinLock(root) {
  let timer = null;
  const pad = pinPad({
    onComplete: async pin => {
      pad.busy('Wird entsperrt …');
      let res;
      try { res = await unlock(pin); } catch (err) { pad.reset(err.message, true); return; }
      if (res.ok) { persist(); render(); return; }
      if (res.broken) {
        pad.reset('Der Geräteschlüssel fehlt. Daten können nur aus einer Sicherung wiederhergestellt werden („PIN vergessen?“).', true);
        return;
      }
      if (res.wait) { showWait(res.wait); return; }
      const a = res.attempts;
      if (a.until > Date.now()) showWait(a.until - Date.now(), 'Falsche PIN. ');
      else pad.reset(a.fails >= 3 ? `Falsche PIN. Noch ${5 - a.fails} Versuch(e) ohne Wartezeit.` : 'Falsche PIN.', true);
    },
  });
  const showWait = (ms, prefix = '') => {
    clearInterval(timer);
    const end = Date.now() + ms;
    const tick = () => {
      if (!pad.el.isConnected) { clearInterval(timer); return; }
      const s = Math.ceil((end - Date.now()) / 1000);
      if (s <= 0) { clearInterval(timer); pad.reset('Bitte PIN eingeben.'); return; }
      pad.busy(`${prefix}Zu viele Fehlversuche – bitte ${s >= 60 ? Math.ceil(s / 60) + ' Min.' : s + ' Sek.'} warten.`);
    };
    tick();
    timer = setInterval(tick, 1000);
  };
  root.append(h('div.auth', logo(), h('div.auth-card',
    h('h2', 'Gesperrt'),
    h('p.muted', 'PIN eingeben'),
    pad.el),
  h('div.auth-foot', btn('PIN vergessen?', forgot, 'link'))));
  getAttempts().then(a => { if (a.until > Date.now()) showWait(a.until - Date.now()); });
}

async function forgot() {
  const ok = await confirmDialog(
    h('div', h('p', 'Ohne PIN können die Daten auf diesem Gerät nicht entschlüsselt werden. Es gibt keine Hintertür.'),
      h('p', 'Möglich ist nur ein Neustart: Alle Daten auf diesem Gerät werden gelöscht. Anschließend kann eine Sicherung geladen werden – dafür wird das Sicherungspasswort benötigt.')),
    { title: 'PIN vergessen', ok: 'Weiter zum Löschen', danger: true });
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
