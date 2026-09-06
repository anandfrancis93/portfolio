# Intent: know when a credential is used outside the workflows

Author: Anand Francis. Status: draft, written on 5 September 2026 for the owner's acceptance.

## Problem

Three credentials act for me without me: two Cloudflare API tokens, one for the preview Worker
and one for production, and the Claude OAuth token that runs the review and mention workflows.
All three sit in the repository's secrets, and all three expire on 3 September 2027. My audit of
5 September 2026 (`docs/sdlc/002-playbook-gaps/assessment.md`, finding 5) asked for shorter
lifetimes where practical. I looked at it and decided otherwise: a shorter token only shortens
how long a leak I never noticed stays useful; what I want is to notice.

Today I would not. The repository catches a token on its way into GitHub (secret scanning and
push protection are on, the pre-commit gate refuses one locally, and GitHub tells Cloudflare
about any of its tokens found in public), but nothing watches the token being used. Cloudflare
records every deployment of a Worker and every action an API token takes, in the Worker's
version list and the account's audit log, and nothing reads them. If a stolen token deployed a
defaced Worker at three in the morning, I would learn of it from a visitor, or from the weekly
smoke check only if the change happened to break it.

The watch workflow already knows how to turn a failed check into a chore I see: it opens or
updates the issue "The watch failed" and closes it when a later run passes. It runs weekly and
checks expiry, silenced advisories and that the site answers. It does not check who touched the
site.

## Proposed outcome

Any use of a credential that the workflows did not make is reported to me within the watch's
interval, through GitHub's own notifications, with enough in the report to act on.

1. **Unexpected use is a chore.** A watch job reads the last interval of deployments for both
   Workers and of the account's audit log, and the `deploy` workflow's runs for the same window
   (and the watch's own reads, so it does not report itself). Every deployment and every action
   by the account's API tokens has to fall inside a run's window; anything that does not opens
   or updates an issue naming the actor, the action, the resource and the time. My own
   dashboard actions are reported too, by design: I will recognise them, and if I do not, that
   is the report working.
2. **The interval is the delay.** The watch moves from weekly to an interval the spec sets,
   hourly unless it finds a reason not to; Actions are free on a public repository. The weekly
   checks it already runs keep their cadence or move with it, as the spec decides.
3. **The tokens can do only what they do.** The watch's token gains the one permission this
   needs, reading the audit log; the two deploy tokens' permissions are listed in the spec and
   confirmed minimal (the preview one edits Workers on the account, the production one adds the
   zone route). Nothing else changes about them.
4. **The lifetime decision is recorded.** One year stays, with the reason above, in this intent
   and in the plan's closing record, so the assessment's fifth finding closes as a decision, not
   an omission.
5. **Exercised once before it closes.** One deliberate deploy to the preview Worker from my
   machine, outside any run, and the issue seen opening within one interval; then the same run
   passing on the next interval with nothing to report. Both recorded in the plan.

## Affected users and systems

- Me, as owner and the only person with write access; the reports reach me as GitHub
  notifications on the issue.
- The repository: the `watch` workflow, its schedule, the issue it maintains, one new script
  under `scripts/` with its tests, the runbook's "The watch".
- My Cloudflare account: one token permission added (or one token reissued) so the audit log can
  be read; the account's audit log and the Workers' version lists, read only.
- Nothing a visitor sees. The site, its copy and its design do not change.

## Constraints

- Steps that handle a credential value are mine: editing a token's permissions, pasting a value
  into a secret. Claude drives everything up to and after those moments, and never has a token
  value pass through its tools.
- The check reads and reports. It never revokes, rotates or deploys; the response to a report is
  mine, by hand, and the runbook says what it is.
- The repository is public and on GitHub Free; nothing that needs a paid plan or a paid
  Cloudflare feature is assumed. GitHub disables a public repository's schedules after sixty
  days without a commit; the watch's comment already says so, and this intent does not fix it.
- No model-driven step. The job is a Node script that asks two APIs and compares timestamps.
- The same process as every change: this intent, a spec, a plan, reviewed pull requests, with
  departures written into the plan in the same PR. The rule in CLAUDE.md is why this is an
  intent and not maintenance: it adds a promise to the process.

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
- The assessment's fifth finding is closed in the scorecard by this record, and the "Guardrails
  and credentials" row does not fall.
- Every report the job ever makes is one I can act on from the issue alone: who, what, when.

## Open questions

- Whether read-only API calls, the watch's own included, appear in Cloudflare's audit log. If
  they do, the matcher must exclude the watch's own window; if not, the job is simpler. One real
  call with my token decides it, before the spec is written.
- Whether an audit-log entry identifies the token that acted or only the account it belongs to.
  The deployments list carries a source and an author; if the audit log does not name the token,
  the spec leans on the window alone.
- The interval: hourly is the proposal; the spec confirms it against what a run costs in minutes
  and what a report a day late would have cost.
