// The no-address check (spec 004 section 4, plan 004 decision 4): the pattern finds an address
// at the Gmail domain in any case and nothing else; a finding names the file and the line and
// never the text; a .env file that defines CONTACT_EMAIL fails; and the committed tree passes.
// Every sample address is built from parts, so this file passes the check it tests.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { addressLines, definesContactEmail, isEnvFile } from "../../scripts/lib/address.mjs";
import { STAND_IN } from "../../src/content/contact.ts";
import { read, root } from "./helpers.mjs";

const at = (local, ...domain) => `${local}@${domain.join(".")}`;
const sample = at("someone.else", "gmail", "com");

describe("addressLines", () => {
  it("finds an address at the Gmail domain, with its line number", () => {
    assert.deepEqual(addressLines(`one\nwrite to ${sample} today\nthree`), [2]);
  });
  it("finds it in any case", () => {
    assert.deepEqual(addressLines(sample.toUpperCase()), [1]);
    assert.deepEqual(addressLines(at("Some.One", "GMail", "Com")), [1]);
  });
  it("finds it inside markup and mailto links", () => {
    assert.deepEqual(addressLines(`<a href="mailto:${sample}">x</a>`), [1]);
  });
  it("ignores the stand-in, other domains and lookalikes", () => {
    const text = [
      STAND_IN,
      at("someone", "example", "org"),
      at("someone", "gmail", "community"),
      at("someone", "googlemail", "co"),
      "gmail.com with no address",
    ].join("\n");
    assert.deepEqual(addressLines(text), []);
  });
});

describe(".env files", () => {
  it("knows the names Vite's loadEnv reads, less the example", () => {
    for (const name of [".env", ".env.local", ".env.production"]) assert.ok(isEnvFile(name), name);
    for (const name of [".env.example", ".envrc", "env", "a.env"]) {
      assert.equal(isEnvFile(name), false, name);
    }
  });
  it("sees CONTACT_EMAIL defined, with or without export", () => {
    assert.ok(definesContactEmail("A=1\nCONTACT_EMAIL=x\n"));
    assert.ok(definesContactEmail("export CONTACT_EMAIL = x"));
    assert.equal(definesContactEmail("# CONTACT_EMAIL=x\nOTHER_CONTACT_EMAIL=x"), false);
  });
});

describe("check-address.mjs", () => {
  const script = resolve(root, "scripts/check-address.mjs");
  const run = (cwd) => spawnSync(process.execPath, [script], { cwd, encoding: "utf8" });

  it("passes on the committed tree", () => {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^Address check: \d+ tracked files, no address/);
  });

  it("names the file and line of a finding, never its text", () => {
    // A throwaway repository holding a copy of the script, its library and one tracked finding.
    const dir = mkdtempSync(join(tmpdir(), "portfolio-address-"));
    after(() => rmSync(dir, { recursive: true, force: true }));
    const git = (...args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    git("init", "-q");
    for (const rel of ["scripts/check-address.mjs", "scripts/lib/address.mjs"]) {
      mkdirSync(dirname(join(dir, rel)), { recursive: true });
      writeFileSync(join(dir, rel), read(rel));
    }
    writeFileSync(join(dir, "notes.md"), `first\nmail ${sample}\n`);
    writeFileSync(join(dir, ".env.local"), "CONTACT_EMAIL=x\n");
    git("add", "notes.md", "scripts");
    const result = spawnSync(process.execPath, [join(dir, "scripts/check-address.mjs")], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /notes\.md:2: an address at the Gmail domain/);
    assert.match(result.stderr, /\.env\.local: defines CONTACT_EMAIL/);
    assert.doesNotMatch(result.stderr + result.stdout, new RegExp(sample.replace(/\./g, "\\.")));
  });
});
