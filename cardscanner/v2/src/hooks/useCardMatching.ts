/**
 * useCardMatching Hook - Matches OCR results to card database
 */
import { useState, useCallback } from 'react';
import type { Card, CardMatch, ScanResult, ROIMetadata } from '../types';

interface MatchingOptions {
  minConfidence?: number;
  maxResults?: number;
  fuzzyThreshold?: number;
}

// Calculate Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Calculate similarity score (0-1)
function similarityScore(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLength;
}

// Normalize card number for comparison
function normalizeNumber(number: string): string {
  return number.toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9\-]/g, '');
}

export function useCardMatching(cards: Card[], options: MatchingOptions = {}) {
  const { minConfidence = 0.6, maxResults = 5, fuzzyThreshold = 0.7 } = options;
  const [isMatching, setIsMatching] = useState(false);

  const matchByNumber = useCallback((number: string): CardMatch | null => {
    const normalizedNumber = normalizeNumber(number);
    if (!normalizedNumber) return null;

    // Exact match
    const exactMatch = cards.find(c => 
      normalizeNumber(c.number) === normalizedNumber
    );
    if (exactMatch) {
      return {
        card: exactMatch,
        confidence: 1,
        matchedBy: 'number'
      };
    }

    // Fuzzy match on number
    let bestMatch: CardMatch | null = null;
    let bestScore = 0;

    for (const card of cards) {
      const cardNumber = normalizeNumber(card.number);
      const score = similarityScore(normalizedNumber, cardNumber);
      
      if (score > bestScore && score >= fuzzyThreshold) {
        bestScore = score;
        bestMatch = {
          card,
          confidence: score,
          matchedBy: 'number'
        };
      }
    }

    return bestMatch;
  }, [cards, fuzzyThreshold]);

  const matchByName = useCallback((name: string): CardMatch[] => {
    const normalizedName = name.toLowerCase().trim();
    if (!normalizedName || normalizedName.length < 2) return [];

    const matches: CardMatch[] = [];

    for (const card of cards) {
      const cardName = card.name.toLowerCase().trim();
      
      // Exact match
      if (cardName === normalizedName) {
        matches.push({
          card,
          confidence: 1,
          matchedBy: 'name'
        });
        continue;
      }

      // Contains match
      if (cardName.includes(normalizedName) || normalizedName.includes(cardName)) {
        const score = similarityScore(normalizedName, cardName);
        if (score >= minConfidence) {
          matches.push({
            card,
            confidence: score,
            matchedBy: 'name'
          });
        }
        continue;
      }

      // Fuzzy match
      const score = similarityScore(normalizedName, cardName);
      if (score >= fuzzyThreshold) {
        matches.push({
          card,
          confidence: score,
          matchedBy: 'name'
        });
      }
    }

    // Sort by confidence descending
    return matches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxResults);
  }, [cards, minConfidence, maxResults, fuzzyThreshold]);

  const findMatches = useCallback(async (ocrData: ROIMetadata): Promise<ScanResult> => {
    setIsMatching(true);

    try {
      const matches: CardMatch[] = [];
      let bestMatch: CardMatch | null = null;

      // Try matching by number first (more reliable)
      const numberMatch = matchByNumber(ocrData.number);
      if (numberMatch) {
        matches.push(numberMatch);
        bestMatch = numberMatch;
      }

      // Also try matching by name
      const nameMatches = matchByName(ocrData.name);
      
      // Merge matches, avoiding duplicates
      for (const nameMatch of nameMatches) {
        const existingIndex = matches.findIndex(m => m.card.id === nameMatch.card.id);
        if (existingIndex >= 0) {
          // Update existing match if this one has higher confidence
          if (nameMatch.confidence > matches[existingIndex].confidence) {
            matches[existingIndex] = {
              ...nameMatch,
              matchedBy: 'both'
            };
          }
        } else {
          matches.push(nameMatch);
        }
      }

      // Sort and limit results
      const sortedMatches = matches
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxResults);

      // Determine best match
      if (!bestMatch && sortedMatches.length > 0) {
        bestMatch = sortedMatches[0];
      }

      return {
        matches: sortedMatches,
        bestMatch,
        rawOCR: ocrData
      };
    } finally {
      setIsMatching(false);
    }
  }, [matchByNumber, matchByName, maxResults]);

  return {
    findMatches,
    matchByNumber,
    matchByName,
    isMatching
  };
}
