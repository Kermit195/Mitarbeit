// PB: Sitzplan aus Sicht der Lehrkraft (Tafel unten, erste Reihe unten) mit Drag and Drop, Raster und Schloss

import { h, uid, today } from '../util.js';
import { save, sortedStudents, studentLabel } from '../model.js';
import { render } from '../nav.js';
import { btn, formDialog, confirmDialog } from '../ui.js';
import { currentPeriod, scoreOf, dayStatus, redeStats } from '../grading.js';
import { sel, infoBar, selectionBar, scoreBadge, emptyStudents } from './common.js';
import { openRateSheet, tapStudent, longStudent } from './rate.js';

const GRID = 16;   // Rasterweite in px
const TW = 144;    // Kachelbreite
const TH = 80;     // Kachelhöhe
const BOARD = 64;  // Platz für „Tafel / Lehrkraft“ am unteren Rand
const HA_SYM = { '+': 'HA +', o: 'HA o', '-': 'HA −' };

export function renderSeatplan(main, g) {
  if (!g.students.length) { main.append(emptyStudents(g)); return; }
  if (!g.seatplans.length) g.seatplans.push({ id: uid(), name: 'Reihen', pos: {} });
  const plan = g.seatplans.find(sp => sp.id === g.activeSeat) || g.seatplans[0];
  g.activeSeat = plan.id;
  const locked = g.seatLocked !== false;
  const p = currentPeriod(g);

  const select = h('select.plan-select', { onChange: e => { g.activeSeat = e.target.value; save(); render(); } },
    g.seatplans.map(sp => h('option', { value: sp.id, selected: sp.id === plan.id }, sp.name)));

  main.append(h('div.toolbar',
    h('label.inline', 'Sitzplan ', select),
    btn('＋ Neu', () => newPlan(g, plan), 'ghost'),
    btn('Umbenennen', () => renamePlan(plan), 'ghost'),
    g.seatplans.length > 1 && btn('Löschen', () => deletePlan(g, plan), 'ghost'),
    !locked && btn('Neu anordnen', () => relayout(plan), 'ghost'),
    h('span.spacer'),
    h('button.btn.lock' + (locked ? '.locked' : '.unlocked'), {
      type: 'button',
      onClick: () => { g.seatLocked = !locked; save(); render(); },
    }, locked ? '🔒 Gesperrt' : '🔓 Verschieben aktiv')));
  main.append(...infoBar(g, p));
  if (!locked) main.append(h('p.hint', 'Kacheln ziehen, um sie anzuordnen. Sie rasten am Raster ein; auf einen besetzten Platz gezogen, tauschen zwei Kacheln. Zum Bewerten wieder sperren.'));

  const students = sortedStudents(g);
  const width = Math.max(600, (main.clientWidth || window.innerWidth) - 34); // abzüglich Innenabstand und Rahmen
  if (placeMissing(plan, students, width)) save();

  let maxX = width, tilesBottom = 0;
  for (const st of students) {
    const ps = plan.pos[st.id];
    maxX = Math.max(maxX, ps.x * GRID + TW + GRID);
    tilesBottom = Math.max(tilesBottom, ps.y * GRID + TH);
  }
  // Entsperrt: Platz unter der ersten Reihe lassen, damit Kacheln nach unten gezogen werden können
  const extra = locked ? GRID : 2 * (TH + GRID);
  const maxY = tilesBottom + extra + BOARD;
  const canvas = h('div.seat-canvas' + (locked ? '.locked' : '.unlocked'),
    { style: { width: maxX + 'px', height: maxY + 'px' } },
    h('div.board', 'Tafel · Lehrkraft'));

  const t = today();
  const rs = p ? redeStats(g, p) : null;
  for (const st of students) {
    const ps = plan.pos[st.id];
    const ds = dayStatus(g, st.id, t);
    const sc = p ? scoreOf(g, st.id, p) : null;
    const ha = g.entries.find(e => e.sid === st.id && e.cat === 'hausaufgaben' && e.date === t);
    const tile = h('div.seat' + (ds.inactive ? '.inactive' : '') + (sel.ids.has(st.id) ? '.selected' : ''),
      { role: 'button', tabindex: 0, style: { left: ps.x * GRID + 'px', top: ps.y * GRID + 'px', width: TW + 'px', height: TH + 'px' } },
      h('div.seat-top', h('div.sname', studentLabel(st)),
        ds.absent ? h('span.tag.absent', 'fehlt') : ha && h('span.tag.ha', { title: 'Hausaufgaben heute' }, HA_SYM[ha.level] || 'HA')),
      h('div.seat-meta',
        sc && scoreBadge(g, sc),
        rs && h('span.rede', { title: 'Redebeiträge im Zeitraum' }, '💬 ' + (rs.counts[st.id] || 0))));
    attachTile(tile, g, plan, st, locked);
    canvas.append(tile);
  }
  // Gesperrt: zu breite Pläne (z. B. im Hochformat) verkleinert vollständig anzeigen
  const scale = locked && maxX > width ? width / maxX : 1;
  if (scale < 1) {
    canvas.style.transform = `scale(${scale})`;
    canvas.style.transformOrigin = '0 0';
    main.append(h('div.seat-wrap', h('div', { style: { width: width + 'px', height: Math.ceil(maxY * scale) + 'px' } }, canvas)));
  } else {
    main.append(h('div.seat-wrap', canvas));
  }

  const active = students.filter(st => !dayStatus(g, st.id, t).inactive).map(st => st.id);
  const bar = selectionBar(active, () => openRateSheet(g, [...sel.ids]));
  if (bar) { main.classList.add('with-selbar'); main.append(bar); }
}

function overlaps(a, b) {
  const w = TW / GRID, hh = TH / GRID;
  return a.x < b.x + w && b.x < a.x + w && a.y < b.y + hh && b.y < a.y + hh;
}

// Personen ohne Platz automatisch in freie Plätze setzen – erste Reihe unten (an der Tafel)
function placeMissing(plan, students, width) {
  const missing = students.filter(st => !plan.pos[st.id]);
  if (!missing.length) return false;
  const cols = Math.max(3, Math.floor((width - GRID) / (TW + GRID)));
  const stepX = (TW + GRID) / GRID, stepY = (TH + GRID) / GRID;
  const rows = Math.ceil(students.length / cols);
  const taken = () => students.filter(s => plan.pos[s.id]).map(s => plan.pos[s.id]);
  let slot = 0;
  for (const st of missing) {
    for (;;) {
      const r = Math.floor(slot / cols); // Reihe 0 = vorne (unten)
      const cand = { x: 1 + (slot % cols) * stepX, y: (rows - 1 - r) * stepY };
      slot++;
      if (!taken().some(o => overlaps(o, cand))) { plan.pos[st.id] = cand; break; }
    }
  }
  // Falls Reihen oberhalb des Randes gelandet sind: alles nach unten verschieben
  const minY = Math.min(...students.map(s => plan.pos[s.id].y));
  if (minY < 0) for (const s of students) plan.pos[s.id].y -= minY;
  return true;
}

function attachTile(tile, g, plan, st, locked) {
  let pid = null, sx = 0, sy = 0, ox = 0, oy = 0, moved = false, lt = null, suppress = false;
  tile.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    pid = e.pointerId; sx = e.clientX; sy = e.clientY;
    ox = tile.offsetLeft; oy = tile.offsetTop;
    moved = false; suppress = false;
    if (!locked) { try { tile.setPointerCapture(pid); } catch { /* ignorieren */ } }
    clearTimeout(lt);
    lt = setTimeout(() => { if (pid !== null && !moved) { suppress = true; pid = null; longStudent(g, st.id); } }, 550);
  });
  tile.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!moved && Math.hypot(dx, dy) > 8) {
      moved = true;
      clearTimeout(lt);
      if (!locked) tile.classList.add('dragging');
    }
    if (moved && !locked) {
      tile.style.left = Math.max(0, ox + dx) + 'px';
      tile.style.top = Math.max(0, Math.min(tile.parentElement.offsetHeight - BOARD - TH, oy + dy)) + 'px';
    }
  });
  const end = (e, cancelled) => {
    if (e.pointerId !== pid) return;
    pid = null;
    clearTimeout(lt);
    if (!moved) return;
    suppress = true;
    if (locked) return;
    if (cancelled) { render(); return; }
    const x = Math.round(tile.offsetLeft / GRID);
    const y = Math.max(0, Math.round(tile.offsetTop / GRID));
    const old = plan.pos[st.id];
    const other = Object.entries(plan.pos).find(([sid, q]) => sid !== st.id && q.x === x && q.y === y);
    if (other && old) plan.pos[other[0]] = { x: old.x, y: old.y };
    plan.pos[st.id] = { x, y };
    save();
    render();
  };
  tile.addEventListener('pointerup', e => end(e, false));
  tile.addEventListener('pointercancel', e => end(e, true));
  tile.addEventListener('click', () => { if (suppress) { suppress = false; return; } tapStudent(g, st.id); });
  tile.addEventListener('keydown', e => { if (e.key === 'Enter') tapStudent(g, st.id); });
  tile.addEventListener('contextmenu', e => e.preventDefault());
}

async function newPlan(g, current) {
  const res = await formDialog({
    title: 'Neuer Sitzplan',
    fields: [
      { name: 'name', label: 'Name', value: g.seatplans.length === 1 ? 'Gruppentische' : '', required: true, placeholder: 'z. B. Gruppentische' },
      { name: 'copy', label: 'Anordnung des aktuellen Plans übernehmen', type: 'checkbox', value: true },
    ],
    ok: 'Anlegen',
  });
  if (!res) return;
  const sp = { id: uid(), name: res.name, pos: res.copy ? JSON.parse(JSON.stringify(current.pos)) : {} };
  g.seatplans.push(sp);
  g.activeSeat = sp.id;
  g.seatLocked = false;
  save();
  render();
}

async function renamePlan(plan) {
  const res = await formDialog({ title: 'Sitzplan umbenennen', fields: [{ name: 'name', label: 'Name', value: plan.name, required: true }] });
  if (!res) return;
  plan.name = res.name;
  save();
  render();
}

async function deletePlan(g, plan) {
  if (!await confirmDialog(`Sitzplan „${plan.name}“ löschen?`, { ok: 'Löschen', danger: true })) return;
  g.seatplans = g.seatplans.filter(sp => sp !== plan);
  g.activeSeat = g.seatplans[0].id;
  save();
  render();
}

async function relayout(plan) {
  if (!await confirmDialog('Alle Kacheln dieses Sitzplans automatisch in Reihen anordnen?', { ok: 'Neu anordnen' })) return;
  plan.pos = {};
  save();
  render();
}
