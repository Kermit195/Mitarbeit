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
    rounding: 'math', // 'math': 2,5 → 3 · 'favor': 2,5 → 2
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

export function sportConfig() {
  return {
    blockStart: '2026-08-24',
    thresholds: { haeufung: 3, luecke: 3, excuseDays: 7 },
    sections: [
      { id: 'neutral', label: 'Neutral – ohne Auswirkung auf die Note' },
      { id: 'schwer', label: 'Schwer' },
      { id: 'mittel', label: 'Mittel' },
      { id: 'leicht', label: 'Leicht' },
    ],
    cats: [
      { id: 'abwesend', label: 'Nicht anwesend', section: 'neutral', neutral: true, hint: 'setzt automatisch „Entschuldigung offen“' },
      { id: 'befreit', label: 'Sportbefreiung', section: 'neutral', neutral: true, hint: 'gilt bis zum gewählten Datum in jeder Stunde' },
      { id: 'eingeschraenkt', label: 'Eingeschränkte Teilnahme', section: 'neutral', neutral: true, subs: ['teilweise befreit', 'in der Stunde verletzt'] },
      {
        id: 'respekt', label: 'Respekt und Fairness', section: 'schwer', w: 0.5, plus: true, minus: true,
        fb: {
          plus: 'Du gehst respektvoll und fair mit deinen Mitschüler:innen um – auch im Wettkampf.',
          minus: 'Achte darauf, fair zu bleiben und respektvoll mit anderen umzugehen, auch wenn es mal nicht so läuft.',
          tip: 'Gratuliere nach einem Spiel bewusst einmal dem anderen Team oder lobe eine gute Aktion.',
        },
      },
      {
        id: 'material', label: 'Fehlendes Material', section: 'schwer', w: 0.5, minus: true,
        subs: ['Sportsachen vergessen', 'Fingernägel zu lang', 'Schmuck nicht abgelegt'],
        fb: {
          minus: 'Komm vollständig vorbereitet zum Sportunterricht ({subs}).',
          tip: 'Pack deine Sporttasche schon am Vorabend und denk an kurze Fingernägel und abgelegten Schmuck.',
        },
      },
      {
        id: 'entschuldigung', label: 'Entschuldigung nicht nachgereicht', section: 'schwer', w: 0.5, minus: true,
        fb: {
          minus: 'Reiche Entschuldigungen für Fehlstunden bitte rechtzeitig nach.',
          tip: 'Gib eine Entschuldigung immer gleich in der nächsten Sportstunde ab.',
        },
      },
      {
        id: 'beteiligung', label: 'Beteiligung', section: 'mittel', w: 0.25, plus: true,
        hint: 'aktiv, motiviert, konzentriert, auch in Gesprächsphasen',
        fb: { plus: 'Du beteiligst dich aktiv, motiviert und konzentriert am Unterricht.' },
      },
      {
        id: 'einsatz', label: 'Einsatz in Übungsphasen', section: 'mittel', w: 0.25, plus: true, minus: true,
        fb: {
          plus: 'In den Übungsphasen zeigst du viel Einsatz.',
          minus: 'In den Übungsphasen kannst du noch mehr Einsatz zeigen und die Übungszeit besser nutzen.',
          tip: 'Nimm dir für jede Übungsphase ein kleines persönliches Ziel vor.',
        },
      },
      {
        id: 'hilfe', label: 'Hilfe und Unterstützung', section: 'mittel', w: 0.25, plus: true,
        hint: 'Hilfestellung, anderen helfen, Verantwortung übernehmen',
        fb: { plus: 'Du hilfst anderen, gibst Hilfestellung und übernimmst Verantwortung.' },
      },
      {
        id: 'fachlich', label: 'Fachliche Beiträge und Reflexion', section: 'mittel', w: 0.25, plus: true,
        hint: 'Regelkenntnis, Bewegungen beschreiben und beurteilen',
        fb: { plus: 'Du bringst dein Wissen ein, kennst die Regeln und kannst Bewegungen gut beschreiben und beurteilen.' },
      },
      {
        id: 'stoerung', label: 'Störung', section: 'mittel', w: 0.25, minus: true,
        subs: ['Nebengespräche', 'Ablenkung', 'unsachgemäßer Umgang mit Sportmaterial'],
        fb: {
          minus: 'Versuche, Störungen zu vermeiden ({subs}), damit alle gut lernen können.',
          tip: 'Hör bei Erklärungen bewusst zu und such dir einen Platz, an dem du dich gut konzentrieren kannst.',
        },
      },
      {
        id: 'unpuenktlich', label: 'Unpünktlich', section: 'leicht', w: 0.1, minus: true,
        fb: { minus: 'Komm pünktlich und umgezogen in die Halle.', tip: 'Plane für das Umziehen ein paar Minuten mehr ein.' },
      },
      {
        id: 'zusammenkommen', label: 'Zügiges Zusammenkommen', section: 'leicht', w: 0.1, plus: true, minus: true,
        fb: {
          plus: 'Wenn wir uns sammeln, bist du schnell da.',
          minus: 'Wenn wir uns sammeln, kannst du noch zügiger dazukommen.',
          tip: 'Reagiere sofort auf das Signal zum Sammeln.',
        },
      },
      {
        id: 'aufbau', label: 'Auf- und Abbau', section: 'leicht', w: 0.1, plus: true, minus: true,
        fb: {
          plus: 'Beim Auf- und Abbau packst du mit an.',
          minus: 'Beim Auf- und Abbau kannst du dich noch mehr einbringen.',
          tip: 'Übernimm beim nächsten Aufbau freiwillig eine Station.',
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
    thresholds: { haeufung: 3, luecke: 3 },
    written: { w: 0.15, arts: ['Exit-Ticket', 'Arbeitsblatt', 'Hausaufgabe', 'Sonstiges'] },
    sections: [
      { id: 'neutral', label: 'Neutral' },
      { id: 'bewertend', label: 'Bewertend' },
    ],
    areas: [
      { id: 'inhalt', label: 'Inhaltliche Qualität', self: 'Meine Beiträge sind inhaltlich gut und begründet.' },
      { id: 'beteiligung', label: 'Beteiligung', self: 'Ich beteilige mich aktiv am Unterricht.' },
      { id: 'kommunikation', label: 'Kommunikation und Zusammenarbeit', self: 'Ich arbeite gut mit anderen zusammen und gehe auf ihre Beiträge ein.' },
    ],
    selfScale: ['trifft noch nicht zu', 'trifft teilweise zu', 'trifft überwiegend zu', 'trifft voll zu'],
    cats: [
      { id: 'abwesend', label: 'Nicht anwesend', section: 'neutral', neutral: true },
      {
        id: 'rede', label: 'Redebeitrag', section: 'bewertend', plus: true,
        levels: [
          { id: 'I', label: 'AFB I', w: 0.05 },
          { id: 'II', label: 'AFB II', w: 0.15 },
          { id: 'III', label: 'AFB III', w: 0.3 },
        ],
        hint: 'I wiedergeben · II erklären/analysieren · III beurteilen/Stellung nehmen',
        fb: { area: 'inhalt' },
      },
      {
        id: 'respekt', label: 'Respekt und Fairness', section: 'bewertend', w: 0.3, plus: true, minus: true,
        fb: {
          area: 'kommunikation',
          plus: 'Du gehst respektvoll mit anderen Meinungen um und diskutierst fair.',
          minus: 'Achte darauf, andere Meinungen zu respektieren und fair zu diskutieren.',
        },
      },
      {
        id: 'stoerung', label: 'Störung', section: 'bewertend', w: 0.2, minus: true,
        subs: ['Nebengespräche', 'Ablenkung', 'Handynutzung', 'Zwischenrufe'],
        fb: { area: 'beteiligung', minus: 'Vermeide Störungen ({subs}), damit du und die anderen konzentriert arbeiten können.' },
      },
      {
        id: 'material', label: 'Fehlendes Material', section: 'bewertend', w: 0.2, minus: true,
        subs: ['Lehrbuch fehlt', 'Hausaufgaben vergessen', 'Hefter/Arbeitsmaterial fehlt'],
        fb: { area: 'beteiligung', minus: 'Denk an dein Material und deine Hausaufgaben ({subs}).' },
      },
      {
        id: 'kommunikation', label: 'Kommunikation und Zusammenarbeit', section: 'bewertend', w: 0.1, plus: true, minus: true,
        subs: ['produktiv in Partner-/Gruppenarbeit', 'geht auf Beiträge anderer ein', 'Präsentation'],
        fb: {
          area: 'kommunikation',
          plus: 'In Partner- und Gruppenarbeit arbeitest du produktiv mit und gehst auf die Beiträge anderer ein.',
          minus: 'In Partner- und Gruppenarbeit kannst du dich noch stärker einbringen und mehr auf die Beiträge anderer eingehen.',
        },
      },
      {
        id: 'arbeitsverhalten', label: 'Arbeitsverhalten', section: 'bewertend', w: 0.1, minus: true,
        subs: ['beginnt Aufgaben nicht zügig', 'arbeitet zu langsam', 'arbeitet nicht zielgerichtet'],
        hint: 'Standard ist „passt“ – nur bei Abweichung eintragen',
        fb: { area: 'beteiligung', minus: 'Beginne Aufgaben zügig und arbeite zielgerichtet an ihnen.' },
      },
      {
        id: 'unpuenktlich', label: 'Unpünktlich', section: 'bewertend', w: 0.1, minus: true,
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
  redeAnspruch: 'Inhalt gut: viele Beiträge in AFB II/III',
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
export const SYSTEM_CATS = ['abwesend', 'befreit', 'eingeschraenkt', 'entschuldigung', 'rede'];
