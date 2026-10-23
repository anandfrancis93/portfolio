// The deploy guard, spawned as Claude Code spawns it, against the payload tables in spec 002
// section 2.2: exit 0 is allowed, exit 2 is blocked with a message that starts "Blocked:". The
// test guard and the formatter went with spec 005: `.adlc/protected` and the pre-commit fast
// check hold those rules for every tool.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runHook, shell } from "./helpers.mjs";

const blocked = (result, label) => {
  assert.equal(
    result.status,
    2,
    `${label}: expected exit 2, got ${result.status}\n${result.stderr}`,
  );
  assert.match(result.stderr, /^Blocked:/, `${label}: the message names the block`);
};
const allowed = (result, label) =>
  assert.equal(
    result.status,
    0,
    `${label}: expected exit 0, got ${result.status}\n${result.stderr}`,
  );

describe("guard-deploy.mjs", () => {
  const cases = [
    ["wrangler deploy", "blocked"],
    ["wrangler deploy --env preview", "allowed"],
    ["wrangler deploy -e preview", "allowed"],
    ["wrangler deploy --env=preview", "allowed"],
    ["wrangler deploy --env production", "blocked"],
    ["wrangler versions upload", "allowed"],
    ["wrangler versions deploy", "blocked"],
    ["wrangler rollback", "blocked"],
    ["wrangler rollback --env production abc", "blocked"],
    ["wrangler rollback --env preview", "allowed"],
    ["wrangler delete", "blocked"],
    ["wrangler secret put X", "blocked"],
    ["wrangler triggers deploy", "blocked"],
    ["wrangler deploy --env preview && wrangler deploy", "blocked"],
    ["pnpm run deploy:production", "blocked"],
    ["pnpm run deploy:preview", "allowed"],
    ["node scripts/deploy.mjs --env production", "blocked"],
    ["node scripts/deploy.mjs --env preview", "allowed"],
    ["cat scripts/deploy.mjs", "allowed"],
    ["grep deploy scripts/deploy.mjs", "allowed"],
    ["grep deploy scripts/rollback.mjs", "allowed"],
    ["pnpm run rollback:production", "blocked"],
    ["pnpm run rollback:preview", "allowed"],
    ["node scripts/rollback.mjs --env production", "blocked"],
    ["node scripts/rollback.mjs --env preview", "allowed"],
    ["RELEASE_APPROVAL=x wrangler deploy", "allowed"],
    ["", "allowed"],
  ];
  for (const tool of ["Bash", "PowerShell"]) {
    for (const [command, verdict] of cases) {
      it(`${tool}: ${command || "(empty command)"} is ${verdict}`, () => {
        const result = runHook("guard-deploy.mjs", shell(command, tool));
        (verdict === "blocked" ? blocked : allowed)(result, command);
      });
    }
  }
  it("allows wrangler deploy when RELEASE_APPROVAL is in the environment", () => {
    const result = runHook("guard-deploy.mjs", shell("wrangler deploy"), {
      env: { RELEASE_APPROVAL: "the approving message" },
    });
    allowed(result, "approval in the environment");
  });
  it("lists the offending segment and not the preview one", () => {
    const result = runHook(
      "guard-deploy.mjs",
      shell("wrangler deploy --env preview && wrangler deploy"),
    );
    blocked(result, "mixed segments");
    assert.match(result.stderr, /\n {2}wrangler deploy\n/);
    assert.doesNotMatch(result.stderr, /\n {2}wrangler deploy --env preview\n/);
  });
  it("ignores a payload that is not JSON", () => {
    allowed(runHook("guard-deploy.mjs", "not json"), "non-JSON payload");
  });
});
