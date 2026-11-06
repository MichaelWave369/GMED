# STARTRACE-5 Rung 8 — Cross-language SciPy DOP853 solver audit

**Verdict: \`CROSS_LANGUAGE_NUMERICAL_AGREEMENT_ONLY\`.**

Rung 8 checks STARTRACE's hypothetical comet propagation using a separately maintained numerical integrator, **SciPy's DOP853 eighth-order adaptive Runge–Kutta algorithm** (\`scipy==1.18.1\`, Python 3.12), against the existing JavaScript Dormand–Prince 5(4) trajectory.

## Source provenance and physics boundary

The matched initial state is taken from the published *hypothetical* June 8, 5 BCE Matney parabolic candidate, not a measured comet orbit. Earth (399) and Moon (301) are prescribed Sun-centered J2000 ecliptic vectors in AU/day from NASA/JPL Horizons-derived **normalized text extracts** (source-reported DE441), not byte-identical signed source files.

Both programs implement the **same** restricted heliocentric Sun/Earth/Moon force equations, including the indirect accelerations of the heliocentric origin. The Python program independently calculates cubic Hermite interpolation of Earth and Moon position vectors, and computes solar/planetary Newtonian acceleration, feeding these derivatives into SciPy DOP853. The JavaScript program independently uses the project's RK45 integration and source interpolation. This is independent code and numerical algorithm validation, **not independent observational or physical-model verification**.

SciPy source/reference:
- https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.DOP853.html
- https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve_ivp.html
- https://pypi.org/project/scipy/

The output vector frame is the heliocentric **J2000 ecliptic**, measured in AU and AU/day. Both implementations use the same ~5 BCE numerical Julian dates. The Python integration variable uses elapsed days from the initial anchor, reducing floating point cancellation while evaluating source vectors at the given JD.

### Reproducible pipeline

~~~bash
python -m pip install -r requirements-r8.txt
node scripts/startrace-r8-export.mjs > /tmp/startrace-r8-case.json
python scripts/startrace-r8-scipy.py /tmp/startrace-r8-case.json /tmp/startrace-r8-scipy.json
node scripts/startrace-r8-verify.mjs /tmp/startrace-r8-case.json /tmp/startrace-r8-scipy.json > /tmp/startrace-r8-public.json
npm run check
~~~

The input includes the exact initial state, Earth/Moon vectors, source file SHA-256 fingerprints, 29 epochs, specified gravitational parameters, two minimum distance guardrails and conservative false scientific-certification flags. Python rejects inconsistent units/constants, invalid source coverage, malformed arrays and excluded proximity. The verifier refuses mismatched source hashes, solver identity/version, epochs, non-finite/negative values, missing outputs, contradictory statistics, unsafe distances or unsupported certification claims.

The publication gate currently requires maximum numerical **3D position disagreement ≤5 km** and velocity disagreement ≤0.001 km/s. These are computational sanity limits, **not** uncertainty in a real comet or the JPL ephemeris. The actual measured differences come from the generated report, not from the threshold.

GitHub Pages only stages \`data/solver-r8-report.json\` if the complete Python→Node verification pipeline succeeds. The \`reference.html\` dashboard displays that receipt, and does not run Python or invent data in the browser.

### What it does not show

- **No historical orbit fit.** A published candidate is not a measured comet track, and the alleged historical comet has no uniquely determined orbit.
- **No independent physical force-model validation.** Both codes implement the same restricted dynamics. Other planets, non-gravitational comet forces and relativity remain unmodeled.
- **No verified source authentication.** Provider-declared DE441 Horizons state vectors have been normalized through a third-party text extraction layer, so local SHA-256s identify stored bytes, not NASA origin.
- **No full ancient timescale treatment.** TT/TDB approximation and uncertain historical ΔT remain.
- **No exact encounter or visibility claim.** Close-approach exclusions are computational safeguards, not exact event location or collision detection; brightness/atmosphere are absent.

**Next:** compare independently specified forces and frames using a separately maintained astrodynamics implementation, then attempt a clearly uncertainty-bounded, gravity-aware orbit fit against attributed historical evidence, if those sources can constrain one.
