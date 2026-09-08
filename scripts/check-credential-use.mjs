// The credential-use check (spec 003, section 2; the runbook, "The watch"): reads what Cloudflare
// recorded since the previous run, the account's audit log and both Workers' deployment and
// version lists, and what the deploy workflow's steps were doing at the time, judges every
// entry through scripts/lib/credential-use.mjs (actor, then window, then shape), and writes the
// whole report to one file (the job's artifact) and the capped issue body to another, both from
// an allow-list of fields. The hourly watch job runs it with a read-only token; the report job
// opens or updates the finding issue from the body file.
//
// Exit 0 when the check ran, whether or not it found anything; exit 1 when it could not run: a
// variable missing, an API refusing, a page missing, a ceiling met with more to read, an answer
// Cloudflare marks as failed. A broken check is a failed job, never a silent pass. Stderr names
// an endpoint and a status code and nothing else: never a URL (it carries the account id), a
// response body, or a token id.
//   node scripts/check-credential-use.mjs --report <file> --body <file>
//   node scripts/check-credential-use.mjs ... --now <iso> --github-api <url> --cloudflare-api <url>
//     (the tests, against loopback stand-ins; any other host is refused)
import { appendFileSync, writeFileSync } from "node:fs";
import {
  FINDING_TITLE,
  format,
  judge,
  reportedIds,
  span,
  TIMEOUT_MS,
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
  (arg) => arg.startsWith("--") && !/^--(report|body|now|github-api|cloudflare-api)(=|$)/.test(arg),
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
const bodyFile = option("--body");
if (!report || !bodyFile) fail("--report <file> and --body <file> are required");
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

const DAY = 86_400_000;
// The ceilings of plan decision 10, counted in calls: each run read costs a jobs call.
const RUNS_CEILING = 500;
const AUDIT_PAGES_CEILING = 20;
const AUDIT_PAGE = 1000;
const LIST_PAGES_CEILING = 10;
const BOT = "github-actions[bot]";

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
const cloudflare = async (path, label) => {
  const body = await get(
    CLOUDFLARE,
    `/accounts/${account}${path}`,
    { Authorization: `Bearer ${watchToken}` },
    label,
  );
  // Cloudflare answers 200 with success false for a refused request; that is a refusal too.
  if (body?.success === false) fail(`${label} answered success false`);
  return body;
};

const iso = (at) => new Date(at).toISOString();
const between = (text, since, before) => {
  const at = Date.parse(String(text ?? ""));
  return !Number.isNaN(at) && at >= since && at <= before;
};

/** Every page of a GitHub list, under a ceiling; the ceiling met with more to read is exit 1. */
async function pages(path, label, key, ceiling = LIST_PAGES_CEILING) {
  const items = [];
  for (let page = 1; ; page += 1) {
    if (page > ceiling) fail(`the ${label} ceiling was met with more to read`);
    const list = await github(
      `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
      label,
    );
    const got = key ? (list[key] ?? []) : Array.isArray(list) ? list : [];
    items.push(...got);
    if (got.length < 100) return items;
  }
}

// 1. The previous successful credential-use job, for the span's anchor (spec 2.2). The watch's
// completed runs, newest first, up to the runs ceiling; a jobs call only for a run that
// succeeded, since a run succeeds only when every job did. No successful job found: when a
// failed run in the read carries the job, the last success is beyond the ceiling and the span
// cannot be anchored, exit 1; when no run read carries the job at all, the job is new and the
// interval alone bounds the span, the first run's case.
let previousJobStartedAt = null;
{
  let firstFailure = null;
  let count = 0;
  for (let page = 1; previousJobStartedAt === null; page += 1) {
    if (count >= RUNS_CEILING) break;
    const list = await github(
      `/actions/workflows/watch.yml/runs?status=completed&per_page=100&page=${page}`,
      "the watch runs list",
    );
    const runs = list.workflow_runs ?? [];
    if (runs.length === 0) break;
    for (const run of runs) {
      count += 1;
      if (run.conclusion === "success") {
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
      } else if (firstFailure === null) {
        firstFailure = run;
      }
      if (count >= RUNS_CEILING) break;
    }
    if (runs.length < 100) break;
  }
  if (previousJobStartedAt === null && firstFailure !== null) {
    const jobs = await github(
      `/actions/runs/${firstFailure.id}/jobs?filter=all&per_page=100`,
      "a watch run's jobs",
    );
    if ((jobs.jobs ?? []).some((j) => j.name === "credential use")) {
      fail(
        `no successful credential-use job among the last ${count} watch runs; the span cannot be anchored`,
      );
    }
  }
}
const first = span({ now: nowText, previousJobStartedAt });
const since = Date.parse(first.since);

// 2. The deploy runs whose steps could hold a window: every run of the last thirty days,
// whatever its status, a hundred a page under the runs ceiling (spec 2.2). Thirty days because
// a re-run keeps its run's creation date and GitHub allows a re-run for thirty days, and a
// dispatched run can wait at the environment gate for as long. A jobs call, one per run, only
// for a run that is not complete or was updated inside the span less the longest job timeout:
// a step that ran inside the span moved its run's `updated_at`.
const runsById = new Map();
{
  const created = encodeURIComponent(`>=${iso(now - 30 * DAY).slice(0, 10)}`);
  for (let page = 1; ; page += 1) {
    const list = await github(
      `/actions/workflows/deploy.yml/runs?created=${created}&per_page=100&page=${page}`,
      "the deploy runs list",
    );
    const runs = list.workflow_runs ?? [];
    for (const run of runs) {
      runsById.set(String(run.id), run);
      if (runsById.size > RUNS_CEILING) fail("the runs ceiling was met with more to read");
    }
    if (runs.length < 100) break;
  }
}
const jobsByRun = {};
for (const [id, run] of runsById) {
  const updated = Date.parse(String(run.updated_at ?? ""));
  if (run.status === "completed" && !Number.isNaN(updated) && updated < since - TIMEOUT_MS) {
    continue;
  }
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
    const answer = await cloudflare(`/logs/audit?${query}`, "the audit log");
    const items = Array.isArray(answer.result) ? answer.result : (answer.result?.items ?? []);
    for (const entry of items) if (between(entry?.action?.time, since, before)) entries.push(entry);
    cursor = answer.result_info?.cursor ?? null;
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
// and that account's own comments on it, every page of each (spec 2.5).
const already = new Set();
{
  const issues = await pages(
    `/issues?state=all&creator=${encodeURIComponent(BOT)}`,
    "the issues list",
    null,
  );
  // The list is asked for the bot's issues; the author is read again on each, as it is on the
  // comments, so the state never rests on the filter alone.
  const mine = issues.filter(
    (i) => i.title === FINDING_TITLE && !i.pull_request && i.user?.login === BOT,
  );
  mine.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const issue = mine[0];
  if (issue) {
    const texts = [issue.body ?? ""];
    const comments = await pages(`/issues/${issue.number}/comments`, "the issue's comments", null);
    for (const comment of comments) {
      if (comment.user?.login === BOT) texts.push(comment.body ?? "");
    }
    for (const id of reportedIds(texts)) already.add(id);
  }
}

// 7. Judge, drop what was named before, format, write: the whole report to the artifact and the
// summary, the capped body to the issue's file.
const findings = unreported(judge({ entries, deployments, versions, windows: made }), already);
const { full, body, count } = format(findings, { runUrl });
writeFileSync(report, full === "" ? "" : `${full}\n`);
writeFileSync(bodyFile, body === "" ? "" : `${body}\n`);
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
