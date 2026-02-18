# Card Scanner Architecture

## Overview

Card Scanner is a mobile-first Progressive Web App (PWA) built with modern web technologies and wrapped as a native mobile app using Capacitor.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Auth      │  │    Camera    │  │ Card Result  │      │
│  │   Component  │  │  Component   │  │  Component   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Custom Hooks                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   useAuth    │  │    useOCR    │  │ useCardMatch │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐                                           │
│  │   useCards   │                                           │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   External Services                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Tesseract   │  │   DotGG API  │  │ LocalStorage │      │
│  │     .js      │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Core
- **Vite**: Build tool and dev server
- **React 19**: UI framework
- **TypeScript**: Type safety
- **Capacitor**: Native mobile wrapper

### OCR
- **Tesseract.js**: Client-side OCR engine
- **Language**: English (eng)
- **Mode**: Single character recognition with ROI

### API
- **DotGG API**: User authentication and collection management
- **Endpoints**:
  - `POST /auth/email-auth-mobile.php` - Login/Register
  - `GET /api/getuserdata` - Get user collection
  - `POST /api/savecollection` - Save collection

## Data Flow

### Scanning Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Camera  │────▶│  Canvas  │────▶│   OCR    │────▶│  Crop    │
│ Capture  │     │  Draw    │     │          │     │  ROIs    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                                        │
┌──────────┐     ┌──────────┐     ┌──────────┐         │
│  Show    │◀────│  Match   │◀────│  Parse   │◀────────┘
│  Result  │     │   Card   │     │   Text   │
└──────────┘     └──────────┘     └──────────┘
```

### Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│   Login  │────▶│  DotGG   │────▶│  Store   │────▶│   App    │
│  Form    │     │   API    │     │  Token   │     │  Ready   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

### Collection Save Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Card    │────▶│   API    │────▶│  Server  │────▶│  Success │
│  Found   │     │  Client  │     │  Save    │     │  Confirm │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

## Component Details

### Camera Component

**Responsibilities:**
- Access device camera via getUserMedia
- Display live video feed
- Render ROI overlay (2 regions)
- Capture still image

**ROI Configuration:**
```typescript
// Title Region - upper middle
{ x: 0.15, y: 0.08, width: 0.70, height: 0.12 }

// Number Region - bottom
{ x: 0.10, y: 0.82, width: 0.80, height: 0.10 }
```

### OCR Hook

**Responsibilities:**
- Initialize Tesseract worker
- Crop image to ROIs
- Perform text recognition
- Clean and normalize output

**Output Format:**
```typescript
interface ROIMetadata {
  name: string;      // Card title
  number: string;    // Card number
  confidence: number; // OCR confidence (0-100)
}
```

### Card Matching Hook

**Responsibilities:**
- Match OCR results to card database
- Calculate similarity scores
- Rank matches by confidence

**Matching Strategy:**
1. Exact number match (normalized)
2. Fuzzy number match (Levenshtein)
3. Name contains match
4. Fuzzy name match

**Similarity Algorithm:**
```typescript
score = 1 - (levenshteinDistance / maxLength)
```

### Auth Hook

**Responsibilities:**
- Manage login/register flows
- Store/retrieve auth token
- Handle session persistence

**Storage:**
- Key: `cardscanner_user`
- Value: JSON serialized User object

## API Client

### DotGGClient

```typescript
class DotGGClient {
  async getUserData(user: User): Promise<UserData>
  async saveCollection(user: User, cards: CollectionCard[]): Promise<SaveResult>
  async addCardToCollection(user: User, cardId: string, quantity: number): Promise<SaveResult>
  async syncCollection(user: User, localCards: CollectionCard[]): Promise<SyncResult>
}
```

## Type Definitions

### Core Types

```typescript
interface Card {
  id: string;
  name: string;
  number: string;
  set: string;
  rarity?: string;
  imageUrl?: string;
  // ... other fields
}

interface CardMatch {
  card: Card;
  confidence: number;
  matchedBy: 'name' | 'number' | 'both';
}

interface User {
  id: string;
  email: string;
  username: string;
  token: string;
}

interface CollectionCard {
  cardId: string;
  quantity: number;
  condition?: string;
  language?: string;
}
```

## Mobile Integration

### Capacitor Configuration

```typescript
// capacitor.config.ts
{
  appId: 'com.cardscanner.app',
  appName: 'CardScanner',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
}
```

### iOS Setup
- Bundle ID: `com.cardscanner.app`
- Camera permission in Info.plist
- Portrait orientation only

### Android Setup
- Package: `com.cardscanner.app`
- Camera permission in AndroidManifest.xml
- API Level 22+ (Android 5.1+)

## Performance Considerations

### OCR Optimization
- ROI cropping reduces processing area
- Single language model (eng)
- Worker termination on unmount

### Card Database
- Loaded once at startup
- Indexed by number for O(1) lookup
- Array for fuzzy matching iteration

### Image Processing
- Canvas-based cropping
- JPEG compression (0.9 quality)
- Base64 encoding for transport

## Security

- Token stored in localStorage (device only)
- HTTPS for all API calls
- No sensitive data in URLs
- Token sent in Authorization header

## Future Enhancements

Potential improvements:
- [ ] Multiple card batch scanning
- [ ] Offline mode with sync
- [ ] Card image caching
- [ ] Advanced search filters
- [ ] Collection statistics
- [ ] Export/import functionality
