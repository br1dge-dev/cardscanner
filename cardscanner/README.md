# Card Scanner MVP v2

A mobile-first card scanning application built with Vite, React, TypeScript, and Capacitor.

## Features

- 📸 **Camera Scanning**: Real-time card scanning with ROI (Region of Interest) overlay
- 🔍 **OCR Recognition**: Tesseract.js-powered text recognition
- 🎯 **Smart Matching**: Fuzzy matching algorithm for card identification
- 👤 **User Authentication**: Login/Register via DotGG API
- 📚 **Collection Management**: Save scanned cards to your collection
- 📱 **Mobile Ready**: iOS and Android support via Capacitor

## Tech Stack

- **Frontend**: Vite + React 19 + TypeScript
- **Mobile**: Capacitor (iOS & Android)
- **OCR**: Tesseract.js
- **Styling**: CSS with CSS Variables
- **Icons**: Lucide React

## Project Structure

```
cardscanner/
├── archive/              # Old prototype code
├── data/
│   └── cards.json        # Card database (744 cards)
├── v2/                   # New React app
│   ├── src/
│   │   ├── api/          # API clients
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom hooks
│   │   └── types.ts      # TypeScript types
│   ├── ios/              # iOS project
│   ├── android/          # Android project
│   └── dist/             # Build output
└── README.md
```

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Xcode (for iOS)
- Android Studio (for Android)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/br1dge-dev/cardscanner.git
cd cardscanner/v2
```

2. Install dependencies:
```bash
npm install
```

3. Copy card data:
```bash
# cards.json is already in public/ directory
```

## Development

### Web Development

```bash
npm run dev
```

Open http://localhost:5173

### Build for Production

```bash
npm run build
```

### iOS Development

```bash
# Build web assets
npm run build

# Sync with iOS project
npx cap sync ios

# Open in Xcode
npx cap open ios
```

### Android Development

```bash
# Build web assets
npm run build

# Sync with Android project
npx cap sync android

# Open in Android Studio
npx cap open android
```

## Core Components

### Camera

- Fullscreen camera view with ROI overlay
- Two scan regions: Card Title (upper) and Card Number (lower)
- Real-time capture and processing

### OCR Processing

Uses Tesseract.js with custom ROI cropping:
- Title ROI: 15% from left/right, 8% from top, 12% height
- Number ROI: 10% from left/right, 82% from top, 10% height

### Card Matching

Fuzzy matching algorithm using Levenshtein distance:
- Number matching (normalized, exact then fuzzy)
- Name matching (contains and fuzzy)
- Confidence scoring (0-1)

### Authentication

Connects to DotGG API:
- Endpoint: `https://www.dotgg.gg/auth/email-auth-mobile.php`
- Token-based authentication
- Local storage persistence

## API Integration

### DotGG API

```typescript
// Get user data
GET https://www.dotgg.gg/api/getuserdata
Authorization: Bearer <token>

// Save collection
POST https://www.dotgg.gg/api/savecollection
Authorization: Bearer <token>
Body: { cards: CollectionCard[] }
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npx cap sync` | Sync web assets to native projects |
| `npx cap open ios` | Open iOS project in Xcode |
| `npx cap open android` | Open Android project in Android Studio |

## Environment Variables

No environment variables required for basic setup.

## Troubleshooting

### Camera not working
- Check browser permissions
- Use HTTPS or localhost for Camera API
- On mobile, ensure camera permissions are granted

### OCR accuracy issues
- Ensure good lighting
- Keep card within ROI guides
- Hold steady while capturing

### Build issues
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Update Capacitor: `npx cap sync`

## License

MIT
