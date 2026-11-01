// Startbildschirm: Kacheln aller Klassen

import { h, plural } from '../util.js';
import { S, groupsOfClass, getClass } from '../model.js';
import { go, hooks } from '../nav.js';
import { topbar, btn } from '../ui.js';
import { SUBJECT_LABELS } from '../defaults.js';
import { openExcuses } from '../grading.js';
import { swState, applyUpdate } from '../sw-client.js';
import { createBackupFlow } from './backupui.js';

function banner(kind, text, actions) {
  return h('div.banner.' + kind, h('span', text), h('div.banner-actions', actions));
}

export function renderStart(root) {
  const d = S.data;
  root.append(topbar({
    title: 'Mitarbeit',
    sub: 'Schuljahr ' + d.settings.schuljahr,
    right: [btn('🔒 Sperren', () => hooks.lock(), 'ghost'), btn('⚙︎ Einstellungen', () => go({ name: 'settings' }), 'ghost')],
  }));
  const main = h('main.content');
  root.append(main);

  const banners = h('div.banners');
  if (swState.waiting) {
    banners.append(banner('update', 'Update verfügbar – vorher Sicherung erstellen.', [
      btn('Sicherung erstellen', createBackupFlow, 'ghost'),
      btn('Jetzt aktualisieren', applyUpdate, 'primary'),
    ]));
  }
  const hasData = d.groups.some(g => g.students.length);
  if (hasData) {
    const lb = d.settings.lastBackup;
    const days = lb ? Math.floor((Date.now() - lb) / 86400000) : null;
    if (days === null || days >= d.settings.backupReminderDays) {
      banners.append(banner('warn',
        days === null ? 'Es wurde noch keine Sicherung erstellt.' : `Die letzte Sicherung ist ${days} Tage alt.`,
        [btn('Sicherung erstellen', createBackupFlow, 'primary')]));
    }
  }
  for (const g of d.groups) {
    const n = openExcuses(g).filter(x => x.overdue).length;
    if (n) {
      banners.append(banner('info', `${getClass(g.classId)?.name} Sport: ${plural(n, 'Entschuldigung', 'Entschuldigungen')} überfällig.`,
        [btn('Ansehen', () => go({ name: 'group', groupId: g.id, tab: 'erfassen' }), 'ghost')]));
    }
  }
  if (banners.children.length) main.append(banners);

  const classes = [...d.classes].sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }));
  const grid = h('div.tiles');
  for (const cls of classes) {
    const gs = groupsOfClass(cls.id);
    const def = gs.find(x => x.id === d.settings.lastGroup[cls.id]) || gs[0];
    const count = Math.max(0, ...gs.map(g => g.students.length));
    const tile = h('div.tile', {
      role: 'button', tabindex: 0,
      onClick: e => {
        if (e.target.closest('.subj-chip')) return;
        if (def) go({ name: 'group', groupId: def.id });
        else go({ name: 'settings' });
      },
    },
      h('div.tile-name', cls.name),
      h('div.tile-sub', cls.sek2 ? 'Sek II · Notenpunkte' : 'Sek I · Noten'),
      h('div.tile-chips', gs.length
        ? gs.map(g => h('button.subj-chip.' + g.fach, { type: 'button', onClick: () => go({ name: 'group', groupId: g.id }) }, SUBJECT_LABELS[g.fach]))
        : h('span.muted', 'kein Fach')),
      h('div.tile-meta', count ? plural(count, 'Schüler:in', 'Schüler:innen') : 'Schülerliste fehlt'));
    grid.append(tile);
  }
  main.append(grid);
  if (!classes.length) main.append(h('p.empty', 'Noch keine Klassen. In den Einstellungen anlegen.'));
  main.append(h('p.footnote', '🔐 Alle Daten liegen verschlüsselt nur auf diesem Gerät.'));
}
