/**
 * useCards Hook - Loads and provides access to card data
 */
import { useState, useEffect, useCallback } from 'react';
import type { Card } from '../types';

export function useCards() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCards = async () => {
      try {
        setLoading(true);
        const response = await fetch('/cards.json');
        if (!response.ok) {
          throw new Error(`Failed to load cards: ${response.status}`);
        }
        const data = await response.json();
        
        // Handle both array and object with cards property
        const cardsArray = Array.isArray(data) ? data : data.cards || [];
        setCards(cardsArray);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cards');
        console.error('Error loading cards:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCards();
  }, []);

  const getCardByNumber = useCallback((number: string): Card | undefined => {
    const normalizedNumber = number.toUpperCase().replace(/\s+/g, '');
    return cards.find(c => 
      c.number.toUpperCase().replace(/\s+/g, '') === normalizedNumber
    );
  }, [cards]);

  const getCardsByName = useCallback((name: string): Card[] => {
    const normalizedName = name.toLowerCase().trim();
    return cards.filter(c => 
      c.name.toLowerCase().includes(normalizedName)
    );
  }, [cards]);

  const searchCards = useCallback((query: string): Card[] => {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return [];
    
    return cards.filter(c => 
      c.name.toLowerCase().includes(normalizedQuery) ||
      c.number.toLowerCase().includes(normalizedQuery) ||
      c.set.toLowerCase().includes(normalizedQuery)
    ).slice(0, 20); // Limit results
  }, [cards]);

  return {
    cards,
    loading,
    error,
    totalCards: cards.length,
    getCardByNumber,
    getCardsByName,
    searchCards
  };
}
