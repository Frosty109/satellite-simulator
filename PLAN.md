# Satellite & Solar System Simulator — Development Plan

## Vision

A browser-native simulator running entirely in the browser (no install required), built in three phases:
- **v1** — Earth satellites (SGP4 propagation, CesiumJS visualization)
- **v2** — Moon and translunar trajectories (n-body integrator, Artemis-style missions)
- **v3** — Full solar system orrery (VSOP87 planetary positions, Three.js scene)

The C++/WASM propagation core is designed from day one to grow across all three phases.

---

## Phase 1 — Earth Satellites

### Goal
A working satellite tracker: paste a TLE, see the satellite animate on a 3D globe.

### Feature Scope
- TLE paste input (two text fields for line 1 and line 2)
- Preloaded satellite dropdown (ISS, Hubble, one Starlink sample)
  - Selecting a preloaded satellite populates the TLE fields with static data
  - Fields remain editable — users can paste a fresh TLE over the static one
  - "Custom" option in the dropdown starts with empty fields
- 24-hour propagation window (configurable)
- CesiumJS globe with:
  - Satellite 3D position animated in real time
  - Orbital trail (30 min lead/trail)
  - Ground track projected on Earth surface
  - Satellite label
  - Timeline scrubbing widget
- Info panel: current position, altitude, velocity, orbital period

### Notes on Static TLEs
Preloaded TLEs are hardcoded strings in the JS source. They go stale over time (an old
ISS TLE gives wrong positions) but are fine for demonstrating the simulator. Users who
want current accuracy paste in a fresh TLE from celestrak.org. A link to Celestrak in
the UI is sufficient — no live fetch needed in v1.

Live Celestrak fetch is blocked by CORS in the browser and would require a serverless
proxy (Cloudflare Worker, etc.), which breaks the zero-install constraint. Defer to v2
or later, or omit entirely given that TLE paste covers the use case.

### Build Steps (in order — validate each before proceeding)
1. Set up Vite project with `vite-plugin-cesium`, verify CesiumJS renders a basic globe
2. Write minimal `sgp4.cpp` using Vallado's reference implementation, compile with Emscripten
3. Write `propagator.cpp` with `extern "C"` API, verify WASM build produces `propagator.js` + `propagator.wasm`
4. Write `propagator-bridge.js`:
   - Wrap WASM module load in a Promise (see WASM Init section below)
   - Call `propagate_tle` for the ISS static TLE
   - Log state vectors to console and verify values are sensible
5. Write `czml-builder.js` — convert state vectors to valid CZML packet
6. Load CZML into CesiumJS, verify ISS renders and animates correctly
7. Add TLE input UI and preloaded dropdown, wire end to end

### WASM Initialisation — Critical Detail
The WASM binary loads asynchronously. Calling any propagator function before the module
is ready causes a crash (`_propagate_tle is not a function`). Wrap the module load in a
Promise and keep the UI disabled until it resolves:

```javascript
// propagator-bridge.js
let wasmModule = null;

export function loadPropagator() {
    return new Promise((resolve) => {
        PropagatorModule({
            onRuntimeInitialized() {
                wasmModule = this;
                resolve();
            }
        });
    });
}

// main.js
await loadPropagator();
enableUI(); // only enable propagate button after this
```

---

## Phase 2 — The Moon

### Goal
Add the Moon as a body and support translunar trajectories (Artemis-style Earth-to-Moon
transfers). Visualized in CesiumJS — Earth-Moon distances are well within its coordinate
system.

### Why SGP4 Doesn't Work Here
SGP4 assumes Earth gravity is dominant. A translunar trajectory passes through the region
where the Moon's gravity takes over — SGP4 has no model for this. An n-body integrator
is required.

### What's Needed
- Moon position from VSOP87 (already planned for v3 C++ layer — pull it forward here)
- N-body integrator in C++ (RK4 or similar) — computes gravitational acceleration from
  Earth, Moon, and Sun at each timestep
- Expose a second propagation mode via the `extern "C"` API alongside SGP4
- Trajectory input: either a simplified two-burn approximation or Horizons-sourced state vectors
- Visualize trajectory in CesiumJS with Moon position rendered at correct location

### Notes
The n-body integrator written here is the same core used in v3 for interplanetary
trajectories — same code, more bodies.

---

## Phase 3 — Solar System Orrery

### Goal
Full solar system view with planetary positions and interplanetary trajectory simulation.
Dual rendering mode: Earth view (CesiumJS) ↔ Solar system view (Three.js).

### What's Needed
- Full VSOP87 planetary positions in the C++ WASM layer
- Three.js scene for the orrery (separate from CesiumJS, different scale)
- N-body integrator from v2 extended to more gravitational bodies
- Smooth camera/mode transition between Earth view and solar system view
- Scale management (solar system distances require relative-to-eye rendering)

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Propagation | C++17 compiled to WASM via Emscripten |
| Earth visualization | CesiumJS |
| Solar system visualization | Three.js (v3) |
| Frontend | Vanilla JS, Vite |
| SGP4 reference | Vallado et al. (2006) — use this, don't reimplement from scratch |
| Planetary positions | VSOP87 |
| Lunar/interplanetary | N-body RK4 integrator + JPL Horizons / DE440 ephemeris |

---

## Key Unit Conversions

| From | To | Factor |
|------|----|--------|
| km (SGP4 output) | metres (CesiumJS) | × 1000 |
| Julian Date | seconds since J2000 | (jd − 2451545.0) × 86400 |

---

## External Data Sources

| Source | Usage | When |
|--------|-------|------|
| Celestrak | Fresh TLE data (user-sourced, not fetched) | v1 |
| JPL Horizons | Trajectory validation, translunar state vectors | v2 |
| VSOP87 | Planetary + lunar positions | v2/v3 |
| NASA JPL DE440 | High-fidelity ephemeris | v3+ |

---

## Portfolio Story

v1 → v2 → v3 demonstrates a clear, cumulative progression:
- **C++17 and WebAssembly** — propagation engine, memory management, Emscripten pipeline
- **Orbital mechanics** — SGP4, n-body integration, coordinate frames, time systems
- **CesiumJS** — used in production by aerospace and defense contractors
- **Browser engineering** — WASM↔JS bridge, 3D rendering, real-time animation

No maintained browser-native equivalent (SGP4 + CesiumJS + n-body) exists in open source.
