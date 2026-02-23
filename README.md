# Poro Scope

iOS/Android card scanning app for Riftbound (by @br1dge_eth).

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite 7
- **Mobile**: Capacitor 8
- **OCR**: Apple Vision (native, via Capacitor plugin)
- **API**: dotgg.gg
- **Icons**: Lucide React

## Project Structure

```
cardscanner/
├── src/
│   ├── api/           # dotgg API client
│   ├── components/    # React components
│   ├── hooks/         # Custom hooks
│   └── types.ts       # TypeScript types
├── ios/               # iOS project (Xcode)
├── android/           # Android project (Android Studio)
├── public/            # Static assets
└── package.json
```

## Scripts

```bash
npm run dev       # Dev server
npm run build     # Production build
npm run ios       # Build + open Xcode
npm run android   # Build + open Android Studio
```

## iOS Development

```bash
npm install
npm run ios
```

In Xcode:
- Select your Team (Signing & Capabilities)
- Connect iPhone
- Build & Run

## Release Checklist

- [ ] Bump version in `package.json`
- [ ] Build: `npm run build`
- [ ] Sync: `npx cap sync ios`
- [ ] Archive in Xcode
- [ ] Upload to App Store Connect
- [ ] Submit for Review

## Notes

- Tesseract.js removed — now using native Apple Vision OCR
- Portrait lock enabled (iOS only)
- Camera via `@capacitor/camera` + native image picker
