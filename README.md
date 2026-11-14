# Lostronomy — NASA Hackathon: Abandoned but not Forgotten

> A mission-control style web app that tells the story of the hardware NASA left behind — starting on the Moon.

## Challenge
Tell the story of NASA hardware left on the Moon, Mars, and in deep space
(rovers, instruments, probes) to school-age space enthusiasts — the hardware
and the science it made possible.

## Concept
A dark "mission control" dashboard over a 3D wireframe terrain built from real
lunar elevation data. Markers show hardware left on the surface:

- **Green** — still useful / still working (e.g. Apollo laser retroreflectors)
- **Orange** — silent / retired (landers, rovers, ALSEP stations)

Click a marker → camera flies there → a panel tells the hardware's story in
kid-friendly language with a real mission-control feel.

## Phases
1. **Moon** (current) — terrain, markers, story panels, dashboard stats
2. **Mars** — rovers & landers (Spirit, Opportunity, Curiosity, Perseverance…)
3. **Deep Space** — Voyager, Pioneer, New Horizons
4. **Demo video** — recorded from the finished app

## UI mapping (from reference design)
| Reference | Lostronomy |
|---|---|
| Wireframe terrain | Lunar DEM (LRO LOLA) as displaced wireframe mesh, elevation-colored |
| ✅ / ⚠ markers | Active / silent hardware |
| Left nav | `[WORLD]` · ERA · MISSIONS · STATUS · SURFACE VIEW |
| Top-right stat + globe | Objects left behind + rotating Moon globe |
| Activity bar chart | Hardware left per year |
| Stable / Critical zones | Still active / Gone silent |
| "Unstable connection" | "Last signal received: <date>" |

## Tech
- Vite + React + TypeScript (bun)
- three.js via @react-three/fiber + @react-three/drei
- Static `src/data/hardware.json` as the single content source

## Run
```bash
bun install
bun run dev
```
