# Intent: keep my email address off GitHub

Author: Anand Francis. Status: accepted by the product owner on 22 October 2026.
Delivered 23 October 2026: the address is off GitHub; see `plan.md`, section "Records", and its
last departure for the first merge's check.

## Problem

The site shows my Gmail address as its contact link. That is on purpose, and it stays.

GitHub also shows it, and I do not want that. The repository is public, and the address is in
three places there:

- `src/content/profile.yaml` holds it as `identity.email`. Intent 001 put all copy in that file.
- `scripts/check-voice.mjs`, the voice skill, intent 001 and spec 001 spell it in full.
- 185 of the 190 commits on `main` name it as the author, and 136 as the committer. My merges in
  the web UI and my commits from the MacBook both used it.

Anyone who reads the repository, its history, or a CI artifact can collect it from there. On the
site it is an address I chose to publish. On GitHub it is an address any scraper of public
commits picks up.

## Proposed outcome

The site looks and works as it does today. No file, commit or artifact on GitHub contains the
address.

1. **The address comes from outside the repository.** The build reads it from a value the CI
   workflows get from a GitHub secret, and a local build gets from a file that git ignores.
   `profile.yaml` keeps every other piece of copy. A build without the value fails, so a
   release never ships an empty contact link.
2. **Checks and tests stop naming it.** The voice check, the content tests, the PDF test and the
   skill compare against the same value, or check its shape. No file in the repository spells
   the address.
3. **CI output does not leak it.** The `ci` workflow uploads the `reports` artifact on every run:
   the PDF, the card image, and the Playwright and Lighthouse output. These contain the address,
   and a public repository's artifacts and logs are public. The spec says which uploads stay,
   and how the address is kept out of them.
4. **History no longer contains it.** After this lands, the history is rewritten. Each commit by
   me gets my GitHub noreply address as author and as committer, and each old version of a file
   gets a placeholder. The rewritten history moves into a new public repository with the same
   name. The old repository becomes a private archive, so its PRs, issues and artifacts are no
   longer public.
5. **New commits do not bring it back.** My MacBook's git `user.email` becomes the noreply
   address. I check that GitHub's "Keep my email addresses private" is on, and turn on "Block
   command line pushes that expose my email". A web merge on 22 October 2026 still used the
   address, so the first merge in the new repository is checked for it.

## Affected users and systems

- Visitors: nothing changes. The contact link, the menu, the 404 page and the PDF still show
  the address.
- The repository: `profile.yaml`, its schema, the components that read `identity.email`, the
  voice check, the tests, the voice skill, the CI and deploy workflows, `.gitignore`, the
  runbook, intent 001 and spec 001. CLAUDE.md and spec 001 say all copy lives in
  `profile.yaml`; both get an exception for the address.
- GitHub: a new repository secret, and later the repository swap. After the swap I add again the
  secrets, the watch token, the `production` environment, the ruleset, and the code scanning,
  secret scanning and push protection settings.
- Intent 003's watch. It matches Cloudflare changes against the Actions runs of this repository,
  and the heartbeat reads the watch's own runs. A new repository starts with no runs, so the
  spec says how the swap avoids a false report and a red heartbeat.
- My MacBook: the git setting and one ignored local file.

## Constraints

- I handle the address and the secret values myself. Claude never puts the address in a file,
  a commit, a PR or a log.
- The repository stays public, so its Actions minutes stay free.
- The history rewrite and the swap happen only after this intent's build is merged. Old PR
  links in the docs then point to the archive, and the swap's record says so.
- The same process as every change: this intent, a spec, a plan, reviewed pull requests.

## Out of scope

- Hiding the address on the site. I want visitors to have it.
- Copies that already exist outside GitHub: clones, forks, caches and scrapers that read the
  history before the swap. Nothing in this repository can reach them.
- The other public repositories.
- The ADLC adoption. That is intent 005, and it starts after the swap, in the new repository.

## Success measures

- A search of the new repository's files, history and artifacts for the address finds nothing.
- The deployed site shows the address in the same four places as before.
- `pnpm verify` passes, with the address supplied only from outside the repository.

## Open questions

- Where a pull request's build gets the value. A Dependabot pull request cannot read Actions
  secrets, so the spec decides between a Dependabot secret and a stand-in address for builds
  that do not deploy.
- Which CI artifacts stay. The spec decides whether reports drop the address or stop uploading.
