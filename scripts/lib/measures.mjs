// The delivery measures (the runbook, "Measures"): what scripts/measure.mjs computes from the
// record GitHub keeps of each pull request, kept pure so the configuration tests can feed it
// fixtures. The playbook's indicators, read from the trail the process already leaves: whether
// ci passed on the first commit, hours to the first review and to the merge, commits after a
// review, and the findings the reviews' closing lines carry. A review counts when the app
// posted it or a person with a standing in the repository did; every review posted here ends
// each pass with "Pass N (name): X Important, Y Nit", sometimes with a note after it, and the
// owner's one-report form on an early pull request ended "Findings: X Important, Y Nit".

const CLOSING = /^Pass (\d) \([^)]*\): (\d+) Important, (\d+) Nit\b/gm;
const FINDINGS = /^Findings: (\d+) Important, (\d+) Nit\b/gm;
const APP = /^claude(\[bot\])?$/;
const BOT = /\[bot\]$/;
const OURS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
export const PASSES = ["1", "2", "3"];

/** The Important and Nit counts a review's closing lines carry, in total and per pass. */
export function findings(body) {
  const text = String(body ?? "");
  const passes = {};
  let important = 0;
  let nit = 0;
  for (const [, pass, i, n] of text.matchAll(CLOSING)) {
    const soFar = passes[pass] ?? { important: 0, nit: 0 };
    passes[pass] = { important: soFar.important + Number(i), nit: soFar.nit + Number(n) };
    important += Number(i);
    nit += Number(n);
  }
  for (const [, i, n] of text.matchAll(FINDINGS)) {
    important += Number(i);
    nit += Number(n);
  }
  return { important, nit, passes };
}

/**
 * Whether a review is one of ours: the app's, or a person's whose `association` GitHub gives as
 * the owner, a member or a collaborator (a fixture without one is taken as a person's). Other
 * bots, and anyone else's, are left out of every count.
 */
export const counts = (review) =>
  APP.test(review.user) ||
  (!BOT.test(review.user) && (review.association === undefined || OURS.has(review.association)));

/** Hours from one ISO date to another, decimal. */
export const hours = (from, to) => (new Date(to) - new Date(from)) / 3_600_000;

/** The median of the numbers given, nulls skipped; null when there are none. */
export function median(values) {
  const sorted = values.filter((v) => v !== null && !Number.isNaN(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * One pull request's row from its record: `created_at`, `merged_at`, `commits` as
 * `{ sha, date }`, `reviews` as `{ submitted_at, user, association, body }`, and `firstCi`, the
 * conclusion of the first ci run on the earliest commit that has one, or null.
 */
export function measure(pr) {
  const reviews = pr.reviews
    .filter(counts)
    .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
  const first = reviews[0]?.submitted_at ?? null;
  const commits = [...pr.commits].sort((a, b) => new Date(a.date) - new Date(b.date));
  const afterReview = first ? commits.filter((c) => new Date(c.date) > new Date(first)).length : 0;
  const byPass = Object.fromEntries(PASSES.map((p) => [p, { important: 0, nit: 0 }]));
  let important = 0;
  let nit = 0;
  for (const review of reviews) {
    const found = findings(review.body);
    important += found.important;
    nit += found.nit;
    for (const [pass, f] of Object.entries(found.passes)) {
      if (!byPass[pass]) byPass[pass] = { important: 0, nit: 0 };
      byPass[pass].important += f.important;
      byPass[pass].nit += f.nit;
    }
  }
  return {
    number: pr.number,
    title: pr.title,
    hoursToFirstReview: first ? hours(pr.created_at, first) : null,
    hoursToMerge: hours(pr.created_at, pr.merged_at),
    firstCi: pr.firstCi ?? null,
    commits: commits.length,
    afterReview,
    automatic: reviews.filter((r) => APP.test(r.user)).length,
    preflight: reviews.filter((r) => !APP.test(r.user)).length,
    important,
    nit,
    byPass,
  };
}

/** The totals over the rows: counts, medians and sums the summary line reads. */
export function summarise(rows) {
  const withCi = rows.filter((r) => r.firstCi !== null);
  const reviewed = rows.filter((r) => r.hoursToFirstReview !== null);
  return {
    prs: rows.length,
    firstCiPass: withCi.filter((r) => r.firstCi === "success").length,
    withCi: withCi.length,
    medianFirstReview: median(rows.map((r) => r.hoursToFirstReview)),
    medianMerge: median(rows.map((r) => r.hoursToMerge)),
    reviewed: reviewed.length,
    noRework: reviewed.filter((r) => r.afterReview === 0).length,
    important: rows.reduce((s, r) => s + r.important, 0),
    nit: rows.reduce((s, r) => s + r.nit, 0),
  };
}

/** Hours for a table or a sentence: one decimal under ten, whole above, blank for none. */
export const hoursText = (h) => (h === null ? "" : h < 10 ? h.toFixed(1) : String(Math.round(h)));

/** A row's per-pass counts as `1:i/n 2:i/n 3:i/n`. */
export const byPassText = (byPass) =>
  PASSES.map((p) => `${p}:${byPass[p]?.important ?? 0}/${byPass[p]?.nit ?? 0}`).join(" ");

/**
 * The period's summary as Markdown: what it reads and a row per pull request; the caller adds
 * the summary line.
 */
export function render({ period, generated, rows }) {
  const cell = (text) => String(text).replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
  return [
    `# Measures, ${period}`,
    "",
    `Generated ${generated} by \`pnpm measure\` from GitHub's record of the pull requests merged in`,
    `${period}: when each was opened, first reviewed and merged, whether \`ci\` passed on its first`,
    "commit, how many commits came after the first review, and the findings the reviews' closing",
    "lines carry, in total and per pass. Reviews by the app and by the repository's own people",
    "count; other accounts' do not. Hours are decimal; a blank means the pull request had no",
    "review or no `ci` run. Never edited by hand.",
    "",
    "| PR | Title | First ci | Hours to first review | Hours to merge | Commits | After a review | Automatic reviews | Pre-flight reviews | Important | Nit | By pass (Important/Nit) |",
    "| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...rows.map(
      (r) =>
        `| #${r.number} | ${cell(r.title)} | ${r.firstCi ?? ""} | ${hoursText(r.hoursToFirstReview)} | ${hoursText(r.hoursToMerge)} | ${r.commits} | ${r.afterReview} | ${r.automatic} | ${r.preflight} | ${r.important} | ${r.nit} | ${byPassText(r.byPass)} |`,
    ),
    "",
    "",
  ].join("\n");
}
