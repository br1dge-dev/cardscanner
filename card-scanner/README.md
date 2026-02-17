# 🃏 Card Scanner mit Bildvorverarbeitung

Ein webbasierter Card Scanner mit Canvas-basierter Bildvorverarbeitung für bessere OCR-Ergebnisse.

## Features

### Bildvorverarbeitung
- **Grayscale** - Entfernt Farbe, behält nur Luminanz
- **Kontrast-Erhöhung** - Histogramm-Stretching für bessere Sichtbarkeit
- **Schärfen** - Convolution-Filter mit anpassbarem Kernel
- **Binarisierung** - Adaptive Threshold für Schwarz/Weiß
- **Noise Reduction** - Leichtes Blur + erneutes Schärfen

### OCR-Konfiguration
- **PSM 6** - Einzelner Textblock
- **OEM 3** - LSTM Neural Network Mode (nur neuronale Netze)
- **Character Whitelist** - Eingeschränkte Zeichen für weniger Fehler

## Dateien

```
card-scanner/
├── index.html          # UI mit Vorverarbeitungs-Controls
├── app.js             # Hauptlogik mit Bildvorverarbeitung
├── styles.css         # Dark-Theme Styles
├── test-preprocessing.js  # Node.js Test-Skript
└── test-preprocessing/    # Test-Ergebnisse
```

## Verwendung

### Im Browser

1. Öffne `index.html` im Browser
2. Lade ein Bild hoch
3. Aktiviere/Deaktiviere Vorverarbeitung mit dem Toggle
4. Passe Parameter an (Kontrast, Threshold, Schärfen)
5. Klicke "OCR starten"

### Vorverarbeitungs-Optionen

| Parameter | Standard | Beschreibung |
|-----------|----------|--------------|
| Kontrast | 1.5 | Höher = stärkere Kontrast-Erhöhung |
| Threshold | 128 | Für Binarisierung (0-255) |
| Schärfen | 1.0 | Stärke des Sharpen-Kernels |
| Binarisierung | Aus | Schwarz/Weiß-Modus |

## API-Referenz

### preprocessImage(canvas)

Hauptfunktion für die Bildvorverarbeitung.

```javascript
const processedImageData = preprocessImage(canvas);
```

### Tesseract-Konfiguration

```javascript
{
    psm: 6,  // Page Segmentation Mode: Einzelner Block
    oem: 3,  // OCR Engine Mode: LSTM only
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ...'
}
```

## Tests

Node.js-basierte Tests für verschiedene Vorverarbeitungs-Konfigurationen:

```bash
cd card-scanner
npm install canvas
node test-preprocessing.js
```

Ergebnisse werden in `test-preprocessing/` gespeichert:
- `01_original.png` - Originalbild
- `02_preprocessed_standard.png` - Standard-Vorverarbeitung
- `03_high_contrast.png` - Hoher Kontrast
- `04_binarized.png` - Mit Binarisierung
- `05_low_threshold.png` - Niedriger Threshold
- `06_high_threshold.png` - Hoher Threshold

## Debug-Modus

Der Debug-Modus zeigt:
- Original + Vorverarbeitetes Bild nebeneinander
- Konsole-Logging aller Schritte
- Tesseract-Fortschritt in Echtzeit
- Konfidenz-Score des OCR-Ergebnisses

## Tipps für beste Ergebnisse

1. **Für Textkarten**: Binarisierung aktivieren, Threshold ~128
2. **Für Fotos**: Keine Binarisierung, höherer Kontrast
3. **Bei schwachem Kontrast**: Kontrast auf 2.0-2.5 erhöhen
4. **Bei verschwommenem Text**: Schärfen auf 1.5-2.0 setzen