import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  consumePendingPrompt,
  PENDING_PROMPT_STORAGE_KEY,
  writePendingPrompt,
} from '../lib/pendingPrompt';

type MockStorage = {
  setItem: ReturnType<typeof vi.fn>;
  getItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
};

function installMockStorage(): {
  storage: MockStorage;
  store: Map<string, string>;
} {
  const store = new Map<string, string>();
  const storage: MockStorage = {
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    getItem: vi.fn((key: string) =>
      store.has(key) ? (store.get(key) as string) : null,
    ),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
  };
  vi.stubGlobal('window', { sessionStorage: storage });
  return { storage, store };
}

describe('pendingPrompt', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('writePendingPrompt', () => {
    it('writes the prompt to sessionStorage under the contract key', () => {
      const { storage, store } = installMockStorage();
      writePendingPrompt('hello world');
      expect(storage.setItem).toHaveBeenCalledWith(
        PENDING_PROMPT_STORAGE_KEY,
        'hello world',
      );
      expect(store.get(PENDING_PROMPT_STORAGE_KEY)).toBe('hello world');
    });

    it('is a no-op when window is undefined (SSR)', () => {
      // No stubGlobal call -> `window` remains undefined in the node test env.
      expect(() => writePendingPrompt('x')).not.toThrow();
    });

    it('silently no-ops when sessionStorage throws (e.g. quota, privacy mode)', () => {
      const { storage } = installMockStorage();
      storage.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => writePendingPrompt('x')).not.toThrow();
    });
  });

  describe('consumePendingPrompt', () => {
    it('returns null when no write has happened', () => {
      installMockStorage();
      expect(consumePendingPrompt()).toBeNull();
    });

    it('returns the written value and removes it atomically', () => {
      const { storage, store } = installMockStorage();
      writePendingPrompt('hello');
      expect(consumePendingPrompt()).toBe('hello');
      expect(storage.removeItem).toHaveBeenCalledWith(
        PENDING_PROMPT_STORAGE_KEY,
      );
      expect(store.has(PENDING_PROMPT_STORAGE_KEY)).toBe(false);
    });

    it('returns null on a second consume (value is consumed once)', () => {
      installMockStorage();
      writePendingPrompt('hello');
      expect(consumePendingPrompt()).toBe('hello');
      expect(consumePendingPrompt()).toBeNull();
    });

    it('returns null when the stored value is an empty string', () => {
      installMockStorage();
      writePendingPrompt('');
      expect(consumePendingPrompt()).toBeNull();
    });

    it('returns null when the stored value is whitespace only', () => {
      installMockStorage();
      writePendingPrompt('   ');
      expect(consumePendingPrompt()).toBeNull();
    });

    it('trims surrounding whitespace around the stored value', () => {
      installMockStorage();
      writePendingPrompt('  hello  ');
      expect(consumePendingPrompt()).toBe('hello');
    });

    it('returns null when window is undefined (SSR)', () => {
      // No stubGlobal call -> `window` remains undefined in the node test env.
      expect(consumePendingPrompt()).toBeNull();
    });

    it('returns null when sessionStorage throws (e.g. privacy restrictions)', () => {
      const { storage } = installMockStorage();
      storage.getItem.mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(consumePendingPrompt()).toBeNull();
    });
  });
});
