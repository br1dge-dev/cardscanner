# Cardscanner v2 - Projektstatus

**Stand:** 18. Februar 2026, 23:00 Uhr  
**Status:** MVP läuft auf iPhone, Kamera-Problem offen

---

## ✅ Was funktioniert

| Feature | Status | Details |
|---------|--------|---------|
| **App-Setup** | ✅ Fertig | Vite + React 19 + TypeScript + Capacitor 8 |
| **iOS Build** | ✅ Fertig | Xcode Projekt läuft auf iPhone 16 Pro |
| **Login/Auth** | ✅ Fertig | dot.gg API funktioniert, Token gespeichert |
| **UI-Flow** | ✅ Fertig | Welcome → Scan → Result → Save |
| **API-Integration** | ✅ Fertig | CapacitorHttp für native Requests |
| **Code** | ✅ Committed | Lokaler Commit d2e09c2, Push nötig |

---

## ❌ Bekannte Probleme

### 1. Kamera-Stream schwarz (KRITISCH)
**Problem:** Bei "Scan Card" bleibt das Kamera-Bild schwarz, nur grüne Overlays sichtbar

**Logs:**
```
Unable to find source 12345 for videoFrameAvailable
⚡️ [error] - Scan error: {}
```

**Ursache:** Capacitor Camera Plugin hat Probleme mit Video-Streams in iOS WebView

**Lösungsansätze:**
- A) `@capacitor-community/camera-preview` statt `@capacitor/camera`
- B) Native iOS Kamera-Implementierung mit AVFoundation
- C) Workaround mit `<input type="file" capture="environment">`
- D) `cordova-plugin-camera-preview` (älter aber stabiler)

**Empfohlener Fix:** Option A oder B

---

## 🎯 Nächste Schritte (Morgen)

1. **Kamera-Stream fixen** (1-2 Stunden)
   - Camera-Plugin wechseln oder native Implementierung
   - Test mit echter Karte

2. **OCR testen** (30 Min)
   - Tesseract.js läuft bereits
   - ROI-Cropping implementiert
   - Testen ob Text erkannt wird

3. **Card Matching validieren** (30 Min)
   - Fuzzy-Search funktioniert
   - Test mit echten Kartenbildern

4. **Save to Collection** (30 Min)
   - API-Call ist implementiert
   - Nur noch UI-Feedback testen

5. **Android Build** (1 Stunde)
   - `npx cap add android`
   - Android Studio Setup
   - Test auf Android-Gerät

---

## 📁 Wichtige Dateien

```
cardscanner/
├── v2/                          # React App
│   ├── src/
│   │   ├── components/          # Camera, CardResult, Auth
│   │   ├── hooks/               # useOCR, useCardMatching, useAuth
│   │   ├── api/dotgg.ts         # API Client mit CapacitorHttp
│   │   └── types.ts             # TypeScript Types
│   ├── ios/App/                 # iOS Projekt
│   │   └── App/Info.plist       # Berechtigungen (Kamera, Netzwerk)
│   └── package.json
├── archive/                     # Alter Code (Prototyp)
└── data/cards.json              # 744 Riftbound Karten
```

---

## 🔧 Technik-Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + TypeScript 5 |
| Build | Vite 7 |
| Mobile | Capacitor 8 |
| Camera | @capacitor/camera (TODO: fixen) |
| OCR | Tesseract.js v5 |
| HTTP | CapacitorHttp (native) |
| State | React Hooks |
| Storage | localStorage (iOS Keychain) |

---

## 📝 Learnings

1. **iOS WebView != Browser** - `fetch()` wird blockiert, `CapacitorHttp` nötig
2. **Info.plist** - Muss `NSCameraUsageDescription` und `NSAppTransportSecurity` enthalten
3. **Capacitor Camera** - Funktioniert nicht out-of-the-box für Video-Streams
4. **Xcode Signing** - Apple-ID im gleichen Account wie iPhone nötig

---

**Für:** @br1dge_eth  
**Nächster Termin:** Morgen früh (TUI oder Chat)
