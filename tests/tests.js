// Tests für Notenberechnung (Stundenwert in Prozent) und Migration v2 → v3.
// Läuft nur im Arbeitsspeicher; es werden keine Daten gespeichert.

import { S, newData, getClass, migrate, SCHEMA_VERSION } from '../js/model.js';
import { scoreOf, lessonValue, gradeFor, weakSek2 } from '../js/grading.js';
import { nextBetter, evidence } from '../js/explain.js';
import { uid, addDays, today } from '../js/util.js';

const results = [];
function check(name, actual, expected) {
  const ok = typeof expected === 'number' && typeof actual === 'number'
    ? Math.abs(actual - expected) < 1e-6
    : JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ name, ok, actual, expected });
}

// ---------- Hilfen ----------

S.data = newData();
const P = { start: '2026-09-01', end: '2026-12-31' };

function fresh(cls, fach) {
  const g = S.data.groups.find(x => x.fach === fach && getClass(x.classId).name === cls);
  Object.assign(g, { students: [{ id: 'a', vorname: 'Alex' }], entries: [], lessons: [], tasks: [], periods: [] });
  return g;
}
const dates = n => Array.from({ length: n }, (_, i) => addDays('2026-09-07', 7 * i));
const add = (g, date, cat, extra = {}) => {
  g.entries.push({ id: uid(), sid: 'a', cat, date, sign: 0, ts: 0, ...extra });
  if (!g.lessons.includes(date)) { g.lessons.push(date); g.lessons.sort(); }
};
const lessons = (g, ds) => { for (const d of ds) if (!g.lessons.includes(d)) g.lessons.push(d); g.lessons.sort(); };
const score = g => scoreOf(g, 'a', P);

// ---------- Pflicht-Testfälle Sport (Sek I) ----------

{
  const g = fresh('8a', 'sport');
  lessons(g, dates(10));
  const s = score(g);
  check('Sport: 10 Stunden „gut“ ohne Einträge → 88 %', s.avg, 88);
  check('Sport: … → Note 2', s.grade, 2);
}
{
  const g = fresh('8a', 'sport');
  const ds = dates(10);
  lessons(g, ds);
  add(g, ds[3], 'vergessen', { sign: -1 });
  const s = score(g);
  check('Sport: 9× gut, 1× Sportsachen vergessen → 79,2 %', s.avg, 79.2);
  check('Sport: … → Note 3', s.grade, 3);
}
{
  const g = fresh('8a', 'sport');
  const [d] = dates(1);
  add(g, d, 'hilfe', { sign: 1 });
  add(g, d, 'fair', { sign: 1 });
  check('Sport: Stunde gut + 2 Plus-Einträge → 96 %', lessonValue(g, 'a', d).value, 96);
  check('Sport: 96 % entspricht Note 1', gradeFor(g, 96), 1);
}
{
  const g = fresh('8a', 'sport');
  const ds = dates(10);
  lessons(g, ds);
  for (const d of ds.slice(5)) add(g, d, 'einsatzstufe', { level: 'ausr', sign: -1 });
  const s = score(g);
  check('Sport: 5× gut, 5× Einsatz ausreichend → 70 %', s.avg, 70);
  check('Sport: … → Note 3', s.grade, 3);
}
{
  const g = fresh('8a', 'sport');
  const [d] = dates(1);
  add(g, d, 'vergessen', { sign: -1 });
  add(g, d, 'protokoll', { level: 'sg' });
  check('Sport: Sportsachen vergessen + Protokoll sehr gut → 52 %', lessonValue(g, 'a', d).value, 52);
}

// ---------- Pflicht-Testfälle PB ----------

{
  const g = fresh('8a', 'pb');
  lessons(g, dates(6));
  const s = score(g);
  check('PB Sek I: keine Einträge → 65 %', s.avg, 65);
  check('PB Sek I: … → Note 3', s.grade, 3);
}
{
  const g = fresh('8a', 'pb');
  for (const d of dates(6)) {
    add(g, d, 'rede', { level: 'II', sign: 1 });
    add(g, d, 'rede', { level: 'III', sign: 1 });
  }
  const s = score(g);
  check('PB Sek I: jede Stunde AFB II + AFB III → 90 %', s.avg, 90);
  check('PB Sek I: … → Note 2', s.grade, 2);
}
{
  const g = fresh('12 GK', 'pb');
  lessons(g, dates(6));
  const s = score(g);
  check('PB Sek II: keine Einträge → 60 %', s.avg, 60);
  check('PB Sek II: … → 8 Punkte', s.grade, 8);
}

// ---------- Weitere Fälle ----------

{
  const g = fresh('8a', 'sport');
  const [d] = dates(1);
  for (let i = 0; i < 5; i++) add(g, d, 'hilfe', { sign: 1 });
  check('Begrenzung: 88 % + 5× 4 % → 100 %', lessonValue(g, 'a', d).value, 100);
  add(g, d, 'vergessen', { sign: -1 });
  add(g, d, 'protokoll', { level: 'sg' });
  add(g, d, 'stoerung', { sign: -1 });
  check('Protokoll bei vergessenen Sachen: höchstens 52 %, auch mit weiteren Einträgen', lessonValue(g, 'a', d).value, 52);
}
{
  const g = fresh('8a', 'sport');
  const [d] = dates(1);
  add(g, d, 'vergessen', { sign: -1 });
  add(g, d, 'protokoll', { level: 'a' });
  add(g, d, 'stoerung', { sign: -1 });
  check('Protokoll ausreichend (52 %) − Störung 4 % → 48 %', lessonValue(g, 'a', d).value, 48);
}
{
  const g = fresh('8a', 'sport');
  const ds = dates(3);
  lessons(g, ds);
  add(g, ds[0], 'abwesend');
  add(g, ds[1], 'eingeschraenkt');
  const s = score(g);
  check('Nicht anwesend und eingeschränkte Teilnahme sind wertungsfrei', s.graded, 1);
  check('… Durchschnitt nur aus der gewerteten Stunde', s.avg, 88);
}
{
  // Befreiung ohne Attest, Frist (nächste Stunde) vorbei → unentschuldigt 0 % – auch mit Protokoll und passiver Aufgabe
  const g = fresh('8a', 'sport');
  const ds = dates(3);
  lessons(g, ds);
  add(g, ds[0], 'befreit', { extra: { bis: ds[0], attest: false } });
  add(g, ds[0], 'protokoll', { level: 'sg' });
  add(g, ds[0], 'passivaufgabe');
  check('Befreiung ohne Attest nach Fristablauf → 0 % (Protokoll/passive Aufgabe ändern nichts)', lessonValue(g, 'a', ds[0]).value, 0);
  g.entries.find(e => e.cat === 'befreit').extra.attestLater = true;
  check('… „Attest nachgereicht“ → wieder wertungsfrei bzw. Protokollwert', lessonValue(g, 'a', ds[0]).value, 100);
}
{
  const g = fresh('8a', 'sport');
  const t = today();
  add(g, t, 'befreit', { extra: { bis: t, attest: false } });
  check('Befreiung ohne Attest innerhalb der Frist → wertungsfrei', lessonValue(g, 'a', t).graded, false);
  add(g, t, 'passivaufgabe');
  check('… mit „hatte passive Aufgabe“ → gewertet ab 88 %', lessonValue(g, 'a', t).value, 88);
}
{
  const g = fresh('8a', 'sport');
  const ds = dates(2);
  lessons(g, ds);
  add(g, ds[0], 'befreit', { extra: { bis: ds[1], attest: true } });
  check('Befreiung mit Attest → wertungsfrei', score(g).graded, 0);
  check('… ohne gewertete Stunde kein Vorschlag', score(g).grade, null);
}
{
  const g = fresh('8a', 'pb');
  const [d] = dates(1);
  add(g, d, 'hausaufgaben', { level: '-', sign: -1 });
  g.tasks.push({ id: 't', title: 'Exit', date: d, art: 'Exit-Ticket', results: { a: '+' } });
  check('PB: Hausaufgaben − (−15 %) und Schriftlich + (+10 %) zählen zur Stunde ihres Datums → 60 %', lessonValue(g, 'a', d).value, 60);
}
{
  const g = fresh('8a', 'pb');
  lessons(g, dates(3));
  check('Vorläufig unter 4 gewerteten Stunden', score(g).provisional, true);
  lessons(g, dates(4));
  check('Nicht mehr vorläufig ab 4 gewerteten Stunden', score(g).provisional, false);
}
{
  const g = fresh('12 GK', 'pb');
  check('Sek II: 40 % → 4 Punkte', gradeFor(g, 40), 4);
  check('Sek II: Hinweis bei 4 Punkten', weakSek2(g, 4), true);
  check('Sek II: kein Hinweis bei 5 Punkten', weakSek2(g, 5), false);
  check('Sek II: unter 20 % → 0 Punkte', gradeFor(g, 19.9), 0);
  check('Nächstbessere Note zu 8 Punkten: 9 ab 65 %', nextBetter(g, 8), { grade: 9, min: 65 });
}
{
  const g = fresh('8a', 'sport');
  check('Grenzen Sek I: 96 → 1, 95,9 → 2, 45 → 4, 44,9 → 5, 15,9 → 6',
    [96, 95.9, 45, 44.9, 15.9].map(x => gradeFor(g, x)), [1, 2, 4, 5, 6]);
}
{
  const g = fresh('8a', 'sport');
  const ds = dates(4);
  lessons(g, ds);
  add(g, ds[0], 'einsatzstufe', { level: 'befr', sign: -1 });
  add(g, ds[1], 'hilfe', { sign: 1 });
  add(g, ds[2], 'unpuenktlich', { sign: -1 });
  const ev = Object.fromEntries(evidence(g, 'a', P));
  check('Belege: Einsatz zusammengefasst', ev.Einsatz, '3× gut, 1× befriedigend');
  check('Belege: Plus und Minus', [ev.Plus, ev.Minus], ['1× Hilfe und Unterstützung', '1× Unpünktlich']);
}

// ---------- Migration v2 → v3 ----------

{
  const d = newData();
  // Daten in das Format von Version 2 zurückversetzen (nur die für die Migration relevanten Teile)
  d.schemaVersion = 2;
  d.settings.subjects = {
    sport: { thresholds: { haeufung: 4, luecke: 2, excuseDays: 7 }, periodWeeks: 4, cats: [{ id: 'respekt', hidden: false }], fbGeneric: { tipp: 'Eigener Tipp' } },
    pb: { thresholds: { haeufung: 3, luecke: 3 }, written: { points: { '+': 2 }, arts: ['Exit-Ticket', 'Mindmap'] }, cats: [] },
  };
  delete d.settings.keys;
  const sport = d.groups.find(g => g.fach === 'sport');
  const pb = d.groups.find(g => g.fach === 'pb');
  const e = (cat, sign, extra = {}) => ({ id: uid(), sid: 's', cat, sign, date: '2026-11-03', ts: 0, ...extra });
  sport.entries = [
    e('respekt', 1), e('respekt', -1), e('einsatz', 1), e('einsatz', -1),
    e('passiv', 1, { level: 'p2' }), e('passiv', 0, { level: 'n0' }), e('passiv', -1, { level: 'm2' }),
    e('zusammenkommen', 1), e('aufbau', -1),
    e('material', -1, { sub: 'Sportsachen vergessen' }), e('material', -1, { sub: 'Fingernägel zu lang' }),
    e('material', -1, { sub: 'Schmuck nicht abgelegt' }), e('material', -1),
    e('entschuldigung', -1, { note: 'Fehlstunde vom 01.11.2026' }),
    e('abwesend', 0, { extra: { excuse: 'offen' } }),
    e('befreit', 0, { extra: { bis: '2026-11-10', attest: false } }),
    e('stoerung', -1, { sub: 'Nebengespräche' }), e('unpuenktlich', -1), e('beteiligung', 1),
  ];
  sport.closed = { b1: { label: 'Block 1', start: '2026-10-01', end: '2026-10-31', closedAt: 1, results: { s: { confirmed: true, grade: 2, proposalGrade: 3 } } } };
  pb.entries = [e('hausaufgaben', 1, { level: '+' }), e('rede', 1, { level: 'III' })];
  pb.seatplans[0].pos = { s: { x: 1, y: 0 } };
  delete pb.seatplans[0].scale;

  const m = migrate(JSON.parse(JSON.stringify(d)));
  const sg = m.groups.find(g => g.id === sport.id);
  const map = sg.entries.map(x => [x.cat, x.level || '', x.sign, x.sub || ''].join('|'));
  check('Migration: Datenformat 3', m.schemaVersion, SCHEMA_VERSION);
  check('Migration Sport: Zuordnung alt → neu', map, [
    'fair||1|', 'unfair|n|-1|', 'einsatz||1|', 'einsatzstufe|befr|-1|',
    'beteiligung||1|', 'notiz||0|', 'einsatzstufe|befr|-1|',
    'zusammenkommen|plus|1|', 'aufbau|laenger|-1|',
    'vergessen||-1|', 'naegel||-1|', 'schmuck||-1|', 'vergessen||-1|',
    'notiz||0|',
    'abwesend||0|', 'befreit||0|',
    'stoerung||-1|Nebengespräche', 'unpuenktlich||-1|', 'beteiligung||1|',
  ]);
  check('Migration: Entschuldigungsstatus entfernt', sg.entries.find(x => x.cat === 'abwesend').extra, undefined);
  check('Migration: alte Befreiung ohne Attest gilt als „Attest nachgereicht“', sg.entries.find(x => x.cat === 'befreit').extra.attestLater, true);
  check('Migration: Notiz behält alte Bemerkung', sg.entries.filter(x => x.cat === 'notiz')[1].note, 'Entschuldigung nicht nachgereicht (Version 2) – Fehlstunde vom 01.11.2026');
  check('Migration: bestätigte Note bleibt unverändert (markiert)', [sg.closed.b1.results.s.grade, sg.closed.b1.results.s.legacy], [2, 'v2']);
  check('Migration: Schwellen übernommen', m.settings.subjects.sport.thresholds, { haeufung: 4, luecke: 2 });
  check('Migration: eigener Feedback-Baustein übernommen', m.settings.subjects.sport.fbGeneric.tipp, 'Eigener Tipp');
  check('Migration: Aufgabenarten übernommen', m.settings.subjects.pb.written.arts, ['Exit-Ticket', 'Mindmap']);
  check('Migration: Notenschlüssel ergänzt', m.settings.keys.sek1[0], { grade: 1, min: 96 });
  const pg = m.groups.find(g => g.id === pb.id);
  check('Migration PB: Einträge unverändert', pg.entries.map(x => x.cat + x.level), ['hausaufgaben+', 'redeIII']);
  check('Migration PB: Sitzplan bekommt Kachelgröße 0,75, Plätze bleiben', [pg.seatplans[0].scale, pg.seatplans[0].pos.s], [0.75, { x: 1, y: 0 }]);
  check('Migration: zweimal ausführen ändert nichts', JSON.stringify(migrate(JSON.parse(JSON.stringify(m)))), JSON.stringify(m));
}

// ---------- Migration v1 → v3 (sehr alte Sicherungen) ----------

{
  const d = newData();
  d.schemaVersion = 1;
  d.settings.subjects = { sport: { blockStart: '2026-08-24', thresholds: { haeufung: 3, luecke: 3, excuseDays: 7 }, cats: [] }, pb: { written: { w: 0.15, arts: ['Exit-Ticket', 'Arbeitsblatt', 'Hausaufgabe', 'Sonstiges'] }, cats: [] } };
  d.settings.rounding = 'math';
  delete d.settings.keys;
  const sport = d.groups.find(g => g.fach === 'sport');
  const pb = d.groups.find(g => g.fach === 'pb');
  delete sport.lessons; delete pb.lessons;
  sport.entries = [{ id: 'x1', sid: 's', cat: 'respekt', sign: 1, date: '2026-09-01', ts: 0 }];
  pb.entries = [{ id: 'x2', sid: 's', cat: 'material', sign: -1, sub: 'Hausaufgaben vergessen', date: '2026-09-02', ts: 0 }];
  pb.seatplans[0].pos = { s: { x: 1, y: 4 }, t: { x: 11, y: 10 } };
  const m = migrate(JSON.parse(JSON.stringify(d)));
  const sg = m.groups.find(g => g.id === sport.id);
  const pg = m.groups.find(g => g.id === pb.id);
  check('Migration v1→v3: Datenformat', m.schemaVersion, SCHEMA_VERSION);
  check('Migration v1→v3: Respekt + → Besonders fair', sg.entries[0].cat, 'fair');
  check('Migration v1→v3: Sport-Blöcke werden Zeiträume', sg.periods[0].id, 'B2026-08-24');
  check('Migration v1→v3: „Hausaufgaben vergessen“ → Hausaufgaben −', [pg.entries[0].cat, pg.entries[0].level], ['hausaufgaben', '-']);
  check('Migration v1→v3: Sitzplan gedreht (Tafel unten)', [pg.seatplans[0].pos.s, pg.seatplans[0].pos.t], [{ x: 11, y: 6 }, { x: 1, y: 0 }]);
  check('Migration v1→v3: Rundungs-Einstellung entfernt', 'rounding' in m.settings, false);
}

// ---------- Ausgabe ----------

const list = document.getElementById('results');
for (const r of results) {
  const li = document.createElement('li');
  li.className = r.ok ? 'ok' : 'fail';
  li.textContent = r.ok ? `✓ ${r.name}` : `✗ ${r.name} – erwartet ${JSON.stringify(r.expected)}, erhalten ${JSON.stringify(r.actual)}`;
  list.append(li);
}
const failed = results.filter(r => !r.ok).length;
const sum = document.getElementById('summary');
sum.textContent = failed ? `${failed} von ${results.length} Tests fehlgeschlagen` : `Alle ${results.length} Tests bestanden`;
sum.className = failed ? 'fail' : 'ok';
window.testResults = { total: results.length, failed, results };
