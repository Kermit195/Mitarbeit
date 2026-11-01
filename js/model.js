// Datenmodell, Versionierung/Migration und verschlüsselte Speicherung

import * as db from './db.js';
import { deriveKey, encryptJSON, decryptJSON, randomBytes, ITERATIONS } from './crypto.js';
import { defaultSettings, DEFAULT_CLASSES, SUBJECT_ORDER } from './defaults.js';
import { uid, today, currentLesson } from './util.js';

// Bei Änderungen am Datenformat: SCHEMA_VERSION erhöhen und unten eine Migration ergänzen.
export const SCHEMA_VERSION = 1;

const MIGRATIONS = {
  // Beispiel für ein späteres Update:
  // 2: d => { for (const g of d.groups) g.neuesFeld ??= []; },
};

export const S = { data: null, key: null, meta: null };

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

// ---------- Einrichten, Entsperren, Sperren ----------

export async function loadMeta() {
  const meta = await db.get('meta');
  const data = meta ? await db.get('data') : null;
  S.meta = meta && data ? meta : null;
  return S.meta;
}

export async function setupWithKey(key, salt, iter, data) {
  const meta = { salt, iter, created: Date.now() };
  await db.setMany({ meta, data: await encryptJSON(key, data) });
  S.meta = meta; S.key = key; S.data = data;
}

export async function setupPassword(password) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, ITERATIONS);
  await setupWithKey(key, salt, ITERATIONS, newData());
}

export async function unlock(password) {
  const key = await deriveKey(password, S.meta.salt, S.meta.iter);
  const rec = await db.get('data');
  let data;
  try { data = await decryptJSON(key, rec.iv, rec.ct); } catch { return false; }
  const before = data.schemaVersion;
  const migrated = migrate(data);
  S.key = key; S.data = migrated;
  if (migrated.schemaVersion !== before) flush();
  return true;
}

export async function changePassword(oldPw, newPw) {
  const oldKey = await deriveKey(oldPw, S.meta.salt, S.meta.iter);
  const rec = await db.get('data');
  try { await decryptJSON(oldKey, rec.iv, rec.ct); } catch { return false; }
  await flush();
  const salt = randomBytes(16);
  const key = await deriveKey(newPw, salt, ITERATIONS);
  const meta = { salt, iter: ITERATIONS, created: S.meta.created, changed: Date.now() };
  await db.setMany({ meta, data: await encryptJSON(key, S.data) });
  S.meta = meta; S.key = key;
  return true;
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
  S.key = null; S.data = null; S.meta = null;
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
      if (k !== 'pos' && k !== 'results' && k !== 'closed' && k !== 'lastGroup') fillDefaults(target[k], v);
    }
  }
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
    closed: {},          // Zeitraum-ID → { label, start, end, closedAt, results }
    periodStart: null,   // Sport: eigenes Startdatum der 4-Wochen-Blöcke (sonst Standard)
    periods: [],         // PB: frei festgelegte Zeiträume
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

// ---------- Einträge ----------

export function addEntries(g, sids, o) {
  const date = today();
  const stunde = currentLesson(S.data.settings.bell);
  const ts = Date.now();
  const added = [];
  for (const sid of sids) {
    if (o.cat === 'abwesend' && g.entries.some(e => e.sid === sid && e.cat === 'abwesend' && e.date === date)) continue;
    const e = { id: uid(), sid, cat: o.cat, sign: o.sign || 0, date, stunde, ts };
    if (o.level) e.level = o.level;
    if (o.sub) e.sub = o.sub;
    if (o.note) e.note = o.note;
    if (o.extra) e.extra = { ...o.extra };
    if (o.cat === 'abwesend' && g.fach === 'sport') e.extra = { excuse: 'offen' };
    g.entries.push(e);
    added.push(e);
  }
  save();
  return added;
}
