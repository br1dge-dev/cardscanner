/**
 * useScanHistory Hook - Persist scan history in localStorage
 */
import { useState, useCallback } from 'react';

export interface ScanHistoryEntry {
  cardId: string;
  cardName: string;
  cardNumber: string;
  cardImage: string;
  action: 'added' | 'skipped' | 'removed';
  timestamp: number;
  isFoil: boolean;
  quantity: number;
}

const STORAGE_KEY = 'cardscanner_history';
const MAX_ENTRIES = 50;
const MAX_RETRY_IMAGES = 5; // limit stored base64 images to avoid localStorage overflow

function loadHistory(): ScanHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: ScanHistoryEntry[]) {
  // Only keep retry images for the most recent failed scans to stay within localStorage limits
  let retryImageCount = 0;
  const cleaned = entries.slice(0, MAX_ENTRIES).map(e => {
    if (e.cardImage && e.cardImage.startsWith('data:') && e.action === 'skipped') {
      retryImageCount++;
      if (retryImageCount > MAX_RETRY_IMAGES) {
        return { ...e, cardImage: '' }; // strip old retry images
      }
    }
    return e;
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  } catch (e) {
    // localStorage full — strip all retry images and try again
    console.warn('localStorage full, stripping retry images');
    const stripped = cleaned.map(entry =>
      entry.cardImage?.startsWith('data:') ? { ...entry, cardImage: '' } : entry
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
  }
}

export function useScanHistory() {
  const [history, setHistory] = useState<ScanHistoryEntry[]>(loadHistory);

  const addEntry = useCallback((entry: Omit<ScanHistoryEntry, 'timestamp'>) => {
    setHistory(prev => {
      const updated = [{ ...entry, timestamp: Date.now() }, ...prev].slice(0, MAX_ENTRIES);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { history, addEntry, clearHistory };
}
