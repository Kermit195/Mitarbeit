// Einstellungen: Klassen/Fächer, Kategorien je Fach, Allgemeines, Sicherheit, Sicherung

import { h, uid, fmtTimestamp } from '../util.js';
import {
  S, save, flush, addClass, newGroup, groupsOfClass, resetGroup, wipeAll, SCHEMA_VERSION,
  changePin, changeBackupPassword, hasLegacyCopy, readLegacyCopy, replaceData,
} from '../model.js';
import { go, render } from '../nav.js';
import { topbar, btn, formDialog, confirmDialog, alertDialog, toast } from '../ui.js';
import { SUBJECT_NAMES, SUBJECT_ORDER, FB_LABELS, SYSTEM_CATS, sportConfig, pbConfig, deriveSek2 } from '../defaults.js';
import { fmtPts } from '../grading.js';
import { weakPin } from './pinpad.js';
import { swState, checkForUpdate, applyUpdate } from '../sw-client.js';
import { clearUndo } from '../undo.js';
import { createBackupFlow, restoreFlow } from './backupui.js';
import { copyStudents } from './students.js';

const openSections = new Set(['Sicherung']);

function section(title, body) {
  const d = h('details.card.set-sec', { open: openSections.has(title) }, h('summary', title), h('div.set-body', body));
  d.addEventListener('toggle', () => { if (d.open) openSections.add(title); else openSections.delete(title); });
  return d;
}

const field = (label, input, help) => h('label.field', h('span', label), input, help && h('small', help));

function numInput(value, onSet, attrs = {}) {
  return h('input', {
    type: 'number', value, inputmode: 'decimal', ...attrs,
    onChange: e => {
      const v = Number(String(e.target.value).replace(',', '.'));
      if (Number.isFinite(v)) { onSet(v); save(); } else e.target.value = value;
    },
  });
}
function textInput(value, onSet, attrs = {}) {
  return h('input', { type: 'text', value: value || '', autocomplete: 'off', ...attrs, onChange: e => { onSet(e.target.value.trim()); save(); } });
}
function textArea(value, onSet, rows = 3) {
  const ta = h('textarea', { rows, onChange: e => { onSet(e.target.value); save(); } });
  ta.value = value || '';
  return ta;
}
function check(label, value, onSet) {
  return h('label.check', h('input', { type: 'checkbox', checked: !!value, onChange: e => onSet(e.target.checked, e.target) }), h('span', label));
}

export function renderSettings(root) {
  root.append(topbar({
    left: h('button.btn.ghost.back', { type: 'button', onClick: () => go({ name: 'start' }) }, '‹ Klassen'),
    title: 'Einstellungen',
  }));
  const main = h('main.content.settings');
  root.append(main);
  main.append(
    section('Sicherung', backupSection()),
    section('Klassen und Fächer', classesSection()),
    section('Fach Sport: Punkte, Notenschlüssel, Schwellen, Feedback', subjectSection('sport')),
    section('Fach Politische Bildung: Punkte, Notenschlüssel, Schwellen, Feedback', subjectSection('pb')),
    section('Allgemein: Sperre, Sicherung, Klingelzeiten', generalSection()),
    section('PIN und Sicherungspasswort', securitySection()),
    section('Schuljahr abschließen', yearEndSection()),
    section('Über die App und Datenschutz', aboutSection()));
}

// ---------- Sicherung ----------

function backupSection() {
  const lb = S.data.settings.lastBackup;
  return [
    h('p', 'Letzte Sicherung: ', h('strong', lb ? fmtTimestamp(lb) : 'noch keine')),
    h('p.muted', 'Die Sicherungsdatei ist mit dem Sicherungspasswort verschlüsselt. Zum Laden wird das Sicherungspasswort benötigt, das beim Erstellen galt (bei Sicherungen aus Version 1: das damalige App-Passwort).'),
    h('div.btnrow.left', btn('Sicherung erstellen', createBackupFlow, 'primary'), btn('Sicherung laden …', restoreFlow, 'ghost')),
  ];
}

// ---------- Klassen ----------

function classesSection() {
  const d = S.data;
  const classes = [...d.classes].sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }));
  const rows = classes.map(cls => {
    const has = f => groupsOfClass(cls.id).some(g => g.fach === f);
    return h('div.classrow',
      textInput(cls.name, v => { if (v) cls.name = v; }, { 'aria-label': 'Klassenname' }),
      check('Sek II (Notenpunkte)', cls.sek2, v => { cls.sek2 = v; save(); }),
      SUBJECT_ORDER.map(f => check(SUBJECT_NAMES[f], has(f), (on, el) => toggleSubject(cls, f, on, el))),
      btn('Löschen', () => deleteClass(cls), 'ghost danger'));
  });
  return [
    h('p.muted', 'Jede Kombination aus Klasse und Fach ist eine eigene Lerngruppe mit eigener Schülerliste, eigenen Einträgen und Noten.'),
    rows,
    h('div.btnrow.left', btn('＋ Klasse hinzufügen', addClassDialog, 'primary')),
  ];
}

async function toggleSubject(cls, fach, on, el) {
  const d = S.data;
  if (on) {
    const g = newGroup(cls.id, fach);
    const sib = groupsOfClass(cls.id).find(x => x.students.length);
    if (sib && await confirmDialog(`Schülerliste aus ${cls.name} ${SUBJECT_NAMES[sib.fach]} übernehmen?`, { ok: 'Übernehmen', cancel: 'Leer anlegen' })) {
      copyStudents(sib, g);
    }
    d.groups.push(g);
    save();
    render();
    return;
  }
  const g = groupsOfClass(cls.id).find(x => x.fach === fach);
  if (!g) return;
  if (g.students.length || g.entries.length) {
    const ok = await confirmDialog(`${cls.name} ${SUBJECT_NAMES[fach]} entfernen? ${g.students.length} Schüler:innen und ${g.entries.length} Einträge dieser Lerngruppe werden gelöscht.`, { ok: 'Entfernen', danger: true });
    if (!ok) { el.checked = true; return; }
  }
  d.groups = d.groups.filter(x => x !== g);
  delete d.settings.lastGroup[cls.id];
  clearUndo();
  save();
  render();
}

async function addClassDialog() {
  const res = await formDialog({
    title: 'Klasse hinzufügen',
    fields: [
      { name: 'name', label: 'Name', required: true, placeholder: 'z. B. 10c oder 11 GK' },
      { name: 'sek2', label: 'Sek II (Notenpunkte 0–15)', type: 'checkbox', value: false },
      { name: 'sport', label: 'Sport', type: 'checkbox', value: false },
      { name: 'pb', label: 'Politische Bildung', type: 'checkbox', value: false },
    ],
    ok: 'Hinzufügen',
    validate: o => (o.sport || o.pb ? null : 'Bitte mindestens ein Fach wählen.'),
  });
  if (!res) return;
  addClass(S.data, res.name, SUBJECT_ORDER.filter(f => res[f]), res.sek2);
  save();
  render();
}

async function deleteClass(cls) {
  const gs = groupsOfClass(cls.id);
  const n = gs.reduce((a, g) => a + g.entries.length, 0);
  const ok = await confirmDialog(`Klasse ${cls.name} mit allen Lerngruppen löschen? ${n} Einträge gehen verloren.`, { ok: 'Löschen', danger: true });
  if (!ok) return;
  S.data.groups = S.data.groups.filter(g => g.classId !== cls.id);
  S.data.classes = S.data.classes.filter(c => c !== cls);
  clearUndo();
  save();
  render();
}

// ---------- Fächer ----------

function subjectSection(fach) {
  const cfg = S.data.settings.subjects[fach];
  const th = cfg.thresholds;
  const parts = [];

  // Notenschlüssel
  parts.push(h('h3', 'Notenschlüssel (Punkte pro anwesende Stunde)'));
  parts.push(h('p.muted', 'Fester Schlüssel, nicht relativ zur Klasse. Angegeben ist jeweils die Untergrenze („ab“). Ohne Einträge ergeben sich 0 Punkte.'));
  parts.push(keyEditor(cfg));

  parts.push(h('h3', 'Schwellen und Zeiträume'));
  parts.push(field('Häufungshinweis ab dem … gleichen Minus-Eintrag im Zeitraum', numInput(th.haeufung, v => { th.haeufung = Math.max(2, Math.round(v)); }, { min: 2, max: 20 })));
  parts.push(field('Beobachtungslücke: weniger als … bewertende Einträge im Zeitraum', numInput(th.luecke, v => { th.luecke = Math.max(1, Math.round(v)); }, { min: 1, max: 50 })));
  parts.push(field('Vorgeschlagene Dauer neuer Zeiträume (Wochen)', numInput(cfg.periodWeeks, v => { cfg.periodWeeks = Math.min(30, Math.max(1, Math.round(v))); }, { min: 1, max: 30 })));
  if (fach === 'sport') {
    parts.push(field('Frist für Entschuldigungen (Tage)', numInput(th.excuseDays, v => { th.excuseDays = Math.max(1, Math.round(v)); }, { min: 1, max: 60 })));
  } else {
    parts.push(h('h3', 'Schriftliche Aufgaben: Punkte'));
    const wp = cfg.written.points;
    parts.push(h('div.points-row',
      [['+', '+'], ['o', 'o'], ['-', '−'], ['na', 'nicht abgegeben']].map(([k, label]) =>
        field(label, numInput(wp[k], v => { wp[k] = Math.round(v * 100) / 100; }, { step: 1 })))));
    parts.push(h('p.muted.small', '„Nicht anwesend“ ist immer wertungsfrei.'));
    parts.push(field('Arten schriftlicher Aufgaben (eine pro Zeile)', textArea(cfg.written.arts.join('\n'), v => {
      const arts = v.split('\n').map(s => s.trim()).filter(Boolean);
      if (arts.length) cfg.written.arts = arts;
    }, 4)));
  }

  parts.push(h('h3', 'Kategorien und Punkte'));
  parts.push(h('p.muted', 'Punkte gelten für Sek I und Sek II gleich – nur der Notenschlüssel unterscheidet sich. Änderungen wirken auf alle Zeiträume, deren Noten noch nicht bestätigt sind.'));
  for (const c of cfg.cats) parts.push(catEditor(fach, cfg, c));
  parts.push(h('div.btnrow.left', btn('＋ Kategorie hinzufügen', () => {
    const sec = cfg.sections.find(s => s.id !== 'neutral');
    cfg.cats.push({ id: 'c' + uid(), label: 'Neue Kategorie', section: sec.id, plus: 1, minus: -1, custom: true, subs: [], fb: fach === 'pb' ? { area: 'beteiligung' } : {} });
    save();
    render();
  }, 'ghost')));

  parts.push(h('h3', 'Allgemeine Feedback-Bausteine'));
  parts.push(h('p.muted', 'Platzhalter: {name} = Vorname, {subs} = notierte Unterkategorien.'));
  for (const k of Object.keys(cfg.fbGeneric)) {
    parts.push(field(FB_LABELS[k] || k, textArea(cfg.fbGeneric[k], v => { cfg.fbGeneric[k] = v; }, 2)));
  }

  parts.push(h('div.btnrow.left', btn(`${SUBJECT_NAMES[fach]}: alles auf Standard zurücksetzen`, async () => {
    if (!await confirmDialog('Kategorien, Punkte, Notenschlüssel, Schwellen und Feedback-Bausteine dieses Fachs auf den Standard zurücksetzen? Einträge bleiben erhalten.', { ok: 'Zurücksetzen', danger: true })) return;
    S.data.settings.subjects[fach] = fach === 'sport' ? sportConfig() : pbConfig();
    save();
    render();
  }, 'ghost danger')));
  return parts;
}

const num = x => Number(String(x).replace(',', '.'));
const keyNum = x => String(x).replace('.', ',');

function keyEditor(cfg) {
  const k = cfg.key;
  const sek1 = h('div.key-grid',
    k.sek1.map(e => field(`Note ${e.grade} ab`, numInput(e.min, v => { e.min = Math.round(v * 100) / 100; }, { step: 0.05 }))),
    h('div.field', h('span', 'Note 6'), h('div.key-below', `unter ${keyNum(k.sek1.find(e => e.grade === 5).min)}`)));
  const sek2 = h('div.key-grid.sek2',
    k.sek2.map(e => field(`${e.pts} P. ab`, numInput(e.min, v => { e.min = Math.round(v * 100) / 100; }, { step: 0.01 }))),
    h('div.field', h('span', '0 P.'), h('div.key-below', `unter ${keyNum(k.sek2.find(e => e.pts === 1).min)}`)));
  return [
    h('h4', 'Sek I (Noten 1–6)'), sek1,
    h('h4', 'Sek II (11 GK, 12 GK: 15–0 Punkte)'),
    h('p.muted.small', 'Abgeleitet aus dem Sek-I-Schlüssel: jeder Notenbereich in drei gleich breite Stufen, Note 1 mit der Breite von Note 2, Note 6 = 0 Punkte. Einzelwerte sind änderbar.'),
    sek2,
    h('div.btnrow.left', btn('Sek-II-Schlüssel aus Sek I neu ableiten', async () => {
      if (!await confirmDialog('Sek-II-Schlüssel neu aus dem Sek-I-Schlüssel ableiten? Eigene Änderungen am Sek-II-Schlüssel gehen verloren.', { ok: 'Neu ableiten' })) return;
      k.sek2 = deriveSek2(k.sek1);
      save(); render();
    }, 'ghost')),
  ];
}

function catEditor(fach, cfg, c) {
  const desc = c.neutral ? 'wertungsfrei'
    : c.levels ? c.levels.map(l => (l.label === fmtPts(Number(l.pts)) ? l.label : `${l.label} ${fmtPts(Number(l.pts))}`)).join(' · ')
      : [Number.isFinite(c.plus) && fmtPts(c.plus), Number.isFinite(c.minus) && fmtPts(c.minus)].filter(Boolean).join(' / ');
  const body = [field('Bezeichnung', textInput(c.label, v => { if (v) c.label = v; }))];
  if (!c.neutral) {
    body.push(field('Abschnitt im Bewertungsmenü', (() => {
      const s = h('select', { onChange: e => { c.section = e.target.value; save(); } },
        cfg.sections.filter(x => x.id !== 'neutral').map(x => h('option', { value: x.id }, x.label)));
      s.value = c.section;
      return s;
    })()));
    if (c.levels) {
      body.push(h('div.points-row', c.levels.map(l => field(`Punkte „${l.label}“`, numInput(l.pts, v => { l.pts = Math.round(v * 100) / 100; }, { step: 1 })))));
    } else {
      // leer = diese Richtung gibt es nicht
      const ptsInput = (val, set) => h('input', {
        type: 'number', step: 1, inputmode: 'decimal', value: Number.isFinite(val) ? val : '', placeholder: '– nicht möglich –',
        onChange: e => {
          const raw = String(e.target.value).trim();
          if (raw === '') set(undefined);
          else if (Number.isFinite(num(raw))) set(Math.round(num(raw) * 100) / 100);
          save();
        },
      });
      body.push(h('div.points-row',
        field('Punkte bei Plus (leer = kein Plus)', ptsInput(c.plus, v => { c.plus = v === undefined ? undefined : Math.abs(v); })),
        field('Punkte bei Minus (leer = kein Minus)', ptsInput(c.minus, v => { c.minus = v === undefined ? undefined : -Math.abs(v); }))));
    }
  }
  if (c.id !== 'abwesend' && c.id !== 'befreit') {
    body.push(field('Unterkategorien (eine pro Zeile, optional)', textArea((c.subs || []).join('\n'), v => {
      c.subs = v.split('\n').map(s => s.trim()).filter(Boolean);
    }, 3)));
  }
  body.push(field('Hinweis im Bewertungsmenü (optional)', textInput(c.hint, v => { c.hint = v; })));
  if (!c.neutral) {
    if (!c.fb) c.fb = {};
    if (fach === 'pb') {
      const s = h('select', { onChange: e => { c.fb.area = e.target.value; save(); } }, cfg.areas.map(a => h('option', { value: a.id }, a.label)));
      s.value = c.fb.area || 'beteiligung';
      body.push(field('Feedback-Bereich', s));
    }
    const hasPlus = c.levels ? c.levels.some(l => l.pts > 0) : Number.isFinite(c.plus);
    const hasMinus = c.levels ? c.levels.some(l => l.pts < 0) : Number.isFinite(c.minus);
    if (hasPlus && c.id !== 'rede') body.push(field('Feedback-Satz bei Plus', textArea(c.fb.plus, v => { c.fb.plus = v; }, 2)));
    if (hasMinus) body.push(field('Feedback-Satz bei Minus', textArea(c.fb.minus, v => { c.fb.minus = v; }, 2)));
    if (fach === 'sport' && hasMinus) body.push(field('Tipp (wenn diese Kategorie am stärksten ins Minus geht)', textArea(c.fb.tip, v => { c.fb.tip = v; }, 2)));
  }
  if (c.id !== 'abwesend') body.push(check('Im Bewertungsmenü ausblenden', c.hidden, v => { c.hidden = v; save(); }));
  if (!SYSTEM_CATS.includes(c.id) && c.custom) {
    body.push(h('div.btnrow.left', btn('Kategorie löschen', async () => {
      const used = S.data.groups.some(g => g.fach === fach && g.entries.some(e => e.cat === c.id));
      const msg = used ? 'Diese Kategorie wird bereits verwendet. Die vorhandenen Einträge zählen dann nicht mehr zur Note. Besser „ausblenden“. Trotzdem löschen?' : 'Kategorie löschen?';
      if (!await confirmDialog(msg, { ok: 'Löschen', danger: true })) return;
      cfg.cats = cfg.cats.filter(x => x !== c);
      save(); render();
    }, 'ghost danger')));
  }
  return h('details.cat-edit', h('summary', h('span', c.label), h('small', desc + (c.hidden ? ' · ausgeblendet' : ''))), h('div.set-body', body));
}

// ---------- Allgemein ----------

function generalSection() {
  const st = S.data.settings;
  const bellText = st.bell.map(b => `${b.nr} ${b.start}-${b.end}`).join('\n');
  const bellErr = h('p.error');
  const bell = textArea(bellText, v => {
    const out = [];
    for (const line of v.split('\n').map(s => s.trim()).filter(Boolean)) {
      const m = line.match(/^(\d{1,2})\D+(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);
      if (!m) { bellErr.textContent = `Zeile nicht verstanden: „${line}“ (Format: 1 08:00-08:45)`; return; }
      const p2 = n => String(n).padStart(2, '0');
      out.push({ nr: Number(m[1]), start: `${p2(m[2])}:${m[3]}`, end: `${p2(m[4])}:${m[5]}` });
    }
    bellErr.textContent = '';
    st.bell = out.sort((a, b) => a.start.localeCompare(b.start));
  }, 8);
  return [
    field('Schuljahr (Anzeige)', textInput(st.schuljahr, v => { st.schuljahr = v; })),
    field('Automatische Sperre nach … Minuten ohne Bedienung', numInput(st.lockMinutes, v => { st.lockMinutes = Math.min(30, Math.max(1, Math.round(v))); }, { min: 1, max: 30 })),
    field('Erinnerung an Sicherung nach … Tagen', numInput(st.backupReminderDays, v => { st.backupReminderDays = Math.min(60, Math.max(1, Math.round(v))); }, { min: 1, max: 60 })),
    field('Klingelzeiten (eine Stunde pro Zeile, z. B. „1 08:00-08:45“)', bell, 'Damit wird bei jedem Eintrag die Stunde automatisch ermittelt.'),
    bellErr,
  ];
}

// ---------- PIN und Sicherungspasswort ----------

const pinField = (name, label) => ({ name, label, type: 'password', inputmode: 'numeric', maxlength: 4, required: true, placeholder: '4 Ziffern' });

function securitySection() {
  const legacyBox = h('div');
  hasLegacyCopy().then(has => {
    if (!has) return;
    legacyBox.append(
      h('h3', 'Stand vor dem Update'),
      h('p.muted', 'Beim Umstieg auf Version 2 wurde eine interne Kopie der alten Daten angelegt. Sie lässt sich mit dem alten App-Passwort wiederherstellen; die aktuellen Daten werden dabei ersetzt.'),
      h('div.btnrow.left', btn('Stand vor dem Update wiederherstellen …', async () => {
        const res = await formDialog({
          title: 'Stand vor dem Update',
          intro: h('p.warnbox', 'Alle Einträge seit dem Update gehen verloren. Vorher eine Sicherung erstellen!'),
          fields: [{ name: 'pw', label: 'Altes App-Passwort', type: 'password', required: true }],
          ok: 'Weiter', danger: true,
        });
        if (!res) return;
        const data = await readLegacyCopy(res.pw);
        if (!data) { alertDialog('Falsches Passwort', 'Die Kopie konnte mit diesem Passwort nicht entschlüsselt werden.'); return; }
        if (!await confirmDialog('Aktuelle Daten wirklich durch den Stand vor dem Update ersetzen?', { ok: 'Ersetzen', danger: true })) return;
        clearUndo();
        await replaceData(data);
        toast('Stand vor dem Update wiederhergestellt.');
        go({ name: 'start' });
      }, 'ghost danger')));
  });
  return [
    h('p.muted', 'Die PIN entsperrt die App auf diesem iPad. Das Sicherungspasswort verschlüsselt die Sicherungsdateien.'),
    h('div.btnrow.left',
      btn('PIN ändern …', async () => {
        const res = await formDialog({
          title: 'PIN ändern',
          fields: [pinField('old', 'Bisherige PIN'), pinField('n1', 'Neue PIN'), pinField('n2', 'Neue PIN wiederholen')],
          validate: o => (!/^\d{4}$/.test(o.n1) ? 'Die PIN besteht aus genau 4 Ziffern.'
            : weakPin(o.n1) ? 'Diese PIN ist zu leicht zu erraten.'
              : o.n1 !== o.n2 ? 'Die neuen PINs stimmen nicht überein.' : null),
        });
        if (!res) return;
        if (await changePin(res.old, res.n1)) toast('PIN geändert.');
        else alertDialog('Nicht geändert', 'Die bisherige PIN ist falsch.');
      }, 'ghost'),
      btn('Sicherungspasswort ändern …', async () => {
        const res = await formDialog({
          title: 'Sicherungspasswort ändern',
          intro: h('p.warnbox', 'Gilt für alle neuen Sicherungen. Ältere Sicherungsdateien lassen sich nur mit dem damaligen Sicherungspasswort öffnen.'),
          fields: [
            { name: 'n1', label: 'Neues Sicherungspasswort (mind. 10 Zeichen)', type: 'password', required: true },
            { name: 'n2', label: 'Wiederholen', type: 'password', required: true },
          ],
          validate: o => (o.n1.length < 10 ? 'Mindestens 10 Zeichen.' : o.n1 !== o.n2 ? 'Die Passwörter stimmen nicht überein.' : null),
        });
        if (!res) return;
        await changeBackupPassword(res.n1);
        toast('Sicherungspasswort geändert. Bitte gleich eine neue Sicherung erstellen.');
      }, 'ghost')),
    legacyBox,
  ];
}

// ---------- Schuljahr abschließen ----------

function yearEndSection() {
  return [
    h('p', 'Löscht nach doppelter Bestätigung die Daten des Schuljahres von diesem Gerät. Vorher unbedingt eine Sicherung erstellen.'),
    h('div.btnrow.left', btn('Schuljahr abschließen …', yearEndFlow, 'danger')),
  ];
}

async function yearEndFlow() {
  const r1 = await formDialog({
    title: 'Schuljahr abschließen (1/2)',
    intro: h('div',
      h('p', 'Damit werden alle Schüler:innen, Einträge, Noten, Feedbacks, Sitzpläne und Aufgaben dauerhaft von diesem Gerät gelöscht.'),
      h('p.warnbox', 'Wurde eine aktuelle Sicherung erstellt? Ohne Sicherung sind die Daten unwiederbringlich verloren.')),
    fields: [{ name: 'keep', label: 'Klassen, Fächer und Einstellungen behalten (nur Schülerdaten löschen)', type: 'checkbox', value: true }],
    ok: 'Weiter', danger: true,
  });
  if (!r1) return;
  const r2 = await formDialog({
    title: 'Endgültig löschen? (2/2)',
    intro: r1.keep ? 'Alle Schülerdaten werden gelöscht. Klassen und Einstellungen bleiben.' : 'ALLE Daten einschließlich Passwort werden gelöscht. Die App startet danach neu.',
    fields: [{ name: 'w', label: 'Zur Bestätigung LÖSCHEN eintippen', required: true }],
    ok: 'Endgültig löschen', danger: true,
    validate: o => (o.w.toUpperCase() === 'LÖSCHEN' ? null : 'Bitte genau „LÖSCHEN“ eintippen.'),
  });
  if (!r2) return;
  clearUndo();
  if (r1.keep) {
    for (const g of S.data.groups) resetGroup(g);
    S.data.settings.lastBackup = null;
    S.data.settings.lastGroup = {};
    await flush();
    toast('Schuljahr abgeschlossen – Schülerdaten gelöscht.');
    go({ name: 'start' });
  } else {
    await wipeAll();
    go({ name: 'start' });
  }
}

// ---------- Über ----------

function aboutSection() {
  const ver = h('strong', swState.version || '–');
  return [
    h('p', 'App-Version: ', ver, ` · Datenformat: ${SCHEMA_VERSION}`),
    swState.waiting
      ? h('div.banner.update', h('span', 'Update verfügbar – vorher Sicherung erstellen.'), h('div.banner-actions', btn('Jetzt aktualisieren', applyUpdate, 'primary')))
      : h('div.btnrow.left', btn('Nach Update suchen', async () => {
        try { await checkForUpdate(); } catch { /* offline */ }
        setTimeout(() => { toast(swState.waiting ? 'Update gefunden.' : 'Keine neue Version gefunden.'); render(); }, 1500);
      }, 'ghost')),
    h('h3', 'Datenschutz'),
    h('ul.plain',
      h('li', 'Alle Daten liegen ausschließlich auf diesem Gerät (IndexedDB), verschlüsselt mit AES-GCM (256 Bit).'),
      h('li', 'Der Datenschlüssel ist doppelt gesichert: durch einen nicht exportierbaren, gerätegebundenen Schlüssel und durch die PIN (PBKDF2, SHA-256, 600.000 Durchläufe). Entsperrt liegt er nur im Arbeitsspeicher.'),
      h('li', 'Nach 5 falschen PIN-Eingaben gibt es eine steigende Wartezeit.'),
      h('li', 'Sicherungsdateien sind mit dem Sicherungspasswort verschlüsselt (PBKDF2 → AES-GCM).'),
      h('li', 'Keine Server, keine Cloud, keine KI-Dienste, keine Analyse, keine externen Schriften oder Bibliotheken. Eine strenge Content-Security-Policy verhindert Verbindungen zu fremden Servern.'),
      h('li', 'Automatische Sperre nach Inaktivität und beim Wechsel in den Hintergrund (nach 1 Minute).'),
      h('li', 'Pro Person werden nur Vorname und ggf. ein Initial gespeichert.')),
  ];
}
