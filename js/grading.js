// Bewertungsmodell: Stundenwert in Prozent
// Stundenwert = Startwert der Stunde + Summe aller Einträge dieser Stunde, begrenzt auf 0–100 %.
// Vorschlag = Durchschnitt aller gewerteten Stunden im Zeitraum → Notenschlüssel.

import { S, subjCfg, isSek2 } from './model.js';
import { today, fmtNum } from './util.js';

export const catOf = (cfg, id) => cfg.cats.find(c => c.id === id);
export const inRange = (date, p) => !!p && date >= p.start && date <= p.end;
const clamp100 = x => Math.min(100, Math.max(0, x));
const EPS = 1e-9;

// ---------- Formatierung ----------

export const fmtPct = x => `${fmtNum(x, Number.isInteger(x) ? 0 : 1)} %`;
export const fmtDelta = x => (x > 0 ? '+' : x < 0 ? '−' : '±') + fmtNum(Math.abs(x), Number.isInteger(x) ? 0 : 1) + ' %';

// ---------- Einträge ----------

// Zu- oder Abschlag eines Eintrags (Startwert-Ersatz, 0-%-Stunde, Protokoll usw. zählen hier nicht)
export function entryDelta(cfg, e) {
  const c = catOf(cfg, e.cat);
  if (!c || c.neutral || c.kind) return 0;
  if (c.levels) {
    const l = c.levels.find(x => x.id === e.level);
    return l ? Number(l.pct) || 0 : 0;
  }
  if (e.sign > 0) return Number(c.plus) || 0;
  if (e.sign < 0) return Number(c.minus) || 0;
  return 0;
}

export const levelOf = (cfg, e) => {
  const c = catOf(cfg, e.cat);
  return c && c.levels ? c.levels.find(x => x.id === e.level) || null : null;
};

// Bewertende Beobachtung (für Beobachtungslücken)
export function isRating(cfg, e) {
  const c = catOf(cfg, e.cat);
  return !!c && !c.neutral && c.kind !== 'passive';
}

export function writtenDelta(cfg, r) {
  const pct = (cfg.written && cfg.written.pct) || {};
  return r && r !== 'abs' ? Number(pct[r]) || 0 : 0;
}

export function entryLabel(cfg, e) {
  const c = catOf(cfg, e.cat);
  let s = c ? c.label : 'Unbekannte Kategorie';
  if (!c) return s;
  const l = levelOf(cfg, e);
  if (c.kind === 'base' && l) s = `Einsatz ${l.label} (${fmtPct(Number(l.pct))})`;
  else if (c.kind === 'protocol' && l) s = `Protokoll ${l.label} (${fmtPct(Number(l.pct))})`;
  else if (c.kind === 'zero') s += ' (Stunde 0 %)';
  else if (l) s = `${l.label === c.label ? c.label : `${c.label} ${l.label}`} (${fmtDelta(Number(l.pct))})`;
  else if (!c.neutral && !c.kind && e.sign) s += ` (${fmtDelta(entryDelta(cfg, e))})`;
  if (e.sub) s += ` – ${e.sub}`;
  return s;
}

// ---------- Zeiträume ----------

export function periodsOf(g) {
  const out = g.periods.map(p => ({ id: p.id, label: p.name, start: p.start, end: p.end }));
  for (const [id, rec] of Object.entries(g.closed)) {
    if (!out.some(p => p.id === id) && Object.values(rec.results || {}).some(r => r.confirmed)) {
      out.push({ id, label: rec.label, start: rec.start, end: rec.end, orphan: true });
    }
  }
  out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  for (const p of out) p.rec = g.closed[p.id] || null;
  return out;
}

export function currentPeriod(g) {
  const t = today();
  const ps = periodsOf(g).filter(p => !p.orphan);
  return ps.find(p => inRange(t, p)) || [...ps].reverse().find(p => p.start <= t) || ps[0] || null;
}

export function ensureRec(g, p) {
  if (!g.closed[p.id]) g.closed[p.id] = { label: p.label, start: p.start, end: p.end, closedAt: null, results: {} };
  return g.closed[p.id];
}

export const lessonsIn = (g, p) => g.lessons.filter(d => inRange(d, p));

// ---------- Anwesenheit, Befreiung ----------

export function dayStatus(g, sid, date) {
  let absent = null, exempt = null, limited = null;
  for (const e of g.entries) {
    if (e.sid !== sid) continue;
    if (e.cat === 'abwesend' && e.date === date) absent = e;
    else if (e.cat === 'befreit' && e.date <= date && (e.extra?.bis || e.date) >= date) exempt = e;
    else if (e.cat === 'eingeschraenkt' && e.date === date) limited = e;
  }
  return { absent, exempt, limited, inactive: !!(absent || exempt) };
}

// Befreiung ohne Attest: wertungsfrei bis einschließlich der nächsten gezählten Sportstunde, danach unentschuldigt (0 %)
export function exemptionInfo(g, e, now = today()) {
  const ex = e.extra || {};
  const excused = !!(ex.attest || ex.attestLater);
  const deadline = g.lessons.find(d => d > e.date) || null;
  const overdue = !excused && !!deadline && now > deadline;
  return { excused, deadline, overdue, pending: !excused && !overdue };
}

export function exemptionsMissingAttest(g) {
  if (g.fach !== 'sport') return [];
  return g.entries.filter(e => e.cat === 'befreit').map(e => ({ e, ...exemptionInfo(g, e) })).filter(x => !x.excused);
}

// ---------- Stundenwert ----------

// Ergebnis: { graded: false, reason } oder { graded: true, value, base, delta, note }
export function lessonValue(g, sid, date) {
  const cfg = subjCfg(g);
  const ds = dayStatus(g, sid, date);
  if (ds.absent) return { graded: false, reason: 'nicht anwesend' };
  if (ds.limited) return { graded: false, reason: 'eingeschränkte Teilnahme' };
  const day = g.entries.filter(e => e.sid === sid && e.date === date);
  let delta = 0;
  for (const e of day) delta += entryDelta(cfg, e);

  if (g.fach === 'pb') {
    for (const t of g.tasks) if (t.date === date) delta += writtenDelta(cfg, t.results[sid]);
    const base = Number(isSek2(g) ? cfg.start.sek2 : cfg.start.sek1);
    return { graded: true, base, delta, value: clamp100(base + delta) };
  }

  const kindLevel = kind => {
    const e = [...day].reverse().find(x => catOf(cfg, x.cat)?.kind === kind);
    return e ? levelOf(cfg, e) : null;
  };
  const protocol = kindLevel('protocol');
  const einsatz = kindLevel('base');
  const passive = day.some(x => catOf(cfg, x.cat)?.kind === 'passive');
  const zero = day.find(x => catOf(cfg, x.cat)?.kind === 'zero');
  const cap = Number(cfg.protocolCap);

  if (ds.exempt) {
    const info = exemptionInfo(g, ds.exempt);
    if (info.overdue) return { graded: true, base: 0, delta: 0, value: 0, note: 'Befreiung unentschuldigt' };
    if (protocol) return { graded: true, base: Number(protocol.pct), delta, value: clamp100(Number(protocol.pct) + delta), note: 'Protokoll' };
    if (passive) {
      const base = einsatz ? Number(einsatz.pct) : Number(cfg.start);
      return { graded: true, base, delta, value: clamp100(base + delta), note: 'passive Aufgabe' };
    }
    return { graded: false, reason: info.excused ? 'Sportbefreiung' : 'Sportbefreiung (Attest bis zur nächsten Stunde)' };
  }
  if (zero) {
    const label = catOf(cfg, zero.cat).label;
    if (protocol) return { graded: true, base: Math.min(cap, Number(protocol.pct)), delta, value: Math.min(cap, clamp100(Number(protocol.pct) + delta)), note: `${label}, Protokoll` };
    return { graded: true, base: 0, delta: 0, value: 0, note: label };
  }
  const base = einsatz ? Number(einsatz.pct) : Number(cfg.start);
  return { graded: true, base, delta, value: clamp100(base + delta) };
}

// ---------- Note ----------

export function gradeFor(g, pct) {
  const keys = S.data.settings.keys;
  if (isSek2(g)) {
    const hit = [...keys.sek2].sort((a, b) => b.pts - a.pts).find(k => pct >= Number(k.min) - EPS);
    return hit ? hit.pts : 0;
  }
  const hit = [...keys.sek1].sort((a, b) => a.grade - b.grade).find(k => pct >= Number(k.min) - EPS);
  return hit ? hit.grade : 6;
}

// Notenpunkte → Note (für Beschreibungen)
export const pointsToGrade = pts => (pts >= 13 ? 1 : pts >= 10 ? 2 : pts >= 7 ? 3 : pts >= 4 ? 4 : pts >= 1 ? 5 : 6);
export const gradeAsSek1 = (g, grade) => (isSek2(g) ? pointsToGrade(grade) : grade);

// Farbe/Tendenz: 1–3 gut, 4 neutral, 5–6 schwach
export function gradeTone(g, grade) {
  if (grade === null || grade === undefined) return 0;
  const n = gradeAsSek1(g, grade);
  return n <= 3 ? 1 : n === 4 ? 0 : -1;
}

// Sek II: Vorschlag bei 4 Punkten oder darunter
export const weakSek2 = (g, grade) => isSek2(g) && grade !== null && grade !== undefined && grade <= 4;

// avg = Durchschnitt (null ohne gewertete Stunde), graded = Anzahl gewerteter Stunden, provisional = unter Mindestzahl
export function scoreOf(g, sid, p) {
  const cfg = subjCfg(g);
  const values = [];
  for (const date of lessonsIn(g, p)) {
    const v = lessonValue(g, sid, date);
    if (v.graded) values.push(v.value);
  }
  let n = 0;
  for (const e of g.entries) if (e.sid === sid && inRange(e.date, p) && isRating(cfg, e)) n++;
  if (g.fach === 'pb') for (const t of g.tasks) if (inRange(t.date, p) && t.results[sid] && t.results[sid] !== 'abs') n++;
  const graded = values.length;
  const avg = graded ? values.reduce((a, b) => a + b, 0) / graded : null;
  const grade = avg === null ? null : gradeFor(g, avg);
  const provisional = graded < (Number(S.data.settings.minLessons) || 4);
  return { avg, grade, graded, provisional, n, tone: gradeTone(g, grade), lessons: lessonsIn(g, p).length };
}

// ---------- Hinweise ----------

export function countMinus(g, sid, cat, p) {
  return g.entries.filter(e => e.sid === sid && e.cat === cat && e.sign < 0 && inRange(e.date, p)).length;
}

export function hintsOf(g, p) {
  const cfg = subjCfg(g);
  const th = cfg.thresholds;
  const haeufung = [], luecken = [];
  if (!p) return { haeufung, luecken };
  for (const st of g.students) {
    const counts = {};
    for (const e of g.entries) {
      if (e.sid !== st.id || !(e.sign < 0) || !inRange(e.date, p)) continue;
      const c = catOf(cfg, e.cat);
      if (c && !c.neutral) counts[e.cat] = (counts[e.cat] || 0) + 1;
    }
    for (const [cat, n] of Object.entries(counts)) {
      if (n >= th.haeufung) haeufung.push({ sid: st.id, cat, n, label: catOf(cfg, cat).label });
    }
    const sc = scoreOf(g, st.id, p);
    if (sc.n < th.luecke) luecken.push({ sid: st.id, n: sc.n });
  }
  return { haeufung, luecken };
}

// Redebeiträge (PB): Anzahl pro Person und Durchschnitt der Lerngruppe
export function redeStats(g, p) {
  const counts = {}, levels = {};
  for (const st of g.students) { counts[st.id] = 0; levels[st.id] = { I: 0, II: 0, III: 0 }; }
  for (const e of g.entries) {
    if (e.cat !== 'rede' || !inRange(e.date, p) || !(e.sid in counts)) continue;
    counts[e.sid]++;
    if (e.level in levels[e.sid]) levels[e.sid][e.level]++;
  }
  const n = g.students.length;
  const avg = n ? Object.values(counts).reduce((a, b) => a + b, 0) / n : 0;
  return { counts, levels, avg };
}
