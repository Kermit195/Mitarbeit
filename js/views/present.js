// Präsentationsmodus: zeigt nur die Daten einer Person im Vollbild

import { h, append } from '../util.js';

function openPresent() {
  const inner = h('div.present-inner');
  const exit = h('button.present-exit', { type: 'button' }, 'Zum Beenden 2 Sek. gedrückt halten');
  const ov = h('div.present', { role: 'dialog', 'aria-modal': 'true' }, exit, inner);
  let t = null;
  const close = () => {
    ov.remove();
    document.body.classList.remove('presenting');
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  };
  exit.addEventListener('pointerdown', e => {
    e.preventDefault();
    exit.classList.add('holding');
    clearTimeout(t);
    t = setTimeout(close, 2000);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
    exit.addEventListener(ev, () => { clearTimeout(t); exit.classList.remove('holding'); });
  }
  exit.addEventListener('contextmenu', e => e.preventDefault());
  document.body.classList.add('presenting');
  document.body.append(ov);
  const de = document.documentElement;
  try {
    const req = de.requestFullscreen || de.webkitRequestFullscreen;
    if (req) { const r = req.call(de); if (r && r.catch) r.catch(() => {}); }
  } catch { /* Vollbild nicht verfügbar – die Ansicht deckt trotzdem alles ab */ }
  return { ov, inner, close };
}

export function presentFeedback(name, cfg, fb) {
  const { inner } = openPresent();
  const kind = id => (id.endsWith('gut') ? 'good' : id.endsWith('arbeiten') ? 'work' : 'tip');
  const sec = s => h('div.p-sec.' + kind(s.id), h('h3', s.title), h('p', fb[s.id] || ''));
  const parts = [h('h1', `Feedback für ${name}`)];
  if (cfg.areas) {
    for (const a of cfg.areas) {
      const secs = cfg.feedbackSections.filter(s => s.area === a.id);
      parts.push(h('section.p-area', h('h2', a.label), h('div.p-cols', secs.map(sec))));
    }
  } else {
    parts.push(h('div.p-stack', cfg.feedbackSections.map(sec)));
  }
  inner.append(...parts);
}

export function presentSelf(name, cfg, onDone) {
  const { ov, inner } = openPresent();
  const vals = {};
  const build = () => {
    const y = ov.scrollTop;
    inner.replaceChildren();
    append(inner, [
      h('h1', `Selbsteinschätzung – ${name}`),
      h('p.p-lead', 'Wie schätzt du dich in den letzten Wochen ein? Tippe bei jeder Aussage eine Antwort an.'),
      cfg.areas.map(a => h('section.p-q',
        h('h2', a.label),
        h('p', a.self),
        h('div.p-scale', cfg.selfScale.map((lbl, i) => h('button.p-opt' + (vals[a.id] === i + 1 ? '.active' : ''), {
          type: 'button',
          onClick: () => { vals[a.id] = i + 1; build(); },
        }, h('span.p-num', String(i + 1)), h('span', lbl)))))),
      h('div.p-done', h('button.btn.primary.big', {
        type: 'button',
        disabled: cfg.areas.some(a => !vals[a.id]),
        onClick: () => {
          onDone({ ...vals });
          inner.replaceChildren(h('h1', `Danke, ${name}!`), h('p.p-lead', 'Bitte gib das iPad jetzt zurück.'));
          ov.scrollTop = 0;
        },
      }, 'Fertig'))]);
    ov.scrollTop = y;
  };
  build();
}
