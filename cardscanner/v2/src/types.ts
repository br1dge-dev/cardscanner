/**
 * Card type definitions
 */

export interface Card {
  id: string;           // Card ID like "001-001"
  name: string;         // Card name
  number: string;       // Card number (same as id)
  set: string;          // Set code (OGN, SFD, OGS)
  setName?: string;     // Full set name
  set_code?: string;    // Alternative set code field
  set_name?: string;    // Alternative set name field
  rarity?: string;
  image?: string;       // Card image URL
  imageUrl?: string;    // Alternative image field
  type?: string;        // Card type (Spell, Unit, etc.)
  card_type?: string;   // Alternative type field
  color?: string;
  cost?: string;
  power?: string;
  life?: string;
  attributes?: string[];
  effect?: string;
  flavor?: string;      // Flavor text
  trigger?: string;
  counter?: string;
  price?: number;       // Card price if available
}

export interface CardMatch {
  card: Card;
  confidence: number;
  matchedBy: 'name' | 'number' | 'both';
}

export interface ROIMetadata {
  name: string;
  number: string;
  confidence: number;
}

export interface ScanResult {
  matches: CardMatch[];
  bestMatch: CardMatch | null;
  rawOCR: ROIMetadata;
}

export interface User {
  id: string;
  email: string;
  username: string;
  token: string;
}

export interface CollectionCard {
  cardId: string;
  quantity: number;
  condition?: string;
  language?: string;
  trade?: number;
  wish?: number;
}
