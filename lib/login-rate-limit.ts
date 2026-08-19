type RateBucket = { count: number; resetAt: number };

const CLIENT_WINDOW_MS = 15 * 60 * 1000;
const CLIENT_ATTEMPTS = 8;
const GLOBAL_WINDOW_MS = 60 * 1000;
const GLOBAL_ATTEMPTS = 120;
const MAX_TRACKED_CLIENTS = 5000;

const clients = new Map<string, RateBucket>();
const globalBucket: RateBucket = { count: 0, resetAt: 0 };

function clientAddress(request: Request) {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",").at(-1)?.trim() || "unknown";
}

function consume(bucket: RateBucket, limit: number, windowMs: number, now: number) {
  if (now >= bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

export function consumeLoginAttempt(request: Request) {
  const now = Date.now();
  const globalAllowed = consume(globalBucket, GLOBAL_ATTEMPTS, GLOBAL_WINDOW_MS, now);
  const address = clientAddress(request);
  let bucket = clients.get(address);

  if (!bucket) {
    if (clients.size >= MAX_TRACKED_CLIENTS) {
      for (const [key, value] of clients) {
        if (now >= value.resetAt) clients.delete(key);
      }
      if (clients.size >= MAX_TRACKED_CLIENTS) clients.delete(clients.keys().next().value as string);
    }
    bucket = { count: 0, resetAt: 0 };
    clients.set(address, bucket);
  }

  const clientAllowed = consume(bucket, CLIENT_ATTEMPTS, CLIENT_WINDOW_MS, now);
  const retryAt = Math.max(globalAllowed ? 0 : globalBucket.resetAt, clientAllowed ? 0 : bucket.resetAt);
  return { allowed: globalAllowed && clientAllowed, retryAfter: Math.max(1, Math.ceil((retryAt - now) / 1000)) };
}

export function clearLoginAttempts(request: Request) {
  clients.delete(clientAddress(request));
}
