// Ansicht einer Lerngruppe (Klasse + Fach) mit Reitern

import { h, today, fmtShort } from '../util.js';
import { S, save, getGroup, getClass, groupsOfClass, sortedStudents, studentLabel, isSek2, subjCfg } from '../model.js';
import { scaleView } from '../explain.js';
import { presentScale } from './present.js';
import { go, render } from '../nav.js';
import { topbar, toast } from '../ui.js';
import { SUBJECT_LABELS, SUBJECT_NAMES } from '../defaults.js';
import { canUndo, undo, lastUndoLabel } from '../undo.js';
import { currentPeriod, scoreOf, dayStatus, exemptionInfo, lessonValue, fmtPct } from '../grading.js';
import { sel, resetSel, infoBar, selectionBar, scoreBadge, pressable, emptyStudents } from './common.js';
import { openRateSheet, tapStudent, longStudent } from './rate.js';
import { renderSeatplan } from './seatplan.js';
import { renderWritten } from './written.js';
import { renderEntries } from './entries.js';
import { renderPeriods } from './periods.js';
import { renderStudents } from './students.js';

const TABS = {
  sport: [['erfassen', 'Erfassen'], ['eintraege', 'Nachweis'], ['zeitraum', 'Zeiträume & Noten'], ['schueler', 'Schülerliste']],
  pb: [['sitzplan', 'Mündlich'], ['schriftlich', 'Schriftlich'], ['eintraege', 'Nachweis'], ['zeitraum', 'Zeiträume & Noten'], ['schueler', 'Schülerliste']],
};
const SHARED_TABS = ['eintraege', 'zeitraum', 'schueler'];

export function renderGroup(root, v) {
  const g = getGroup(v.groupId);
  if (!g) { go({ name: 'start' }); return; }
  if (sel.gid !== g.id) resetSel(g.id);
  const cls = getClass(g.classId);
  const sibs = groupsOfClass(cls.id);
  const tabs = TABS[g.fach];
  let tab = tabs.some(t => t[0] === v.tab) ? v.tab : tabs[0][0];
  if (!g.students.length && !v.tab) tab = 'schueler';
  if (S.data.settings.lastGroup[cls.id] !== g.id) { S.data.settings.lastGroup[cls.id] = g.id; save(); }

  const subj = sibs.length > 1
    ? h('div.seg.subj', sibs.map(s => h('button' + (s.id === g.id ? '.active.' + s.fach : ''), {
      type: 'button',
      onClick: () => { if (s.id !== g.id) go({ name: 'group', groupId: s.id, tab: SHARED_TABS.includes(tab) ? tab : null }); },
    }, SUBJECT_LABELS[s.fach])))
    : h('span.subj-badge.' + g.fach, SUBJECT_NAMES[g.fach]);

  const undoBtn = h('button.btn.ghost.undo', {
    type: 'button',
    disabled: !canUndo(),
    title: canUndo() ? 'Rückgängig: ' + lastUndoLabel() : 'Nichts rückgängig zu machen',
    onClick: () => { const l = undo(); if (l) { toast('Rückgängig gemacht: ' + l); render(); } },
  }, '↶ Rückgängig');

  const scaleBtn = h('button.btn.ghost', {
    type: 'button', title: 'Bewertungsmaßstab für die Klasse zeigen (ohne Schülerdaten)',
    onClick: () => presentScale(scaleView(g.fach, isSek2(g))),
  }, 'Maßstab');
  root.append(h('div.sticky-head',
    topbar({
      left: h('button.btn.ghost.back', { type: 'button', onClick: () => go({ name: 'start' }) }, '‹ Klassen'),
      center: h('div.tb-center-row', h('div.tb-title', cls.name), subj),
      right: [scaleBtn, undoBtn],
    }),
    h('nav.tabs.' + g.fach, tabs.map(([id, label]) => h('button.tab' + (id === tab ? '.active' : ''), {
      type: 'button',
      onClick: () => go({ name: 'group', groupId: g.id, tab: id }),
    }, label)))));

  const main = h('main.content');
  root.append(main);
  const vv = { ...v, tab };
  if (tab === 'erfassen') renderSportList(main, g);
  else if (tab === 'sitzplan') renderSeatplan(main, g);
  else if (tab === 'schriftlich') renderWritten(main, g, vv);
  else if (tab === 'eintraege') renderEntries(main, g, vv);
  else if (tab === 'zeitraum') renderPeriods(main, g, vv);
  else renderStudents(main, g);
}

function renderSportList(main, g) {
  if (!g.students.length) { main.append(emptyStudents(g)); return; }
  const p = currentPeriod(g);
  const t = today();
  main.append(...infoBar(g, p));
  const rows = sortedStudents(g).map(st => ({ st, ds: dayStatus(g, st.id, t) }));
  rows.sort((a, b) => a.ds.inactive - b.ds.inactive); // stabil: Abwesende/Befreite ans Ende
  const grid = h('div.sgrid');
  for (const { st, ds } of rows) {
    const sc = p ? scoreOf(g, st.id, p) : null;
    const tags = [];
    if (ds.absent) tags.push(h('span.tag.absent', 'nicht anwesend'));
    if (ds.exempt) {
      const info = exemptionInfo(g, ds.exempt);
      tags.push(h('span.tag.exempt', `befreit bis ${fmtShort(ds.exempt.extra.bis)}` + (info.excused ? '' : info.overdue ? ' · unentschuldigt' : ' · Attest fehlt')));
    }
    if (ds.limited) tags.push(h('span.tag.limited', 'eingeschränkt'));
    const lv = p && g.lessons.includes(t) ? lessonValue(g, st.id, t) : null;
    if (lv && lv.graded && (lv.note || lv.value !== Number(subjCfg(g).start))) tags.push(h('span.tag', { title: 'Stundenwert heute' }, `heute ${fmtPct(lv.value)}${lv.note ? ' · ' + lv.note : ''}`));
    const card = h('div.scard' + (ds.inactive ? '.inactive' : '') + (sel.ids.has(st.id) ? '.selected' : ''),
      { role: 'button', tabindex: 0, 'aria-label': studentLabel(st) },
      h('div.scard-top', h('span.sname', studentLabel(st))),
      sc && h('div.scard-score', scoreBadge(g, sc)),
      h('div.scard-status', tags));
    pressable(card, () => tapStudent(g, st.id), () => longStudent(g, st.id));
    grid.append(card);
  }
  main.append(grid);
  const bar = selectionBar(rows.filter(r => !r.ds.inactive).map(r => r.st.id), () => openRateSheet(g, [...sel.ids]));
  if (bar) { main.classList.add('with-selbar'); main.append(bar); }
}
