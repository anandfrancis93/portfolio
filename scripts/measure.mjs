// The delivery measures (the runbook, "Measures"): the playbook's indicators for the pull
// requests merged in a month, read from GitHub through gh, so the process is measured by the
// trail it already leaves rather than by anything it has to remember to record. Per pull
// request: whether ci passed on the earliest commit that has a ci run, hours from opening to
// the first review and to the merge, commits after the first review, reviews by the app and by
// the session, and the Important and Nit counts every review's closing lines carry. Needs gh,
// logged in; reads the hundred most recently updated closed pull requests, more than a month
// here has had.
//   pnpm measure                     the current month, UTC
//   pnpm measure --month 2026-09     one month
//   pnpm measure --all               every merged pull request
//   pnpm measure --write             also write docs/measures/<period>.md
// Prints the Markdown, whose last line is "Measures: N pull requests merged in <period>; ...".
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hoursText, measure, render, summarise } from "./lib/measures.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : null;
};
const all = args.includes("--all");
const write = args.includes("--write");
const month = option("--month") ?? new Date().toISOString().slice(0, 7);
if (!/^\d{4}-\d{2}$/.test(month)) {
  console.error(`--month wants YYYY-MM, not "${month}"`);
  process.exit(1);
}
const period = all ? "every month" : month;

/** gh's output as text, or an exit with its error. */
function gh(...ghArgs) {
  const result = spawnSync("gh", ghArgs, { encoding: "utf8", windowsHide: true });
  if (result.error) {
    console.error(`Could not run gh: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`gh ${ghArgs.slice(0, 2).join(" ")} failed:\n${(result.stderr ?? "").trim()}`);
    process.exit(1);
  }
  return result.stdout ?? "";
}
const api = (path) => JSON.parse(gh("api", path));

const repo = gh("repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner").trim();
const pulls = api(`repos/${repo}/pulls?state=closed&per_page=100&sort=updated&direction=desc`)
  .filter((p) => p.merged_at && (all || p.merged_at.startsWith(month)))
  .sort((a, b) => a.number - b.number);

const rows = pulls.map((pull) => {
  const commits = api(`repos/${repo}/pulls/${pull.number}/commits?per_page=100`)
    .map((c) => ({ sha: c.sha, date: c.commit.committer.date }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const reviews = api(`repos/${repo}/pulls/${pull.number}/reviews?per_page=100`).map((r) => ({
    submitted_at: r.submitted_at,
    user: r.user.login,
    body: r.body,
  }));
  // The first commit that ci ran on: the first push, whatever the branch carried before it.
  let firstCi = null;
  for (const commit of commits) {
    const runs = api(`repos/${repo}/commits/${commit.sha}/check-runs?check_name=ci`).check_runs;
    if (runs.length > 0) {
      firstCi = runs[0].conclusion;
      break;
    }
  }
  return measure({
    number: pull.number,
    title: pull.title,
    created_at: pull.created_at,
    merged_at: pull.merged_at,
    commits,
    reviews,
    firstCi,
  });
});

const totals = summarise(rows);
const detail = `ci green on the first commit for ${totals.firstCiPass} of ${totals.withCi}; median ${hoursText(totals.medianFirstReview)} h to the first review and ${hoursText(totals.medianMerge)} h to merge; ${totals.noRework} merged with no commit after a review; ${totals.important} Important and ${totals.nit} Nit reported.`;
const generated = new Date().toISOString().slice(0, 10);
const markdown = render({ period, generated, rows });

if (write) {
  const rel = `docs/measures/${all ? "all" : month}.md`;
  mkdirSync(resolve(root, "docs/measures"), { recursive: true });
  // The file ends with the same line the terminal does.
  writeFileSync(
    resolve(root, rel),
    `${markdown}Measures: ${totals.prs} pull requests merged in ${period}; ${detail}\n`,
  );
  console.log(`Wrote ${rel}`);
}
process.stdout.write(markdown);
console.log(`Measures: ${totals.prs} pull requests merged in ${period}; ${detail}`);
