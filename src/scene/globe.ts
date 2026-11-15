/**
 * Globe view (after Uygar Yıldırım's Offworld Archive): the whole Moon or Mars as a
 * rotatable sphere, drawn in our own look — elevation-ranked muted ramp, screen-space
 * halftone dots lit by the real Sun, a hairline graticule and faint contours.
 *
 * Data: NASA Trek global maps bundled by Offworld Archive (public/globe/):
 *   *-height.png  LOLA / MOLA elevation, 8-bit normalized, equirectangular −180…180°
 *   *-color.jpg   LRO WAC / Viking mosaic, used only as brightness (albedo)
 *
 * Convention: dir(lat, lon) = (cos lat · sin lon, sin lat, cos lat · cos lon), so lon 0 faces +z
 * and east is +x when seen from outside.
 */
import * as THREE from 'three'
import { PLANETS, type PlanetId } from './planets'

/** Globe radius, world units */
export const GLOBE_R = 20

interface GlobeCfg {
  /** Radial relief per unit of normalized height (fraction of the radius) */
  relief: number
  /** Same at true scale: total elevation range / planet radius */
  trueRelief: number
  /** Where the camera looks first */
  home: { lat: number; lon: number }
  /** Night side tint (Moon: Earthshine blue; Mars: plain dim) */
  night: [number, number, number]
}

export const GLOBES: Record<PlanetId, GlobeCfg> = {
  // LOLA range −9.1 … +10.8 km = 19.9 km over 1737 km
  moon: { relief: 0.034, trueRelief: 19.9 / 1737.4, home: { lat: 8, lon: -8 }, night: [0.5, 0.56, 0.72] },
  // MOLA range −8.2 … +21.2 km = 29.4 km over 3396 km
  mars: { relief: 0.043, trueRelief: 29.4 / 3396, home: { lat: 16, lon: 118 }, night: [0.52, 0.5, 0.55] },
}

/** Rounded vertical exaggeration shown on the toolbar (×N) */
export const globeExaggeration = (p: PlanetId) => Math.round(GLOBES[p].relief / GLOBES[p].trueRelief)

export function dirOf(lat: number, lon: number, out = new THREE.Vector3()) {
  const la = THREE.MathUtils.degToRad(lat), lo = THREE.MathUtils.degToRad(lon)
  return out.set(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo))
}

interface Raster { w: number; h: number; px: Uint8ClampedArray }

async function raster(url: string): Promise<Raster> {
  const im = new Image()
  im.src = url
  await im.decode()
  const cv = document.createElement('canvas')
  cv.width = im.naturalWidth
  cv.height = im.naturalHeight
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2D canvas unavailable')
  ctx.drawImage(im, 0, 0)
  return { w: cv.width, h: cv.height, px: ctx.getImageData(0, 0, cv.width, cv.height).data }
}

/** Bilinear sample 0…1 at lat/lon (R channel; wraps in longitude) */
function sample(r: Raster, lat: number, lon: number) {
  const x = ((lon + 180) / 360) * r.w - 0.5
  const y = THREE.MathUtils.clamp(((90 - lat) / 180) * r.h - 0.5, 0, r.h - 1)
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const fx = x - x0, fy = y - y0
  const y1 = Math.min(r.h - 1, y0 + 1)
  const at = (xx: number, yy: number) => r.px[(yy * r.w + (((xx % r.w) + r.w) % r.w)) * 4] / 255
  const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx
  const bot = at(x0, y1) * (1 - fx) + at(x0 + 1, y1) * fx
  return top * (1 - fy) + bot * fy
}

export interface GlobeData {
  planet: PlanetId
  /** Normalized height minus the median (≈ −0.4 … +0.6) at lat/lon */
  heightAt: (lat: number, lon: number) => number
  geometry: () => THREE.BufferGeometry
}

const cache = new Map<PlanetId, Promise<GlobeData>>()

export function loadGlobe(planet: PlanetId): Promise<GlobeData> {
  let p = cache.get(planet)
  if (!p) {
    p = Promise.all([raster(`/globe/${planet}-height.png`), raster(`/globe/${planet}-color.jpg`)]).then(([hgt, col]) => {
      // median height (coarse grid is plenty) so relief pushes both out and in around R
      const probe: number[] = []
      for (let la = -88; la <= 88; la += 2) for (let lo = -180; lo < 180; lo += 2) probe.push(sample(hgt, la, lo))
      probe.sort((a, b) => a - b)
      const mid = probe[probe.length >> 1]
      const heightAt = (lat: number, lon: number) => sample(hgt, lat, lon) - mid
      return { planet, heightAt, geometry: () => buildGeometry(planet, hgt, col, mid) }
    })
    cache.set(planet, p)
    p.catch(() => cache.delete(planet))
  }
  return p
}

// same muted ramp logic as the diorama (terrain.ts rampAt): colour by elevation *rank*
function rampAt(ramp: [number, THREE.Color][], t: number, out: THREE.Color) {
  let k = 1
  while (k < ramp.length - 1 && t > ramp[k][0]) k++
  const [t0, c0] = ramp[k - 1], [t1, c1] = ramp[k]
  return out.copy(c0).lerp(c1, THREE.MathUtils.smoothstep(t, t0, t1))
}

function buildGeometry(planet: PlanetId, hgt: Raster, col: Raster, mid: number) {
  const P = PLANETS[planet]
  const ramp = P.ramp.map(([t, hex]) => [t, new THREE.Color(hex)] as [number, THREE.Color])
  const g = new THREE.SphereGeometry(1, 512, 256)
  const pos = g.attributes.position as THREE.BufferAttribute
  const n = pos.count
  const h = new Float32Array(n)
  const alb = new Float32Array(n)
  const v = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    const lat = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(v.y, -1, 1)))
    const lon = THREE.MathUtils.radToDeg(Math.atan2(v.x, v.z))
    pos.setXYZ(i, v.x, v.y, v.z) // unit direction; the vertex shader applies radius + relief
    h[i] = sample(hgt, lat, lon) - mid
    alb[i] = sample(col, lat, lon)
  }
  // rank + albedo stretch (5th–95th percentile), like the diorama
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => h[a] - h[b])
  const rank = new Float32Array(n)
  idx.forEach((k, r) => { rank[k] = r / (n - 1) })
  const sa = Array.from(alb).sort((a, b) => a - b)
  const aLo = sa[Math.floor(n * 0.05)], aHi = sa[Math.floor(n * 0.95)]
  const colors = new Float32Array(n * 3)
  const c = new THREE.Color()
  for (let i = 0; i < n; i++) {
    rampAt(ramp, rank[i], c)
    const a = THREE.MathUtils.clamp((alb[i] - aLo) / Math.max(aHi - aLo, 1e-3), 0, 1)
    c.multiplyScalar(0.62 + 0.55 * a)
    colors.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.setAttribute('aH', new THREE.BufferAttribute(h, 1))
  // Smooth relief normals at the exaggerated scale (facet normals from derivatives showed every
  // triangle up close). The shader scales their tilt with the live relief, so true scale flattens them.
  const relief = GLOBES[planet].relief
  const unit = Float32Array.from(pos.array as Float32Array)
  for (let i = 0; i < n; i++) {
    const k = 1 + h[i] * relief
    pos.setXYZ(i, unit[i * 3] * k, unit[i * 3 + 1] * k, unit[i * 3 + 2] * k)
  }
  g.computeVertexNormals()
  pos.copyArray(unit)
  pos.needsUpdate = true
  return g
}

export function makeGlobeMaterial(planet: PlanetId, bgHex: string) {
  const bg = new THREE.Color(bgHex).convertLinearToSRGB()
  const cfg = GLOBES[planet]
  return new THREE.ShaderMaterial({
    uniforms: {
      uR: { value: GLOBE_R },
      uRelief: { value: cfg.relief },
      uFill: { value: bg },
      uSun: { value: new THREE.Vector3(0, 0, 1) },
      uHome: { value: dirOf(cfg.home.lat, cfg.home.lon) },
      uReveal: { value: Math.PI },     // angle (rad) from the home point revealed so far
      uPx: { value: 1 },               // device pixel ratio: halftone pitch stays ~5 css px
      uNight: { value: new THREE.Vector3(...cfg.night) },
      uSel: { value: new THREE.Vector3() },
      uSelOn: { value: 0 },
      uRelief0: { value: cfg.relief },  // relief the normals were built at
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float aH;
      uniform float uR;
      uniform float uRelief;
      uniform float uRelief0;
      varying vec3 vColor;
      varying vec3 vN;
      varying vec3 vWorld;
      varying float vH;
      void main() {
        vColor = color;
        vH = aH;
        vN = position + (normal - position) * (uRelief / uRelief0); // tilt follows the live relief
        vec3 p = position * uR * (1.0 + aH * uRelief);
        vWorld = p; // the globe sits at the origin
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uFill;
      uniform vec3 uSun;
      uniform vec3 uHome;
      uniform float uReveal;
      uniform float uPx;
      uniform vec3 uNight;
      uniform vec3 uSel;
      uniform float uSelOn;
      varying vec3 vColor;
      varying vec3 vWorld;
      varying float vH;
      varying vec3 vN;

      float hair(float v, float w, float widthPx) {
        return 1.0 - smoothstep(widthPx - 0.5, widthPx + 0.5, abs(v) / max(w, 1e-4));
      }
      // distance to the nearest multiple of 1, in px (w = fwidth of v)
      float gridLine(float v, float w, float widthPx) {
        return hair(abs(fract(v - 0.5) - 0.5), w, widthPx);
      }

      void main() {
        vec3 dir = normalize(vWorld);

        // ── boot reveal: a cap grows out from the home point ──
        float ang = acos(clamp(dot(dir, uHome), -1.0, 1.0));
        if (ang > uReveal) discard;
        float ring = exp(-abs(uReveal - ang) * 40.0) * step(uReveal, 3.1);

        float lat = degrees(asin(clamp(dir.y, -1.0, 1.0)));
        float lon = degrees(atan(dir.x, dir.z));
        // fwidth jumps by 360° across the ±180° seam: take the derivative of a shifted copy there
        float wLon = min(fwidth(lon), fwidth(mod(lon + 360.0, 360.0)));
        float wLat = fwidth(lat);

        // ── light: real Sun (sub-solar point on the equator) on the day side, a soft
        //    map light from the upper left of the view on the night side ──
        float sunDot = dot(dir, uSun);
        float day = smoothstep(-0.02, 0.09, sunDot);
        vec3 nrm = normalize(vN);
        vec3 toCam = normalize(cameraPosition);
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
        vec3 mapL = normalize(toCam + vec3(0.0, 0.7, 0.0) - right * 0.6);
        vec3 L = normalize(mix(mapL, uSun, day));
        // relief only: compare the facet with the smooth sphere under it (0.5 = flat)
        float light = clamp(0.5 + (dot(nrm, L) - dot(dir, L)) * 4.0, 0.0, 1.0);

        // ── halftone: a 45° screen-space dot screen (~5 css px), like a print plate the
        //    planet turns under; dot area follows the relief light ──
        vec2 hv = mat2(0.7071, -0.7071, 0.7071, 0.7071) * (gl_FragCoord.xy / (5.0 * uPx));
        float aa = 0.08;
        float rad = 0.5 * sqrt(light);
        float dotm = 1.0 - smoothstep(rad - aa, rad + aa, length(fract(hv) - 0.5));
        vec3 ground = vColor * (0.08 + 0.9 * dotm);

        // ── graticule every 15° (brighter every 45°); meridians thin out near the poles ──
        float gLat = gridLine(lat / 15.0, wLat / 15.0, 0.55);
        float gLon = gridLine(lon / 15.0, wLon / 15.0, 0.55) * smoothstep(80.0, 70.0, abs(lat));
        float mLat = gridLine(lat / 45.0, wLat / 45.0, 0.8);
        float mLon = gridLine(lon / 45.0, wLon / 45.0, 0.8) * smoothstep(84.0, 76.0, abs(lat));
        float grid = max(max(gLat, gLon) * 0.55, max(mLat, mLon));
        vec3 lines = vColor * grid * 1.5 * mix(0.5, 1.15, light);

        // faint contours (a nod to Offworld Archive's elevation atlas)
        float cont = gridLine(vH * 18.0, fwidth(vH * 18.0), 0.5) * 0.16;
        vec3 lit = ground + lines + vec3(0.85, 0.82, 0.7) * cont;

        lit *= mix(uNight, vec3(1.0), day);
        vec3 col = uFill + lit;

        // equator: one dashed gold hairline, like the dashboard's dashed rules
        float eq = hair(lat, wLat, 0.6) * step(0.5, fract(lon / 3.0));
        col += vec3(0.79, 0.66, 0.35) * eq * 0.35;

        // selected site: a surveyor ring laid on the surface
        if (uSelOn > 0.001) {
          float a = degrees(acos(clamp(dot(dir, uSel), -1.0, 1.0)));
          float wa = fwidth(a);
          float circle = hair(a - 2.4, wa, 0.7) + hair(a - 4.2, wa, 0.5) * 0.45;
          col = mix(col, vec3(0.93, 0.93, 0.9), clamp(circle, 0.0, 1.0) * uSelOn);
        }

        col += vec3(0.55, 0.85, 0.6) * ring * 0.6;

        // limb: melt into the background where the line of sight skims the sphere
        float graze = dot(dir, normalize(cameraPosition - vWorld));
        col = mix(uFill, col, smoothstep(0.0, 0.22, graze));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
}
