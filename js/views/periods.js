// Zeiträume & Noten: individuelle Zeiträume, gezählte Stunden, Notenvorschläge, Abschluss

import { h, uid, today, addDays, fmtDate, fmtShort, isoDate, daysBetween, weekday } from '../util.js';
import { save, subjCfg, sortedStudents, studentLabel, addLesson, removeLesson } from '../model.js';
import { go, render } from '../nav.js';
import { btn, formDialog, confirmDialog, alertDialog, toast } from '../ui.js';
import { periodsOf, scoreOf, hintsOf, redeStats, lessonsIn, fmtPerLesson, fmtPts } from '../grading.js';
import { pushUndo } from '../undo.js';
import { fmtGrade, NOTE_ZERO } from './common.js';
import { openWizard } from './wizard.js';

export function renderPeriods(main, g, v) {
  if (v.periodId) {
    const p = periodsOf(g).find(x => x.id === v.periodId);
    if (p) { renderDetail(main, g, v, p); return; }
  }
  main.append(h('div.toolbar',
    h('span.muted', g.fach === 'sport'
      ? 'Jeder Zeitraum wird einzeln angelegt (Vorschlag: 4 Wochen).'
      : 'Zwei Mitarbeitsnoten pro Halbjahr – Beginn und Ende jeweils frei festlegen.'),
    h('span.spacer'),
    btn('＋ Zeitraum anlegen', () => editPeriod(g, null), 'primary')));

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
    const nLessons = lessonsIn(g, p).length;
    list.append(h('div.listrow-wrap',
      h('button.listrow', { type: 'button', onClick: () => go({ ...v, periodId: p.id }) },
        h('div.lr-main', h('strong', p.label),
          h('small', `${fmtDate(p.start)} – ${fmtDate(p.end)} · ${nLessons} ${nLessons === 1 ? 'Stunde' : 'Stunden'} gezählt`)),
        h('div.lr-side', h('span.status.' + cls, status), confirmed ? h('small', `${confirmed}/${g.students.length} Noten bestätigt`) : null)),
      !p.orphan && btn('Bearbeiten', () => editPeriod(g, g.periods.find(x => x.id === p.id)), 'ghost')));
  }
  main.append(list);
}

async function editPeriod(g, per) {
  const cfg = subjCfg(g);
  const weeks = Number(cfg.periodWeeks) || 4;
  const proposeEnd = start => addDays(start, weeks * 7 - 1);
  const last = [...g.periods].sort((a, b) => a.end.localeCompare(b.end)).pop();
  const start = per ? per.start : last && last.end >= today() ? addDays(last.end, 1) : today();
  const defaultName = g.fach === 'sport' ? `Block ${g.periods.length + 1}` : `${g.periods.length + 1}. Mitarbeitsnote`;
  let endTouched = !!per;
  const res = await formDialog({
    title: per ? 'Zeitraum bearbeiten' : 'Zeitraum anlegen',
    fields: [
      { name: 'name', label: 'Bezeichnung', value: per ? per.name : defaultName, required: true },
      {
        name: 'start', label: 'Startdatum', type: 'date', value: start, required: true,
        onChange: inputs => { if (!endTouched && inputs.start.value) inputs.end.value = proposeEnd(inputs.start.value); },
      },
      {
        name: 'end', label: 'Enddatum', type: 'date', value: per ? per.end : proposeEnd(start), required: true,
        help: `Vorschlag: ${weeks} Wochen nach dem Start – frei änderbar.`,
        onChange: () => { endTouched = true; },
      },
    ],
    ok: per ? 'Speichern' : 'Anlegen',
    onDeleteLabel: per ? 'Löschen' : null,
    validate: o => (o.end >= o.start ? null : 'Das Enddatum liegt vor dem Startdatum.'),
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
  if (per) {
    Object.assign(per, { name: res.name, start: res.start, end: res.end });
    const rec = g.closed[per.id];
    if (rec) Object.assign(rec, { label: res.name, start: res.start, end: res.end });
  } else {
    g.periods.push({ id: uid(), name: res.name, start: res.start, end: res.end });
    g.periods.sort((a, b) => a.start.localeCompare(b.start));
  }
  save(); render();
}

function lessonsCard(g, p) {
  const dates = lessonsIn(g, p);
  return h('details.card.lessons',
    h('summary', `Gezählte Stunden in diesem Zeitraum: ${dates.length}`),
    h('p.muted.small', 'Eine Stunde wird automatisch gezählt, sobald an einem Tag ein Eintrag gemacht wird (Doppelstunde = 1 Stunde). Stunden ohne Einträge über „Heutige Stunde zählen“ oder hier hinzufügen.'),
    h('div.lesson-chips', dates.map(d => h('span.lesson-chip', `${weekday(d)} ${fmtShort(d)}`,
      h('button', {
        type: 'button', 'aria-label': `${fmtDate(d)} entfernen`,
        onClick: async () => {
          if (!await confirmDialog(`Stunde vom ${fmtDate(d)} nicht mehr zählen? Einträge dieses Tages bleiben erhalten.`, { ok: 'Entfernen', danger: true })) return;
          pushUndo(g, 'Stunde entfernt');
          removeLesson(g, d);
          save(); render();
        },
      }, '✕')))),
    h('div.btnrow.left', btn('＋ Stunde hinzufügen', async () => {
      const res = await formDialog({
        title: 'Stunde hinzufügen',
        fields: [{ name: 'date', label: 'Datum', type: 'date', value: today() > p.end ? p.end : today(), min: p.start, max: p.end, required: true }],
        ok: 'Hinzufügen',
        validate: o => (o.date >= p.start && o.date <= p.end ? null : 'Das Datum liegt nicht im Zeitraum.'),
      });
      if (!res) return;
      pushUndo(g, 'Stunde hinzugefügt');
      addLesson(g, res.date);
      save(); render();
    }, 'ghost')));
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
    h('span.muted', `${fmtDate(p.start)} – ${fmtDate(p.end)} · ${daysBetween(p.start, p.end) + 1} Tage`)));

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
  if (sts.some(st => results[st.id] && results[st.id].legacy)) {
    main.append(h('p.hint', 'Mit „altes System“ markierte Noten wurden vor dem Update (Start bei 3,0 ± Gewicht) bestätigt und bleiben unverändert.'));
  }
  main.append(lessonsCard(g, p));

  const hi = hintsOf(g, p);
  const rs = g.fach === 'pb' ? redeStats(g, p) : null;
  const table = h('table.grades-table',
    h('thead', h('tr',
      h('th', 'Name'), h('th', 'Std.'), h('th', 'Punkte'), h('th', 'P./Std.'), rs && h('th', 'Redebeitr.'),
      h('th', 'Vorschlag'), h('th', 'Note'), h('th', 'Hinweise'))),
    h('tbody', sts.map(st => {
      const sc = scoreOf(g, st.id, p);
      const r = results[st.id];
      const notes = hi.haeufung.filter(x => x.sid === st.id).map(x => h('span.tag.warn', `${x.n}× ${x.label}`));
      if (hi.luecken.some(x => x.sid === st.id)) notes.push(h('span.tag', 'wenig beobachtet'));
      if (r && r.confirmed && r.legacy) notes.push(h('span.tag', 'altes System'));
      else if (r && r.confirmed && r.grade !== r.proposalGrade) notes.push(h('span.tag', 'abweichend'));
      return h('tr.clickable', { onClick: () => openWizard(g, p, st.id) },
        h('th', studentLabel(st)),
        h('td', String(sc.lessons)),
        h('td', fmtPts(sc.sum)),
        h('td', fmtPerLesson(sc.perLesson)),
        rs && h('td', `${rs.counts[st.id] || 0} (Ø ${rs.avg.toFixed(1).replace('.', ',')})`),
        h('td', fmtGrade(g, sc.grade)),
        h('td', r && r.confirmed ? h('strong', fmtGrade(g, r.grade)) : h('span.muted', 'offen')),
        h('td.notes', notes));
    })));
  main.append(h('p.hint', `Punkte pro Stunde = Summe der Punkte ÷ anwesende Stunden. ${NOTE_ZERO}.`), h('div.table-wrap', table));

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
