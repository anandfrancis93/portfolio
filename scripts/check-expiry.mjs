// The dates the release path depends on, from .github/expiry.json: when each credential expires
// and when the rollback was last rehearsed on production. Fails when an expiry is within
// warnDays, or past, or when the rehearsal is older than the interval, so the warning shows on
// every `pnpm check`. With --online it also asks Cloudflare for the preview token's real expiry
// (the token in CLOUDFLARE_API_TOKEN) and fails when the recorded date drifts from it by more
// than a day or the token is not active; the weekly watch workflow runs that form.
//   node scripts/check-expiry.mjs
//   node scripts/check-expiry.mjs --online
//   node scripts/check-expiry.mjs --file <json> --today <YYYY-MM-DD>   (the tests)
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  if (at < 0) return null;
  if (args[at + 1] === undefined || args[at + 1].startsWith("--")) {
    console.error(`${name} needs a value.`);
    process.exit(1);
  }
  return args[at + 1];
};
const online = args.includes("--online");
const file = resolve(root, option("--file") ?? ".github/expiry.json");
const todayText = option("--today") ?? new Date().toISOString().slice(0, 10);

const DAY = 86_400_000;
// A date must be real, not only well-formed: an impossible one would parse to NaN and slip
// through every comparison, and V8 rolls "2026-02-30" over to 2 March without complaint.
const parseDate = (text, name) => {
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(String(text)) ? Date.parse(`${text}T00:00:00Z`) : NaN;
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== text) {
    console.error(`${name} is not a real YYYY-MM-DD date: ${JSON.stringify(text)}`);
    process.exit(1);
  }
  return ms;
};
const today = parseDate(todayText, "--today");
const days = (from, to) => Math.round((to - from) / DAY);

let config;
try {
  config = JSON.parse(readFileSync(file, "utf8"));
} catch (error) {
  console.error(`Could not read ${file}: ${error.message}`);
  process.exit(1);
}
if (!config || typeof config !== "object" || Array.isArray(config)) {
  console.error(`${file} must hold a JSON object.`);
  process.exit(1);
}
const warnDays = Number(config.warnDays);
const interval = Number(config.rollbackIntervalDays);
if (!Number.isInteger(warnDays) || !Number.isInteger(interval)) {
  console.error("warnDays and rollbackIntervalDays must be whole numbers of days.");
  process.exit(1);
}

const problems = [];
const expiries = Object.entries(config).filter(([key]) => key.endsWith("Expires"));
if (expiries.length === 0) problems.push("no *Expires dates are recorded");
let nearest = null;
for (const [name, text] of expiries) {
  const left = days(today, parseDate(text, name));
  if (nearest === null || left < nearest.left) nearest = { name, left };
  // "Within warnDays" is inclusive: the day the window opens already warns.
  if (left < 0) problems.push(`${name} passed ${-left} day(s) ago (${text}); rotate it`);
  else if (left <= warnDays)
    problems.push(`${name} expires in ${left} day(s) (${text}); rotate it`);
}

const rehearsed = days(parseDate(config.rollbackRehearsed, "rollbackRehearsed"), today);
if (rehearsed < 0)
  problems.push(`rollbackRehearsed (${config.rollbackRehearsed}) is in the future`);
// "Older than the interval" is exclusive: a rehearsal exactly the interval ago still counts.
if (rehearsed > interval) {
  problems.push(
    `the rollback was last rehearsed ${rehearsed} days ago (${config.rollbackRehearsed}); the interval is ${interval}`,
  );
}

let onlineNote = "";
if (online) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  // The endpoint is Cloudflare's. The override exists for the tests' stand-in server and is
  // honoured for loopback hosts only, so the token can never be sent anywhere else.
  const override = process.env.EXPIRY_VERIFY_URL;
  let url = "https://api.cloudflare.com/client/v4/user/tokens/verify";
  if (override) {
    let host = null;
    try {
      host = new URL(override).hostname;
    } catch {
      host = null;
    }
    if (!/^(127\.0\.0\.1|localhost|\[::1\])$/.test(host ?? "")) {
      console.error("EXPIRY_VERIFY_URL may name a loopback host only; it is a test seam.");
      process.exit(1);
    }
    url = override;
  }
  if (!token) {
    problems.push("--online needs CLOUDFLARE_API_TOKEN (the preview token) in the environment");
  } else {
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json();
      const result = body?.result ?? {};
      if (!response.ok || body?.success === false) {
        problems.push(`the verify endpoint answered ${response.status}`);
      } else if (result.status !== "active") {
        problems.push(`the preview token is ${result.status ?? "of unknown status"}, not active`);
      } else if (!result.expires_on) {
        problems.push("the preview token has no expiry; set one");
      } else {
        const real = String(result.expires_on).slice(0, 10);
        const recorded = String(config.cloudflarePreviewExpires ?? "");
        const drift = Math.abs(
          days(parseDate(recorded, "cloudflarePreviewExpires"), parseDate(real, "expires_on")),
        );
        if (drift > 1) {
          problems.push(`cloudflarePreviewExpires says ${recorded} but the token expires ${real}`);
        }
        onlineNote = `; online: preview token active, expires ${real}`;
      }
    } catch (error) {
      problems.push(`the verify endpoint could not be reached: ${error.message}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`Expiry check failed (${problems.length}):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(
  `Expiry check: nearest expiry in ${nearest.left} days (${nearest.name}); rollback rehearsed ${rehearsed} days ago, interval ${interval}${onlineNote}.`,
);
