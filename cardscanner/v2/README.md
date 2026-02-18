# Card Scanner v2

Mobile card scanning application built with Vite, React, TypeScript, and Capacitor.

## Quick Start

```bash
npm install
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Mobile Development

### iOS

```bash
npm run build
npx cap sync ios
npx cap open ios
```

### Android

```bash
npm run build
npx cap sync android
npx cap open android
```

## Project Structure

```
src/
├── api/
│   └── dotgg.ts          # DotGG API client
├── components/
│   ├── Auth.tsx          # Login/register component
│   ├── Camera.tsx        # Camera with ROI overlay
│   ├── CardResult.tsx    # Scan result display
│   └── MainApp.tsx       # Main app layout
├── hooks/
│   ├── useAuth.ts        # Authentication hook
│   ├── useCards.ts       # Card data hook
│   ├── useCardMatching.ts # Card matching algorithm
│   └── useOCR.ts         # Tesseract OCR hook
├── types.ts              # TypeScript types
└── App.tsx               # Root component
```

## Dependencies

- React 19
- TypeScript
- Vite
- Capacitor (iOS & Android)
- Tesseract.js (OCR)
- Lucide React (Icons)
