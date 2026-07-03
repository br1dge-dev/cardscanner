/**
 * useCards Hook - Load and manage card database
 *
 * Loading sequence (behind splash / loading screen):
 * 1. Load bundled cards.json (fast, works offline)
 * 2. Fetch live prices from DotGG API via CapacitorHttp (native, no CORS)
 * 3. Merge prices → mark loading complete → app transitions to home
 *
 * A 6s timeout ensures the app never hangs if the API is slow/down.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { CapacitorHttp } from '@capacitor/core';
import type { Card } from '../types';

const CARDS_URL = '/cards.json';
const DOTGG_API_URL = 'https://api.dotgg.gg/cgfw/getcards?game=riftbound';
const PRICE_REFRESH_TIMEOUT_MS = 6000;

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
      // ── Phase 1: Load bundled cards.json ──────────────────────────────────
      const response = await fetch(CARDS_URL);
      if (!response.ok) throw new Error(`Failed to load cards: ${response.status}`);

      const data: Card[] = await response.json();
      const normalizedCards = data.map(normalizeCard);

      console.log(`[useCards] Phase 1: loaded ${normalizedCards.length} cards from bundle`);
      setCards(normalizedCards);

      // ── Phase 2: Refresh prices via CapacitorHttp (native, no CORS) ──────
      // Loading screen stays visible until prices arrive or timeout fires.
      const ac = new AbortController();
      abortRef.current = ac;

      const finishLoading = () => {
        if (!ac.signal.aborted) setIsLoading(false);
      };

      // Safety timeout — never block the app for more than 6s
      const timeout = setTimeout(() => {
        console.warn('[useCards] Price refresh timed out — proceeding with bundled prices');
        ac.abort();
        finishLoading();
      }, PRICE_REFRESH_TIMEOUT_MS);

      try {
        const apiResponse = await CapacitorHttp.get({ url: DOTGG_API_URL });

        if (ac.signal.aborted) return; // timeout already fired

        if (apiResponse.status !== 200) {
          throw new Error(`API responded ${apiResponse.status}`);
        }

        const apiCards: Record<string, unknown>[] =
          typeof apiResponse.data === 'string'
            ? JSON.parse(apiResponse.data)
            : apiResponse.data;

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
      } catch (err) {
        if (!ac.signal.aborted) {
          console.warn('[useCards] Price refresh failed (using bundled prices):',
            err instanceof Error ? err.message : err);
        }
      } finally {
        clearTimeout(timeout);
        finishLoading();
      }

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
