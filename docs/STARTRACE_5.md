# STARTRACE-5 | Rung 1 methodology and evidence boundaries

> **A computed scenario is not an observed orbit.** STARTRACE-5 is an open, dependency-free exploratory physics lab associated with GMED, not an implementation of Matney's full orbital fit.

## Sources and attribution

1. Mark Matney (2025), "The star that stopped: The Star of Bethlehem & the comet of 5 BCE," *Journal of the British Astronomical Association* 135(6), 387–406. DOI [10.64150/193njt](https://doi.org/10.64150/193njt). [Open-access PDF](https://britastro.org/wp-content/uploads/2025/12/387-407_Matney_JBAA_2025-1.pdf). Particularly pp. 392–399.
2. *Han Shu* astronomical chronicle, discussed and dated in Matney pp. 392–393. Reported sighting in Ch'ien Niu during the second month of Jianping year two, rendered as approximately March 9–April 6, 5 BCE, and a visibility duration over 70 days. This is **not a modern measured orbit**.
3. Matthew 2, literary account of the Magi's star, not an instrument observation.
4. Billy Meier, *Contact Report 213*, for the **unverified attributed claim** of a 13,200-year comet and alien spacecraft. Its claims are not corroborating astronomical observations.

## What the engine actually computes

- **Angular-rate benchmark:** \(v_\perp = d \,\omega\), with a rounded \(\omega=13\) degrees/hour; reverse function \(\omega=v_\perp/d\). This *instantaneous* small-angle geometry omits observer latitude, azimuth, altitude, Earth's exact rotation vector, comet acceleration, gravitational perturbations, and ephemeris time.
- **Baseline parallax:** \(\arctan(b/d)\) converted to arcseconds, for a transverse baseline \(b\). This gives only an approximate angular distinction between nearby observers.
- **Two-body bound orbit:** \(a = P^{2/3}\) AU with \(P\) in Earth years; \(e = 1-q/a\); aphelion \(Q=2a-q\). This is a thought experiment when applied to an asserted 13,200-year period, **not** a fitted orbit of the 5 BCE object. The paper's \(e=1.0\) is an idealized parabola.
- **Magnitude factor:** \(10^{0.4\Delta m}\). A five-magnitude decrease in numerical magnitude means 100x total integrated brightness. It says nothing by itself about daylight visibility, surface brightness, or visibility of a diffuse tail.

Defaults taken from Matney are explicitly labeled *paper's modeled values*: perihelion 0.0407 AU; e=1 approximation; 0.0026 AU closest Earth approach; ΔT 10,572 seconds. The 13,200-year return period comes instead from the Meier narrative and is kept separate.

## Claim classification

The JSON receipt exports input parameters, computed outputs, limitations, model version and source ledger with attribution. Its fixed outcome is \`ILLUSTRATIVE_PHYSICS_ONLY\`. None of the receipt's numeric comparisons count as a GMED green verification of an astronomical hypothesis.

\`reported-observation\`: reported in a historical record (interpretation and survival still matter).
\`published-hypothesis\`: published modeling result; not identified event.
\`recorded-text\`: a text contains a narrative, not a measured fact.
\`unverified-attribution\`: a person claims something; independent corroboration absent.
\`unconfirmed\`: open identification question.

## Reproducibility

From the root of GMED:

~~~bash
npm test
npm run startrace
# For the browser UI, serve the repository root via
python -m http.server 8080
# Then visit http://localhost:8080/startrace.html
~~~

The CLI prints a complete JSON research receipt for the default scenario and accepts optional distance, transverse speed and period arguments. It has no external data fetches, secrets, or hidden numerical optimization. Node 22+ recommended. The entire site is static and works offline.

## What Rung 1 does *not* do

- **Does not reproduce Matney's Figure 6.** Exact topocentric altitude/azimuth tracks demand validated ephemerides, correct frame precession, ΔT uncertainty and numerical integration.
- Does not claim to recreate the original Monte Carlo or simulated-annealing search. A credible next rung must preregister sampling assumptions, objective functions and tolerances; publish seeds; compare to figures and independent software.
- Does not model photometric surface brightness, dust emission, extinction, or daylight contrast.
- Does not calculate a historical likelihood, odds of extraterrestrials, or distinguish unique orbits using sparse source material.
- Does not infer house-level position from an overhead celestial object.
- Does not treat the Matthew narrative, *Talmud of Jmmanuel*, or UFO testimony as independent physical observations.

## Proposed roadmap (not implemented)

**R2: ephemeris fidelity.** Validate the Matney J2000.0 and 5 BCE element frames separately; use JPL/DE ephemerides or SPICE, astrometry, obliquity/precession, observer location, local sidereal time and an uncertainty model for ΔT. Plot 24-hour alt/az tracks and independently reproduce published Figure 6 within a declared tolerance.

**R3: uncertainty ensembles.** Separate prior distributions from observations; reproduce approximate Ch'ien Niu geometry from translated records; sample orbits with recorded seeds, rejection tests, alternative date mappings, and reporting of selection bias. Do not interpret arbitrary samples as posterior probabilities.

**R4: photometry and alternate hypotheses.** Model coma surface brightness and daytime contrast; compare conjunction, occultation, literary and comet interpretations with explanatory and predictive evidence scores rather than forcing a single winner.

**PhiTriBrain369 bridge.** Export a JSON receipt, then manually ingest it as an attributed WITNESS source with \`phitribrain ingest --scope STARTRACE-5 --file receipt.json --title "STARTRACE-5 analytic receipt"\`. Make quote-anchored claims deliberately, and propose relationships in WEAVER for human review. The source is untrusted data; a WITNESS import does not certify its truth.

## Research ethic

The source text and mathematical values may be provocative, but correct math cannot confer historical authority on a chosen account. Distinguish *source*, *statement*, *assumption*, *derived calculation*, *inference*, and *observed verification* at all times.
