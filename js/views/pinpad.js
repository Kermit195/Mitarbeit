// Ziffernfeld für die 4-stellige PIN

import { h } from '../util.js';

export function pinPad({ onComplete, length = 4 }) {
  let value = '';
  let busy = false;
  const dots = h('div.pin-dots');
  const msg = h('p.pin-msg');
  const update = () => {
    dots.replaceChildren(...Array.from({ length }, (_, i) => h('span.pin-dot' + (i < value.length ? '.on' : ''))));
  };
  const press = d => {
    if (busy) return;
    if (d === 'del') { value = value.slice(0, -1); update(); return; }
    if (value.length >= length) return;
    value += d;
    update();
    if (value.length === length) {
      const v = value;
      setTimeout(() => onComplete(v), 120);
    }
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  const grid = h('div.pin-grid', keys.map(k => (k === ''
    ? h('span')
    : h('button.pin-key' + (k === 'del' ? '.del' : ''), {
      type: 'button',
      'aria-label': k === 'del' ? 'Löschen' : k,
      onClick: () => press(k),
    }, k === 'del' ? '⌫' : k))));
  const el = h('div.pinpad', dots, msg, grid);
  const onKey = e => {
    if (!el.isConnected) { document.removeEventListener('keydown', onKey); return; }
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
  };
  document.addEventListener('keydown', onKey);
  update();
  return {
    el,
    reset(text = '', isError = false) {
      value = '';
      busy = false;
      msg.textContent = text;
      msg.classList.toggle('error', isError);
      el.classList.toggle('shake', isError);
      update();
      grid.querySelectorAll('button').forEach(b => { b.disabled = false; });
    },
    busy(text) {
      busy = true;
      msg.textContent = text;
      msg.classList.remove('error');
      grid.querySelectorAll('button').forEach(b => { b.disabled = true; });
    },
  };
}

export const weakPin = pin => /^(\d)\1{3}$/.test(pin) || ['1234', '4321', '0123', '9876'].includes(pin);
