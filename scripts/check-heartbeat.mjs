// The watch heartbeat (spec 003, section 6; the runbook, "The watch"): asks GitHub for the
// newest completed run of the `watch` workflow, of any trigger and any ref, and fails when it is
// older than three hours or did not succeed, naming the remedy. The `watch heartbeat` job on
// `ci` runs it on every pull request and every push to main with a read-only token, a red mark
// that is not a required check: a stopped watch cannot announce itself, and this is the sign.
//
// Exit 0 when the newest run passed inside the limit; 1 otherwise, or when GitHub could not be
// read (stderr names the endpoint and the status, never a URL or a body).
//   node scripts/check-heartbeat.mjs
//   node scripts/check-heartbeat.mjs --now <iso> --github-api <url>   (the tests, loopback only)
import { judge, REMEDY } from "./lib/heartbeat.mjs";

const args = process.argv.slice(2);

/** The value of --name, given as two arguments or as --name=value. Refuses a repeat. */
const option = (name) => {
  const found = [];
  for (let at = 0; at < args.length; at += 1) {
    if (args[at] === name) {
      const value = args[at + 1];
      if (value === undefined || value.startsWith("--")) {
        console.error(`${name} needs a value.`);
        process.exit(1);
      }
      found.push(value);
      at += 1;
    } else if (args[at].startsWith(`${name}=`)) {
      found.push(args[at].slice(name.length + 1));
    }
  }
  if (found.length > 1) {
    console.error(`${name} was given more than once.`);
    process.exit(1);
  }
  return found[0] ?? null;
};
const unknown = args.filter((arg) => arg.startsWith("--") && !/^--(now|github-api)(=|$)/.test(arg));
if (unknown.length > 0) {
  console.error(`unknown option: ${unknown[0]}`);
  process.exit(1);
}

const fail = (message) => {
  console.error(`Watch heartbeat failed: ${message}`);
  process.exit(1);
};

const now = option("--now") ?? new Date().toISOString();
if (Number.isNaN(Date.parse(now))) fail("--now is not a date");

// The tests point the API at a loopback stand-in; any other host would send the token
// somewhere unintended, so only loopback is accepted.
let base = "https://api.github.com";
const override = option("--github-api");
if (override !== null) {
  let host = null;
  try {
    host = new URL(override).hostname;
  } catch {
    host = null;
  }
  if (!/^(127\.0\.0\.1|localhost|\[::1\])$/.test(host ?? "")) {
    fail("--github-api may name a loopback host only; it is a test seam");
  }
  base = override.replace(/\/$/, "");
}

const env = (name) => {
  const value = process.env[name];
  if (!value) fail(`${name} is not set`);
  return value;
};
const token = env("GITHUB_TOKEN");
const repository = env("GITHUB_REPOSITORY");

// One request, given thirty seconds, so a hung connection ends in a line naming the endpoint
// and not in the job's timeout.
let response;
try {
  response = await fetch(
    `${base}/repos/${repository}/actions/workflows/watch.yml/runs?status=completed&per_page=1`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(30_000),
    },
  );
} catch {
  fail("the watch runs list could not be reached, or did not answer within thirty seconds");
}
if (!response.ok) fail(`the watch runs list answered ${response.status}`);
let body;
try {
  body = await response.json();
} catch {
  fail("the watch runs list answered something that is not JSON");
}
const run = Array.isArray(body?.workflow_runs) ? body.workflow_runs[0] : undefined;

const verdict = judge({ run, now });
if (verdict.ok) {
  console.log(`Watch heartbeat: ${verdict.reason}.`);
} else {
  console.error(`::error::Watch heartbeat: ${verdict.reason}; ${REMEDY}.`);
  process.exit(1);
}
