# STARTRACE-5 Rung 3 | The Gravity Encounter Laboratory

> **This is a numerical sensitivity experiment, not a validated historical comet trajectory.**
> The 5 BCE comet's actual orbit remains unknown. The code tests how the model changes when an approximate Earth-Moon gravitational perturbation is introduced.

## Evidence sources

- Mark Matney (2025), *The star that stopped*, JBAA 135(6), pp. 395–397. [Full paper](https://britastro.org/wp-content/uploads/2025/12/387-407_Matney_JBAA_2025-1.pdf) for the 11 hypothetical J2000 ecliptic comet orbits.
- [NASA/JPL Approximate Positions of the Planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html), 3000 BCE–3000 CE Earth–Moon barycenter orbit. This is *not* the precise Earth geocenter.
- [NASA/JPL Astrodynamic Parameters](https://ssd.jpl.nasa.gov/astro_par.html): solar GM 132712440041.279419 km³/s², Earth GM 398600.435507, Moon GM 4902.800118.

## Dynamics and numerical method

Integrate an explicitly *hypothetical* comet as a test particle in a heliocentric J2000 ecliptic frame, with AU position, AU/day velocity and time in Julian days on an approximate ephemeris scale.

Two paths start with **the same Sun-only parabolic initial state**, derived from Matney's published candidate elements. That state is set at local noon UT for the chosen candidate date *minus the chosen lead days*, converted to ephemeris time by adding the user-assumed ΔT (default 10,572 seconds). The initial velocity is computed by a centered finite difference of the analytic parabola. Changing the initial anchor is a real change to the model, *not merely a viewing angle change*.

The Sun-only path follows:

\[
\mathbf{a}_0=-\mu_{\odot}\frac{\mathbf{r}}{|\mathbf{r}|^3}.
\]

The perturbed path follows:

\[
\mathbf{a}_1=\mathbf{a}_0+k\mu_{\mathrm{EMB}}
\left(\frac{\mathbf{R}_{\mathrm{EMB}}-\mathbf{r}}{|\mathbf{R}_{\mathrm{EMB}}-\mathbf{r}|^3}
-\frac{\mathbf{R}_{\mathrm{EMB}}}{|\mathbf{R}_{\mathrm{EMB}}|^3}\right).
\]

The **indirect acceleration** term accounts for the moving heliocentric origin. The factor \(k\) is an intentional sensitivity control: 0 disables the Earth–Moon gravitational term, 1 applies the accepted combined GM to an approximate Earth–Moon barycenter point mass, and 2 doubles that fictional perturbing mass. The true Moon's separate position and force are not modeled.

A fixed-step classic fourth-order Runge–Kutta (RK4) integrator advances position and velocity. The model also repeats the perturbed calculation with **half the chosen maximum step** for a convergence check, and compares its independent Sun-only integration against the original R2 analytic parabola. These checks address numerical consistency, **not** actual physical correctness.

## Observable differences

- **Position deviation:** difference between the two integrated heliocentric comet vectors in km.
- **Angular separation:** using atan2 of \(|\mathbf{u}\times\mathbf{v}|\) and \(\mathbf{u}\cdot\mathbf{v}\), between the modeled Earth–Moon-barycenter-relative sightlines.
- **Reference numerical drift:** maximum mass-off path difference from the analytic parabola.
- **Convergence difference:** maximum difference between full-step and half-step perturbed numerical positions.
- **Sampled minimum distance:** smallest of the sampled distances to the barycenter proxy; not an exact extremum and not distance to the Earth's center.

Top-view XY plotting drops the J2000 ecliptic Z component, even though the integration and separation calculations are all **3D**. The 384,400 km ring is a distance reference, *not a simulated Moon orbit*. Plot markers are intentionally enlarged.

## Reproduce

~~~bash
npm run check
node --test tests/startrace-flyby.test.mjs
python -m http.server 8080
# open http://localhost:8080/flyby.html
~~~

Exported JSON uses schema \`gmed-startrace-5:flyby-experiment:v3\`, verdict \`ILLUSTRATIVE_GRAVITY_SENSITIVITY\`, and three explicit false flags for historical identification, precision-ephemeris validation and independent verification.

## Limits and the next serious scientific gate

1. The orbital starting states are **candidate fits**, not measured comet positions. Rung 3 does not re-fit a candidate under gravity-aware dynamics.
2. The NASA table's approximate **Earth–Moon barycenter** may be thousands of kilometers off the actual Earth's center near a lunar-distance event.
3. Earth and Moon are artificially combined as a point mass, with a prescribed approximate orbit; planetary perturbations, Earth's exact motion, gravitational relativity, and comet non-gravitational forces are not modeled.
4. The point-mass approximation is explicitly rejected if the comet approaches within 0.00007 AU of the barycenter proxy; this cutoff is not a real collision detector.
5. Fixed-step RK4 and step-doubling provide a numerical convergence diagnostic, not validation against the full JPL DE441 ephemeris.
6. The model includes **no** brightness, atmosphere, naked-eye visibility or historical probabilities.
7. The 11 published alternatives are not independent observations, random samples or confidence bounds.

Next: validate JPL Earth and Moon vectors in a consistent coordinate frame; compare the trajectories against Horizons/DE441; then perform a new orbit fit with precise ephemerides and carefully sourced observational constraints.
