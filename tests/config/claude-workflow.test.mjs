// The claude workflow's checkout (spec 2026-10-23-claude-checkout-credentials), read from its
// file so a later edit cannot drift it: the checkout keeps no credentials, so Claude's push can
// only use the app token the action sets, and that push starts `adlc / checks`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parse } from "yaml";
import { read } from "./helpers.mjs";

const claude = parse(read(".github/workflows/claude.yml"));

describe("claude.yml: the respond job's checkout", () => {
  const steps = claude.jobs.respond.steps;
  const checkouts = steps.filter((s) => String(s.uses).startsWith("actions/checkout@"));
  it("is the job's one checkout", () => {
    assert.equal(checkouts.length, 1);
  });
  it("keeps no credentials", () => {
    assert.equal(checkouts[0].with["persist-credentials"], false);
  });
  it("still fetches the full history", () => {
    assert.equal(checkouts[0].with["fetch-depth"], 0);
  });
});
