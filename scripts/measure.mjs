// The delivery measures (the runbook, "Measures"): the playbook's indicators for the pull
// requests merged in a month, read from GitHub through gh, so the process is measured by the
// trail it already leaves rather than by anything it has to remember to record. Per pull
// request: whether ci passed on its first run on the earliest commit that has one, hours from
// opening to the first review and to the merge, commits after the first review, reviews by the
// app and by the session, and the Important and Nit counts every review's closing lines carry,
// in total and per pass. Needs gh, logged in; reads every closed pull request, a page at a
// time.
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
  if (at < 0) return null;
  const value = args[at + 1];
  if (value === undefined || value.startsWith("--")) {
    console.error(`${name} wants a value`);
    process.exit(1);
  }
  return value;
};
const all = args.includes("--all");
const write = args.includes("--write");
const month = option("--month") ?? new Date().toISOString().slice(0, 7);
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
  console.error(`--month wants YYYY-MM, not "${month}"`);
  process.exit(1);
}
const period = all ? "every month" : month;

/** gh's output as text, or an exit with its error. */
function gh(...ghArgs) {
  const result = spawnSync("gh", ghArgs, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
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

/** Every item of a list endpoint, a hundred at a time until a page comes back short. */
function pages(path) {
  const items = [];
  for (let page = 1; ; page += 1) {
    const got = api(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    items.push(...got);
    if (got.length < 100) return items;
  }
}

const repo = gh("repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner").trim();
const pulls = pages(`repos/${repo}/pulls?state=closed&sort=updated&direction=desc`)
  .filter((p) => p.merged_at && (all || p.merged_at.startsWith(month)))
  .sort((a, b) => a.number - b.number);

const rows = pulls.map((pull) => {
  const commits = pages(`repos/${repo}/pulls/${pull.number}/commits`)
    .map((c) => ({ sha: c.sha, date: c.commit.committer.date }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const reviews = pages(`repos/${repo}/pulls/${pull.number}/reviews`).map((r) => ({
    submitted_at: r.submitted_at,
    user: r.user.login,
    association: r.author_association,
    body: r.body,
  }));
  // The first ci run on the first commit that has one: the first push, its first attempt.
  let firstCi = null;
  for (const commit of commits) {
    const runs = api(
      `repos/${repo}/commits/${commit.sha}/check-runs?check_name=ci&filter=all&per_page=100`,
    ).check_runs;
    if (runs.length > 0) {
      runs.sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
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
const detail = `ci green on the first commit for ${totals.firstCiPass} of ${totals.withCi}; median ${hoursText(totals.medianFirstReview)} h to the first review and ${hoursText(totals.medianMerge)} h to merge; ${totals.noRework} of ${totals.reviewed} reviewed merged with no commit after a review; ${totals.important} Important and ${totals.nit} Nit reported.`;
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
