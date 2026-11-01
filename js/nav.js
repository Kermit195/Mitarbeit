// Einfache Navigation: eine aktuelle Ansicht, neu zeichnen bei Änderungen

export const ui = { view: { name: 'start' } };
export const hooks = { lock: null };

let renderer = () => {};
export function setRenderer(fn) { renderer = fn; }

export function go(view) {
  ui.view = view;
  renderer(true);
}

export function render() { renderer(false); }
