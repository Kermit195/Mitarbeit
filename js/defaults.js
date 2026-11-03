// Standard-Konfiguration. Alles hier ist später in den Einstellungen änderbar.

export const SUBJECT_LABELS = { sport: 'Sport', pb: 'PB' };
export const SUBJECT_NAMES = { sport: 'Sport', pb: 'Politische Bildung' };
export const SUBJECT_ORDER = ['sport', 'pb'];

export const DEFAULT_CLASSES = [
  { name: '8a', subjects: ['sport', 'pb'], sek2: false },
  { name: '9a', subjects: ['sport', 'pb'], sek2: false },
  { name: '9b', subjects: ['pb'], sek2: false },
  { name: '9d', subjects: ['sport'], sek2: false },
  { name: '11 GK', subjects: ['pb'], sek2: true },
  { name: '12 GK', subjects: ['sport', 'pb'], sek2: true },
];

export function defaultSettings() {
  return {
    schuljahr: '2026/27',
    lockMinutes: 5,
    backupReminderDays: 7,
    bell: [
      { nr: 1, start: '08:00', end: '08:45' },
      { nr: 2, start: '08:50', end: '09:35' },
      { nr: 3, start: '09:55', end: '10:40' },
      { nr: 4, start: '10:45', end: '11:30' },
      { nr: 5, start: '11:50', end: '12:35' },
      { nr: 6, start: '12:40', end: '13:25' },
      { nr: 7, start: '13:45', end: '14:30' },
      { nr: 8, start: '14:35', end: '15:20' },
    ],
    lastBackup: null,
    lastGroup: {},
    subjects: { sport: sportConfig(), pb: pbConfig() },
  };
}

// ---------- Notenschlüssel ----------

// Sek I: Note n ab „min“ Punkten pro anwesende Stunde; darunter Note 6
const key1 = (a, b, c, d, e) => [1, 2, 3, 4, 5].map((grade, i) => ({ grade, min: [a, b, c, d, e][i] }));

// Sek II aus dem Sek-I-Schlüssel ableiten: jeder Notenbereich in drei gleich breite Stufen;
// Note 1 erhält dieselbe Breite wie Note 2; Note 6 = 0 Punkte.
export function deriveSek2(sek1) {
  const min = g => Number(sek1.find(k => k.grade === g).min);
  const out = [];
  for (let g = 1; g <= 5; g++) {
    const lo = min(g);
    const hi = g === 1 ? lo + (min(1) - min(2)) : min(g - 1);
    const w = (hi - lo) / 3;
    const base = 16 - 3 * g; // Note 1 → 13, Note 2 → 10 … Note 5 → 1
    for (let i = 2; i >= 0; i--) out.push({ pts: base + i, min: Math.round((lo + i * w) * 100) / 100 });
  }
  return out; // absteigend: 15 … 1
}

function keys(sek1) { return { sek1, sek2: deriveSek2(sek1) }; }

// ---------- Fächer ----------

export function sportConfig() {
  return {
    periodWeeks: 4,
    thresholds: { haeufung: 3, luecke: 3, excuseDays: 7 },
    key: keys(key1(1.0, 0.6, 0.3, 0, -0.3)),
    sections: [
      { id: 'neutral', label: 'Wertungsfrei' },
      { id: 'mitarbeit', label: 'Mitarbeit' },
      { id: 'organisation', label: 'Organisation und Regeln' },
    ],
    cats: [
      { id: 'abwesend', label: 'Nicht anwesend', section: 'neutral', neutral: true, hint: 'setzt automatisch „Entschuldigung offen“' },
      { id: 'befreit', label: 'Sportbefreiung', section: 'neutral', neutral: true, hint: 'gilt bis zum gewählten Datum; befreite Tage zählen nicht als Stunde' },
      { id: 'eingeschraenkt', label: 'Eingeschränkte Teilnahme', section: 'neutral', neutral: true, subs: ['teilweise befreit', 'in der Stunde verletzt'] },
      {
        id: 'respekt', label: 'Respekt und Fairness', section: 'mitarbeit', plus: 2, minus: -2,
        fb: {
          plus: 'Du gehst respektvoll und fair mit deinen Mitschüler:innen um – auch im Wettkampf.',
          minus: 'Achte darauf, fair zu bleiben und respektvoll mit anderen umzugehen, auch wenn es mal nicht so läuft.',
          tip: 'Gratuliere nach einem Spiel bewusst einmal dem anderen Team oder lobe eine gute Aktion.',
        },
      },
      {
        id: 'einsatz', label: 'Einsatz in Übungsphasen', section: 'mitarbeit', plus: 2, minus: -2,
        fb: {
          plus: 'In den Übungsphasen zeigst du viel Einsatz.',
          minus: 'In den Übungsphasen kannst du noch mehr Einsatz zeigen und die Übungszeit besser nutzen.',
          tip: 'Nimm dir für jede Übungsphase ein kleines persönliches Ziel vor.',
        },
      },
      {
        id: 'passiv', label: 'Passive Mitarbeit', section: 'mitarbeit',
        hint: 'aufmerksam bei Erklärungen und in Gesprächsphasen',
        levels: [
          { id: 'p2', label: '+2', pts: 2 },
          { id: 'p1', label: '+1', pts: 1 },
          { id: 'n0', label: '0', pts: 0 },
          { id: 'm1', label: '−1', pts: -1 },
          { id: 'm2', label: '−2', pts: -2 },
        ],
        fb: {
          plus: 'Bei Erklärungen und in Gesprächsphasen bist du aufmerksam dabei.',
          minus: 'Sei bei Erklärungen und in Gesprächsphasen aufmerksamer.',
          tip: 'Schau bei Erklärungen bewusst nach vorn und überlege, was als Nächstes zu tun ist.',
        },
      },
      {
        id: 'fachlich', label: 'Fachliche Beiträge und Reflexion', section: 'mitarbeit', plus: 1,
        hint: 'Regelkenntnis, Bewegungen beschreiben und beurteilen',
        fb: { plus: 'Du bringst dein Wissen ein, kennst die Regeln und kannst Bewegungen gut beschreiben und beurteilen.' },
      },
      {
        id: 'beteiligung', label: 'Beteiligung', section: 'mitarbeit', plus: 1,
        hint: 'aktiv, motiviert, konzentriert',
        fb: { plus: 'Du beteiligst dich aktiv, motiviert und konzentriert am Unterricht.' },
      },
      {
        id: 'hilfe', label: 'Hilfe und Unterstützung', section: 'mitarbeit', plus: 1,
        hint: 'Hilfestellung, anderen helfen, Verantwortung übernehmen',
        fb: { plus: 'Du hilfst anderen, gibst Hilfestellung und übernimmst Verantwortung.' },
      },
      {
        id: 'zusammenkommen', label: 'Zügiges Zusammenkommen', section: 'organisation', plus: 1, minus: -1,
        fb: {
          plus: 'Wenn wir uns sammeln, bist du schnell da.',
          minus: 'Wenn wir uns sammeln, kannst du noch zügiger dazukommen.',
          tip: 'Reagiere sofort auf das Signal zum Sammeln.',
        },
      },
      {
        id: 'aufbau', label: 'Auf- und Abbau', section: 'organisation', plus: 1, minus: -1,
        fb: {
          plus: 'Beim Auf- und Abbau packst du mit an.',
          minus: 'Beim Auf- und Abbau kannst du dich noch mehr einbringen.',
          tip: 'Übernimm beim nächsten Aufbau freiwillig eine Station.',
        },
      },
      {
        id: 'material', label: 'Fehlendes Material', section: 'organisation', minus: -5,
        subs: ['Sportsachen vergessen', 'Fingernägel zu lang', 'Schmuck nicht abgelegt'],
        fb: {
          minus: 'Komm vollständig vorbereitet zum Sportunterricht ({subs}).',
          tip: 'Pack deine Sporttasche schon am Vorabend und denk an kurze Fingernägel und abgelegten Schmuck.',
        },
      },
      {
        id: 'entschuldigung', label: 'Entschuldigung nicht nachgereicht', section: 'organisation', minus: -5,
        hint: 'die Fehlstunde zählt dann wie eine anwesende Stunde',
        fb: {
          minus: 'Reiche Entschuldigungen für Fehlstunden bitte rechtzeitig nach.',
          tip: 'Gib eine Entschuldigung immer gleich in der nächsten Sportstunde ab.',
        },
      },
      {
        id: 'unpuenktlich', label: 'Unpünktlich', section: 'organisation', minus: -1,
        fb: { minus: 'Komm pünktlich und umgezogen in die Halle.', tip: 'Plane für das Umziehen ein paar Minuten mehr ein.' },
      },
      {
        id: 'stoerung', label: 'Störung', section: 'organisation', minus: -1,
        subs: ['Nebengespräche', 'Ablenkung', 'unsachgemäßer Umgang mit Sportmaterial'],
        fb: {
          minus: 'Versuche, Störungen zu vermeiden ({subs}), damit alle gut lernen können.',
          tip: 'Hör bei Erklärungen bewusst zu und such dir einen Platz, an dem du dich gut konzentrieren kannst.',
        },
      },
    ],
    feedbackSections: [
      { id: 'gut', title: 'Das läuft schon gut' },
      { id: 'arbeiten', title: 'Daran kannst du arbeiten' },
      { id: 'tipp', title: 'Tipp für die nächsten 4 Wochen' },
    ],
    fbGeneric: {
      gutLeer: 'Du bist im Sportunterricht dabei und machst mit.',
      keineMinus: 'Du hältst dich zuverlässig an unsere Regeln.',
      arbeitenLeer: 'Hier gibt es gerade nichts Besonderes – mach weiter so!',
      tipp: 'Probiere in den nächsten 4 Wochen, dich noch öfter aktiv einzubringen, zum Beispiel mit Fragen oder Tipps für andere.',
    },
  };
}

export function pbConfig() {
  return {
    periodWeeks: 9,
    thresholds: { haeufung: 3, luecke: 3 },
    key: keys(key1(2.5, 1.5, 0.75, 0, -0.5)),
    written: {
      points: { '+': 2, o: 0, '-': -1, na: -2 },
      arts: ['Exit-Ticket', 'Arbeitsblatt', 'Sonstiges'],
    },
    sections: [
      { id: 'neutral', label: 'Wertungsfrei' },
      { id: 'muendlich', label: 'Mündliche Mitarbeit' },
      { id: 'arbeit', label: 'Hausaufgaben, Material und Arbeitsverhalten' },
    ],
    areas: [
      { id: 'inhalt', label: 'Inhaltliche Qualität', self: 'Meine Beiträge sind inhaltlich gut und begründet.' },
      { id: 'beteiligung', label: 'Beteiligung', self: 'Ich beteilige mich aktiv am Unterricht.' },
      { id: 'kommunikation', label: 'Kommunikation und Zusammenarbeit', self: 'Ich arbeite gut mit anderen zusammen und gehe auf ihre Beiträge ein.' },
    ],
    selfScale: ['trifft noch nicht zu', 'trifft teilweise zu', 'trifft überwiegend zu', 'trifft voll zu'],
    cats: [
      { id: 'abwesend', label: 'Nicht anwesend', section: 'neutral', neutral: true, hint: 'wertungsfrei; Hausaufgaben und Schriftliches dieses Tages: „nicht anwesend“' },
      {
        id: 'rede', label: 'Redebeitrag', section: 'muendlich',
        levels: [
          { id: 'I', label: 'AFB I', pts: 1 },
          { id: 'II', label: 'AFB II', pts: 2 },
          { id: 'III', label: 'AFB III', pts: 3 },
        ],
        hint: 'I wiedergeben · II erklären/analysieren · III beurteilen/Stellung nehmen',
        fb: { area: 'inhalt' },
      },
      {
        id: 'respekt', label: 'Respekt und Fairness', section: 'muendlich', plus: 2, minus: -2,
        fb: {
          area: 'kommunikation',
          plus: 'Du gehst respektvoll mit anderen Meinungen um und diskutierst fair.',
          minus: 'Achte darauf, andere Meinungen zu respektieren und fair zu diskutieren.',
        },
      },
      {
        id: 'kommunikation', label: 'Kommunikation und Zusammenarbeit', section: 'muendlich', plus: 1, minus: -1,
        subs: ['produktiv in Partner-/Gruppenarbeit', 'geht auf Beiträge anderer ein', 'Präsentation'],
        fb: {
          area: 'kommunikation',
          plus: 'In Partner- und Gruppenarbeit arbeitest du produktiv mit und gehst auf die Beiträge anderer ein.',
          minus: 'In Partner- und Gruppenarbeit kannst du dich noch stärker einbringen und mehr auf die Beiträge anderer eingehen.',
        },
      },
      {
        id: 'hausaufgaben', label: 'Hausaufgaben', section: 'arbeit', onePerDay: true,
        hint: 'ein Eintrag pro Tag – ein neuer ersetzt den alten',
        levels: [
          { id: '+', label: 'vorgetragen', pts: 2 },
          { id: 'o', label: 'vorhanden', pts: 0 },
          { id: '-', label: 'unvollständig/fehlt', pts: -3 },
        ],
        fb: {
          area: 'beteiligung',
          plus: 'Du stellst deine Hausaufgaben vor und bringst damit den Unterricht voran.',
          minus: 'Erledige deine Hausaufgaben vollständig und zuverlässig.',
        },
      },
      {
        id: 'material', label: 'Fehlendes Material', section: 'arbeit', minus: -1,
        subs: ['Lehrbuch fehlt', 'Hefter/Arbeitsmaterial fehlt'],
        fb: { area: 'beteiligung', minus: 'Denk an dein Material ({subs}).' },
      },
      {
        id: 'stoerung', label: 'Störung', section: 'arbeit', minus: -1,
        subs: ['Nebengespräche', 'Ablenkung', 'Handynutzung', 'Zwischenrufe'],
        fb: { area: 'beteiligung', minus: 'Vermeide Störungen ({subs}), damit du und die anderen konzentriert arbeiten können.' },
      },
      {
        id: 'arbeitsverhalten', label: 'Arbeitsverhalten', section: 'arbeit', minus: -1,
        subs: ['beginnt nicht zügig', 'arbeitet zu langsam', 'arbeitet nicht zielgerichtet'],
        hint: 'Standard ist „passt“ – nur bei Abweichung eintragen',
        fb: { area: 'beteiligung', minus: 'Beginne Aufgaben zügig und arbeite zielgerichtet an ihnen.' },
      },
      {
        id: 'unpuenktlich', label: 'Unpünktlich', section: 'arbeit', minus: -1,
        fb: { area: 'beteiligung', minus: 'Komm pünktlich zum Unterricht.' },
      },
    ],
    feedbackSections: [
      { id: 'inhalt_gut', area: 'inhalt', title: 'Das läuft gut' },
      { id: 'inhalt_arbeiten', area: 'inhalt', title: 'Daran kannst du arbeiten' },
      { id: 'beteiligung_gut', area: 'beteiligung', title: 'Das läuft gut' },
      { id: 'beteiligung_arbeiten', area: 'beteiligung', title: 'Daran kannst du arbeiten' },
      { id: 'kommunikation_gut', area: 'kommunikation', title: 'Das läuft gut' },
      { id: 'kommunikation_arbeiten', area: 'kommunikation', title: 'Daran kannst du arbeiten' },
    ],
    fbGeneric: {
      redeAnspruch: 'Deine Beiträge sind inhaltlich anspruchsvoll: Du erklärst Zusammenhänge und beziehst begründet Stellung.',
      redeVertiefen: 'Versuche, deine Beiträge stärker zu begründen und eigene Urteile zu formulieren.',
      redeViel: 'Du meldest dich regelmäßig und bringst den Unterricht mit deinen Beiträgen voran.',
      redeWenig: 'Melde dich häufiger – deine Gedanken sind gefragt!',
      schriftlichGut: 'Deine schriftlichen Arbeiten sind sorgfältig und inhaltlich gelungen.',
      schriftlichArbeiten: 'Bei schriftlichen Aufgaben kannst du noch genauer und vollständiger arbeiten.',
      nichtAbgegeben: 'Gib schriftliche Aufgaben bitte vollständig und rechtzeitig ab.',
      inhaltGutLeer: 'Du arbeitest im Unterricht inhaltlich mit.',
      inhaltArbeitenLeer: 'Bleib inhaltlich so dran.',
      beteiligungGutLeer: 'Du bist im Unterricht dabei.',
      beteiligungArbeitenLeer: 'Hier gibt es gerade nichts Besonderes – weiter so!',
      kommunikationGutLeer: 'Du arbeitest mit anderen zusammen.',
      kommunikationArbeitenLeer: 'Bleib offen für die Ideen der anderen.',
    },
  };
}

export const FB_LABELS = {
  gutLeer: '„Das läuft gut“, wenn keine Plus-Einträge vorliegen',
  keineMinus: 'Zusatz bei „Das läuft gut“, wenn keine Minus-Einträge vorliegen',
  arbeitenLeer: '„Daran kannst du arbeiten“, wenn keine Minus-Einträge vorliegen',
  tipp: 'Allgemeiner Tipp',
  redeAnspruch: 'Inhalt gut: Beiträge in AFB II/III',
  redeVertiefen: 'Inhalt arbeiten: überwiegend AFB I',
  redeViel: 'Beteiligung gut: Redebeiträge mindestens im Gruppendurchschnitt',
  redeWenig: 'Beteiligung arbeiten: deutlich weniger Redebeiträge als der Durchschnitt',
  schriftlichGut: 'Inhalt gut: schriftliche Aufgaben überwiegend +',
  schriftlichArbeiten: 'Inhalt arbeiten: schriftliche Aufgaben mit −',
  nichtAbgegeben: 'Beteiligung arbeiten: Aufgaben nicht abgegeben',
  inhaltGutLeer: 'Inhalt gut (Ersatztext)',
  inhaltArbeitenLeer: 'Inhalt arbeiten (Ersatztext)',
  beteiligungGutLeer: 'Beteiligung gut (Ersatztext)',
  beteiligungArbeitenLeer: 'Beteiligung arbeiten (Ersatztext)',
  kommunikationGutLeer: 'Kommunikation gut (Ersatztext)',
  kommunikationArbeitenLeer: 'Kommunikation arbeiten (Ersatztext)',
};

// Kategorien, die die App selbst benötigt (nicht löschbar)
export const SYSTEM_CATS = ['abwesend', 'befreit', 'eingeschraenkt', 'entschuldigung', 'rede', 'hausaufgaben'];
