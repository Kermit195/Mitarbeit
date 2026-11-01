// Notenberechnung, Zeiträume, Anwesenheitsstatus, Hinweise

import { S, subjCfg, isSek2 } from './model.js';
import { today, addDays, daysBetween, round2, clamp } from './util.js';

export const catOf = (cfg, id) => cfg.cats.find(c => c.id === id);
export const inRange = (date, p) => !!p && date >= p.start && date <= p.end;

// Wert eines Eintrags: Vorzeichen × Gewicht (neutrale Einträge = 0)
export function entryValue(cfg, e) {
  const c = catOf(cfg, e.cat);
  if (!c || c.neutral || !e.sign) return 0;
  let w = Number(c.w) || 0;
  if (c.levels) {
    const l = c.levels.find(x => x.id === e.level);
    w = l ? Number(l.w) || 0 : 0;
  }
  return e.sign * w;
}

export function writtenValue(cfg, r) {
  const w = Number(cfg.written?.w) || 0;
  if (r === '+') return w;
  if (r === '-' || r === 'na') return -w;
  return 0;
}

export function entryLabel(cfg, e) {
  const c = catOf(cfg, e.cat);
  let s = c ? c.label : 'Unbekannte Kategorie';
  if (c?.levels && e.level) {
    const l = c.levels.find(x => x.id === e.level);
    if (l) s += ' ' + l.label;
  }
  if (e.sign > 0) s += ' +';
  else if (e.sign < 0) s += ' −';
  if (e.sub) s += ` (${e.sub})`;
  return s;
}

// ---------- Zeiträume ----------

export function periodsOf(g) {
  const out = [];
  if (g.fach === 'sport') {
    const start = g.periodStart || subjCfg(g).blockStart || today();
    const k = Math.max(0, Math.floor(daysBetween(start, today()) / 28));
    for (let i = 0; i <= Math.min(k, 60); i++) {
      const s = addDays(start, 28 * i);
      out.push({ id: 'B' + s, label: `Block ${i + 1}`, start: s, end: addDays(s, 27) });
    }
  } else {
    for (const p of g.periods) out.push({ id: p.id, label: p.name, start: p.start, end: p.end });
  }
  // Abgeschlossene Zeiträume bleiben sichtbar, auch wenn sich das Startdatum später geändert hat
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

// ---------- Note ----------

export function gradeOf(g, delta) {
  if (isSek2(g)) {
    const value = round2(clamp(8 + 3 * delta, 0, 15));
    return { value, rounded: Math.round(value), trend: Math.sign(round2(value - 8)) };
  }
  const value = round2(clamp(3 - delta, 1, 6));
  const rounded = S.data.settings.rounding === 'favor' ? Math.ceil(value - 0.5) : Math.round(value);
  return { value, rounded: clamp(rounded, 1, 6), trend: Math.sign(round2(3 - value)) };
}

// n = Anzahl bewertender Beobachtungen (inkl. schriftlicher Aufgaben mit +, o, −, nicht abgegeben)
export function scoreOf(g, sid, p) {
  const cfg = subjCfg(g);
  let delta = 0, n = 0, plus = 0, minus = 0;
  for (const e of g.entries) {
    if (e.sid !== sid || !inRange(e.date, p)) continue;
    const v = entryValue(cfg, e);
    if (!v) continue;
    delta += v; n++;
    if (v > 0) plus += v; else minus -= v;
  }
  if (g.fach === 'pb') {
    for (const t of g.tasks) {
      if (!inRange(t.date, p)) continue;
      const r = t.results[sid];
      if (!r || r === 'abs') continue;
      const v = writtenValue(cfg, r);
      delta += v; n++;
      if (v > 0) plus += v; else minus -= v;
    }
  }
  return { delta, n, plus, minus, ...gradeOf(g, delta) };
}

// ---------- Status in der aktuellen Stunde (= heute) ----------

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
