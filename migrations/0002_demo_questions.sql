-- Ausschließlich fiktive Testinhalte. Nicht als medizinische Musterlösung verwenden.
INSERT OR IGNORE INTO questions(number,question) VALUES
(1,'DEMO: Was ist vor Beginn einer Übungsprüfung zu kontrollieren?'),
(2,'DEMO: Welche Angaben gehören zu einer strukturierten Übergabe?'),
(3,'DEMO: Wie wird eine Übungssituation dokumentiert?'),
(4,'DEMO: Warum ist Teamkommunikation in einer Übung wichtig?'),
(5,'DEMO: Welche Inhalte gehören zur Materialkontrolle?'),
(6,'DEMO: Wie bereitest du einen Übungsarbeitsplatz vor?'),
(7,'DEMO: Was ist bei einer simulierten Lagebesprechung wichtig?'),
(8,'DEMO: Wie gehst du bei fehlenden Übungsunterlagen vor?'),
(9,'DEMO: Was gehört zu einer Nachbesprechung?'),
(10,'DEMO: Wie unterscheidet man Beobachtung und Bewertung?'),
(11,'DEMO: Warum sollen Prüfungsfragen eindeutig nummeriert sein?'),
(12,'DEMO: Was ist vor der nächsten Prüfung zurückzusetzen?');
INSERT OR IGNORE INTO answer_blocks(question_number,position,content) VALUES
(1,0,'Prüfungsunterlagen auf Vollständigkeit prüfen.'),(1,1,'Benötigte Übungsmaterialien bereitlegen.'),(1,2,'Rollen und Ablauf der Demo erklären.'),
(2,0,'Die Situation knapp zusammenfassen.'),(2,1,'Beobachtungen strukturiert und verständlich nennen.'),(2,2,'Offene Fragen für Rückfragen notieren.'),
(3,0,'Zeitpunkt und Verlauf der Simulation erfassen.'),(3,1,'Nur tatsächlich beobachtete Inhalte dokumentieren.'),
(4,0,'Auf klare und eindeutige Aussagen achten.'),(4,1,'Aufgaben und Rückmeldungen im Team abstimmen.'),
(5,0,'Vorhandenes Material anhand einer Liste kontrollieren.'),(5,1,'Mängel für die Übungsleitung festhalten.'),
(6,0,'Arbeitsbereich übersichtlich gestalten.'),(6,1,'Übungsunterlagen und Schreibmaterial bereitlegen.'),
(7,0,'Ziele der Besprechung nennen.'),(7,1,'Informationen verständlich in einer gemeinsamen Reihenfolge austauschen.'),
(8,0,'Fehlende Unterlagen vermerken.'),(8,1,'Die zuständige Übungsleitung informieren.'),
(9,0,'Was gut funktioniert hat, konkret benennen.'),(9,1,'Verbesserungspunkte für die nächste Übung sammeln.'),
(10,0,'Beobachtung beschreibt, was wahrgenommen wurde.'),(10,1,'Bewertung ordnet die Beobachtung anhand vereinbarter Kriterien ein.'),
(11,0,'Nummern erlauben eine zuverlässige Auswahl.'),(11,1,'Verwechslungen beim Zusammenstellen von Fragen werden reduziert.'),
(12,0,'Alle fünf Fragennummern leeren.'),(12,1,'Die vorherige Zusammenfassung ausblenden.'),(12,2,'Im selben Prüferkonto angemeldet bleiben.');
