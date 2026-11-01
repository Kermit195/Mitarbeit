// Service-Worker-Anmeldung und Update-Hinweis

import { flush } from './model.js';

export const swState = { reg: null, waiting: null, version: null };
let updating = false;

export async function initSW(onChange) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    swState.reg = reg;
    const check = () => {
      if (reg.waiting && navigator.serviceWorker.controller) {
        swState.waiting = reg.waiting;
        onChange();
      }
    };
    check();
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') check(); });
    });
    const askVersion = () => {
      if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' });
    };
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (updating) location.reload();
      else askVersion(); // allererster Start: Service Worker übernimmt gerade
    });
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data && e.data.type === 'VERSION') swState.version = e.data.version;
    });
    askVersion();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
    reg.update().catch(() => {});
  } catch (err) {
    console.warn('Service Worker konnte nicht registriert werden:', err);
  }
}

export async function applyUpdate() {
  await flush();
  if (!swState.waiting) { location.reload(); return; }
  updating = true;
  swState.waiting.postMessage({ type: 'SKIP_WAITING' });
}

export function checkForUpdate() {
  return swState.reg ? swState.reg.update() : Promise.resolve();
}
