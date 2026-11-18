import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import process from "node:process";

if (process.env.VERCEL) process.exit(0);

const require = createRequire(import.meta.url);
const playwrightPackage = require.resolve("playwright/package.json");
const playwrightCli = join(dirname(playwrightPackage), "cli.js");
const result = spawnSync(
  process.execPath,
  [playwrightCli, "install", "--only-shell", "chromium"],
  {
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: "0" },
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status ?? 1;
