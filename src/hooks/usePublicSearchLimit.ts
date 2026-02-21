import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'vibook_public_searches';
const MAX_SEARCHES = 3;

interface StoredData {
  count: number;
  fingerprint: string;
  firstSearchAt: string;
}

function generateFingerprint(): string {
  const raw = `${navigator.userAgent}|${screen.width}|${screen.height}|${navigator.language}`;
  // Simple hash
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function loadData(): StoredData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { count: 0, fingerprint: generateFingerprint(), firstSearchAt: '' };

    const parsed: StoredData = JSON.parse(stored);
    const currentFingerprint = generateFingerprint();

    // Reset if fingerprint mismatches (different device/browser)
    if (parsed.fingerprint !== currentFingerprint) {
      return { count: 0, fingerprint: currentFingerprint, firstSearchAt: '' };
    }

    return parsed;
  } catch {
    return { count: 0, fingerprint: generateFingerprint(), firstSearchAt: '' };
  }
}

function saveData(data: StoredData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function usePublicSearchLimit() {
  const [data, setData] = useState<StoredData>(loadData);

  // Sync state on mount
  useEffect(() => {
    setData(loadData());
  }, []);

  const searchesUsed = data.count;
  const canSearch = data.count < MAX_SEARCHES;
  const isLimitReached = data.count >= MAX_SEARCHES;

  const incrementSearch = useCallback(() => {
    setData(prev => {
      const updated: StoredData = {
        ...prev,
        count: prev.count + 1,
        firstSearchAt: prev.firstSearchAt || new Date().toISOString(),
      };
      saveData(updated);
      return updated;
    });
  }, []);

  return { searchesUsed, canSearch, incrementSearch, isLimitReached, maxSearches: MAX_SEARCHES };
}
