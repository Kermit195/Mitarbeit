// Wiederverwendbare Bedienelemente: Kopfzeile, Dialoge, Toast

import { h, append } from './util.js';

export function btn(label, onClick, cls = '', attrs = {}) {
  const classes = cls ? '.' + cls.trim().split(/\s+/).join('.') : '';
  return h('button.btn' + classes, { type: 'button', onClick, ...attrs }, label);
}

export function topbar({ title, sub, left, center, right }) {
  return h('header.topbar',
    h('div.tb-left', left),
    h('div.tb-center', center || [h('div.tb-title', title), sub && h('div.tb-sub', sub)]),
    h('div.tb-right', right));
}

// Segment-Schalter: options = [[wert, text], …]
export function segmented(options, value, onChange, cls = '') {
  const wrap = h('div.seg' + (cls ? '.' + cls : ''));
  for (const [v, label] of options) {
    const b = h('button' + (v === value ? '.active' : ''), { type: 'button' }, label);
    b.addEventListener('click', () => {
      for (const x of wrap.children) x.classList.remove('active');
      b.classList.add('active');
      onChange(v);
    });
    wrap.append(b);
  }
  return wrap;
}

export function openSheet(title, body = [], opts = {}) {
  const titleEl = h('h2.sheet-title', title);
  const content = h('div.sheet-body');
  const ov = h('div.overlay');
  const close = () => {
    if (!ov.isConnected) return;
    ov.remove();
    if (opts.onClose) opts.onClose();
  };
  const cls = 'div.sheet' + (opts.full ? '.full' : '') + (opts.small ? '.small' : '');
  const sheet = h(cls, { role: 'dialog', 'aria-modal': 'true' },
    h('div.sheet-head', titleEl, h('button.icon-btn', { type: 'button', 'aria-label': 'Schließen', onClick: close }, '✕')),
    content);
  ov.append(sheet);
  ov.addEventListener('click', e => { if (e.target === ov && !opts.modal) close(); });
  document.body.append(ov);
  const api = {
    close,
    el: content,
    setBody(b) { content.replaceChildren(); append(content, b); content.scrollTop = 0; },
    setTitle(t) { titleEl.textContent = t; },
  };
  api.setBody(body);
  return api;
}

export function confirmDialog(msg, { ok = 'OK', cancel = 'Abbrechen', danger = false, title = 'Bitte bestätigen' } = {}) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { done = true; s.close(); resolve(v); };
    const s = openSheet(title, [
      typeof msg === 'string' ? h('p', msg) : msg,
      h('div.btnrow', btn(cancel, () => finish(false), 'ghost'), btn(ok, () => finish(true), danger ? 'danger' : 'primary')),
    ], { small: true, onClose: () => { if (!done) resolve(false); } });
  });
}

export function alertDialog(title, msg) {
  return new Promise(resolve => {
    const s = openSheet(title, [
      typeof msg === 'string' ? h('p', msg) : msg,
      h('div.btnrow', btn('OK', () => s.close(), 'primary')),
    ], { small: true, onClose: resolve });
  });
}

// Formular-Dialog. Ergebnis: Objekt mit den Werten, null bei Abbruch, 'DELETE' bei Löschen.
export function formDialog({ title, fields, ok = 'Speichern', intro, danger = false, validate, onDeleteLabel }) {
  return new Promise(resolve => {
    let done = false;
    const inputs = {};
    const rows = fields.map(f => {
      let input;
      if (f.type === 'select') input = h('select', {}, f.options.map(([v, l]) => h('option', { value: v }, l)));
      else if (f.type === 'textarea') input = h('textarea', { rows: f.rows || 4 });
      else if (f.type === 'checkbox') input = h('input', { type: 'checkbox' });
      else input = h('input', {
        type: f.type || 'text', min: f.min, max: f.max, step: f.step, maxlength: f.maxlength,
        placeholder: f.placeholder, autocomplete: f.type === 'password' ? 'current-password' : 'off',
        inputmode: f.inputmode,
      });
      if (f.type === 'checkbox') input.checked = !!f.value;
      else if (f.value !== undefined && f.value !== null) input.value = f.value;
      inputs[f.name] = input;
      if (f.type === 'checkbox') return h('label.check', input, h('span', f.label));
      return h('label.field', h('span', f.label), input, f.help && h('small', f.help));
    });
    const err = h('p.error');
    const finish = v => { done = true; s.close(); resolve(v); };
    const submit = () => {
      const out = {};
      for (const f of fields) {
        const el = inputs[f.name];
        if (f.type === 'checkbox') out[f.name] = el.checked;
        else if (f.type === 'number') out[f.name] = el.value === '' ? null : Number(el.value);
        else if (f.type === 'password') out[f.name] = el.value;
        else out[f.name] = el.value.trim();
        if (f.required && (out[f.name] === '' || out[f.name] === null)) {
          err.textContent = `Bitte „${f.label}“ ausfüllen.`;
          return;
        }
      }
      const msg = validate ? validate(out) : null;
      if (msg) { err.textContent = msg; return; }
      finish(out);
    };
    const s = openSheet(title, [
      intro && (typeof intro === 'string' ? h('p', intro) : intro),
      h('form.form', { onSubmit: e => { e.preventDefault(); submit(); } },
        rows, err,
        h('div.btnrow',
          onDeleteLabel && btn(onDeleteLabel, () => finish('DELETE'), 'danger ghost left'),
          btn('Abbrechen', () => s.close(), 'ghost'),
          h('button.btn.' + (danger ? 'danger' : 'primary'), { type: 'submit' }, ok))),
    ], { small: true, onClose: () => { if (!done) resolve(null); } });
  });
}

let toastEl = null, toastTimer = null;
export function toast(msg, action) {
  if (toastEl) toastEl.remove();
  clearTimeout(toastTimer);
  const el = h('div.toast', { role: 'status' }, h('span', msg),
    action && h('button', { type: 'button', onClick: () => { el.remove(); action.fn(); } }, action.label));
  toastEl = el;
  document.body.append(el);
  toastTimer = setTimeout(() => el.remove(), action ? 5000 : 3500);
}
