// Bewertungsmenü für eine oder mehrere Personen

import { h, today, addDays, fmtShort, fmtNum } from '../util.js';
import { subjCfg, findStudent, studentLabel, addEntries, save } from '../model.js';
import { render, go } from '../nav.js';
import { openSheet, toast, btn, segmented } from '../ui.js';
import { currentPeriod, scoreOf, dayStatus, entryLabel, countMinus, redeStats, hintsOf, fmtPts, fmtPerLesson } from '../grading.js';
import { pushUndo, undo } from '../undo.js';
import { sel, fmtGrade, NOTE_ZERO } from './common.js';

export function tapStudent(g, sid) {
  if (sel.multi) {
    if (sel.ids.has(sid)) sel.ids.delete(sid); else sel.ids.add(sid);
    render();
  } else {
    openRateSheet(g, [sid]);
  }
}

export function longStudent(g, sid) {
  sel.multi = true;
  sel.ids.add(sid);
  render();
}

const kindOf = pts => (pts > 0 ? 'plus' : pts < 0 ? 'minus' : 'neutral');

export function openRateSheet(g, sids) {
  sids = sids.filter(id => findStudent(g, id));
  if (!sids.length) return;
  const cfg = subjCfg(g);
  const single = sids.length === 1 ? findStudent(g, sids[0]) : null;
  const who = single ? single.vorname : `${sids.length} Personen`;
  const sheet = openSheet(single ? studentLabel(single) : `${sids.length} Schüler:innen`, [], {});
  let note = '';

  const noteInput = () => h('input.note-input', {
    type: 'text', placeholder: 'Bemerkung (optional)', value: note, autocomplete: 'off', enterkeyhint: 'done',
    onInput: e => { note = e.target.value; },
  });

  const commit = o => {
    const label = entryLabel(cfg, o);
    pushUndo(g, `${who}: ${label}`);
    const { skipped } = addEntries(g, sids, { ...o, note: note.trim() });
    sheet.close();
    if (sel.multi) { sel.multi = false; sel.ids.clear(); }
    render();
    const skippedNames = skipped.map(id => findStudent(g, id).vorname).join(', ');
    if (skipped.length === sids.length) {
      undo(); // nichts eingetragen – leeren Rückgängig-Schritt entfernen
      toast(`Nicht eingetragen: ${skippedNames} ${skipped.length === 1 ? 'ist' : 'sind'} heute nicht anwesend.`);
      return;
    }
    let msg = `✓ ${who}: ${label}`;
    if (skipped.length) msg += ` · nicht anwesend: ${skippedNames}`;
    if (o.sign < 0) {
      const p = currentPeriod(g);
      const th = cfg.thresholds.haeufung;
      const hits = sids.map(sid => [sid, countMinus(g, sid, o.cat, p)]).filter(([, n]) => n >= th);
      if (hits.length) msg += ' · Häufung: ' + hits.map(([sid, n]) => `${findStudent(g, sid).vorname} ${n}×`).join(', ');
    }
    toast(msg, { label: 'Rückgängig', fn: () => { undo(); render(); } });
  };

  const choose = (c, sign, level) => {
    if (c.id === 'befreit') return exemptForm(c);
    const s = level ? Math.sign(Number(level.pts)) : sign;
    if (c.subs && c.subs.length) return subStep(c, s, level);
    commit({ cat: c.id, sign: s, level: level && level.id });
  };

  const stepHead = text => h('div.step-head', btn('‹ zurück', showMain, 'ghost'), h('strong', text));

  const subStep = (c, sign, level) => {
    const lbl = entryLabel(cfg, { cat: c.id, sign, level: level && level.id });
    sheet.setBody([
      stepHead(lbl),
      noteInput(),
      h('div.subgrid',
        c.subs.map(s => h('button.btn.sub', { type: 'button', onClick: () => commit({ cat: c.id, sign, level: level && level.id, sub: s }) }, s)),
        h('button.btn.sub.ghost', { type: 'button', onClick: () => commit({ cat: c.id, sign, level: level && level.id }) }, 'ohne Angabe')),
    ]);
  };

  const exemptForm = c => {
    const bis = h('input', { type: 'date', value: addDays(today(), 7), min: today() });
    let attest = false;
    sheet.setBody([
      stepHead(c.label),
      h('label.field', h('span', 'befreit bis einschließlich'), bis),
      h('div.field', h('span', 'Attest liegt vor'), segmented([['nein', 'Nein'], ['ja', 'Ja']], 'nein', v => { attest = v === 'ja'; })),
      noteInput(),
      h('div.btnrow', btn('Befreiung speichern', () => {
        if (!bis.value) return;
        commit({ cat: 'befreit', sign: 0, extra: { bis: bis.value, attest } });
      }, 'primary big')),
    ]);
  };

  const catRow = c => {
    const b = [];
    if (c.levels) {
      for (const l of c.levels) {
        const pts = Number(l.pts);
        const short = c.id === 'passiv';
        b.push(h(`button.rb.${kindOf(pts)}.level` + (short ? '.short' : ''), { type: 'button', onClick: () => choose(c, Math.sign(pts), l) },
          short ? l.label : h('span', l.label), short ? null : h('small', fmtPts(pts))));
      }
    } else if (c.neutral) {
      b.push(h('button.rb.neutral', { type: 'button', onClick: () => choose(c, 0) }, 'eintragen'));
    } else {
      if (Number.isFinite(c.plus)) b.push(h('button.rb.plus', { type: 'button', 'aria-label': `${c.label} ${fmtPts(c.plus)}`, onClick: () => choose(c, 1) }, fmtPts(c.plus)));
      if (Number.isFinite(c.minus)) b.push(h('button.rb.minus', { type: 'button', 'aria-label': `${c.label} ${fmtPts(c.minus)}`, onClick: () => choose(c, -1) }, fmtPts(c.minus)));
    }
    return h('div.catrow' + (c.levels ? '.wide' : ''),
      h('div.catlabel', h('span', c.label), c.hint && h('small', c.hint)),
      h('div.rbtns', b));
  };

  const singleInfo = () => {
    const st = single;
    const p = currentPeriod(g);
    const ds = dayStatus(g, st.id, today());
    const items = [];
    if (p) {
      const sc = scoreOf(g, st.id, p);
      items.push(h('span', 'Punktestand ', h('strong', fmtPerLesson(sc.perLesson)), ' pro Stunde · vorläufig ', h('strong', fmtGrade(g, sc.grade)),
        ` · ${sc.sum} Punkte in ${sc.lessons} Std.`));
      if (g.fach === 'pb') {
        const rs = redeStats(g, p);
        items.push(h('span', `Redebeiträge: ${rs.counts[st.id] || 0} (Ø ${fmtNum(rs.avg, 1)})`));
      }
      for (const x of hintsOf(g, p).haeufung.filter(x => x.sid === st.id)) items.push(h('span.tag.warn', `${x.n}× ${x.label}`));
    }
    const actions = [];
    if (ds.absent) {
      items.push(h('span.tag.absent', 'heute nicht anwesend'));
      actions.push(btn('Doch anwesend', () => {
        pushUndo(g, 'Abwesenheit gelöscht');
        g.entries = g.entries.filter(e => e !== ds.absent);
        save(); sheet.close(); render();
      }, 'ghost'));
    }
    if (ds.exempt) {
      items.push(h('span.tag.exempt', `befreit bis ${fmtShort(ds.exempt.extra.bis)}${ds.exempt.extra.attest ? ' · Attest' : ''}`));
      actions.push(btn('Befreiung beenden', () => {
        pushUndo(g, 'Befreiung beendet');
        ds.exempt.extra.bis = addDays(today(), -1);
        save(); sheet.close(); render();
      }, 'ghost'));
    }
    actions.push(btn('Nachweis ›', () => { sheet.close(); go({ name: 'group', groupId: g.id, tab: 'eintraege', sid: st.id }); }, 'ghost'));
    return h('div.info-box', h('div.info-items', items), h('div.btnrow.left', actions));
  };

  function showMain() {
    const parts = [noteInput()];
    if (single) parts.push(singleInfo());
    else parts.push(h('p.muted.small', sids.map(id => studentLabel(findStudent(g, id))).join(', ')));
    for (const sec of cfg.sections) {
      const cats = cfg.cats.filter(c => c.section === sec.id && !c.hidden);
      if (!cats.length) continue;
      parts.push(h('h3.sec-title', sec.label));
      parts.push(h('div.catlist', cats.map(catRow)));
    }
    parts.push(h('p.muted.small', NOTE_ZERO + '. Abwesenheit ist wertungsfrei und zählt nicht als Stunde.'));
    sheet.setBody(parts);
  }

  showMain();
}
