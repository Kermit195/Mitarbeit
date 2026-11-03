// Punktekonto: Summe der Punkte im Zeitraum ÷ anwesende Stunden → Note über festen Schlüssel

import { subjCfg, isSek2 } from './model.js';
import { today, daysBetween, fmtNum } from './util.js';

export const catOf = (cfg, id) => cfg.cats.find(c => c.id === id);
export const inRange = (date, p) => !!p && date >= p.start && date <= p.end;
const EPS = 1e-9;

// Punkte eines Eintrags laut Punktetabelle (wertungsfreie Einträge = 0)
export function entryPoints(cfg, e) {
  const c = catOf(cfg, e.cat);
  if (!c || c.neutral) return 0;
  if (c.levels) {
    const l = c.levels.find(x => x.id === e.level);
    return l ? Number(l.pts) || 0 : 0;
  }
  if (e.sign > 0) return Number(c.plus) || 0;
  if (e.sign < 0) return Number(c.minus) || 0;
  return 0;
}

// Bewertender Eintrag = zählt als Beobachtung (auch mit 0 Punkten, z. B. Hausaufgaben „vorhanden“)
export function isRating(cfg, e) {
  const c = catOf(cfg, e.cat);
  return !!c && !c.neutral;
}

export function writtenPoints(cfg, r) {
  const pts = (cfg.written && cfg.written.points) || {};
  return r && r !== 'abs' ? Number(pts[r]) || 0 : 0;
}

export const fmtPts = x => (x > 0 ? '+' : x < 0 ? '−' : '') + fmtNum(Math.abs(x), Number.isInteger(x) ? 0 : 2);
export const fmtPerLesson = x => (x > EPS ? '+' : x < -EPS ? '−' : '') + fmtNum(Math.abs(x), 2);

export function entryLabel(cfg, e) {
  const c = catOf(cfg, e.cat);
  let s = c ? c.label : 'Unbekannte Kategorie';
  if (c && c.levels) {
    const l = c.levels.find(x => x.id === e.level);
    if (l) s += c.id === 'passiv' ? ` ${l.label}` : ` ${l.label} (${fmtPts(Number(l.pts))})`;
  } else if (c && !c.neutral && e.sign) {
    s += ' ' + fmtPts(entryPoints(cfg, e));
  }
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

// ---------- Anwesenheit ----------

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

// Gezählte Stunden im Zeitraum, an denen die Person anwesend war.
// Abwesend → zählt nicht (außer „Entschuldigung nicht nachgereicht“), befreit → zählt nicht.
export function attendedLessons(g, sid, p) {
  let n = 0;
  for (const date of g.lessons) {
    if (!inRange(date, p)) continue;
    const ds = dayStatus(g, sid, date);
    if (ds.absent && !(ds.absent.extra && ds.absent.extra.excuse === 'nicht nachgereicht')) continue;
    if (ds.exempt) continue;
    n++;
  }
  return n;
}

export const lessonsIn = (g, p) => g.lessons.filter(d => inRange(d, p));

// ---------- Note ----------

export function gradeFor(g, perLesson) {
  const key = subjCfg(g).key;
  if (isSek2(g)) {
    const list = [...key.sek2].sort((a, b) => b.pts - a.pts);
    const hit = list.find(k => perLesson >= Number(k.min) - EPS);
    return hit ? hit.pts : 0;
  }
  const list = [...key.sek1].sort((a, b) => a.grade - b.grade);
  const hit = list.find(k => perLesson >= Number(k.min) - EPS);
  return hit ? hit.grade : 6;
}

// Farbe/Tendenz: Noten 1–3 bzw. 7–15 P. gut, 4 bzw. 4–6 P. neutral, darunter schwach
export function gradeTone(g, grade) {
  if (isSek2(g)) return grade >= 7 ? 1 : grade >= 4 ? 0 : -1;
  return grade <= 3 ? 1 : grade === 4 ? 0 : -1;
}

// sum = Punkte, lessons = anwesende Stunden, perLesson = Punktestand, n = bewertende Beobachtungen
export function scoreOf(g, sid, p) {
  const cfg = subjCfg(g);
  let sum = 0, n = 0, plus = 0, minus = 0;
  for (const e of g.entries) {
    if (e.sid !== sid || !inRange(e.date, p) || !isRating(cfg, e)) continue;
    const v = entryPoints(cfg, e);
    sum += v; n++;
    if (v > 0) plus += v; else minus -= v;
  }
  if (g.fach === 'pb') {
    for (const t of g.tasks) {
      if (!inRange(t.date, p)) continue;
      const r = t.results[sid];
      if (!r || r === 'abs') continue;
      const v = writtenPoints(cfg, r);
      sum += v; n++;
      if (v > 0) plus += v; else minus -= v;
    }
  }
  const lessons = attendedLessons(g, sid, p);
  const perLesson = sum / Math.max(1, lessons);
  const grade = gradeFor(g, perLesson);
  return { sum, n, plus, minus, lessons, perLesson, grade, tone: gradeTone(g, grade) };
}

export function openExcuses(g) {
  if (g.fach !== 'sport') return [];
  const days = subjCfg(g).thresholds.excuseDays;
  const t = today();
  return g.entries
    .filter(e => e.cat === 'abwesend' && e.extra?.excuse === 'offen')
    .map(e => { const d = daysBetween(e.date, t); return { e, days: d, overdue: d >= days }; })
    .sort((a, b) => b.days - a.days);
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
