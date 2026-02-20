# Card Scanner – Projektstand & Roadmap

**Datum:** 2026-02-20  
**Status:** 🟢 Build-ready, wartet auf Device-Test  
**Repo:** https://github.com/br1dge-dev/cardscanner  
**Basis:** `cardscanner/v2/`

---

## ✅ Erledigt (20.02.2026)

### Phase 1: Cleanup
- [x] `card-scanner/` gelöscht (alter Zwischenstand)
- [x] `projects/card-scanner/` gelöscht (Kimis gescheiterter ML Kit/CocoaPods Versuch)
- [x] `cardscanner/v2/` als einzige Codebasis

### Phase 2: Native OCR Plugin (iOS)
- [x] `NativeOCRPlugin.swift` – Apple Vision `VNRecognizeTextRequest` (.accurate)
- [x] `NativeOCRPlugin.m` – ObjC Bridge für Capacitor
- [x] `src/plugins/native-ocr/definitions.ts` – TypeScript API
- [x] `src/hooks/useNativeOCR.ts` – Drop-in Replacement für Tesseract-basiertes useOCR
- [x] MainApp.tsx auf useNativeOCR umgestellt
- [x] TypeScript ✅ Vite ✅ Xcode iOS Build ✅

### Phase 3: UI Redesign
- [x] Neues Farbschema: Dark Navy (#0a0e1a) + Gold (#c9a84c)
- [x] Login-Screen mit Hero-Image & TCG-Branding
- [x] Scanner-View mit Gold-Ecken-Frame (Idle-State)
- [x] CardResult als Bottom-Sheet mit großem Kartenbild
- [x] Rarity-Farben: Common/Uncommon/Rare/Epic/Showcase/Promo
- [x] Menu mit farbigen Icons & Glassmorphism
- [x] Mockups generiert (mockups/final-*.png)

### Phase 4: Daten & Logik
- [x] cards.json aktualisiert: 777 Karten mit vollen API-Daten
- [x] Smarte Foil-Logik: `hasFoil`/`hasNormal` aus API statt Rarity-Guess
- [x] Foil-Only Karten automatisch als Foil markiert
- [x] Preise (normal + foil) aus API

---

## 🔴 Nächster Schritt: Device-Test (braucht Mac)

```bash
cd ~/.openclaw/workspace/cardscanner/v2
npx cap open ios
# → Xcode: Team setzen → iPhone auswählen → ▶ Run
```

**Was zu testen:**
1. Login funktioniert?
2. Kamera öffnet sich?
3. OCR erkennt Kartennummer/-name?
4. Card Matching findet die richtige Karte?
5. Save to Collection funktioniert?

---

## 🟡 Offene High-Impact Features (priorisiert)

### #1: 🔴 Image-Matching als OCR-Fallback
**Impact:** Sehr hoch – macht App robust bei schlechtem Licht, Foil-Reflexionen, schrägen Karten  
**Aufwand:** ~2-3h  
**Ansatz:** Perceptual Hashing (pHash) der 777 Kartenbilder, Vergleich gegen Kamera-Foto  
**Flow:** OCR versucht Kartennummer → Falls kein Match → Image-Hash-Vergleich → Bestätigung

### #2: 🟠 Collection View (echtes Grid)
**Impact:** Hoch – aktuell nur Placeholder ("147 cards")  
**Aufwand:** ~1h  
**Ansatz:** API `getUserData` → Grid mit Kartenbildern, Foil-Marker, Filter-Chips (wie Mockup)

### #3: 🟡 Batch-Scan Modus
**Impact:** Hoch für Power-User (100+ Karten scannen)  
**Aufwand:** ~1h  
**Ansatz:** Scan → Auto-Save → sofort nächste Kamera → kein Result-Modal dazwischen

### #4: 🟡 Custom Kamera-Overlay
**Impact:** Mittel – schönere UX, aber native Kamera funktioniert  
**Aufwand:** ~2h  
**Status:** Aktuell nutzen wir `CapacitorCamera.getPhoto()` (native iOS Kamera, kein Overlay).  
Gold-Ecken aus dem Mockup erscheinen nur im Idle-Screen vor dem Scan.  
Für ein Live-Overlay bräuchten wir einen Custom Camera Stream.

### #5: 🟢 Android Plugin
**Impact:** Mittel (erweitert Zielgruppe)  
**Aufwand:** ~2h  
**Ansatz:** `NativeOCRPlugin.kt` mit Google ML Kit via Gradle (kein CocoaPods-Problem)

### #6: 🟢 Tesseract.js entfernen
**Impact:** Niedrig (Cleanup)  
**Aufwand:** 5min  
**Wann:** Nach erfolgreichem Device-Test der nativen OCR

---

## Architektur-Entscheidungen

| Entscheidung | Begründung |
|-------------|-----------|
| Apple Vision statt ML Kit (iOS) | Capacitor 8 SPM + CocoaPods = inkompatibel. Vision ist built-in, keine Dependencies. |
| ML Kit für Android (geplant) | Via Gradle, kein CocoaPods-Konflikt auf Android |
| Native Kamera statt Custom Stream | Einfacher, zuverlässiger. Custom Overlay = separates Feature. |
| cards.json lokal statt API-Live | Schnelleres Matching, Offline-fähig. Refresh bei App-Start möglich. |
| hasFoil/hasNormal aus API | Deutlich genauer als Rarity-basierter Guess |

---

## Tech-Stack

| Komponente | Technologie |
|------------|-------------|
| Frontend | React 19 + TypeScript + Vite |
| Mobile | Capacitor 8 |
| OCR (iOS) | Apple Vision Framework (VNRecognizeTextRequest) |
| OCR (Android) | Google ML Kit (geplant) |
| API | DotGG REST API (Auth, Collection, Cards) |
| Auth | Email/Password → DotGGUser + Token |
| Styling | Custom CSS, Dark Gold Theme |

---

## Dateistruktur

```
cardscanner/v2/
├── src/
│   ├── components/
│   │   ├── Auth.tsx/.css        # Login Screen
│   │   ├── MainApp.tsx/.css     # Scanner + Main View
│   │   ├── CardResult.tsx/.css  # Result Modal
│   │   ├── Camera.tsx/.css      # Camera Component
│   │   └── Menu.tsx/.css        # Slide-out Menu
│   ├── hooks/
│   │   ├── useNativeOCR.ts      # Apple Vision OCR ← NEU
│   │   ├── useOCR.ts            # Tesseract (deprecated, noch nicht entfernt)
│   │   ├── useCardMatching.ts   # Fuzzy Matching
│   │   ├── useCards.ts          # Card Database
│   │   ├── useAuth.ts           # DotGG Auth
│   │   └── index.ts
│   ├── plugins/
│   │   └── native-ocr/
│   │       └── definitions.ts   # Plugin TypeScript API
│   ├── api/dotgg.ts             # DotGG API Client
│   └── types.ts
├── ios/App/App/
│   ├── NativeOCRPlugin.swift    # Apple Vision Plugin ← NEU
│   └── NativeOCRPlugin.m        # ObjC Bridge ← NEU
├── public/cards.json            # 777 Karten (voll, mit Rarity/Foil/Preise)
├── mockups/                     # UI Mockups (PNG)
├── PLAN.md                      # ← Diese Datei
└── package.json
```
