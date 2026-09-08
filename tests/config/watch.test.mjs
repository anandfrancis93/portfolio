// The three workflows the credential watch rests on (spec 003 sections 3 and 6, plan 003 phase
// B), read from their files so a later edit cannot drift them: the `credential use` job's
// secrets are the watch token and the account id and nothing else, it runs on both crons and a
// dispatch while the weekly jobs keep the Monday cron, its checkout keeps no credentials, the
// report job waits for all three and tests for `failure`; the deploy workflow's steps carry the
// names the library's shapes look up; and `ci` carries the heartbeat with the two read
// permissions.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parse } from "yaml";
import { SHAPES } from "../../scripts/lib/credential-use.mjs";
import { read } from "./helpers.mjs";

const watch = parse(read(".github/workflows/watch.yml"));
const deploy = parse(read(".github/workflows/deploy.yml"));
const ci = parse(read(".github/workflows/ci.yml"));

/** Every `secrets.NAME` a value names, anywhere under `node`. */
const secretsIn = (node) =>
  new Set([...JSON.stringify(node).matchAll(/secrets\.([A-Za-z0-9_]+)/g)].map((m) => m[1]));

const MONDAY = "0 9 * * 1";
const HOURLY = "17 * * * *";

describe("watch.yml: the credential-use job", () => {
  const job = watch.jobs["credential-use"];
  it("exists under its name, with the three read permissions and a five-minute timeout", () => {
    assert.equal(job?.name, "credential use");
    assert.deepEqual(job.permissions, { contents: "read", actions: "read", issues: "read" });
    assert.equal(job["timeout-minutes"], 5);
    assert.equal(job["runs-on"], "ubuntu-latest");
  });
  it("names the watch token and the account id and no other secret, in its steps' env alone", () => {
    assert.deepEqual([...secretsIn(job)].sort(), [
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_WATCH_TOKEN",
    ]);
    assert.equal(job.env, undefined, "the job has no env of its own");
    const check = job.steps.find((s) => s.name === "Check credential use");
    assert.ok(check.run.startsWith("node scripts/check-credential-use.mjs --report "));
    assert.match(check.run, / --body /);
    assert.deepEqual(Object.keys(check.env).sort(), [
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_WATCH_TOKEN",
      "GITHUB_TOKEN",
    ]);
    assert.equal(check.env.CLOUDFLARE_WATCH_TOKEN, "${{ secrets.CLOUDFLARE_WATCH_TOKEN }}");
    assert.equal(check.env.GITHUB_TOKEN, "${{ github.token }}");
  });
  it("verifies the watch token's expiry by --verify-only --key, the watch secret mapped in", () => {
    const expiry = job.steps.find((s) => s.name === "Verify the watch token's expiry");
    assert.equal(
      expiry.run,
      "node scripts/check-expiry.mjs --online --verify-only --key cloudflareWatchExpires",
    );
    assert.deepEqual(expiry.env, { CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_WATCH_TOKEN }}" });
    const check = job.steps.find((s) => s.name === "Check credential use");
    for (const step of [check, expiry]) assert.equal(step.if, "${{ !cancelled() }}", step.name);
  });
  it("keeps no credentials in the checkout, installs nothing, and keeps the artifact a day", () => {
    const checkout = job.steps.find((s) => String(s.uses).startsWith("actions/checkout@"));
    assert.equal(checkout.with["persist-credentials"], false);
    assert.ok(!job.steps.some((s) => /pnpm install/.test(String(s.run ?? ""))));
    const upload = job.steps.find((s) => String(s.uses).startsWith("actions/upload-artifact@"));
    assert.equal(upload.with["retention-days"], 1);
    assert.equal(upload.with.name, "credential-use");
    assert.match(upload.with.path, /credential-use-report\.md/);
    assert.match(upload.with.path, /credential-use-body\.md/);
  });
  it("runs on both crons and a dispatch, while the weekly jobs keep the Monday cron", () => {
    const crons = watch.on.schedule.map((s) => s.cron);
    assert.deepEqual(crons, [MONDAY, HOURLY]);
    assert.ok("workflow_dispatch" in watch.on);
    assert.equal(job.if, undefined, "no condition: every trigger");
    for (const name of ["checks", "smoke"]) {
      assert.equal(
        watch.jobs[name].if,
        `github.event_name != 'schedule' || github.event.schedule == '${MONDAY}'`,
        name,
      );
    }
    assert.match(watch["run-name"], /credential use, hourly/);
    assert.ok(watch["run-name"].includes(HOURLY));
  });
  it("the weekly expiry step keeps the preview token, the only deploy secret in the file", () => {
    assert.deepEqual([...secretsIn(watch.jobs.checks)].sort(), ["CLOUDFLARE_API_TOKEN"]);
    assert.deepEqual([...secretsIn(watch)].sort(), [
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_WATCH_TOKEN",
    ]);
  });
});

describe("watch.yml: the report job", () => {
  const job = watch.jobs.report;
  it("waits for all three jobs, unless the run was cancelled, and reads a result as failed unless success or skipped", () => {
    assert.deepEqual(job.needs, ["checks", "smoke", "credential-use"]);
    assert.equal(job.if, "${{ !cancelled() }}");
    assert.deepEqual(job.permissions, { issues: "write" });
    const step = job.steps.find((s) => s.name === "Open, update or close the watch issue");
    assert.equal(step.env.CREDENTIAL, "${{ needs.credential-use.result }}");
    for (const name of ["CHECKS", "SMOKE", "CREDENTIAL"]) {
      assert.match(
        step.run,
        new RegExp(`case "\\$${name}" in success\\|skipped\\) ;; \\*\\) failed=`),
      );
    }
    assert.ok(!step.run.includes('!= "failure"'), "a cancelled job is a failure too");
  });
  it("closes the watch issue only when every check its last failure named ran and passed", () => {
    const step = job.steps.find((s) => s.name === "Open, update or close the watch issue");
    assert.match(step.run, /gh issue view "\$number" --repo "\$REPO" --json body,comments/);
    assert.match(step.run, /select\(\.author\.login == "github-actions"\)/);
    assert.match(step.run, /select\(startswith\("Failed on"\)\)/);
    for (const [phrase, variable] of [
      ["expiry and advisories:", "CHECKS"],
      ["production smoke check:", "SMOKE"],
      ["credential use:", "CREDENTIAL"],
    ]) {
      assert.match(
        step.run,
        new RegExp(
          `case "\\$last" in \\*"${phrase}"\\*\\) \\[ "\\$${variable}" = "success" \\] \\|\\| waiting=`,
        ),
      );
    }
    assert.match(
      step.run,
      /if \[ -n "\$waiting" \]; then\n\s+echo "Passed on \$when for what ran; issue #\$number stays open/,
    );
    assert.match(
      step.run,
      /else\n\s+gh issue close "\$number" --repo "\$REPO" --comment "Passed on \$when: run \$RUN_URL\."/,
    );
  });
  it("posts a finding from the body file only when the check wrote one, and never closes that issue", () => {
    const check = watch.jobs["credential-use"].steps.find((s) => s.id === "check");
    assert.match(
      check.run,
      /if \[ -s credential-use-body\.md \]; then\n\s+echo "finding=true" >> "\$GITHUB_OUTPUT"/,
    );
    assert.equal(
      watch.jobs["credential-use"].outputs.finding,
      "${{ steps.check.outputs.finding }}",
    );
    const download = job.steps.find((s) => String(s.uses).startsWith("actions/download-artifact@"));
    assert.equal(download.if, "needs.credential-use.outputs.finding == 'true'");
    assert.equal(download["continue-on-error"], undefined, "a failed download is a red job");
    assert.equal(download.with.name, "credential-use");
    const step = job.steps.find((s) => s.name === "Open or add to the finding issue");
    assert.equal(step.if, "needs.credential-use.outputs.finding == 'true'");
    assert.match(step.run, /title="A credential was used outside the workflows"/);
    assert.match(step.run, /if \[ ! -s credential-use-body\.md \]; then\n\s+echo "::error::/);
    assert.match(
      step.run,
      /gh issue comment "\$number" --repo "\$REPO" --body-file credential-use-body\.md/,
    );
    assert.match(
      step.run,
      /gh issue create --repo "\$REPO" --title "\$title" --body-file credential-use-body\.md/,
    );
    assert.ok(!step.run.includes("issue close"));
    const upload = watch.jobs["credential-use"].steps.find((s) =>
      String(s.uses).startsWith("actions/upload-artifact@"),
    );
    assert.equal(upload.with.overwrite, true);
  });
});

describe("deploy.yml: the steps the shapes look up", () => {
  for (const [stepName, byJob] of Object.entries(SHAPES)) {
    for (const jobName of Object.keys(byJob)) {
      it(`job ${jobName} has one step named ${stepName}`, () => {
        const steps = deploy.jobs[jobName].steps.filter((s) => s.name === stepName);
        assert.equal(steps.length, 1);
        assert.match(String(steps[0].run), /^pnpm run (deploy|rollback):(preview|production)/);
      });
    }
  }
});

describe("ci.yml: the heartbeat", () => {
  const job = ci.jobs.heartbeat;
  it("is a job of its own with the two read permissions, running the heartbeat script", () => {
    assert.equal(job?.name, "watch heartbeat");
    assert.deepEqual(job.permissions, { contents: "read", actions: "read" });
    const step = job.steps.find((s) => s.run === "node scripts/check-heartbeat.mjs");
    assert.deepEqual(step.env, { GITHUB_TOKEN: "${{ github.token }}" });
    const checkout = job.steps.find((s) => String(s.uses).startsWith("actions/checkout@"));
    assert.equal(checkout.with["persist-credentials"], false);
    assert.equal(ci.jobs.ci.name, "ci", "the required check keeps its name");
  });
});
