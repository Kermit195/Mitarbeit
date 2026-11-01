// Kleine Hilfsfunktionen: DOM-Aufbau, Datum, Zahlen

const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'indeterminate', 'hidden']);

// h('div.klasse', {attr}, ...kinder) – setzt Texte immer als Textknoten (kein innerHTML)
export function h(spec, props, ...kids) {
  const [tag, ...classes] = spec.split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (props != null && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
    kids.unshift(props);
    props = null;
  }
  const later = [];
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.classList.add(...String(v).split(' ').filter(Boolean));
      else if (k === 'style') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (PROPS.has(k)) later.push([k, v]);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, kids);
  for (const [k, v] of later) el[k] = v;
  return el;
}

export function append(el, kids) {
  for (const k of [kids].flat(Infinity)) {
    if (k === null || k === undefined || k === false || k === true) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

export function uid() {
  const a = crypto.getRandomValues(new Uint32Array(2));
  return a[0].toString(36) + a[1].toString(36);
}

export const pad = n => String(n).padStart(2, '0');
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const round2 = x => Math.round((x + Number.EPSILON) * 100) / 100;

export function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const today = () => isoDate(new Date());
export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
export function fmtDate(s) {
  if (!s) return '–';
  const [y, m, d] = s.split('-');
  return `${d}.${m}.${y}`;
}
export function fmtShort(s) {
  if (!s) return '–';
  const [, m, d] = s.split('-');
  return `${d}.${m}.`;
}
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const weekday = s => WD[parseDate(s).getDay()];
export const fmtNum = (x, digits = 2) => Number(x).toFixed(digits).replace('.', ',');
export function fmtTimestamp(ts) {
  const d = new Date(ts);
  return `${fmtDate(isoDate(d))}, ${pad(d.getHours())}:${pad(d.getMinutes())} Uhr`;
}

// Stunde aus dem Klingelplan ermitteln (10 Min. Vorlauf vor Stundenbeginn)
export function currentLesson(bell, now = new Date()) {
  const m = now.getHours() * 60 + now.getMinutes();
  const toM = s => { const [hh, mm] = s.split(':').map(Number); return hh * 60 + mm; };
  let last = 0;
  for (const b of bell || []) {
    const s = toM(b.start), e = toM(b.end);
    if (m >= s - 10 && m <= e) return b.nr;
    if (m > e) last = b.nr;
  }
  return last;
}

export function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }
