# Update: Design und Reset (14.11.2026)

## Wichtig: Nicht das gesamte Projekt überschreiben
Die `wrangler.jsonc` auf GitHub enthält **deine echte D1-Datenbank-ID**. Die Datei aus diesem ZIP enthält nur einen Platzhalter und darf deine vorhandene Konfiguration **nicht ersetzen**.

## Diese vier Dateien auf GitHub ersetzen
1. `public/index.html`
2. `public/style.css`
3. `public/app.js`
4. `src.js` (notwendig, damit auch 1–4 Fragen akzeptiert werden)

Commit direkt auf `main`, danach Cloudflare Workers → Deployments/Builds auf `Success` kontrollieren. Weder D1-Migrationen noch Secrets neu einrichten.

## Funktionstest
- Neues privates Fenster, Rechencode eingeben.
- Vier Fragennummern (1, 2, 3, 4) eingeben, fünftes Feld leer lassen: vier Karten mit Überschrift „Antwort“.
- Unten „Nächster Prüfling“ klicken: Zusammenfassung verschwindet, Felder sind leer, Fokus liegt auf Frage 1.
- Auch Reset oben testen.
- Während eine Abfrage lädt, Reset klicken: es darf kein altes Ergebnis nachträglich auftauchen.
- Adminbereich öffnen, vorhandene Frage ansehen und eine Teständerung speichern.

Die Rechenregel allein ist kein sicherer Schutz vertraulicher Fragen. Vor dem Echtbetrieb zusätzliche Authentifizierung vorsehen.
