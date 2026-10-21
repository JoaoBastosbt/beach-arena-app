/**
 * Driver de armazenamento chave/valor. Hoje: LocalStorage (com fallback em
 * memória para SSR / navegação privada). Amanhã pode ser trocado por
 * IndexedDB ou removido quando os repositórios passarem a usar Supabase.
 */
export interface StorageDriver {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

class MemoryDriver implements StorageDriver {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  keys() {
    return [...this.map.keys()];
  }
}

class LocalStorageDriver implements StorageDriver {
  constructor(private fallback = new MemoryDriver()) {}

  private get ls(): Storage | null {
    try {
      return typeof window !== "undefined" ? window.localStorage : null;
    } catch {
      return null;
    }
  }
  getItem(key: string) {
    try {
      return this.ls?.getItem(key) ?? this.fallback.getItem(key);
    } catch {
      return this.fallback.getItem(key);
    }
  }
  setItem(key: string, value: string) {
    try {
      if (this.ls) this.ls.setItem(key, value);
      else this.fallback.setItem(key, value);
    } catch {
      this.fallback.setItem(key, value);
    }
  }
  removeItem(key: string) {
    try {
      this.ls?.removeItem(key);
    } catch {
      /* ignore */
    }
    this.fallback.removeItem(key);
  }
  keys() {
    try {
      const ls = this.ls;
      if (!ls) return this.fallback.keys();
      return Array.from({ length: ls.length }, (_, i) => ls.key(i)).filter((k): k is string => !!k);
    } catch {
      return this.fallback.keys();
    }
  }
}

export const storage: StorageDriver = new LocalStorageDriver();

export const STORAGE_PREFIX = "beach-arena:v1";

export function readJSON<T>(key: string, fallback: T): T {
  const raw = storage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(key: string, value: T) {
  storage.setItem(key, JSON.stringify(value));
}
