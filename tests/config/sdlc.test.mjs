// The SDLC artifacts (spec.md section 2.5): every intent, spec and plan under docs/sdlc carries a
// status line, and a later stage implies the earlier one was accepted, so a spec beside a draft
// intent, or a plan beside a draft spec, is a mistake in the trail.
import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { read, root } from "./helpers.mjs";

const STAGES = ["intent.md", "spec.md", "plan.md"];

/** The text after "Status:" in the artifact's header (its first six lines), or null. */
function status(rel) {
  const header = read(rel).split("\n").slice(0, 6).join("\n");
  const m = /(?:^|\. )Status:\s*([^\n]*)/m.exec(header);
  return m ? m[1].trim() : null;
}

const changes = readdirSync(resolve(root, "docs/sdlc")).filter((name) =>
  statSync(resolve(root, "docs/sdlc", name)).isDirectory(),
);

describe("docs/sdlc", () => {
  it("has at least one change", () => assert.ok(changes.length >= 1, "docs/sdlc is empty"));
  for (const change of changes) {
    const present = STAGES.filter((stage) => existsSync(resolve(root, "docs/sdlc", change, stage)));
    it(`${change} starts with an intent`, () => {
      assert.ok(present.includes("intent.md"), `${change} has no intent.md`);
    });
    for (const stage of present) {
      it(`${change}/${stage} carries a status line`, () => {
        assert.ok(
          status(`docs/sdlc/${change}/${stage}`),
          `${change}/${stage} has no "Status:" line`,
        );
      });
    }
    for (let i = 1; i < present.length; i += 1) {
      const earlier = present[i - 1];
      const later = present[i];
      it(`${change}/${earlier} is not a draft while ${later} exists`, () => {
        const text = status(`docs/sdlc/${change}/${earlier}`) ?? "";
        assert.doesNotMatch(text, /draft/i, `${change}/${earlier} still says "${text}"`);
      });
    }
  }
});
