# STARTRACE-5 Rung 6 | Withheld-epoch interpolation validation

## Measured, not invented

Rung 6 independently **queried** the public NASA/JPL Horizons API again (via a third-party HTTPS extraction service), this time for *30-minute* geocentric Earth (399) and Moon (301) heliocentric ecliptic vectors over Julian-calendar June 8–9, 5 BCE.

The baseline dataset from R5 contains 26 points for each body, spaced **3 hours** apart. R6 stores **49 new points per body at 30-minute intervals** on Julian Date TDB **1719755.520000 to 1719756.520000**, then compares the existing cubic Hermite position/velocity interpolation against **40 points per body that do not coincide with baseline knots**. The nine shared knot epochs are excluded from the statistical calculation but checked for matching XYZ and velocity.

**Important:** These are *different requests to the same source-declared DE441 ephemeris*, not observations from independently calibrated instruments. This is a test of our interpolation implementation, not the accuracy of NASA's historical ephemeris, and certainly not a verification of the hypothetical ancient comet orbit.

### Sources

- NASA/JPL Horizons API: https://ssd-api.jpl.nasa.gov/doc/horizons.html
- NASA Horizons manual: https://ssd.jpl.nasa.gov/horizons/manual.html
- Baseline normalized extract and request URLs: \`data/horizons-5bce/manifest.json\`
- Heldout normalized extract and fresh request URLs: \`data/horizons-5bce/heldout-manifest.json\`
- Research hypothesis separate from planetary data: Matney (2025), JBAA, pp. 395–397, https://britastro.org/wp-content/uploads/2025/12/387-407_Matney_JBAA_2025-1.pdf

Both saved datasets are **normalized extracts** from public NASA Horizons response text, not byte-identical NASA raw files; no cryptographic source authentication exists. All provider URLs and target/time/coordinate parameters are preserved in the manifests for independent re-querying. Source header says DE441, but the project does not digitally attest that claim.

### Mathematical comparison

Let \(p_0,v_0\) and \(p_1,v_1\) be each pair of the baseline 3-hour endpoints in AU and AU/day; \(\Delta t\) is in days and \(u=(t-t_0)/\Delta t\). The existing R4 interpolation produces

\[
\hat{p}(u)=(2u^3-3u^2+1)p_0+(u^3-2u^2+u)\Delta t\,v_0+(-2u^3+3u^2)p_1+(u^3-u^2)\Delta t\,v_1 .
\]

The instantaneous **3D Cartesian position residual** at a new 30-minute epoch is

\[
\epsilon_p(t)=\|\hat{p}(t)-p_{\mathrm{new}}(t)\|\times 149597870.7\ {\rm km}.
\]

Velocity is compared analogously, with AU/day converted to km/s. The Earth–Moon separation residual is the scalar difference between the two derived Earth–Moon ranges; it is **not** uncertainty of the physical lunar distance.

For each of 40 withheld epochs, compute mean, RMS, maximum and 95th percentile residual, separately for Earth and Moon position and velocity, plus the Earth–Moon range discrepancy. The code uses deterministic numerical calculations; no model training or optimization.

### Results at initial evaluation

Independent baseline-to-heldout comparison in the selected one-day window gave approximately **0.00157 km max Earth positional discrepancy** and **0.00177 km max Moon positional discrepancy** (about 1.57 m and 1.77 m respectively). Recalculate exact statistics with the CLI because floating-point and file changes may change the last digits. The new source precision is not a statement of the model's physical accuracy.

### Reproduce offline

~~~bash
npm run check
npm run horizons-audit
npm run horizons-validate
python -m http.server 8080
# Visit http://localhost:8080/validate.html
~~~

The CLI emits JSON including 40-sample statistics, original official Horizons query URLs, and SHA-256 of all **four normalized source-derived files**. Its validation will fail if sampling cadence, source IDs, Sun-center frame/units, declared DE441 model, shared knot consistency or Earth/Moon epoch pairing become incompatible.

The site displays the same residual statistics in an interactive chart. It only presents the result after the user clicks **RUN WITHHELD-EPOCH AUDIT**, which reads same-origin static files. Browsers do not fetch from a runtime NASA API automatically.

### Scientific limitations

- **Not a new orbital determination:** only planetary and lunar state vectors are compared. No historical comet was observed by Horizons.
- **Not independent model validation:** 3-hour and 30-minute products came from the same source-declared DE441 dynamical model. The higher cadence reference is useful as heldout samples for interpolation accuracy, not external truth.
- **Not a physical uncertainty bound:** exact DE441 deep-time error is not quantified by this comparison. The source manual warns that high printed precision does not imply physical accuracy.
- **Not NASA origin authentication:** saved files were reconstructed from extracted response text and carry no verifiable NASA signature. SHA-256 identifies our local normalized bytes.
- **Not the full encounter problem:** a one-day window does not validate all dates, alternative comet orbits, ΔT, Earth rotation, close-flyby gravitational forces, visibility, or the Bethlehem narrative.

## Next scientific gate (Rung 7)

Evaluate the numerical **comet gravity integrator** against an independent reference solver and perform a convergence/step-size sweep around a nominal close approach, with explicitly fit (or clearly hypothetical) comet initial conditions. That test is separate from planetary ephemeris interpolation and will require new safeguards.
