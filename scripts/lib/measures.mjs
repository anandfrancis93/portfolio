// The delivery measures (the runbook, "Measures"): what scripts/measure.mjs computes from the
// record GitHub keeps of each pull request, kept pure so the configuration tests can feed it
// fixtures. The playbook's indicators, read from the trail the process already leaves: whether
// ci passed on the first commit, hours to the first review and to the merge, commits after a
// review, and the findings the reviews' closing lines carry, since every review posted here,
// the pre-flight's and the workflow's, ends each pass with "Pass N (name): X Important, Y Nit".

const CLOSING = /^Pass \d \([^)]*\): (\d+) Important, (\d+) Nit\.?\s*$/gm;
const APP = /^claude(\[bot\])?$/;

/** The Important and Nit counts a review's closing lines carry, summed over its passes. */
export function findings(body) {
  let important = 0;
  let nit = 0;
  for (const [, i, n] of String(body ?? "").matchAll(CLOSING)) {
    important += Number(i);
    nit += Number(n);
  }
  return { important, nit };
}

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
 * `{ sha, date }`, `reviews` as `{ submitted_at, user, body }`, and `firstCi`, the conclusion of
 * ci on the earliest commit that has one, or null.
 */
export function measure(pr) {
  const reviews = [...pr.reviews].sort(
    (a, b) => new Date(a.submitted_at) - new Date(b.submitted_at),
  );
  const first = reviews[0]?.submitted_at ?? null;
  const commits = [...pr.commits].sort((a, b) => new Date(a.date) - new Date(b.date));
  const afterReview = first ? commits.filter((c) => new Date(c.date) > new Date(first)).length : 0;
  const totals = reviews
    .map((r) => findings(r.body))
    .reduce((s, f) => ({ important: s.important + f.important, nit: s.nit + f.nit }), {
      important: 0,
      nit: 0,
    });
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
    ...totals,
  };
}

/** The totals over the rows: counts, medians and sums the summary line reads. */
export function summarise(rows) {
  const withCi = rows.filter((r) => r.firstCi !== null);
  return {
    prs: rows.length,
    firstCiPass: withCi.filter((r) => r.firstCi === "success").length,
    withCi: withCi.length,
    medianFirstReview: median(rows.map((r) => r.hoursToFirstReview)),
    medianMerge: median(rows.map((r) => r.hoursToMerge)),
    noRework: rows.filter((r) => r.afterReview === 0).length,
    important: rows.reduce((s, r) => s + r.important, 0),
    nit: rows.reduce((s, r) => s + r.nit, 0),
  };
}

/** Hours for a table or a sentence: one decimal under ten, whole above, blank for none. */
export const hoursText = (h) => (h === null ? "" : h < 10 ? h.toFixed(1) : String(Math.round(h)));

/** The period's summary as Markdown: what it reads and a row per pull request; the caller adds the summary line. */
export function render({ period, generated, rows }) {
  const cell = (text) => String(text).replace(/\|/g, "\\|");
  return [
    `# Measures, ${period}`,
    "",
    `Generated ${generated} by \`pnpm measure\` from GitHub's record of the pull requests merged in`,
    `${period}: when each was opened, first reviewed and merged, whether \`ci\` passed on its first`,
    "commit, how many commits came after the first review, and the findings the reviews' closing",
    "lines carry. Hours are decimal; a blank means the pull request had no review or no ci run.",
    "",
    "| PR | Title | First ci | Hours to first review | Hours to merge | Commits | After a review | Automatic reviews | Pre-flight reviews | Important | Nit |",
    "| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map(
      (r) =>
        `| #${r.number} | ${cell(r.title)} | ${r.firstCi ?? ""} | ${hoursText(r.hoursToFirstReview)} | ${hoursText(r.hoursToMerge)} | ${r.commits} | ${r.afterReview} | ${r.automatic} | ${r.preflight} | ${r.important} | ${r.nit} |`,
    ),
    "",
    "",
  ].join("\n");
}
