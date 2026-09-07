// The credential-use check (spec 003, section 2; the runbook, "The watch"): reads what Cloudflare
// recorded since the previous run, the account's audit log and both Workers' deployment and
// version lists, and what the deploy workflow's steps were doing at the time, judges every
// entry through scripts/lib/credential-use.mjs (actor, then window, then shape), and writes a
// report of the unexpected from an allow-list of fields. The hourly watch job runs it with a
// read-only token; the report job opens or updates the finding issue from the file it writes.
//
// Exit 0 when the check ran, whether or not it found anything; exit 1 when it could not run: a
// variable missing, an API refusing, a page missing, a ceiling met with more to read. A broken
// check is a failed job, never a silent pass. Stderr names an endpoint and a status code and
// nothing else: never a URL (it carries the account id), a response body, or a token id.
//   node scripts/check-credential-use.mjs --report <file>
//   node scripts/check-credential-use.mjs --report <file> --now <iso> --github-api <url>
//     --cloudflare-api <url>   (the tests, against loopback stand-ins)
import { appendFileSync, writeFileSync } from "node:fs";
import {
  FINDING_TITLE,
  format,
  judge,
  reportedIds,
  span,
  unreported,
  WORKERS,
  windows,
} from "./lib/credential-use.mjs";

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
const unknown = args.filter(
  (arg) => arg.startsWith("--") && !/^--(report|now|github-api|cloudflare-api)(=|$)/.test(arg),
);
if (unknown.length > 0) {
  console.error(`unknown option: ${unknown[0]}`);
  process.exit(1);
}

const fail = (message) => {
  console.error(`Credential-use check failed: ${message}`);
  process.exit(1);
};

const report = option("--report");
if (!report) fail("--report <file> is required");
const nowText = option("--now") ?? new Date().toISOString();
const now = Date.parse(nowText);
if (Number.isNaN(now)) fail("--now is not a date");

// The tests point both APIs at loopback stand-ins. Anything else would send a token somewhere
// unintended, so only loopback is accepted as an override.
const loopback = (name, fallback) => {
  const text = option(name);
  if (text === null) return fallback;
  let host = null;
  try {
    host = new URL(text).hostname;
  } catch {
    host = null;
  }
  if (!/^(127\.0\.0\.1|localhost|\[::1\])$/.test(host ?? "")) {
    fail(`${name} may name a loopback host only; it is a test seam`);
  }
  return text.replace(/\/$/, "");
};
const GITHUB = loopback("--github-api", "https://api.github.com");
const CLOUDFLARE = loopback("--cloudflare-api", "https://api.cloudflare.com/client/v4");

const env = (name) => {
  const value = process.env[name];
  if (!value) fail(`${name} is not set`);
  return value;
};
const watchToken = env("CLOUDFLARE_WATCH_TOKEN");
const account = env("CLOUDFLARE_ACCOUNT_ID");
const githubToken = env("GITHUB_TOKEN");
const repository = env("GITHUB_REPOSITORY");
const runUrl =
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : "";

const MINUTE = 60_000;
const DAY = 86_400_000;
const RUNS_CEILING = 500;
const AUDIT_PAGES_CEILING = 20;
const AUDIT_PAGE = 1000;

/** One request; the label is all stderr ever learns about it. */
async function get(base, path, headers, label) {
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      headers: { Accept: "application/json", ...headers },
    });
  } catch {
    fail(`${label} could not be reached`);
  }
  if (!response.ok) fail(`${label} answered ${response.status}`);
  try {
    return await response.json();
  } catch {
    fail(`${label} answered something that is not JSON`);
  }
}
const github = (path, label) =>
  get(
    GITHUB,
    `/repos/${repository}${path}`,
    { Authorization: `Bearer ${githubToken}`, "X-GitHub-Api-Version": "2022-11-28" },
    label,
  );
const cloudflare = (path, label) =>
  get(CLOUDFLARE, `/accounts/${account}${path}`, { Authorization: `Bearer ${watchToken}` }, label);

const iso = (at) => new Date(at).toISOString();
const between = (text, since, before) => {
  const at = Date.parse(String(text ?? ""));
  return !Number.isNaN(at) && at >= since && at <= before;
};

// 1. The previous successful credential-use job, for the span's anchor (spec 2.2). The watch's
// completed runs, newest first, each asked for its jobs; the first `credential use` job that
// succeeded gives its start. Twenty runs is a day of hourly runs; beyond that the interval
// alone bounds the span.
let previousJobStartedAt = null;
{
  const runs = await github(
    "/actions/workflows/watch.yml/runs?status=completed&per_page=20",
    "the watch runs list",
  );
  for (const run of runs.workflow_runs ?? []) {
    const jobs = await github(
      `/actions/runs/${run.id}/jobs?filter=all&per_page=100`,
      "a watch run's jobs",
    );
    const job = (jobs.jobs ?? []).find(
      (j) => j.name === "credential use" && j.conclusion === "success",
    );
    if (job?.started_at) {
      previousJobStartedAt = job.started_at;
      break;
    }
  }
}
const first = span({ now: nowText, previousJobStartedAt });
const since = Date.parse(first.since);

// 2. The deploy runs whose steps could hold a window: newest first until they predate the span
// by the longest job timeout, plus every dispatch of the last thirty days, since a gated run
// waits at the environment before its step runs (spec 2.2). One jobs call per run.
const runsById = new Map();
const takeRuns = async (query, label) => {
  for (let page = 1; ; page += 1) {
    const list = await github(
      `/actions/workflows/deploy.yml/runs?${query}&per_page=50&page=${page}`,
      label,
    );
    const runs = list.workflow_runs ?? [];
    if (runs.length === 0) return;
    let oldest = Infinity;
    for (const run of runs) {
      runsById.set(String(run.id), run);
      oldest = Math.min(oldest, Date.parse(run.created_at));
      if (runsById.size > RUNS_CEILING) fail("the runs ceiling was met with more to read");
    }
    if (query.startsWith("event=") || oldest < since - 20 * MINUTE) return;
  }
};
await takeRuns("status=completed", "the deploy runs list");
await takeRuns("status=in_progress", "the deploy runs list");
await takeRuns(
  `event=workflow_dispatch&created=>=${iso(now - 30 * DAY).slice(0, 10)}`,
  "the dispatched runs list",
);
const jobsByRun = {};
for (const id of runsById.keys()) {
  const jobs = await github(
    `/actions/runs/${id}/jobs?filter=all&per_page=100`,
    "a deploy run's jobs",
  );
  jobsByRun[id] = jobs.jobs ?? [];
}
const { windows: made, running } = windows(jobsByRun);

// 3. A deploy step still running stops the span before it (spec 2.2).
const runningStepStartedAt =
  running.map((r) => r.startedAt).sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;
const { before: beforeText } = span({ now: nowText, previousJobStartedAt, runningStepStartedAt });
const before = Date.parse(beforeText);

// 4. The audit log, paged by cursor under a ceiling; a ceiling met with a cursor in hand is a
// page missing, never a report on a partial span (plan decision 10).
const entries = [];
{
  let cursor = null;
  for (let page = 1; ; page += 1) {
    if (page > AUDIT_PAGES_CEILING) fail("the audit-log ceiling was met with more to read");
    const query = `since=${encodeURIComponent(first.since)}&before=${encodeURIComponent(beforeText)}&limit=${AUDIT_PAGE}&direction=asc${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const page_ = await cloudflare(`/logs/audit?${query}`, "the audit log");
    const items = Array.isArray(page_.result) ? page_.result : (page_.result?.items ?? []);
    for (const entry of items) if (between(entry?.action?.time, since, before)) entries.push(entry);
    cursor = page_.result_info?.cursor ?? null;
    if (!cursor || items.length === 0) break;
  }
}

// 5. Each Worker's deployments and versions inside the span, each item told its Worker.
const deployments = [];
const versions = [];
for (const worker of Object.values(WORKERS)) {
  const d = await cloudflare(`/workers/scripts/${worker}/deployments`, "a Worker's deployments");
  for (const item of d.result?.deployments ?? []) {
    if (between(item.created_on, since, before)) deployments.push({ ...item, worker });
  }
  const v = await cloudflare(
    `/workers/scripts/${worker}/versions?per_page=100`,
    "a Worker's versions",
  );
  for (const item of v.result?.items ?? []) {
    if (between(item.metadata?.created_on, since, before)) versions.push({ ...item, worker });
  }
}

// 6. The state: the newest finding issue the workflow's own account opened, open or closed,
// and that account's own comments on it (spec 2.5).
const already = new Set();
{
  const issues = await github(
    `/issues?state=all&creator=github-actions%5Bbot%5D&per_page=100`,
    "the issues list",
  );
  const mine = (issues ?? []).filter((i) => i.title === FINDING_TITLE && !i.pull_request);
  mine.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const issue = mine[0];
  if (issue) {
    const texts = [issue.body ?? ""];
    const comments = await github(
      `/issues/${issue.number}/comments?per_page=100`,
      "the issue's comments",
    );
    for (const comment of comments ?? []) {
      if (comment.user?.login === "github-actions[bot]") texts.push(comment.body ?? "");
    }
    for (const id of reportedIds(texts)) already.add(id);
  }
}

// 7. Judge, drop what was named before, format, write.
const findings = unreported(judge({ entries, deployments, versions, windows: made }), already);
const { full, body, count } = format(findings, { runUrl });
writeFileSync(report, body === "" ? "" : `${body}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Credential use\n\nSpan ${first.since} to ${beforeText}; ${entries.length} entries, ${made.length} windows.\n\n${full === "" ? "Nothing unexpected." : full}\n`,
  );
}
if (full !== "") console.log(full);
console.log(
  `Credential-use check: ${count} finding(s) from ${entries.length} entries, ${deployments.length} deployments and ${versions.length} versions against ${made.length} windows, ${first.since} to ${beforeText}.`,
);
