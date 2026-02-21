/**
 * useScanHistory Hook - Persist scan history in localStorage
 */
import { useState, useCallback } from 'react';

export interface ScanHistoryEntry {
  cardId: string;
  cardName: string;
  cardNumber: string;
  cardImage: string;
  action: 'added' | 'skipped';
  timestamp: number;
  isFoil: boolean;
  quantity: number;
}

const STORAGE_KEY = 'cardscanner_history';
const MAX_ENTRIES = 50;

function loadHistory(): ScanHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: ScanHistoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
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
