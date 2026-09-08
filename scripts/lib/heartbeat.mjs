// The watch heartbeat (spec 003, section 6; the runbook, "The watch"): the judgement, pure, so
// the configuration tests feed it runs and times. The newest completed `watch` run, of any
// trigger and any ref, must have finished within the limit and succeeded; anything else is the
// sign of a stopped or failing watch, and the line names the remedy, since the watch cannot
// announce its own silence.

/** Three hours: two hourly runs may be late or dropped before the sign shows. */
export const LIMIT_MS = 3 * 3_600_000;

export const REMEDY =
  'the remedy is in docs/runbook.md, "The watch": gh workflow enable watch.yml, then gh workflow run watch.yml; for a failing run, its log';

/** A duration in whole minutes, or hours and minutes, for a line. */
export function describe(ms) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} minute(s)`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hour(s)` : `${hours} hour(s) ${rest} minute(s)`;
}

/**
 * The verdict on the newest completed watch run: `ok` when it finished inside the limit and
 * succeeded; otherwise the reason, in the order a reader needs it (no run, no time, too old,
 * then its conclusion), so a stale failure reads as stale first.
 */
export function judge({ run, now, limitMs = LIMIT_MS }) {
  const at = Date.parse(String(now ?? ""));
  if (Number.isNaN(at)) return { ok: false, reason: "the time now is not a date" };
  if (!run) return { ok: false, reason: "no completed watch run exists" };
  const finished = Date.parse(String(run.updated_at ?? ""));
  if (Number.isNaN(finished)) {
    return { ok: false, reason: `watch run ${run.id ?? "?"} carries no completion time` };
  }
  const age = at - finished;
  if (age > limitMs) {
    return {
      ok: false,
      reason: `watch run ${run.id ?? "?"} finished ${describe(age)} ago, over the limit of ${describe(limitMs)}`,
    };
  }
  if (run.conclusion !== "success") {
    return {
      ok: false,
      reason: `watch run ${run.id ?? "?"} concluded ${run.conclusion ?? "nothing"} ${describe(age)} ago`,
    };
  }
  return { ok: true, reason: `watch run ${run.id ?? "?"} passed ${describe(age)} ago` };
}
