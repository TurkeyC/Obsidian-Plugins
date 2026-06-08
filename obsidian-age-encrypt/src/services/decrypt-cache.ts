const MAX_ENTRIES = 1000;

interface CacheEntry {
    decryptedText: string;
    timestamp: number;
}

export class DecryptCache {
    private cache: Map<string, CacheEntry> = new Map();

    get(key: string): string | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        entry.timestamp = Date.now();
        return entry.decryptedText;
    }

    set(key: string, decryptedText: string): void {
        if (this.cache.size >= MAX_ENTRIES) {
            let oldestKey = '';
            let oldestTime = Infinity;
            for (const [k, v] of this.cache) {
                if (v.timestamp < oldestTime) {
                    oldestTime = v.timestamp;
                    oldestKey = k;
                }
            }
            if (oldestKey) this.cache.delete(oldestKey);
        }
        this.cache.set(key, { decryptedText, timestamp: Date.now() });
    }

    clear(): void {
        this.cache.clear();
    }

    static cacheKey(encryptedContent: string): string {
        return encryptedContent.slice(0, 200);
    }
}
