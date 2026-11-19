import { createHash } from "node:crypto";
import { isIP } from "node:net";

const dayMs = 24 * 60 * 60 * 1_000;
const defaultDailyLimit = 3;
const incrementScript = [
  "local count = redis.call('INCR', KEYS[1])",
  "if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
  "return count",
].join("\n");
const localCounters = new Map<string, { count: number; expiresAt: number }>();

export class AIReportQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIReportQuotaError";
  }
}

function configuredDailyLimit(): number {
  const rawValue = process.env.AI_MAX_REPORTS_PER_IP_PER_DAY?.trim();
  if (!rawValue) return defaultDailyLimit;

  const value = Number(rawValue);
  if (!/^\d+$/.test(rawValue) || !Number.isSafeInteger(value) || value < 1) {
    throw new AIReportQuotaError("AI report quota is not configured correctly.");
  }
  return value;
}

function getDailyWindow(now: number): { day: number; ttlSeconds: number; expiresAt: number } {
  const day = Math.floor(now / dayMs);
  const expiresAt = (day + 1) * dayMs;
  return { day, ttlSeconds: Math.ceil((expiresAt - now) / 1_000), expiresAt };
}

function consumeLocalQuota(key: string, limit: number, now: number, expiresAt: number): boolean {
  for (const [counterKey, counter] of localCounters) {
    if (counter.expiresAt <= now) localCounters.delete(counterKey);
  }

  const current = localCounters.get(key);
  const count = current && current.expiresAt > now ? current.count + 1 : 1;
  localCounters.set(key, { count, expiresAt });
  return count <= limit;
}

export async function consumeAIReportQuota(clientAddress: string): Promise<boolean> {
  const isLocalAddress = clientAddress === "local" && process.env.NODE_ENV !== "production";
  if (!clientAddress || (!isLocalAddress && !isIP(clientAddress))) {
    throw new AIReportQuotaError("Could not identify the AI report request source.");
  }

  const limit = configuredDailyLimit();
  const clientHash = createHash("sha256").update(clientAddress).digest("hex");
  const now = Date.now();
  const { day, ttlSeconds, expiresAt } = getDailyWindow(now);
  const key = `migration-scoper:ai:${day}:${clientHash}`;
  if (process.env.NODE_ENV !== "production") {
    return consumeLocalQuota(key, limit, now, expiresAt);
  }

  const endpoint = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!endpoint || !token) {
    throw new AIReportQuotaError("AI report quota is not configured.");
  }

  let redisUrl: URL;
  try {
    redisUrl = new URL(endpoint);
  } catch {
    throw new AIReportQuotaError("AI report quota is not configured correctly.");
  }
  if (
    redisUrl.protocol !== "https:"
    || redisUrl.username
    || redisUrl.password
    || redisUrl.pathname !== "/"
    || redisUrl.search
    || redisUrl.hash
  ) {
    throw new AIReportQuotaError("AI report quota is not configured correctly.");
  }

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
        "1",
        key,
        String(ttlSeconds),
      ]]),
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    throw new AIReportQuotaError("AI report quota service is temporarily unavailable.");
  }
  if (!response.ok) {
    throw new AIReportQuotaError("AI report quota service is temporarily unavailable.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AIReportQuotaError("AI report quota service returned an invalid response.");
  }
  const firstResult = Array.isArray(payload) ? payload[0] : undefined;
  const count = firstResult && typeof firstResult === "object" && "result" in firstResult
    ? firstResult.result
    : undefined;
  if (typeof count !== "number") {
    throw new AIReportQuotaError("AI report quota service returned an invalid response.");
  }
  return count <= limit;
}
