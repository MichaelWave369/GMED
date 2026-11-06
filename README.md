# GMED — The Gerged & Mreened Evidence Department

> **Merged is a claim. Green is evidence.**
> People Above Profit · Ledger Above Ego · Laughter Before Hatred.

GMED started as the gloriously mangled release cry **“Gerged and Mreened”**. The joke now has a job: a local-first, MIT-licensed, read-only GitHub pull-request evidence checker.

Repository: https://github.com/MichaelWave369/GMED

GitHub Pages target: https://michaelwave369.github.io/GMED/ (published only after Pages is configured and the deployment succeeds).

## STARTRACE-5: historical sky evidence laboratory (Rung 1)

The [STARTRACE-5 interactive lab](startrace.html) uses transparent orbital/observation geometry to explore a proposed 5 BCE comet scenario without claiming a historical identification. It exposes claim provenance, a speed-versus-distance chart, Kepler period sensitivity, parallax estimates and integrated-brightness factors. It exports conservative JSON research receipts and runs deterministic regression tests. Matney's full ephemeris, simulations and historical likelihood inference are **not implemented**. [Methods and limitations](docs/STARTRACE_5.md).

CLI: `npm run startrace -- 0.0026 24.5 13200`. After a successful Pages deployment: [Launch STARTRACE-5](https://michaelwave369.github.io/GMED/startrace.html).

## STARTRACE-5 Rung 2: candidate ancient sky visualization

The [Ancient Sky Lab](skytrace.html) adds an interactive 3D heliocentric candidate orbit view and a topocentric Bethlehem sky dome with model-local solar time, playback, all 11 published Matney candidate curves, a ΔT sensitivity control, and conservative JSON export. Its Earth position comes from the NASA/JPL **approximate Earth-Moon barycenter** model for 3000 BCE–3000 CE. The comet uses Matney's published **candidate** parabolic orbital elements; no historical comet was independently tracked. This does **not** reproduce a rigorous ancient DE ephemeris, independently establish Figure 6 fidelity, or model actual daylight visibility. [R2 methodology](docs/STARTRACE_SKY_R2.md).

After Pages deployment: [Explore Ancient Sky Rung 2](https://michaelwave369.github.io/GMED/skytrace.html).

## STARTRACE-5 Rung 3: gravitational flyby sensitivity

The [Gravity Encounter Laboratory](flyby.html) compares an ideal Sun-only comet parabola against a **restricted numerical Earth–Moon-system point-mass perturbation** of Matney's hypothetical candidate orbits. Both integrations start at the same user-selected anchor state, and the page plots three-dimensional position deviation, geocentric angular divergence and a half-step RK4 convergence diagnostic. The Earth–Moon barycenter is **approximate**, not a high-precision geocenter; this is a model-sensitivity demonstration, **not** a recovered ancient comet orbit or a validated ephemeris. [R3 methods and limits](docs/STARTRACE_FLYBY_R3.md).

After Pages deployment: [Open the Gravity Encounter Laboratory](https://michaelwave369.github.io/GMED/flyby.html).

## STARTRACE-5 Rung 4: Horizons source-vector intake and two-perturber comparison

The [Horizons Ephemeris Intake Lab](precision.html) generates JPL Horizons API query links for Earth (399) and Moon (301) relative to the Sun (10), then validates downloaded vector tables locally for matching J2000 ecliptic coordinates, AU/day, TDB time, geometric correction state, and full interval coverage. With **both user-provided** tables, it interpolates the separate Earth and Moon trajectories and compares restricted Newtonian comet integration against R3's approximate Earth–Moon barycenter. There is **no bundled authentic ancient vector dataset** and no autonomous network retrieval. The data origin remains **unverified** even if its text headers pass. [R4 methodology and limitations](docs/STARTRACE_EPHEMERIS_R4.md).

After Pages deployment: [Open Horizons source-vector lab](https://michaelwave369.github.io/GMED/precision.html).

## Rung 2: The Ouroboros Protocol

**Who verifies the verifier?** A fresh, independently implemented public GitHub API inspector now rereads the target PR and its merged-commit checks, independently recomputes the verdict, and compares both receipts. A declared trust-graph detector rejects circular self-attestation. The browser has an **Ouroboros / Second Opinion** button and a separate **synthetic loop challenge**.

Result states: `DUAL_MATCH`, `AGREED_NOT_GREEN`, `MISMATCH`, and `CYCLIC_TRUST`. Only `DUAL_MATCH` qualifies as agreement on a GMED-green result. API errors or incomplete data withhold the result. Both inspectors share the same repository and GitHub provider; this is **not independent organizational/cryptographic verification**.

Run `npm run ouroboros -- MichaelWave369/GMED 1` or inspect a public PR on the site and select **Run Ouroboros**. Full methods and limitations: [Ouroboros R2 protocol](docs/OUROBOROS_R2.md). The site's intended R2 section is [#ouroboros](https://michaelwave369.github.io/GMED/#ouroboros), after a successful merge/deployment.

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
| src/ouroboros.js | Independent GitHub re-observation, decision reconstruction and cycle detector |
| index.html, styles.css, app.js, favicon.svg | Responsive static dashboard |
| scripts/gmed.mjs | CLI with JSON receipts and meaningful exit codes |
| scripts/ouroboros.mjs | Two-observation CLI with separate results and a refusal-aware exit code |
| tests/*.test.mjs | Deterministic regression checks with fake HTTP responses |
| .github/workflows/ci.yml | PR and main verification suite |
| .github/workflows/pages.yml | Test, stage and deploy GitHub Pages on main |

## Enable Pages

On GitHub, choose **Settings → Pages → Build and deployment → GitHub Actions**. After merging the release PR and a successful Pages workflow, visit https://michaelwave369.github.io/GMED/.

Rung 1 is public-repository only. It does not read private code, store credentials, modify other repos, automatically merge PRs, or run background monitoring. Public GitHub anonymous rate limits apply. Other GitHub scripts, integrations, or workflows are future projects with separate verification gates.

## Roadmap

- **R2 Ouroboros (implemented):** Second public GitHub observation, independent classifier, receipt comparison, acyclic declared trust graph and simulated loop challenge.
- **R3 Fleet (planned):** Manually selected public project watchboard with explicit refresh, budgets and live status.
- **R4 Provenance:** Source-backed signed evidence bundles and an optional PhiTriBrain369 import contract.
- **R5 Policy:** Compare observed checks against authorized branch-protection / required-check metadata.
- **R6 Phi ecosystem:** Read-only evidence cards for PhiMadaPrime, Altermath, PhiOS, and other projects.

## License

MIT, see LICENSE.

**GMED // Gerged. Mreened. Evidence Documented.** BUAHAHAHA.
