# AI-native SDLC assessment

Assessment date: 5 September 2026. Repository commit: `d390bd6`.

## Assessment

This project scores **86/100**. It follows the playbook particularly well in planning,
verification, review, and release recovery. The largest remaining gaps are evaluating the
agent's actual work, closing the maintenance loop, and measuring whether the process improves
delivery.

The assessment inspected the implementation at commit `d390bd6`, live GitHub settings, and
recent PRs. **762 configuration and hook tests passed locally**, and the complete `pnpm verify`
passed in [CI for this commit](https://github.com/anandfrancis93/portfolio/actions/runs/33910121922).

## Rubric

This is a weighted rubric adapted from
[Anthropic's playbook](https://claude.com/blog/the-ai-native-sdlc-playbook). Full credit means
the practice is implemented and supported by evidence at a scale appropriate for this project.

| Criterion | Full-credit standard for this project | Score |
| --- | --- | ---: |
| Planning and traceability | Accepted intent, spec, and plan precede implementation; departures remain traceable. | 10/10 |
| Design and requirements | Versioned design, copy, and quality policies guide decisions; concerns are resolved explicitly. | 10/10 |
| Agent working context | Instructions are accurate, concise, and updated from mistakes. | 9/10 |
| Guardrails and credentials | Tested action restrictions, protected regression tests, and appropriately scoped credentials with limited lifetimes. | 13/15 |
| Product verification | Repeatable checks cover functionality, accessibility, performance, security, and visual inspection. | 15/15 |
| Agent evaluations | Representative tasks demonstrate acceptable outcomes after agent configuration or model changes. | 5/10 |
| Review and accountability | Consistent review passes, recorded findings, verified completion, and human merge decisions. | 9/10 |
| Deployment and recovery | Production approval is enforced; deployment checks and rollback are exercised. | 10/10 |
| Maintenance feedback | Scheduled checks produce actionable findings that return through the development process. | 3/5 |
| Measurement and improvement | A small set of delivery and quality measures informs process changes. | 2/5 |
| **Total** | | **86/100** |

## Applicability

The rubric excludes enterprise administration, regulated separation of duties, Jira integration,
incident channels, and organization-wide tooling distribution. There is also no deduction for
using scripts instead of MCP deployment tools, working sequentially, or comparing screenshots
manually. Those choices fit this repository.

Maintenance remains partly applicable: a static site can have broken résumé delivery, DNS/TLS
problems, dependency vulnerabilities, or failing CI without collecting visitor analytics.

## Missing pieces, in priority order

1. **Evaluate completed work, beyond skill selection.**

   The [skill evaluator](../../../scripts/eval-skills.mjs) allows only the `Skill` tool and grades
   which skill loaded. That proves routing, but cannot establish whether the agent subsequently
   follows the policy. Add a small collection of real tasks: preserve a quotation while editing
   copy, change styling using tokens, or fix a seeded bug without weakening its test. Record the
   model/configuration version and grade the resulting changes. Manual execution is reasonable
   for the subscription budget; outcome coverage is the main gap.

2. **Connect maintenance findings back to actionable work.**

   There is already meaningful coverage: weekly CodeQL, enabled Dependabot security updates,
   and the [watch workflow](../../../.github/workflows/watch.yml). However, that workflow checks
   credential expiry and previously ignored advisories; production smoke checks happen during
   releases and rollbacks. Reuse those smoke checks periodically, with repeated failures
   producing a deduplicated issue or diagnosis. Larger findings can become an intent; small
   maintenance fixes can follow the existing PR exception. Statistical control bands would be
   excessive at this stage.

3. **Measure a few process outcomes.**

   The repository records individual checks and rehearsal timings, but the assessment found no
   recurring assessment of first-attempt CI success, time to review, or repeated review findings.
   A monthly Markdown summary derived from GitHub would be sufficient. Use it to identify which
   checks prevent rework and which review steps create unnecessary effort. The project is too
   young to expect a meaningful historical trend yet.

4. **Make review completion explicit.**

   [PR #25](https://github.com/anandfrancis93/portfolio/pull/25) documents that its automatic
   review check went green without conducting a review because the PR changed the review
   workflow itself. Manual pre-flight reviews provided coverage. Add a deterministic record
   distinguishing "review posted for this commit" from "manual fallback used," and verify that
   the promised reports are present. The owner can retain the merge decision.

5. **Reduce credential lifetime where practical.**

   Production environment approval is real and verified, and credential expiry is monitored.
   However, the [credential records](../../../.github/expiry.json) document approximately one-year
   lifetimes. Shorter expirations or automated rotation would improve this remaining boundary
   without adding approvals to ordinary development.

6. **Trim the agent's starting context.**

   [CLAUDE.md](../../../CLAUDE.md) is useful and unusually well checked for drift, but has grown to
   roughly 1,850 words. Move detailed release procedures, command-output examples, and historical
   explanations into linked runbooks. Keep the everyday commands, essential constraints, and
   recurring mistakes immediately available.
