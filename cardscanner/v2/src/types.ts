/**
 * Card type definitions
 */

export interface Card {
  id: string;
  name: string;
  number: string;
  set: string;
  setName?: string;
  rarity?: string;
  imageUrl?: string;
  type?: string;
  color?: string;
  cost?: string;
  power?: string;
  life?: string;
  attributes?: string[];
  effect?: string;
  trigger?: string;
  counter?: string;
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
}
