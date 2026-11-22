# Mitarbeit – PWA für das iPad

Mit dieser App erfasst du die Mitarbeit von Schüler:innen in **Sport** und **Politischer Bildung**. Sie läuft rein lokal und verschlüsselt auf dem iPad, als Web-App auf dem Home-Bildschirm.

- Es gibt keinen Server, keine Cloud, keine KI-Dienste und keine Analyse. Die App lädt auch keine fremden Schriften oder Bibliotheken.
- Alle Daten liegen in IndexedDB und sind mit **AES-GCM (256 Bit)** verschlüsselt.
- **Entsperren:** mit einer **4-stelligen PIN**. Der Datenschlüssel ist zusätzlich an einen **nicht exportierbaren, gerätegebundenen Schlüssel** gebunden.
- **Sicherungsdateien:** sind mit einem eigenen **Sicherungspasswort** (mindestens 10 Zeichen) verschlüsselt.
- **Ohne Sicherungspasswort lassen sich Sicherungen nicht wiederherstellen.**

---

## Neu in Version 3.0.0: Stundenwert in Prozent

### So wird gerechnet
- Jede Person bekommt in jeder **gewerteten Stunde** einen **Stundenwert in Prozent**: Startwert der Stunde plus alle Einträge dieser Stunde, begrenzt auf 0–100 %. Plus-Einträge dürfen mehrfach vergeben werden.
- **Notenvorschlag:** Durchschnitt aller gewerteten Stunden im Zeitraum, umgerechnet mit dem Notenschlüssel.
  - Bis 4 Stunden gewertet sind, gilt der Vorschlag als **„vorläufig“**.
  - Die Lehrkraft bestätigt oder ändert ihn, optional mit Begründung.
- **Neben jedem Namen:** Durchschnitt und vorläufige Note, z. B. `84 % · 2`.
- **Wertungsfrei** (zählt nicht zum Durchschnitt):
  - nicht anwesend (immer entschuldigt; Entschuldigungen werden nicht mehr nachverfolgt)
  - Sportbefreiung mit Attest bzw. innerhalb der Frist
  - eingeschränkte Teilnahme
- **Startwerte:** Sport 88 % („gut“) · PB Sek I 65 %, Sek II 60 % (jeweils Note 3).

| Notenschlüssel Sek I (Kl. 8–10) | ab |
|---|---|
| 1 | 96 % |
| 2 | 80 % |
| 3 | 60 % |
| 4 | 45 % |
| 5 | 16 % |
| 6 | darunter |

**Notenschlüssel Sek II (11 GK, 12 GK):**
- 15 ab 95 % · 14 ab 90 · 13 ab 85 · 12 ab 80 · 11 ab 75
- 10 ab 70 · 9 ab 65 · 8 ab 60 · 7 ab 55 · 6 ab 50
- 5 ab 45 · 4 ab 40 · 3 ab 33 · 2 ab 27 · 1 ab 20 · 0 darunter
- Bei 4 Punkten oder darunter erscheint ein Hinweis: schwach ausreichend, eine Häufung kann Folgen für die Zulassung zum Abitur haben.

### Sport
- **Einsatz-Stufen** ersetzen den Startwert der Stunde. Du trägst nur Abweichungen ein:
  - gut 88 % (Standard) · befriedigend 70 % · ausreichend 52 % · mangelhaft 30 % · ungenügend 8 %
- **Plus (+4 %):** Einsatz + · Beteiligung in Gesprächsphasen und Erklärungen · Hilfe und Unterstützung · Fachliche Beiträge und Reflexion · Besonders fair.
- **Zusammenkommen sowie Auf- und Abbau:** + +4 % · braucht länger −4 % · stets sehr lange bzw. beteiligt sich nicht −8 %.
- **Minus:**
  - Unfairness −4 %, Unfairness schwer −10 %
  - Störung, Unpünktlich, Schmuck nicht abgelegt: je −4 %
- **Sportsachen vergessen, Fingernägel zu lang:** Die Stunde zählt 0 %.
- **Sportbefreiung:**
  - Mit Attest wertungsfrei.
  - Ohne Attest wertungsfrei bis einschließlich der nächsten Sportstunde. Danach zählen die Stunden dieser Befreiung als **unentschuldigt (0 %)**, mit Hinweis. Daran ändern weder Protokoll noch passive Aufgabe etwas.
  - Mit dem Haken „Attest nachgereicht“ wird alles neu berechnet.
- **„Hatte passive Aufgabe“** (nur bei Befreiung): Die Stunde wird gewertet, Start bei 88 %.
- **Protokoll (freiwillig):** sehr gut 100 · gut 88 · befriedigend 70 · ausreichend 52 · mangelhaft 30 %.
  - Bei Befreiung ersetzt es den Stundenwert.
  - Bei vergessenen Sportsachen oder Fingernägeln ersetzt es die 0 %, höchstens bis 52 %.
  - Es zählt zur Stunde, in der es geschrieben wurde; das Datum wählst du beim Eintragen.

### Politische Bildung
| Eintrag | Wirkung |
|---|---|
| Redebeitrag AFB I / II / III | +5 / +10 / +15 % |
| Hausaufgaben vorgetragen / vorhanden / unvollständig oder fehlt | +10 / 0 / −15 % |
| Schriftlich + / o / − / nicht abgegeben | +10 / 0 / −5 / −10 % |
| Respekt und Fairness + / − | +10 / −10 % |
| Kommunikation und Zusammenarbeit + / − | +5 / −5 % |
| Störung · Fehlendes Material · Arbeitsverhalten · Unpünktlich | je −5 % |

Hausaufgaben und schriftliche Aufgaben zählen zur Stunde ihres Datums. Wer an dem Tag fehlt, wird automatisch als „nicht anwesend“ geführt.

### Sitzplan
- Die Kacheln sind kleiner, damit breite Reihen mit Lücken auf den Bildschirm passen.
- Ein **Größenregler** gilt jeweils pro Sitzplan.
- Lange Namen werden mit „…“ gekürzt.
- Die Tafel bleibt unten (Sicht der Lehrkraft).

### Notenbegründung und Bewertungsmaßstab
- **Feedback, Nachweis und Präsentation zeigen drei Ebenen:**
  1. die amtliche Notendefinition
  2. die fachliche Beschreibung (Sport: Notenbeschreibungen; PB: Inhaltliche Qualität, Beteiligung, Kommunikation und Zusammenarbeit)
  3. zusammengefasste Belege, z. B. „Einsatz: 8× gut, 2× befriedigend · Plus: 3× Hilfe und Unterstützung“
  - Dazu kommt **„So erreichst du die nächstbessere Note“**.
- Die bisherigen Satzbausteine bleiben als frei bearbeitbare „persönliche Rückmeldung“ erhalten.
- **Bewertungsmaßstab:** Der Knopf „Maßstab“ in jeder Lerngruppe zeigt Schlüssel, Stufen und Beschreibungen im Vollbild – ohne Schülerdaten.
- **PB-Notenbeschreibungen:** Sie sind ein Entwurf. Bitte unter *Einstellungen → Fach Politische Bildung → Fachliche Notenbeschreibungen* prüfen.
- **Änderbar:** Alle Prozentwerte, Stufen, Schlüssel und Beschreibungen findest du unter **Einstellungen**.

### Zuordnung alter Einträge (Version 2 → 3)

**Sport**

| Alter Eintrag | Neu | Wirkung |
|---|---|---|
| Nicht anwesend (mit Entschuldigungsstatus) | Nicht anwesend, Status entfällt | wertungsfrei |
| Sportbefreiung, Attest ja | unverändert | wertungsfrei |
| Sportbefreiung, Attest nein | Sportbefreiung, „Attest nachgereicht“ | wertungsfrei (keine rückwirkende 0 %) |
| Eingeschränkte Teilnahme | unverändert | wertungsfrei |
| Respekt und Fairness + / − | Besonders fair / Unfairness | +4 % / −4 % |
| Einsatz in Übungsphasen + | Einsatz + | +4 % |
| Einsatz in Übungsphasen − | Einsatz-Stufe „befriedigend“ | Stunde startet bei 70 % |
| Passive Mitarbeit +2 / +1 | Beteiligung in Gesprächsphasen und Erklärungen | +4 % |
| Passive Mitarbeit 0 | wertungsfreie Notiz | – |
| Passive Mitarbeit −1 / −2 | Einsatz-Stufe „befriedigend“ | Stunde startet bei 70 % |
| Beteiligung · Hilfe und Unterstützung · Fachliche Beiträge | unverändert | +4 % |
| Zügiges Zusammenkommen + / − | Zusammenkommen + / braucht länger | +4 % / −4 % |
| Auf- und Abbau + / − | Auf- und Abbau + / braucht länger | +4 % / −4 % |
| Fehlendes Material: Sportsachen vergessen (oder ohne Angabe) | Sportsachen vergessen | Stunde 0 % |
| Fehlendes Material: Fingernägel zu lang | Fingernägel zu lang | Stunde 0 % |
| Fehlendes Material: Schmuck nicht abgelegt | Schmuck nicht abgelegt | −4 % |
| Entschuldigung nicht nachgereicht | wertungsfreie Notiz | – |
| Unpünktlich · Störung | unverändert | −4 % |

**PB:** Alle Kategorien bleiben gleich und werden mit den neuen Prozentwerten gewertet (siehe Tabelle oben).

**Beide Fächer:**
- Selbst angelegte Kategorien: + → +4 % (Sport) bzw. +5 % (PB), − → −4 % bzw. −5 %.
- Abgeschlossene Zeiträume und bestätigte Noten bleiben unverändert und sind als „älteres Bewertungssystem“ markiert.
- Gezählte Stunden und Zeiträume bleiben.
- Sitzpläne bekommen die Kachelgröße 75 %.

### Sicherheit beim Update
- Vor der Umstellung legt die App automatisch eine **verschlüsselte Kopie des alten Stands** an. Du stellst sie unter *Einstellungen → PIN und Sicherungspasswort → „Stand vor dem Update (Format 2) wiederherstellen“* wieder her.
- **Ältere Sicherungsdateien** (Version 1 und 2) werden beim Laden erkannt und genauso migriert.
- **Tests:** `tests/index.html` prüft die Notenberechnung (alle Beispielfälle) und die Migration. Am Rechner über einen lokalen Webserver öffnen; die Seite wird von der App nicht benötigt.

<details>
<summary>Frühere Versionen</summary>

- **2.0.0:**
  - Punktekonto (abgelöst durch 3.0.0)
  - PIN mit Geräteschlüssel, Sicherungspasswort
  - individuelle Zeiträume, Hausaufgaben-Kategorie
  - Sitzplan aus Sicht der Lehrkraft
- **1.0.0:** erste Version (Start bei 3,0 ± Gewicht).
</details>

---

## 1. Veröffentlichen über GitHub Pages (einmalig)

GitHub Pages stellt die App-Dateien nur bereit. **Schülerdaten landen nie auf GitHub**, weil sie ausschließlich auf dem iPad liegen.

1. Lege auf <https://github.com> ein kostenloses Konto an, falls noch keins vorhanden ist.
2. Tippe oben rechts auf **„+“ → „New repository“**.
   - Name: z. B. `mitarbeit`
   - Sichtbarkeit: **Public**.
   - Tippe auf **„Create repository“**.
3. Klicke auf der leeren Repository-Seite auf **„uploading an existing file“**.
4. Ziehe **den gesamten Inhalt** des Ordners `mitarbeit` in das Fenster:
   - `index.html`, `manifest.json`, `sw.js`, `README.md`
   - die Ordner `css`, `js`, `icons` und `tests`
   - Die Ordnerstruktur muss erhalten bleiben. `index.html` muss direkt im Repository liegen.
5. Klicke unten auf **„Commit changes“**.
6. Öffne **Settings → Pages**.
   - Bei *Source* „Deploy from a branch“ wählen.
   - Branch: `main`, Ordner: `/ (root)` → **Save**.
7. Nach 1–2 Minuten steht ganz oben auf der Seite *Settings → Pages* **„Your site is live at …“** mit der Adresse. Der Fortschritt ist im Reiter **Actions** zu sehen.

## 2. Auf dem iPad installieren („Zum Home-Bildschirm“)

1. Öffne die Adresse in **Safari**.
2. Tippe auf **Teilen → „Zum Home-Bildschirm“ → „Hinzufügen“**.
3. Starte die App **nur noch über das Symbol auf dem Home-Bildschirm**. Sie hat einen eigenen Speicher, getrennt vom Safari-Tab.
4. Beim ersten Start legst du eine **PIN** und ein **Sicherungspasswort** fest. Das Sicherungspasswort notierst du getrennt vom iPad.
5. Lege unter **Zeiträume & Noten** die Zeiträume an. Für Sport wird ein Ende 4 Wochen nach dem Start vorgeschlagen.
6. Prüfe unter **Einstellungen → Allgemein** die **Klingelzeiten**.

## 3. Sicherung

**Sicherung erstellen**
1. Tippe auf **„Sicherung erstellen“** (Hinweis auf dem Startbildschirm oder *Einstellungen → Sicherung*).
2. Tippe auf **„Teilen / Sichern …“** → z. B. **„In Dateien sichern“**.
3. Kopiere die Datei regelmäßig auf einen eigenen Datenträger. Beachte dabei die Datenschutzvorgaben der Schule.

**Sicherung laden**
- **Im laufenden Betrieb:** *Einstellungen → Sicherung → „Sicherung laden …“*. Gefragt wird das Sicherungspasswort, das beim Erstellen galt (bei Dateien aus Version 1: das damalige App-Passwort).
- **Neues iPad:** Beim ersten Start **„Aus Sicherung wiederherstellen“** wählen.
- **PIN vergessen:** Auf dem Sperrbildschirm „PIN vergessen?“ wählen. Damit werden alle Daten gelöscht; danach lädst du die letzte Sicherung.

## 4. Updates einspielen

**Auf dem iPad:**
- Nach dem Veröffentlichen erscheint beim nächsten Öffnen (mit Internet) **„Update verfügbar – vorher Sicherung erstellen“**.
- Erst **„Sicherung erstellen“**, dann **„Jetzt aktualisieren“** antippen.
- Danach einmal mit der PIN entsperren. Die Daten werden dabei automatisch umgestellt; eine Kopie des alten Stands bleibt erhalten.
- Unter *Einstellungen → Über die App* kannst du auch **„Nach Update suchen“**.

**Neue Version veröffentlichen:**
1. Geänderte Dateien hochladen (**Add file → Upload files**, gleiche Ordnerstruktur).
2. In `sw.js` die Zeile `const VERSION = '…';` erhöhen (aktuell `3.0.0`).
3. Neue App-Dateien in `ASSETS` in `sw.js` eintragen.
4. Bei Änderungen am Datenformat: `SCHEMA_VERSION` in `js/model.js` erhöhen und eine Migration in `MIGRATIONS` ergänzen.

## 5. Bedienung in Kürze

**Bewerten**
- Ein Namen antippen öffnet das Bewertungsmenü; die Wirkung steht auf den Knöpfen.
- **Mehrfachauswahl:** Knopf „Mehrfachauswahl“ oder einen Namen lange gedrückt halten.
- **Hausaufgaben (PB):**
  1. Mehrfachauswahl → „Alle Anwesenden“ → Hausaufgaben „vorhanden“.
  2. Danach einzelne Personen ändern.

**Stunden**
- Eine Stunde wird gezählt, sobald an einem Tag ein Eintrag gemacht wird.
- Ohne Einträge: **„Heutige Stunde zählen“**.

**Nachweis**
- Durchschnitt, Notenbegründung in drei Ebenen und alle Stundenwerte mit Einträgen.

**Zeiträume & Noten**
- **„Abschluss starten“** geht Person für Person vor: Note bestätigen oder ändern, Notenbegründung, persönliche Rückmeldung, „Präsentieren“.
- Danach **„Zeitraum abschließen“**.

**Präsentationsmodus**
- Zeigt nur die Daten einer Person.
- Zum Beenden das Feld oben rechts **2 Sekunden gedrückt halten**.

## 6. Datenschutz-Hinweise

- Pro Person nur Vorname und ggf. ein Initial erfassen.
- Die App sperrt sich nach 5 Minuten ohne Bedienung (einstellbar) und nach mehr als 1 Minute im Hintergrund.
- Eine strenge Content-Security-Policy verhindert jede Verbindung zu fremden Servern.
- **Schuljahr abschließen** (Einstellungen) löscht nach doppelter Bestätigung alle Schülerdaten.

## Dateien

```
index.html        Einstieg, Content-Security-Policy
manifest.json     PWA-Manifest
sw.js             Service Worker (Offline, Updates) – VERSION hier erhöhen
css/app.css       Gestaltung
icons/            App-Icons
js/               Programmlogik (Verschlüsselung, Datenmodell, Berechnung, Ansichten)
tests/            Tests für Notenberechnung und Migration (für die App nicht nötig)
```
