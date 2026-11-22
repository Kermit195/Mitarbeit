// Gemeinsame Bausteine der Lerngruppen-Ansichten

import { h, fmtShort, fmtDate, weekday, today } from '../util.js';
import { S, save, subjCfg, isSek2, findStudent, studentLabel, addLesson } from '../model.js';
import { render, go } from '../nav.js';
import { openSheet, btn } from '../ui.js';
import {
  hintsOf, exemptionsMissingAttest, scoreOf, lessonsIn, lessonValue, fmtPct, entryLabel, weakSek2,
} from '../grading.js';
import { evidence, explanationBlock, gradeName, SEK2_WARN } from '../explain.js';
import { pushUndo } from '../undo.js';

// Auswahlzustand (Mehrfachauswahl)
export const sel = { gid: null, multi: false, ids: new Set() };
export function resetSel(gid) { sel.gid = gid; sel.multi = false; sel.ids.clear(); }

export { gradeName };
export const fmtGrade = (g, n) => (n === null || n === undefined ? '–' : isSek2(g) ? `${n} P.` : String(n));

// Durchschnitt und vorläufige Note, z. B. „84 % · 2“ (bis zur Mindestzahl gewerteter Stunden: „vorl.“)
export function scoreBadge(g, sc) {
  if (sc.avg === null) return h('span.trend.flat', { title: 'Noch keine gewertete Stunde' }, '– %');
  const cls = sc.tone > 0 ? 'up' : sc.tone < 0 ? 'down' : 'flat';
  return h('span.trend.' + cls + (sc.provisional ? '.prov' : ''), {
    title: `Durchschnitt aus ${sc.graded} gewerteten Stunden${sc.provisional ? ' – vorläufig' : ''}`,
  }, `${fmtPct(Math.round(sc.avg))} · ${fmtGrade(g, sc.grade)}${sc.provisional ? ' vorl.' : ''}`);
}

// Tippen = Bewertungsmenü (bzw. Auswahl), langes Drücken = Mehrfachauswahl starten
export function pressable(el, onTap, onLong) {
  let t = null, sx = 0, sy = 0, active = false, suppress = false;
  el.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    active = true; suppress = false;
    sx = e.clientX; sy = e.clientY;
    clearTimeout(t);
    t = setTimeout(() => { if (active) { active = false; suppress = true; onLong(); } }, 550);
  });
  el.addEventListener('pointermove', e => {
    if (active && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) { active = false; clearTimeout(t); }
  });
  const stop = () => { clearTimeout(t); active = false; };
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
  el.addEventListener('click', () => { if (suppress) { suppress = false; return; } onTap(); });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(); } });
  el.addEventListener('contextmenu', e => e.preventDefault());
}

export function infoBar(g, p) {
  const items = [];
  if (p) items.push(h('span.period', `${p.label} · ${fmtShort(p.start)}–${fmtShort(p.end)}`));
  else items.push(h('button.chip-btn.warn', { type: 'button', onClick: () => go({ name: 'group', groupId: g.id, tab: 'zeitraum' }) }, 'Noch kein Zeitraum – jetzt anlegen'));
  const t = today();
  if (g.lessons.includes(t)) {
    items.push(h('span.chip-static.ok', { title: 'Heute zählt als Stunde. Entfernen unter „Zeiträume & Noten“.' }, '✓ Heute als Stunde gezählt'));
  } else {
    items.push(h('button.chip-btn', {
      type: 'button',
      title: 'Wird automatisch beim ersten Eintrag des Tages gezählt',
      onClick: () => { pushUndo(g, 'Stunde gezählt'); addLesson(g, t); save(); render(); },
    }, '＋ Heutige Stunde zählen'));
  }
  const att = exemptionsMissingAttest(g);
  if (att.length) {
    const od = att.filter(x => x.overdue).length;
    items.push(h('button.chip-btn' + (od ? '.warn' : ''), { type: 'button', onClick: () => openAttestSheet(g) },
      `Attest fehlt: ${att.length}` + (od ? ` (${od} unentschuldigt)` : '')));
  }
  const hi = hintsOf(g, p);
  if (hi.haeufung.length) items.push(h('button.chip-btn.warn', { type: 'button', onClick: () => openHintsSheet(g, p) }, `Häufungen: ${hi.haeufung.length}`));
  if (hi.luecken.length) items.push(h('button.chip-btn', { type: 'button', onClick: () => openHintsSheet(g, p) }, `Wenig beobachtet: ${hi.luecken.length}`));
  items.push(h('span.spacer'));
  items.push(h('button.chip-btn' + (sel.multi ? '.active' : ''), {
    type: 'button',
    onClick: () => { sel.multi = !sel.multi; sel.ids.clear(); render(); },
  }, sel.multi ? '✓ Mehrfachauswahl beenden' : '☐ Mehrfachauswahl'));
  const min = Number(S.data.settings.minLessons) || 4;
  return [h('div.infobar', items), h('p.hint', `Anzeige: Durchschnitt der gewerteten Stunden · vorläufige Note („vorl.“ unter ${min} gewerteten Stunden).`)];
}

export function selectionBar(activeIds, onGive) {
  if (!sel.multi) return null;
  const n = sel.ids.size;
  return h('div.selbar',
    h('span.selcount', n ? `${n} ausgewählt` : 'Namen antippen zum Auswählen'),
    btn('Alle Anwesenden', () => { activeIds.forEach(id => sel.ids.add(id)); render(); }, 'ghost'),
    btn('Keine', () => { sel.ids.clear(); render(); }, 'ghost'),
    btn('Eintrag geben', onGive, 'primary', { disabled: !n }));
}

export function emptyStudents(g) {
  return h('div.card.empty-card',
    h('p', 'Diese Lerngruppe hat noch keine Schülerliste.'),
    btn('Schülerliste anlegen', () => go({ name: 'group', groupId: g.id, tab: 'schueler' }), 'primary'));
}

// Befreiungen ohne Attest: Frist bis einschließlich der nächsten Sportstunde
export function openAttestSheet(g) {
  const s = openSheet('Sportbefreiung ohne Attest', [], { onClose: render });
  const build = () => {
    const list = exemptionsMissingAttest(g);
    if (!list.length) { s.setBody(h('p.empty', 'Alle Befreiungen haben ein Attest.')); return; }
    s.setBody([
      h('p.muted', 'Ohne Attest ist eine Befreiung bis einschließlich der nächsten Sportstunde wertungsfrei. Danach zählen ihre Stunden als unentschuldigt (0 %). Mit „Attest nachgereicht“ wird alles neu berechnet.'),
      list.map(({ e, deadline, overdue }) => h('div.excuse-row' + (overdue ? '.overdue' : ''),
        h('div', h('strong', studentLabel(findStudent(g, e.sid))),
          h('div.small.muted', `befreit ${fmtShort(e.date)}–${fmtShort(e.extra.bis)} · `
            + (overdue ? `unentschuldigt seit ${fmtDate(deadline)}` : deadline ? `Attest bis einschließlich ${weekday(deadline)} ${fmtDate(deadline)}` : 'Attest bis zur nächsten Sportstunde'))),
        h('div.btnrow', btn('✓ Attest nachgereicht', () => {
          pushUndo(g, 'Attest nachgereicht');
          e.extra.attestLater = true;
          save(); build();
        }, 'ghost')))),
    ]);
  };
  build();
}

export function openHintsSheet(g, p) {
  const cfg = subjCfg(g);
  const hi = hintsOf(g, p);
  const link = sid => h('button.link-name', {
    type: 'button',
    onClick: () => { s.close(); go({ name: 'group', groupId: g.id, tab: 'eintraege', sid, periodId: p.id }); },
  }, studentLabel(findStudent(g, sid)));
  const s = openSheet('Hinweise', [
    h('h3', `Häufungen (ab ${cfg.thresholds.haeufung}× derselbe Minus-Eintrag)`),
    hi.haeufung.length ? h('ul.plain', hi.haeufung.map(x => h('li', link(x.sid), ` – ${x.n}× ${x.label}`))) : h('p.muted', 'Keine.'),
    h('h3', `Beobachtungslücken (weniger als ${cfg.thresholds.luecke} bewertende Einträge)`),
    hi.luecken.length ? h('ul.plain', hi.luecken.map(x => h('li', link(x.sid), ` – ${x.n} ${x.n === 1 ? 'Eintrag' : 'Einträge'}`))) : h('p.muted', 'Keine.'),
  ]);
}

// Stundenwerte einer Person im Zeitraum
export function lessonTable(g, sid, p) {
  const cfg = subjCfg(g);
  const rows = lessonsIn(g, p).map(d => {
    const v = lessonValue(g, sid, d);
    const entries = g.entries.filter(e => e.sid === sid && e.date === d && e.cat !== 'abwesend' && e.cat !== 'befreit')
      .map(e => (e.cat === 'notiz' ? `Notiz: ${e.note || ''}` : entryLabel(cfg, e)));
    if (g.fach === 'pb') {
      const wl = { '+': '+', o: 'o', '-': '−', na: 'nicht abgegeben' };
      for (const t of g.tasks) if (t.date === d && t.results[sid] && t.results[sid] !== 'abs') entries.push(`${t.title}: ${wl[t.results[sid]]}`);
    }
    return h('tr',
      h('td', `${weekday(d)} ${fmtShort(d)}`),
      h('td.num', v.graded ? h('strong', fmtPct(Math.round(v.value * 10) / 10)) : h('span.muted', 'wertungsfrei')),
      h('td.small', v.graded
        ? [v.note && !entries.some(x => x.startsWith(v.note)) && h('em', v.note + (entries.length ? ' · ' : '')), entries.join(' · ')]
        : v.reason));
  });
  if (!rows.length) return h('p.muted', 'Im Zeitraum wurde noch keine Stunde gezählt.');
  return h('div.table-wrap', h('table.lesson-table', h('thead', h('tr', h('th', 'Stunde'), h('th', 'Wert'), h('th', 'Einträge'))), h('tbody', rows)));
}

// Nachweis-Zusammenfassung für eine Person
export function studentSummary(g, sid, p) {
  const box = h('div.card.summary');
  if (p) {
    const sc = scoreOf(g, sid, p);
    box.append(h('div.sum-head',
      h('div', h('div.big', sc.avg === null ? '–' : fmtPct(Math.round(sc.avg * 10) / 10)), h('small', 'Durchschnitt')),
      h('div', h('div.big', fmtGrade(g, sc.grade)), h('small', sc.provisional ? 'Note (vorläufig)' : 'Notenvorschlag')),
      h('div', h('div.big', `${sc.graded}/${sc.lessons}`), h('small', 'gewertet / gezählte Std.')),
      h('div', h('div.big', String(sc.n)), h('small', 'bewertende Einträge'))));
    if (weakSek2(g, sc.grade)) box.append(h('p.warnbox', SEK2_WARN));
    box.append(h('h4', 'Notenbegründung'), explanationBlock(g, sc.grade, evidence(g, sid, p)));
    box.append(h('h4', 'Stundenwerte'), lessonTable(g, sid, p));
    const hi = hintsOf(g, p).haeufung.filter(x => x.sid === sid);
    if (hi.length) box.append(h('p.warnbox', 'Häufung: ' + hi.map(x => `${x.n}× ${x.label}`).join(', ')));
  }
  const hist = Object.values(g.closed).filter(r => r.closedAt && r.results[sid]?.confirmed).sort((a, b) => a.start.localeCompare(b.start));
  if (hist.length) {
    box.append(h('h4', 'Verlauf abgeschlossener Zeiträume'), h('ul.sum-list', hist.map(r =>
      h('li', h('span', `${r.label} (${fmtShort(r.start)}–${fmtShort(r.end)})${r.results[sid].legacy ? ' · älteres Bewertungssystem' : ''}`),
        h('strong', fmtGrade(g, r.results[sid].grade))))));
  }
  return box;
}
