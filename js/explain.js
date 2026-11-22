// Notenbegründung in drei Ebenen (amtlich · fachlich · Belege), nächstbessere Note, Bewertungsmaßstab

import { h, fmtNum } from './util.js';
import { S, subjCfg, isSek2 } from './model.js';
import { GRADE_WORDS } from './defaults.js';
import {
  catOf, inRange, lessonsIn, lessonValue, levelOf, redeStats, fmtPct, fmtDelta, gradeAsSek1, weakSek2,
} from './grading.js';

export const gradeName = (g, grade) => (grade === null || grade === undefined ? '–'
  : isSek2(g) ? `${grade} Punkte (${GRADE_WORDS[gradeAsSek1(g, grade)]})` : `${grade} (${GRADE_WORDS[grade]})`);

export const SEK2_WARN = 'Schwach ausreichend – eine Häufung kann Folgen für die Zulassung zum Abitur haben.';

// Ebene 1: amtliche Definition
export function officialText(g, grade) {
  const off = S.data.settings.official;
  const n = gradeAsSek1(g, grade);
  const parts = [off[n]];
  if (isSek2(g) && grade === 4 && off.sek2_4) parts.push(off.sek2_4);
  return parts.join(' ');
}

// Ebene 2: fachliche Beschreibung (Sport: ein Text; PB: je Bereich)
export function subjectDesc(g, grade) {
  const cfg = subjCfg(g);
  const n = gradeAsSek1(g, grade);
  if (g.fach === 'sport') return [{ title: null, text: cfg.gradeDesc[n] || '' }];
  return cfg.areas.map(a => ({ title: a.label, text: (cfg.gradeDesc[a.id] || {})[n] || '' }));
}

// Ebene 3: Belege aus den Einträgen, zusammengefasst (Zeilen „Titel: Text“)
export function evidence(g, sid, p) {
  const cfg = subjCfg(g);
  const lines = [];
  const count = map => Object.entries(map).filter(([, n]) => n).map(([k, n]) => `${n}× ${k}`).join(', ');
  const lessons = lessonsIn(g, p);
  const notGraded = {};
  const notes = {};
  let graded = 0;
  const einsatz = {};
  for (const d of lessons) {
    const v = lessonValue(g, sid, d);
    if (!v.graded) { notGraded[v.reason] = (notGraded[v.reason] || 0) + 1; continue; }
    graded++;
    if (v.note) notes[v.note] = (notes[v.note] || 0) + 1;
    if (g.fach === 'sport' && !v.note) {
      const e = g.entries.filter(x => x.sid === sid && x.date === d && catOf(cfg, x.cat)?.kind === 'base').pop();
      const l = e ? levelOf(cfg, e) : null;
      const label = l ? l.label : 'gut';
      einsatz[label] = (einsatz[label] || 0) + 1;
    }
  }
  lines.push(['Stunden', `${graded} gewertet` + (Object.keys(notGraded).length ? ` · wertungsfrei: ${count(notGraded)}` : '')]);
  if (g.fach === 'sport' && Object.keys(einsatz).length) {
    const order = (catOf(cfg, 'einsatzstufe')?.levels || []).map(l => l.label);
    const sorted = Object.fromEntries(Object.entries(einsatz).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])));
    lines.push(['Einsatz', count(sorted)]);
  }
  if (Object.keys(notes).length) lines.push(['Besondere Stunden', count(notes)]);

  const plus = {}, minus = {}, other = {};
  for (const e of g.entries) {
    if (e.sid !== sid || !inRange(e.date, p)) continue;
    const c = catOf(cfg, e.cat);
    if (!c || c.neutral || c.kind === 'base' || c.kind === 'passive') continue;
    if (c.kind === 'protocol') { const l = levelOf(cfg, e); other[`Protokoll ${l ? l.label : ''}`] = (other[`Protokoll ${l ? l.label : ''}`] || 0) + 1; continue; }
    if (c.id === 'rede' || c.id === 'hausaufgaben') continue;
    const l = levelOf(cfg, e);
    const label = l && l.label !== c.label && l.label !== '+' ? `${c.label} (${l.label})` : c.label;
    const bucket = c.kind === 'zero' || e.sign < 0 ? minus : e.sign > 0 ? plus : other;
    bucket[label] = (bucket[label] || 0) + 1;
  }
  if (g.fach === 'pb') {
    const rs = redeStats(g, p);
    const lv = rs.levels[sid] || { I: 0, II: 0, III: 0 };
    lines.push(['Redebeiträge', `${rs.counts[sid] || 0} (AFB I: ${lv.I}, AFB II: ${lv.II}, AFB III: ${lv.III}) · Durchschnitt der Lerngruppe: ${fmtNum(rs.avg, 1)}`]);
    const ha = {};
    for (const e of g.entries) {
      if (e.sid === sid && e.cat === 'hausaufgaben' && inRange(e.date, p)) {
        const l = levelOf(cfg, e);
        if (l) ha[l.label] = (ha[l.label] || 0) + 1;
      }
    }
    if (Object.keys(ha).length) lines.push(['Hausaufgaben', count(ha)]);
    const wr = {};
    const wl = { '+': '+', o: 'o', '-': '−', na: 'nicht abgegeben' };
    for (const t of g.tasks) {
      const r = t.results[sid];
      if (inRange(t.date, p) && r && r !== 'abs') wr[wl[r]] = (wr[wl[r]] || 0) + 1;
    }
    if (Object.keys(wr).length) lines.push(['Schriftlich', count(wr)]);
  }
  if (Object.keys(plus).length) lines.push(['Plus', count(plus)]);
  if (Object.keys(minus).length) lines.push(['Minus', count(minus)]);
  if (Object.keys(other).length) lines.push(['Sonstiges', count(other)]);
  return lines;
}

export const evidenceText = (g, sid, p) => evidence(g, sid, p).map(([t, x]) => `${t}: ${x}`).join(' · ');

// Nächstbessere Note mit Schwelle
export function nextBetter(g, grade) {
  if (grade === null || grade === undefined) return null;
  const keys = S.data.settings.keys;
  if (isSek2(g)) {
    if (grade >= 15) return null;
    const k = keys.sek2.find(x => x.pts === grade + 1);
    return k ? { grade: grade + 1, min: Number(k.min) } : null;
  }
  if (grade <= 1) return null;
  const k = keys.sek1.find(x => x.grade === grade - 1);
  return k ? { grade: grade - 1, min: Number(k.min) } : null;
}

// Darstellung der drei Ebenen (für Abschluss, Nachweis und Präsentation)
export function explanationBlock(g, grade, evidenceLines, { forStudent = false } = {}) {
  if (grade === null || grade === undefined) return h('p.muted', 'Noch keine gewertete Stunde.');
  const nb = nextBetter(g, grade);
  const desc = subjectDesc(g, grade);
  const descNext = nb ? subjectDesc(g, nb.grade) : [];
  return h('div.explain',
    h('div.ex-level',
      h('h4', '1 · Amtliche Notendefinition'),
      h('p', h('strong', gradeName(g, grade) + ': '), officialText(g, grade)),
      weakSek2(g, grade) && h('p.warnbox', SEK2_WARN)),
    h('div.ex-level',
      h('h4', `2 · Fachliche Beschreibung (${g.fach === 'sport' ? 'Sport' : 'Politische Bildung'})`),
      desc.map(x => h('p', x.title && h('strong', x.title + ': '), x.text))),
    h('div.ex-level',
      h('h4', '3 · Belege aus ' + (forStudent ? 'deinen' : 'den') + ' Einträgen'),
      evidenceLines && evidenceLines.length
        ? h('ul.plain', evidenceLines.map(([t, x]) => h('li', h('strong', t + ': '), x)))
        : h('p.muted', 'Keine Einträge.')),
    nb && h('div.ex-level.next',
      h('h4', `So erreichst du die nächstbessere Note: ${gradeName(g, nb.grade)} – ab ${fmtPct(nb.min)}`),
      descNext.map(x => h('p', x.title && h('strong', x.title + ': '), x.text))));
}

// ---------- Bewertungsmaßstab (ohne Schülerdaten) ----------

export function scaleView(fach, sek2) {
  const st = S.data.settings;
  const cfg = st.subjects[fach];
  const keyTable = sek2
    ? h('table.scale-table', h('thead', h('tr', h('th', 'Notenpunkte'), h('th', 'ab'))),
      h('tbody', [...st.keys.sek2].sort((a, b) => b.pts - a.pts).map(k => h('tr', h('td', String(k.pts)), h('td', fmtPct(Number(k.min))))),
        h('tr', h('td', '0'), h('td', 'darunter'))))
    : h('table.scale-table', h('thead', h('tr', h('th', 'Note'), h('th', 'ab'))),
      h('tbody', [...st.keys.sek1].sort((a, b) => a.grade - b.grade).map(k => h('tr', h('td', `${k.grade} (${GRADE_WORDS[k.grade]})`), h('td', fmtPct(Number(k.min))))),
        h('tr', h('td', '6 (ungenügend)'), h('td', 'darunter'))));

  const start = fach === 'sport' ? `${fmtPct(Number(cfg.start))} („gut“)` : `${fmtPct(Number(sek2 ? cfg.start.sek2 : cfg.start.sek1))} (Note 3)`;
  const rows = [];
  for (const c of cfg.cats) {
    if (c.hidden || c.kind === 'notiz') continue;
    let eff;
    if (c.neutral) eff = 'wertungsfrei';
    else if (c.kind === 'base') eff = c.levels.map(l => `${l.label} ${fmtPct(Number(l.pct))}`).join(' · ');
    else if (c.kind === 'zero') eff = `Stunde = 0 % (mit Protokoll höchstens ${fmtPct(Number(cfg.protocolCap))})`;
    else if (c.kind === 'protocol') eff = c.levels.map(l => `${l.label} ${fmtPct(Number(l.pct))}`).join(' · ');
    else if (c.kind === 'passive') eff = `Stunde wird gewertet, Start bei ${fmtPct(Number(cfg.start))}`;
    else if (c.levels) eff = c.levels.map(l => `${l.label} ${fmtDelta(Number(l.pct))}`).join(' · ');
    else eff = [Number.isFinite(c.plus) && fmtDelta(c.plus), Number.isFinite(c.minus) && fmtDelta(c.minus)].filter(Boolean).join(' / ');
    rows.push(h('tr', h('td', c.label, c.subs && c.subs.length ? h('small', ` (${c.subs.join(', ')})`) : null), h('td', eff)));
  }
  if (fach === 'pb') {
    const w = cfg.written.pct;
    rows.push(h('tr', h('td', 'Schriftlich (z. B. Exit-Ticket)'), h('td', `+ ${fmtDelta(w['+'])} · o ${fmtDelta(w.o)} · − ${fmtDelta(w['-'])} · nicht abgegeben ${fmtDelta(w.na)}`)));
  }

  const descs = [1, 2, 3, 4, 5, 6].map(n => h('tr', h('td', `${n} (${GRADE_WORDS[n]})`),
    h('td', fach === 'sport' ? cfg.gradeDesc[n]
      : cfg.areas.map(a => h('p', h('strong', a.label + ': '), (cfg.gradeDesc[a.id] || {})[n] || '')))));

  return h('div.scale-view',
    h('h1', `Bewertungsmaßstab ${fach === 'sport' ? 'Sport' : 'Politische Bildung'} · ${sek2 ? 'Sek II' : 'Sek I'}`),
    h('section', h('h2', 'So entsteht die Note'),
      h('p', `Jede gewertete Stunde startet bei ${start}. Einträge in der Stunde erhöhen oder senken diesen Wert (0 bis 100 %). Die Note ergibt sich aus dem Durchschnitt aller gewerteten Stunden.`),
      fach === 'sport' && h('p', 'Nicht anwesend, Sportbefreiung mit Attest und eingeschränkte Teilnahme sind wertungsfrei. Eine Befreiung ohne Attest ist bis einschließlich der nächsten Sportstunde wertungsfrei, danach zählt sie als unentschuldigt (0 %).'),
      fach === 'pb' && h('p', 'Nicht anwesend ist wertungsfrei. Hausaufgaben und schriftliche Aufgaben zählen zur Stunde ihres Datums.')),
    h('section', h('h2', 'Notenschlüssel'), keyTable,
      sek2 && h('p.muted', '4 Punkte = schwach ausreichend.')),
    h('section', h('h2', 'Einträge und ihre Wirkung'), h('table.scale-table', h('tbody', rows))),
    fach === 'sport' && h('section', h('h2', 'Einsatz-Stufen'), h('table.scale-table', h('tbody',
      catOf(cfg, 'einsatzstufe').levels.map(l => h('tr', h('td', `${l.label} (${fmtPct(Number(l.pct))})`), h('td', l.desc || '')))))),
    h('section', h('h2', 'Was die Noten bedeuten'), h('table.scale-table', h('tbody', descs))),
    h('section', h('h2', 'Amtliche Notendefinitionen'), h('table.scale-table', h('tbody',
      [1, 2, 3, 4, 5, 6].map(n => h('tr', h('td', `${n} (${GRADE_WORDS[n]})`), h('td', st.official[n]))),
      sek2 && h('tr', h('td', '4 Punkte'), h('td', st.official.sek2_4))))));
}
