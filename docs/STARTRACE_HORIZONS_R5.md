# STARTRACE-5 Rung 5 — A real Horizons-derived Earth/Moon dataset

## What changed

On November 6, 2026 we requested **two matched public NASA/JPL Horizons VECTORS tables** directly from the official \`ssd.jpl.nasa.gov\` HTTPS endpoint. The source response reported the **DE441** model for the Sun-centered Earth (399) and Moon (301) body states, within the J2000 ecliptic frame, AU/day, and TDB Julian dates.

The API result was retrieved through a **third-party web extraction layer**, not as a byte-for-byte saved original from Horizons. For transparent reproducibility, R5 stores the exact numeric CSV rows exposed by that extraction and reconstructs a minimal metadata header. Therefore these files are accurately described as **NASA-derived normalized extracts**.

**Do not describe them as independently authenticated NASA raw files, Horizons-signed data, or a validated historical-comet orbit.** The original query URLs and their parameters appear in the [manifest](../data/horizons-5bce/manifest.json). Rerun them to independently compare output.

## Source snapshot

- Directory: \`data/horizons-5bce/\`
- Earth table: \`earth-399-extract.txt\`
- Moon table: \`moon-301-extract.txt\`
- Retrieval: **2026-11-06**, original provider NASA/JPL Horizons API
- Source-declared planetary model: **DE441**
- Coordinate center: **Sun (10)**; targets **Earth (399)** and **Moon (301)**
- Frame: **J2000 ecliptic**, via \`REF_PLANE=ECLIPTIC\`, \`REF_SYSTEM=ICRF\`
- Coordinates: geometric \`VEC_CORR=NONE\`; positions AU; velocities AU/day
- Time scale: **TDB** (not ancient UT/UTC)
- Sampling: 26 epochs, every 3 hours, \`JD 1719753.520000000\` through \`JD 1719756.645000000\`
- Calendar text: **B.C. 0005-Jun-06 through 0005-Jun-09**, in Horizons *mixed* calendar mode, which uses a proleptic Julian calendar for antiquity. Be careful not to silently convert these display dates into Gregorian dates.
- Source-derived Earth–Moon distances for this interval: approximately **404,839–406,357 km**. This check is about their mutual separation, not any historical comet's range.

The snapshot covers the *featured June 8 candidate*, with a two-day lead-in integration. It **does not** cover all eleven alternative candidate dates or every possible R3 anchor.

## Run the numerical experiment

~~~bash
npm run check
npm run horizons-audit
python -m http.server 8080
# open http://localhost:8080/precision.html
# select "LOAD SOURCE-DERIVED JUNE 8 SNAPSHOT"
~~~

The web app loads the two static source-derived files from the **same origin** as the Pages site. No authentication or cloud service is needed and none of the browser's input files are uploaded. The user can still load separate, freshly downloaded full Horizons responses and test other candidate dates.

\`npm run horizons-audit\` reads the files, rejects incompatible headers/rows, matches epochs, checks Earth–Moon separation, and runs the R4 **separate-Earth-and-Moon restricted gravity experiment**. It outputs a machine-readable JSON receipt including SHA-256 hashes of the **normalized extract files**, original request URLs, comparison metrics and explicit false scientific-verification flags.

The audit being GMED-green establishes that *this specific code and its tests passed*, not that the ancient comet's orbit was recovered or that a text snapshot has a cryptographically verified source identity.

## Science and source integrity boundaries

1. **Original source uncertainty:** The raw NASA responses were extracted through another tool; we retained numeric rows and critical headers. The saved bytes differ from the original complete response. SHA-256 protects reproducibility of what *we saved*, not origin authentication.
2. **Planetary data are still model-generated.** DE441 itself is a dynamical ephemeris informed by historical/modern observations, not ancient direct GPS readings. The date is deep antiquity and errors must be quantified for precision claims.
3. **Comet trajectory remains hypothetical.** Matney's selected candidate is one plausible geometric solution, not a measured orbit. Incorporating Earth/Moon positions cannot prove the object approached Earth.
4. **Independent reproduction is still missing.** The R3/R4 integrator uses a Sun-only parabolic initial comet state and restricted gravity; no gravity-aware refit or independently validated Figure 6 reproduction has been demonstrated.
5. **Timescale distinctions remain.** The code uses R2's assumed ΔT to map approximate UT to ephemeris time and then consumes TDB data as if TT and TDB were interchangeable at this sensitivity level; an actual precision validation needs a rigorous timing model.
6. **Interpolation:** Three-hourly Horizons samples are interpolated with cubic Hermite; validate against withheld more-frequent JPL vectors (e.g. 30-minute or hourly) to measure error at the flyby.
7. **Physical completeness:** The Sun+Earth+Moon gravity model omits other planets, comet outgassing, relativistic corrections and a fully coupled numerical ephemeris.
8. **Visibility:** Geometric position is not a prediction of naked-eye daytime comet brightness. That requires dust, coma, atmosphere and observer constraints.

## Next reproducible gate

**Rung 6:** Acquire an *independently fetched* high-cadence (e.g. 30-minute) Horizons source bundle with byte-level provenance, then use those withheld epochs as ground truth for three-hour Hermite interpolation residuals, while keeping historical orbit identification explicitly unverified.

Official reference: https://ssd-api.jpl.nasa.gov/doc/horizons.html

Research hypothesis source: Mark Matney (2025), JBAA 135(6), 387–406; DOI 10.64150/193njt.
