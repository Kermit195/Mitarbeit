# Mitarbeit – PWA für das iPad

Mit dieser App erfasst du die Mitarbeit von Schüler:innen in **Sport** und **Politischer Bildung**. Sie läuft rein lokal und verschlüsselt auf dem iPad, als Web-App auf dem Home-Bildschirm.

- Es gibt keinen Server, keine Cloud, keine KI-Dienste und keine Analyse. Die App lädt auch keine fremden Schriften oder Bibliotheken.
- Alle Daten liegen in IndexedDB und sind mit **AES-GCM (256 Bit)** verschlüsselt. Der Schlüssel wird mit **PBKDF2-SHA-256 und 600.000 Durchläufen** aus dem App-Passwort abgeleitet.
- **Ohne Passwort gibt es keine Wiederherstellung.**

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
5. Klicke unten auf **„Commit changes“**.
6. Öffne **Settings → Pages**.
   - Unter **„Build and deployment“** wählst du bei *Source* „Deploy from a branch“.
   - Branch: `main`, Ordner: `/ (root)` → **Save**.
7. Nach 1–2 Minuten erscheint dort die Adresse, z. B. `https://DEINNAME.github.io/mitarbeit/`.

> Tipp: Die Adresse am besten nicht weitergeben. Sie ist zwar ungefährlich, weil keine Daten dort liegen, aber es gibt auch keinen Grund dafür.

## 2. Auf dem iPad installieren („Zum Home-Bildschirm“)

1. Öffne die Adresse aus Schritt 1.7 in **Safari** (nicht in Chrome oder Firefox).
2. Tippe auf das **Teilen-Symbol** (Quadrat mit Pfeil nach oben) → **„Zum Home-Bildschirm“** → **„Hinzufügen“**.
3. Starte die App **ab jetzt nur noch über das neue Symbol auf dem Home-Bildschirm**.
   - Die Home-Bildschirm-App hat einen **eigenen Speicher**, getrennt vom Safari-Tab. Daten, die du im Safari-Tab eingibst, sind in der Home-Bildschirm-App nicht vorhanden – und umgekehrt.
4. Beim ersten Start legst du das **App-Passwort** fest (mindestens 8 Zeichen) und notierst es an einem sicheren Ort.
5. Prüfe unter **Einstellungen → Fach Sport → Standard-Startdatum der 4-Wochen-Blöcke** das Datum (voreingestellt: 24.08.2026). Lege für PB unter **Zeiträume & Noten** die beiden Mitarbeitsnoten-Zeiträume des Halbjahres an.
6. Prüfe unter **Einstellungen → Allgemein** die **Klingelzeiten** und passe sie an deine Schule an.

Danach funktioniert die App auch **ohne Internet**.

## 3. Sicherung

Die Daten liegen nur auf diesem iPad. Geht das iPad verloren oder wird die App gelöscht, sind sie weg. Deshalb regelmäßig sichern; die App erinnert nach 7 Tagen.

**Sicherung erstellen**
1. Tippe auf dem Startbildschirm im Hinweis oder unter **Einstellungen → Sicherung** auf **„Sicherung erstellen“**.
2. Tippe auf **„Teilen / Sichern …“** → im iOS-Teilen-Menü z. B. **„In Dateien sichern“**.
3. Kopiere die Datei regelmäßig zusätzlich auf einen eigenen Datenträger, z. B. einen USB-Stick am iPad oder per AirDrop auf einen eigenen Rechner. Beachte dabei die Datenschutzvorgaben der Schule.

Die Sicherungsdatei (`Mitarbeit-Sicherung-JJJJ-MM-TT-HHMM.json`) ist **mit dem App-Passwort verschlüsselt**, das beim Erstellen galt.

**Sicherung laden**
- **Im laufenden Betrieb:** Öffne **Einstellungen → Sicherung → „Sicherung laden …“**, wähle die Datei und gib das Passwort der Sicherung ein. Die aktuellen Daten werden ersetzt, das App-Passwort bleibt gleich.
- **Neues iPad oder App neu installiert:** Tippe beim ersten Start auf **„Aus Sicherung wiederherstellen“**. Das Passwort der Sicherung wird dann das App-Passwort.

## 4. Updates einspielen

**Auf dem iPad:**
- Sobald eine neue Version veröffentlicht ist, erscheint beim nächsten Öffnen (mit Internet) der Hinweis **„Update verfügbar – vorher Sicherung erstellen“**.
- Erst **„Sicherung erstellen“**, dann **„Jetzt aktualisieren“** antippen. Die App lädt neu und übernimmt die vorhandenen Daten automatisch. Eine neue Version passt ältere Daten bei Bedarf über eine Migration an.
- Unter **Einstellungen → Über die App** kannst du auch manuell **„Nach Update suchen“**.

**Neue Version veröffentlichen (für die Person, die den Code pflegt):**
1. Geänderte Dateien im GitHub-Repository hochladen (**Add file → Upload files**, gleiche Pfade).
2. **Wichtig:** In `sw.js` die Zeile `const VERSION = '1.0.0';` erhöhen, z. B. auf `'1.0.1'`. Nur dann erkennt das iPad die neue Version.
3. Neue Dateien zusätzlich in die Liste `ASSETS` in `sw.js` eintragen.
4. Ändert sich das Datenformat, `SCHEMA_VERSION` in `js/model.js` erhöhen und eine Migration in `MIGRATIONS` ergänzen. So werden bestehende Daten beim Entsperren automatisch angepasst.

## 5. Bedienung in Kürze

**Startbildschirm**
- Kacheln aller Klassen. Ein Tipp auf „Sport“ oder „PB“ öffnet die jeweilige Lerngruppe.
- In Klassen mit beiden Fächern schaltest du oben zwischen **Sport | PB** um.

**Bewerten**
- Ein Namen antippen öffnet das Bewertungsmenü. Die Bemerkung ist optional.
- **Mehrfachauswahl:** Knopf „Mehrfachauswahl“ oder einen Namen lange gedrückt halten.

**Rückgängig**
- Der Knopf oben rechts nimmt den letzten Schritt zurück. Eine Mehrfachauswahl zählt als ein Schritt.

**Nachweis**
- Alle Einträge pro Person und Zeitraum, mit Zusammenfassung.
- Einträge antippen, um sie zu bearbeiten oder zu löschen.

**Zeiträume & Noten**
- Zeigt Notenvorschläge.
- **„Abschluss starten“** geht Person für Person vor: Note bestätigen oder ändern (optional mit Begründung), Feedback-Entwurf bearbeiten, **„Präsentieren“**.
- Danach **„Zeitraum abschließen“**. Abgeschlossene Zeiträume bleiben als Verlauf erhalten.

**Präsentationsmodus**
- Zeigt nur das Feedback der einen Person.
- Zum Beenden das Feld oben rechts **2 Sekunden gedrückt halten**.

**PB-Sitzplan**
- Mit dem Schloss oben rechts schaltest du zwischen Verschieben und Bewerten um.
- Unter **„＋ Neu“** legst du weitere Sitzpläne an (z. B. „Gruppentische“).

**Einstellungen**
- Klassen und Fächer, Kategorien, Gewichte, Schwellen, Feedback-Bausteine, Rundung, Sperrzeit, Klingelzeiten, Passwort, „Schuljahr abschließen“.

### Notenberechnung
| | Start | Grenzen | Gewichte |
|---|---|---|---|
| Sek I | 3,0 | 1,0 – 6,0 | wie eingestellt |
| Sek II (11 GK, 12 GK) | 8 Punkte | 0 – 15 | × 3 |

- Plus-Einträge verbessern die Note, Minus-Einträge verschlechtern sie um das jeweilige Gewicht.
- Die Grenzen werden auf das Endergebnis angewendet.
- Rundung Sek I: einstellbar, entweder mathematisch (2,5 → 3) oder zugunsten (2,5 → 2).

## 6. Datenschutz-Hinweise

- Pro Person nur Vorname und ggf. ein Initial erfassen.
- Die App sperrt sich nach 5 Minuten ohne Bedienung (einstellbar) und nach mehr als 1 Minute im Hintergrund.
- Eine strenge Content-Security-Policy verhindert jede Verbindung zu fremden Servern.
- **Schuljahr abschließen** (Einstellungen) löscht nach doppelter Bestätigung alle Schülerdaten. Optional bleiben Klassen und Einstellungen erhalten.
- Vor einer Weitergabe oder Reparatur des iPads: „Schuljahr abschließen“ ohne „behalten“ ausführen oder die Home-Bildschirm-App löschen.

## Dateien

```
index.html        Einstieg, Content-Security-Policy
manifest.json     PWA-Manifest
sw.js             Service Worker (Offline, Updates) – VERSION hier erhöhen
css/app.css       Gestaltung
icons/            App-Icons
js/               Programmlogik (Verschlüsselung, Datenmodell, Notenlogik, Ansichten)
```
