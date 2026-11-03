// Gemeinsame Bausteine der Lerngruppen-Ansichten

import { h, fmtShort, fmtDate, weekday, today, fmtNum } from '../util.js';
import { save, subjCfg, isSek2, findStudent, studentLabel, addEntries, addLesson } from '../model.js';
import { render, go } from '../nav.js';
import { openSheet, btn } from '../ui.js';
import {
  hintsOf, openExcuses, catOf, scoreOf, inRange, redeStats, entryPoints, isRating,
  fmtPts, fmtPerLesson, writtenPoints, lessonsIn,
} from '../grading.js';
import { pushUndo } from '../undo.js';

// Auswahlzustand (Mehrfachauswahl)
export const sel = { gid: null, multi: false, ids: new Set() };
export function resetSel(gid) { sel.gid = gid; sel.multi = false; sel.ids.clear(); }

export const fmtGrade = (g, n) => (n === null || n === undefined ? '–' : isSek2(g) ? `${n} P.` : String(n));
export const NOTE_ZERO = 'Ohne Einträge: 0 Punkte = Note 4';

// Punktestand pro anwesende Stunde und vorläufige Note, z. B. „+0,45 · 3“
export function scoreBadge(g, sc) {
  const cls = sc.tone > 0 ? 'up' : sc.tone < 0 ? 'down' : 'flat';
  return h('span.trend.' + cls, { title: `Punkte pro anwesende Stunde · vorläufige Note (${sc.sum} Punkte in ${sc.lessons} Std.)` },
    `${fmtPerLesson(sc.perLesson)} · ${fmtGrade(g, sc.grade)}`);
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
  if (g.fach === 'sport') {
    const ex = openExcuses(g);
    if (ex.length) {
      const od = ex.filter(x => x.overdue).length;
      items.push(h('button.chip-btn' + (od ? '.warn' : ''), { type: 'button', onClick: () => openExcuseSheet(g) },
        `Entschuldigungen offen: ${ex.length}` + (od ? ` (${od} überfällig)` : '')));
    }
  }
  const hi = hintsOf(g, p);
  if (hi.haeufung.length) items.push(h('button.chip-btn.warn', { type: 'button', onClick: () => openHintsSheet(g, p) }, `Häufungen: ${hi.haeufung.length}`));
  if (hi.luecken.length) items.push(h('button.chip-btn', { type: 'button', onClick: () => openHintsSheet(g, p) }, `Wenig beobachtet: ${hi.luecken.length}`));
  items.push(h('span.spacer'));
  items.push(h('button.chip-btn' + (sel.multi ? '.active' : ''), {
    type: 'button',
    onClick: () => { sel.multi = !sel.multi; sel.ids.clear(); render(); },
  }, sel.multi ? '✓ Mehrfachauswahl beenden' : '☐ Mehrfachauswahl'));
  return [h('div.infobar', items), h('p.hint', `Anzeige: Punkte pro anwesende Stunde · vorläufige Note. ${NOTE_ZERO}.`)];
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

export function openExcuseSheet(g) {
  const cfg = subjCfg(g);
  const s = openSheet('Offene Entschuldigungen', [], { onClose: render });
  const build = () => {
    const list = openExcuses(g);
    if (!list.length) { s.setBody(h('p.empty', 'Keine offenen Entschuldigungen.')); return; }
    s.setBody([
      h('p.muted', `Frist: ${cfg.thresholds.excuseDays} Tage. Danach schlägt die App den Eintrag „Entschuldigung nicht nachgereicht“ vor (${fmtPts(Number(catOf(cfg, 'entschuldigung').minus))}; die Fehlstunde zählt dann wie eine anwesende Stunde).`),
      list.map(({ e, days, overdue }) => h('div.excuse-row' + (overdue ? '.overdue' : ''),
        h('div', h('strong', studentLabel(findStudent(g, e.sid))),
          h('div.small.muted', `gefehlt am ${weekday(e.date)} ${fmtDate(e.date)} · vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`)),
        h('div.btnrow',
          btn('✓ liegt vor', () => {
            pushUndo(g, 'Entschuldigung liegt vor');
            e.extra.excuse = 'liegt vor';
            save(); build();
          }, 'ghost'),
          overdue && btn('„nicht nachgereicht“ eintragen', () => {
            pushUndo(g, 'Entschuldigung nicht nachgereicht');
            e.extra.excuse = 'nicht nachgereicht';
            addEntries(g, [e.sid], { cat: 'entschuldigung', sign: -1, note: `Fehlstunde vom ${fmtDate(e.date)}` });
            build();
          }, 'danger')))),
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
    h('p.muted.small', NOTE_ZERO + ' – wenige Einträge bedeuten daher meist Note 4.'),
    hi.luecken.length ? h('ul.plain', hi.luecken.map(x => h('li', link(x.sid), ` – ${x.n} ${x.n === 1 ? 'Eintrag' : 'Einträge'}`))) : h('p.muted', 'Keine.'),
  ]);
}

// Nachweis-Zusammenfassung für eine Person
export function studentSummary(g, sid, p) {
  const cfg = subjCfg(g);
  const box = h('div.card.summary');
  if (p) {
    const sc = scoreOf(g, sid, p);
    box.append(h('div.sum-head',
      h('div', h('div.big', fmtPerLesson(sc.perLesson)), h('small', 'Punkte pro Stunde')),
      h('div', h('div.big', fmtGrade(g, sc.grade)), h('small', 'vorläufige Note')),
      h('div', h('div.big', fmtPts(sc.sum) || '0'), h('small', 'Punkte gesamt')),
      h('div', h('div.big', `${sc.lessons}/${lessonsIn(g, p).length}`), h('small', 'anwesend / gezählte Std.')),
      h('div', h('div.big', String(sc.n)), h('small', 'bewertende Einträge'))));
    box.append(h('p.muted.small', NOTE_ZERO + '.'));
  }
  const per = new Map();
  for (const e of g.entries) {
    if (e.sid !== sid || (p && !inRange(e.date, p))) continue;
    const c = catOf(cfg, e.cat);
    if (!c) continue;
    if (!per.has(c.label)) per.set(c.label, { plus: 0, minus: 0, zero: 0, pts: 0, rating: isRating(cfg, e) });
    const r = per.get(c.label);
    const v = entryPoints(cfg, e);
    if (!r.rating) r.zero++;
    else if (v > 0) r.plus++; else if (v < 0) r.minus++; else r.zero++;
    r.pts += v;
  }
  if (per.size) {
    box.append(h('h4', 'Einträge nach Kategorie'), h('ul.sum-list', [...per.entries()].map(([k, r]) =>
      h('li', h('span', k),
        h('span.sum-counts',
          r.plus ? h('span.badge.plus', `${r.plus}× +`) : null,
          r.minus ? h('span.badge.minus', `${r.minus}× −`) : null,
          r.zero ? h('span.badge.neutral', `${r.zero}×${r.rating ? ' 0' : ''}`) : null,
          r.rating ? h('strong.sum-pts', fmtPts(r.pts) || '0') : h('span.muted.small', 'wertungsfrei'))))));
  }
  if (g.fach === 'pb' && p) {
    const rs = redeStats(g, p);
    const n = rs.counts[sid] || 0;
    const lv = rs.levels[sid] || { I: 0, II: 0, III: 0 };
    box.append(h('p', h('strong', 'Redebeiträge: '), `${n} (Durchschnitt der Lerngruppe: ${fmtNum(rs.avg, 1)}) · AFB I: ${lv.I}, AFB II: ${lv.II}, AFB III: ${lv.III}`));
    const tasks = g.tasks.filter(t => inRange(t.date, p)).sort((a, b) => a.date.localeCompare(b.date));
    if (tasks.length) {
      const lbl = { '+': '+', o: 'o', '-': '−', na: 'nicht abgegeben', abs: 'nicht anwesend' };
      box.append(h('h4', 'Schriftliche Aufgaben'), h('ul.sum-list', tasks.map(t => {
        const r = t.results[sid];
        return h('li', h('span', `${fmtShort(t.date)} ${t.title} (${t.art})`),
          h('span', lbl[r] || 'offen', r && r !== 'abs' ? h('strong.sum-pts', fmtPts(writtenPoints(cfg, r)) || '0') : null));
      })));
    }
  }
  if (p) {
    const hi = hintsOf(g, p).haeufung.filter(x => x.sid === sid);
    if (hi.length) box.append(h('p.warnbox', 'Häufung: ' + hi.map(x => `${x.n}× ${x.label}`).join(', ')));
  }
  const hist = Object.values(g.closed).filter(r => r.closedAt && r.results[sid]?.confirmed).sort((a, b) => a.start.localeCompare(b.start));
  if (hist.length) {
    box.append(h('h4', 'Verlauf abgeschlossener Zeiträume'), h('ul.sum-list', hist.map(r =>
      h('li', h('span', `${r.label} (${fmtShort(r.start)}–${fmtShort(r.end)})${r.results[sid].legacy ? ' · altes System' : ''}`),
        h('strong', fmtGrade(g, r.results[sid].grade))))));
  }
  return box;
}
