# RS-Prüfungsassistenz OST 1020 – Rechensperre (Testversion)

Eigenständiges Cloudflare-Worker-Projekt mit D1-Datenbank und 12 fiktiven Dummy-Fragen. Das Design orientiert sich an der OST-1020-Wissenssammlung.

## Neue Sperrseite

Bei **jedem Laden der Seite** wird die vorherige Login-Sitzung beendet und eine **neue fünfstellige Zufallszahl** vom Cloudflare Worker ausgestellt. Auch über „Neue Zahl erzeugen“ kann eine neue Aufgabe angefordert werden. Die Aufgabe ist 5 Minuten gültig.

**Rechenregel:** Mittlere Ziffer entfernen → für jede verbleibende Ziffer `10 - Ziffer` rechnen → Ergebnis **umkehren**. Beispiel: `58493` → `5,8,9,3` → `5,2,1,7` → **`7125`**. Die vier äußeren Zufallsziffern sind absichtlich jeweils 1–9, damit immer ein vierstelliger Code entsteht; die mittlere ist 0–9.

Der Worker prüft die Antwort serverseitig anhand eines signierten, kurzlebigen Challenge-Cookies. Bei falscher Eingabe wird eine neue Aufgabe geladen. Das vorhandene D1-Rate-Limit begrenzt Fehlversuche. Eine erfolgreiche Anmeldung gilt bis zum Verlassen/Neuladen der Startseite bzw. maximal 8 Stunden, wenn die Seite offen bleibt.

**Sicherheitsgrenze:** Die Rechenaufgabe ist **kein geheimes Passwort**. Jeder, der die Regel kennt, kann sie lösen oder automatisieren. Für eine echte Zugangsbeschränkung des Fragenkatalogs muss zusätzlich ein geheimer Zugangscode oder ein Cloudflare-Access-Login eingerichtet werden. Der **Admin-Bereich benötigt weiterhin den geheimen `ADMIN_CODE`**. Die Datenbank ist nicht im Browser-Bundle enthalten.

## Funktionen

- Fünf verschiedene Fragennummern eingeben und alle fünf Fragen/Musterantworten untereinander anzeigen.
- „Nächster Prüfling“ leert nur den Prüfungsbogen, ohne neu anzumelden.
- Admin-Bereich: Fragen suchen, anlegen, bearbeiten, geordnete Antwortbausteine pflegen, JSON exportieren.
- 12 Demo-Fragen in `migrations/0002_demo_questions.sql`, keine echten medizinischen Prüfungsantworten.

## Installation

Siehe **ANLEITUNG-GITHUB-CLOUDFLARE.md** für Repository, Cloudflare D1, Secrets und Git-Anbindung.

Test Test Test
