/**
 * useCards Hook - Load and manage card database
 *
 * Two-phase loading:
 * 1. Immediately load bundled cards.json (fast, works offline)
 * 2. In background, fetch fresh prices from DotGG API and merge silently
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Card } from '../types';

const CARDS_URL = '/cards.json';
const DOTGG_API_URL = 'https://api.dotgg.gg/cgfw/getcards?game=riftbound';

// Price fields we refresh from the API
type PriceFields = Pick<Card,
  'price' | 'foilPrice' | 'deltaPrice' | 'deltaFoilPrice' | 'delta7dPrice' | 'delta7dPriceFoil' |
  'cmPrice' | 'cmFoilPrice' | 'cmDeltaPrice' | 'cmDelta7dPrice' | 'cmDeltaFoilPrice' | 'cmDelta7dPriceFoil'
>;

function normalizeCard(card: Card): Card {
  return {
    ...card,
    number: card.number || card.id,
    set_code: card.set_code || card.set,
    set_name: card.set_name || card.setName,
    imageUrl: card.imageUrl || card.image,
    card_type: card.card_type || card.type,
  };
}

function extractPrices(raw: Record<string, unknown>): PriceFields {
  const f = (v: unknown) => (v !== undefined && v !== null ? parseFloat(String(v)) || 0 : undefined);
  return {
    price:              f(raw.price),
    foilPrice:          f(raw.foilPrice),
    deltaPrice:         f(raw.deltaPrice),
    deltaFoilPrice:     f(raw.deltaFoilPrice),
    delta7dPrice:       f(raw.delta7dPrice),
    delta7dPriceFoil:   f(raw.delta7dPriceFoil),
    cmPrice:            f(raw.cmPrice),
    cmFoilPrice:        f(raw.cmFoilPrice),
    cmDeltaPrice:       f(raw.cmDeltaPrice),
    cmDelta7dPrice:     f(raw.cmDelta7dPrice),
    cmDeltaFoilPrice:   f(raw.cmDeltaFoilPrice),
    cmDelta7dPriceFoil: f(raw.cmDelta7dPriceFoil),
  };
}

export function useCards() {
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pricesRefreshed, setPricesRefreshed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadCards = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setPricesRefreshed(false);

    // Cancel any in-flight price refresh
    abortRef.current?.abort();

    try {
      // ── Phase 1: Load bundled cards.json immediately ──────────────────────
      const response = await fetch(CARDS_URL);
      if (!response.ok) throw new Error(`Failed to load cards: ${response.status}`);

      const data: Card[] = await response.json();
      const normalizedCards = data.map(normalizeCard);

      console.log(`[useCards] Phase 1: loaded ${normalizedCards.length} cards from bundle`);
      setCards(normalizedCards);
      setIsLoading(false); // Loading screen done — app is usable now

      // ── Phase 2: Refresh prices from API in background ───────────────────
      const ac = new AbortController();
      abortRef.current = ac;

      fetch(DOTGG_API_URL, { signal: ac.signal })
        .then(res => {
          if (!res.ok) throw new Error(`API responded ${res.status}`);
          return res.json();
        })
        .then((apiCards: Record<string, unknown>[]) => {
          // Build a price map: id → PriceFields
          const priceMap = new Map<string, PriceFields>();
          for (const raw of apiCards) {
            if (typeof raw.id === 'string') {
              priceMap.set(raw.id, extractPrices(raw));
            }
          }

          setCards(prev => prev.map(card => {
            const fresh = priceMap.get(card.id);
            return fresh ? { ...card, ...fresh } : card;
          }));

          setPricesRefreshed(true);
          console.log(`[useCards] Phase 2: prices refreshed for ${priceMap.size} cards`);
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            // Non-fatal — bundled prices are still valid
            console.warn('[useCards] Price refresh failed (using bundled prices):', err.message);
          }
        });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load cards';
      setError(errorMessage);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCards();
    return () => { abortRef.current?.abort(); };
  }, [loadCards]);

  const getCardById = useCallback((id: string): Card | undefined => {
    return cards.find(card => card.id === id);
  }, [cards]);

  const getCardsBySet = useCallback((setCode: string): Card[] => {
    return cards.filter(card => card.set === setCode || card.set_code === setCode);
  }, [cards]);

  const searchCardsByName = useCallback((query: string): Card[] => {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return [];
    return cards.filter(card => card.name.toLowerCase().includes(normalizedQuery));
  }, [cards]);

  return {
    cards,
    isLoading,
    pricesRefreshed, // true once live prices have been applied
    error,
    reload: loadCards,
    getCardById,
    getCardsBySet,
    searchCardsByName,
    totalCards: cards.length,
  };
}
