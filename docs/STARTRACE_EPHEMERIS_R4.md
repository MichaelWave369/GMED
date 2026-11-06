# STARTRACE-5 Rung 4 — Source-backed Earth/Moon vector intake

> **A safe import pipeline is not a validated ephemeris.** Rung 4 accepts *user-provided* JPL Horizons plain-text VECTORS outputs, checks critical format declarations, and compares a separate-Earth-and-Moon perturbation calculation with the R3 combined approximate barycenter model. No 5 BCE Horizons dataset is bundled in this PR, and no file is claimed to have been authenticated or downloaded by the project.

## Official source and reproducible request

NASA/JPL Horizons API: https://ssd-api.jpl.nasa.gov/doc/horizons.html

Use the two dynamically generated official request URLs on \`precision.html\`. The following configuration is constructed for each user-selected interval:

~~~text
format=text
COMMAND='399'  (Earth) or '301'  (Moon)
OBJ_DATA='NO'
MAKE_EPHEM='YES'
EPHEM_TYPE='VECTORS'
CENTER='500@10'          # Solar-center origin
START_TIME='JD ...'      # TDB Julian date covering integration lead + display interval
STOP_TIME='JD ...'
STEP_SIZE='3 h'
TIME_TYPE='TDB'          # NOT UT
REF_PLANE='ECLIPTIC'    # J2000 ecliptic, NOT equatorial ICRF plane
REF_SYSTEM='ICRF'
OUT_UNITS='AU-D'         # position AU, velocity AU/day
VEC_CORR='NONE'          # geometric simultaneous states, no light-time correction
VEC_TABLE='2'           # X,Y,Z,VX,VY,VZ
VEC_LABELS='NO'
CSV_FORMAT='YES'
CAL_FORMAT='BOTH'
~~~

The user opens each NASA query and saves its plain-text result. Importing the two text files happens **in the browser only**. No proxy or remote upload is used. The file's raw SHA-256 is recorded in the exported research receipt when browser SubtleCrypto is available.

## Fail-closed metadata gate

\`src/startrace-horizons.js\` refuses data unless the headers declare:

- Target **Earth (399)** and **Moon (301)** separately, Sun-centered **Sun (10)**.
- **Ecliptic of J2000.0** reference frame, not \`REF_PLANE=FRAME\` (ICRF equatorial).
- **AU-D** units, geometric vectors rather than light-time-corrected output.
- **TDB** epoch declarations, not ancient UT or TT.
- CSV rows containing Julian date, date text, full XYZ and VXYZ.
- Strictly increasing Julian dates around 5 BCE and no sampling gaps above 6.24 hours.
- An integration span *fully covered by both files*, with a small margin.
- Plausible heliocentric Earth/Moon radius and speed; Earth–Moon separation checked at multiple times.

The parser does **not** authenticate a NASA signature or the stated \`DE441\` model. A forged file with plausible headers could pass. Header checks prevent accidental frame mixing, not adversarial file creation. The project never uses a fake result in the real browser data lane.

## Interpolation and gravity

Each source table is interpolated using **cubic Hermite interpolation** between position and velocity samples, yielding 3D Sun-relative XYZ positions and AU/day velocities at requested ephemeris time (TDB).

The R4 restricted Sun + Earth + Moon comet model integrates a *hypothetical* Matney parabolic initial state with numerical RK4. It uses the separate Earth and Moon vectors in the direct gravitational terms **and corresponding indirect heliocentric-origin acceleration**:

\[
\mathbf{a}=-\mu_\odot\,\mathbf r/r^3
+\sum_{i\in\{E,M\}} k\mu_i
\left(\frac{\mathbf{R}_i-\mathbf{r}}{|\mathbf{R}_i-\mathbf r|^3}
-\frac{\mathbf{R}_i}{|\mathbf R_i|^3}\right)
\]

where \(k\) is the legacy R3 mass sensitivity multiplier (default 1). Sun/Moon/Earth states are prescribed, not dynamically integrated together. Close-approach cutoffs reject nonsensical point-mass collisions.

The same user-selected initial hypothetical comet state and anchor are used to compare against R3's approximate single-barycenter model. The displayed difference is therefore sensitive to **both** changed Earth/Moon inputs **and** separate lunar gravity, not exclusively a measure of orbital truth.

## Reproducibility and limits

~~~bash
npm run check
node --test tests/startrace-horizons.test.mjs tests/startrace-precision.test.mjs
python -m http.server 8080
# http://localhost:8080/precision.html
~~~

Tests use **explicitly synthetic Horizons-shaped fixtures** solely to test metadata rejection, units, time scales, cubic Hermite interpolation, paired coverage, gravity integration and receipt flags. The fixtures are not published as historical NASA positions.

Crucial scientific limits:

1. No downloaded or independently authenticated Horizons vector table is bundled in this rung.
2. A plausible but forged input may pass all string and numeric sanity tests; a digest only proves byte equality, not origin.
3. Earth/Moon vector tables may have errors or interpolation bias; close encounters need convergence tests against higher-rate ephemerides.
4. A TDB ephemeris is not the same as the previous R2/R3 approximate TT time; the TT–TDB difference is small but **not identically zero**. It is neglected in this sensitivity experiment, and not a certified precision conversion.
5. The comet's hypothetical initial orbit is not gravity-aware fitted to actual observations and could change substantially if refitted.
6. Numerical step convergence is not proof of historical event accuracy or naked-eye brightness.
7. Full N-body dynamics (other planets), source-signature provenance, historical time precision, and post-fit observation residuals remain unvalidated.

**Outcome contract:** \`CONDITIONAL_IMPORTED_VECTOR_EXPERIMENT\`; explicit false flags for historical comet identification, cryptographic Horizons authenticity, full precision reconstruction and independent verification.

The next scientific rung is to retrieve **public, independently reproducible, authoritative DE441 Earth and Moon vector bundles**, verify their origin, quantify interpolation residuals against withheld samples, and update the comet's fitted initial state under gravity-aware dynamics. This requires actual authoritative data, not purely plausible model output.

## November 2026 Rung 5 addendum

Rung 5 now includes a **normalized, source-derived extract** from NASA/JPL Horizons for the featured June 8 candidate and offers one-click loading in the R4 web app. The earlier R4 description of an empty data bundle applies to R4 at its original release, **not** the current main branch after R5. See [R5 source data and provenance](STARTRACE_HORIZONS_R5.md) and the source [manifest](../data/horizons-5bce/manifest.json). The extract is not a cryptographic NASA attestation.
