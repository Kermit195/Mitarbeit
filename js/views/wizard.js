// Zeitraum-Abschluss Person für Person: Vorschlag, Note, Feedback, (PB) Selbsteinschätzung

import { h } from '../util.js';
import { save, subjCfg, isSek2, sortedStudents, studentLabel, findStudent } from '../model.js';
import { render } from '../nav.js';
import { openSheet, btn, confirmDialog, toast } from '../ui.js';
import { scoreOf, ensureRec, fmtPct, weakSek2 } from '../grading.js';
import { draftFeedback } from '../feedback.js';
import { evidence, explanationBlock, SEK2_WARN } from '../explain.js';
import { fmtGrade, studentSummary } from './common.js';
import { presentFeedback, presentSelf } from './present.js';

export function openWizard(g, p, startSid) {
  const cfg = subjCfg(g);
  const sek2 = isSek2(g);
  const order = sortedStudents(g).map(s => s.id);
  let idx = Math.max(0, order.indexOf(startSid));
  const rec = ensureRec(g, p);
  save();
  const sheet = openSheet('', [], { full: true, onClose: render });

  const show = () => {
    const sid = order[idx];
    const st = findStudent(g, sid);
    const sc = scoreOf(g, sid, p);
    let r = rec.results[sid];
    if (!r) {
      r = rec.results[sid] = { confirmed: false, feedback: draftFeedback(g, sid, p) };
      save();
    }
    sheet.setTitle(`${studentLabel(st)} · ${p.label} (${idx + 1}/${order.length})`);
    let grade = r.confirmed ? r.grade : sc.grade;

    // Vorschlag
    const nachweis = h('div');
    let nOpen = false;
    const proposal = h('section.card.proposal',
      h('div.prop-main',
        h('div', h('small', sc.provisional ? 'Notenvorschlag (vorläufig)' : 'Notenvorschlag'),
          h('div.big', sc.avg === null ? 'keine gewertete Stunde' : `${fmtPct(Math.round(sc.avg * 10) / 10)} → ${fmtGrade(g, sc.grade)}`)),
        h('div.muted.small', `Durchschnitt aus ${sc.graded} gewerteten von ${sc.lessons} gezählten Stunden · ${sc.n} bewertende Einträge`),
        weakSek2(g, sc.grade) && h('p.warnbox', SEK2_WARN),
        r.confirmed && h('span.tag.ok', `bestätigt: ${fmtGrade(g, r.grade)}`),
        r.confirmed && r.legacy && h('p.hint', 'Diese Note wurde vor einem Update im älteren Bewertungssystem bestätigt. Erneutes Bestätigen übernimmt den neuen Vorschlag als Vergleichswert.')),
      btn('Nachweis anzeigen', e => {
        nOpen = !nOpen;
        e.currentTarget.textContent = nOpen ? 'Nachweis ausblenden' : 'Nachweis anzeigen';
        nachweis.replaceChildren(...(nOpen ? [studentSummary(g, sid, p)] : []));
      }, 'ghost'));

    // Note wählen
    const values = sek2 ? Array.from({ length: 16 }, (_, i) => 15 - i) : [1, 2, 3, 4, 5, 6];
    const reason = h('textarea', { rows: 2, placeholder: 'z. B. besondere Umstände, Krankheit, Entwicklung im Zeitraum' });
    reason.value = r.reason || '';
    const reasonWrap = h('label.field', h('span', 'Begründung der Abweichung (optional)'), reason);
    const gradeBtns = h('div.grades' + (sek2 ? '.sek2' : ''));
    const updateGrades = () => {
      for (const b of gradeBtns.children) {
        b.classList.toggle('active', String(grade) === b.dataset.v);
        b.classList.toggle('proposal', String(sc.grade) === b.dataset.v);
      }
      reasonWrap.hidden = grade === sc.grade;
      explainBox.replaceChildren(grade === null ? h('p.muted', 'Keine Note.') : explanationBlock(g, grade, belege()));
    };
    // Belege: bei bestätigten Noten der gespeicherte Stand, sonst aktuell berechnet
    const belege = () => (r.confirmed && r.belege ? r.belege : evidence(g, sid, p));
    const explainBox = h('div');
    for (const n of [...values, null]) {
      gradeBtns.append(h('button.gbtn', { type: 'button', dataset: { v: String(n) }, onClick: () => { grade = n; updateGrades(); } },
        n === null ? 'keine Note' : String(n)));
    }

    // Feedback
    const fbBox = h('div.fb-edit');
    const buildFb = () => {
      fbBox.replaceChildren();
      let lastArea = null;
      for (const s of cfg.feedbackSections) {
        if (s.area && s.area !== lastArea) {
          lastArea = s.area;
          fbBox.append(h('h4', (cfg.areas.find(a => a.id === s.area) || {}).label || s.area));
        }
        const ta = h('textarea', { rows: 3, onInput: e => { r.feedback[s.id] = e.target.value; save(); } });
        ta.value = r.feedback[s.id] || '';
        fbBox.append(h('label.field', h('span', s.title), ta));
      }
    };
    const regen = async () => {
      if (!await confirmDialog('Feedback neu aus den Bausteinen erzeugen? Eigene Änderungen gehen verloren.', { ok: 'Neu erzeugen' })) return;
      r.feedback = draftFeedback(g, sid, p);
      save();
      buildFb();
    };

    // PB: Lehrer- und Selbsteinschätzung
    let assess = null;
    if (g.fach === 'pb') {
      if (!r.teacher) r.teacher = {};
      const scale = cfg.selfScale;
      const rows = cfg.areas.map(a => {
        const seg = h('div.scale');
        for (let i = 1; i <= scale.length; i++) {
          seg.append(h('button' + (r.teacher[a.id] === i ? '.active' : ''), {
            type: 'button', title: scale[i - 1],
            onClick: () => {
              r.teacher[a.id] = r.teacher[a.id] === i ? undefined : i;
              save();
              for (const b of seg.children) b.classList.toggle('active', Number(b.textContent) === r.teacher[a.id]);
            },
          }, String(i)));
        }
        const self = r.self && r.self[a.id];
        const diff = self && r.teacher[a.id] && Math.abs(self - r.teacher[a.id]) >= 2;
        return h('tr', h('th', a.label), h('td', seg),
          h('td.selfval' + (diff ? '.diff' : ''), self ? `${self} – ${scale[self - 1]}` : '–'));
      });
      assess = h('section',
        h('h3', 'Einschätzung'),
        h('p.muted.small', scale.map((s, i) => `${i + 1} = ${s}`).join(' · ')),
        h('div.table-wrap', h('table.assess',
          h('thead', h('tr', h('th', 'Bereich'), h('th', 'Lehrkraft'), h('th', 'Selbsteinschätzung'))),
          h('tbody', rows))),
        h('div.btnrow.left', btn(r.self ? 'Selbsteinschätzung wiederholen' : 'Selbsteinschätzung durch Schüler:in (Präsentationsmodus)', () => {
          presentSelf(st.vorname, cfg, vals => { r.self = vals; r.selfAt = Date.now(); save(); show(); });
        }, 'ghost')));
    }

    const confirmAndNext = () => {
      r.grade = grade;
      r.reason = grade !== sc.grade ? reason.value.trim() : '';
      r.proposalPct = sc.avg;
      r.proposalGrade = sc.grade;
      r.graded = sc.graded;
      r.belege = evidence(g, sid, p);
      for (const k of ['legacy', 'proposal', 'proposalRounded', 'proposalPerLesson', 'points', 'lessons']) delete r[k];
      r.confirmed = true;
      r.confirmedAt = Date.now();
      save();
      const next = order.findIndex((id, i) => i > idx && !(rec.results[id] && rec.results[id].confirmed));
      if (next >= 0) { idx = next; show(); return; }
      const anyOpen = order.findIndex(id => !(rec.results[id] && rec.results[id].confirmed));
      if (anyOpen >= 0) { idx = anyOpen; show(); return; }
      sheet.close();
      toast(rec.closedAt ? 'Gespeichert.' : 'Alle Noten bestätigt – der Zeitraum kann jetzt abgeschlossen werden.');
    };

    sheet.setBody([
      proposal,
      nachweis,
      h('section', h('h3', sek2 ? 'Notenpunkte' : 'Note'), gradeBtns, reasonWrap),
      h('section', h('h3', 'Notenbegründung'), h('p.muted.small', 'Passt sich der gewählten Note an. Die Belege werden beim Bestätigen gespeichert.'), explainBox),
      h('section',
        h('div.sec-head', h('h3', 'Persönliche Rückmeldung'), btn('Entwurf neu erzeugen', regen, 'ghost small')),
        h('p.muted.small', 'Entwurf aus Satzbausteinen – frei bearbeitbar. Wird mit der Note gespeichert.'),
        fbBox),
      assess,
      h('div.wiz-foot',
        btn('‹ Vorherige', () => { idx = Math.max(0, idx - 1); show(); }, 'ghost', { disabled: idx === 0 }),
        btn('Präsentieren', () => presentFeedback(st.vorname, cfg, r.feedback,
          grade === null ? null : explanationBlock(g, grade, belege(), { forStudent: true })), 'ghost'),
        h('span.spacer'),
        btn(r.confirmed ? 'Speichern & weiter ›' : 'Bestätigen & weiter ›', confirmAndNext, 'primary big')),
    ]);
    updateGrades();
    buildFb();
  };
  show();
}
