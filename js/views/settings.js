// Einstellungen: Klassen/Fächer, Kategorien je Fach, Allgemeines, Sicherheit, Sicherung

import { h, uid, fmtTimestamp } from '../util.js';
import { S, save, flush, addClass, newGroup, groupsOfClass, changePassword, resetGroup, wipeAll, SCHEMA_VERSION } from '../model.js';
import { go, render } from '../nav.js';
import { topbar, btn, formDialog, confirmDialog, alertDialog, toast } from '../ui.js';
import { SUBJECT_NAMES, SUBJECT_ORDER, FB_LABELS, SYSTEM_CATS, sportConfig, pbConfig } from '../defaults.js';
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
    section('Fach Sport: Kategorien, Gewichte, Schwellen, Feedback', subjectSection('sport')),
    section('Fach Politische Bildung: Kategorien, Gewichte, Schwellen, Feedback', subjectSection('pb')),
    section('Allgemein: Noten, Sperre, Klingelzeiten', generalSection()),
    section('Passwort', passwordSection()),
    section('Schuljahr abschließen', yearEndSection()),
    section('Über die App und Datenschutz', aboutSection()));
}

// ---------- Sicherung ----------

function backupSection() {
  const lb = S.data.settings.lastBackup;
  return [
    h('p', 'Letzte Sicherung: ', h('strong', lb ? fmtTimestamp(lb) : 'noch keine')),
    h('p.muted', 'Die Sicherungsdatei ist mit dem App-Passwort verschlüsselt. Zum Laden wird das Passwort benötigt, das beim Erstellen der Sicherung galt.'),
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
  const parts = [h('h3', 'Schwellen')];
  parts.push(field('Häufungshinweis ab dem … gleichen Minus-Eintrag im Zeitraum', numInput(th.haeufung, v => { th.haeufung = Math.max(2, Math.round(v)); }, { min: 2, max: 20 })));
  parts.push(field('Beobachtungslücke: weniger als … bewertende Einträge im Zeitraum', numInput(th.luecke, v => { th.luecke = Math.max(1, Math.round(v)); }, { min: 1, max: 50 })));
  if (fach === 'sport') {
    parts.push(field('Frist für Entschuldigungen (Tage)', numInput(th.excuseDays, v => { th.excuseDays = Math.max(1, Math.round(v)); }, { min: 1, max: 60 })));
    parts.push(field('Standard-Startdatum der 4-Wochen-Blöcke',
      h('input', { type: 'date', value: cfg.blockStart, onChange: e => { if (e.target.value) { cfg.blockStart = e.target.value; save(); } } }),
      'Gilt für alle Sport-Lerngruppen ohne eigenes Startdatum.'));
  } else {
    parts.push(field('Gewicht schriftlicher Aufgaben (+ / − / nicht abgegeben)', numInput(cfg.written.w, v => { cfg.written.w = Math.max(0, v); }, { step: 0.05, min: 0 })));
    parts.push(field('Arten schriftlicher Aufgaben (eine pro Zeile)', textArea(cfg.written.arts.join('\n'), v => {
      const arts = v.split('\n').map(s => s.trim()).filter(Boolean);
      if (arts.length) cfg.written.arts = arts;
    }, 4)));
  }

  parts.push(h('h3', 'Kategorien'));
  parts.push(h('p.muted', 'Gewichte gelten für Sek I. In Sek II werden sie automatisch mit 3 multipliziert. Änderungen wirken auf alle noch nicht abgeschlossenen Zeiträume.'));
  for (const c of cfg.cats) parts.push(catEditor(fach, cfg, c));
  parts.push(h('div.btnrow.left', btn('＋ Kategorie hinzufügen', () => {
    const sec = cfg.sections.find(s => s.id !== 'neutral');
    cfg.cats.push({ id: 'c' + uid(), label: 'Neue Kategorie', section: sec.id, w: 0.25, plus: true, minus: true, custom: true, subs: [], fb: fach === 'pb' ? { area: 'beteiligung' } : {} });
    save();
    render();
  }, 'ghost')));

  parts.push(h('h3', 'Allgemeine Feedback-Bausteine'));
  parts.push(h('p.muted', 'Platzhalter: {name} = Vorname, {subs} = notierte Unterkategorien.'));
  for (const k of Object.keys(cfg.fbGeneric)) {
    parts.push(field(FB_LABELS[k] || k, textArea(cfg.fbGeneric[k], v => { cfg.fbGeneric[k] = v; }, 2)));
  }

  parts.push(h('div.btnrow.left', btn(`${SUBJECT_NAMES[fach]}: alles auf Standard zurücksetzen`, async () => {
    if (!await confirmDialog('Kategorien, Gewichte, Schwellen und Feedback-Bausteine dieses Fachs auf den Standard zurücksetzen? Einträge bleiben erhalten.', { ok: 'Zurücksetzen', danger: true })) return;
    S.data.settings.subjects[fach] = fach === 'sport' ? sportConfig() : pbConfig();
    save();
    render();
  }, 'ghost danger')));
  return parts;
}

function catEditor(fach, cfg, c) {
  const fmtW = w => String(w).replace('.', ',');
  const desc = c.neutral ? 'neutral'
    : c.levels ? c.levels.map(l => `${l.label} ${fmtW(l.w)}`).join(' · ')
      : `${fmtW(c.w)} · ${[c.plus && '+', c.minus && '−'].filter(Boolean).join('/')}`;
  const body = [field('Bezeichnung', textInput(c.label, v => { if (v) c.label = v; }))];
  if (!c.neutral) {
    body.push(field('Abschnitt im Bewertungsmenü', (() => {
      const s = h('select', { onChange: e => { c.section = e.target.value; save(); } },
        cfg.sections.filter(x => x.id !== 'neutral').map(x => h('option', { value: x.id }, x.label)));
      s.value = c.section;
      return s;
    })()));
    if (c.levels) {
      for (const l of c.levels) body.push(field(`Gewicht ${l.label}`, numInput(l.w, v => { l.w = Math.max(0, v); }, { step: 0.05, min: 0 })));
    } else {
      body.push(field('Gewicht', numInput(c.w, v => { c.w = Math.max(0, v); }, { step: 0.05, min: 0 })));
      body.push(h('div.inline-checks',
        check('Plus möglich', c.plus, (v, el) => { if (!v && !c.minus) { el.checked = true; return; } c.plus = v; save(); }),
        check('Minus möglich', c.minus, (v, el) => { if (!v && !c.plus) { el.checked = true; return; } c.minus = v; save(); })));
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
    if (c.plus && !c.levels) body.push(field('Feedback-Satz bei Plus', textArea(c.fb.plus, v => { c.fb.plus = v; }, 2)));
    if (c.minus) body.push(field('Feedback-Satz bei Minus', textArea(c.fb.minus, v => { c.fb.minus = v; }, 2)));
    if (fach === 'sport' && c.minus) body.push(field('Tipp (wenn diese Kategorie am stärksten ins Minus geht)', textArea(c.fb.tip, v => { c.fb.tip = v; }, 2)));
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
  const rounding = h('select', { onChange: e => { st.rounding = e.target.value; save(); } },
    h('option', { value: 'math' }, 'mathematisch: 2,50 → 3'),
    h('option', { value: 'favor' }, 'zugunsten: 2,50 → 2'));
  rounding.value = st.rounding;
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
    field('Rundung des Notenvorschlags (Sek I)', rounding, 'Sek II: Notenpunkte werden kaufmännisch gerundet. Die Note wird in jedem Fall von der Lehrkraft bestätigt.'),
    field('Automatische Sperre nach … Minuten ohne Bedienung', numInput(st.lockMinutes, v => { st.lockMinutes = Math.min(30, Math.max(1, Math.round(v))); }, { min: 1, max: 30 })),
    field('Erinnerung an Sicherung nach … Tagen', numInput(st.backupReminderDays, v => { st.backupReminderDays = Math.min(60, Math.max(1, Math.round(v))); }, { min: 1, max: 60 })),
    field('Klingelzeiten (eine Stunde pro Zeile, z. B. „1 08:00-08:45“)', bell, 'Damit wird bei jedem Eintrag die Stunde automatisch ermittelt.'),
    bellErr,
  ];
}

// ---------- Passwort ----------

function passwordSection() {
  return [
    h('p.muted', 'Das neue Passwort gilt sofort. Ältere Sicherungsdateien lassen sich weiterhin nur mit dem damaligen Passwort öffnen.'),
    h('div.btnrow.left', btn('Passwort ändern …', async () => {
      const res = await formDialog({
        title: 'Passwort ändern',
        fields: [
          { name: 'old', label: 'Bisheriges Passwort', type: 'password', required: true },
          { name: 'n1', label: 'Neues Passwort (mind. 8 Zeichen)', type: 'password', required: true },
          { name: 'n2', label: 'Neues Passwort wiederholen', type: 'password', required: true },
        ],
        validate: o => (o.n1.length < 8 ? 'Mindestens 8 Zeichen.' : o.n1 !== o.n2 ? 'Die neuen Passwörter stimmen nicht überein.' : null),
      });
      if (!res) return;
      const ok = await changePassword(res.old, res.n1);
      if (ok) toast('Passwort geändert. Bitte gleich eine neue Sicherung erstellen.');
      else alertDialog('Nicht geändert', 'Das bisherige Passwort ist falsch.');
    }, 'ghost')),
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
      h('li', 'Der Schlüssel wird mit PBKDF2 (SHA-256, 600.000 Durchläufe) aus dem App-Passwort abgeleitet und nur im Arbeitsspeicher gehalten.'),
      h('li', 'Keine Server, keine Cloud, keine KI-Dienste, keine Analyse, keine externen Schriften oder Bibliotheken. Eine strenge Content-Security-Policy verhindert Verbindungen zu fremden Servern.'),
      h('li', 'Automatische Sperre nach Inaktivität und beim Wechsel in den Hintergrund (nach 1 Minute).'),
      h('li', 'Pro Person werden nur Vorname und ggf. ein Initial gespeichert.')),
  ];
}
