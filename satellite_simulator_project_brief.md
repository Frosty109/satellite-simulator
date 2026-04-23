# Satellite & Solar System Simulator — Project Brief

## Project Overview

Build a browser-native, open source satellite and solar system simulator. The goal is a tool that anyone can open via a URL with no download required, featuring accurate orbital mechanics backed by a C++ propagation engine compiled to WebAssembly, and visualized using CesiumJS.

This project is intended to be both genuinely useful (accurate enough for real satellite tracking) and a portfolio-quality engineering artifact demonstrating C++, WebAssembly, orbital mechanics, and modern browser-based 3D rendering.

---

## Core Design Principles

- **Zero install** — runs entirely in the browser, no server required in v1
- **Accuracy first** — use industry-standard algorithms (SGP4, VSOP87), not approximations
- **Clean architecture** — propagation logic is completely decoupled from rendering
- **Extensible** — designed from day one to grow from Earth satellites to full solar system scope
- **Open source** — all code public, well documented

---

## Technology Stack

### Propagation Layer — C++ compiled to WebAssembly
- Written in C++17
- Compiled to WASM using **Emscripten**
- Implements **SGP4/SDP4** for Earth satellite propagation (TLE input)
- Implements **VSOP87** for planetary position calculation (future extension)
- Exposes a clean `extern "C"` API consumed by JavaScript
- Outputs position/velocity state vectors in ECI (Earth Centered Inertial) coordinates

### Visualization Layer — CesiumJS
- **CesiumJS** for Earth-centered visualization
- Handles WGS84 ellipsoid, day/night terminator, atmospheric rendering out of the box
- Correct time and coordinate system support (JulianDate, ICRF/ECEF frames) built in
- **CZML** format used as the interface between the propagator output and CesiumJS
- Timeline scrubbing and animation handled natively by CesiumJS

### Frontend
- Vanilla JavaScript or lightweight framework (no heavy React setup needed for v1)
- Module bundler: **Vite** (fast dev server, good WASM support)
- Cesium Ion free tier for Earth imagery and terrain

### Future Solar System Extension
- Three.js scene (separate from CesiumJS) for solar system orrery view
- VSOP87 planetary positions from the C++ WASM layer
- Dual rendering modes: Earth view (CesiumJS) ↔ Solar system view (Three.js)

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              User Interface (Browser)            │
│                                                 │
│   TLE / Keplerian element input form            │
│   Satellite selection panel                     │
│   Timeline / playback controls                  │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│          JavaScript Bridge Layer                 │
│                                                 │
│   propagator-bridge.js                          │
│   - Loads WASM module                           │
│   - Calls C++ functions via ccall/cwrap         │
│   - Reads state structs from WASM heap          │
│                                                 │
│   czml-builder.js                               │
│   - Converts state vectors → CZML packets       │
│   - Handles ECI coordinates + Julian dates      │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│        C++ / WebAssembly Propagator              │
│                                                 │
│   sgp4.cpp       — SGP4/SDP4 implementation     │
│   vsop87.cpp     — Planetary positions (v2)     │
│   propagator.cpp — Main entry point             │
│                                                 │
│   Exposed functions:                            │
│   - propagate_tle(line1, line2, start, end, dt) │
│   - get_state_count()                           │
│   - free_states()                               │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│              CesiumJS Renderer                   │
│                                                 │
│   - Loads CZML from bridge                      │
│   - Renders satellite on WGS84 globe            │
│   - Animates trajectory with timeline           │
│   - Displays ground track, labels, trail        │
└─────────────────────────────────────────────────┘
```

---

## Data Structures

### C++ Side

```cpp
struct OrbitalState {
    double x, y, z;       // ECI position in km
    double vx, vy, vz;    // ECI velocity in km/s
    double epoch;          // Julian date
};

// Exposed to JavaScript via extern "C"
extern "C" {
    OrbitalState* propagate_tle(
        const char* line1,
        const char* line2,
        double start_jd,
        double end_jd,
        double step_seconds
    );
    int get_state_count();
    void free_states();
}
```

### JavaScript / CZML Side

The bridge reads `OrbitalState` structs from the WASM heap (7 doubles × 8 bytes = 56 bytes per state) and produces CZML packets for CesiumJS with:
- `referenceFrame: "INERTIAL"` (ECI)
- `interpolationAlgorithm: "LAGRANGE"`, degree 5
- Position array: `[isoTime, x_m, y_m, z_m, ...]` (note: km → metres conversion required)

---

## Project Structure

```
satellite-sim/
├── src/
│   ├── cpp/
│   │   ├── propagator.cpp       # Main WASM entry point
│   │   ├── sgp4.cpp             # SGP4 algorithm
│   │   ├── sgp4.h
│   │   └── vsop87.cpp           # Planetary positions (v2)
│   ├── js/
│   │   ├── main.js              # App entry point, CesiumJS init
│   │   ├── propagator-bridge.js # WASM loader and caller
│   │   ├── czml-builder.js      # State vectors → CZML
│   │   └── ui.js                # Input forms, controls
│   └── css/
│       └── main.css
├── public/
│   └── index.html
├── wasm/                        # Build output (propagator.js + .wasm)
├── build/
│   └── build.sh                 # Emscripten build script
├── package.json
├── vite.config.js
└── README.md
```

---

## Build Pipeline

### Emscripten Build Command

```bash
emcc src/cpp/propagator.cpp src/cpp/sgp4.cpp \
  -o wasm/propagator.js \
  -s EXPORTED_FUNCTIONS='["_propagate_tle","_get_state_count","_free_states"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="PropagatorModule" \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s WASM=1 \
  -O3
```

### Vite Config (WASM support)

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  plugins: [cesium()],
  optimizeDeps: {
    exclude: ['propagator']
  }
});
```

---

## Key Implementation Details

### Coordinate Frame Handling

SGP4 outputs positions in **ECI (Earth Centered Inertial)** — a non-rotating inertial frame. CesiumJS accepts this directly via `referenceFrame: "INERTIAL"` in CZML. Do **not** convert to ECEF before passing to CesiumJS — let Cesium handle the Earth rotation internally.

If ECEF is ever needed (e.g. for ground track computation), the conversion requires applying a rotation matrix based on Greenwich Apparent Sidereal Time (GAST). CesiumJS provides `Cesium.Transforms.computeIcrfToFixedMatrix()` for this.

### Time System

- SGP4 uses **Julian Date** internally
- CesiumJS uses `Cesium.JulianDate` — compatible
- CZML expects **ISO 8601** time strings for epoch and availability
- Conversion function needed: `julianDateToISO(jd)` — implement in the bridge layer

### WASM Memory Access Pattern

WASM heap is accessed via typed arrays. The `OrbitalState` struct (7 × `double`) maps to `HEAPF64`:

```javascript
const BYTES_PER_STATE = 56; // 7 doubles × 8 bytes
for (let i = 0; i < count; i++) {
    const base = (ptr + i * BYTES_PER_STATE) >> 3; // >> 3 for HEAPF64 indexing
    states.push({
        x:     wasm.HEAPF64[base + 0],
        y:     wasm.HEAPF64[base + 1],
        z:     wasm.HEAPF64[base + 2],
        vx:    wasm.HEAPF64[base + 3],
        vy:    wasm.HEAPF64[base + 4],
        vz:    wasm.HEAPF64[base + 5],
        epoch: wasm.HEAPF64[base + 6],
    });
}
```

### Unit Conversions

| From | To | Factor |
|------|----|--------|
| km (SGP4 output) | metres (CesiumJS) | × 1000 |
| Julian Date | seconds since J2000 | (jd − 2451545.0) × 86400 |

---

## v1 Feature Scope

The first shippable version should include:

- TLE input (text field, paste two-line element set)
- Pre-loaded example satellites (ISS, Hubble, Starlink sample)
- Live TLE fetch from **Celestrak API** for common satellites
- 24-hour propagation window, configurable
- CesiumJS globe with:
  - Satellite 3D position animated in real time
  - Orbital path trail (30 min lead/trail)
  - Ground track projected on Earth surface
  - Satellite label
  - Timeline scrubbing widget
- Basic info panel: current position, altitude, velocity, orbital period

---

## v2 Feature Scope (planned, not built in v1)

- Multiple simultaneous satellites
- Satellite conjunction / closest approach detection
- Keplerian element input (alternative to TLE)
- User-defined satellite parameters
- Coverage cone / footprint visualization
- Pass prediction for a ground location

---

## v3 Feature Scope (solar system extension)

- VSOP87 planetary positions in the C++ layer (same WASM module)
- Solar system orrery view using Three.js (separate scene, dual mode)
- Planet and moon selection
- Smooth camera transition between Earth view and solar system view
- Scale management for solar system distances (relative-to-eye rendering)

---

## External Data Sources

| Source | Usage | URL |
|--------|-------|-----|
| Celestrak | Live TLE feeds for active satellites | `https://celestrak.org/SPACETRACK/documentation/` |
| JPL Horizons | Ephemeris data reference / validation | `https://ssd.jpl.nasa.gov/horizons/` |
| NASA JPL DE440 | High-fidelity ephemeris (v3+) | Via SPICE toolkit |
| Space-Track.org | Full satellite catalog (requires account) | `https://www.space-track.org` |

For v1, Celestrak's public TLE feeds require no authentication and are suitable for fetching ISS, Hubble, Starlink, and other common satellite TLEs.

---

## SGP4 Implementation Notes

SGP4 (Simplified General Perturbations 4) is the standard algorithm for Earth satellite propagation. It accounts for:
- Atmospheric drag (using B* drag term from TLE)
- J2 oblateness perturbation (Earth's equatorial bulge)
- Lunar and solar gravitational perturbations (for high orbits, via SDP4 variant)

**Reference implementation:** Vallado et al. (2006) — the authoritative C++ SGP4 source is available from Celestrak and is the basis for all serious implementations. Use this as the starting reference rather than building from scratch.

Key TLE fields consumed by SGP4:
- Epoch (line 1, fields 19–32)
- B* drag term (line 1)
- Inclination, RAAN, eccentricity, argument of perigee, mean anomaly, mean motion (line 2)

---

## Portfolio / Employment Notes

This project is designed to demonstrate:
- **C++17** — propagation engine, memory management, numerical precision
- **WebAssembly / Emscripten** — cross-language compilation pipeline
- **Orbital mechanics** — SGP4, coordinate frames, time systems (directly relevant to aerospace)
- **CesiumJS** — used in production by aerospace and defense contractors
- **Full-stack browser engineering** — WASM ↔ JS bridge, 3D rendering, real-time animation

Comparable open source tools (Celestia, Gpredict) are desktop-only and largely unmaintained. A browser-native equivalent with accurate propagation is a genuine gap in the open source space. The combination of C++/WASM propagation + CesiumJS visualization does not exist as a cohesive, actively maintained open source project.

---

## Getting Started — First Steps for Claude Code

1. Set up the Vite project with `vite-plugin-cesium` and verify CesiumJS renders a basic globe
2. Write a minimal `sgp4.cpp` that compiles cleanly with Emscripten (start with Vallado's reference)
3. Write `propagator.cpp` with the `extern "C"` API and verify the WASM build produces `propagator.js` + `propagator.wasm`
4. Write `propagator-bridge.js` — load the WASM module, call `propagate_tle` for the ISS TLE, log state vectors to console
5. Write `czml-builder.js` — convert state vectors to a valid CZML packet
6. Load the CZML into CesiumJS and verify the ISS renders and animates on the globe
7. Add TLE input UI and wire it end to end

Validate each step before moving to the next. The WASM memory bridge (step 4) is the highest-risk integration point — confirm it returns correct position values before building on top of it.
