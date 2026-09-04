// The advisory check: every identifier silenced in package.json's pnpm.auditConfig, in either
// list pnpm honours, is asked of the advisory database, and a patched version anywhere in the
// answer fails the run, so a silence cannot outlive its reason. Both the database and the
// manifest are stand-ins here, so these cases hold whatever the repository happens to silence
// today; one case reads the committed manifest, and it passes whether the lists are full or
// empty. The script is spawned asynchronously, since a synchronous spawn would block the event
// loop the stand-in server lives in.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { root } from "./helpers.mjs";

const script = resolve(root, "scripts/check-advisories.mjs");
const dir = mkdtempSync(join(tmpdir(), "portfolio-advisories-"));
after(() => rmSync(dir, { recursive: true, force: true }));

/** What the stand-in answers next: a status, a body override, or advisories by identifier. */
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
    if (answer.body !== undefined) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(answer.body);
      return;
    }
    const query = new URL(request.url, "http://127.0.0.1").searchParams;
    const id = query.get("cve_id") ?? query.get("ghsa_id");
    const advisory = answer.advisories[id];
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(advisory ? [advisory] : []));
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  url = `http://127.0.0.1:${server.address().port}/advisories`;
});
after(() => server?.close());

/** Writes a manifest holding the given audit configuration and returns its path. */
function manifest(auditConfig, name = "package.json") {
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify({ name: "stand-in", pnpm: { auditConfig } }));
  return path;
}

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

const CVE = "CVE-2026-56876";
const GHSA = "GHSA-jmr9-qjv8-65gv";
const unpatched = { vulnerabilities: [{ first_patched_version: null }] };
const patched = { vulnerabilities: [{ first_patched_version: "2.0.2" }] };

describe("check-advisories", () => {
  it("passes while every silenced advisory is still unpatched", async () => {
    answer = { status: 200, advisories: { [CVE]: unpatched } };
    const { status, out } = await exec([
      "--api",
      url,
      "--manifest",
      manifest({ ignoreCves: [CVE] }),
    ]);
    assert.equal(status, 0, out);
    assert.match(out, /Advisory check: 1 silenced, none patched/);
  });

  it("fails and names the identifier once a patch exists", async () => {
    answer = { status: 200, advisories: { [CVE]: patched } };
    const { status, out } = await exec([
      "--api",
      url,
      "--manifest",
      manifest({ ignoreCves: [CVE] }),
    ]);
    assert.equal(status, 1, out);
    assert.match(out, /CVE-2026-56876 now has a patched version \(2\.0\.2\)/);
    assert.match(out, /pnpm\.auditConfig/);
  });

  it("watches the other list pnpm honours, asked by its own identifier", async () => {
    answer = { status: 200, advisories: { [GHSA]: patched } };
    const { status, out } = await exec([
      "--api",
      url,
      "--manifest",
      manifest({ ignoreGhsas: [GHSA] }),
    ]);
    assert.equal(status, 1, out);
    assert.match(out, /GHSA-jmr9-qjv8-65gv now has a patched version/);
  });

  it("passes when nothing is silenced at all", async () => {
    const { status, out } = await exec(["--api", url, "--manifest", manifest({})]);
    assert.equal(status, 0, out);
    assert.match(out, /Advisory check: 0 silenced, none patched\./);
  });

  it("refuses an identifier the list cannot match, rather than asking for it", async () => {
    const wrongList = await exec([
      "--api",
      url,
      "--manifest",
      manifest({ ignoreCves: [GHSA] }, "wrong-list.json"),
    ]);
    assert.equal(wrongList.status, 1, wrongList.out);
    assert.match(
      wrongList.out,
      /ignoreCves holds "GHSA-jmr9-qjv8-65gv", which pnpm will not match/,
    );

    const notAList = await exec([
      "--api",
      url,
      "--manifest",
      manifest({ ignoreCves: "CVE-2026-56876" }, "not-a-list.json"),
    ]);
    assert.equal(notAList.status, 1, notAList.out);
    assert.match(notAList.out, /must be a list of identifiers/);
  });

  it("fails when the silence names an advisory the database does not know", async () => {
    answer = { status: 200, advisories: {} };
    const { status, out } = await exec([
      "--api",
      url,
      "--manifest",
      manifest({ ignoreCves: [CVE] }),
    ]);
    assert.equal(status, 1, out);
    assert.match(out, /no such advisory/);
  });

  it("fails rather than passes when it cannot read an answer", async () => {
    const path = manifest({ ignoreCves: [CVE] });

    answer = { status: 503, advisories: {} };
    const unhappy = await exec(["--api", url, "--manifest", path]);
    assert.equal(unhappy.status, 1, unhappy.out);
    assert.match(unhappy.out, /answered 503/);

    answer = { status: 200, advisories: {}, body: '{"message":"not a list"}' };
    const shape = await exec(["--api", url, "--manifest", path]);
    assert.equal(shape.status, 1, shape.out);
    assert.match(shape.out, /a shape this check does not know/);

    answer = { status: 200, advisories: {}, body: "not json at all" };
    const junk = await exec(["--api", url, "--manifest", path]);
    assert.equal(junk.status, 1, junk.out);

    answer = { status: 200, advisories: { [CVE]: { vulnerabilities: [] } } };
    const empty = await exec(["--api", url, "--manifest", path]);
    assert.equal(empty.status, 1, empty.out);
    assert.match(empty.out, /lists no affected package/);

    answer = { status: 200, advisories: {} };
    const unreachable = await exec(["--api", "http://127.0.0.1:1/advisories", "--manifest", path]);
    assert.equal(unreachable.status, 1, unreachable.out);
    assert.match(unreachable.out, /could not be reached/);
  });

  it("refuses an api it should not ask, however the option is written", async () => {
    const path = manifest({ ignoreCves: [CVE] });

    const elsewhere = await exec(["--api", "https://example.com/advisories", "--manifest", path]);
    assert.equal(elsewhere.status, 1, elsewhere.out);
    assert.match(elsewhere.out, /loopback address only/);

    const disguised = await exec(["--api=https://127.0.0.1@evil.example/a", "--manifest", path]);
    assert.equal(disguised.status, 1, disguised.out);
    assert.match(disguised.out, /loopback address only/);

    const notUrl = await exec(["--api=notaurl", "--manifest", path]);
    assert.equal(notUrl.status, 1, notUrl.out);
    assert.match(notUrl.out, /--api is not a URL/);

    const twice = await exec(["--api", url, "--api", "https://example.com/a", "--manifest", path]);
    assert.equal(twice.status, 1, twice.out);
    assert.match(twice.out, /given more than once/);

    const empty = await exec(["--api"]);
    assert.equal(empty.status, 1, empty.out);
    assert.match(empty.out, /--api needs a value/);

    const unknown = await exec(["--bogus"]);
    assert.equal(unknown.status, 1, unknown.out);
    assert.match(unknown.out, /unknown option: --bogus/);
  });

  it("keeps a query the stand-in already carries rather than mangling it", async () => {
    answer = { status: 200, advisories: { [CVE]: unpatched } };
    const { status, out } = await exec([
      "--api",
      `${url}?trace=1`,
      "--manifest",
      manifest({ ignoreCves: [CVE] }),
    ]);
    assert.equal(status, 0, out);
  });

  it("fails when the manifest cannot be read", async () => {
    const { status, out } = await exec(["--api", url, "--manifest", join(dir, "absent.json")]);
    assert.equal(status, 1, out);
    assert.match(out, /could not be read/);
  });

  it("holds only identifiers pnpm can match in the committed manifest", () => {
    const config =
      JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).pnpm?.auditConfig ?? {};
    for (const id of config.ignoreCves ?? []) assert.match(id, /^CVE-\d{4}-\d{4,}$/);
    // GitHub's own base32 alphabet, the shape the script refuses anything outside of.
    for (const id of config.ignoreGhsas ?? [])
      assert.match(id, /^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/i);
  });
});
