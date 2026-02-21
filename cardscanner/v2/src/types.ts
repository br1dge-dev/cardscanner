/**
 * Card type definitions
 */

export type Game = 'riftbound' | 'lorcana' | 'magic' | 'pokemon' | 'yugioh' | 'onepiece';

export interface Card {
  id: string;           // Card ID like "OGN-001"
  name: string;         // Card name
  number: string;       // Card number (same as id)
  slug?: string;        // URL slug
  set?: string;         // Set code (OGN, SFD, OGS)
  set_name?: string;    // Full set name
  set_code?: string;    // Alternative set code field
  setName?: string;     // Alternative set name field
  rarity?: string;
  image?: string;       // Card image URL
  imageUrl?: string;    // Normalized image URL
  type?: string;        // Card type (Spell, Unit, etc.)
  card_type?: string;   // Alternative type field
  color?: string | string[];
  cost?: string;
  might?: string | null;
  power?: string;
  life?: string;
  tags?: string[] | null;
  attributes?: string[];
  effect?: string;
  flavor?: string;      // Flavor text
  cycle?: string | null;
  promo?: string;
  // Prices - DotGG marketplace
  price?: number;
  foilPrice?: number;
  deltaPrice?: number;
  delta7dPrice?: number;
  deltaFoilPrice?: number;
  delta7dPriceFoil?: number;
  // Prices - Cardmarket
  cmPrice?: number;
  cmFoilPrice?: number;
  cmDeltaPrice?: number;
  cmDelta7dPrice?: number;
  cmDeltaFoilPrice?: number;
  cmDelta7dPriceFoil?: number;
  cmurl?: string;       // Cardmarket listing URL
  cmid?: string;        // Cardmarket product ID
  // Availability
  hasNormal?: boolean | string;
  hasFoil?: boolean | string;
  marketIds?: string;
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
