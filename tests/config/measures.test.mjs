// scripts/lib/measures.mjs against fixtures: the closing-line parser in the forms the record
// carries, which reviews count, the timings, the medians, the per-pull-request row, the totals
// and the Markdown, so the monthly summary is arithmetic that is checked rather than trusted.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  byPassText,
  counts,
  findings,
  hours,
  hoursText,
  measure,
  median,
  render,
  summarise,
} from "../../scripts/lib/measures.mjs";

const REPORT = [
  "## Pre-flight review, pass 1: Bugs",
  "",
  "**Important** — `a:1` — something",
  "",
  "Pass 1 (Bugs): 1 Important, 5 Nit",
  "",
  "Pass 2 (Accessibility, performance and security): 0 Important, 0 Nit.",
  "Pass 3 (Compliance): 0 Important, 2 Nit (1 listed)",
].join("\n");

describe("findings", () => {
  it("sums the closing lines, with a full stop, a note after them, or neither", () => {
    assert.deepEqual(findings(REPORT), {
      important: 1,
      nit: 7,
      passes: {
        1: { important: 1, nit: 5 },
        2: { important: 0, nit: 0 },
        3: { important: 0, nit: 2 },
      },
    });
  });
  it("reads the owner's one-report form too", () => {
    assert.deepEqual(findings("...\nFindings: 1 Important, 3 Nit\n"), {
      important: 1,
      nit: 3,
      passes: {},
    });
  });
  it("finds nothing in a body without closing lines, or no body", () => {
    assert.deepEqual(findings("Looks fine."), { important: 0, nit: 0, passes: {} });
    assert.deepEqual(findings(null), { important: 0, nit: 0, passes: {} });
  });
  it("ignores a closing line quoted mid-sentence or under a heading", () => {
    assert.equal(findings("as in Pass 1 (Bugs): 9 Important, 9 Nit here").important, 0);
    assert.equal(findings("### Pass 1 (Bugs)\n**Pass 1 (Bugs).** No findings.").important, 0);
  });
});

describe("counts", () => {
  it("keeps the app's reviews and the repository's own people's", () => {
    assert.ok(counts({ user: "claude[bot]" }));
    assert.ok(counts({ user: "anandfrancis93", association: "OWNER" }));
    assert.ok(counts({ user: "someone", association: "COLLABORATOR" }));
    assert.ok(counts({ user: "fixture" }));
  });
  it("drops other bots and anyone without a standing", () => {
    assert.ok(!counts({ user: "github-actions[bot]", association: "NONE" }));
    assert.ok(!counts({ user: "github-advanced-security[bot]", association: "NONE" }));
    assert.ok(!counts({ user: "stranger", association: "NONE" }));
    assert.ok(!counts({ user: "stranger", association: "CONTRIBUTOR" }));
  });
});

describe("hours and median", () => {
  it("counts decimal hours between two dates", () => {
    assert.equal(hours("2026-09-05T07:00:00Z", "2026-09-05T08:30:00Z"), 1.5);
  });
  it("takes the middle value, or the mean of the two middle ones, skipping nulls", () => {
    assert.equal(median([3, null, 1, 2]), 2);
    assert.equal(median([4, 1, 3, 2]), 2.5);
    assert.equal(median([null]), null);
    assert.equal(median([]), null);
  });
  it("prints hours to one decimal under ten and whole above, blank for none", () => {
    assert.equal(hoursText(1.25), "1.3");
    assert.equal(hoursText(12.6), "13");
    assert.equal(hoursText(null), "");
  });
});

const PR = {
  number: 26,
  title: "Move | the \\ procedures",
  created_at: "2026-09-05T07:00:00Z",
  merged_at: "2026-09-05T09:00:00Z",
  commits: [
    { sha: "b", date: "2026-09-05T08:00:00Z" },
    { sha: "a", date: "2026-09-05T06:50:00Z" },
    { sha: "c", date: "2026-09-05T08:30:00Z" },
  ],
  reviews: [
    {
      submitted_at: "2026-09-05T07:30:00Z",
      user: "anandfrancis93",
      association: "OWNER",
      body: REPORT,
    },
    {
      submitted_at: "2026-09-05T07:20:00Z",
      user: "claude[bot]",
      association: "NONE",
      body: "Pass 1 (Bugs): 0 Important, 1 Nit.",
    },
    {
      // The review workflow's own notice, posted before either: not a review of anything.
      submitted_at: "2026-09-05T07:05:00Z",
      user: "github-actions[bot]",
      association: "NONE",
      body: "Automatic review did not run on abc: the workflow file differs.",
    },
  ],
  firstCi: "success",
};

describe("measure", () => {
  const row = measure(PR);
  it("times the first counted review and the merge from the opening", () => {
    assert.equal(row.hoursToFirstReview, hours(PR.created_at, "2026-09-05T07:20:00Z"));
    assert.equal(row.hoursToMerge, 2);
  });
  it("counts the commits after the first review, whatever order GitHub returned them in", () => {
    assert.equal(row.commits, 3);
    assert.equal(row.afterReview, 2);
  });
  it("tells the app's reviews from the session's, leaves other bots out, and sums per pass", () => {
    assert.equal(row.automatic, 1);
    assert.equal(row.preflight, 1);
    assert.equal(row.important, 1);
    assert.equal(row.nit, 8);
    assert.deepEqual(row.byPass, {
      1: { important: 1, nit: 6 },
      2: { important: 0, nit: 0 },
      3: { important: 0, nit: 2 },
    });
    assert.equal(byPassText(row.byPass), "1:1/6 2:0/0 3:0/2");
  });
  it("carries the first ci verdict, or null", () => {
    assert.equal(row.firstCi, "success");
    assert.equal(measure({ ...PR, firstCi: undefined }).firstCi, null);
  });
  it("leaves the review timing blank and counts no rework when no counted review exists", () => {
    const quiet = measure({ ...PR, reviews: [PR.reviews[2]] });
    assert.equal(quiet.hoursToFirstReview, null);
    assert.equal(quiet.afterReview, 0);
    assert.equal(quiet.preflight, 0);
  });
});

describe("summarise", () => {
  const rows = [
    measure(PR),
    measure({
      ...PR,
      number: 27,
      firstCi: "failure",
      reviews: [],
      merged_at: "2026-09-05T11:00:00Z",
    }),
    measure({ ...PR, number: 28, firstCi: null, commits: [PR.commits[1]] }),
  ];
  const totals = summarise(rows);
  it("counts the pull requests and the first-ci passes among those with a run", () => {
    assert.equal(totals.prs, 3);
    assert.equal(totals.withCi, 2);
    assert.equal(totals.firstCiPass, 1);
  });
  it("takes medians over the rows that have a value", () => {
    assert.equal(totals.medianFirstReview, rows[0].hoursToFirstReview);
    assert.equal(totals.medianMerge, 2);
  });
  it("counts rework over the reviewed pull requests only, and sums the findings", () => {
    assert.equal(totals.reviewed, 2);
    assert.equal(totals.noRework, 1);
    assert.equal(totals.important, 2);
    assert.equal(totals.nit, 16);
  });
});

describe("render", () => {
  const markdown = render({ period: "2026-09", generated: "2026-09-05", rows: [measure(PR)] });
  it("starts with the heading, escapes the title, carries a row per pull request and leaves room for the summary", () => {
    assert.match(markdown, /^# Measures, 2026-09\n/);
    assert.match(
      markdown,
      /\n\| #26 \| Move \\\| the \\\\ procedures \| success \| 0\.3 \| 2\.0 \| 3 \| 2 \| 1 \| 1 \| 1 \| 8 \| 1:1\/6 2:0\/0 3:0\/2 \|\n/,
    );
    assert.match(markdown, /Never edited by hand\./);
    assert.match(markdown, /\|\n\n$/);
  });
});
