# Riftbound Card Scanner - OCR Vergleich

## Übersicht

Diese Card Scanner App vergleicht zwei OCR-Engines für die Erkennung von Riftbound-Karten:
- **Tesseract.js** (bestehende Lösung)
- **PaddleOCR** (neue Alternative)

## Problem mit Tesseract.js

Die existierenden Testbilder zeigen, dass Tesseract.js bei Riftbound-Karten erhebliche Probleme hat:

```
oA — EEE ey
Nk SIR
I 2
(og Vi A
ZT PR 4
go. 3 ', i Z4
i Ar
i E i ! k td
I I ad a i
i a FR " of A i
—— Fr
(9) pL sl a
i ETN ES
Morbid Return Ne
(Play on your turn or in showdowns.)
! Return a unit from your trash to your hand.
Ul
I "Soon, this long cruel night will end. But not yet."
- —Viego J
)
OGN 170/298 Rafael Zanchetin
Fl
```

**Probleme:**
- Viel Noise und Artefakte
- Zerstörte Zeichen und Wörter
- Schlechte Erkennung von Spielkarten-Texten

## Implementierung

### Dateien

- `index.html` - UI mit Toggle für OCR-Engines
- `app.js` - OCR-Logik für beide Engines

### Features

1. **Engine-Auswahl**: Toggle zwischen Tesseract.js und PaddleOCR
2. **Parallel-Vergleich**: Beide Engines laufen gleichzeitig
3. **Fallback**: Wenn PaddleOCR fehlschlägt → automatisch Tesseract
4. **Bildvorverarbeitung**: Optimierung für PaddleOCR
5. **Testbilder**: Direkter Zugriff auf vorhandene Testbilder

### PaddleOCR Integration

```javascript
// PaddleOCR via CDN
createWorker('deu+eng')  // Deutsche + Englische Sprache

// Erkennung mit Vorverarbeitung
const result = await paddleOCR.recognize(processedImage);
```

## Nutzung

1. Server starten:
```bash
cd cardscanner
python3 -m http.server 8888
```

2. Browser öffnen:
```
http://localhost:8888
```

3. Bild hochladen oder Testbild auswählen
4. Beide OCR-Engines parallel ausführen
5. Ergebnisse vergleichen

## Erwartete Ergebnisse

### Tesseract.js
- ✅ Schnell (< 2s)
- ❌ Hoher Noise bei Spielkarten
- ❌ Probleme mit gemischten Layouts
- ✅ Keine großen Downloads

### PaddleOCR
- ⚠️ Erstladen ~20MB Modelle
- ✅ Besser bei unstrukturierten Texten
- ✅ Speziell für gemischte Layouts optimiert
- ✅ Höhere Genauigkeit bei Spielkarten

## Technische Details

### PaddleOCR Setup
- **Library**: `@paddlejs-models/ocr@2.0.0`
- **Backend**: WebGL für GPU-Beschleunigung
- **Model-Größe**: ~20MB (einmalig laden)
- **Sprachen**: Englisch + Deutsch (automatisch)

### Bildvorverarbeitung
- Skalierung auf max 1920px (Performance)
- High-Quality Interpolation
- Canvas-basierte Optimierung

### Fallback-Strategie
```javascript
if (paddleOCRFails && !tesseractUsed) {
    // Automatisch zu Tesseract wechseln
    return performOCRWithTesseract(image);
}
```

## To-Do / Weiterentwicklung

1. **Testen**: Mit verschiedenen Kartenbildern vergleichen
2. **Fine-Tuning**: PaddleOCR Parameter anpassen
3. **Mobile**: Touch-Optimierung
4. **Export**: Ergebnisse als JSON/CSV speichern
5. **Batch**: Mehrere Karten auf einmal verarbeiten

## CDN Ressourcen

```html
<!-- Tesseract.js -->
<script src='https://unpkg.com/tesseract.js@5/dist/tesseract.min.js'></script>

<!-- PaddleOCR -->
<script src="https://cdn.jsdelivr.net/npm/@paddlejs/paddlejs-core@2.1.0/dist/index.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@paddlejs-models/ocr@2.0.0/dist/index.umd.min.js"></script>
```

## Lizenz

Für interne Nutzung im Riftbound-Projekt.
