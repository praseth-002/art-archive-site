type RateBucket = {
  count: number;
  resetAt: number;
};

const CLIENT_WINDOW_MS = 15 * 60 * 1000;
const CLIENT_ATTEMPTS = 8;
const GLOBAL_WINDOW_MS = 60 * 1000;
const GLOBAL_ATTEMPTS = 120;
const MAX_TRACKED_CLIENTS = 5000;

const clients = new Map<string, RateBucket>();
const globalBucket: RateBucket = { count: 0, resetAt: 0 };
let requestsSincePrune = 0;

function clientAddress(request: Request) {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").map((value) => value.trim()).filter(Boolean);
  return forwarded?.at(-1) || "unknown";
}

function consume(bucket: RateBucket, limit: number, windowMs: number, now: number) {
  if (now >= bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

function retryAfter(bucket: RateBucket, now: number) {
  return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
}

function prune(now: number) {
  requestsSincePrune += 1;
  if (requestsSincePrune < 100) return;
  requestsSincePrune = 0;
  for (const [key, bucket] of clients) {
    if (now >= bucket.resetAt) clients.delete(key);
  }
}

export function consumeLoginAttempt(request: Request) {
  const now = Date.now();
  prune(now);

  if (!consume(globalBucket, GLOBAL_ATTEMPTS, GLOBAL_WINDOW_MS, now)) {
    return { allowed: false, retryAfter: retryAfter(globalBucket, now) };
  }

  const address = clientAddress(request);
  let bucket = clients.get(address);
  if (!bucket) {
    if (clients.size >= MAX_TRACKED_CLIENTS) return { allowed: false, retryAfter: 60 };
    bucket = { count: 0, resetAt: now + CLIENT_WINDOW_MS };
    clients.set(address, bucket);
  }

  return consume(bucket, CLIENT_ATTEMPTS, CLIENT_WINDOW_MS, now)
    ? { allowed: true, retryAfter: 0 }
    : { allowed: false, retryAfter: retryAfter(bucket, now) };
}

export function clearLoginAttempts(request: Request) {
  clients.delete(clientAddress(request));
}
