// The expiry check (spec.md section 3.3): the committed file passes today; an expiry inside the
// warning window, a passed expiry and a stale rehearsal each fail and name the field; the
// online form reads the verify endpoint (a local stand-in here) and fails on a drifted date, an
// inactive token or a missing token. The script is spawned asynchronously: a synchronous spawn
// would block this process's event loop, and the stand-in server lives in it.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { root } from "./helpers.mjs";

const script = resolve(root, "scripts/check-expiry.mjs");
const dir = mkdtempSync(join(tmpdir(), "portfolio-expiry-"));
after(() => rmSync(dir, { recursive: true, force: true }));

const base = {
  cloudflarePreviewExpires: "2027-09-03",
  cloudflareProductionExpires: "2027-09-03",
  claudeOauthExpires: "2027-09-03",
  rollbackRehearsed: "2026-09-02",
  rollbackIntervalDays: 180,
  warnDays: 30,
};

/** Runs the script with the given arguments and environment; resolves with status and output. */
function exec(args, env = {}) {
  const clean = { ...process.env };
  for (const name of Object.keys(clean)) {
    if (/^(cloudflare_api_token|expiry_verify_url)$/i.test(name)) delete clean[name];
  }
  return new Promise((done) => {
    execFile(
      process.execPath,
      [script, ...args],
      {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
        timeout: 20_000,
        env: { ...clean, ...env },
      },
      (error, stdout, stderr) =>
        done({ status: error ? (error.code ?? 1) : 0, out: stdout, err: stderr }),
    );
  });
}

/** Writes a config with overrides and runs the check for the given day. */
function run(overrides, { today = "2026-09-03", extra = [], env = {} } = {}) {
  const file = join(dir, `${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, JSON.stringify({ ...base, ...overrides }));
  return exec(["--file", file, "--today", today, ...extra], env);
}

describe("check-expiry.mjs, offline", () => {
  it("passes the committed file today", async () => {
    const r = await exec([]);
    assert.equal(r.status, 0, r.err);
    assert.match(r.out.trim().split(/\r?\n/).pop(), /^Expiry check: nearest expiry in \d+ days/);
  });
  it("reports the nearest expiry and the rehearsal age", async () => {
    const r = await run({}, { today: "2026-09-03" });
    assert.equal(r.status, 0, r.err);
    assert.match(r.out, /nearest expiry in 365 days \(cloudflarePreviewExpires\)/);
    assert.match(r.out, /rollback rehearsed 1 days ago, interval 180/);
  });
  it("fails inside the warning window and names the field", async () => {
    const r = await run({ claudeOauthExpires: "2026-09-20" });
    assert.equal(r.status, 1);
    assert.match(r.err, /claudeOauthExpires expires in 17 day\(s\)/);
  });
  it("fails on a passed expiry", async () => {
    const r = await run({ cloudflareProductionExpires: "2026-08-01" });
    assert.equal(r.status, 1);
    assert.match(r.err, /cloudflareProductionExpires passed 33 day\(s\) ago/);
  });
  it("fails when the rehearsal is older than the interval", async () => {
    const r = await run({}, { today: "2027-03-15" });
    assert.equal(r.status, 1);
    assert.match(r.err, /rehearsed 194 days ago/);
  });
  it("fails on a malformed date", async () => {
    const r = await run({ rollbackRehearsed: "yesterday" });
    assert.equal(r.status, 1);
    assert.match(r.err, /rollbackRehearsed is not a real YYYY-MM-DD date/);
  });
  it("fails on an impossible date rather than passing on NaN", async () => {
    const r = await run({ claudeOauthExpires: "2027-13-01" });
    assert.equal(r.status, 1);
    assert.match(r.err, /claudeOauthExpires is not a real YYYY-MM-DD date/);
  });
  it("fails on a date that would roll over", async () => {
    const r = await run({ cloudflarePreviewExpires: "2027-02-30" });
    assert.equal(r.status, 1);
    assert.match(r.err, /cloudflarePreviewExpires is not a real YYYY-MM-DD date/);
  });
  it("warns on the day the window opens and passes the day before", async () => {
    const edge = await run({ claudeOauthExpires: "2026-10-03" });
    assert.equal(edge.status, 1);
    assert.match(edge.err, /expires in 30 day\(s\)/);
    const before = await run({ claudeOauthExpires: "2026-10-04" });
    assert.equal(before.status, 0, before.err);
  });
  it("passes a rehearsal exactly the interval ago and fails one in the future", async () => {
    const exact = await run({}, { today: "2027-03-01" });
    assert.equal(exact.status, 0, exact.err);
    const future = await run({ rollbackRehearsed: "2026-12-01" });
    assert.equal(future.status, 1);
    assert.match(future.err, /is in the future/);
  });
  it("refuses --file with no value and a file that is not an object", async () => {
    const bare = await exec(["--file"]);
    assert.equal(bare.status, 1);
    assert.match(bare.err, /--file needs a value/);
    const file = join(dir, "null.json");
    writeFileSync(file, "null");
    const nul = await exec(["--file", file]);
    assert.equal(nul.status, 1);
    assert.match(nul.err, /must hold a JSON object/);
  });
});

describe("check-expiry.mjs, online", () => {
  let server;
  let answer;
  let url;
  before(async () => {
    server = createServer((_request, res) => {
      res.setHeader("content-type", "application/json");
      res.writeHead(answer.status ?? 200);
      res.end(JSON.stringify(answer.body));
    });
    await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
    url = `http://127.0.0.1:${server.address().port}/verify`;
  });
  after(() => {
    server.closeAllConnections();
    server.close();
  });
  const online = (env) => run({}, { extra: ["--online"], env: { EXPIRY_VERIFY_URL: url, ...env } });

  it("passes when the token is active and expires when recorded", async () => {
    answer = {
      body: { success: true, result: { status: "active", expires_on: "2027-09-03T00:00:00Z" } },
    };
    const r = await online({ CLOUDFLARE_API_TOKEN: "fake" });
    assert.equal(r.status, 0, r.err);
    assert.match(r.out, /online: preview token active, expires 2027-09-03/);
  });
  it("fails when the recorded date drifts from the real one", async () => {
    answer = {
      body: { success: true, result: { status: "active", expires_on: "2027-10-03T00:00:00Z" } },
    };
    const r = await online({ CLOUDFLARE_API_TOKEN: "fake" });
    assert.equal(r.status, 1);
    assert.match(r.err, /says 2027-09-03 but the token expires 2027-10-03/);
  });
  it("fails when the token is not active", async () => {
    answer = {
      body: { success: true, result: { status: "disabled", expires_on: "2027-09-03T00:00:00Z" } },
    };
    const r = await online({ CLOUDFLARE_API_TOKEN: "fake" });
    assert.equal(r.status, 1);
    assert.match(r.err, /is disabled, not active/);
  });
  it("fails when the endpoint rejects the token", async () => {
    answer = { status: 401, body: { success: false, errors: [{ message: "Invalid" }] } };
    const r = await online({ CLOUDFLARE_API_TOKEN: "fake" });
    assert.equal(r.status, 1);
    assert.match(r.err, /answered 401/);
  });
  it("fails without a token", async () => {
    answer = { body: {} };
    const r = await online({});
    assert.equal(r.status, 1);
    assert.match(r.err, /needs CLOUDFLARE_API_TOKEN/);
  });
  it("refuses an override that is not a loopback host, before sending anything", async () => {
    answer = { body: {} };
    const r = await run(
      {},
      {
        extra: ["--online"],
        env: { EXPIRY_VERIFY_URL: "https://example.com/verify", CLOUDFLARE_API_TOKEN: "fake" },
      },
    );
    assert.equal(r.status, 1);
    assert.match(r.err, /loopback host only/);
  });
});
