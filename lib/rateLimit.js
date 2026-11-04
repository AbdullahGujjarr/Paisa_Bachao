// Fixed-window limiter held in memory, which suits the single Node process this app runs as.
// If the app is ever scaled to several instances, move these counters to a shared store.
const buckets = (globalThis.__pbRate ||= new Map());

export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.reset <= now) {
    if (buckets.size > 20000) {
      for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
    }
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  entry.count += 1;
  return { ok: entry.count <= limit, remaining: Math.max(0, limit - entry.count), reset: entry.reset };
}

export function clientIp(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}
