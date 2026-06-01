# Satellite Simulator — Project Context

## What This Is

A browser-native satellite tracker. Paste a TLE → satellite animates on a 3D globe. Zero install, runs entirely in the browser.

**Stack:** C++17 SGP4 propagation engine → Emscripten → WebAssembly → TypeScript bridge → CesiumJS 3D globe.

Three planned phases:
- **v1** — Earth satellites (SGP4, CesiumJS) ← current phase
- **v2** — Moon and translunar trajectories (n-body RK4 integrator)
- **v3** — Full solar system orrery (VSOP87, Three.js)

---

## Current Status — Phase 1

### Completed
- Docker dev environment (Emscripten + Node 22, Dev Container for VS Code)
- Vite + TypeScript + CesiumJS globe renders at `localhost:5173`
- Cesium Ion token loaded from `.env` via `VITE_CESIUM_TOKEN`
- Vallado's SGP4 reference implementation in `src/cpp/` (SGP4.h, SGP4.cpp) — not written from scratch
- `src/cpp/propagator.cpp` — `extern "C"` wrapper exposing `propagate_tle`, `get_state_count`, `free_states`
- WASM compiled: `wasm/propagator.js` + `wasm/propagator.wasm`
- `src/js/propagator-bridge.ts` — loads WASM module, reads `OrbitalState[]` from HEAPF64

### Immediate Next Steps
1. **Sanity check the WASM bridge** — call `propagateTle` with a static ISS TLE, verify in the console:
   - Position magnitude `√(x²+y²+z²)` ≈ 6,778 km
   - Velocity magnitude `√(vx²+vy²+vz²)` ≈ 7.66 km/s
   - Epoch advances by exactly `step_seconds / 86400` per state
2. Write `src/js/czml-builder.ts` — convert `OrbitalState[]` to a CZML packet
3. Load CZML into CesiumJS, verify ISS animates on the globe
4. Add TLE input UI + preloaded satellite dropdown, wire end to end

---

## Key Architecture Rules

- SGP4 outputs **ECI coordinates in km** — pass `referenceFrame: "INERTIAL"` in CZML, do NOT convert to ECEF
- WASM loads **asynchronously** — keep UI disabled until `PropagatorModule()` resolves
- `propagate_tle` returns a pointer to a **static vector** — copy values before the next call or the pointer is invalidated
- All Vallado functions live in the `SGP4Funcs::` namespace
- Unit conversions: km × 1000 → metres for CesiumJS; `(jd - 2451545.0) * 86400` → seconds since J2000

---

## Running the Project

```bash
npm install        # if node_modules is missing
npm run dev        # Vite dev server at localhost:5173
```

## Recompiling the WASM

Only needed if `src/cpp/` files change:

```bash
emcc src/cpp/propagator.cpp src/cpp/SGP4.cpp \
  -o wasm/propagator.js \
  -s EXPORTED_FUNCTIONS='["_propagate_tle","_get_state_count","_free_states"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="PropagatorModule" \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s WASM=1 \
  -O2
```

---

## Reference Documents

- `PLAN.md` — full development plan, phase definitions, definition of done for Phase 1
- `satellite_simulator_project_brief.md` — architecture, data structures, build pipeline detail
- `sessions/` — session notes, most recent = current status
- `learning/` — topic-based reference notes (orbital mechanics, WASM/Emscripten, CesiumJS)
- `issues/` — logged problems and resolutions per session

---

## Custom Commands

- `/session` — write today's session document
- `/learning` — update topic-based learning notes with new concepts from this session
- `/issues` — log problems and resolutions from this session
- `/session-finished` — run all three of the above
