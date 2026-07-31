// Best-effort in-memory sliding-window rate limiter. On serverless this is
// per-instance, not global, so it dampens bursts from a single warm instance
// but is NOT a hard guarantee; pair it with a platform WAF / CAPTCHA (e.g.
// Vercel BotID or Cloudflare Turnstile) for a truly public write endpoint.
const hits = new Map(); // key -> number[] of hit timestamps (ms)

function prune(key, cutoff) {
  const arr = (hits.get(key) || []).filter((t) => t > cutoff);
  hits.set(key, arr);
  return arr;
}

// Peek whether `key` is under the cap right now. Does NOT consume a slot.
export function check(key, { max = 5, windowMs = 60 * 60 * 1000 } = {}) {
  const arr = prune(key, Date.now() - windowMs);
  return { ok: arr.length < max, retryAfterMs: arr.length ? arr[0] + windowMs - Date.now() : 0 };
}

// Consume one slot for `key`.
export function record(key, { windowMs = 60 * 60 * 1000 } = {}) {
  const now = Date.now();
  const arr = prune(key, now - windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) {
    const cutoff = now - windowMs;
    for (const [k, v] of hits) {
      const kept = v.filter((t) => t > cutoff);
      if (kept.length) hits.set(k, kept);
      else hits.delete(k);
    }
  }
}

// Combined check-and-consume; use where consuming on every attempt is fine.
export function rateLimit(key, opts = {}) {
  const c = check(key, opts);
  if (!c.ok) return c;
  record(key, opts);
  return { ok: true };
}

// The client's real IP. On Vercel, x-real-ip / x-vercel-forwarded-for are set by
// the platform and cannot be spoofed by the client; a client-supplied
// x-forwarded-for is prepended (so its leftmost value is attacker-controlled) and
// is only a last-resort fallback.
export function clientIp(request) {
  const h = request.headers;
  return (
    h.get('x-real-ip') ||
    h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}
