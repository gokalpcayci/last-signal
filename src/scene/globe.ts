/**
 * Globe view (after Uygar Yıldırım's Offworld Archive): the whole Moon or Mars as a
 * rotatable sphere, drawn in our own look — elevation-ranked muted ramp, screen-space
 * halftone dots lit by the real Sun, a hairline graticule and faint contours.
 *
 * Data (public/globe/):
 *   *-height.webp  LOLA / MOLA elevation, 4096×2048, 11-bit (scripts/build_globe_maps.py)
 *   moon-color.jpg LRO WAC mosaic, 4096×2048 (NASA SVS CGI Moon Kit; the Moon's real colours)
 *   mars-color.jpg Viking mosaic via NASA Trek (Offworld Archive), used only as brightness
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
  /** Paint with the mosaic's own colours (the real grey Moon) instead of the elevation ramp */
  natural?: boolean
  /** Close-up detail below the map resolution: crater depth, roughness, colour mottling */
  detail: [number, number, number]
}

export const GLOBES: Record<PlanetId, GlobeCfg> = {
  // LOLA range −9.04 … +10.63 km = 19.7 km over 1737 km (public/globe/moon-height.json)
  moon: { relief: 0.034, trueRelief: 19.7 / 1737.4, home: { lat: 8, lon: -8 }, night: [0.56, 0.57, 0.6], natural: true, detail: [0.75, 0.25, 0.15] },
  // MOLA range −8.16 … +21.16 km = 29.3 km over 3396 km (public/globe/mars-height.json)
  mars: { relief: 0.043, trueRelief: 29.3 / 3396, home: { lat: 16, lon: 118 }, night: [0.52, 0.5, 0.55], detail: [0.6, 0.6, 0.12] },
}

/** Rounded vertical exaggeration shown on the toolbar (×N) */
export const globeExaggeration = (p: PlanetId) => Math.round(GLOBES[p].relief / GLOBES[p].trueRelief)

export function dirOf(lat: number, lon: number, out = new THREE.Vector3()) {
  const la = THREE.MathUtils.degToRad(lat), lo = THREE.MathUtils.degToRad(lon)
  return out.set(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo))
}

/** A map on the CPU: px[(y·w + x)·stride + channel] · scale = 0…1, row 0 = north */
interface Raster { w: number; h: number; px: ArrayLike<number>; stride: number; scale: number }

async function raster(url: string) {
  const im = new Image()
  im.src = url
  await im.decode()
  const cv = document.createElement('canvas')
  cv.width = im.naturalWidth
  cv.height = im.naturalHeight
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2D canvas unavailable')
  ctx.drawImage(im, 0, 0)
  const px = ctx.getImageData(0, 0, cv.width, cv.height).data
  return { raster: { w: cv.width, h: cv.height, px, stride: 4, scale: 1 / 255 } as Raster, img: im }
}

/**
 * Height map: a lossless WebP holding 16-bit values as R = high byte, G = low byte
 * (scripts/build_globe_maps.py). Decoded without colour conversion so the bytes stay exact.
 */
async function heightRaster(url: string): Promise<Raster> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })
  const cv = document.createElement('canvas')
  cv.width = bmp.width
  cv.height = bmp.height
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2D canvas unavailable')
  ctx.drawImage(bmp, 0, 0)
  bmp.close()
  const rgba = ctx.getImageData(0, 0, cv.width, cv.height).data
  const q = new Uint16Array(cv.width * cv.height)
  for (let i = 0; i < q.length; i++) q[i] = (rgba[i * 4] << 8) | rgba[i * 4 + 1]
  return { w: cv.width, h: cv.height, px: q, stride: 1, scale: 1 / 65535 }
}

/**
 * GPU copy of the height map as half floats (8-bit textures terraced the relief up close).
 * Mipmaps are built here: WebGL can't generate them for a half-float texture everywhere.
 */
function heightTexture(r: Raster) {
  const toHalf = THREE.DataUtils.toHalfFloat
  // rows flipped: texture v = 0 is the south edge, like the image textures
  let w = r.w, h = r.h
  let lvl = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w
    for (let x = 0; x < w; x++) lvl[y * w + x] = r.px[src + x] * r.scale
  }
  const mipmaps: { data: Uint16Array; width: number; height: number }[] = []
  for (;;) {
    mipmaps.push({ data: Uint16Array.from(lvl, toHalf), width: w, height: h })
    if (w === 1 && h === 1) break
    const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1)
    const next = new Float32Array(nw * nh)
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const x0 = Math.min(w - 1, x * 2), x1 = Math.min(w - 1, x * 2 + 1)
      const y0 = Math.min(h - 1, y * 2), y1 = Math.min(h - 1, y * 2 + 1)
      next[y * nw + x] = (lvl[y0 * w + x0] + lvl[y0 * w + x1] + lvl[y1 * w + x0] + lvl[y1 * w + x1]) / 4
    }
    lvl = next; w = nw; h = nh
  }
  const t = new THREE.DataTexture(mipmaps[0].data, r.w, r.h, THREE.RedFormat, THREE.HalfFloatType)
  t.mipmaps = mipmaps as unknown as THREE.DataTexture['mipmaps']
  t.generateMipmaps = false
  t.unpackAlignment = 2
  t.colorSpace = THREE.NoColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.needsUpdate = true
  return t
}

/** GPU copy of a colour map, sampled per pixel in the shader (raw values: the shader writes raw output) */
function texture(img: HTMLImageElement) {
  const t = new THREE.Texture(img)
  t.colorSpace = THREE.NoColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

/** Bilinear sample 0…1 at lat/lon (channel 0 = R; wraps in longitude) */
function sample(r: Raster, lat: number, lon: number, ch = 0) {
  const x = ((lon + 180) / 360) * r.w - 0.5
  const y = THREE.MathUtils.clamp(((90 - lat) / 180) * r.h - 0.5, 0, r.h - 1)
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const fx = x - x0, fy = y - y0
  const y1 = Math.min(r.h - 1, y0 + 1)
  const at = (xx: number, yy: number) => r.px[(yy * r.w + (((xx % r.w) + r.w) % r.w)) * r.stride + ch] * r.scale
  const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx
  const bot = at(x0, y1) * (1 - fx) + at(x0 + 1, y1) * fx
  return top * (1 - fy) + bot * fy
}

export interface GlobeData {
  planet: PlanetId
  /** Normalized height minus the median (≈ −0.4 … +0.6) at lat/lon */
  heightAt: (lat: number, lon: number) => number
  geometry: () => THREE.BufferGeometry
  /** Height + colour maps for the per-pixel shading, and the albedo stretch (5th–95th pct) */
  heightTex: THREE.Texture
  colorTex: THREE.Texture
  heightSize: THREE.Vector2
  albedo: [number, number]
}

const cache = new Map<PlanetId, Promise<GlobeData>>()

export function loadGlobe(planet: PlanetId): Promise<GlobeData> {
  let p = cache.get(planet)
  if (!p) {
    p = Promise.all([heightRaster(`/globe/${planet}-height.webp`), raster(`/globe/${planet}-color.jpg`)]).then(([hgt, { raster: col, img }]) => {
      // median height (coarse grid is plenty) so relief pushes both out and in around R
      const probe: number[] = []
      for (let la = -88; la <= 88; la += 2) for (let lo = -180; lo < 180; lo += 2) probe.push(sample(hgt, la, lo))
      probe.sort((a, b) => a - b)
      const mid = probe[probe.length >> 1]
      const heightAt = (lat: number, lon: number) => sample(hgt, lat, lon) - mid
      const alb: number[] = []
      for (let la = -88; la <= 88; la += 1) for (let lo = -180; lo < 180; lo += 1) alb.push(sample(col, la, lo))
      alb.sort((a, b) => a - b)
      return {
        planet, heightAt,
        geometry: () => buildGeometry(planet, hgt, mid),
        heightTex: heightTexture(hgt),
        colorTex: texture(img),
        heightSize: new THREE.Vector2(hgt.w, hgt.h),
        albedo: [alb[Math.floor(alb.length * 0.05)], alb[Math.floor(alb.length * 0.95)]],
      }
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

function buildGeometry(planet: PlanetId, hgt: Raster, mid: number) {
  const P = PLANETS[planet]
  const ramp = P.ramp.map(([t, hex]) => [t, new THREE.Color(hex)] as [number, THREE.Color])
  const g = new THREE.SphereGeometry(1, 512, 256)
  const pos = g.attributes.position as THREE.BufferAttribute
  const n = pos.count
  const h = new Float32Array(n)
  const v = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    const lat = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(v.y, -1, 1)))
    const lon = THREE.MathUtils.radToDeg(Math.atan2(v.x, v.z))
    pos.setXYZ(i, v.x, v.y, v.z) // unit direction; the vertex shader applies radius + relief
    h[i] = sample(hgt, lat, lon) - mid
  }
  // elevation-rank ramp colour per vertex (Mars); the natural Moon takes its colour from the map
  const colors = new Float32Array(n * 3).fill(1)
  if (!GLOBES[planet].natural) {
    const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => h[a] - h[b])
    const c = new THREE.Color()
    idx.forEach((k, r) => { rampAt(ramp, r / (n - 1), c); colors.set([c.r, c.g, c.b], k * 3) })
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.setAttribute('aH', new THREE.BufferAttribute(h, 1))
  return g
}

export function makeGlobeMaterial(planet: PlanetId, bgHex: string) {
  const bg = new THREE.Color(bgHex).convertLinearToSRGB()
  const cfg = GLOBES[planet]
  return new THREE.ShaderMaterial({
    uniforms: {
      uR: { value: GLOBE_R },
      uRelief: { value: cfg.relief },
      uRelief0: { value: cfg.relief },  // exaggerated relief: close-up detail scales with uRelief / uRelief0
      uFill: { value: bg },
      uSun: { value: new THREE.Vector3(0, 0, 1) },
      uHome: { value: dirOf(cfg.home.lat, cfg.home.lon) },
      uReveal: { value: Math.PI },     // angle (rad) from the home point revealed so far
      uPx: { value: 1 },               // device pixel ratio: halftone pitch stays ~5 css px
      uNight: { value: new THREE.Vector3(...cfg.night) },
      uSel: { value: new THREE.Vector3() },
      uSelOn: { value: 0 },
      uHeight: { value: null as THREE.Texture | null },
      uColor: { value: null as THREE.Texture | null },
      uHSize: { value: new THREE.Vector2(2048, 1024) },
      uAlb: { value: new THREE.Vector2(0, 1) },
      uNatural: { value: cfg.natural ? 1 : 0 },
      uDetail: { value: new THREE.Vector3(...cfg.detail) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float aH;
      uniform float uR;
      uniform float uRelief;
      varying vec3 vColor;
      varying vec3 vWorld;
      void main() {
        vColor = color;
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
      uniform float uR;
      uniform float uRelief;
      uniform float uRelief0;
      uniform sampler2D uHeight;
      uniform sampler2D uColor;
      uniform vec2 uHSize;
      uniform vec2 uAlb;
      uniform float uNatural;
      uniform vec3 uDetail;   // crater depth, roughness, colour mottling (close-up only)
      varying vec3 vColor;
      varying vec3 vWorld;

      const float PI = 3.14159265;

      float hair(float v, float w, float widthPx) {
        return 1.0 - smoothstep(widthPx - 0.5, widthPx + 0.5, abs(v) / max(w, 1e-4));
      }
      // distance to the nearest multiple of 1, in px (w = fwidth of v)
      float gridLine(float v, float w, float widthPx) {
        return hair(abs(fract(v - 0.5) - 0.5), w, widthPx);
      }

      // integer hash (big cell coordinates stay exact, unlike fract(sin()))
      vec3 hash3(vec3 c) {
        uvec3 v = uvec3(ivec3(c) + 65536);
        v = v * 1664525u + 1013904223u;
        v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
        v ^= v >> 16u;
        v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
        return vec3(v) / 4294967295.0;
      }
      // one crater per 3D cell, kept inside its cell so only that cell is looked up.
      // Returns height in cell units: bowl below, raised rim, soft ejecta skirt.
      float crater(vec3 p, float seed) {
        vec3 c = floor(p);
        vec3 h = hash3(c + seed);
        if (h.x > 0.38) return 0.0;  // most cells stay empty
        float r = mix(0.1, 0.4, h.y * h.y);  // more small than big
        vec3 j = hash3(c + seed + 17.0) - 0.5;
        vec3 ctr = c + 0.5 + j * max(0.0, 1.0 - 2.5 * r);
        float d = length(p - ctr) / r;
        if (d > 1.25) return 0.0;
        float bowl = d < 1.0 ? (d * d - 1.0) * 0.7 : 0.0;
        float rim = exp(-(d - 1.0) * (d - 1.0) * 28.0) * 0.32;
        return (bowl + rim) * r * smoothstep(1.25, 1.1, d);
      }
      float vnoise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash3(i).x, b = hash3(i + vec3(1, 0, 0)).x, c = hash3(i + vec3(0, 1, 0)).x, d = hash3(i + vec3(1, 1, 0)).x;
        float e = hash3(i + vec3(0, 0, 1)).x, f1 = hash3(i + vec3(1, 0, 1)).x, g = hash3(i + vec3(0, 1, 1)).x, k = hash3(i + vec3(1, 1, 1)).x;
        return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, f1, f.x), mix(g, k, f.x), f.y), f.z);
      }

      void main() {
        vec3 dir = normalize(vWorld);

        // ── boot reveal: a cap grows out from the home point ──
        float ang = acos(clamp(dot(dir, uHome), -1.0, 1.0));
        if (ang > uReveal) discard;
        float ring = exp(-abs(uReveal - ang) * 40.0) * step(uReveal, 3.1);

        float latR = asin(clamp(dir.y, -1.0, 1.0));
        float lonR = atan(dir.x, dir.z);
        float lat = degrees(latR);
        float lon = degrees(lonR);
        // fwidth jumps by 360° across the ±180° seam: take the derivative of a shifted copy there
        float wLon = min(fwidth(lon), fwidth(mod(lon + 360.0, 360.0)));
        float wLat = fwidth(lat);

        // ── maps, per pixel (seam-safe gradients so the mip level doesn't jump at ±180°) ──
        vec2 uv = vec2(lonR / (2.0 * PI) + 0.5, latR / PI + 0.5);
        vec2 dx = dFdx(uv), dy = dFdy(uv);
        float u2 = fract(uv.x + 0.5);
        if (abs(dFdx(u2)) < abs(dx.x)) dx.x = dFdx(u2);
        if (abs(dFdy(u2)) < abs(dy.x)) dy.x = dFdy(u2);
        float fp = max(length(dx * uHSize), length(dy * uHSize));   // height texels per pixel

        // relief normal from the height map: central differences, step ≥ one pixel's footprint
        float off = max(1.0, fp);
        vec2 tx = vec2(off / uHSize.x, 0.0), ty = vec2(0.0, off / uHSize.y);
        float dE = textureGrad(uHeight, uv + tx, dx, dy).r - textureGrad(uHeight, uv - tx, dx, dy).r;
        float dN = textureGrad(uHeight, uv + ty, dx, dy).r - textureGrad(uHeight, uv - ty, dx, dy).r;
        float cosLat = max(cos(latR), 0.05);
        float sE = dE * uRelief * uHSize.x / (4.0 * PI * cosLat * off);
        float sN = dN * uRelief * uHSize.y / (2.0 * PI * off);
        vec3 east = vec3(cos(lonR), 0.0, -sin(lonR));
        vec3 north = vec3(-sin(latR) * sin(lonR), cos(latR), -sin(latR) * cos(lonR));
        vec3 nrm = normalize(dir - sE * east - sN * north);

        // ── close-up detail below the map's resolution: small craters (+ roughness), each
        //    octave fading in once its cells are big enough on screen ──
        float wpp = length(fwidth(vWorld));                     // world units per pixel
        float bump = 0.0, mott = 0.0;
        float relK = uRelief / uRelief0;
        if (fp < 1.5 && (uDetail.x + uDetail.y) > 0.0) {
          float F = uHSize.x / (4.0 * PI);                      // cell ≈ 2 height texels
          for (int i = 0; i < 4; i++) {
            float cellPx = uR / F / wpp;
            float k = smoothstep(10.0, 30.0, cellPx);
            if (k > 0.0) {
              vec3 p = dir * F;
              float c = crater(p, float(i) * 131.0) + crater(p * 1.37 + 0.5, float(i) * 131.0 + 61.0) * 0.8;
              float n = vnoise(p * 2.0) - 0.5;
              bump += k * (uDetail.x * c + uDetail.y * n * 0.12) * uR / F;
              mott += k * (c * 1.5 + n * 0.5);
            }
            F *= 3.0;
          }
          bump *= relK;
          // bump mapping from screen derivatives (same idea as three's perturbNormalArb)
          vec3 px = dFdx(vWorld), py = dFdy(vWorld);
          vec3 r1 = cross(py, nrm), r2 = cross(nrm, px);
          float det = dot(px, r1);
          vec3 grad = sign(det) * (dFdx(bump) * r1 + dFdy(bump) * r2);
          nrm = normalize(abs(det) * nrm - grad);
        }

        // ── colour: the real mosaic (Moon) or the elevation ramp × albedo (Mars) ──
        vec3 tex = textureGrad(uColor, uv, dx, dy).rgb;
        float alb = tex.r;
        float a = clamp((alb - uAlb.x) / max(uAlb.y - uAlb.x, 1e-3), 0.0, 1.0);
        vec3 base = uNatural > 0.5
          ? tex * ((0.22 + 0.9 * a) / max(alb, 1e-3))          // contrast-stretched real grey
          : vColor * (0.62 + 0.55 * a);
        base *= 1.0 + uDetail.z * mott;

        // ── light: real Sun (sub-solar point on the equator) on the day side, a soft
        //    map light from the upper left of the view on the night side ──
        float sunDot = dot(dir, uSun);
        float day = smoothstep(-0.02, 0.09, sunDot);
        vec3 toCam = normalize(cameraPosition);
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
        vec3 mapL = normalize(toCam + vec3(0.0, 0.7, 0.0) - right * 0.6);
        vec3 L = normalize(mix(mapL, uSun, day));
        // relief only: compare the surface with the smooth sphere under it (0.5 = flat)
        float light = clamp(0.5 + (dot(nrm, L) - dot(dir, L)) * 2.2, 0.0, 1.0);  // gain tuned for per-pixel normals

        // ── halftone: a 45° screen-space dot screen (~5 css px), like a print plate the
        //    planet turns under; dot area follows the relief light ──
        vec2 hv = mat2(0.7071, -0.7071, 0.7071, 0.7071) * (gl_FragCoord.xy / (5.0 * uPx));
        float aa = 0.08;
        float rad = 0.5 * sqrt(light);
        float dotm = 1.0 - smoothstep(rad - aa, rad + aa, length(fract(hv) - 0.5));
        // up close the 5 px dots can't carry sub-map detail: blend in a continuous tone
        // under them as the map gets magnified (overview stays pure halftone)
        float close = smoothstep(1.0, 0.25, fp);
        float tone = mix(0.08 + 0.9 * dotm, 0.1 + 0.95 * light, 0.6 * close);
        vec3 ground = base * tone;

        // ── graticule every 15° (brighter every 45°); meridians thin out near the poles ──
        float gLat = gridLine(lat / 15.0, wLat / 15.0, 0.55);
        float gLon = gridLine(lon / 15.0, wLon / 15.0, 0.55) * smoothstep(80.0, 70.0, abs(lat));
        float mLat = gridLine(lat / 45.0, wLat / 45.0, 0.8);
        float mLon = gridLine(lon / 45.0, wLon / 45.0, 0.8) * smoothstep(84.0, 76.0, abs(lat));
        float grid = max(max(gLat, gLon) * 0.55, max(mLat, mLon));
        vec3 lines = base * grid * 1.5 * mix(0.5, 1.15, light);

        // faint contours (a nod to Offworld Archive's elevation atlas)
        // (from the map, per pixel: the vertex height drew the mesh triangles up close)
        // levels sit half an 11-bit step off, else a flat run of equal texels lights up as a block
        float hc = (textureGrad(uHeight, uv, dx, dy).r + 0.5 / 2048.0) * 18.0;
        float cont = gridLine(hc, fwidth(hc), 0.5) * 0.16;
        vec3 lit = ground + lines + vec3(0.85, 0.82, 0.7) * cont;

        lit *= mix(uNight, vec3(1.0), day);
        vec3 col = uFill + lit;

        // equator: one dashed gold hairline, like the dashboard's dashed rules
        float eq = hair(lat, wLat, 0.6) * step(0.5, fract(lon / 3.0));
        col += vec3(0.79, 0.66, 0.35) * eq * 0.35;

        // selected site: a surveyor ring laid on the surface
        if (uSelOn > 0.001) {
          float sa = degrees(acos(clamp(dot(dir, uSel), -1.0, 1.0)));
          float wa = fwidth(sa);
          float circle = hair(sa - 2.4, wa, 0.7) + hair(sa - 4.2, wa, 0.5) * 0.45;
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
