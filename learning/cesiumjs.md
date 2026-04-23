# CesiumJS

## What is CesiumJS?

CesiumJS is an open source JavaScript library for 3D globe and map visualization. It's
used in production by aerospace and defense contractors for satellite tracking, mission
planning, and geospatial analysis — making it a relevant portfolio technology.

Key capabilities relevant to this project:
- WGS84 ellipsoid (accurate Earth shape, not a sphere)
- Correct time and coordinate system support built in
- Day/night terminator and atmospheric rendering
- CZML playback with timeline scrubbing
- Accepts ECI (inertial) coordinates directly — no manual Earth-rotation conversion needed

---

## CZML — The Interface Format

CZML (Cesium Language) is a JSON format that describes time-dynamic scenes. It's the
bridge between the propagator output and CesiumJS.

A minimal CZML packet for a satellite:

```json
[
  {
    "id": "document",
    "name": "ISS",
    "version": "1.0",
    "clock": {
      "interval": "2024-01-01T00:00:00Z/2024-01-02T00:00:00Z",
      "currentTime": "2024-01-01T00:00:00Z",
      "multiplier": 60
    }
  },
  {
    "id": "ISS",
    "name": "ISS",
    "availability": "2024-01-01T00:00:00Z/2024-01-02T00:00:00Z",
    "position": {
      "referenceFrame": "INERTIAL",
      "interpolationAlgorithm": "LAGRANGE",
      "interpolationDegree": 5,
      "epoch": "2024-01-01T00:00:00Z",
      "cartesian": [
        0, x0, y0, z0,
        60, x1, y1, z1,
        ...
      ]
    }
  }
]
```

**Key points:**
- `referenceFrame: "INERTIAL"` — tells Cesium the positions are in ECI, not ECEF
- `cartesian` array format: `[seconds_from_epoch, x, y, z, ...]` — positions in **metres**
- SGP4 outputs in km — multiply by 1000 before putting in the CZML array
- `interpolationAlgorithm: "LAGRANGE"` with degree 5 — Cesium smoothly interpolates
  between your sample points rather than stepping

---

## Coordinate Frame Handling

CesiumJS internally uses ICRF (International Celestial Reference Frame) which is
effectively the same as ECI for satellite work. When you set `referenceFrame: "INERTIAL"`,
Cesium automatically applies the correct Earth rotation to render the satellite over
the right point on the ground.

**Do not convert ECI → ECEF yourself before passing to CesiumJS.** You'll get the wrong
answer unless your GAST (Greenwich Apparent Sidereal Time) conversion is exactly right.
Let Cesium do it.

If you ever need ECEF positions in JavaScript (e.g. for ground track computation):
```javascript
const matrix = Cesium.Transforms.computeIcrfToFixedMatrix(julianDate);
const ecefPos = Cesium.Matrix3.multiplyByVector(matrix, eciPos, new Cesium.Cartesian3());
```

---

## Time in CesiumJS

CesiumJS has its own `JulianDate` type:

```javascript
// From ISO string
const t = Cesium.JulianDate.fromIso8601("2024-01-01T00:00:00Z");

// From JavaScript Date
const t = Cesium.JulianDate.fromDate(new Date());

// Convert to ISO string
const iso = Cesium.JulianDate.toIso8601(t);
```

The CZML `epoch` field must be an ISO 8601 string. The `cartesian` array offsets are
in **seconds** from that epoch.

---

## Setup with Vite

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

`vite-plugin-cesium` handles the Cesium asset copying and worker configuration that
would otherwise require significant manual setup.

---

## Cesium Ion

CesiumJS uses Cesium Ion for imagery and terrain data. The free tier is sufficient for
this project. You need an access token:

```javascript
Cesium.Ion.defaultAccessToken = 'your_token_here';
```

Get a free token at: https://ion.cesium.com
