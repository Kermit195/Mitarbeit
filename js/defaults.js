// Standard-Konfiguration. Alles hier ist später in den Einstellungen änderbar.
// Bewertungsmodell (ab Version 3): Stundenwert in Prozent = Startwert + Einträge der Stunde (0–100 %).

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
    minLessons: 4, // bis dahin gilt der Vorschlag als vorläufig
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
    keys: defaultKeys(),
    official: defaultOfficial(),
    subjects: { sport: sportConfig(), pb: pbConfig() },
  };
}

// ---------- Notenschlüssel (Prozent, jeweils Untergrenze „ab“) ----------

export function defaultKeys() {
  return {
    sek1: [
      { grade: 1, min: 96 }, { grade: 2, min: 80 }, { grade: 3, min: 60 }, { grade: 4, min: 45 }, { grade: 5, min: 16 },
    ],
    sek2: [95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 33, 27, 20].map((min, i) => ({ pts: 15 - i, min })),
  };
}

export const GRADE_WORDS = { 1: 'sehr gut', 2: 'gut', 3: 'befriedigend', 4: 'ausreichend', 5: 'mangelhaft', 6: 'ungenügend' };

export function defaultOfficial() {
  return {
    1: 'Die Leistungen entsprechen den Anforderungen in besonderem Maße.',
    2: 'Die Leistungen entsprechen den Anforderungen voll.',
    3: 'Die Leistungen entsprechen den Anforderungen im Allgemeinen.',
    4: 'Die Leistungen weisen zwar Mängel auf, entsprechen aber im Ganzen noch den Anforderungen.',
    5: 'Die Leistungen entsprechen den Anforderungen nicht, lassen jedoch erkennen, dass die notwendigen Grundkenntnisse vorhanden sind und die Mängel in absehbarer Zeit behoben werden können.',
    6: 'Die Leistungen entsprechen den Anforderungen nicht und selbst die Grundkenntnisse sind so lückenhaft, dass die Mängel in absehbarer Zeit nicht behoben werden können.',
    sek2_4: 'Schwach ausreichend: Die Leistungen weisen Mängel auf und entsprechen den Anforderungen nur noch mit Einschränkungen.',
  };
}

// ---------- Sport ----------

export function sportConfig() {
  return {
    periodWeeks: 4,
    thresholds: { haeufung: 3, luecke: 3 },
    start: 88,
    protocolCap: 52,
    sections: [
      { id: 'neutral', label: 'Wertungsfrei' },
      { id: 'einsatz', label: 'Einsatz (Standard: gut = 88 %)' },
      { id: 'plus', label: 'Plus' },
      { id: 'abweichung', label: 'Zusammenkommen, Auf- und Abbau, Regeln' },
      { id: 'sonder', label: 'Befreiung und Protokoll' },
    ],
    cats: [
      { id: 'abwesend', label: 'Nicht anwesend', section: 'neutral', neutral: true, hint: 'immer entschuldigt, wertungsfrei' },
      { id: 'befreit', label: 'Sportbefreiung', section: 'neutral', neutral: true, hint: 'mit Attest wertungsfrei; ohne Attest wertungsfrei bis einschließlich der nächsten Sportstunde, danach 0 %' },
      { id: 'eingeschraenkt', label: 'Eingeschränkte Teilnahme', section: 'neutral', neutral: true, hint: 'wertungsfrei', subs: ['teilweise befreit', 'in der Stunde verletzt'] },
      {
        id: 'einsatzstufe', label: 'Einsatz-Stufe', section: 'einsatz', kind: 'base',
        hint: 'ersetzt den Startwert der Stunde – nur Abweichungen eintragen',
        levels: [
          { id: 'gut', label: 'gut', pct: 88, desc: 'Arbeitet in Übungs- und Spielphasen durchgehend engagiert und ohne Aufforderung mit.' },
          { id: 'befr', label: 'befriedigend', pct: 70, desc: 'Arbeitet überwiegend mit, ist aber zeitweise passiv. Gelegentlich ist eine Aufforderung nötig.' },
          { id: 'ausr', label: 'ausreichend', pct: 52, desc: 'Ist häufig passiv und steht oft herum. Regelmäßig ist eine Aufforderung nötig.' },
          { id: 'mang', label: 'mangelhaft', pct: 30, desc: 'Beteiligt sich kaum und nur nach Aufforderung, steht überwiegend herum.' },
          { id: 'ung', label: 'ungenügend', pct: 8, desc: 'Verweigert die Mitarbeit trotz Aufforderung.' },
        ],
        fb: {
          minus: 'In Übungs- und Spielphasen kannst du noch durchgehender und ohne Aufforderung mitarbeiten.',
          tip: 'Nimm dir für jede Übungsphase ein kleines persönliches Ziel vor.',
        },
      },
      {
        id: 'einsatz', label: 'Einsatz +', section: 'einsatz', plus: 4,
        hint: 'besonders engagiert, Rückfragen, ehrgeizig',
        fb: { plus: 'Du arbeitest besonders engagiert mit, fragst nach und willst dich verbessern.' },
      },
      {
        id: 'beteiligung', label: 'Beteiligung in Gesprächsphasen und Erklärungen', section: 'plus', plus: 4,
        fb: { plus: 'In Gesprächsphasen und bei Erklärungen bist du aufmerksam und beteiligst dich.' },
      },
      {
        id: 'hilfe', label: 'Hilfe und Unterstützung', section: 'plus', plus: 4,
        hint: 'Hilfestellung, anderen helfen, Verantwortung übernehmen',
        fb: { plus: 'Du hilfst anderen, gibst Hilfestellung und übernimmst Verantwortung.' },
      },
      {
        id: 'fachlich', label: 'Fachliche Beiträge und Reflexion', section: 'plus', plus: 4,
        hint: 'Regelkenntnis, Bewegungen beschreiben und beurteilen',
        fb: { plus: 'Du bringst dein Wissen ein, kennst die Regeln und kannst Bewegungen gut beschreiben und beurteilen.' },
      },
      {
        id: 'fair', label: 'Besonders fair', section: 'plus', plus: 4,
        fb: { plus: 'Du verhältst dich besonders fair – auch im Wettkampf.' },
      },
      {
        id: 'zusammenkommen', label: 'Zusammenkommen', section: 'abweichung',
        levels: [
          { id: 'plus', label: '+', pct: 4 },
          { id: 'laenger', label: 'braucht länger', pct: -4 },
          { id: 'lange', label: 'stets sehr lange', pct: -8 },
        ],
        fb: {
          plus: 'Wenn wir uns sammeln, bist du schnell da.',
          minus: 'Wenn wir uns sammeln, kannst du noch zügiger dazukommen.',
          tip: 'Reagiere sofort auf das Signal zum Sammeln.',
        },
      },
      {
        id: 'aufbau', label: 'Auf- und Abbau', section: 'abweichung',
        levels: [
          { id: 'plus', label: '+', pct: 4 },
          { id: 'laenger', label: 'braucht länger', pct: -4 },
          { id: 'nicht', label: 'beteiligt sich nicht', pct: -8 },
        ],
        fb: {
          plus: 'Beim Auf- und Abbau packst du mit an.',
          minus: 'Beim Auf- und Abbau kannst du dich noch mehr einbringen.',
          tip: 'Übernimm beim nächsten Aufbau freiwillig eine Station.',
        },
      },
      {
        id: 'unfair', label: 'Unfairness', section: 'abweichung',
        levels: [
          { id: 'n', label: 'Unfairness', pct: -4 },
          { id: 's', label: 'schwer', pct: -10 },
        ],
        fb: {
          minus: 'Achte darauf, fair zu bleiben und respektvoll mit anderen umzugehen, auch wenn es mal nicht so läuft.',
          tip: 'Gratuliere nach einem Spiel bewusst einmal dem anderen Team oder lobe eine gute Aktion.',
        },
      },
      {
        id: 'stoerung', label: 'Störung', section: 'abweichung', minus: -4,
        subs: ['Nebengespräche', 'Ablenkung', 'unsachgemäßer Umgang mit Material'],
        fb: {
          minus: 'Versuche, Störungen zu vermeiden ({subs}), damit alle gut lernen können.',
          tip: 'Hör bei Erklärungen bewusst zu und such dir einen Platz, an dem du dich gut konzentrieren kannst.',
        },
      },
      {
        id: 'unpuenktlich', label: 'Unpünktlich', section: 'abweichung', minus: -4,
        fb: { minus: 'Komm pünktlich und umgezogen in die Halle.', tip: 'Plane für das Umziehen ein paar Minuten mehr ein.' },
      },
      {
        id: 'schmuck', label: 'Schmuck nicht abgelegt', section: 'abweichung', minus: -4,
        fb: { minus: 'Leg deinen Schmuck vor der Stunde ab.', tip: 'Nimm Schmuck schon in der Umkleide ab.' },
      },
      {
        id: 'vergessen', label: 'Sportsachen vergessen', section: 'abweichung', kind: 'zero',
        hint: 'Stunde = 0 % (mit Protokoll höchstens 52 %)',
        fb: { minus: 'Bring deine Sportsachen vollständig mit.', tip: 'Pack deine Sporttasche schon am Vorabend.' },
      },
      {
        id: 'naegel', label: 'Fingernägel zu lang', section: 'abweichung', kind: 'zero',
        hint: 'Stunde = 0 % (mit Protokoll höchstens 52 %)',
        fb: { minus: 'Achte darauf, dass deine Fingernägel kurz sind.', tip: 'Kürze deine Fingernägel vor dem Sporttag.' },
      },
      {
        id: 'passivaufgabe', label: 'Hatte passive Aufgabe', section: 'sonder', kind: 'passive',
        hint: 'nur bei Befreiung: Stunde wird gewertet, Start bei 88 %',
      },
      {
        id: 'protokoll', label: 'Protokoll bewerten', section: 'sonder', kind: 'protocol',
        hint: 'freiwillig; zählt zur Stunde, in der es geschrieben wurde',
        levels: [
          { id: 'sg', label: 'sehr gut', pct: 100 },
          { id: 'g', label: 'gut', pct: 88 },
          { id: 'b', label: 'befriedigend', pct: 70 },
          { id: 'a', label: 'ausreichend', pct: 52 },
          { id: 'm', label: 'mangelhaft', pct: 30 },
        ],
      },
      { id: 'notiz', label: 'Notiz (aus älterer Version)', section: 'neutral', neutral: true, kind: 'notiz', hidden: true },
    ],
    gradeDesc: {
      1: 'Arbeitet in jeder Stunde durchgehend engagiert mit und sticht regelmäßig in mehreren Bereichen heraus, zum Beispiel bei Einsatz, Auf- und Abbau, in Gesprächsphasen oder bei Hilfestellungen. Ist stets pünktlich, vollständig ausgerüstet und fair.',
      2: 'Arbeitet durchgehend engagiert und ohne Aufforderung mit, kommt zügig zusammen und beteiligt sich am Auf- und Abbau. Ist zuverlässig ausgerüstet und fair.',
      3: 'Arbeitet überwiegend mit, ist aber zeitweise passiv oder braucht gelegentlich eine Aufforderung. Vereinzelt fehlt Sportzeug oder es kommt zu Verzögerungen und Störungen.',
      4: 'Ist häufig passiv oder muss regelmäßig aufgefordert werden. Wiederholt kommt es zu Verzögerungen, Störungen oder fehlendem Sportzeug. Die Mitarbeit ist in Ansätzen erkennbar.',
      5: 'Beteiligt sich nur selten und nach Aufforderung. Häufig fehlendes Sportzeug, Unpünktlichkeit oder Störungen beeinträchtigen den Unterricht.',
      6: 'Verweigert die Mitarbeit trotz Aufforderung oder nimmt wegen fehlenden Sportzeugs oder unentschuldigter Fehlzeiten überwiegend nicht teil.',
    },
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

// ---------- Politische Bildung ----------

export function pbConfig() {
  return {
    periodWeeks: 9,
    thresholds: { haeufung: 3, luecke: 3 },
    start: { sek1: 65, sek2: 60 },
    written: {
      pct: { '+': 10, o: 0, '-': -5, na: -10 },
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
      { id: 'abwesend', label: 'Nicht anwesend', section: 'neutral', neutral: true, hint: 'immer entschuldigt, wertungsfrei; Hausaufgaben und Schriftliches dieses Tages: „nicht anwesend“' },
      {
        id: 'rede', label: 'Redebeitrag', section: 'muendlich',
        levels: [
          { id: 'I', label: 'AFB I', pct: 5 },
          { id: 'II', label: 'AFB II', pct: 10 },
          { id: 'III', label: 'AFB III', pct: 15 },
        ],
        hint: 'I wiedergeben · II erklären/analysieren · III beurteilen/Stellung nehmen',
        fb: { area: 'inhalt' },
      },
      {
        id: 'respekt', label: 'Respekt und Fairness', section: 'muendlich', plus: 10, minus: -10,
        fb: {
          area: 'kommunikation',
          plus: 'Du gehst respektvoll mit anderen Meinungen um und diskutierst fair.',
          minus: 'Achte darauf, andere Meinungen zu respektieren und fair zu diskutieren.',
        },
      },
      {
        id: 'kommunikation', label: 'Kommunikation und Zusammenarbeit', section: 'muendlich', plus: 5, minus: -5,
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
          { id: '+', label: 'vorgetragen', pct: 10 },
          { id: 'o', label: 'vorhanden', pct: 0 },
          { id: '-', label: 'unvollständig/fehlt', pct: -15 },
        ],
        fb: {
          area: 'beteiligung',
          plus: 'Du stellst deine Hausaufgaben vor und bringst damit den Unterricht voran.',
          minus: 'Erledige deine Hausaufgaben vollständig und zuverlässig.',
        },
      },
      {
        id: 'material', label: 'Fehlendes Material', section: 'arbeit', minus: -5,
        subs: ['Lehrbuch fehlt', 'Hefter/Arbeitsmaterial fehlt'],
        fb: { area: 'beteiligung', minus: 'Denk an dein Material ({subs}).' },
      },
      {
        id: 'stoerung', label: 'Störung', section: 'arbeit', minus: -5,
        subs: ['Nebengespräche', 'Ablenkung', 'Handynutzung', 'Zwischenrufe'],
        fb: { area: 'beteiligung', minus: 'Vermeide Störungen ({subs}), damit du und die anderen konzentriert arbeiten können.' },
      },
      {
        id: 'arbeitsverhalten', label: 'Arbeitsverhalten', section: 'arbeit', minus: -5,
        subs: ['beginnt nicht zügig', 'arbeitet zu langsam', 'arbeitet nicht zielgerichtet'],
        hint: 'Standard ist „passt“ – nur bei Abweichung eintragen',
        fb: { area: 'beteiligung', minus: 'Beginne Aufgaben zügig und arbeite zielgerichtet an ihnen.' },
      },
      {
        id: 'unpuenktlich', label: 'Unpünktlich', section: 'arbeit', minus: -5,
        fb: { area: 'beteiligung', minus: 'Komm pünktlich zum Unterricht.' },
      },
      { id: 'notiz', label: 'Notiz (aus älterer Version)', section: 'neutral', neutral: true, kind: 'notiz', hidden: true },
    ],
    // Fachliche Beschreibung je Note, gegliedert nach den drei Bereichen (Entwurf – bitte prüfen)
    gradeDesc: {
      inhalt: {
        1: 'Bringt regelmäßig eigenständige, sachlich fundierte Beiträge ein, erklärt Zusammenhänge und beurteilt Sachverhalte begründet (AFB II/III).',
        2: 'Bringt häufig sachlich richtige Beiträge ein und kann Zusammenhänge erklären; Urteile werden meist begründet.',
        3: 'Beiträge sind überwiegend sachlich richtig, bleiben aber oft bei der Wiedergabe (AFB I); Begründungen gelingen teilweise.',
        4: 'Beiträge sind selten, meist reproduzierend und teilweise ungenau; Zusammenhänge werden kaum erklärt.',
        5: 'Beiträge sind sehr selten und häufig fehlerhaft; Grundbegriffe werden nur ansatzweise beherrscht.',
        6: 'Es sind keine verwertbaren inhaltlichen Beiträge erkennbar.',
      },
      beteiligung: {
        1: 'Beteiligt sich durchgehend aus eigenem Antrieb, Hausaufgaben und Material sind stets vollständig, arbeitet zügig und zielgerichtet.',
        2: 'Beteiligt sich regelmäßig, ist zuverlässig vorbereitet und arbeitet konzentriert.',
        3: 'Beteiligt sich gelegentlich, meist nach Aufforderung; Vorbereitung und Arbeitsverhalten sind überwiegend in Ordnung.',
        4: 'Beteiligt sich selten; wiederholt fehlen Hausaufgaben oder Material, das Arbeitsverhalten braucht häufig Anstöße.',
        5: 'Beteiligt sich kaum; Hausaufgaben, Material oder Pünktlichkeit fehlen häufig, Störungen beeinträchtigen die Arbeit.',
        6: 'Verweigert die Mitarbeit weitgehend.',
      },
      kommunikation: {
        1: 'Geht konstruktiv auf Beiträge anderer ein, diskutiert respektvoll und trägt Gruppenergebnisse maßgeblich.',
        2: 'Arbeitet in Partner- und Gruppenarbeit produktiv mit und geht auf andere ein.',
        3: 'Arbeitet in Gruppen meist mit, geht aber nur gelegentlich auf Beiträge anderer ein.',
        4: 'Bringt sich in Gruppen wenig ein; Gesprächsregeln werden nicht immer eingehalten.',
        5: 'Stört die Zusammenarbeit häufig oder verhält sich wiederholt respektlos.',
        6: 'Verweigert die Zusammenarbeit.',
      },
    },
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
export const SYSTEM_CATS = [
  'abwesend', 'befreit', 'eingeschraenkt', 'einsatzstufe', 'vergessen', 'naegel',
  'passivaufgabe', 'protokoll', 'rede', 'hausaufgaben', 'notiz',
];
