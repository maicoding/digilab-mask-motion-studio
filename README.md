# DigiLab Mask Motion Studio

[App auf GitHub Pages öffnen](https://maicoding.github.io/digilab-mask-motion-studio/)

Die App erstellt Instagram-Posts und Stories mit den CI_DWD-Masken. Unter **AE-Vorlagen → Originalvorlage** stehen 20 Post- und 20 Story-Layouts zur Verfügung. Die Maskenbewegungen wurden aus den originalen After-Effects-Projekten gerendert; Positionen, Spiegelungen, Drehungen und Textgestaltung folgen den Vorlagen.

- Sechs einzeln belegbare Titelzeilen, Datum, Beginn, Dauer, Anmeldung und Ort
- Degular Regular und Semibold über das bestehende Adobe-Webschriftprojekt; alternativ eigener Font-Upload
- Bild- und Video-Upload hinter der Maske
- Originale Farbpalette und zusätzliche frei gestaltbare Einstellungen
- PNG-, MP4- und WEBM-Export
- Originalformat: 1080 × 1080 oder 1080 × 1920 Pixel, 15 Sekunden, 30 Bilder/s

**Originaltexte und Einstellungen einsetzen** setzt die gewählte Vorlage zurück. Änderungen an Turbulenzparametern verwenden die frei gestaltbare Maskenbewegung. Die originale Bewegung wiederholt sich nach 15 Sekunden. Kleine Unterschiede zur AE-Kanten- und Schriftrasterung bleiben möglich.

Details zum Referenzvergleich: [AE_REFERENCE_CHECK.md](AE_REFERENCE_CHECK.md).

## Lokal starten

```sh
npm install
npm run dev
```

```sh
npm run build
```

GitHub Actions baut und veröffentlicht die App bei Änderungen auf `main` auf GitHub Pages.
