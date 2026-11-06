#!/usr/bin/env python3
"""STARTRACE-5 R8 external numerical solver: SciPy DOP853.

Independently implements Hermite vector interpolation and restricted Newtonian
Sun/Earth/Moon force terms in Python, using an externally maintained eighth-
order solver. Input state, output epochs and source-derived vectors are supplied
by the JS case exporter. This tests numerical agreement, NOT the physics,
historical comet identification or NASA source authenticity.
"""
from __future__ import annotations

import json
import math
import pathlib
import sys

import numpy as np
import scipy
from scipy.integrate import solve_ivp

AU_KM = 149597870.7
SECONDS_DAY = 86400.0
GM_SUN = 132712440041.279419
GM_EARTH = 398600.435507
GM_MOON = 4902.800118


class UnsafeNumerics(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise UnsafeNumerics(message)


def source_table(items: object, name: str):
    require(isinstance(items, list) and 3 <= len(items) <= 200,
            f"{name}_VECTOR_COUNT_INVALID")
    times = np.array([row["jd"] for row in items], dtype=float)
    p = np.array([row["p"] for row in items], dtype=float)
    v = np.array([row["v"] for row in items], dtype=float)
    require(p.shape == (len(times), 3) and v.shape == (len(times), 3),
            f"{name}_VECTOR_DIMENSION_INVALID")
    require(np.isfinite(times).all() and np.isfinite(p).all() and np.isfinite(v).all(),
            f"{name}_VECTOR_NONFINITE")
    require(np.all(np.diff(times) > 0) and np.max(np.diff(times)) <= .251,
            f"{name}_VECTOR_TIME_SPACING")
    require(np.all((np.linalg.norm(p, axis=1) > .7) &
                   (np.linalg.norm(p, axis=1) < 1.3)),
            f"{name}_HELIOCENTRIC_DISTANCE_INVALID")
    return times, p, v


def hermite_position(table, jd: float):
    times, pos, vel = table
    require(times[0] - 1e-9 <= jd <= times[-1] + 1e-9,
            "SOURCE_EPHEMERIS_COVERAGE_EXCEEDED")
    index = max(0, min(len(times) - 2, int(np.searchsorted(times, jd, side="right") - 1)))
    width = times[index + 1] - times[index]
    u = (jd - times[index]) / width
    u2, u3 = u * u, u * u * u
    return ((2 * u3 - 3 * u2 + 1) * pos[index]
            + (u3 - 2 * u2 + u) * width * vel[index]
            + (-2 * u3 + 3 * u2) * pos[index + 1]
            + (u3 - u2) * width * vel[index + 1])


def build_forces(case, earth, moon):
    conversions = SECONDS_DAY**2 / AU_KM**3
    bodies = [
        ("EARTH", earth, GM_EARTH * conversions, 15000.0),
        ("MOON", moon, GM_MOON * conversions, 7000.0),
    ]
    mu_sun = GM_SUN * conversions
    epoch = case["epochJD"]
    min_body = {"earthStageKm": math.inf, "moonStageKm": math.inf}

    def force(t, state):
        r = np.asarray(state[:3], dtype=float)
        velocity = np.asarray(state[3:6], dtype=float)
        require(np.isfinite(state).all(), "COMET_STATE_NONFINITE")
        radius = float(np.linalg.norm(r))
        require(radius >= .001, "SUN_PROXIMITY_EXCLUSION")
        a = -mu_sun * r / radius**3
        jd = epoch + float(t)
        for name, source, mu, cutoff in bodies:
            body_position = hermite_position(source, jd)
            delta = body_position - r
            distance = float(np.linalg.norm(delta))
            center_norm = float(np.linalg.norm(body_position))
            km = distance * AU_KM
            key = "earthStageKm" if name == "EARTH" else "moonStageKm"
            min_body[key] = min(min_body[key], km)
            require(km > cutoff, name + "_CLOSE_APPROACH_EXCLUSION")
            require(center_norm > .5, name + "_INVALID_ORIGIN")
            # Both direct attraction AND acceleration of the heliocentric
            # origin, independently expressed here in numpy.
            a = a + mu * (delta / distance**3 - body_position / center_norm**3)
        return np.concatenate((velocity, a))

    return force, min_body


def load_case(path: pathlib.Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    require(data.get("schema") == "gmed-startrace-5:r8-cross-language-input:v1",
            "UNSUPPORTED_R8_INPUT_SCHEMA")
    require(data.get("verdict") == "CONDITIONAL_NUMERICAL_MODEL_INPUT",
            "INPUT_VERDICT_NOT_CONSERVATIVE")
    for claim in ("historicalCometOrbitConfirmed", "sourceAuthenticityVerified",
                  "physicalModelIndependentlyValidated"):
        require(data.get(claim) is False, "INPUT_FALSE_CLAIM_FLAG_MISSING")
    require(data.get("auKm") == AU_KM, "AU_UNIT_MISMATCH")
    for key, accepted in (("sun", GM_SUN), ("earth", GM_EARTH), ("moon", GM_MOON)):
        require(data.get("gravitationalConstantsKm3S2", {}).get(key) == accepted,
                "GRAVITATIONAL_CONSTANT_MISMATCH_" + key)
    require(data.get("earthCutoffKm") == 15000 and
            data.get("moonCutoffKm") == 7000, "PROXIMITY_EXCLUSION_MISMATCH")
    times = np.array(data["outputJD"], dtype=float)
    y0 = np.array(data["initialState"], dtype=float)
    require(y0.shape == (6,) and np.isfinite(y0).all(),
            "INVALID_COMET_INITIAL_STATE")
    require(10 <= len(times) <= 200 and np.isfinite(times).all()
            and np.all(np.diff(times) > 0), "INVALID_COMET_OUTPUT_TIMES")
    epoch = float(data["epochJD"])
    require(1719753 < epoch < 1719756 and times[0] > epoch
            and times[-1] < 1719757, "EPOCH_OUTSIDE_RESEARCH_WINDOW")
    require(len(data["jsReference"]["states"]) == len(times),
            "INVALID_JS_REFERENCE_SAMPLE_COUNT")
    require(all(len(s) == 6 and all(math.isfinite(v) for v in s)
                for s in data["jsReference"]["states"]), "NONFINITE_JS_REFERENCE")
    earth = source_table(data["sourceBodyVectors"]["earth"], "EARTH")
    moon = source_table(data["sourceBodyVectors"]["moon"], "MOON")
    require(np.array_equal(earth[0], moon[0]), "MISMATCHED_SOURCE_EPOCHS")
    require(epoch >= earth[0][0] and times[-1] <= earth[0][-1],
            "SOURCE_DOES_NOT_COVER_COMET_WINDOW")
    for body in ("earth", "moon"):
        digest = data.get("sourceNormalizedSha256", {}).get(body)
        require(isinstance(digest, str) and len(digest) == 64 and
                all(ch in "0123456789abcdef" for ch in digest),
                "MISSING_NORMALIZED_SOURCE_HASH")
    return data, times, y0, earth, moon


def run(case_path: pathlib.Path):
    case, epochs, y0, earth, moon = load_case(case_path)
    force, stage = build_forces(case, earth, moon)
    relative_times = epochs - case["epochJD"]
    # Relative time avoids O(1.7 million) cancellation in the adaptive
    # solver independent variable, while source lookup still uses exact JD.
    result = solve_ivp(
        force, (0., float(relative_times[-1])), y0,
        method="DOP853",
        t_eval=relative_times,
        max_step=1/96,
        rtol=1e-12,
        atol=np.array([1e-13] * 3 + [3e-13] * 3),
    )
    require(result.success and result.y.shape == (6, len(epochs)),
            "SCIPY_DOP853_INTEGRATION_FAILED")
    states = result.y.T
    js_states = np.array(case["jsReference"]["states"], dtype=float)
    position_diff_km = np.linalg.norm(states[:, :3] - js_states[:, :3], axis=1) * AU_KM
    velocity_diff_km_s = np.linalg.norm(states[:, 3:] - js_states[:, 3:], axis=1) * AU_KM / SECONDS_DAY
    require(np.isfinite(position_diff_km).all() and np.isfinite(velocity_diff_km_s).all(),
            "CROSS_LANGUAGE_DIFFERENCES_NONFINITE")
    return {
        "schema": "gmed-startrace-5:r8-external-numerical-result:v1",
        "verdict": "CROSS_LANGUAGE_NUMERICAL_AGREEMENT_ONLY",
        "referenceMethod": "SciPy solve_ivp DOP853 (8th-order adaptive Runge-Kutta)",
        "scipyVersion": scipy.__version__,
        "model": "Restricted Sun/Earth/Moon forces on hypothetical Matney comet candidate",
        "sourceNormalizedSha256": case["sourceNormalizedSha256"],
        "anchorJD": case["epochJD"],
        "outputJD": case["outputJD"],
        "statistics": {
            "maxPositionDifferenceKm": float(np.max(position_diff_km)),
            "rmsPositionDifferenceKm": float(np.sqrt(np.mean(position_diff_km**2))),
            "maxVelocityDifferenceKmS": float(np.max(velocity_diff_km_s)),
            "rmsVelocityDifferenceKmS": float(np.sqrt(np.mean(velocity_diff_km_s**2))),
            "scipyFunctionEvaluations": result.nfev,
            "minDerivativeStageEarthDistanceKm": stage["earthStageKm"],
            "minDerivativeStageMoonDistanceKm": stage["moonStageKm"],
            "sampleCount": len(epochs)
        },
        "samples": [
            {"jd": float(jd), "hour": case["localSolarHours"][i],
             "positionDifferenceKm": float(position_diff_km[i]),
             "velocityDifferenceKmS": float(velocity_diff_km_s[i])}
            for i, jd in enumerate(epochs)
        ],
        "scientificLimitations": [
            "SciPy is independently maintained, but its solver integrates the SAME restricted gravitational equations.",
            "The initial comet state is hypothetical and not fitted to ancient observed positions.",
            "Earth/Moon ephemerides are NASA Horizons-derived normalized, unauthenticated source extracts.",
            "Agreement measures implementation/numerical consistency, not an uncertainty bound on a real comet.",
            "No independent sky observation, historical orbit or comet brightness has been established."
        ],
        "historicalCometOrbitConfirmed": False,
        "independentPhysicalValidation": False,
        "sourceCryptographicAuthenticity": False,
        "exactClosestApproachDetermined": False,
    }


def main():
    if len(sys.argv) != 3:
        raise UnsafeNumerics("Usage: startrace-r8-scipy.py INPUT.json OUTPUT.json")
    result = run(pathlib.Path(sys.argv[1]))
    pathlib.Path(sys.argv[2]).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    try:
        main()
    except (UnsafeNumerics, ValueError, KeyError, TypeError, OSError) as exc:
        print("STARTRACE_R8_SCIPY_REFUSED: " + str(exc), file=sys.stderr)
        sys.exit(1)
