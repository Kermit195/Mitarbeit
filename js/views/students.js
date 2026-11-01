// Schülerliste einer Lerngruppe

import { h, uid } from '../util.js';
import { save, getClass, groupsOfClass, sortedStudents, studentLabel } from '../model.js';
import { render } from '../nav.js';
import { btn, confirmDialog, toast } from '../ui.js';
import { SUBJECT_NAMES } from '../defaults.js';
import { pushUndo } from '../undo.js';

// „Lena M.“ → { vorname: 'Lena', kuerzel: 'M.' } – längere Nachnamen werden auf das Initial gekürzt
export function parseName(line) {
  const parts = line.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const vorname = parts[0];
  let kuerzel = parts.slice(1).join(' ');
  if (kuerzel.length > 3) kuerzel = kuerzel[0].toUpperCase() + '.';
  return { vorname, kuerzel };
}

export function copyStudents(from, to) {
  const have = new Set(to.students.map(studentLabel));
  const missing = from.students.filter(s => !have.has(studentLabel(s)));
  for (const s of missing) to.students.push({ id: uid(), vorname: s.vorname, kuerzel: s.kuerzel || '' });
  return missing.length;
}

export function renderStudents(main, g) {
  const cls = getClass(g.classId);
  const sts = sortedStudents(g);

  main.append(h('div.card.note', 'Datenschutz: nur den Vornamen und ggf. das Initial des Nachnamens erfassen (z. B. „Lena M.“).'));

  for (const sib of groupsOfClass(cls.id)) {
    if (sib.id === g.id || !sib.students.length) continue;
    const have = new Set(g.students.map(studentLabel));
    const n = sib.students.filter(s => !have.has(studentLabel(s))).length;
    if (!n) continue;
    main.append(h('div.btnrow.left', btn(`${n} ${n === 1 ? 'Person' : 'Personen'} aus ${cls.name} ${SUBJECT_NAMES[sib.fach]} übernehmen`, () => {
      pushUndo(g, 'Schülerliste übernommen');
      const added = copyStudents(sib, g);
      save(); render();
      toast(`${added} übernommen.`);
    }, 'primary')));
  }

  const labels = sts.map(studentLabel);
  const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
  const list = h('div.card',
    h('h3', `Schüler:innen (${sts.length})`),
    dupes.length ? h('p.warnbox', `Doppelte Namen: ${[...new Set(dupes)].join(', ')} – bitte ein Kürzel ergänzen.`) : null,
    sts.length ? null : h('p.muted', 'Noch niemand eingetragen.'),
    sts.map(st => h('div.strow',
      h('input', {
        type: 'text', value: st.vorname, 'aria-label': 'Vorname', autocomplete: 'off',
        onChange: e => {
          const v = e.target.value.trim();
          if (!v) { e.target.value = st.vorname; return; }
          st.vorname = v; save();
        },
      }),
      h('input.kuerzel', {
        type: 'text', value: st.kuerzel || '', maxlength: 3, placeholder: 'Kürzel', 'aria-label': 'Kürzel', autocomplete: 'off',
        onChange: e => { st.kuerzel = e.target.value.trim(); save(); },
      }),
      btn('Entfernen', async () => {
        const ok = await confirmDialog(`${studentLabel(st)} entfernen? Alle Einträge, Bewertungen und Noten dieser Person in ${cls.name} ${SUBJECT_NAMES[g.fach]} werden gelöscht.`, { ok: 'Entfernen', danger: true });
        if (!ok) return;
        pushUndo(g, `${studentLabel(st)} entfernt`);
        g.students = g.students.filter(x => x !== st);
        g.entries = g.entries.filter(e => e.sid !== st.id);
        for (const t of g.tasks) delete t.results[st.id];
        for (const sp of g.seatplans) delete sp.pos[st.id];
        for (const rec of Object.values(g.closed)) delete rec.results[st.id];
        save(); render();
      }, 'ghost danger'))));

  const ta = h('textarea', { rows: 6, placeholder: 'Eine Person pro Zeile, z. B.\nLena M.\nTom\nAylin K.' });
  const add = h('div.card',
    h('h3', 'Hinzufügen'),
    h('label.field', h('span', 'Namen (eine Zeile pro Person)'), ta),
    h('div.btnrow.left', btn('Hinzufügen', () => {
      const names = ta.value.split('\n').map(parseName).filter(Boolean);
      if (!names.length) return;
      pushUndo(g, 'Schüler:innen hinzugefügt');
      for (const n of names) g.students.push({ id: uid(), ...n });
      save(); render();
      toast(`${names.length} hinzugefügt.`);
    }, 'primary')));

  main.append(list, add);
}
