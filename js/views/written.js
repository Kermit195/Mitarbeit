// PB: Reiter „Schriftlich“ – Aufgaben anlegen und bewerten

import { h, uid, today, fmtDate, fmtShort, weekday } from '../util.js';
import { save, subjCfg, sortedStudents, studentLabel, addLesson } from '../model.js';
import { go, render } from '../nav.js';
import { btn, formDialog, confirmDialog, openSheet, segmented } from '../ui.js';
import { periodsOf, currentPeriod, inRange, dayStatus, fmtDelta } from '../grading.js';
import { pushUndo } from '../undo.js';
import { emptyStudents } from './common.js';

const RES = [
  ['+', '+', 'plus'],
  ['o', 'o', 'neutral'],
  ['-', '−', 'minus'],
  ['na', 'nicht abgegeben', 'minus'],
  ['abs', 'nicht anwesend', 'neutral'],
];
const SYM = { '+': '+', o: 'o', '-': '−', na: 'n. a.', abs: 'abw.' };

export function renderWritten(main, g, v) {
  if (!g.students.length) { main.append(emptyStudents(g)); return; }
  const periods = periodsOf(g);
  const cur = currentPeriod(g);
  const pid = v.periodId || (cur ? cur.id : 'all');
  const p = periods.find(x => x.id === pid) || null;
  const mode = v.mode || 'liste';

  const psel = h('select', { onChange: e => go({ ...v, periodId: e.target.value }) },
    h('option', { value: 'all' }, 'Alle Zeiträume'),
    periods.map(x => h('option', { value: x.id }, `${x.label} (${fmtShort(x.start)}–${fmtShort(x.end)})`)));
  psel.value = p ? p.id : 'all';

  main.append(h('div.toolbar',
    h('label.inline', 'Zeitraum ', psel),
    segmented([['liste', 'Liste'], ['matrix', 'Übersicht']], mode, m => go({ ...v, mode: m, periodId: pid })),
    h('span.spacer'),
    btn('＋ Aufgabe anlegen', () => newTask(g), 'primary')));
  const pct = subjCfg(g).written.pct;
  main.append(h('p.hint', `Wirkung auf den Stundenwert des Aufgabendatums: + ${fmtDelta(pct['+'])} · o ${fmtDelta(pct.o)} · − ${fmtDelta(pct['-'])} · nicht abgegeben ${fmtDelta(pct.na)} · nicht anwesend wertungsfrei (wird bei Abwesenheit automatisch gesetzt).`));

  const tasks = g.tasks.filter(t => !p || inRange(t.date, p)).sort((a, b) => b.date.localeCompare(a.date));
  if (!tasks.length) { main.append(h('p.empty', 'Noch keine schriftlichen Aufgaben in diesem Zeitraum.')); return; }
  if (mode === 'matrix') main.append(matrix(g, [...tasks].reverse()));
  else main.append(h('div.list', tasks.map(t => taskRow(g, t))));
}

function counts(g, t) {
  const c = { '+': 0, o: 0, '-': 0, na: 0, abs: 0, offen: 0 };
  for (const st of g.students) {
    const r = t.results[st.id];
    if (r) c[r]++; else c.offen++;
  }
  return c;
}

function taskRow(g, t) {
  const c = counts(g, t);
  return h('button.listrow', { type: 'button', onClick: () => openTask(g, t) },
    h('div.lr-main', h('strong', t.title), h('small', `${t.art} · ${weekday(t.date)} ${fmtDate(t.date)}`)),
    h('div.lr-side',
      h('span.badge.plus', `+ ${c['+']}`),
      h('span.badge.neutral', `o ${c.o}`),
      h('span.badge.minus', `− ${c['-']}`),
      c.na ? h('span.badge.minus', `n. a. ${c.na}`) : null,
      c.abs ? h('span.badge.neutral', `abw. ${c.abs}`) : null,
      c.offen ? h('span.badge.open', `offen ${c.offen}`) : null));
}

function matrix(g, tasks) {
  const sts = sortedStudents(g);
  return h('div.table-wrap', h('table.matrix',
    h('thead', h('tr', h('th', 'Name'),
      tasks.map(t => h('th', { title: `${t.title} (${t.art})` }, h('div', fmtShort(t.date)), h('small', t.title.length > 14 ? t.title.slice(0, 13) + '…' : t.title))),
      h('th', '+'), h('th', '−'))),
    h('tbody', sts.map(st => {
      let plus = 0, minus = 0;
      const cells = tasks.map(t => {
        const r = t.results[st.id];
        if (r === '+') plus++;
        if (r === '-' || r === 'na') minus++;
        const cls = r === '+' ? 'plus' : r === '-' || r === 'na' ? 'minus' : r ? 'neutral' : 'open';
        return h('td.cell.' + cls, { onClick: () => openTask(g, t) }, r ? SYM[r] : '·');
      });
      return h('tr', h('th', studentLabel(st)), cells, h('td.sum.plus', String(plus)), h('td.sum.minus', String(minus)));
    }))));
}

async function newTask(g) {
  const cfg = subjCfg(g);
  const res = await formDialog({
    title: 'Schriftliche Aufgabe anlegen',
    fields: [
      { name: 'title', label: 'Titel', required: true, placeholder: 'z. B. Exit-Ticket Gewaltenteilung' },
      { name: 'date', label: 'Datum', type: 'date', value: today(), required: true },
      { name: 'art', label: 'Art', type: 'select', options: cfg.written.arts.map(a => [a, a]), value: cfg.written.arts[0] },
    ],
    ok: 'Anlegen',
  });
  if (!res) return;
  pushUndo(g, `Aufgabe „${res.title}“ angelegt`);
  const t = { id: uid(), title: res.title, date: res.date, art: res.art, results: {} };
  for (const st of g.students) if (dayStatus(g, st.id, res.date).absent) t.results[st.id] = 'abs';
  g.tasks.push(t);
  addLesson(g, res.date);
  save();
  render();
  openTask(g, t);
}

export function openTask(g, t) {
  const sheet = openSheet(t.title, [], { full: true, onClose: render });
  const build = () => {
    sheet.setTitle(t.title);
    const rows = sortedStudents(g).map(st => {
      const buttons = RES.map(([val, label, kind]) => h('button.wb.' + kind + (t.results[st.id] === val ? '.active' : ''), {
        type: 'button',
        dataset: { v: val },
        onClick: () => {
          pushUndo(g, `Schriftlich: ${t.title}`);
          if (t.results[st.id] === val) delete t.results[st.id]; else t.results[st.id] = val;
          save();
          for (const b of wrap.children) b.classList.toggle('active', t.results[st.id] === b.dataset.v);
        },
      }, label));
      const wrap = h('div.wbtns', buttons);
      return h('div.wrow', h('span.sname', studentLabel(st)), wrap);
    });
    sheet.setBody([
      h('div.toolbar',
        h('span.muted', `${t.art} · ${weekday(t.date)} ${fmtDate(t.date)}`),
        h('span.spacer'),
        btn('Alle offenen → o', () => {
          pushUndo(g, `Schriftlich: ${t.title}`);
          for (const st of g.students) if (!t.results[st.id]) t.results[st.id] = 'o';
          save(); build();
        }, 'ghost'),
        btn('Bearbeiten', () => editTask(g, t, build), 'ghost'),
        btn('Löschen', async () => {
          if (!await confirmDialog(`Aufgabe „${t.title}“ mit allen Bewertungen löschen?`, { ok: 'Löschen', danger: true })) return;
          pushUndo(g, `Aufgabe „${t.title}“ gelöscht`);
          g.tasks = g.tasks.filter(x => x !== t);
          save();
          sheet.close();
        }, 'ghost danger')),
      h('div.wlist', rows),
      h('div.btnrow', btn('Fertig', () => sheet.close(), 'primary big')),
    ]);
  };
  build();
}

async function editTask(g, t, rebuild) {
  const cfg = subjCfg(g);
  const arts = cfg.written.arts.includes(t.art) ? cfg.written.arts : [...cfg.written.arts, t.art];
  const res = await formDialog({
    title: 'Aufgabe bearbeiten',
    fields: [
      { name: 'title', label: 'Titel', value: t.title, required: true },
      { name: 'date', label: 'Datum', type: 'date', value: t.date, required: true },
      { name: 'art', label: 'Art', type: 'select', options: arts.map(a => [a, a]), value: t.art },
    ],
  });
  if (!res) return;
  pushUndo(g, `Aufgabe „${t.title}“ bearbeitet`);
  Object.assign(t, res);
  addLesson(g, t.date);
  for (const st of g.students) if (dayStatus(g, st.id, t.date).absent) t.results[st.id] = 'abs';
  save();
  rebuild();
}
