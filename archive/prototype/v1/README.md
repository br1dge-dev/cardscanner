# Card Scanner Prototype v1

## 📁 Struktur

```
cardscanner/
└── prototype/
    └── v1/
        ├── index.html      # Single-Page App
        ├── style.css       # Responsive Styles
        ├── app.js          # Vanilla JS Kamera-Logik
        └── README.md       # Diese Datei
```

## 🚀 Lokaler Test

### Server starten

```bash
cd cardscanner/prototype/v1
python3 -m http.server 8765
```

Dann im Browser öffnen:
- **Desktop**: http://localhost:8765
- **Mobile** (im selben Netz): http://[DEINE-IP]:8765

### HTTPS für Mobile-Testing

getUserMedia erfordert HTTPS auf Mobilgeräten. Optionen:

1. **ngrok** (Empfohlen):
   ```bash
   ngrok http 8765
   ```
   Dann die HTTPS-URL auf dem Handy öffnen

2. **mkcert** für lokales HTTPS:
   ```bash
   mkcert -install
   mkcert localhost 192.168.x.x
   ```

## ✅ Features

- [x] Kamera-Zugriff via getUserMedia API
- [x] Vollbild-Kamera-Stream
- [x] Statischer Rahmen-Overlay (63mm x 88mm Verhältnis)
- [x] Grüne Ecken-Markierungen
- [x] Manueller Shutter-Button
- [x] Touch & Click Support
- [x] Automatisches Zuschneiden auf Kartenbereich
- [x] Preview mit Save/Retake
- [x] Fehlerbehandlung mit Retry
- [x] Mobile-optimiert (Responsive, Touch-friendly)
- [x] Landscape/Portrait Support
- [x] iOS Safe Area Support
- [x] Tastatur-Shortcuts (Space=Capture, Escape=Retake)

## 📱 Browser-Kompatibilität

| Browser | Kamera-Support | Hinweise |
|---------|---------------|----------|
| Chrome | ✅ Voll | Am besten getestet |
| Safari iOS | ✅ Voll | iOS 11+ required |
| Firefox | ✅ Voll | |
| Safari macOS | ✅ Voll | |
| Edge | ✅ Voll | Chromium-basiert |

## ⚠️ Bekannte Einschränkungen & Probleme

### 1. HTTPS erforderlich
**Problem**: getUserMedia funktioniert nur auf HTTPS oder localhost.
**Lösung**: Für Mobile-Testing ngrok verwenden.

### 2. Berechtigungen
**Problem**: Browser fragt beim ersten Mal nach Kamera-Berechtigung.
**Lösung**: Nutzer müssen "Erlauben" klicken.

### 3. iOS Safari
**Problem**: `playsinline` Attribut benötigt für Inline-Video.
**Status**: ✅ Implementiert.

### 4. Android Chrome
**Problem**: Rückkamera wird manchmal nicht gefunden.
**Lösung**: Fallback auf front-camera implementiert.

### 5. Bildqualität
**Problem**: Canvas-Capture hat manchmal niedrigere Auflösung.
**Lösung**: Original Video-Resolution wird verwendet (nicht display-size).

## 🎯 Nächste Schritte (v2 Ideen)

- [ ] PWA Manifest & Service Worker
- [ ] Auto-Capture wenn Karte erkannt
- [ ] Bild-Enhancement (Kontrast, Helligkeit)
- [ ] Mehrere Karten speichern
- [ ] OCR für Kartentext
- [ ] Karten-Datenbank Integration
- [ ] Flash/Torch Support
- [ ] Zoom Controls

## 📝 Code-Struktur

### app.js
- `initCamera()`: Kamera initialisieren
- `capturePhoto()`: Foto aufnehmen
- `cropToCardFrame()`: Auf Kartenbereich zuschneiden
- `handleCameraError()`: Fehlerbehandlung
- `fallbackCamera()`: Einfache Constraints als Fallback

### style.css
- Mobile-first Responsive Design
- 63mm x 88mm Aspect Ratio (1:1.3968)
- iOS Safe Area Support
- Landscape/Portrait Optimierungen

## 🔧 Technische Details

### Karten-Rahmen
- Verhältnis: 63mm x 88mm (Standard Trading Card)
- CSS: `aspect-ratio` Fallback über padding-hack
- Responsive: 85vw auf Mobile, 400px max auf Desktop

### Bild-Capture
- Canvas-Rendering vom Video-Element
- Koordinaten-Transformation (Screen → Video)
- Cropping auf Frame-Bereich

### Fehlerbehandlung
- `NotAllowedError`: Berechtigung verweigert
- `NotFoundError`: Keine Kamera
- `NotReadableError`: Kamera in Benutzung
- `OverconstrainedError`: Constraints nicht unterstützt → Fallback
