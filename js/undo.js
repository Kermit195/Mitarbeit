// Rückgängig: vor jeder Änderung wird die betroffene Lerngruppe gesichert.
// Eine Mehrfachauswahl ist eine einzige Änderung und damit ein einziger Schritt.

import { S, save } from './model.js';

const stack = [];

export function pushUndo(g, label) {
  stack.push({ gid: g.id, label, snap: JSON.stringify(g) });
  if (stack.length > 50) stack.shift();
}

export const canUndo = () => stack.length > 0;
export const lastUndoLabel = () => (stack.length ? stack[stack.length - 1].label : '');

export function undo() {
  const u = stack.pop();
  if (!u || !S.data) return null;
  const i = S.data.groups.findIndex(x => x.id === u.gid);
  if (i >= 0) S.data.groups[i] = JSON.parse(u.snap);
  save();
  return u.label;
}

export function clearUndo() { stack.length = 0; }
