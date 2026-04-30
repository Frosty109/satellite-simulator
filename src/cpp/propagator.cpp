#include <vector>
#include <cstring>
#include "SGP4.h"

struct OrbitalState
{
    double x, y, z;
    double vx, vy, vz;
    double epoch;
};

static std::vector<OrbitalState> g_states;

extern "C"
{
    OrbitalState* propagate_tle (
        const char* line1,
        const char* line2,
        double start_jd,
        double end_jd,
        double step_seconds
    )
    {
        g_states.clear();

        char l1[130], l2[130];
        strncpy(l1, line1, 130);
        strncpy(l2, line2, 130);

        elsetrec satrec;
        double startmfe, stopmfe, deltamin;
        SGP4Funcs::twoline2rv(l1, l2, 'c', 'e', 'i', wgs84, startmfe, stopmfe, deltamin, satrec);

        double step_minutes = step_seconds / 60.0;
        double duration_minutes = (end_jd - start_jd) * 1440.0;

        for (double t = 0.0; t <= duration_minutes; t += step_minutes) {
            double jd = start_jd + t / 1440.0;
            double tsince = (jd - satrec.jdsatepoch) * 1440.0;

            double r[3], v[3];
            SGP4Funcs::sgp4(satrec, tsince, r, v);

            if (satrec.error == 0) {
                OrbitalState s;
                s.x = r[0]; s.y = r[1]; s.z = r[2];
                s.vx = v[0]; s.vy = v[1]; s.vz = v[2];
                s.epoch = jd;
                g_states.push_back(s);
            }
        }

        return g_states.empty() ? nullptr : g_states.data();
    }

    int get_state_count() {
        return static_cast<int>(g_states.size());
    }

    void free_states() {
        g_states.clear();
        g_states.shrink_to_fit();
    }
} // Extern C End