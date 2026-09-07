// scripts/check-credential-use.mjs against loopback stand-ins for GitHub and Cloudflare (spec
// 003 section 2.1): the exit codes, which token goes to which API, the span's anchor from the
// previous job, a normal hour writing an empty report, a finding written to the file and the
// summary, a refusal, a ceiling met with more to read, and the state read dropping what an
// earlier report named. The script is spawned asynchronously, since the stand-in lives in this
// process's event loop.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { root } from "./helpers.mjs";

const script = resolve(root, "scripts/check-credential-use.mjs");
const F = JSON.parse(
  readFileSync(resolve(root, "tests/config/fixtures/credential-use.json"), "utf8"),
);
const dir = mkdtempSync(join(tmpdir(), "portfolio-credential-use-"));
after(() => rmSync(dir, { recursive: true, force: true }));

const NOW = "2026-09-05T08:00:00Z";
let server;
let base;
let scenario;
const seen = [];

/** The stand-in: both APIs behind one loopback server, routed by path, shaped by `scenario`. */
before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    seen.push({ path: url.pathname, query: url.searchParams, auth: req.headers.authorization });
    const answer = scenario(url);
    res.setHeader("content-type", "application/json");
    res.writeHead(answer.status ?? 200);
    res.end(JSON.stringify(answer.body ?? {}));
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.closeAllConnections();
  server.close();
});
beforeEach(() => {
  seen.length = 0;
});

/** The routes a normal hour hits, each overridable by a scenario. */
function normal(overrides = {}) {
  return (url) => {
    const p = url.pathname;
    const q = url.searchParams;
    for (const [test, answer] of Object.entries(overrides)) {
      if (p.includes(test)) return typeof answer === "function" ? answer(url) : answer;
    }
    if (p.endsWith("/actions/workflows/watch.yml/runs")) {
      return { body: { workflow_runs: [{ id: 1, status: "completed", conclusion: "success" }] } };
    }
    if (p.endsWith("/actions/runs/1/jobs")) {
      return {
        body: {
          jobs: [
            { name: "credential use", conclusion: "success", started_at: "2026-09-05T06:00:00Z" },
          ],
        },
      };
    }
    if (p.endsWith("/actions/workflows/deploy.yml/runs")) {
      const first = q.get("status") === "completed" && q.get("page") === "1";
      return { body: { workflow_runs: first ? [F.run] : [] } };
    }
    if (p.endsWith(`/actions/runs/${F.run.id}/jobs`)) return { body: { jobs: F.jobs } };
    if (p.endsWith("/issues")) return { body: [] };
    if (p.endsWith("/logs/audit")) {
      return { body: { success: true, result: F.audit, result_info: { count: 6, cursor: null } } };
    }
    if (p.includes("/anandfrancis-com-preview/deployments")) {
      return { body: { result: { deployments: [F.deployment] } } };
    }
    if (p.includes("/anandfrancis-com-preview/versions")) {
      return { body: { result: { items: [F.version] } } };
    }
    if (p.includes("/deployments")) return { body: { result: { deployments: [] } } };
    if (p.includes("/versions")) return { body: { result: { items: [] } } };
    return { status: 404, body: { message: "no such route in the stand-in" } };
  };
}

/** Runs the script with the stand-in for both APIs; resolves with status, output and the report. */
function run({ env = {}, args = [], now = NOW } = {}) {
  const report = join(dir, `${Math.random().toString(36).slice(2)}.md`);
  const summary = join(dir, `${Math.random().toString(36).slice(2)}.summary.md`);
  const clean = { ...process.env };
  for (const name of Object.keys(clean)) {
    if (/^(cloudflare_|github_)/i.test(name)) delete clean[name];
  }
  const full = {
    ...clean,
    CLOUDFLARE_WATCH_TOKEN: "fake-watch",
    CLOUDFLARE_ACCOUNT_ID: "acct",
    GITHUB_TOKEN: "fake-github",
    GITHUB_REPOSITORY: "o/r",
    GITHUB_STEP_SUMMARY: summary,
    ...env,
  };
  for (const [name, value] of Object.entries(env)) if (value === null) delete full[name];
  return new Promise((done) => {
    execFile(
      process.execPath,
      [
        script,
        "--report",
        report,
        "--now",
        now,
        "--github-api",
        base,
        "--cloudflare-api",
        base,
        ...args,
      ],
      { cwd: root, encoding: "utf8", windowsHide: true, timeout: 20_000, env: full },
      (error, stdout, stderr) => {
        let text = null;
        try {
          text = readFileSync(report, "utf8");
        } catch {
          text = null;
        }
        let summaryText = null;
        try {
          summaryText = readFileSync(summary, "utf8");
        } catch {
          summaryText = null;
        }
        done({
          status: error ? (error.code ?? 1) : 0,
          out: stdout,
          err: stderr,
          report: text,
          summary: summaryText,
        });
      },
    );
  });
}

describe("check-credential-use.mjs", () => {
  it("fails without each variable, before any request", async () => {
    scenario = normal();
    for (const name of [
      "CLOUDFLARE_WATCH_TOKEN",
      "CLOUDFLARE_ACCOUNT_ID",
      "GITHUB_TOKEN",
      "GITHUB_REPOSITORY",
    ]) {
      const r = await run({ env: { [name]: null } });
      assert.equal(r.status, 1, name);
      assert.match(r.err, new RegExp(`${name} is not set`));
    }
    assert.equal(seen.length, 0);
  });
  it("refuses an override that is not a loopback host, and an unknown option", async () => {
    scenario = normal();
    const away = await run({ args: ["--github-api", "https://example.com"] });
    assert.equal(away.status, 1);
    assert.match(away.err, /--github-api was given more than once|loopback host only/);
    const odd = await run({ args: ["--verbose"] });
    assert.equal(odd.status, 1);
    assert.match(odd.err, /unknown option: --verbose/);
  });
  it("a normal hour: the right token to each API, the anchor from the previous job, an empty report", async () => {
    scenario = normal();
    const r = await run();
    assert.equal(r.status, 0, r.err);
    assert.equal(r.report, "");
    assert.match(
      r.out,
      /^Credential-use check: 0 finding\(s\) from 6 entries, 1 deployments and 1 versions against 1 windows, 2026-09-05T06:00:00\.000Z to 2026-09-05T08:00:00\.000Z\.$/m,
    );
    assert.match(r.summary, /Nothing unexpected/);
    for (const hit of seen) {
      if (hit.path.startsWith("/repos/")) assert.equal(hit.auth, "Bearer fake-github", hit.path);
      else assert.equal(hit.auth, "Bearer fake-watch", hit.path);
    }
    const audit = seen.find((h) => h.path.endsWith("/logs/audit"));
    assert.equal(audit.query.get("since"), "2026-09-05T06:00:00.000Z");
    assert.equal(audit.query.get("limit"), "1000");
    assert.equal(
      seen.find((h) => h.path.includes(`/runs/${F.run.id}/jobs`)).query.get("filter"),
      "all",
    );
  });
  it("a finding: written to the report, the summary and stdout, from the allow-list", async () => {
    const dash = structuredClone(F.audit[2]);
    dash.id = "01a07061-0000-7000-8000-000000000002";
    dash.action.time = "2026-09-05T07:30:00.000Z";
    dash.actor = {
      type: "user",
      context: "dash",
      email: "redacted-email",
      id: "redacted-actor-id",
      ip_address: "203.0.113.7",
    };
    scenario = normal({
      "/logs/audit": {
        body: {
          success: true,
          result: [...F.audit, dash],
          result_info: { count: 7, cursor: null },
        },
      },
    });
    const r = await run();
    assert.equal(r.status, 0, r.err);
    assert.match(
      r.report,
      /^- 01a07061-0000-7000-8000-000000000002 \[a55c0a43\] 2026-09-05T07:30:00\.000Z unexpected actor: dashboard, Upload Version, on `anandfrancis-com-preview`\n$/,
    );
    assert.match(r.summary, /unexpected actor: dashboard/);
    assert.match(r.out, /1 finding\(s\)/);
    for (const secret of ["redacted-email", "203.0.113.7", "redacted-actor-id", "acct"]) {
      assert.ok(!r.report.includes(secret) && !r.out.includes(secret), secret);
    }
  });
  it("stops before a running deploy step", async () => {
    const live = structuredClone(F.jobs);
    const step = live[1].steps.find((s) => s.name === "deploy");
    step.status = "in_progress";
    step.conclusion = null;
    step.completed_at = null;
    step.started_at = "2026-09-05T07:59:30Z";
    scenario = normal({ [`/actions/runs/${F.run.id}/jobs`]: { body: { jobs: live } } });
    const r = await run();
    assert.equal(r.status, 0, r.err);
    const audit = seen.find((h) => h.path.endsWith("/logs/audit"));
    assert.equal(audit.query.get("before"), "2026-09-05T07:58:30.000Z");
  });
  it("a refusal is exit 1 with the endpoint's name and status, never its URL", async () => {
    scenario = normal({ "/logs/audit": { status: 403, body: { success: false } } });
    const r = await run();
    assert.equal(r.status, 1);
    assert.match(r.err, /the audit log answered 403/);
    assert.ok(!r.err.includes("acct") && !r.err.includes("/logs/audit"));
    assert.equal(r.report, null);
  });
  it("a ceiling met with more to read is exit 1, never a partial report", async () => {
    scenario = normal({
      "/logs/audit": {
        body: { success: true, result: [F.audit[0]], result_info: { count: 1, cursor: "more" } },
      },
    });
    const r = await run();
    assert.equal(r.status, 1);
    assert.match(r.err, /the audit-log ceiling was met with more to read/);
    assert.equal(seen.filter((h) => h.path.endsWith("/logs/audit")).length, 20);
    const flood = normal({
      "/actions/workflows/deploy.yml/runs": (url) => ({
        body: {
          workflow_runs: Array.from({ length: 50 }, (_, i) => ({
            ...F.run,
            id: Number(url.searchParams.get("page")) * 100 + i,
            created_at: NOW,
          })),
        },
      }),
    });
    scenario = flood;
    const s = await run();
    assert.equal(s.status, 1);
    assert.match(s.err, /the runs ceiling was met with more to read/);
  });
  it("drops what the newest finding issue and the workflow's own comments already named", async () => {
    const dash = structuredClone(F.audit[2]);
    dash.id = "01a07061-0000-7000-8000-000000000003";
    dash.action.time = "2026-09-05T07:30:00.000Z";
    dash.actor = { type: "user", context: "dash" };
    scenario = normal({
      "/logs/audit": {
        body: {
          success: true,
          result: [...F.audit, dash],
          result_info: { count: 7, cursor: null },
        },
      },
      "/issues/7/comments": {
        body: [
          {
            user: { login: "github-actions[bot]" },
            body: "- 01a07061-0000-7000-8000-000000000003 [a55c0a43] earlier",
          },
          {
            user: { login: "someone-else" },
            body: "- 01a07061-0000-7000-8000-000000000004 not the bot's",
          },
        ],
      },
      "/issues": {
        body: [
          {
            number: 7,
            title: "A credential was used outside the workflows",
            state: "closed",
            created_at: "2026-09-05T07:40:00Z",
            body: "nothing here",
          },
          {
            number: 6,
            title: "The watch failed",
            state: "open",
            created_at: "2026-09-05T07:50:00Z",
            body: "- 01a07061-0000-7000-8000-000000000003 wrong issue",
          },
        ],
      },
    });
    const r = await run();
    assert.equal(r.status, 0, r.err);
    assert.equal(r.report, "");
    assert.match(r.out, /0 finding\(s\)/);
  });
});
