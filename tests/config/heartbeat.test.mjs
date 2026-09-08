// The watch heartbeat (spec 003 gate 2, section 6): the library with injected times, a fresh
// successful run, a stale one, a failed one and no run at all; and the script against a loopback
// stand-in for GitHub, the line it prints, the remedy it names, a refusal. The script is spawned
// asynchronously, since the stand-in lives in this process's event loop.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { describe as span, judge, LIMIT_MS, REMEDY } from "../../scripts/lib/heartbeat.mjs";
import { root } from "./helpers.mjs";

const NOW = "2026-09-07T12:00:00Z";
const fresh = { id: 1, conclusion: "success", updated_at: "2026-09-07T11:20:00Z" };

describe("the heartbeat's judgement", () => {
  it("a fresh successful run: ok, with its age", () => {
    assert.deepEqual(judge({ run: fresh, now: NOW }), {
      ok: true,
      reason: "watch run 1 passed 40 minute(s) ago",
    });
  });
  it("a stale run: not ok, over the limit, whatever it concluded", () => {
    const stale = { ...fresh, updated_at: "2026-09-07T08:59:00Z" };
    const verdict = judge({ run: stale, now: NOW });
    assert.equal(verdict.ok, false);
    assert.equal(
      verdict.reason,
      "watch run 1 finished 3 hour(s) 1 minute(s) ago, over the limit of 3 hour(s)",
    );
    const staleFailure = { ...stale, conclusion: "failure" };
    assert.match(judge({ run: staleFailure, now: NOW }).reason, /over the limit/);
    const edge = { ...fresh, updated_at: new Date(Date.parse(NOW) - LIMIT_MS).toISOString() };
    assert.equal(judge({ run: edge, now: NOW }).ok, true);
  });
  it("a fresh failed run: not ok, naming its conclusion", () => {
    const failed = { ...fresh, conclusion: "failure" };
    assert.deepEqual(judge({ run: failed, now: NOW }), {
      ok: false,
      reason: "watch run 1 concluded failure 40 minute(s) ago",
    });
    assert.match(judge({ run: { ...fresh, conclusion: null }, now: NOW }).reason, /other/);
    // Only fixed-format values reach the line: a crafted id or conclusion is not printed.
    const odd = judge({
      run: { ...fresh, id: "1\n::error::x", conclusion: "failure\n::warning::y" },
      now: NOW,
    });
    assert.equal(odd.reason, "watch run ? concluded other 40 minute(s) ago");
  });
  it("no run at all, or a run with no completion time: not ok", () => {
    assert.deepEqual(judge({ run: undefined, now: NOW }), {
      ok: false,
      reason: "no completed watch run exists",
    });
    assert.match(judge({ run: { id: 9 }, now: NOW }).reason, /run 9 carries no completion time/);
    assert.match(judge({ run: fresh, now: "soon" }).reason, /not a date/);
  });
  it("describes a duration in minutes, or hours and minutes", () => {
    assert.equal(span(59 * 60_000), "59 minute(s)");
    assert.equal(span(60 * 60_000), "1 hour(s)");
    assert.equal(span(125 * 60_000), "2 hour(s) 5 minute(s)");
    assert.equal(span(-5), "0 minute(s)");
  });
});

const script = resolve(root, "scripts/check-heartbeat.mjs");
let server;
let base;
let answer;
const seen = [];

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    seen.push({ path: url.pathname, query: url.searchParams, auth: req.headers.authorization });
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

/** Runs the script against the stand-in; `raw` passes `args` alone, without the stand-in. */
function run({ env = {}, args = [], raw = false } = {}) {
  const clean = { ...process.env };
  for (const name of Object.keys(clean)) if (/^github_/i.test(name)) delete clean[name];
  const full = { ...clean, GITHUB_TOKEN: "fake-github", GITHUB_REPOSITORY: "o/r", ...env };
  for (const [name, value] of Object.entries(env)) if (value === null) delete full[name];
  return new Promise((done) => {
    execFile(
      process.execPath,
      [script, ...(raw ? [] : ["--now", NOW, "--github-api", base]), ...args],
      { cwd: root, encoding: "utf8", windowsHide: true, timeout: 20_000, env: full },
      (error, stdout, stderr) => {
        done({ status: error ? (error.code ?? 1) : 0, out: stdout, err: stderr });
      },
    );
  });
}

describe("check-heartbeat.mjs", () => {
  it("asks for the newest completed watch run with the token, and passes on a fresh success", async () => {
    seen.length = 0;
    answer = { body: { workflow_runs: [fresh] } };
    const r = await run();
    assert.equal(r.status, 0, r.err);
    assert.match(r.out, /^Watch heartbeat: watch run 1 passed 40 minute\(s\) ago\.$/m);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].path, "/repos/o/r/actions/workflows/watch.yml/runs");
    assert.equal(seen[0].query.get("status"), "completed");
    assert.equal(seen[0].query.get("per_page"), "1");
    assert.equal(seen[0].auth, "Bearer fake-github");
  });
  it("fails on a stale run, a failed run and no run, naming the remedy", async () => {
    answer = { body: { workflow_runs: [{ ...fresh, updated_at: "2026-09-07T08:00:00Z" }] } };
    const stale = await run();
    assert.equal(stale.status, 1);
    assert.match(stale.err, /over the limit of 3 hour\(s\)/);
    assert.ok(stale.err.includes(REMEDY));
    assert.match(stale.err, /gh workflow enable watch\.yml/);
    answer = { body: { workflow_runs: [{ ...fresh, conclusion: "failure" }] } };
    assert.match((await run()).err, /concluded failure/);
    answer = { body: { workflow_runs: [] } };
    assert.match((await run()).err, /no completed watch run exists/);
  });
  it("a refusal is exit 1 with the endpoint's name and status; a missing variable fails first", async () => {
    answer = { status: 403, body: { message: "no" } };
    const r = await run();
    assert.equal(r.status, 1);
    assert.match(r.err, /the watch runs list answered 403/);
    assert.ok(!r.err.includes("/repos/") && !r.err.includes("fake-github"));
    seen.length = 0;
    const missing = await run({ env: { GITHUB_TOKEN: null } });
    assert.equal(missing.status, 1);
    assert.match(missing.err, /GITHUB_TOKEN is not set/);
    assert.equal(seen.length, 0);
    const away = await run({ args: ["--github-api", "https://example.com"], raw: true });
    assert.equal(away.status, 1);
    assert.match(away.err, /loopback host only/);
    assert.equal(seen.length, 0, "refused before any request");
    // The seams take --name=value too, and refuse a repeat, as the check script's do.
    answer = { body: { workflow_runs: [fresh] } };
    const joined = await run({ args: [`--now=${NOW}`, `--github-api=${base}`], raw: true });
    assert.equal(joined.status, 0, joined.err);
    const twice = await run({ args: ["--github-api", "https://example.com"] });
    assert.equal(twice.status, 1);
    assert.match(twice.err, /--github-api was given more than once/);
    const odd = await run({ args: ["--verbose"] });
    assert.equal(odd.status, 1);
    assert.match(odd.err, /unknown option: --verbose/);
  });
});
