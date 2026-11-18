const userAgent = "MigrationCopilotBot";
const robotsTimeoutMs = 10_000;
const maxRobotsBytes = 512_000;

type Rule = { allow: boolean; pattern: string };
type Group = { agents: string[]; rules: Rule[]; crawlDelaySeconds?: number };

export type RobotsDecision = { allowed: boolean; note: string };

export type RobotsPolicy = {
  origin: string;
  note: string;
  crawlDelaySeconds: number;
  check(url: string): RobotsDecision;
};

export class RobotsPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RobotsPolicyError";
  }
}

function parseRobotsTxt(contents: string): Group[] {
  const groups: Group[] = [];
  let current: Group | undefined;
  let hasDirectives = false;

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0]?.trim();
    if (!line) continue;

    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === "user-agent") {
      if (current && hasDirectives) {
        groups.push(current);
        current = undefined;
        hasDirectives = false;
      }
      current ??= { agents: [], rules: [] };
      if (value) current.agents.push(value.toLowerCase());
      continue;
    }

    if (!current) continue;
    hasDirectives = true;
    if ((key === "allow" || key === "disallow") && value) {
      current.rules.push({ allow: key === "allow", pattern: value });
    } else if (key === "crawl-delay") {
      const delay = Number(value);
      if (Number.isFinite(delay) && delay >= 0) {
        current.crawlDelaySeconds = Math.max(current.crawlDelaySeconds ?? 0, delay);
      }
    }
  }
  if (current) groups.push(current);
  return groups;
}

function matchesPattern(path: string, pattern: string): boolean {
  const anchored = pattern.endsWith("$");
  const expression = anchored ? pattern.slice(0, -1) : pattern;
  const source = expression.replace(/\*/g, "\u0000").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\u0000/g, ".*");
  try {
    return new RegExp(`^${source}${anchored ? "" : ".*"}$`).test(path);
  } catch {
    return false;
  }
}

function ruleSpecificity(pattern: string): number {
  return [...pattern].filter((character) => character !== "*" && character !== "$").length;
}

export function createRobotsPolicy(
  origin: string,
  contents: string,
  options: { denyAll?: boolean; note?: string } = {},
): RobotsPolicy {
  const groups = parseRobotsTxt(contents);
  const matchingGroups = groups.filter((group) =>
    group.agents.some((agent) => agent !== "*" && userAgent.toLowerCase().includes(agent)),
  );
  const applicableGroups = matchingGroups.length > 0
    ? matchingGroups
    : groups.filter((group) => group.agents.includes("*"));
  const rules = applicableGroups.flatMap((group) => group.rules);
  const crawlDelaySeconds = applicableGroups.reduce(
    (delay, group) => Math.max(delay, group.crawlDelaySeconds ?? 0),
    0,
  );

  return {
    origin,
    note: options.note ?? "robots.txt rules loaded; disallowed URLs will be skipped.",
    crawlDelaySeconds,
    check(target: string): RobotsDecision {
      let url: URL;
      try {
        url = new URL(target);
      } catch {
        return { allowed: false, note: "The URL is invalid." };
      }
      if (url.origin !== origin) {
        return { allowed: false, note: "The URL is outside the checked origin." };
      }
      if (options.denyAll) {
        return { allowed: false, note: "The site does not permit robots.txt access; crawl blocked." };
      }

      const path = `${url.pathname}${url.search}`;
      const applicable = rules
        .filter((rule) => matchesPattern(path, rule.pattern))
        .sort((left, right) => ruleSpecificity(right.pattern) - ruleSpecificity(left.pattern));
      const mostSpecific = applicable[0];
      if (!mostSpecific) return { allowed: true, note: "robots.txt allows this URL." };
      const tied = applicable.filter((rule) => ruleSpecificity(rule.pattern) === ruleSpecificity(mostSpecific.pattern));
      const allowed = tied.some((rule) => rule.allow);
      return {
        allowed,
        note: allowed
          ? "robots.txt allows this URL."
          : "robots.txt disallows this URL for the crawler user-agent.",
      };
    },
  };
}

export async function loadRobotsPolicy(targetUrl: string): Promise<RobotsPolicy> {
  let origin: string;
  try {
    origin = new URL(targetUrl).origin;
  } catch {
    throw new RobotsPolicyError("Cannot check robots.txt for an invalid URL.");
  }

  let response: Response;
  try {
    response = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": `${userAgent}/0.1 (+public storefront scope analysis)` },
      signal: AbortSignal.timeout(robotsTimeoutMs),
      redirect: "follow",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new RobotsPolicyError(`Could not verify robots.txt; crawl blocked. ${detail}`);
  }

  if (response.status === 404 || response.status === 410) {
    return createRobotsPolicy(origin, "", {
      note: "robots.txt returned not found; no published crawl restrictions were found.",
    });
  }
  if (response.status === 401 || response.status === 403) {
    return createRobotsPolicy(origin, "", {
      denyAll: true,
      note: "robots.txt is access-restricted; crawl blocked.",
    });
  }
  if (!response.ok) {
    throw new RobotsPolicyError(`robots.txt returned HTTP ${response.status}; crawl blocked.`);
  }

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxRobotsBytes) {
    throw new RobotsPolicyError("robots.txt is larger than the supported limit; crawl blocked.");
  }
  const contents = await response.text();
  if (new TextEncoder().encode(contents).byteLength > maxRobotsBytes) {
    throw new RobotsPolicyError("robots.txt is larger than the supported limit; crawl blocked.");
  }

  return createRobotsPolicy(origin, contents);
}

export async function checkRobots(targetUrl: string): Promise<RobotsDecision> {
  const policy = await loadRobotsPolicy(targetUrl);
  return policy.check(targetUrl);
}
