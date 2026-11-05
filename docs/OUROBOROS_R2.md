# Rung 2 · Ouroboros Protocol

**Gerged and Mreened, without the infinite self-approval loop.**

## Question

If GMED calls its own PR green, what evidence would let a separate verifier agree, disagree, or refuse a circular claim?

## Implemented

- `src/ouroboros.js` has its **own classifier and GitHub REST reader**, and imports **nothing** from the R1 classifier or GitHub client.
- An operator first runs R1 `inspect()`, which records merged state, merge SHA, checked signals, result and counts.
- A second operator action runs `independentAudit(primaryReceipt)`: it directly fetches the GitHub PR again, then independently fetches check runs and legacy statuses on the merge SHA. The auditor recomputes the outcome from raw signals.
- The auditor rejects disagreement over target identity, merge state, merge SHA, PR number, individual signal multiset, report counts, or expected outcome.
- The detector checks a **declared dependency DAG**, rejecting direct self-attestation, missing roots and dependency cycles before making an independent network request.
- The browser displays separate observations and exports a **dual-receipt JSON packet**. There is no private key, credential, remote execution, or background polling.
- `scripts/ouroboros.mjs` provides an explicit two-read CLI with machine-readable outcome and exit codes.

## Verification contract

| R2 state | Meaning |
|---|---|
| DUAL_MATCH | Two independent implementations and public GitHub reads agree on `GMED`. |
| AGREED_NOT_GREEN | Both implementations agree on a non-GMED outcome. |
| MISMATCH | Fields or signals disagree. No green stamp is awarded. |
| CYCLIC_TRUST | A declared dependency loop or invalid trust graph blocks certification. |

Network errors, bad data and truncated pagination throw and **withhold the result**, rather than returning a false green.

### Graph model

Default declared trust dependencies:

    github-public-api: source []
    gmed-primary: verifier [github-public-api]
    ouroboros-auditor: verifier [github-public-api, gmed-primary]

The auditor examines the primary receipt *and* obtains a fresh public GitHub observation. A demo adds `ouroboros-auditor` to `gmed-primary`'s dependencies, forming a cycle and blocking a green result. The demo is synthetic and does not affect any real repository.

## Run

Requirements: Node.js 22+, public internet for live checks. No additional npm packages.

    npm run check
    npm run ouroboros -- MichaelWave369/GMED 1
    node --test tests/ouroboros.test.mjs

The CLI runs one primary inspection and then one independently implemented re-observation. It returns a JSON packet with both observations and a high-level verdict. Exit **0** means `DUAL_MATCH` for a genuine observed green result; exit **2** means either disagreement or agreement that the PR is not green; exit **1** means invalid input, GitHub access failure, or incomplete evidence. No automatic merge or GitHub writes occur.

In the web dashboard, inspect a public PR with the original form. Once its result is displayed, choose **RUN OUROBOROS / SECOND OPINION**. For the loop detector only, use the separate **synthetic trust loop** challenge.

## Adversarial controls

R2 tests verify that modified verdicts, forged SHA fields, corrupted counts, failing checks, pending/unknown states, mid-inspection drift, HTTP errors, truncated pagination, direct self-dependency, missing roots, and transitive cycles cannot earn `DUAL_MATCH`.

## What independent actually means here

**Independent implementation + second request**, not independent trusted authority. Both inspectors are authored in the **same repository**, run in the same browser or Node runtime, and depend on **the same GitHub API and network/TLS environment**. A compromised application, API, browser, CI runner, or shared code delivery could deceive both. The graph is declared by this code and is not remotely attested. Neither receipt is signed, nor are API answers independently notarized. A matching result is *consistent evidence*, not proof of correctness, identity, or independence from the publisher.

Live API evidence can also drift between calls. R2 treats such changes as a mismatch rather than blaming or trusting either observer. Its GitHub query budget doubles the original inspector's and public API rate limits still apply.

Next: frozen offline receipt auditing in a separately maintained distribution, cryptographically signed/provenance-bound releases, independently pinned software versions and independent execution infrastructure. These would be additional research rungs, not capabilities demonstrated by R2.

**Ledger Above Ego. No circular green stamps.**
