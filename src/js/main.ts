import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { propagateTle } from './propagator-bridge';
import { buildCzml } from './czml-builder';

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;

const viewer = new Cesium.Viewer('cesium-container', {
    terrain: Cesium.Terrain.fromWorldTerrain(),
});

// WASM check
const ISS_TLE_LINE1 = '1 25544U 98067A   24087.54791435  .00016717  00000-0  10270-3 0  9993';
const ISS_TLE_LINE2 = '2 25544  51.6413 239.7028 0002068  25.4894 334.6418 15.50264527445494';

const now = Date.now() / 86400000 + 2440587.5; 

const states = await propagateTle(ISS_TLE_LINE1, ISS_TLE_LINE2, now, now + 1, 60);

console.log(`Sate count: ${states.length}`);

const first = states[0]
const posMag = Math.sqrt(first.x ** 2 + first.y ** 2 + first.z ** 2);
const velMag = Math.sqrt(first.vx ** 2 + first.vy ** 2 + first.vz ** 2);

console.log(`Position magnitude: ${posMag.toFixed(1)} km (expect ~6778)`);
console.log(`Velocity magnitude: ${velMag.toFixed(3)} km/s (expect ~7.66)`);
console.log(`Epoch of first state (JD): ${first.epoch}`);
console.log(`Epoch of last state (JD):  ${states[states.length - 1] .epoch}`);

const czml = buildCzml('ISS', states);
const ds = await viewer.dataSources.add(Cesium.CzmlDataSource.load(czml));
console.log('Entities loaded:', ds.entities.values.length);
console.log('First entity:', ds.entities.values[0]?.id);
viewer.zoomTo(ds);
