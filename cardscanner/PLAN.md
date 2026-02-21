# Card Scanner – Projektstand & Roadmap

**Datum:** 2026-02-21  
**Status:** 🟢 Funktioniert auf Device – OCR + Matching + Save getestet  
**Repo:** https://github.com/br1dge-dev/cardscanner  
**Basis:** `cardscanner/v2/`

---

## ✅ Erledigt

### Phase 1-3: Cleanup, Native OCR, UI Redesign (20.02.)
- [x] Alte Codebasen gelöscht, `v2/` als einzige Codebasis
- [x] NativeOCRPlugin.swift – Apple Vision `VNRecognizeTextRequest` (.accurate)
- [x] TypeScript Plugin API + useNativeOCR Hook
- [x] Dark Navy + Gold UI Redesign mit Mockups

### Phase 4: Daten & Logik (20.02.)
- [x] cards.json mit 744 echten Karten (IDs, Image-URLs, Preise)
- [x] Smarte Foil-Logik aus API

### Phase 5: Device-Test & Bugfixes (21.02.)
- [x] **NativeOCRPlugin in Xcode-Projekt registriert** (war nicht im pbxproj!)
- [x] **MyViewController.swift** für Plugin-Registrierung via `capacitorDidLoad()`
- [x] **NativeOCRPlugin.m gelöscht** (Capacitor 8 braucht kein ObjC-Bridge)
- [x] **Main.storyboard** auf MyViewController umgestellt
- [x] **Stale Closure Bug gefixt** – `handleDirectCameraCapture` hatte `[]` Dependencies, `findMatches` lief gegen leeres cards-Array
- [x] **cards.json ersetzt** – 777 leere Einträge → 744 echte Karten mit IDs
- [x] **viewport-fit=cover** für iOS Safe Area
- [x] **Header-Padding** für Notch/Dynamic Island
- [x] **OCR-Diagnostics** bei Fehlschlag (Raw Text, Confidence, Thumbnail)
- [x] **Collection-Count** zählt jetzt Foils mit + zeigt Unique-Count
- [x] **Erster erfolgreicher Scan:** OGN-117 → Viktor - Innovator ✅

---

## 🟡 Nächste Schritte (priorisiert)

### #1: 🔴 Image-Matching als OCR-Fallback
**Impact:** Sehr hoch – macht App robust bei schlechtem Licht, Foil-Reflexionen  
**Aufwand:** ~2-3h  
**Ansatz:** Perceptual Hashing (pHash) der 744 Kartenbilder → Vergleich gegen Kamera-Foto

### #2: 🟠 Collection View (echtes Grid)
**Impact:** Hoch – aktuell nur Placeholder ("1016 cards total")  
**Aufwand:** ~1h  
**Ansatz:** API `getUserData` → Grid mit Kartenbildern, Foil-Marker, Filter

### #3: 🟡 Batch-Scan Modus
**Impact:** Hoch für Power-User  
**Aufwand:** ~1h  
**Ansatz:** Scan → Auto-Save → sofort nächste Kamera → kein Result-Modal

### #4: 🟡 Custom Kamera-Overlay
**Impact:** Mittel – schönere UX  
**Aufwand:** ~2h (+ Rattenschwanz: Autofokus, Belichtung, Zoom)

### #5: 🟢 UI Polish
**Impact:** Mittel – Mockups sahen schicker aus als die echte App  
**Aufwand:** ~1h  
**Details:** Spacing, Fonts, Animationen an Mockup-Qualität anpassen

### #6: 🟢 Tesseract.js entfernen
**Impact:** Niedrig (Cleanup)  
**Aufwand:** 5min  

### #7: 🟢 Android Plugin
**Aufwand:** ~2h  
**Ansatz:** NativeOCRPlugin.kt mit Google ML Kit

---

## Architektur-Entscheidungen

| Entscheidung | Begründung |
|-------------|-----------|
| Apple Vision statt ML Kit (iOS) | Capacitor 8 SPM + CocoaPods = inkompatibel. Vision ist built-in. |
| MyViewController statt AppDelegate | Saubere Plugin-Registrierung via `capacitorDidLoad()` |
| Kein ObjC-Bridge (.m) | Capacitor 8 nutzt `CAPBridgedPlugin` Protocol, `.m` ist veraltet |
| cards.json lokal | Schnelleres Matching, Offline-fähig |

---

## Tech-Stack

| Komponente | Technologie |
|------------|-------------|
| Frontend | React 19 + TypeScript + Vite |
| Mobile | Capacitor 8 (SPM) |
| OCR (iOS) | Apple Vision Framework (VNRecognizeTextRequest) |
| API | DotGG REST API |
| Styling | Custom CSS, Dark Gold Theme |

---

## Dateistruktur

```
cardscanner/v2/
├── src/
│   ├── components/
│   │   ├── Auth.tsx/.css
│   │   ├── MainApp.tsx/.css     # Scanner + Main View
│   │   ├── CardResult.tsx/.css  # Result Bottom-Sheet
│   │   ├── Camera.tsx/.css
│   │   └── Menu.tsx/.css
│   ├── hooks/
│   │   ├── useNativeOCR.ts      # Apple Vision OCR
│   │   ├── useOCR.ts            # Tesseract (deprecated)
│   │   ├── useCardMatching.ts   # Fuzzy + Exact Matching
│   │   ├── useCards.ts          # Card Database
│   │   └── useAuth.ts
│   ├── plugins/native-ocr/definitions.ts
│   ├── api/dotgg.ts
│   └── types.ts
├── ios/App/App/
│   ├── NativeOCRPlugin.swift    # Apple Vision Plugin
│   ├── MyViewController.swift   # Plugin-Registrierung
│   └── AppDelegate.swift
├── public/cards.json            # 744 Karten (mit IDs, Images, Preise)
├── data/cards.json              # Quelldaten
└── PLAN.md
```

## Learnings (21.02.)

1. **Xcode-Projekt prüfen!** Dateien im Dateisystem ≠ im Build. Immer pbxproj verifizieren.
2. **Capacitor 8 Plugin-Registrierung:** `CAPBridgedPlugin` + `MyViewController.capacitorDidLoad()` – kein ObjC nötig.
3. **React useCallback Closures:** Leere Dependency-Arrays = Zeitbombe. Immer alle genutzten Werte listen.
4. **DerivedData cleanen** bei SPM-XCFramework-Problemen.
5. **`viewport-fit=cover`** ist Pflicht für iOS Safe Area.
