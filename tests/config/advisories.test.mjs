// The advisory check: every identifier silenced in package.json's auditConfig.ignoreCves is
// asked of the advisory database, and a patched version anywhere in the answer fails the run, so
// a silence cannot outlive its reason. The database is a local stand-in here, and the script is
// spawned asynchronously, since a synchronous spawn would block the event loop the stand-in
// server lives in.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { root } from "./helpers.mjs";

const script = resolve(root, "scripts/check-advisories.mjs");

/** What the stand-in answers next: a status, or a list of advisories keyed by identifier. */
let answer = { status: 200, advisories: {} };
let url = "";
let server;

before(async () => {
  server = createServer((request, response) => {
    if (answer.status !== 200) {
      response.writeHead(answer.status, { "content-type": "application/json" });
      response.end("{}");
      return;
    }
    const id = new URL(request.url, "http://127.0.0.1").searchParams.get("cve_id");
    const advisory = answer.advisories[id];
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(advisory ? [advisory] : []));
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  url = `http://127.0.0.1:${server.address().port}/advisories`;
});
after(() => server?.close());

function exec(args) {
  return new Promise((done) => {
    execFile(
      process.execPath,
      [script, ...args],
      { cwd: root, encoding: "utf8", windowsHide: true, timeout: 20_000 },
      (error, stdout, stderr) =>
        done({ status: error?.code ?? 0, out: `${stdout}${stderr}`.trim() }),
    );
  });
}

const unpatched = { vulnerabilities: [{ first_patched_version: null }] };
const patched = { vulnerabilities: [{ first_patched_version: "2.0.2" }] };

describe("check-advisories", () => {
  it("passes while every silenced advisory is still unpatched", async () => {
    answer = { status: 200, advisories: { "CVE-2026-56876": unpatched } };
    const { status, out } = await exec(["--api", url]);
    assert.equal(status, 0, out);
    assert.match(out, /Advisory check: 1 silenced, none patched/);
  });

  it("fails and names the identifier once a patch exists", async () => {
    answer = { status: 200, advisories: { "CVE-2026-56876": patched } };
    const { status, out } = await exec(["--api", url]);
    assert.equal(status, 1, out);
    assert.match(out, /CVE-2026-56876 now has a patched version \(2\.0\.2\)/);
    assert.match(out, /auditConfig\.ignoreCves/);
  });

  it("fails when the silence names an advisory the database does not know", async () => {
    answer = { status: 200, advisories: {} };
    const { status, out } = await exec(["--api", url]);
    assert.equal(status, 1, out);
    assert.match(out, /no such advisory/);
  });

  it("fails rather than passes when the database is unreachable or unhappy", async () => {
    answer = { status: 503, advisories: {} };
    const badStatus = await exec(["--api", url]);
    assert.equal(badStatus.status, 1, badStatus.out);
    assert.match(badStatus.out, /answered 503/);

    const unreachable = await exec(["--api", "http://127.0.0.1:1/advisories"]);
    assert.equal(unreachable.status, 1, unreachable.out);
    assert.match(unreachable.out, /could not be reached/);
  });

  it("refuses an api override that is not loopback, so the query goes nowhere else", async () => {
    const { status, out } = await exec(["--api", "https://example.com/advisories"]);
    assert.equal(status, 1, out);
    assert.match(out, /loopback address only/);
  });

  it("refuses an --api flag with no value", async () => {
    const { status, out } = await exec(["--api"]);
    assert.equal(status, 1, out);
    assert.match(out, /--api needs a value/);
  });

  it("reads the identifiers from the committed package.json", () => {
    const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    const silenced = manifest.pnpm?.auditConfig?.ignoreCves ?? [];
    assert.ok(Array.isArray(silenced), "auditConfig.ignoreCves is not a list");
    for (const id of silenced) assert.match(id, /^(CVE|GHSA)-/, `${id} is not an identifier`);
  });
});
