// Datenmodell, Versionierung/Migration und verschlüsselte Speicherung

import * as db from './db.js';
import {
  deriveKey, deriveBits, importAesKey, generateDeviceKey, encryptBytes, decryptBytes,
  encryptJSON, decryptJSON, randomBytes, toB64, fromB64, ITERATIONS,
} from './crypto.js';
import { defaultSettings, DEFAULT_CLASSES, SUBJECT_ORDER, sportConfig, pbConfig } from './defaults.js';
import { uid, today, addDays, daysBetween, currentLesson } from './util.js';

// Bei Änderungen am Datenformat: SCHEMA_VERSION erhöhen und unten eine Migration ergänzen.
// Vor jeder Migration bleibt der alte verschlüsselte Stand als „pre_migration_s<n>“ erhalten.
export const SCHEMA_VERSION = 2;

const MIGRATIONS = {
  2: migrateTo2,
};

// S.meta: Schlüsselinformationen (v2) oder – vor dem Update – die alten Passwort-Metadaten
export const S = { data: null, key: null, meta: null, legacyPending: null };

// ---------- Speichern ----------

let timer = null;
let chain = Promise.resolve();
let onError = null;
export function onSaveError(fn) { onError = fn; }

export function save() {
  clearTimeout(timer);
  timer = setTimeout(flush, 300);
}

export function flush() {
  clearTimeout(timer);
  timer = null;
  const key = S.key, data = S.data;
  if (!key || !data) return chain;
  chain = chain
    .then(async () => { await db.set('data', await encryptJSON(key, data)); })
    .catch(err => { console.error(err); if (onError) onError(err); });
  return chain;
}

// ---------- Zustand beim Start ----------

export async function loadMeta() {
  const meta = await db.get('meta');
  const data = meta ? await db.get('data') : null;
  S.meta = meta && data ? meta : null;
  return S.meta;
}

// true = Daten stammen aus Version 1 (App-Passwort statt PIN)
export const isLegacy = () => !!S.meta && S.meta.v !== 2;

// ---------- Fehlversuche ----------

export async function getAttempts() {
  return (await db.get('attempts')) || { fails: 0, until: 0 };
}

async function registerFail() {
  const a = await getAttempts();
  a.fails++;
  // ab dem 5. Fehlversuch steigende Wartezeit: 30 s, 1 min, 2 min … höchstens 15 min
  if (a.fails >= 5) a.until = Date.now() + Math.min(15 * 60000, 30000 * 2 ** (a.fails - 5));
  await db.set('attempts', a);
  return a;
}

// ---------- Schlüssel ----------

// Datenschlüssel doppelt verpacken: erst mit dem PIN-Schlüssel, dann mit dem Geräteschlüssel
async function wrapRaw(raw, pin, deviceKey) {
  const pinSalt = randomBytes(16);
  const pinKey = await deriveKey(pin, pinSalt, ITERATIONS);
  const inner = await encryptBytes(pinKey, raw);
  const packed = new Uint8Array(12 + inner.ct.length);
  packed.set(inner.iv);
  packed.set(inner.ct, 12);
  return { pinSalt, pinIter: ITERATIONS, wrap: await encryptBytes(deviceKey, packed) };
}

async function unwrapRaw(meta, pin, deviceKey) {
  const packed = await decryptBytes(deviceKey, meta.wrap.iv, meta.wrap.ct);
  const pinKey = await deriveKey(pin, meta.pinSalt, meta.pinIter);
  return decryptBytes(pinKey, packed.subarray(0, 12), packed.subarray(12));
}

async function makeBackupKeyRec(dataKey, password) {
  const salt = randomBytes(16);
  const raw = await deriveBits(password, salt, ITERATIONS);
  const rec = await encryptJSON(dataKey, { salt: toB64(salt), iter: ITERATIONS, raw: toB64(raw) });
  raw.fill(0);
  return rec;
}

// Schlüssel für Sicherungsdateien (aus dem Sicherungspasswort abgeleitet, verschlüsselt gespeichert)
export async function getBackupKey() {
  const rec = await db.get('backupKey');
  if (!rec) throw new Error('Kein Sicherungspasswort festgelegt.');
  const o = await decryptJSON(S.key, rec.iv, rec.ct);
  const raw = fromB64(o.raw);
  const key = await importAesKey(raw);
  raw.fill(0);
  return { key, salt: fromB64(o.salt), iter: o.iter };
}

// ---------- Einrichten, Entsperren, Sperren ----------

export async function setupNew(pin, backupPassword, data = newData()) {
  const deviceKey = await generateDeviceKey();
  const raw = randomBytes(32);
  const dataKey = await importAesKey(raw);
  const w = await wrapRaw(raw, pin, deviceKey);
  raw.fill(0);
  const meta = { v: 2, ...w, created: Date.now() };
  await db.setMany({
    meta,
    deviceKey,
    data: await encryptJSON(dataKey, data),
    backupKey: await makeBackupKeyRec(dataKey, backupPassword),
    attempts: { fails: 0, until: 0 },
  });
  const stored = await db.get('deviceKey');
  if (!stored || typeof stored.algorithm !== 'object') {
    throw new Error('Der Geräteschlüssel konnte nicht gespeichert werden. Bitte Safari aktuell halten.');
  }
  S.meta = meta; S.key = dataKey; S.data = data;
}

// Ergebnis: { ok } | { wrong, attempts } | { wait } | { broken }
export async function unlock(pin) {
  const a = await getAttempts();
  if (a.until > Date.now()) return { wait: a.until - Date.now() };
  const deviceKey = await db.get('deviceKey');
  if (!deviceKey) return { broken: true };
  let raw;
  try { raw = await unwrapRaw(S.meta, pin, deviceKey); } catch { return { wrong: true, attempts: await registerFail() }; }
  const key = await importAesKey(raw);
  raw.fill(0);
  await db.set('attempts', { fails: 0, until: 0 });
  const rec = await db.get('data');
  const data = await decryptJSON(key, rec.iv, rec.ct);
  const before = data.schemaVersion || 1;
  if (before < SCHEMA_VERSION) await db.set(`pre_migration_s${before}`, rec); // Kopie vor der Migration
  const migrated = migrate(data);
  S.key = key; S.data = migrated;
  if (migrated.schemaVersion !== before) await flush();
  return { ok: true };
}

export async function changePin(oldPin, newPin) {
  const deviceKey = await db.get('deviceKey');
  let raw;
  try { raw = await unwrapRaw(S.meta, oldPin, deviceKey); } catch { return false; }
  const w = await wrapRaw(raw, newPin, deviceKey);
  raw.fill(0);
  const meta = { ...S.meta, ...w, changed: Date.now() };
  await db.set('meta', meta);
  S.meta = meta;
  return true;
}

export async function changeBackupPassword(password) {
  await db.set('backupKey', await makeBackupKeyRec(S.key, password));
}

export async function replaceData(data) {
  S.data = migrate(data);
  await flush();
}

export async function lock() {
  await flush();
  S.key = null;
  S.data = null;
}

export async function wipeAll() {
  clearTimeout(timer);
  await chain;
  await db.clearAll();
  S.key = null; S.data = null; S.meta = null; S.legacyPending = null;
}

// ---------- Umstieg von Version 1 (App-Passwort) auf PIN ----------

export async function verifyLegacy(password) {
  const key = await deriveKey(password, S.meta.salt, S.meta.iter);
  const rec = await db.get('data');
  try {
    S.legacyPending = { oldMeta: S.meta, oldRec: rec, data: await decryptJSON(key, rec.iv, rec.ct) };
    return true;
  } catch {
    return false;
  }
}

export async function completeLegacyUpgrade(pin, backupPassword) {
  const { oldMeta, oldRec, data } = S.legacyPending;
  // Interne Kopie der alten Daten anlegen, bevor irgendetwas verändert wird
  await db.set('legacy_v1', { meta: oldMeta, data: oldRec, savedAt: Date.now() });
  await setupNew(pin, backupPassword, migrate(data));
  S.legacyPending = null;
}

export async function hasLegacyCopy() { return !!(await db.get('legacy_v1')); }

// Stand von vor dem Update lesen (altes App-Passwort nötig); Ergebnis bereits migriert, null = falsches Passwort
export async function readLegacyCopy(password) {
  const l = await db.get('legacy_v1');
  const key = await deriveKey(password, l.meta.salt, l.meta.iter);
  let data;
  try { data = await decryptJSON(key, l.data.iv, l.data.ct); } catch { return null; }
  return migrate(data);
}

// ---------- Migration ----------

export function migrate(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.groups)) throw new Error('Unbekanntes Datenformat.');
  if (!d.schemaVersion) d.schemaVersion = 1;
  if (d.schemaVersion > SCHEMA_VERSION) {
    throw new Error('Diese Daten stammen aus einer neueren App-Version. Bitte zuerst die App aktualisieren.');
  }
  while (d.schemaVersion < SCHEMA_VERSION) {
    const next = d.schemaVersion + 1;
    MIGRATIONS[next](d);
    d.schemaVersion = next;
  }
  fillDefaults(d.settings, defaultSettings());
  for (const g of d.groups) fillDefaults(g, newGroup(g.classId, g.fach));
  return d;
}

// Fehlende Schlüssel aus den Standardwerten ergänzen (Arrays werden nicht verändert)
function fillDefaults(target, defaults) {
  for (const [k, v] of Object.entries(defaults)) {
    if (!(k in target)) target[k] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      if (!['pos', 'results', 'closed', 'lastGroup', 'key'].includes(k)) fillDefaults(target[k], v);
    }
  }
}

// Version 1 → 2: Punktekonto, individuelle Zeiträume, Hausaufgaben-Kategorie, Sitzplan aus Sicht der Lehrkraft
function migrateTo2(d) {
  const st = d.settings;
  const oldSport = (st.subjects && st.subjects.sport) || {};
  const oldPb = (st.subjects && st.subjects.pb) || {};
  const blockStart = oldSport.blockStart || '2026-08-24';

  const sport = sportConfig();
  const pb = pbConfig();
  carryConfig(sport, oldSport);
  carryConfig(pb, oldPb);
  const oldArts = oldPb.written && oldPb.written.arts;
  const oldDefaultArts = ['Exit-Ticket', 'Arbeitsblatt', 'Hausaufgabe', 'Sonstiges'];
  if (oldArts && oldArts.join('|') !== oldDefaultArts.join('|')) pb.written.arts = oldArts.slice();
  st.subjects = { sport, pb };
  delete st.rounding;

  const t = today();
  for (const g of d.groups) {
    g.lessons = []; // Stunden werden ab dem Update gezählt
    if (!Array.isArray(g.periods)) g.periods = [];
    const closed = g.closed || (g.closed = {});
    const hasData = g.entries.length > 0 || Object.keys(closed).length > 0;

    // Sport: bisherige 4-Wochen-Blöcke werden normale Zeiträume (gleiche ID → Zuordnung bleibt)
    if (g.fach === 'sport' && hasData) {
      const start = g.periodStart || blockStart;
      const k = Math.max(0, Math.floor(daysBetween(start, t) / 28));
      for (let i = 0; i <= Math.min(k, 60); i++) {
        const s = addDays(start, 28 * i);
        g.periods.push({ id: 'B' + s, name: `Block ${i + 1}`, start: s, end: addDays(s, 27) });
      }
    }
    delete g.periodStart;

    for (const [id, rec] of Object.entries(closed)) {
      const confirmed = Object.values(rec.results || {}).filter(r => r.confirmed);
      if (!g.periods.some(p => p.id === id) && confirmed.length) g.periods.push({ id, name: rec.label, start: rec.start, end: rec.end });
      for (const r of confirmed) r.legacy = true; // Note wurde im alten System bestätigt
    }
    g.periods.sort((a, b) => a.start.localeCompare(b.start));

    // PB: „Hausaufgaben vergessen“ → Hausaufgaben „−“
    if (g.fach === 'pb') {
      for (const e of g.entries) {
        if (e.cat === 'material' && e.sub === 'Hausaufgaben vergessen') {
          e.cat = 'hausaufgaben'; e.level = '-'; e.sign = -1; delete e.sub;
        }
      }
    }

    // Sitzpläne: Tafel war oben → um 180° drehen (Tafel unten, erste Reihe unten)
    for (const sp of g.seatplans || []) rotatePlan(sp);
  }
}

function carryConfig(n, o) {
  if (o.thresholds) for (const k of Object.keys(n.thresholds)) if (Number.isFinite(o.thresholds[k])) n.thresholds[k] = o.thresholds[k];
  for (const oc of o.cats || []) {
    const nc = n.cats.find(c => c.id === oc.id);
    if (nc) { if (oc.hidden) nc.hidden = true; continue; }
    if (oc.custom) {
      n.cats.push({
        id: oc.id, label: oc.label, section: n.sections[1].id, custom: true, hidden: !!oc.hidden,
        plus: oc.plus ? 1 : undefined, minus: oc.minus ? -1 : undefined,
        subs: oc.subs || [], hint: oc.hint || '', fb: oc.fb || {},
      });
    }
  }
  if (o.fbGeneric) for (const k of Object.keys(n.fbGeneric)) if (typeof o.fbGeneric[k] === 'string') n.fbGeneric[k] = o.fbGeneric[k];
}

export function rotatePlan(sp) {
  const ps = Object.values(sp.pos || {});
  if (!ps.length) return;
  const minX = Math.min(...ps.map(p => p.x));
  const maxX = Math.max(...ps.map(p => p.x));
  const maxY = Math.max(...ps.map(p => p.y));
  for (const p of ps) { p.x = minX + maxX - p.x; p.y = maxY - p.y; }
}

// ---------- Aufbau ----------

export function newData() {
  const d = { schemaVersion: SCHEMA_VERSION, created: Date.now(), settings: defaultSettings(), classes: [], groups: [] };
  for (const c of DEFAULT_CLASSES) addClass(d, c.name, c.subjects, c.sek2);
  return d;
}

export function newGroup(classId, fach) {
  const plan = { id: uid(), name: 'Reihen', pos: {} };
  return {
    id: uid(), classId, fach,
    students: [],
    entries: [],
    lessons: [],         // gezählte Unterrichtstage (JJJJ-MM-TT)
    closed: {},          // Zeitraum-ID → { label, start, end, closedAt, results }
    periods: [],         // individuell angelegte Zeiträume { id, name, start, end }
    tasks: [],           // PB: schriftliche Aufgaben
    seatplans: fach === 'pb' ? [plan] : [],
    activeSeat: fach === 'pb' ? plan.id : null,
    seatLocked: true,
  };
}

export function addClass(d, name, subjects, sek2) {
  const cls = { id: uid(), name, sek2: !!sek2 };
  d.classes.push(cls);
  for (const f of subjects) d.groups.push(newGroup(cls.id, f));
  return cls;
}

export function resetGroup(g) {
  const fresh = newGroup(g.classId, g.fach);
  fresh.id = g.id;
  Object.keys(g).forEach(k => delete g[k]);
  Object.assign(g, fresh);
}

// ---------- Abfragen ----------

export const getGroup = id => S.data.groups.find(g => g.id === id);
export const getClass = id => S.data.classes.find(c => c.id === id);
export const groupsOfClass = cid => S.data.groups
  .filter(g => g.classId === cid)
  .sort((a, b) => SUBJECT_ORDER.indexOf(a.fach) - SUBJECT_ORDER.indexOf(b.fach));
export const subjCfg = g => S.data.settings.subjects[g.fach];
export const isSek2 = g => !!getClass(g.classId)?.sek2;
export const findStudent = (g, sid) => g.students.find(s => s.id === sid);
export const studentLabel = st => st ? (st.kuerzel ? `${st.vorname} ${st.kuerzel}` : st.vorname) : '(gelöscht)';
export const sortedStudents = g => [...g.students].sort((a, b) =>
  studentLabel(a).localeCompare(studentLabel(b), 'de', { sensitivity: 'base' }));

// ---------- Stunden und Einträge ----------

export function addLesson(g, date) {
  if (!g.lessons.includes(date)) {
    g.lessons.push(date);
    g.lessons.sort();
  }
}

export function removeLesson(g, date) {
  g.lessons = g.lessons.filter(d => d !== date);
}

const isAbsent = (g, sid, date) => g.entries.some(e => e.sid === sid && e.cat === 'abwesend' && e.date === date);

// Ergebnis: { added: [...], skipped: [sid …] } (skipped = an diesem Tag nicht anwesend)
export function addEntries(g, sids, o) {
  const date = today();
  const stunde = currentLesson(S.data.settings.bell);
  const ts = Date.now();
  const cat = subjCfg(g).cats.find(c => c.id === o.cat);
  const level = cat && cat.levels ? cat.levels.find(l => l.id === o.level) : null;
  const added = [], skipped = [];
  addLesson(g, date);
  for (const sid of sids) {
    if (o.cat === 'abwesend') {
      if (isAbsent(g, sid, date)) continue;
      // Wertungsfrei: Hausaufgaben dieses Tages entfallen, Schriftliches wird „nicht anwesend“
      g.entries = g.entries.filter(e => !(e.sid === sid && e.cat === 'hausaufgaben' && e.date === date));
      for (const t of g.tasks) if (t.date === date) t.results[sid] = 'abs';
    }
    if (cat && cat.onePerDay) {
      if (isAbsent(g, sid, date)) { skipped.push(sid); continue; }
      g.entries = g.entries.filter(e => !(e.sid === sid && e.cat === o.cat && e.date === date));
    }
    const e = { id: uid(), sid, cat: o.cat, sign: level ? Math.sign(level.pts) : (o.sign || 0), date, stunde, ts };
    if (o.level) e.level = o.level;
    if (o.sub) e.sub = o.sub;
    if (o.note) e.note = o.note;
    if (o.extra) e.extra = { ...o.extra };
    if (o.cat === 'abwesend' && g.fach === 'sport') e.extra = { excuse: 'offen' };
    g.entries.push(e);
    added.push(e);
  }
  save();
  return { added, skipped };
}
