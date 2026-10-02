# Abgleich mit CI_DWD-Vorlagen

Stand: 2. Oktober 2026

Die App enthält 20 Post- und 20 Story-Vorlagen aus den bereitgestellten CI_DWD-After-Effects-Projekten. Die Originalprojekte wurden nur gelesen. Textpositionen, Ausrichtung, Schriftgrößen, Zeilenabstände, Großschreibung sowie Position, Drehung, Spiegelung und Skalierung der Masken wurden aus den Projekteigenschaften übernommen.

Degular Regular (400) und Semibold (600) werden vor jedem Export gezielt geladen. Der bestehende Adobe-Webschriftprojekt-Link enthält jetzt auch Semibold. Ein fehlender Schriftschnitt verhindert den Export und wird angezeigt.

## Maskenbewegung

Die originalen sichtbaren Maskenebenen wurden in After Effects 26.2 Beta gerendert. Zehn bewegte Maskenvarianten enthalten jeweils 450 Bilder bei 30 Bildern/s. Drei statische Story-Varianten bleiben unverändert. Die ursprünglichen Transformationen der 40 Vorlagen werden beim Zeichnen angewendet. Die Auswahl berücksichtigt die unterschiedlichen Varianten von Post 12, Post 13 bis 15 sowie Story 04, 05 und 14.

Für kompakte Webdateien wurden die Alphakonturen bei 50 Prozent Deckkraft extrahiert, mit maximal 0,3 Pixel Konturvereinfachung und Viertelpixelkoordinaten gespeichert. Zwischenwerte der ursprünglichen Kantendeckkraft sind nicht gespeichert. Canvas zeichnet diese Konturen mit seiner eigenen Kantenglättung. Änderungen an Turbulenzparametern schalten auf die frei gestaltbare Maskenbewegung um.

## Prüfung

- Alle 40 Vorlagen lassen sich einsetzen; jede hat sechs Titelzeilen und vier Informationsblöcke sowie eine vorhandene Maskendatei.
- Alle 13 Maskendateien wurden vollständig dekodiert: passende Bildgröße, 30 Bilder/s, 450 Bilder und keine überzähligen Bytes.
- Die binären Konturen stimmen bei unabhängiger Pixelrekonstruktion für Bild 0, 30, 225 und 449 der zehn bewegten Varianten sowie Bild 0 der drei statischen Varianten vollständig mit den bei 50 Prozent geprüften AE-Alphamasken überein. Dies bewertet die Konturdaten, nicht die vollständige Canvas-Ausgabe.
- Browser-PNGs von Post 01 und Story 12 wurden mit nativen AE-Referenzbildern verglichen. Schriftgröße und vertikale Titelpositionen stimmen überein; die Schriftrasterung weicht geringfügig ab. Beim Story-Vergleich liegen über 99,9 Prozent der geprüften weißen Browser-Schriftpixel höchstens einen Pixel von einem weißen AE-Schriftpixel entfernt.
- MP4-Exporte von Post und Story wurden mit ffprobe geprüft: H.264, 1080 × 1080 bzw. 1080 × 1920 Pixel, 30 Bilder/s, 450 Bilder, 15 Sekunden.
- Produktionsbuild erfolgreich.

## Grenzen

Pixelidentische AE-Exporte werden nicht zugesichert. Kantenglättung, Schriftrasterung und Videokompression unterscheiden sich. Die gespeicherte Maskenbewegung umfasst die originalen 15 Sekunden bei 30 Bildern/s. Abweichende Dauer oder Bildrate verwenden diese Bewegung wiederholt beziehungsweise abgetastet. Lange Titel werden innerhalb der sechs vorgegebenen Zeilen verkleinert. Texte und hochgeladene Medien bleiben editierbar.
