/**
 * useCards Hook - Load and manage card database
 */
import { useState, useEffect, useCallback } from 'react';
import type { Card } from '../types';

// Path to the cards JSON file
const CARDS_URL = '/cards.json';

export function useCards() {
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(CARDS_URL);
      
      if (!response.ok) {
        throw new Error(`Failed to load cards: ${response.status}`);
      }

      const data: Card[] = await response.json();
      
      // Normalize card data for consistent access
      const normalizedCards = data.map(card => ({
        ...card,
        // Ensure we have both id and number
        number: card.number || card.id,
        // Ensure we have set_code/setName variants
        set_code: card.set_code || card.set,
        set_name: card.set_name || card.setName,
        // Ensure we have imageUrl/image variants  
        imageUrl: card.imageUrl || card.image,
        // Ensure we have card_type/type variants
        card_type: card.card_type || card.type
      }));
      
      setCards(normalizedCards);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load cards';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load cards on mount
  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Get card by ID
  const getCardById = useCallback((id: string): Card | undefined => {
    return cards.find(card => card.id === id);
  }, [cards]);

  // Get cards by set
  const getCardsBySet = useCallback((setCode: string): Card[] => {
    return cards.filter(card => 
      card.set === setCode || card.set_code === setCode
    );
  }, [cards]);

  // Search cards by name
  const searchCardsByName = useCallback((query: string): Card[] => {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return [];
    
    return cards.filter(card => 
      card.name.toLowerCase().includes(normalizedQuery)
    );
  }, [cards]);

  return {
    cards,
    isLoading,
    error,
    reload: loadCards,
    getCardById,
    getCardsBySet,
    searchCardsByName,
    totalCards: cards.length
  };
}
