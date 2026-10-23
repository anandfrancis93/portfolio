// The release gate (spec 005, 5.1; plan 005, decision 6): the step that opens the `production`
// and `rollback` jobs of deploy.yml, run as Actions runs it, `bash --noprofile --norc -eo
// pipefail`, against a stub `gh` that serves raw JSON fixtures by API path. The real `jq` applies
// the step's own filters, so a wrong filter in deploy.yml fails here. PATH is the stub's folder
// and /usr/bin:/bin only, and GH_TOKEN is a dummy, so no call can reach a signed-in `gh`; the stub
// logs every call and fails on a path it has no fixture for. This proves the refusals without a
// commit on main that no pull request merged, which the ruleset does not allow.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { parse } from "yaml";
import { read } from "./helpers.mjs";

const NAME = "Require a green checks run for this commit";
const deploy = parse(read(".github/workflows/deploy.yml"));
const stepOf = (job) => deploy.jobs[job].steps.find((s) => s.name === NAME);
const gate = stepOf("production");

const REPO = "owner/site";
const SHA = "a".repeat(40);
const HEAD = "b".repeat(40);
const TREE = "c".repeat(40);
const OTHER_TREE = "d".repeat(40);
const SYSTEM_PATH = "/usr/bin:/bin";
const JQ = SYSTEM_PATH.split(":")
  .map((dir) => join(dir, "jq"))
  .find((file) => existsSync(file));

// The stub turns an API path into a file name: every character outside [A-Za-z0-9._-] becomes _.
const key = (path) => path.replace(/[^A-Za-z0-9._-]/g, "_");
const STUB = `#!/bin/sh
printf '%s\\n' "$*" >> "$STUB_LOG"
[ "$1" = api ] || { echo "stub gh: only api is served" >&2; exit 2; }
file="$FIXTURES/$(printf '%s' "$2" | tr -c 'A-Za-z0-9._-' '_')"
[ -f "$file" ] || { echo "stub gh: no fixture for $2" >&2; exit 1; }
cat "$file"
`;

const scratch = mkdtempSync(join(tmpdir(), "release-gate-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
writeFileSync(join(scratch, "gh"), STUB);
chmodSync(join(scratch, "gh"), 0o755);
writeFileSync(join(scratch, "step.sh"), gate?.run ?? "");

const pull = (number, merged = true, base = "main") => ({
  number,
  merged_at: merged ? "2026-10-23T10:00:00Z" : null,
  base: { ref: base },
  head: { sha: HEAD },
});
const runs = (...list) => ({
  total_count: list.length,
  check_runs: list.map(([conclusion, started_at]) => ({
    name: "adlc / checks",
    conclusion,
    started_at,
  })),
});
const commit = (tree) => ({ sha: "x", commit: { tree: { sha: tree } } });

const PULLS = `repos/${REPO}/commits/${SHA}/pulls`;
const RUNS = `repos/${REPO}/commits/${HEAD}/check-runs?check_name=adlc%20%2F%20checks&filter=latest&per_page=100`;
const MAIN = `repos/${REPO}/commits/${SHA}`;
const HEAD_COMMIT = `repos/${REPO}/commits/${HEAD}`;

const GREEN = {
  [PULLS]: [pull(20)],
  [RUNS]: runs(["success", "2026-10-23T09:00:00Z"]),
  [MAIN]: commit(TREE),
  [HEAD_COMMIT]: commit(TREE),
};

let cases = 0;
/** Runs the gate against `fixtures`; returns its exit status, both streams and the stub's log. */
function runGate(fixtures) {
  const dir = join(scratch, `case-${(cases += 1)}`);
  mkdirSync(dir);
  for (const [path, body] of Object.entries(fixtures)) {
    writeFileSync(join(dir, key(path)), JSON.stringify(body));
  }
  const log = join(dir, "calls.log");
  writeFileSync(log, "");
  const result = spawnSync(
    "/bin/bash",
    ["--noprofile", "--norc", "-eo", "pipefail", join(scratch, "step.sh")],
    {
      env: {
        PATH: `${scratch}:${SYSTEM_PATH}`,
        GH_TOKEN: "dummy",
        REPO,
        SHA,
        FIXTURES: dir,
        STUB_LOG: log,
      },
      encoding: "utf8",
    },
  );
  return {
    status: result.status,
    out: `${result.stdout}${result.stderr}`,
    calls: readFileSync(log, "utf8").trim().split("\n").filter(Boolean),
  };
}

describe("deploy.yml: the release gate step", () => {
  it("opens both production jobs with the same text, before the checkout", () => {
    for (const job of ["production", "rollback"]) {
      const steps = deploy.jobs[job].steps;
      const at = steps.findIndex((s) => s.name === NAME);
      const checkout = steps.findIndex((s) => String(s.uses).startsWith("actions/checkout@"));
      assert.ok(at >= 0, `${job} has the gate step`);
      assert.ok(at < checkout, `${job} runs the gate before the checkout`);
    }
    assert.equal(stepOf("rollback").run, gate.run);
    assert.deepEqual(stepOf("rollback").env, gate.env);
  });
  it("takes the token, the repository and the commit from env, and no expression in its text", () => {
    assert.deepEqual(gate.env, {
      GH_TOKEN: "${{ github.token }}",
      REPO: "${{ github.repository }}",
      SHA: "${{ github.sha }}",
    });
    assert.equal(gate.run.includes("${{"), false);
    assert.equal(
      gate.run.includes("--jq"),
      false,
      "the filters run in jq, where the test sees them",
    );
  });
  it("has jq on the system path, which the gate and this test need", () => {
    assert.ok(JQ, `no jq in ${SYSTEM_PATH}`);
  });
});

describe("deploy.yml: the release gate's verdicts", () => {
  it("passes a commit one merged pull request made, whose head is green with the same tree", () => {
    const r = runGate(GREEN);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /adlc \/ checks on #20, head b{40}: success/);
    assert.match(r.out, /carries the tree of #20, whose checks passed\./);
    assert.deepEqual(r.calls, [`api ${PULLS}`, `api ${RUNS}`, `api ${MAIN}`, `api ${HEAD_COMMIT}`]);
  });
  it("reads the latest run: a green re-run after a red one passes", () => {
    const r = runGate({
      ...GREEN,
      [RUNS]: runs(["failure", "2026-10-23T08:00:00Z"], ["success", "2026-10-23T09:00:00Z"]),
    });
    assert.equal(r.status, 0, r.out);
  });
  const refusals = [
    ["no pull request", { [PULLS]: [] }, /came from 0 merged pull requests, not one/],
    [
      "only an unmerged pull request, or one into another branch",
      { [PULLS]: [pull(20, false), pull(21, true, "next")] },
      /came from 0 merged pull requests, not one/,
    ],
    ["two merged pull requests", { [PULLS]: [pull(20), pull(21)] }, /came from 2 merged/],
    ["a red checks run", { [RUNS]: runs(["failure", "2026-10-23T09:00:00Z"]) }, /is failure/],
    [
      "a red re-run after a green one",
      { [RUNS]: runs(["success", "2026-10-23T08:00:00Z"], ["failure", "2026-10-23T09:00:00Z"]) },
      /is failure/,
    ],
    ["no checks run", { [RUNS]: runs() }, /is none on the head of #20/],
    ["a run still going", { [RUNS]: runs([null, "2026-10-23T09:00:00Z"]) }, /is none/],
    ["a different tree", { [HEAD_COMMIT]: commit(OTHER_TREE) }, /has tree c{40}, but the head/],
  ];
  for (const [label, change, message] of refusals) {
    it(`refuses ${label}, naming the read`, () => {
      const r = runGate({ ...GREEN, ...change });
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, message);
      assert.match(r.out, /refusing production\./);
      assert.ok(r.calls.length > 0, "the stub was called");
    });
  }
  it("refuses when GitHub cannot be read, before any verdict", () => {
    const r = runGate({});
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /stub gh: no fixture for/);
    assert.deepEqual(r.calls, [`api ${PULLS}`]);
  });
});
