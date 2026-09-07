// scripts/lib/credential-use.mjs against the real entries of 5 September 2026 (spec 003 gate 1):
// the judgement in the spec's order, actor, window, shape; the span's anchor and its stop at a
// running step; the report's two line shapes, its ordering, its cap and its allow-list, so
// nothing the log carries about a person, and no text a deployer chose, can reach the public
// issue; and the state read, so a finding is named once whatever the overlap.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  CAP,
  DEPLOY_KINDS,
  REASONS,
  WORKERS,
  format,
  idsOf,
  judge,
  line,
  reportedIds,
  safe,
  span,
  tokenName,
  unreported,
  windows,
  workerOf,
} from "../../scripts/lib/credential-use.mjs";
import { root } from "./helpers.mjs";

const F = JSON.parse(
  readFileSync(resolve(root, "tests/config/fixtures/credential-use.json"), "utf8"),
);
const clone = (value) => structuredClone(value);
const HOUR = 3_600_000;

/** A copy of the fixture's entry at `index`, its time moved by `shiftMs`, then `patch` applied. */
const entry = (index, shiftMs = 0, patch = (e) => e) => {
  const e = clone(F.audit[index]);
  e.action.time = new Date(Date.parse(e.action.time) + shiftMs).toISOString();
  return patch(e) ?? e;
};
const deployment = (shiftMs = 0, worker = WORKERS.preview) => ({
  ...clone(F.deployment),
  created_on: new Date(Date.parse(F.deployment.created_on) + shiftMs).toISOString(),
  worker,
});
const version = (shiftMs = 0, worker = WORKERS.preview) => {
  const v = clone(F.version);
  v.metadata.created_on = new Date(Date.parse(v.metadata.created_on) + shiftMs).toISOString();
  return { ...v, worker };
};
const jobsByRun = { [F.run.id]: F.jobs };
const { windows: W } = windows(jobsByRun);
const reasons = (findings) => findings.map((f) => f.reason);

describe("windows", () => {
  it("makes one window from the real run, around its deploy step, padded by a minute", () => {
    assert.equal(W.length, 1);
    const [w] = W;
    assert.equal(w.job, "preview");
    assert.equal(w.step, "deploy");
    assert.equal(w.worker, WORKERS.preview);
    assert.deepEqual(w.kinds, DEPLOY_KINDS);
    assert.equal(new Date(w.start).toISOString(), "2026-09-05T07:01:57.000Z");
    assert.equal(new Date(w.end).toISOString(), "2026-09-05T07:04:04.000Z");
  });
  it("gives no window to a run whose deploy step did not run, or ran under its old name", () => {
    const skipped = clone(F.jobs);
    skipped[1].steps.find((s) => s.name === "deploy").conclusion = "skipped";
    assert.equal(windows({ 1: skipped }).windows.length, 0);
    const unnamed = clone(F.jobs);
    unnamed[1].steps.find((s) => s.name === "deploy").name = "Run pnpm run deploy:preview";
    assert.equal(windows({ 2: unnamed }).windows.length, 0);
    const failed = clone(F.jobs);
    failed[1].steps.find((s) => s.name === "deploy").conclusion = "failure";
    assert.equal(windows({ 3: failed }).windows.length, 0);
  });
  it("returns a running deploy step apart, as no window", () => {
    const live = clone(F.jobs);
    const step = live[1].steps.find((s) => s.name === "deploy");
    step.status = "in_progress";
    step.conclusion = null;
    step.completed_at = null;
    const result = windows({ 4: live });
    assert.equal(result.windows.length, 0);
    assert.deepEqual(result.running, [
      { runId: "4", job: "preview", step: "deploy", startedAt: "2026-09-05T07:02:57Z" },
    ]);
  });
});

describe("span", () => {
  it("reaches back 75 minutes, or to the previous successful job's start when earlier", () => {
    const now = "2026-09-05T08:00:00Z";
    assert.equal(span({ now }).since, "2026-09-05T06:45:00.000Z");
    assert.equal(span({ now }).before, "2026-09-05T08:00:00.000Z");
    const anchored = span({ now, previousJobStartedAt: "2026-09-05T05:17:03Z" });
    assert.equal(anchored.since, "2026-09-05T05:17:03.000Z");
    const later = span({ now, previousJobStartedAt: "2026-09-05T07:17:03Z" });
    assert.equal(later.since, "2026-09-05T06:45:00.000Z");
  });
  it("stops before a running deploy step, by the padding", () => {
    const s = span({ now: "2026-09-05T08:00:00Z", runningStepStartedAt: "2026-09-05T07:59:30Z" });
    assert.equal(s.before, "2026-09-05T07:58:30.000Z");
  });
});

describe("judge, in the spec's order", () => {
  it("an expected token inside its step's window, with its deployment and version: nothing", () => {
    const findings = judge({
      entries: F.audit,
      deployments: [deployment()],
      versions: [version()],
      windows: W,
    });
    assert.deepEqual(findings, []);
  });
  it("the same outside every window: reported, the Cloudflare service's entry too", () => {
    const shifted = F.audit.map((_, i) => entry(i, HOUR));
    const findings = judge({
      entries: shifted,
      deployments: [deployment(HOUR)],
      versions: [version(HOUR)],
      windows: W,
    });
    assert.equal(findings.length, 8);
    assert.ok(reasons(findings).every((r) => r === REASONS.outside));
  });
  it("an unknown api_token name, a dash actor and an oauth actor inside a window: reported", () => {
    const stranger = entry(2, 0, (e) => {
      e.actor.token.name = "anandfrancis.com preview deploy (GitHub Actions) ";
    });
    const dash = entry(2, 0, (e) => {
      e.actor = { type: "user", context: "dash", email: "redacted-email", id: "redacted-actor-id" };
    });
    const oauth = entry(2, 0, (e) => {
      e.actor = {
        type: "user",
        context: "oauth",
        email: "redacted-email",
        id: "redacted-actor-id",
      };
    });
    const findings = judge({ entries: [stranger, dash, oauth], windows: W });
    assert.deepEqual(reasons(findings), [REASONS.actor, REASONS.actor, REASONS.actor]);
  });
  it("a delegated_service entry inside a window: nothing; outside: reported", () => {
    assert.deepEqual(judge({ entries: [entry(1)], windows: W }), []);
    assert.deepEqual(reasons(judge({ entries: [entry(1, HOUR)], windows: W })), [REASONS.outside]);
  });
  it("a second deployment inside a window: reported, in the log and in the list", () => {
    const again = entry(3, 1_000);
    const findings = judge({
      entries: [...F.audit, again],
      deployments: [deployment(), deployment(1_000)],
      versions: [version()],
      windows: W,
    });
    assert.deepEqual(reasons(findings), [REASONS.second, REASONS.second]);
    assert.equal(findings[0].kind, "audit");
    assert.equal(findings[1].kind, "deployment");
  });
  it("a Delete Script inside a window: reported, beyond the step's shape", () => {
    const gone = entry(2, 0, (e) => {
      e.action = { ...e.action, description: "Delete Script", type: "delete" };
      e.raw.method = "DELETE";
      e.raw.uri = "/accounts/redacted-account/workers/scripts/anandfrancis-com-preview";
      e.resource = {
        id: "anandfrancis-com-preview",
        product: "workers",
        scope: "accounts",
        type: "scripts",
      };
    });
    assert.deepEqual(reasons(judge({ entries: [gone], windows: W })), [REASONS.shape]);
  });
  it("a preview step's token touching the production Worker: reported", () => {
    const other = entry(2, 0, (e) => {
      e.raw.uri = e.raw.uri.replace(WORKERS.preview, WORKERS.production);
      e.resource.id = WORKERS.production;
    });
    assert.deepEqual(reasons(judge({ entries: [other], windows: W })), [REASONS.worker]);
    const listed = judge({ deployments: [deployment(0, WORKERS.production)], windows: W });
    assert.deepEqual(reasons(listed), [REASONS.worker]);
  });
  it("a rollback step's deployment with no version: nothing; a version there: reported", () => {
    const jobs = clone(F.jobs);
    const rollback = jobs.find((j) => j.name === "rollback-preview");
    rollback.conclusion = "success";
    rollback.steps = [
      {
        name: "roll back",
        status: "completed",
        conclusion: "success",
        started_at: "2026-09-05T09:00:00Z",
        completed_at: "2026-09-05T09:00:20Z",
      },
    ];
    const { windows: rolled } = windows({ 9: jobs });
    const shift = Date.parse("2026-09-05T09:00:10Z") - Date.parse(F.deployment.created_on);
    assert.deepEqual(judge({ deployments: [deployment(shift)], windows: rolled }), []);
    const vshift = Date.parse("2026-09-05T09:00:10Z") - Date.parse(F.version.metadata.created_on);
    assert.deepEqual(reasons(judge({ versions: [version(vshift)], windows: rolled })), [
      REASONS.shape,
    ]);
  });
  it("a run whose deploy step did not run: no window, its entries reported", () => {
    const skipped = clone(F.jobs);
    skipped[1].steps.find((s) => s.name === "deploy").conclusion = "skipped";
    const { windows: none } = windows({ [F.run.id]: skipped });
    const findings = judge({ entries: F.audit, windows: none });
    assert.equal(findings.length, 6);
    assert.ok(reasons(findings).every((r) => r === REASONS.outside));
  });
  it("a kind missing from a window is not a finding", () => {
    const withoutUpload = F.audit.filter((e) => e.action.description !== "Upload Assets");
    assert.deepEqual(judge({ entries: withoutUpload, windows: W }), []);
  });
});

describe("the token fields in both shapes", () => {
  it("reads the nested shape the log returns and the flat one the schema names", () => {
    assert.equal(tokenName(F.audit[0].actor), "anandfrancis.com preview deploy (GitHub Actions)");
    assert.equal(
      tokenName({ context: "api_token", token_id: "redacted-token-id", token_name: "x" }),
      "x",
    );
    const flat = entry(2, 0, (e) => {
      const { name } = e.actor.token;
      delete e.actor.token;
      e.actor.token_id = "redacted-token-id";
      e.actor.token_name = name;
    });
    assert.deepEqual(judge({ entries: [flat], windows: W }), []);
  });
  it("finds the Worker in a path and the ids an entry carries", () => {
    assert.equal(workerOf(F.audit[2].raw.uri), WORKERS.preview);
    assert.equal(workerOf(F.audit[1].raw.uri), null);
    assert.deepEqual(idsOf(F.audit[3]), {
      deployment: "ad124b60-a880-4640-9a20-898f9671f8a1",
      version: "a55c0a43-f5e6-4334-b533-30882faf394a",
    });
    assert.deepEqual(idsOf(F.audit[2]), {
      deployment: null,
      version: "a55c0a43-f5e6-4334-b533-30882faf394a",
    });
    assert.deepEqual(idsOf(F.audit[0]), { deployment: null, version: null });
  });
});

const FORBIDDEN = [
  "redacted-email",
  "203.0.113.7",
  "redacted-account",
  "redacted-actor-id",
  "redacted-token-id",
  "redacted-user-agent",
  "redacted-ray",
  "redacted-author-id",
];

describe("the report", () => {
  it("prints from the allow-list only: an entry carrying every forbidden field shows none", () => {
    const shifted = F.audit.map((_, i) => entry(i, HOUR));
    const { full } = format(
      judge({
        entries: shifted,
        deployments: [deployment(HOUR)],
        versions: [version(HOUR)],
        windows: W,
      }),
    );
    for (const secret of FORBIDDEN) assert.ok(!full.includes(secret), `${secret} leaked`);
    assert.match(full, /token `anandfrancis\.com preview deploy \(GitHub Actions\)`/);
    assert.match(full, /on `anandfrancis-com-preview`/);
  });
  it("renders chosen text as text: a link, a backtick, a bidi override and U+2028 in a message", () => {
    const v = version(HOUR);
    v.annotations["workers/message"] =
      "see https://evil.example/x `code` ‮abc - deadbeef [cafebabe] y";
    const [finding] = judge({ versions: [v], windows: W });
    const text = line(finding);
    assert.match(
      text,
      /message `see https:\/\/evil\.example\/x code abc- deadbeef \[cafebabe\] y`$/,
    );
    assert.ok(!text.includes("‮") && !text.includes(" "));
    assert.equal(text.split("\n").length, 1);
    assert.ok(!reportedIds([text]).has("cafebabe"), "an id inside the chosen text was read");
    assert.ok(reportedIds([text]).has("a55c0a43"));
  });
  it("escapes through one door: strips the categories, caps the length, names emptiness", () => {
    assert.equal(safe("a`b|c\nde‎f"), "`abcdef`");
    assert.equal(safe(""), "`empty`");
    assert.equal(safe("  "), "`empty`");
    assert.equal(safe("x".repeat(200)).length, 122);
  });
  it("orders production before preview, lists before entries, then time; caps the body", () => {
    const many = [];
    for (let i = 0; i < 44; i += 1) many.push(entry(2, HOUR + i * 1_000));
    const findings = judge({
      entries: many,
      deployments: [deployment(HOUR, WORKERS.production), deployment(HOUR + 5_000)],
      versions: [version(HOUR)],
      windows: W,
    });
    const { full, body, count } = format(findings, { runUrl: "https://example.test/run/1" });
    assert.equal(count, 47);
    const lines = full.split("\n");
    assert.match(lines[0], /deployment.*on `anandfrancis-com`$/);
    assert.match(lines[1], /version 76.*on `anandfrancis-com-preview`$/);
    assert.match(lines[2], /deployment.*on `anandfrancis-com-preview`$/);
    assert.match(lines[3], /Upload Version/);
    const bodyLines = body.split("\n");
    assert.equal(bodyLines.length, CAP + 1);
    assert.equal(
      bodyLines[CAP],
      "- and 7 more; the whole report is this run's artifact and summary: https://example.test/run/1",
    );
  });
  it("puts the ids before the first backtick in both line shapes", () => {
    const shifted = judge({
      entries: [entry(3, HOUR)],
      deployments: [deployment(HOUR)],
      versions: [version(HOUR)],
      windows: W,
    });
    // judge returns the log's findings first, then the deployments', then the versions'.
    const texts = shifted.map(line);
    assert.match(
      texts[0],
      /^- 01a07060-bac7-7256-9879-e2c3c4f76972 \[ad124b60\] \[a55c0a43\] 2026-09-05T08:03:02\.599Z outside every window: token `/,
    );
    assert.match(
      texts[1],
      /^- \[ad124b60\] \[a55c0a43\] 2026-09-05T08:03:02\.687Z outside every window: deployment/,
    );
    assert.match(
      texts[2],
      /^- \[a55c0a43\] 2026-09-05T08:03:02\.362Z outside every window: version 76/,
    );
  });
});

describe("the state read, once and only once", () => {
  it("drops what a previous report named, from the ids before the first backtick", () => {
    const shifted = F.audit.map((_, i) => entry(i, HOUR));
    const findings = judge({
      entries: shifted,
      deployments: [deployment(HOUR)],
      versions: [version(HOUR)],
      windows: W,
    });
    const { body } = format(findings);
    const ids = reportedIds([body]);
    assert.equal(ids.size, 8);
    assert.deepEqual(unreported(findings, ids), []);
    const later = entry(5, HOUR + 60_000, (e) => {
      e.id = "01a07061-0000-7000-8000-000000000001";
    });
    assert.equal(
      unreported([...findings, ...judge({ entries: [later], windows: W })], ids).length,
      1,
    );
  });
  it("reads a closed issue's comments the same way, and never a stranger's line", () => {
    const stranger = "- 01a07060-bac7-7256-9879-e2c3c4f76972 said nothing\nsome prose [deadbeef]";
    assert.deepEqual([...reportedIds([stranger])], ["01a07060-bac7-7256-9879-e2c3c4f76972"]);
    assert.equal(reportedIds(["prose with [deadbeef] and no list marker"]).size, 0);
  });
});
