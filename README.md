# GMED — The Gerged & Mreened Evidence Department

> **Merged is a claim. Green is evidence.**
> People Above Profit · Ledger Above Ego · Laughter Before Hatred.

GMED started as the gloriously mangled release cry **“Gerged and Mreened”**. The joke now has a job: a local-first, MIT-licensed, read-only GitHub pull-request evidence checker.

Repository: https://github.com/MichaelWave369/GMED

GitHub Pages target: https://michaelwave369.github.io/GMED/ (published only after Pages is configured and the deployment succeeds).

## What Rung 1 actually does

- **GERGED:** Confirms GitHub reports the PR as merged, not merely closed.
- **MREENED:** Inspects the exact merged commit SHA, not the PR head SHA, using published GitHub check runs and legacy commit status signals.
- **GMED:** Requires at least one successful check/status, no failed/pending/unknown signals, and complete observed API pagination.
- **Evidence:** Displays each observed signal, merge SHA, observation time and a downloadable JSON receipt.
- **Accessible web app:** Public owner/repo + PR number, or a full PR URL. No GitHub token, login, or proxy.
- **Honest demo:** Offline example is explicitly marked synthetic, never certified as a real repository.
- **Headless CLI:** Same verification logic with explicit exit codes for other Phi369 tools.

## Run locally

Node.js 22+ is used for tests and the optional CLI. No npm dependencies are needed.

    npm test
    npm run check
    node scripts/gmed.mjs MichaelWave369/Altermath 22
    python -m http.server 8080

Then open http://localhost:8080/ in your browser.

CLI exit codes: **0** means GMED verified from an actual complete API inspection; **1** means a request or validation error, including API rate limits or incomplete data; **2** means GitHub was inspected successfully but the evidence did not qualify. JSON is emitted only for successful complete inspections. Errors go to stderr and never create a success receipt.

## Policy

| Outcome | Meaning |
|---|---|
| GMED | Merged and observed checks/statuses have completed with no failure, with at least one actual success |
| NOT_MERGED | GitHub has not confirmed the PR was merged |
| FAILED | At least one observed check/status for the merge commit failed or was cancelled |
| PENDING | At least one observed check/status has not finished |
| UNVERIFIED | Missing usable merge SHA, zero successful evidence, unknown result, or incomplete listing |

Rung 1 uses GitHub's public REST API endpoints to read the PR, the check runs on its merge SHA, and legacy combined status data on the same SHA. It will not stamp an empty check list as success. It limits paginated API retrieval to five pages and refuses verification on truncated evidence. Neutral/skipped checks don't block success if *another* actual success exists, but they are not themselves proof of a passing test.

GMED captures the API snapshot; it does not independently execute tests, assess security, or validate production runtime behavior. It does not know which checks the repository *requires* through branch-protection rules. This is a best-effort public signal inspector, not a formal release attestation.

## Files

| Path | Responsibility |
|---|---|
| src/verifier.js | Pure classification logic, target parsing and fail-closed rules |
| src/github.js | Anonymous HTTPS GitHub REST requests, bounded pagination and errors |
| index.html, styles.css, app.js, favicon.svg | Responsive static dashboard |
| scripts/gmed.mjs | CLI with JSON receipts and meaningful exit codes |
| tests/*.test.mjs | Deterministic regression checks with fake HTTP responses |
| .github/workflows/ci.yml | PR and main verification suite |
| .github/workflows/pages.yml | Test, stage and deploy GitHub Pages on main |

## Enable Pages

On GitHub, choose **Settings → Pages → Build and deployment → GitHub Actions**. After merging the release PR and a successful Pages workflow, visit https://michaelwave369.github.io/GMED/.

Rung 1 is public-repository only. It does not read private code, store credentials, modify other repos, automatically merge PRs, or run background monitoring. Public GitHub anonymous rate limits apply. Other GitHub scripts, integrations, or workflows are future projects with separate verification gates.

## Roadmap

- **R2 Fleet:** Manually selected public project watchboard with explicit refresh, budgets and live status.
- **R3 Provenance:** Source-backed signed evidence bundles and an optional PhiTriBrain369 import contract.
- **R4 Policy:** Compare observed checks against authorized branch-protection / required-check metadata.
- **R5 Phi ecosystem:** Read-only evidence cards for PhiMadaPrime, Altermath, PhiOS, and other projects.

## License

MIT, see LICENSE.

**GMED // Gerged. Mreened. Evidence Documented.** BUAHAHAHA.
