# Orbital Mechanics

## Two-Line Element Sets (TLEs)

A TLE is a standardized text format that encodes a satellite's orbital state at a specific
point in time (called the **epoch**). It's two lines of fixed-width numbers:

```
ISS (ZARYA)
1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9993
2 25544  51.6412  34.5678 0001234  56.7890 303.4567 15.49012345678901
```

**Line 1 key fields:**
- Columns 19–32: Epoch (year + day-of-year + fractional day)
- B* drag term: models atmospheric drag on the satellite

**Line 2 key fields:**
- Inclination: angle of the orbital plane relative to the equator
- RAAN (Right Ascension of Ascending Node): where the orbit crosses the equator going north
- Eccentricity: how elliptical the orbit is (0 = circle, 1 = parabola)
- Argument of perigee: orientation of the ellipse in the orbital plane
- Mean anomaly: where the satellite is in its orbit at epoch
- Mean motion: orbits per day (used to derive orbital period and semi-major axis)

**Staleness:** TLEs go stale because real orbits drift due to atmospheric drag, solar
pressure, and maneuvers. For ISS (low Earth orbit), a week-old TLE gives noticeably
wrong positions. Always use fresh TLEs for accurate tracking.

Source for fresh TLEs: https://celestrak.org

---

## SGP4 — Simplified General Perturbations 4

SGP4 is the standard algorithm for propagating Earth satellites forward (or backward)
in time from a TLE. It gives position and velocity in ECI coordinates at any requested
time.

**What it accounts for:**
- J2 perturbation: Earth is not a perfect sphere — its equatorial bulge pulls on orbits
- Atmospheric drag: uses the B* term from the TLE
- Lunar and solar gravitational perturbations (SDP4 variant, for high orbits)

**What it does NOT handle:**
- Trajectories that leave Earth's gravitational dominance (e.g. translunar)
- High-fidelity perturbations (for that, use numerical integration with DE440 ephemeris)

**Reference implementation:** Vallado et al. (2006) — available from Celestrak. Use this
rather than implementing from scratch.

---

## Coordinate Frames

### ECI — Earth Centered Inertial
- Origin at Earth's center
- Axes fixed relative to distant stars (does NOT rotate with Earth)
- X axis points toward the vernal equinox
- SGP4 outputs positions in this frame
- CesiumJS accepts ECI directly via `referenceFrame: "INERTIAL"` in CZML

### ECEF — Earth Centered Earth Fixed
- Origin at Earth's center
- Axes rotate with Earth (X axis points toward 0°N 0°E)
- Used for ground-based positions (lat/lon/alt)
- To convert ECI → ECEF you need to apply a rotation based on Earth's rotation angle
  at the given time (Greenwich Apparent Sidereal Time)
- CesiumJS provides `Cesium.Transforms.computeIcrfToFixedMatrix()` for this

**Key rule:** Do NOT convert SGP4 output to ECEF before passing to CesiumJS. Pass ECI
directly and let Cesium handle Earth's rotation internally.

---

## Time Systems

| System | Description | Used by |
|--------|-------------|---------|
| Julian Date (JD) | Continuous day count from noon 1 Jan 4713 BC | SGP4 internally |
| J2000 | Seconds since 1 Jan 2000 12:00 TT | CesiumJS internally |
| ISO 8601 | Human-readable: `2024-01-01T00:00:00Z` | CZML packets |

**Useful conversions:**
- JD → seconds since J2000: `(jd - 2451545.0) * 86400`
- JD → ISO 8601: implement `julianDateToISO(jd)` in the JS bridge layer
