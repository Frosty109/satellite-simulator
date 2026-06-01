import type { OrbitalState } from './propagator-bridge';

export function buildCzml(name: string, states: OrbitalState[]): object[] {
    const positions: number[] = [];

    const startEpoch = states[0].epoch;
    const endEpoch   = states[states.length - 1].epoch;

    for (const s of states) {
        const t = (s.epoch - startEpoch) * 86400; // seconds relative to propagation start
        positions.push(t, s.x * 1000, s.y * 1000, s.z * 1000); // km to metres for CesiumJS
    }

    function jdToIso(jd: number): string {
        const ms = (jd - 2440587.5) * 86400000; // JD to Unix milliseconds
        return new Date(ms).toISOString();
    }

    const interval = `${jdToIso(startEpoch)}/${jdToIso(endEpoch)}`;

    return [
        {
            id: 'document',
            name,
            version: '1.0',
            clock: {
                interval,
                currentTime: jdToIso(startEpoch),
                multiplier: 60,
            },
        },
        {
            id: 'satellite',
            name,
            availability: interval,
            position: {
                referenceFrame: 'INERTIAL',
                epoch: jdToIso(startEpoch),
                cartesian: positions,
            },
            point: {
                pixelSize: 8,
                color: { rgba: [255, 255, 0, 255] },
            },
            label: {
                text: name,
                font: '14px sans-serif',
                fillColor: { rgba: [255, 255, 255, 255] },
                pixelOffset: { cartesian2: [12, 0] },
            },
        },
    ];
}
