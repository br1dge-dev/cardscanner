# Card Scanner – Native OCR Migration Plan

**Datum:** 2026-02-20
**Status:** 🟡 In Arbeit
**Basis:** `cardscanner/v2/` (funktionsfähig, 1016+ Karten gescannt)

---

## Ziel

Tesseract.js (WASM, langsam, ~70% Accuracy) ersetzen durch native OCR:
- **iOS:** Apple Vision Framework (`VNRecognizeTextRequest`)
- **Android:** Google ML Kit Text Recognition (via Gradle)

## Warum nicht Google ML Kit auf iOS?

Capacitor 8 nutzt SPM. ML Kit braucht CocoaPods. Beides zusammen → Linker-Fehler.
Apple Vision ist gleichwertig/besser für lateinische Schrift und braucht null externe Dependencies.

---

## Phasen

### Phase 1: Cleanup ✅
- [x] `card-scanner/` gelöscht (alter Zwischenstand)
- [x] `projects/card-scanner/` gelöscht (gescheiterter ML Kit Versuch)
- [ ] GitHub repo aufräumen (nur `v2/` als Hauptcode)
- [ ] Unnötige Dateien entfernen (`archive/`, `data/` prüfen)

### Phase 2: Native OCR Plugin erstellen
- [ ] Capacitor Local Plugin Struktur anlegen
- [ ] **iOS Plugin** (`NativeOCRPlugin.swift`):
  - `VNRecognizeTextRequest` mit `.accurate` Modus
  - Base64 Image → erkannter Text zurückgeben
  - Confidence Score pro Textblock
- [ ] **Android Plugin** (`NativeOCRPlugin.kt`):
  - ML Kit `TextRecognition` via Gradle dependency
  - Gleiche API wie iOS Plugin
- [ ] TypeScript Definitions (`definitions.ts`)
- [ ] Hook: `useNativeOCR.ts` (ersetzt `useOCR.ts`)

### Phase 3: Integration
- [ ] `useOCR.ts` (Tesseract) durch `useNativeOCR.ts` ersetzen
- [ ] Tesseract.js dependency entfernen
- [ ] `eng.traineddata` entfernen
- [ ] Card-Number/Title Extraction Logik anpassen (native OCR liefert saubereren Text)
- [ ] Camera Component prüfen (evtl. Live-Preview möglich mit nativem Plugin)

### Phase 4: Test & Build
- [ ] iOS Build auf iPhone testen
- [ ] OCR Accuracy mit echten Karten validieren
- [ ] Android Build erstellen & testen
- [ ] Edge Cases: schlechtes Licht, schräge Karten, Foils

### Phase 5: Polish
- [ ] Error Handling für fehlende Kamera-Permissions
- [ ] Loading States optimieren
- [ ] GitHub Push mit sauberem History

---

## Repo-Struktur (Ziel)

```
cardscanner/
├── src/
│   ├── components/          # Camera, CardResult, Auth, Menu, etc.
│   ├── hooks/               # useNativeOCR, useCardMatching, useAuth, useCards
│   ├── api/dotgg.ts         # DotGG API Client
│   ├── plugins/
│   │   └── native-ocr/
│   │       └── definitions.ts
│   └── types.ts
├── ios/App/
│   └── App/
│       └── NativeOCRPlugin.swift
├── android/app/
│   └── src/main/java/.../
│       └── NativeOCRPlugin.kt
├── data/cards.json          # Kartendatenbank
├── capacitor.config.ts
├── package.json
├── PLAN.md
└── README.md
```

---

## Technische Details

### iOS – Apple Vision

```swift
import Vision

func recognizeText(image: UIImage) -> [(String, Float)] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-US"]
    // ...handler returns recognized text + confidence
}
```

### Android – ML Kit

```kotlin
val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
recognizer.process(inputImage)
    .addOnSuccessListener { result ->
        // result.textBlocks → text + confidence
    }
```

### Capacitor Plugin API

```typescript
interface NativeOCRPlugin {
  recognizeText(options: { 
    base64: string 
  }): Promise<{
    text: string;
    blocks: Array<{
      text: string;
      confidence: number;
      boundingBox: { x: number; y: number; width: number; height: number };
    }>;
  }>;
}
```

---

## Risiken

| Risiko | Mitigation |
|--------|-----------|
| Apple Vision Accuracy unzureichend | `.accurate` Modus + Preprocessing |
| Android Build Probleme | Gradle ML Kit ist gut dokumentiert |
| Card Matching muss angepasst werden | Regex-Logik bleibt gleich, Input wird sauberer |

---

**Nächster Schritt:** Phase 2 – Native OCR Plugin erstellen
