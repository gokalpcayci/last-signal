# Lostronomy visual style: effects reference

A shared vocabulary for directing any section of the app, the demo video or the brand.
Every effect below exists in the code already. Point at it by name.

**The one-line style:** *a weak signal from an old mission-control display.* It looks like
real hardware: dark, monochrome, pixel-grid, slightly imperfect, never flashy.

---

## 1. Ground rules

| Rule | Why |
|---|---|
| **Dark first.** Void `#0D0E0D` background, Graphite `#141513` panels, Regolith `#E6E6DF` ink, Dust `#6E706A` secondary text. | Mission-control screens are dark; the Moon is grey. |
| **Green `#5FD068` = still active, Orange `#E56B47` = gone silent.** Only for status, never decoration. | The whole app reads these as signal states. |
| **One effect per surface.** A panel can glitch *or* sparkle *or* be textured, not all three. | Restraint is what makes it look real, not like a filter. |
| **Subtle beats loud.** Small, short, rare. A glitch is 1 pixel for 50–110 ms, every few seconds at most. | Real hardware faults are tiny and irregular. Big regular effects look like a video template. |
| **No rings, sweeps or radar.** | Tried and rejected: it reads as a cliché. |
| **No rounded "app tile" boxes around the logo.** | The mark always stands on its own. |
| **Respect reduced motion.** Every animation must fall back to a still frame. | Accessibility; already built into the LED engine. |
| **Type:** Inter 600 tracked for titles; JetBrains Mono for labels, coordinates, counters, `[BRACKETED]` states. | The mono labels are half of the mission-control look. |

---

## 2. The mark

A **mirror-symmetric inkblot** (Rorschach-style): a central egg, two winged lobes, and a
shrinking stack of drops below. "Everyone sees something different — look closer."
It's built from overlapping ovals melted together (a *smooth union*), so the joins
have small rounded fillets like real ink. → `scripts/build_brand.py`

---

### On the map: markers

Every hardware marker is the **flat mark**, tinted by status (green still working, orange silent,
Regolith white when selected), scaled up on hover. No box or tile behind it. Static: no idle animation.
Laser beams only appear on the selected mirror. → `.marker__ink` in `src/index.css`

## 3. Static surface finishes

Use these for still images: posters, slides, video frames, section backgrounds.
All live in `public/brand/variants/` (see the brand sheet, §08, at `/brand/index.html`).

| Name | What it looks like | How it works | Good for |
|---|---|---|---|
| **Printed ink** | Like a fine print on paper: soft light from the top, a darker inked rim, fine film grain. | Gradient shading + an edge band (sharp shape minus a blurred copy) + `feTurbulence` noise. | Primary still logo. |
| **Flat** | One solid colour. | Plain fill. | Anything under ~48 px, single-colour print. |
| **Halftone** | Newspaper dot screen at 45°, dots swell toward the middle of each lobe. | Dot size driven by *depth*: how far inside the shape a point is. | Posters, merch. |
| **Topographic** | Contour lines following the shape inward, like an elevation map. | The outline traced again at steps inward. | Data slides; matches the terrain view. |
| **Engraved** | Banknote-style horizontal rules that thin toward the bottom. | Clipped line pattern with a fade mask. | Certificates, stamps. |
| **Regolith** | Bumpy moon-rock surface lit from the top-left. | Noise used as a height map + lighting filter. | Hero images, video intro. |
| **Risograph** | A gold layer printed slightly off-target under grainy ink. | Two offset copies, noise punches holes in the ink. | Stickers, zines. |
| **Stipple** | Scattered pen dots, dense in the middle, sparse at the edges, like moon dust. | Random dots, density driven by depth. | Backgrounds. |
| **LED matrix** ⭐ | A grid of rounded square LEDs, brighter at the core. | Grid sampled from the shape; brightness by depth. | **The chosen logo.** Anything "live". |

**"Depth"** is the key idea behind most of these: every point knows how far inside the
shape it is, so textures can be denser or brighter at the core and fade at the edges.

---

## 4. The LED display (the house style for anything live)

The animated logo is a canvas engine: `src/brand/ledEngine.ts`, React wrapper
`src/ui/LedLogo.tsx`, playground at `/logo.html`. Its ingredients are reusable
words for any section:

| Ingredient | What it looks like |
|---|---|
| **Ghost LEDs** | Unlit pixels stay faintly visible (~7% brightness), so you can see the grid and the shape before anything lights up. |
| **Depth brightness** | Core pixels are brighter than edge pixels, so the shape has volume even in one colour. |
| **Bloom** | Pixels that just lit up get a soft halo for a split second. |
| **Flicker-in** | A pixel stutters on/off 2–3 times before it settles, like old hardware warming up. |
| **Signal blink** | Now and then one pixel blinks **green** three times: a device that is still transmitting. |

### Motion modes (the order pixels are reached)

| Mode | Feel |
|---|---|
| **Random** ⭐ | Pixels light up at random across the whole shape. Default. |
| **Boot-up** | Core first, then outward, with randomness: powering up. Its exit dies from the edges inward. |
| **Scanline** | Top to bottom, like a telemetry download. |

### Phases (how a mode is played)

| Phase | Use it for |
|---|---|
| **Entrance** | First appearance: pixels flicker on in the mode's order, each with a flash. |
| **Loop** | Active state: the shape stays readable while ~30% of pixels flare and fade each cycle ("data activity"). |
| **Ambient** | Always-on UI: the same, but slower and lower contrast so it doesn't steal attention. |
| **Exit** | Disappearing: a small signal tear, then pixels flash and die in order. |
| **Still / Off** | Static fully lit / all ghost. |
| **Flash** | One-off sparkle across the shape, e.g. on hover. |

---

## 5. Glitches (signal faults)

Layered on top of any mode. Default strength is deliberately subtle; intensity 0–2.

| Glitch | What happens | Default size |
|---|---|---|
| **Tear** | A band of rows jumps sideways. | 1–2 rows, 1 pixel, 50–110 ms |
| **Static** | A band of rows softly flickers in brightness. | 1–2 rows |
| **Split** | Faint green/orange copies offset to either side (chromatic aberration). | ~90 ms, low opacity |
| **Brownout** | The whole display dips in brightness. | to ~65%, 120 ms |
| **Dead pixels** | A few LEDs stutter dim; a different few every few seconds. | ~0.4% of pixels |
| **Burst** | A glitch occasionally triggers one immediate follow-up. | 20% chance, max 1 |

Timing: in a loop every 2–6 s, in ambient every 6–13 s (tears and static only).
Signature moments: a small split right as the entrance completes ("signal acquired"),
a tear right before an exit ("signal breaking up").

---

## 6. How to give direction (copy-paste phrases)

- *"Use the LED display style: ghost LEDs, depth brightness, random flicker-in entrance, ambient loop."*
- *"Add subtle signal glitches: tears and static only, intensity 0.5."*
- *"Status pixel: green signal blink when the object is still active, orange when silent."*
- *"Panel background in stipple / topographic texture at low opacity."*
- *"Boot-up entrance for the stats panel: core numbers first, then outward."*
- *"Scanline reveal for the story text, like a telemetry download."*
- *"Printed-ink finish for still frames in the video."*
- **Avoid:** radar sweeps, expanding rings, neon glow, rounded tiles around the logo, big or rhythmic glitches, colour used as decoration.
