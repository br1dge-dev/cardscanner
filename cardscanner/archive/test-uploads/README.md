# Test-Uploads Ordner

Dieser Ordner enthält Test-Ergebnisse vom Card Scanner Prototypen.

## Format

Dateien werden automatisch im folgenden Format gespeichert:

```
scan-001.jpg    - Das gescannte/gescroppte Bild
scan-001.txt    - Der erkannte OCR-Text
scan-002.jpg
scan-002.txt
...
```

## AirDrop Test-Workflow

1. Scanne eine Karte mit dem Card Scanner
2. Speichere das Bild (Save-Button)
3. Sende das Bild per AirDrop an den Mac
4. Lege das Bild in diesem Ordner ab
5. Kopiere den OCR-Text in die entsprechende `.txt` Datei

## Zweck

Diese Test-Ergebnisse helfen bei:
- Qualitätsbewertung der OCR-Erkennung
- Debugging von Erkennungsproblemen
- Training/Verbesserung der OCR-Engine
- Dokumentation verschiedener Kartentypen

## Hinweis

Dieser Ordner ist im `.gitignore` eingetragen und wird nicht versioniert.
