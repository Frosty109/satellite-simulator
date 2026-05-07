import PropagatorModule from '../../wasm/propagator.js';

export interface OrbitalState {
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    epoch: number; // Julian date
}

// Each OrbitalState is 7 doubles = 56 bytes
const STATE_BYTES = 7 * 8;

let mod: Awaited<ReturnType<typeof PropagatorModule>> | null = null;

async function getModule() {
    if (!mod) mod = await PropagatorModule();
    return mod;
}

export async function propagateTle(
    line1: string,
    line2: string,
    startJd: number,
    endJd: number,
    stepSeconds: number
): Promise<OrbitalState[]> {
    const m = await getModule();

    const propagate  = m.cwrap('propagate_tle', 'number', ['string', 'string', 'number', 'number', 'number']);
    const getCount   = m.cwrap('get_state_count', 'number', []);
    const freeStates = m.cwrap('free_states', null, []);

    const ptr   = propagate(line1, line2, startJd, endJd, stepSeconds) as number;
    const count = getCount() as number;

    const states: OrbitalState[] = [];

    if (ptr !== 0 && count > 0) {
        const heap = m.HEAPF64;
        for (let i = 0; i < count; i++) {
            const byteOffset = ptr + i * STATE_BYTES;
            const base = byteOffset / 8; // HEAPF64 indexed in 8-byte units
            states.push({
                x:     heap[base + 0],
                y:     heap[base + 1],
                z:     heap[base + 2],
                vx:    heap[base + 3],
                vy:    heap[base + 4],
                vz:    heap[base + 5],
                epoch: heap[base + 6],
            });
        }
    }

    freeStates();
    return states;
}