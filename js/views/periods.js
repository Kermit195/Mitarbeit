// Zeiträume & Noten: Übersicht, Notenvorschläge, Abschluss

import { h, uid, today, addDays, fmtDate, isoDate, daysBetween } from '../util.js';
import { save, subjCfg, sortedStudents, studentLabel } from '../model.js';
import { go, render } from '../nav.js';
import { btn, formDialog, confirmDialog, alertDialog, toast } from '../ui.js';
import { periodsOf, scoreOf, hintsOf, redeStats } from '../grading.js';
import { pushUndo } from '../undo.js';
import { fmtValue, fmtGrade } from './common.js';
import { openWizard } from './wizard.js';

export function renderPeriods(main, g, v) {
  if (v.periodId) {
    const p = periodsOf(g).find(x => x.id === v.periodId);
    if (p) { renderDetail(main, g, v, p); return; }
  }
  const cfg = subjCfg(g);
  if (g.fach === 'sport') {
    const inp = h('input', {
      type: 'date', value: g.periodStart || cfg.blockStart,
      onChange: e => { if (!e.target.value) return; g.periodStart = e.target.value; save(); render(); },
    });
    main.append(h('div.card',
      h('label.field', h('span', 'Blöcke à 4 Wochen beginnen am'), inp),
      h('small.muted', 'Gilt für diese Lerngruppe. Den Standard für neue Lerngruppen gibt es in den Einstellungen.')));
  } else {
    main.append(h('div.toolbar',
      h('span.muted', 'Zwei Mitarbeitsnoten pro Halbjahr – Beginn und Dauer jeweils frei festlegen.'),
      h('span.spacer'),
      btn('＋ Zeitraum anlegen', () => editPbPeriod(g, null), 'primary')));
  }

  const ps = periodsOf(g).reverse();
  if (!ps.length) { main.append(h('p.empty', 'Noch kein Zeitraum angelegt.')); return; }
  const t = today();
  const list = h('div.list');
  for (const p of ps) {
    const rec = p.rec;
    let status, cls;
    if (rec && rec.closedAt) { status = `abgeschlossen am ${fmtDate(isoDate(new Date(rec.closedAt)))}`; cls = 'done'; }
    else if (t < p.start) { status = 'beginnt noch'; cls = 'future'; }
    else if (t <= p.end) { status = 'läuft'; cls = 'run'; }
    else { status = 'beendet – noch nicht abgeschlossen'; cls = 'open'; }
    const confirmed = rec ? Object.values(rec.results).filter(r => r.confirmed).length : 0;
    list.append(h('div.listrow-wrap',
      h('button.listrow', { type: 'button', onClick: () => go({ ...v, periodId: p.id }) },
        h('div.lr-main', h('strong', p.label), h('small', `${fmtDate(p.start)} – ${fmtDate(p.end)} · ${daysBetween(p.start, p.end) + 1} Tage`)),
        h('div.lr-side', h('span.status.' + cls, status), confirmed ? h('small', `${confirmed}/${g.students.length} Noten bestätigt`) : null)),
      g.fach === 'pb' && !p.orphan && btn('Bearbeiten', () => editPbPeriod(g, g.periods.find(x => x.id === p.id)), 'ghost')));
  }
  main.append(list);
}

async function editPbPeriod(g, per) {
  const last = [...g.periods].sort((a, b) => a.end.localeCompare(b.end)).pop();
  const start = per ? per.start : last ? addDays(last.end, 1) : today();
  const weeks = per ? Math.round((daysBetween(per.start, per.end) + 1) / 7) : 9;
  const res = await formDialog({
    title: per ? 'Zeitraum bearbeiten' : 'Zeitraum anlegen',
    fields: [
      { name: 'name', label: 'Bezeichnung', value: per ? per.name : `${g.periods.length + 1}. Mitarbeitsnote`, required: true },
      { name: 'start', label: 'Startdatum', type: 'date', value: start, required: true },
      { name: 'weeks', label: 'Dauer in Wochen', type: 'number', min: 1, max: 30, value: weeks, required: true },
    ],
    ok: per ? 'Speichern' : 'Anlegen',
    onDeleteLabel: per ? 'Löschen' : null,
    validate: o => (o.weeks >= 1 && o.weeks <= 30 ? null : 'Dauer: 1 bis 30 Wochen.'),
  });
  if (!res) return;
  if (res === 'DELETE') {
    const rec = g.closed[per.id];
    if (rec && Object.values(rec.results).some(r => r.confirmed)) {
      alertDialog('Nicht möglich', 'Für diesen Zeitraum wurden bereits Noten bestätigt. Er bleibt als Verlauf erhalten.');
      return;
    }
    if (!await confirmDialog(`Zeitraum „${per.name}“ löschen? Die Einträge selbst bleiben erhalten.`, { ok: 'Löschen', danger: true })) return;
    pushUndo(g, 'Zeitraum gelöscht');
    g.periods = g.periods.filter(x => x !== per);
    delete g.closed[per.id];
    save(); render();
    return;
  }
  pushUndo(g, per ? 'Zeitraum bearbeitet' : 'Zeitraum angelegt');
  const end = addDays(res.start, res.weeks * 7 - 1);
  if (per) {
    Object.assign(per, { name: res.name, start: res.start, end });
    const rec = g.closed[per.id];
    if (rec) Object.assign(rec, { label: res.name, start: res.start, end });
  } else {
    g.periods.push({ id: uid(), name: res.name, start: res.start, end });
  }
  save(); render();
}

function renderDetail(main, g, v, p) {
  const rec = g.closed[p.id];
  const closed = !!(rec && rec.closedAt);
  const sts = sortedStudents(g);
  const results = rec ? rec.results : {};
  const allConfirmed = sts.length > 0 && sts.every(st => results[st.id] && results[st.id].confirmed);

  main.append(h('div.toolbar',
    btn('‹ Alle Zeiträume', () => go({ ...v, periodId: null }), 'ghost'),
    h('h2.inline-title', p.label),
    h('span.muted', `${fmtDate(p.start)} – ${fmtDate(p.end)}`)));

  if (closed) {
    main.append(h('div.banner.done', h('span', `Abgeschlossen am ${fmtDate(isoDate(new Date(rec.closedAt)))}. Noten und Feedback bleiben als Verlauf erhalten.`),
      h('div.banner-actions', btn('Wieder öffnen', async () => {
        if (!await confirmDialog('Zeitraum wieder öffnen, um Noten zu ändern?', { ok: 'Öffnen' })) return;
        pushUndo(g, 'Zeitraum wieder geöffnet');
        rec.closedAt = null; save(); render();
      }, 'ghost'))));
  } else if (today() <= p.end) {
    main.append(h('p.hint', `Der Zeitraum läuft noch bis ${fmtDate(p.end)}. Ein Abschluss ist trotzdem möglich.`));
  }

  const hi = hintsOf(g, p);
  const rs = g.fach === 'pb' ? redeStats(g, p) : null;
  const table = h('table.grades-table',
    h('thead', h('tr',
      h('th', 'Name'), h('th', 'Einträge'), rs && h('th', 'Redebeitr.'), h('th', 'Vorschlag'), h('th', 'Note'), h('th', 'Hinweise'))),
    h('tbody', sts.map(st => {
      const sc = scoreOf(g, st.id, p);
      const r = results[st.id];
      const notes = hi.haeufung.filter(x => x.sid === st.id).map(x => h('span.tag.warn', `${x.n}× ${x.label}`));
      if (hi.luecken.some(x => x.sid === st.id)) notes.push(h('span.tag', 'wenig beobachtet'));
      if (r && r.confirmed && r.grade !== r.proposalRounded) notes.push(h('span.tag', 'abweichend'));
      return h('tr.clickable', { onClick: () => openWizard(g, p, st.id) },
        h('th', studentLabel(st)),
        h('td', String(sc.n)),
        rs && h('td', `${rs.counts[st.id] || 0} (Ø ${rs.avg.toFixed(1).replace('.', ',')})`),
        h('td', `${fmtValue(g, sc.value)} → ${fmtGrade(g, sc.rounded)}`),
        h('td', r && r.confirmed ? h('strong', fmtGrade(g, r.grade)) : h('span.muted', 'offen')),
        h('td.notes', notes));
    })));
  main.append(h('div.table-wrap', table));

  const first = sts.find(st => !(results[st.id] && results[st.id].confirmed)) || sts[0];
  main.append(h('div.btnrow.left',
    sts.length && btn(closed ? 'Noten und Feedback ansehen' : 'Abschluss starten (Person für Person)', () => openWizard(g, p, first.id), 'primary big'),
    !closed && btn('Zeitraum abschließen', async () => {
      if (!await confirmDialog('Zeitraum jetzt abschließen? Die bestätigten Noten werden als Verlauf gespeichert.', { ok: 'Abschließen' })) return;
      pushUndo(g, 'Zeitraum abgeschlossen');
      g.closed[p.id].closedAt = Date.now();
      save(); render();
      toast(`${p.label} abgeschlossen.`);
    }, 'ghost', { disabled: !allConfirmed, title: allConfirmed ? '' : 'Erst alle Noten bestätigen' })));
  if (!closed && !allConfirmed) main.append(h('p.hint', 'Abschließen ist möglich, sobald für alle eine Note bestätigt wurde (auch „keine Note“ ist möglich).'));
}
