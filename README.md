# Mitarbeit – PWA für das iPad

Mit dieser App erfasst du die Mitarbeit von Schüler:innen in **Sport** und **Politischer Bildung**. Sie läuft rein lokal und verschlüsselt auf dem iPad, als Web-App auf dem Home-Bildschirm.

- Es gibt keinen Server, keine Cloud, keine KI-Dienste und keine Analyse. Die App lädt auch keine fremden Schriften oder Bibliotheken.
- Alle Daten liegen in IndexedDB und sind mit **AES-GCM (256 Bit)** verschlüsselt.
- **Entsperren:** mit einer **4-stelligen PIN**. Der Datenschlüssel ist zusätzlich an einen **nicht exportierbaren, gerätegebundenen Schlüssel** gebunden.
- **Sicherungsdateien:** sind mit einem eigenen **Sicherungspasswort** (mindestens 10 Zeichen) verschlüsselt.
- **Ohne Sicherungspasswort lassen sich Sicherungen nicht wiederherstellen.**

---

## Neu in Version 2.0.0

| Bereich | Neu |
|---|---|
| Notenberechnung | **Punktekonto**: Summe der Punkte im Zeitraum ÷ Anzahl der Stunden, in denen die Person anwesend war. Die Note ergibt sich aus einem **festen Notenschlüssel** je Fach. Ohne Einträge: 0 Punkte = Note 4. |
| Anzeige | Neben jedem Namen stehen Punkte pro Stunde und vorläufige Note, z. B. `+0,45 · 3`. |
| Stunden | Eine Stunde wird automatisch gezählt, sobald an einem Tag ein Eintrag gemacht wird (Doppelstunde = 1). Ohne Einträge zählst du sie mit **„Heutige Stunde zählen“**. Unter *Zeiträume & Noten* lassen sich Stunden hinzufügen oder entfernen. |
| Anwesenheit | Abwesenheit ist wertungsfrei und zählt nicht als Stunde. Sportbefreite Tage zählen ebenfalls nicht. Ist eine Entschuldigung nicht nachgereicht, gibt es −5, und die Fehlstunde zählt wie eine anwesende Stunde. |
| PB Hausaufgaben | Eigene Kategorie: vorgetragen +2 · vorhanden 0 · unvollständig/fehlt −3. Pro Tag gibt es einen Eintrag, ein neuer ersetzt den alten. Wer abwesend ist, wird automatisch übersprungen. |
| PB Schriftlich | + +2 · o 0 · − −1 · nicht abgegeben −2. Wer an dem Tag abwesend ist, steht automatisch auf „nicht anwesend“. |
| Zeiträume | Jeder Zeitraum wird einzeln mit Start- und Enddatum angelegt. In Sport wird ein Ende 4 Wochen nach dem Start vorgeschlagen. |
| Sicherheit | Entsperren mit PIN. Ab dem 5. Fehlversuch gibt es eine steigende Wartezeit. Für Sicherungen gilt ein eigenes Sicherungspasswort. |
| Sitzplan | Ansicht aus Sicht der Lehrkraft: Tafel unten, erste Reihe unten. Bestehende Sitzpläne wurden um 180° gedreht, damit alle am richtigen Platz bleiben. |

### Notenschlüssel (Punkte pro anwesende Stunde, jeweils „ab“)

| Note | Sport | PB |
|---|---|---|
| 1 | ab 1,0 | ab 2,5 |
| 2 | ab 0,6 | ab 1,5 |
| 3 | ab 0,3 | ab 0,75 |
| 4 | ab 0 | ab 0 |
| 5 | ab −0,3 | ab −0,5 |
| 6 | darunter | darunter |

**Sek II (11 GK, 12 GK):** Der 15-Punkte-Schlüssel wird abgeleitet:
- Jeder Notenbereich wird in drei gleich breite Stufen geteilt (Note 2 → 10, 11, 12 Punkte).
- Note 1 bekommt dieselbe Breite wie Note 2 (13, 14, 15).
- Note 6 = 0 Punkte.

Alle Schlüssel und Punktwerte sind unter **Einstellungen → Fach …** änderbar. Dort gibt es auch einen Knopf „Sek-II-Schlüssel aus Sek I neu ableiten“.

### Was beim Update mit vorhandenen Daten passiert
1. Beim ersten Start nach dem Update gibst du einmalig das **bisherige App-Passwort** ein.
2. Danach legst du eine **PIN** (zweimal) und ein **Sicherungspasswort** (zweimal) fest.
3. Vorher legt die App automatisch eine **interne Kopie der alten Daten** an. Unter *Einstellungen → PIN und Sicherungspasswort → „Stand vor dem Update wiederherstellen“* lässt sie sich mit dem alten App-Passwort zurückholen.
4. Klassen, Schüler:innen, Sitzpläne, Einträge und abgeschlossene Zeiträume bleiben erhalten.
   - Einträge behalten ihre Kategorie und werden nach der neuen Punktetabelle gewertet.
   - Bereits bestätigte Noten bleiben unverändert und sind als „altes System“ markiert.
5. Die bisherigen 4-Wochen-Blöcke in Sport werden normale Zeiträume.
6. „Hausaufgaben vergessen“ (PB, Fehlendes Material) wird zu Hausaufgaben „−“.
7. Stunden werden ab dem Update gezählt.
8. **Alte Sicherungsdateien** lassen sich weiter laden – mit dem damaligen App-Passwort.

---

## 1. Veröffentlichen über GitHub Pages (einmalig)

GitHub Pages stellt die App-Dateien nur bereit. **Schülerdaten landen nie auf GitHub**, weil sie ausschließlich auf dem iPad liegen.

1. Lege auf <https://github.com> ein kostenloses Konto an, falls noch keins vorhanden ist.
2. Tippe oben rechts auf **„+“ → „New repository“**.
   - Name: z. B. `mitarbeit`
   - Sichtbarkeit: **Public**. Für GitHub Pages im kostenlosen Konto ist das nötig, und der Code enthält keine Daten.
   - Tippe auf **„Create repository“**.
3. Klicke auf der leeren Repository-Seite auf **„uploading an existing file“**.
4. Ziehe **den gesamten Inhalt** des Ordners `mitarbeit` in das Fenster:
   - `index.html`, `manifest.json`, `sw.js`, `README.md`
   - die Ordner `css`, `js` und `icons`
   - Die Ordnerstruktur muss erhalten bleiben (z. B. `js/views/start.js`).
   - `index.html` muss direkt im Repository liegen, nicht in einem Unterordner.
5. Klicke unten auf **„Commit changes“**.
6. Öffne **Settings → Pages**.
   - Unter **„Build and deployment“** wählst du bei *Source* „Deploy from a branch“.
   - Branch: `main`, Ordner: `/ (root)` → **Save**.
7. Nach 1–2 Minuten steht ganz oben auf der Seite *Settings → Pages* **„Your site is live at …“** mit der Adresse, z. B. `https://DEINNAME.github.io/mitarbeit/`. Der Fortschritt ist im Reiter **Actions** zu sehen.

## 2. Auf dem iPad installieren („Zum Home-Bildschirm“)

1. Öffne die Adresse aus Schritt 1.7 in **Safari** (nicht in Chrome oder Firefox).
2. Tippe auf das **Teilen-Symbol** (Quadrat mit Pfeil nach oben) → **„Zum Home-Bildschirm“** → **„Hinzufügen“**.
3. Starte die App **ab jetzt nur noch über das neue Symbol auf dem Home-Bildschirm**.
   - Die Home-Bildschirm-App hat einen **eigenen Speicher**, getrennt vom Safari-Tab.
4. Beim ersten Start legst du eine **PIN** und ein **Sicherungspasswort** fest. Das Sicherungspasswort notierst du getrennt vom iPad.
5. Lege unter **Zeiträume & Noten** die Zeiträume an:
   - Sport: z. B. 4 Wochen
   - PB: zwei Mitarbeitsnoten pro Halbjahr
6. Prüfe unter **Einstellungen → Allgemein** die **Klingelzeiten**.

Danach funktioniert die App auch **ohne Internet**.

## 3. Sicherung

Die Daten liegen nur auf diesem iPad. Deshalb regelmäßig sichern; die App erinnert nach 7 Tagen.

**Sicherung erstellen**
1. Tippe auf dem Startbildschirm im Hinweis oder unter **Einstellungen → Sicherung** auf **„Sicherung erstellen“**.
2. Tippe auf **„Teilen / Sichern …“** → im iOS-Teilen-Menü z. B. **„In Dateien sichern“**.
3. Kopiere die Datei regelmäßig zusätzlich auf einen eigenen Datenträger (USB-Stick, eigener Rechner per AirDrop). Beachte dabei die Datenschutzvorgaben der Schule.

Die Sicherungsdatei (`Mitarbeit-Sicherung-JJJJ-MM-TT-HHMM.json`) ist mit dem **Sicherungspasswort** verschlüsselt, das beim Erstellen galt.

**Sicherung laden**
- **Im laufenden Betrieb:** *Einstellungen → Sicherung → „Sicherung laden …“*. Die aktuellen Daten werden ersetzt; PIN und Sicherungspasswort bleiben.
- **Neues iPad oder App neu installiert:** Beim ersten Start **„Aus Sicherung wiederherstellen“** wählen, das Passwort der Sicherung eingeben und danach eine PIN und ein Sicherungspasswort festlegen.
- **PIN vergessen:** Auf dem Sperrbildschirm „PIN vergessen?“ wählen. Damit werden alle Daten auf dem Gerät gelöscht; danach lädst du die letzte Sicherung.

## 4. Updates einspielen

**Auf dem iPad:**
- Sobald eine neue Version veröffentlicht ist, erscheint beim nächsten Öffnen (mit Internet) **„Update verfügbar – vorher Sicherung erstellen“**.
- Erst **„Sicherung erstellen“**, dann **„Jetzt aktualisieren“** antippen. Vorhandene Daten werden automatisch übernommen und bei Bedarf migriert. Vor jeder Migration bleibt eine interne Kopie erhalten.
- Unter **Einstellungen → Über die App** kannst du auch **„Nach Update suchen“**.

**Neue Version veröffentlichen:**
1. Geänderte Dateien im GitHub-Repository hochladen (**Add file → Upload files**, gleiche Ordnerstruktur, vorhandene Dateien werden überschrieben).
2. **Wichtig:** In `sw.js` die Zeile `const VERSION = '…';` erhöhen (aktuell `2.0.0`). Nur dann erkennt das iPad die neue Version.
3. Neue Dateien zusätzlich in die Liste `ASSETS` in `sw.js` eintragen.
4. Ändert sich das Datenformat: `SCHEMA_VERSION` in `js/model.js` erhöhen und in `MIGRATIONS` eine Migration ergänzen.

## 5. Bedienung in Kürze

**Startbildschirm**
- Kacheln aller Klassen; ein Tipp auf „Sport“ oder „PB“ öffnet die Lerngruppe.
- In Klassen mit beiden Fächern schaltest du oben zwischen **Sport | PB** um.

**Bewerten**
- Ein Namen antippen öffnet das Bewertungsmenü; die Punkte stehen auf den Knöpfen.
- **Mehrfachauswahl:** Knopf „Mehrfachauswahl“ oder einen Namen lange gedrückt halten.
- **Hausaufgaben schnell erfassen (PB):**
  1. Mehrfachauswahl → „Alle Anwesenden“ → Eintrag geben → Hausaufgaben „vorhanden“.
  2. Danach einzelne Personen auf „vorgetragen“ oder „unvollständig/fehlt“ ändern.

**Rückgängig**
- Der Knopf oben rechts nimmt den letzten Schritt zurück. Eine Mehrfachauswahl zählt als ein Schritt.

**Nachweis**
- Pro Person: Punkte pro Stunde, vorläufige Note, Punkte je Kategorie, alle Einträge mit Datum und Bemerkung.

**Zeiträume & Noten**
- Notenvorschläge, gezählte Stunden.
- **„Abschluss starten“** geht Person für Person vor: Note, Feedback, Präsentieren.
- Danach **„Zeitraum abschließen“**.

**Präsentationsmodus**
- Zeigt nur das Feedback der einen Person.
- Zum Beenden das Feld oben rechts **2 Sekunden gedrückt halten**.

**PB-Sitzplan**
- Sicht der Lehrkraft: Tafel unten.
- Das Schloss schaltet zwischen Verschieben und Bewerten um.

### Punktetabelle Sport
| Kategorie | Punkte |
|---|---|
| Respekt und Fairness · Einsatz in Übungsphasen | +2 / −2 |
| Passive Mitarbeit (aufmerksam bei Erklärungen und in Gesprächsphasen) | +2 / +1 / 0 / −1 / −2 |
| Fachliche Beiträge und Reflexion · Beteiligung · Hilfe und Unterstützung | +1 |
| Zügiges Zusammenkommen · Auf- und Abbau | +1 / −1 |
| Fehlendes Material · Entschuldigung nicht nachgereicht | −5 |
| Unpünktlich · Störung | −1 |
| Nicht anwesend · Sportbefreiung · eingeschränkte Teilnahme | wertungsfrei |

### Punktetabelle PB
| Kategorie | Punkte |
|---|---|
| Redebeitrag AFB I / II / III | +1 / +2 / +3 |
| Respekt und Fairness | +2 / −2 |
| Hausaufgaben: vorgetragen / vorhanden / unvollständig oder fehlt | +2 / 0 / −3 |
| Schriftlich: + / o / − / nicht abgegeben | +2 / 0 / −1 / −2 |
| Kommunikation und Zusammenarbeit | +1 / −1 |
| Fehlendes Material · Störung · Arbeitsverhalten · Unpünktlich | −1 |
| Nicht anwesend | wertungsfrei |

## 6. Datenschutz-Hinweise

- Pro Person nur Vorname und ggf. ein Initial erfassen.
- Die App sperrt sich nach 5 Minuten ohne Bedienung (einstellbar) und nach mehr als 1 Minute im Hintergrund.
- Eine strenge Content-Security-Policy verhindert jede Verbindung zu fremden Servern.
- Die PIN ist kurz. Gegen das Kopieren der Daten schützt der gerätegebundene Schlüssel, gegen Raten die Wartezeit nach Fehlversuchen. Das iPad selbst sollte zusätzlich mit Code gesperrt sein.
- **Schuljahr abschließen** (Einstellungen) löscht nach doppelter Bestätigung alle Schülerdaten.

## Dateien

```
index.html        Einstieg, Content-Security-Policy
manifest.json     PWA-Manifest
sw.js             Service Worker (Offline, Updates) – VERSION hier erhöhen
css/app.css       Gestaltung
icons/            App-Icons
js/               Programmlogik (Verschlüsselung, Datenmodell, Notenlogik, Ansichten)
```
