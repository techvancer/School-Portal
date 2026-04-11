const _cache = new Map();

export function getCached(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _cache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCached(key, value, ttlMs = 120_000) {
  _cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function clearCacheByPrefix(prefix) {
  for (const k of _cache.keys()) {
    if (k.startsWith(prefix)) {
      _cache.delete(k);
    }
  }
}
