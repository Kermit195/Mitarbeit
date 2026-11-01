// Nachweis: Einträge einsehen, bearbeiten, löschen

import { h, fmtDate, fmtShort, weekday } from '../util.js';
import { save, subjCfg, sortedStudents, studentLabel, findStudent } from '../model.js';
import { go, render } from '../nav.js';
import { formDialog, confirmDialog } from '../ui.js';
import { periodsOf, currentPeriod, inRange, catOf, entryLabel } from '../grading.js';
import { pushUndo } from '../undo.js';
import { studentSummary } from './common.js';

export function renderEntries(main, g, v) {
  const periods = periodsOf(g);
  const cur = currentPeriod(g);
  const pid = v.periodId || (cur ? cur.id : 'all');
  const p = periods.find(x => x.id === pid) || null;
  const sid = v.sid && findStudent(g, v.sid) ? v.sid : null;

  const ssel = h('select', { onChange: e => go({ ...v, sid: e.target.value || null, periodId: pid }) },
    h('option', { value: '' }, 'Alle Schüler:innen'),
    sortedStudents(g).map(st => h('option', { value: st.id }, studentLabel(st))));
  ssel.value = sid || '';
  const psel = h('select', { onChange: e => go({ ...v, sid, periodId: e.target.value }) },
    h('option', { value: 'all' }, 'Alle Zeiträume'),
    periods.map(x => h('option', { value: x.id }, `${x.label} (${fmtShort(x.start)}–${fmtShort(x.end)})`)));
  psel.value = p ? p.id : 'all';
  main.append(h('div.toolbar', h('label.inline', 'Person ', ssel), h('label.inline', 'Zeitraum ', psel)));

  if (sid) main.append(studentSummary(g, sid, p));

  const list = g.entries
    .filter(e => (!sid || e.sid === sid) && (!p || inRange(e.date, p)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
  if (!list.length) { main.append(h('p.empty', 'Keine Einträge in dieser Auswahl.')); return; }

  const box = h('div.entrylist');
  let last = null;
  for (const e of list) {
    if (e.date !== last) {
      last = e.date;
      box.append(h('h4.datehead', `${weekday(e.date)} ${fmtDate(e.date)}`));
    }
    box.append(entryRow(g, e, !sid));
  }
  main.append(h('p.hint', 'Eintrag antippen, um ihn zu bearbeiten oder zu löschen.'), box);
}

function extraText(g, e) {
  if (e.cat === 'befreit' && e.extra) return ` · bis ${fmtDate(e.extra.bis)}, Attest: ${e.extra.attest ? 'ja' : 'nein'}`;
  if (e.cat === 'abwesend' && g.fach === 'sport' && e.extra) return ` · Entschuldigung: ${e.extra.excuse}`;
  return '';
}

function entryRow(g, e, showName) {
  const cfg = subjCfg(g);
  const kind = e.sign > 0 ? 'plus' : e.sign < 0 ? 'minus' : 'neutral';
  return h('button.entry', { type: 'button', onClick: () => editEntry(g, e) },
    h('span.e-sign.' + kind, e.sign > 0 ? '+' : e.sign < 0 ? '−' : '•'),
    h('span.e-main',
      showName && h('strong', studentLabel(findStudent(g, e.sid)) + ': '),
      entryLabel(cfg, e), extraText(g, e),
      e.note && h('span.e-note', e.note)),
    h('span.e-meta', e.stunde ? `${e.stunde}. Std.` : ''));
}

async function editEntry(g, e) {
  const cfg = subjCfg(g);
  const c = catOf(cfg, e.cat);
  const fields = [
    { name: 'date', label: 'Datum', type: 'date', value: e.date, required: true },
    { name: 'stunde', label: 'Stunde', type: 'number', min: 0, max: 12, value: e.stunde || '' },
  ];
  if (c && c.plus && c.minus) fields.push({ name: 'sign', label: 'Wertung', type: 'select', options: [['1', '+ positiv'], ['-1', '− negativ']], value: String(e.sign) });
  if (c && c.levels) fields.push({ name: 'level', label: 'Anforderungsbereich', type: 'select', options: c.levels.map(l => [l.id, l.label]), value: e.level });
  if (c && c.subs && c.subs.length) {
    const subs = c.subs.includes(e.sub) || !e.sub ? c.subs : [...c.subs, e.sub];
    fields.push({ name: 'sub', label: 'Unterkategorie', type: 'select', options: [['', '– ohne –'], ...subs.map(s => [s, s])], value: e.sub || '' });
  }
  if (e.cat === 'befreit') {
    fields.push({ name: 'bis', label: 'befreit bis', type: 'date', value: e.extra?.bis, required: true });
    fields.push({ name: 'attest', label: 'Attest liegt vor', type: 'checkbox', value: !!e.extra?.attest });
  }
  if (e.cat === 'abwesend' && g.fach === 'sport') {
    fields.push({ name: 'excuse', label: 'Entschuldigung', type: 'select', options: [['offen', 'offen'], ['liegt vor', 'liegt vor'], ['nicht nachgereicht', 'nicht nachgereicht']], value: e.extra?.excuse || 'offen' });
  }
  fields.push({ name: 'note', label: 'Bemerkung', type: 'textarea', rows: 3, value: e.note || '' });

  const res = await formDialog({
    title: `${studentLabel(findStudent(g, e.sid))}: ${entryLabel(cfg, e)}`,
    fields,
    ok: 'Speichern',
    onDeleteLabel: 'Löschen',
  });
  if (!res) return;
  if (res === 'DELETE') {
    if (!await confirmDialog('Diesen Eintrag löschen?', { ok: 'Löschen', danger: true })) return;
    pushUndo(g, 'Eintrag gelöscht');
    g.entries = g.entries.filter(x => x !== e);
    save();
    render();
    return;
  }
  pushUndo(g, 'Eintrag bearbeitet');
  e.date = res.date;
  e.stunde = res.stunde || 0;
  if ('sign' in res) e.sign = Number(res.sign);
  if ('level' in res) e.level = res.level;
  if ('sub' in res) { if (res.sub) e.sub = res.sub; else delete e.sub; }
  if (e.cat === 'befreit') e.extra = { ...e.extra, bis: res.bis, attest: res.attest };
  if ('excuse' in res) e.extra = { ...e.extra, excuse: res.excuse };
  if (res.note) e.note = res.note; else delete e.note;
  save();
  render();
}
