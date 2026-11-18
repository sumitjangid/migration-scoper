import { createHash } from "node:crypto";
import { isIP } from "node:net";

const windowSeconds = 60 * 60;
const clientLimit = 3;
const globalLimit = 24;
const incrementScript = [
  "local client = redis.call('INCR', KEYS[1])",
  "if client == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
  "local global = redis.call('INCR', KEYS[2])",
  "if global == 1 then redis.call('EXPIRE', KEYS[2], ARGV[1]) end",
  "return {client, global}",
].join("\n");

export class ScopeRateLimitError extends Error {
  constructor(
    message: string,
    readonly status: 429 | 503,
  ) {
    super(message);
    this.name = "ScopeRateLimitError";
  }
}

const localCounters = new Map<string, { count: number; expiresAt: number }>();
let localGlobalCount = 0;
let localGlobalExpiresAt = 0;

function checkLocalRateLimit(clientKey: string): void {
  const now = Date.now();
  for (const [key, counter] of localCounters) {
    if (counter.expiresAt <= now) localCounters.delete(key);
  }

  const current = localCounters.get(clientKey);
  const clientCount = current && current.expiresAt > now ? current.count + 1 : 1;
  const globalCount = localGlobalExpiresAt > now ? localGlobalCount + 1 : 1;
  localCounters.set(clientKey, { count: clientCount, expiresAt: now + windowSeconds * 1_000 });
  localGlobalCount = globalCount;
  localGlobalExpiresAt = now + windowSeconds * 1_000;

  if (clientCount > clientLimit || globalCount > globalLimit) {
    throw new ScopeRateLimitError("Crawl limit reached. Please try again later.", 429);
  }
}

export async function enforceScopeRateLimit(clientAddress: string): Promise<void> {
  if (!clientAddress || (clientAddress !== "local" && !isIP(clientAddress))) {
    throw new ScopeRateLimitError("Could not identify the request source.", 503);
  }
  const clientKey = createHash("sha256").update(clientAddress).digest("hex");
  if (process.env.NODE_ENV !== "production") {
    checkLocalRateLimit(clientKey);
    return;
  }

  const endpoint = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!endpoint || !token) {
    throw new ScopeRateLimitError("Crawl rate limiting is not configured.", 503);
  }
  let redisUrl: URL;
  try {
    redisUrl = new URL(endpoint);
  } catch {
    throw new ScopeRateLimitError("Crawl rate limiting is not configured correctly.", 503);
  }
  if (
    redisUrl.protocol !== "https:"
    || redisUrl.username
    || redisUrl.password
    || redisUrl.pathname !== "/"
    || redisUrl.search
    || redisUrl.hash
  ) {
    throw new ScopeRateLimitError("Crawl rate limiting is not configured correctly.", 503);
  }

  const window = Math.floor(Date.now() / (windowSeconds * 1_000));
  const clientRedisKey = `migration-scoper:scope:${window}:${clientKey}`;
  const globalRedisKey = `migration-scoper:scope:${window}:global`;

  let response: Response;
  try {
    response = await fetch(`${redisUrl.origin}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([[
        "EVAL",
        incrementScript,
        "2",
        clientRedisKey,
        globalRedisKey,
        String(windowSeconds),
      ]]),
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    throw new ScopeRateLimitError("Crawl rate limiting is temporarily unavailable.", 503);
  }
  if (!response.ok) {
    throw new ScopeRateLimitError("Crawl rate limiting is temporarily unavailable.", 503);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ScopeRateLimitError("Crawl rate limiting returned an invalid response.", 503);
  }
  const firstResult = Array.isArray(payload) ? payload[0] : undefined;
  const result = firstResult && typeof firstResult === "object" && "result" in firstResult
    ? firstResult.result
    : undefined;
  if (
    !Array.isArray(result)
    || typeof result[0] !== "number"
    || typeof result[1] !== "number"
  ) {
    throw new ScopeRateLimitError("Crawl rate limiting returned an invalid response.", 503);
  }
  if (result[0] > clientLimit || result[1] > globalLimit) {
    throw new ScopeRateLimitError("Crawl limit reached. Please try again later.", 429);
  }
}
