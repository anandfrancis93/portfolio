// scripts/lib/measures.mjs against fixtures: the closing-line parser, the timings, the medians,
// the per-pull-request row, the totals and the Markdown, so the monthly summary is arithmetic
// that is checked rather than arithmetic that is trusted.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
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
  "Pass 3 (Compliance): 0 Important, 2 Nit.",
].join("\n");

describe("findings", () => {
  it("sums the closing lines, with or without a full stop", () => {
    assert.deepEqual(findings(REPORT), { important: 1, nit: 7 });
  });
  it("finds nothing in a body without closing lines, or no body", () => {
    assert.deepEqual(findings("Looks fine."), { important: 0, nit: 0 });
    assert.deepEqual(findings(null), { important: 0, nit: 0 });
  });
  it("ignores a closing line quoted mid-sentence", () => {
    assert.deepEqual(findings("as in Pass 1 (Bugs): 9 Important, 9 Nit here"), {
      important: 0,
      nit: 0,
    });
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
  title: "Move | the procedures",
  created_at: "2026-09-05T07:00:00Z",
  merged_at: "2026-09-05T09:00:00Z",
  commits: [
    { sha: "b", date: "2026-09-05T08:00:00Z" },
    { sha: "a", date: "2026-09-05T06:50:00Z" },
    { sha: "c", date: "2026-09-05T08:30:00Z" },
  ],
  reviews: [
    { submitted_at: "2026-09-05T07:30:00Z", user: "anandfrancis93", body: REPORT },
    {
      submitted_at: "2026-09-05T07:20:00Z",
      user: "claude[bot]",
      body: "Pass 1 (Bugs): 0 Important, 1 Nit.",
    },
  ],
  firstCi: "success",
};

describe("measure", () => {
  const row = measure(PR);
  it("times the first review and the merge from the opening", () => {
    assert.equal(row.hoursToFirstReview, hours(PR.created_at, "2026-09-05T07:20:00Z"));
    assert.equal(row.hoursToMerge, 2);
  });
  it("counts the commits after the first review, whatever order GitHub returned them in", () => {
    assert.equal(row.commits, 3);
    assert.equal(row.afterReview, 2);
  });
  it("tells the app's reviews from the session's and sums every closing line", () => {
    assert.equal(row.automatic, 1);
    assert.equal(row.preflight, 1);
    assert.equal(row.important, 1);
    assert.equal(row.nit, 8);
  });
  it("carries the first ci verdict, or null", () => {
    assert.equal(row.firstCi, "success");
    assert.equal(measure({ ...PR, firstCi: undefined }).firstCi, null);
  });
  it("leaves the review timing blank and counts no rework when there was no review", () => {
    const quiet = measure({ ...PR, reviews: [] });
    assert.equal(quiet.hoursToFirstReview, null);
    assert.equal(quiet.afterReview, 0);
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
    measure({ ...PR, number: 28, firstCi: null }),
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
  it("counts the pull requests with no commit after a review and sums the findings", () => {
    assert.equal(totals.noRework, 1);
    assert.equal(totals.important, 2);
    assert.equal(totals.nit, 16);
  });
});

describe("render", () => {
  const markdown = render({ period: "2026-09", generated: "2026-09-05", rows: [measure(PR)] });
  it("starts with the heading, carries a row per pull request and leaves room for the summary", () => {
    assert.match(markdown, /^# Measures, 2026-09\n/);
    assert.match(
      markdown,
      /\n\| #26 \| Move \\\| the procedures \| success \| 0\.3 \| 2\.0 \| 3 \| 2 \| 1 \| 1 \| 1 \| 8 \|\n/,
    );
    assert.match(markdown, /\|\n\n$/);
  });
});
