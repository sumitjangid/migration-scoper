export async function checkRobots(startUrl: string): Promise<{ allowed: boolean; note: string }> {
  try {
    const origin = new URL(startUrl).origin;
    const response = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": "MigrationCopilotBot/0.1" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return { allowed: true, note: "robots.txt unavailable or returned no rules; crawl proceeds conservatively." };
    }

    const text = await response.text();
    const userAgents: Array<{ agents: string[]; disallows: string[] }> = [];
    let current: { agents: string[]; disallows: string[] } | null = null;

    for (const line of text.split(/\r?\n/)) {
      const [rawKey, ...rawValue] = line.split(":");
      const key = rawKey?.trim().toLowerCase();
      const value = rawValue.join(":").trim();
      if (!key) continue;
      if (key === "user-agent") {
        if (current && current.agents.length > 0) userAgents.push(current);
        current = { agents: [value], disallows: [] };
      } else if (key === "disallow" && current) {
        if (value) current.disallows.push(value);
      }
    }
    if (current) userAgents.push(current);

    const applicable = userAgents.find((group) =>
      group.agents.some((agent) => agent === "*" || /MigrationCopilotBot/i.test(agent)),
    );
    if (!applicable) return { allowed: true, note: "No applicable robots.txt disallow rule found." };

    const path = new URL(startUrl).pathname;
    const disallowed = applicable.disallows.some((rule) =>
      rule.endsWith("$") ? path === rule.slice(0, -1) : path.startsWith(rule),
    );
    return {
      allowed: !disallowed,
      note: disallowed
        ? "robots.txt disallows this URL for the applicable bot user-agent."
        : "robots.txt allows this URL.",
    };
  } catch {
    return { allowed: true, note: "Could not read robots.txt; crawl proceeds conservatively." };
  }
}
