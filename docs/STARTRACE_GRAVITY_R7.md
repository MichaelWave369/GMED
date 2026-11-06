# STARTRACE-5 Rung 7 — Numerical comet solver stress test

**Status: conditional numerical validation only. No comet orbit identified.**

Rung 7 adds a second integration algorithm to the R4 numerical comet model, exposing convergence, failure states, and sampled-distance safeguards. The goal is to audit the *numerics* of a **hypothetical** June 8, 5 BCE candidate close approach, not to infer whether that comet existed or passed Bethlehem.

## Sources and model

- Matney (2025), JBAA candidate orbital elements: https://britastro.org/wp-content/uploads/2025/12/387-407_Matney_JBAA_2025-1.pdf.
- NASA JPL Horizons, official vector specification: https://ssd-api.jpl.nasa.gov/doc/horizons.html.
- NASA JPL Horizons, epistemic limitations: https://ssd.jpl.nasa.gov/horizons/manual.html.
- Dormand & Prince (1980) embedded Runge–Kutta 5(4) as documented by SciPy: https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.RK45.html.
- Earth (399) and Moon (301) **provider-declared DE441**, Sun-centered J2000 ecliptic AU/day three-hour sample tables: \`data/horizons-5bce/manifest.json\`. The stored files are **normalized source-derived numeric extracts**, not digitally signed NASA raw responses.
- The fourth-order RK4 and parabolic elements from R3/R4 remain unchanged. The R7 solver does not fit a new comet orbit.

## Numerical methods and reproducibility

1. The hypothesis-dependent initial state uses the published parabolic candidate at a chosen integration anchor, including centered finite-difference analytic velocity. This is *not a measured comet state*. R7 currently supports **June 8** only because the committed ephemeris snapshot does not cover all other candidate dates.
2. All numerical methods integrate the same restricted **Sun + separately prescribed Earth/Moon** Newtonian differential equation with the appropriate indirect acceleration of the heliocentric frame origin. Sun and Earth/Moon ephemerides are not dynamically co-integrated with the comet.
3. The existing R4 fixed-step RK4 solver provides a legacy baseline.
4. A second fixed-step RK4 implementation exercises an independent code path and a half-step convergence check.
5. An adaptive **Dormand–Prince 5(4)** solver estimates local truncation error from the embedded 5th- and 4th-order states, rejects steps with weighted error norm over 1, and adjusts the step by an exponent of -1/5. It lands exactly at the same discrete output epochs as R4.
6. Position differences between RK4 and RK45 are reported in kilometers at each sample. These are **numerical cross-checks**, not positional uncertainty intervals.
7. The independent Sun-only analytic parabolic trajectory supplies a separate limiting-case test. In the strictly Sun-only force model, energy and angular momentum should be approximately conserved; the analytic orbit should agree with numerical propagation within solver limitations.
8. The integrator refuses to continue on non-finite states, invalid tolerances, incompatible sample intervals, step budget exhaustion, step-size floor violations, and excluded comet–Earth (15,000 km) or comet–Moon (7,000 km) stage distances. These thresholds are *numerical guardrails*, not an impact or collision prediction.

### Why RK45 and RK4 are not an external physical reference

They are **different numerical methods**, but they still share the same restricted equations, input ephemerides, hypothetical initial orbital elements, and approximate TT/TDB conversion. If both methods reproduce a wrong physical model consistently, they can agree perfectly while the historical scenario remains wrong. This lab does **not** claim an independent gravitational trajectory from a separate astronomical software package.

The minimum Earth/Moon distances are reported as **sampled minima** and as minimum distances evaluated at integrator derivative stages. Neither is an optimized or guaranteed continuous closest-approach distance. Adaptive local error control also does not prove a bound on total/global position error.

## Reproduce on a local checkout

~~~bash
npm run check
npm run gravity-audit
npm run gravity-audit -- --zero-gravity
npm run gravity-audit -- --full
python -m http.server 8080
# http://localhost:8080/stress.html
~~~

The CLI prints a JSON numerical receipt containing the source-normalized SHA-256 fingerprints, exact scenario options, max trajectory differences, RK45 step acceptance/rejection diagnostics, and explicit false flags for historical identification and independent physical verification.

Rung 7 does **not** amend the ephemeris interpolation results in R6 or claim the R5/R6 normalized source vectors are cryptographically authenticated raw NASA bytes.

## Scientific interpretation

- Numerical agreement can give confidence that **under the encoded force model** the numerical integration is stable for that chosen scenario.
- A disagreement can identify step-size or event-resolution problems deserving further investigation.
- The model still omits other planets, relativity, comet activity/outgassing, a coupled N-body ephemeris, and a gravity-aware orbit fit.
- It also omits a rigorous topocentric ancient viewing geometry, historical brightness model, and independent verification of Matney's sky-plot geometry.
- DE441 is a model, not a direct historical observational measurement. A 5 BCE DE441 state is not exact knowledge of the past sky.

## The next meaningful scientific gate

Use independently implemented high-precision orbital propagation (for example, a separately maintained astrodynamics solver with force and time-frame auditing), compare output at the same JD epochs, and perform a gravity-aware candidate-orbit *re-fit* against defensibly attributed historical data. Until then, \`NUMERICAL_METHOD_CROSSCHECK_ONLY\` is the highest permissible verdict.
