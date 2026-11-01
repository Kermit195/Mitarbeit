// Feedback-Entwurf aus festen Satzbausteinen (lokal, ohne KI)

import { subjCfg, findStudent } from './model.js';
import { catOf, inRange, redeStats } from './grading.js';

function fill(text, st, subs = []) {
  let t = String(text || '');
  if (!subs.length) t = t.replace(/\s*\(\{subs\}\)/g, '').replace(/\{subs\}/g, '');
  else t = t.replace(/\{subs\}/g, subs.join(', '));
  return t.replace(/\{name\}/g, st?.vorname || '');
}

function collect(g, sid, p) {
  const cfg = subjCfg(g);
  const stats = {};
  for (const e of g.entries) {
    if (e.sid !== sid || !inRange(e.date, p) || !e.sign) continue;
    const c = catOf(cfg, e.cat);
    if (!c || c.neutral) continue;
    const s = stats[c.id] || (stats[c.id] = { c, plus: 0, minus: 0, subs: new Set() });
    if (e.sign > 0) s.plus++; else s.minus++;
    if (e.sub) s.subs.add(e.sub);
  }
  const list = Object.values(stats);
  const w = s => Number(s.c.w) || 0.1;
  return {
    plus: list.filter(s => s.plus > 0 && s.c.fb?.plus).sort((a, b) => b.plus * w(b) - a.plus * w(a)),
    minus: list.filter(s => s.minus > 0 && s.c.fb?.minus).sort((a, b) => b.minus * w(b) - a.minus * w(a)),
    anyMinus: list.some(s => s.minus > 0),
  };
}

export function draftFeedback(g, sid, p) {
  const cfg = subjCfg(g);
  const st = findStudent(g, sid);
  const G = cfg.fbGeneric;
  const { plus, minus, anyMinus } = collect(g, sid, p);

  if (g.fach === 'sport') {
    const gut = plus.slice(0, 3).map(s => fill(s.c.fb.plus, st, [...s.subs]));
    if (!anyMinus && G.keineMinus) gut.push(fill(G.keineMinus, st));
    if (!gut.length) gut.push(fill(G.gutLeer, st));
    const arbeiten = minus.slice(0, 3).map(s => fill(s.c.fb.minus, st, [...s.subs]));
    if (!arbeiten.length) arbeiten.push(fill(G.arbeitenLeer, st));
    const tipSrc = minus.find(s => s.c.fb.tip);
    return { gut: gut.join(' '), arbeiten: arbeiten.join(' '), tipp: fill(tipSrc ? tipSrc.c.fb.tip : G.tipp, st) };
  }

  // PB: drei Bereiche, jeweils „gut“ und „arbeiten“
  const out = {};
  for (const a of cfg.areas) out[a.id] = { gut: [], arbeiten: [] };
  const area = s => (out[s.c.fb?.area] ? s.c.fb.area : 'beteiligung');
  for (const s of plus) if (out[area(s)].gut.length < 2) out[area(s)].gut.push(fill(s.c.fb.plus, st, [...s.subs]));
  for (const s of minus) if (out[area(s)].arbeiten.length < 2) out[area(s)].arbeiten.push(fill(s.c.fb.minus, st, [...s.subs]));

  const rs = redeStats(g, p);
  const n = rs.counts[sid] || 0;
  const lv = rs.levels[sid] || { I: 0, II: 0, III: 0 };
  if (out.inhalt) {
    if (lv.III >= 1 || lv.II >= 2) out.inhalt.gut.unshift(fill(G.redeAnspruch, st));
    else if (n >= 2) out.inhalt.arbeiten.unshift(fill(G.redeVertiefen, st));
  }
  if (out.beteiligung) {
    if (n > 0 && n >= rs.avg) out.beteiligung.gut.unshift(fill(G.redeViel, st));
    else if (n < rs.avg * 0.5 || n === 0) out.beteiligung.arbeiten.unshift(fill(G.redeWenig, st));
  }

  let wp = 0, wm = 0, wna = 0;
  for (const t of g.tasks) {
    if (!inRange(t.date, p)) continue;
    const r = t.results[sid];
    if (r === '+') wp++; else if (r === '-') wm++; else if (r === 'na') wna++;
  }
  if (out.inhalt) {
    if (wp > 0 && wp >= wm) out.inhalt.gut.push(fill(G.schriftlichGut, st));
    if (wm > 0) out.inhalt.arbeiten.push(fill(G.schriftlichArbeiten, st));
  }
  if (wna > 0 && out.beteiligung) out.beteiligung.arbeiten.push(fill(G.nichtAbgegeben, st));

  const result = {};
  for (const a of cfg.areas) {
    const o = out[a.id];
    result[a.id + '_gut'] = (o.gut.length ? o.gut : [fill(G[a.id + 'GutLeer'] || '', st)]).join(' ');
    result[a.id + '_arbeiten'] = (o.arbeiten.length ? o.arbeiten : [fill(G[a.id + 'ArbeitenLeer'] || '', st)]).join(' ');
  }
  return result;
}
