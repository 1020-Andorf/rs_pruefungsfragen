# Anleitung – GitHub + Cloudflare (Variante A)

## 1. Neues Repository

- https://github.com/new öffnen, Owner `1020-Andorf` (falls berechtigt), Name `rs-pruefung-1020`, Sichtbarkeit **Private**, ohne automatisch erzeugte README.
- Dieses ZIP entpacken und **alle enthaltenen Dateien und Ordner** über „uploading an existing file“ bzw. „Add file → Upload files“ hochladen. Direkt im Repo müssen `src.js`, `wrangler.jsonc`, `package.json`, `public/` und `migrations/` liegen.
- Den Commit speichern. Bestehende Literaturwebsite bleibt unverändert.

## 2. Cloudflare D1 vorbereiten

- https://dash.cloudflare.com öffnen und bei **D1 SQL Database** eine Datenbank namens `rs-pruefung-1020` erstellen.
- Die angezeigte **Database ID** kopieren. In GitHub `wrangler.jsonc` bearbeiten: `HIER_D1_DATENBANK_ID_EINTRAGEN` gegen diese ID austauschen und Commit speichern.
- Im Cloudflare-D1-Dashboard der Datenbank zur SQL-**Console** gehen. Zuerst den gesamten Inhalt von `migrations/0001_init.sql`, anschließend von `migrations/0002_demo_questions.sql` ausführen. Damit werden Tabellen und 12 Demo-Fragen angelegt. (Für spätere automatisierte Migrationen kann Wrangler eingerichtet werden; wenn du die SQL-Konsole verwendest, darfst du diese Initialisierung nicht versehentlich erneut als Migration ausführen.)

## 3. Cloudflare Worker per GitHub-Verbindung erstellen

- Unter **Workers & Pages** einen neuen **Worker** erstellen und als Quelle **GitHub-Repository verbinden** bzw. „Import a repository“ auswählen. GitHub autorisieren und `rs-pruefung-1020` auswählen.
- Produktionsbranch `main`, Projektverzeichnis `/`, Deploy-Befehl `npx wrangler deploy` verwenden. Ein Build-Befehl ist nicht nötig.
- Worker-Name muss `rs-pruefung-1020` sein. Die D1-Bindung `DB` ist in `wrangler.jsonc` definiert.
- Bei initialem Deploy müssen die folgenden Secrets ggf. unmittelbar danach über die Worker-Einstellungen ergänzt werden. Ohne Secrets zeigt die Anwendung einen Konfigurationsfehler.

## 4. Secrets im Cloudflare-Dashboard setzen

Im Worker unter **Settings → Variables and Secrets** (Menünamen können variieren) als **verschlüsselte Secrets** eintragen:

- `ADMIN_CODE`: ein eigener langer, nicht erratbarer Admin-Code.
- `SESSION_SECRET`: ein unabhängiger langer zufälliger Wert (mindestens 32 zufällige Bytes bzw. entsprechend lang generiert).

Nach dem Speichern falls notwendig neu deployen. **Keine Secrets in GitHub-Dateien eintragen!** `CODE_1` und `CODE_2` werden bei dieser Rechensperren-Testversion nicht verwendet.

## 5. Website prüfen

1. Die `*.workers.dev`-Adresse aufrufen. Die Sperrseite zeigt eine fünfstellige Zahl.
2. Rechenregel anwenden (Beispiel `58493` → `7125`) und vierstelligen Code eingeben.
3. Die fünf Fragen `1`, `2`, `3`, `4`, `5` aufrufen. Die 12 Dummy-Fragen sind in D1 gespeichert.
4. Auf **Nächster Prüfling** klicken, um die Auswahl zu löschen.
5. Im Browser **neu laden**: Die Sperrseite verlangt eine neue Aufgabe.
6. Für den Adminmodus auf der Sperrseite „Als Administrator anmelden“ auswählen und zusätzlich `ADMIN_CODE` eingeben; Frage ändern und speichern.

## Wichtiger Sicherheitshinweis

Die öffentliche Rechenregel ist ein Zugangshindernis, **kein echter Schutz für vertrauliche Fragen**. Wer die Regel kennt, kann sich als Prüfer anmelden. Für den späteren realen Fragenkatalog unbedingt einen zweiten geheimen Faktor oder Cloudflare Access ergänzen. Der Adminzugang bleibt separat abgesichert.

## Offizielle Hilfeseiten

- GitHub: https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
- Cloudflare Workers Git: https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/
- Cloudflare D1: https://developers.cloudflare.com/d1/
