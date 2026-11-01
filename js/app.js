// Einstiegspunkt: Rendern, automatische Sperre, Service Worker

import { S, loadMeta, lock, flush, onSaveError } from './model.js';
import { setRenderer, ui, hooks } from './nav.js';
import { h } from './util.js';
import { toast } from './ui.js';
import { clearUndo } from './undo.js';
import { initSW } from './sw-client.js';
import { renderAuth } from './views/auth.js';
import { renderStart } from './views/start.js';
import { renderGroup } from './views/group.js';
import { renderSettings } from './views/settings.js';
import { resetSel } from './views/common.js';

function doRender(resetScroll) {
  const root = document.getElementById('app');
  const y = window.scrollY;
  root.replaceChildren();
  if (!S.data) {
    renderAuth(root);
    window.scrollTo(0, 0);
    return;
  }
  const v = ui.view;
  if (v.name === 'group') renderGroup(root, v);
  else if (v.name === 'settings') renderSettings(root, v);
  else renderStart(root);
  window.scrollTo(0, resetScroll ? 0 : y);
}

// ---------- Automatische Sperre ----------

let lastActivity = Date.now();
let hiddenAt = null;
const lockMs = () => (Number(S.data?.settings.lockMinutes) || 5) * 60000;

async function lockApp() {
  if (!S.data) return;
  document.querySelectorAll('.overlay, .present, .toast').forEach(el => el.remove());
  document.body.classList.remove('presenting');
  clearUndo();
  resetSel(null);
  await lock();
  doRender(true);
}

function checkIdle() {
  if (S.data && Date.now() - lastActivity >= lockMs()) lockApp();
}

for (const ev of ['pointerdown', 'keydown', 'input', 'scroll', 'touchstart']) {
  document.addEventListener(ev, () => { lastActivity = Date.now(); }, { capture: true, passive: true });
}
setInterval(checkIdle, 5000);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now();
    flush();
  } else {
    if (S.data && hiddenAt && Date.now() - hiddenAt > 60000) lockApp();
    else checkIdle();
    hiddenAt = null;
  }
});
window.addEventListener('pagehide', () => { flush(); });

// ---------- Start ----------

async function boot() {
  setRenderer(doRender);
  hooks.lock = lockApp;
  onSaveError(err => toast('Speichern fehlgeschlagen: ' + (err && err.message ? err.message : err)));
  if (!window.crypto || !crypto.subtle || !window.indexedDB) {
    document.getElementById('app').replaceChildren(h('p.boot', 'Dieser Browser unterstützt die benötigte Verschlüsselung nicht. Bitte Safari auf dem iPad verwenden (Seite über https öffnen).'));
    return;
  }
  try {
    await loadMeta();
  } catch (err) {
    document.getElementById('app').replaceChildren(h('p.boot', 'Der lokale Speicher ist nicht verfügbar: ' + err.message));
    return;
  }
  doRender(true);
  initSW(() => { if (S.data && ui.view.name !== 'group') doRender(false); });
}

boot();
