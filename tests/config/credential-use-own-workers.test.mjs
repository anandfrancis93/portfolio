// The watch judges the portfolio's own Workers only (docs/specs/2026-10-23-watch-own-workers.md):
// an actor other than the portfolio's two deploy tokens, writing to a Worker other than the
// portfolio's two, is another site's business, and so is the Cloudflare service's upload that
// follows that site's upload session. Everything else is judged as spec 003 says: the
// portfolio's Workers by anyone, the account outside any Worker by anyone, and the portfolio's
// own tokens on every Worker.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { REASONS, WORKERS, judge, windows } from "../../scripts/lib/credential-use.mjs";
import { root } from "./helpers.mjs";

const F = JSON.parse(
  readFileSync(resolve(root, "tests/config/fixtures/credential-use.json"), "utf8"),
);
const clone = (value) => structuredClone(value);
const HOUR = 3_600_000;
const shift = (text, ms) => new Date(Date.parse(text) + ms).toISOString();
const { windows: W } = windows({ [F.run.id]: F.jobs });
const reasons = (findings) => findings.map((f) => f.reason);

const SESSION = 0;
const UPLOAD = 1;
const VERSION = 2;
const tokenActor = (name) => {
  const actor = clone(F.audit[VERSION].actor);
  actor.token.name = name;
  return actor;
};
const COURSES = tokenActor("courses deploy (GitHub Actions)");
const HEALTH = tokenActor("health deploy (GitHub Actions)");
const systemActor = { type: "system" };
const dashActor = { type: "user", context: "dash", email: "redacted-email", id: "redacted-id" };

let serial = 0;
/** A copy of the fixture's entry `index`, a fresh id, its time moved by `shiftMs`. */
const entry = (index, shiftMs = 0, patch = () => {}) => {
  const e = clone(F.audit[index]);
  serial += 1;
  e.id = `01a16900-0000-7000-8000-${String(serial).padStart(12, "0")}`;
  e.action.time = shift(e.action.time, shiftMs);
  patch(e);
  return e;
};
/** The fixture's entry `index` as `actor` makes it on `worker`; the delegated upload names none. */
const on = (worker, actor, index, shiftMs = 0) =>
  entry(index, shiftMs, (e) => {
    e.raw.uri = e.raw.uri.replace(WORKERS.preview, worker);
    if (e.actor.type !== "delegated_service") e.actor = clone(actor);
  });
/**
 * A deploy as issue #6 shows the courses and health ones: the session, `uploads` delegated
 * uploads starting `gapMs` after it, then the version, deployment, settings and subdomain.
 */
const deployOf = (worker, actor, shiftMs = 0, { uploads = 3, gapMs = 0 } = {}) => [
  on(worker, actor, SESSION, shiftMs),
  ...Array.from({ length: uploads }, (_, i) => on(worker, actor, UPLOAD, shiftMs + gapMs + i * 20)),
  ...[2, 3, 4, 5].map((i) => on(worker, actor, i, shiftMs + gapMs)),
];
/** A write with no Worker in its path: a DNS record or a certificate pack on the zone. */
const zoneWrite = (actor, type, shiftMs = HOUR) =>
  entry(VERSION, shiftMs, (e) => {
    e.actor = clone(actor);
    e.action = { ...e.action, description: "", type: "create" };
    e.raw.method = "POST";
    e.raw.uri = `/zones/redacted-zone/${type === "record" ? "dns_records" : "ssl/certificate_packs"}`;
    e.resource = { product: type === "record" ? "dns" : "ssl", scope: "zones", type };
  });

describe("judge, the portfolio's own Workers only", () => {
  it("another actor's write to another Worker is no finding", () => {
    const courses = deployOf("courses", COURSES, HOUR);
    assert.deepEqual(judge({ entries: courses, windows: W }), []);
    const inside = deployOf("courses", COURSES, -3_000);
    assert.deepEqual(judge({ entries: [...F.audit, ...inside], windows: W }), []);
    const dash = on("health", dashActor, VERSION, HOUR);
    assert.deepEqual(judge({ entries: [dash], windows: W }), []);
  });

  it("a delegated upload after another Worker's session is no finding", () => {
    const health = deployOf("health", HEALTH, HOUR, { uploads: 6, gapMs: 50_000 });
    assert.deepEqual(judge({ entries: health, windows: W }), []);
    const late = [
      on("health", HEALTH, SESSION, HOUR),
      on("health", HEALTH, UPLOAD, HOUR + 3 * 60_000),
    ];
    assert.deepEqual(judge({ entries: late.reverse(), windows: W }), []);
  });

  it("another actor on the portfolio's Workers is still reported", () => {
    for (const worker of Object.values(WORKERS)) {
      const write = on(worker, COURSES, VERSION);
      assert.deepEqual(reasons(judge({ entries: [write], windows: W })), [REASONS.actor]);
    }
    const session = on(WORKERS.production, HEALTH, SESSION, HOUR);
    const upload = on(WORKERS.production, HEALTH, UPLOAD, HOUR + 1_000);
    assert.deepEqual(reasons(judge({ entries: [session, upload], windows: W })), [
      REASONS.actor,
      REASONS.outside,
    ]);
  });

  it("another actor on no Worker is still reported", () => {
    const entries = [
      zoneWrite(systemActor, "record"),
      zoneWrite(dashActor, "record"),
      zoneWrite(COURSES, "certificate_pack"),
    ];
    assert.deepEqual(reasons(judge({ entries, windows: W })), [
      REASONS.actor,
      REASONS.actor,
      REASONS.actor,
    ]);
  });

  it("the portfolio's tokens are still judged on another Worker", () => {
    const own = F.audit[VERSION].actor;
    const inside = on("courses", own, VERSION);
    assert.deepEqual(reasons(judge({ entries: [inside], windows: W })), [REASONS.worker]);
    const outside = on("courses", own, VERSION, HOUR);
    assert.deepEqual(reasons(judge({ entries: [outside], windows: W })), [REASONS.outside]);
    const session = on("health", own, SESSION, HOUR);
    const upload = on("health", own, UPLOAD, HOUR + 1_000);
    assert.deepEqual(reasons(judge({ entries: [session, upload], windows: W })), [
      REASONS.outside,
      REASONS.outside,
    ]);
  });

  it("a delegated upload after the portfolio's own session is judged as before", () => {
    const own = [entry(SESSION, HOUR), entry(UPLOAD, HOUR)];
    assert.deepEqual(reasons(judge({ entries: own, windows: W })), [
      REASONS.outside,
      REASONS.outside,
    ]);
    const alone = entry(UPLOAD, HOUR);
    assert.deepEqual(reasons(judge({ entries: [alone], windows: W })), [REASONS.outside]);
    const healthFirst = on("health", HEALTH, SESSION, -1_000);
    assert.deepEqual(judge({ entries: [healthFirst, ...F.audit], windows: W }), []);
    const healthAfter = [
      on("health", HEALTH, SESSION, -2_000),
      entry(SESSION, HOUR),
      entry(UPLOAD, HOUR),
    ];
    assert.deepEqual(reasons(judge({ entries: healthAfter, windows: W })), [
      REASONS.outside,
      REASONS.outside,
    ]);
  });

  it("a day of courses and health deploys leaves only the other findings", () => {
    const day = [
      ...deployOf("health", HEALTH, HOUR),
      ...deployOf("courses", COURSES, 2 * HOUR),
      ...deployOf("health", HEALTH, 2 * HOUR + 9_000, { uploads: 6, gapMs: 50_000 }),
      ...deployOf("health", HEALTH, -3_000),
      ...F.audit,
      on("health", HEALTH, SESSION, 3 * HOUR),
      zoneWrite(systemActor, "record", 4 * HOUR),
      zoneWrite(systemActor, "record", 4 * HOUR + 20),
      zoneWrite(systemActor, "certificate_pack", 4 * HOUR + 40),
      ...deployOf("health", HEALTH, 5 * HOUR),
    ];
    const findings = judge({ entries: day, windows: W });
    assert.deepEqual(reasons(findings), [REASONS.actor, REASONS.actor, REASONS.actor]);
    assert.deepEqual(
      findings.map((f) => f.entry.resource.type),
      ["record", "record", "certificate_pack"],
    );
  });
});
