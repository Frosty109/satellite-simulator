# WebAssembly & Emscripten

## What is WebAssembly (WASM)?

WebAssembly is a binary instruction format that runs in the browser at near-native speed.
It is not JavaScript — it's a compilation target. You write code in C, C++, or Rust,
compile it to `.wasm`, and the browser executes it directly.

For this project: the SGP4 propagation algorithm is written in C++ and compiled to WASM.
JavaScript calls into it to get satellite positions.

---

## What is Emscripten?

Emscripten is the compiler toolchain that turns C++ into WASM. It produces two files:
- `propagator.wasm` — the compiled binary
- `propagator.js` — a JavaScript "glue" file that loads the WASM and sets up the runtime

You use the glue file in your HTML/JS; it handles fetching and instantiating the `.wasm`
binary for you.

---

## The extern "C" API

C++ uses name mangling — function names get encoded with type information, making them
hard to call from JavaScript. Wrapping functions in `extern "C"` disables mangling and
exposes clean names:

```cpp
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

These three functions are the entire public API of the WASM module.

---

## Emscripten Build Flags

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

- `EXPORTED_FUNCTIONS` — which C functions to expose (note the leading underscore)
- `EXPORTED_RUNTIME_METHODS` — exposes `ccall`/`cwrap` for calling C functions from JS
- `MODULARIZE=1` — wraps everything in a factory function instead of polluting globals
- `ALLOW_MEMORY_GROWTH=1` — lets the WASM heap grow if needed
- `-O3` — full optimisation

---

## Async Initialisation — Critical

The WASM binary loads asynchronously. The browser has to fetch the `.wasm` file, compile
it, and set up the memory heap before any functions can be called. This takes time.

If you call a WASM function before it's ready you get: `_propagate_tle is not a function`

**The fix — wrap in a Promise:**

```javascript
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

// In main.js:
await loadPropagator();
enableUI(); // only enable buttons after this resolves
```

Keep the UI disabled until `loadPropagator()` resolves. On a slow connection the WASM
binary could take several seconds to load.

---

## Reading Data Back from WASM — The Memory Bridge

WASM has its own linear memory (the "heap"). When `propagate_tle` returns a pointer, it's
a byte offset into that heap. JavaScript reads the data back using typed arrays:

```javascript
// OrbitalState struct = 7 doubles × 8 bytes = 56 bytes
const BYTES_PER_STATE = 56;

for (let i = 0; i < count; i++) {
    const base = (ptr + i * BYTES_PER_STATE) >> 3; // >> 3 converts byte offset to Float64 index
    states.push({
        x:     wasm.HEAPF64[base + 0],  // ECI position (km)
        y:     wasm.HEAPF64[base + 1],
        z:     wasm.HEAPF64[base + 2],
        vx:    wasm.HEAPF64[base + 3],  // ECI velocity (km/s)
        vy:    wasm.HEAPF64[base + 4],
        vz:    wasm.HEAPF64[base + 5],
        epoch: wasm.HEAPF64[base + 6],  // Julian Date
    });
}
```

After reading, call `free_states()` to release the WASM-side memory allocation.

---

## Unit Conversions

| From | To | Factor |
|------|----|--------|
| km (SGP4 output) | metres (CesiumJS expects) | × 1000 |
| Julian Date | seconds since J2000 | (jd − 2451545.0) × 86400 |
