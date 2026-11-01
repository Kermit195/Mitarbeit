// Gemeinsame Bausteine der Lerngruppen-Ansichten

import { h, fmtShort, fmtNum, fmtDate, weekday } from '../util.js';
import { S, save, subjCfg, isSek2, findStudent, studentLabel, addEntries } from '../model.js';
import { render, go } from '../nav.js';
import { openSheet, btn } from '../ui.js';
import { hintsOf, openExcuses, catOf, scoreOf, inRange, redeStats, entryValue } from '../grading.js';
import { pushUndo } from '../undo.js';

// Auswahlzustand (Mehrfachauswahl)
export const sel = { gid: null, multi: false, ids: new Set() };
export function resetSel(gid) { sel.gid = gid; sel.multi = false; sel.ids.clear(); }

export const fmtValue = (g, v) => (isSek2(g) ? fmtNum(v, 2) + ' P.' : fmtNum(v, 2));
export const fmtGrade = (g, n) => (n === null || n === undefined ? '–' : isSek2(g) ? `${n} P.` : String(n));
export function fmtWeight(g, w) {
  const x = isSek2(g) ? w * 3 : w;
  return fmtNum(x, 2).replace(/0$/, '') + (isSek2(g) ? ' P.' : '');
}

export function trendBadge(g, sc) {
  const cls = sc.trend > 0 ? 'up' : sc.trend < 0 ? 'down' : 'flat';
  const arrow = sc.trend > 0 ? '▲' : sc.trend < 0 ? '▼' : '●';
  return h('span.trend.' + cls, { title: 'Zwischenstand im aktuellen Zeitraum' }, `${arrow} ${fmtNum(sc.value, 1)}`);
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
  return h('div.infobar', items);
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
      h('p.muted', `Frist: ${cfg.thresholds.excuseDays} Tage. Danach schlägt die App den Eintrag „Entschuldigung nicht nachgereicht“ vor.`),
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
      h('div', h('div.big', fmtValue(g, sc.value)), h('small', 'Zwischenstand')),
      h('div', h('div.big', fmtGrade(g, sc.rounded)), h('small', isSek2(g) ? 'gerundet' : 'gerundete Note')),
      h('div', h('div.big', String(sc.n)), h('small', 'bewertende Einträge')),
      h('div', h('div.big.plus', '+' + fmtNum(sc.plus * (isSek2(g) ? 3 : 1), 2)), h('small', 'Summe Plus')),
      h('div', h('div.big.minus', '−' + fmtNum(sc.minus * (isSek2(g) ? 3 : 1), 2)), h('small', 'Summe Minus'))));
  }
  const per = new Map();
  for (const e of g.entries) {
    if (e.sid !== sid || (p && !inRange(e.date, p))) continue;
    const c = catOf(cfg, e.cat);
    if (!c) continue;
    let key = c.label;
    if (c.levels && e.level) key += ' ' + (c.levels.find(l => l.id === e.level)?.label || '');
    if (!per.has(key)) per.set(key, { plus: 0, minus: 0, neutral: 0, neutralCat: !!c.neutral, w: 0 });
    const r = per.get(key);
    if (e.sign > 0) r.plus++; else if (e.sign < 0) r.minus++; else r.neutral++;
    r.w += entryValue(cfg, e);
  }
  if (per.size) {
    box.append(h('h4', 'Einträge nach Kategorie'), h('ul.sum-list', [...per.entries()].map(([k, r]) =>
      h('li', h('span', k),
        h('span.sum-counts',
          r.plus ? h('span.badge.plus', `${r.plus}× +`) : null,
          r.minus ? h('span.badge.minus', `${r.minus}× −`) : null,
          r.neutral ? h('span.badge.neutral', `${r.neutral}×`) : null)))));
  }
  if (g.fach === 'pb' && p) {
    const rs = redeStats(g, p);
    const n = rs.counts[sid] || 0;
    const lv = rs.levels[sid] || { I: 0, II: 0, III: 0 };
    box.append(h('p', h('strong', 'Redebeiträge: '), `${n} (Durchschnitt der Lerngruppe: ${fmtNum(rs.avg, 1)}) · AFB I: ${lv.I}, AFB II: ${lv.II}, AFB III: ${lv.III}`));
    const tasks = g.tasks.filter(t => inRange(t.date, p)).sort((a, b) => a.date.localeCompare(b.date));
    if (tasks.length) {
      const lbl = { '+': '+', o: 'o', '-': '−', na: 'nicht abgegeben', abs: 'nicht anwesend' };
      box.append(h('h4', 'Schriftliche Aufgaben'), h('ul.sum-list', tasks.map(t =>
        h('li', h('span', `${fmtShort(t.date)} ${t.title} (${t.art})`), h('span', lbl[t.results[sid]] || 'offen')))));
    }
  }
  if (p) {
    const hi = hintsOf(g, p).haeufung.filter(x => x.sid === sid);
    if (hi.length) box.append(h('p.warnbox', 'Häufung: ' + hi.map(x => `${x.n}× ${x.label}`).join(', ')));
  }
  const hist = Object.values(g.closed).filter(r => r.closedAt && r.results[sid]?.confirmed).sort((a, b) => a.start.localeCompare(b.start));
  if (hist.length) {
    box.append(h('h4', 'Verlauf abgeschlossener Zeiträume'), h('ul.sum-list', hist.map(r =>
      h('li', h('span', `${r.label} (${fmtShort(r.start)}–${fmtShort(r.end)})`), h('strong', fmtGrade(g, r.results[sid].grade))))));
  }
  return box;
}
