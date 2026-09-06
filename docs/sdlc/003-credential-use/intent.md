# Intent: know when a credential is used outside the workflows

Author: Anand Francis. Status: accepted by the product owner on 5 September 2026.

## Problem

Three credentials act for me without me: two Cloudflare API tokens, the preview one in the
repository's secrets and the production one in the GitHub environment `production`, and the
Claude OAuth token that runs the review and mention workflows, in the repository's secrets.
All three expire on 3 September 2027. My audit of 5 September 2026
(`docs/sdlc/002-playbook-gaps/assessment.md`, finding 5) asked for shorter lifetimes where
practical. I looked at it and decided otherwise: a shorter token only shortens how long a leak
I never noticed stays useful; what I want is to notice.

Today I would not. The repository catches a token on its way into GitHub (secret scanning and
push protection are on, the pre-commit gate refuses the Claude token's shape locally, and
GitHub tells Cloudflare about any of its tokens found in public), but nothing watches a token
being used. Cloudflare records every change a token or a person makes to the account, in each
Worker's version list and in the account's audit log, and nothing reads them. If a stolen token
deployed a defaced Worker at three in the morning, I would learn of it from a visitor, or from
the weekly smoke check only if the change happened to break it.

The watch workflow already knows how to turn a failed check into a chore I see: it opens or
updates the issue "The watch failed" and closes it when a later run passes. It runs weekly and
checks expiry, silenced advisories and that the site answers. It does not check who touched the
site. Intent 002 put monitoring out of scope, "a static site with no telemetry has nothing to
watch", and PR #29 reopened one piece of it, a weekly probe of what a visitor gets. This intent
reopens one more, who changed the site and with what, and says so here so the trail from that
decision runs through this record.

## Proposed outcome

Any change to the account that the workflows did not make is reported to me within the watch's
interval, through GitHub's own notifications, with enough in the report to act on and nothing
in it that should not be public.

1. **Unexpected use is a chore.** A watch job reads the changes Cloudflare recorded since its
   last run, the deployments of both Workers and the account's audit log, with enough overlap
   between runs to miss nothing and each entry counted once, and the `deploy` workflow's runs
   for the same window. It judges in this order: who acted, then when, then how much. Any
   actor other than the two deploy tokens is reported whatever the time, my own dashboard
   actions included, by design: I will recognise them, and if I do not, that is the report
   working. A deploy token acting outside every run is reported. Inside a run's window the
   window alone proves nothing, since a stolen token looks like the real one and the preview
   job's windows are public on every pull request; a run makes a known number of writes to a
   known Worker, so a second deployment, or a write to a Worker the run did not touch, is
   reported too. A report opens or updates an issue.
2. **The report is safe to print.** The issue is public, so the report prints from an
   allow-list the spec fixes: the token's name or "dashboard", the action, the Worker, the
   time; never an email address, an IP address, the account id or a request body, and the same
   allow-list governs the job's own log. Text a deployer chose, a version's message or a new
   Worker's name, is quoted as text, since a thief can put a link into my notification.
3. **The interval is the delay.** The watch moves from weekly to an interval the spec sets,
   hourly unless it finds a reason not to; Actions are free on a public repository. That
   supersedes spec 002's sentence that the watch runs weekly, recorded in plan 002 as PR #23's
   change was. The weekly checks it already runs keep their cadence or move with it, as the
   spec decides.
4. **The tokens can do only what they do.** The watch reads with a token of its own that can
   only read, the audit log and the Workers' versions, and the deploy tokens gain nothing in
   return: a token that can read the audit log can read the account's membership and eighteen
   months of my logins with it, which is not something a deploy token should carry. That is a
   fourth credential, with its own line and expiry in `.github/expiry.json`. The two deploy
   tokens' permissions are listed in the spec and confirmed minimal (the preview one edits
   Workers on the account, the production one adds the zone route). That supersedes spec 002's
   sentence that the watch runs on the preview token, recorded the same way.
5. **The lifetime decision is recorded.** One year stays, with the reason above, in this intent,
   in the plan's closing record and beside the #28 to #30 records in plan 002, so the
   assessment's fifth finding closes as a decision, not an omission; the scorecard's C4 stays
   at 2 and its note says why.
6. **Exercised once before it closes.** One deliberate deploy to the preview Worker from my
   machine, outside any run, and the issue seen opening within one interval; then the next
   interval's run with nothing to report. Both recorded in the plan.
7. **A stopped watch is noticed.** A detector that stops is the failure I would not see: an
   empty issue reads the same as a job that no longer runs, and GitHub disables a public
   repository's schedules after sixty days without a commit. The spec names the sign I watch
   for, a heartbeat of its choosing or GitHub's own disabled-workflow notice, and the runbook's
   "The watch" says what to do about it.

## Affected users and systems

- Me, as owner and the only person with write access; the reports reach me as GitHub
  notifications on the issue.
- The repository: the `watch` workflow, its schedule, the issue it maintains, one new script
  under `scripts/` with its tests, `.github/expiry.json`, the runbook's "The watch", and plan
  002, where the two spec 002 sentences this supersedes are recorded.
- My Cloudflare account: one new read-only API token; the account's audit log and the Workers'
  version lists, read only.
- Nothing a visitor sees. The site, its copy and its design do not change.

## Constraints

- Steps that handle a credential value are mine: creating the read-only token, pasting it into
  a secret. Claude drives everything up to and after those moments, and never has a token value
  pass through its tools.
- The check reads and reports. It never revokes, rotates or deploys; the response to a report is
  mine, by hand, and the runbook says what it is.
- The repository is public and on GitHub Free; nothing that needs a paid plan or a paid
  Cloudflare feature is assumed. The audit log is on every Cloudflare plan; Logpush is not.
- No model-driven step. The job is a Node script that asks two APIs and compares.
- The promise covers what Cloudflare records. Its audit log keeps changes, not reads or refused
  requests, so a thief who only reads, or only probes, leaves no entry; the spec says so in
  words, and the report never claims more than the log holds.
- The same process as every change: this intent, a spec, a plan, reviewed pull requests, with
  departures written into the plan in the same PR. CLAUDE.md's rule is why this is an intent
  and not maintenance, on both its counts: it adds a promise to the process, and it reverses
  more of a decision intent 002 made.

## Out of scope

- Shortening the Cloudflare tokens' lifetimes. Decided against above; a later intent can revisit
  it with a year of reports to judge by.
- Automatic revocation on a report. A false positive, my own dashboard action, would then cut
  off CI; the cost of a wrong automatic response is higher than an hour of a wrong deploy on a
  static site.
- The Claude OAuth token's use. Anthropic exposes no usage feed for a subscription's token; its
  expiry is its only bound, and a drain on the subscription is the only sign. Named here so the
  gap is a known one.
- Any alerting channel beyond GitHub's notifications: no email service, no chat integration.
- Changing what the site says or how it looks.

## Success measures

- The rehearsal: a deploy from my machine outside any run opens the issue within one interval,
  and the next interval's run has nothing to report.
- A normal fortnight of releases and reviews, all through the workflows, opens no issue.
- The scorecard's C4 stays at 2 with its note amended to say the year is a decision, and the
  assessment's fifth finding is closed by the records this intent names, in plan 002 and in
  plan 003's closing record.
- Every report the job ever makes is one I can act on from the issue alone, which token or the
  dashboard, what, when, and prints nothing the allow-list forbids.

## Open questions

- One real call with my token, before the spec is written, to confirm what Cloudflare's
  documentation says: that reads and refused requests are not logged, which settles the
  watch's own exclusion, and that an entry names the token that acted, by id and name, which
  the actor-first rule rests on. The spec is written on what the call shows.
- Whether the number of writes a run makes is stable enough to be the in-window test, or
  whether the deploy workflow should record the version it made so the watch can compare ids.
  The spec decides on the rehearsal's evidence.
- The interval: hourly is the proposal; the spec confirms it against what a run costs in minutes
  and what a report a day late would have cost.
