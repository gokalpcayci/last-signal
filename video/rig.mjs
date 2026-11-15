// Deterministic frame capture. Playwright's fake clock drives rAF, timers, Date and performance.now,
// and CSS animations/transitions are paused and stepped to the same virtual time, so every saved
// frame is exactly 1/FPS s after the last one however slow the WebGL render is.
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

export const FPS = 60
export const W = 1920, H = 1080
export const BASE = process.env.APP_URL ?? 'http://localhost:5173'

const STEP_ANIMS = `
  window.__vt = new WeakMap()
  window.__stepAnims = () => {
    const now = performance.now()
    for (const a of document.getAnimations()) {
      let s = window.__vt.get(a)
      if (!s) { s = { v0: now }; window.__vt.set(a, s) }
      if (a.playState !== 'paused') a.pause()
      a.currentTime = now - s.v0
    }
  }`

export async function launch() {
  return chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
}

/** open a page on a frozen virtual clock and let real-time network loads land */
export async function open(browser, url, settleMs = 2500) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  await page.addInitScript(STEP_ANIMS)
  const start = new Date()
  await page.clock.install({ time: start })
  await page.clock.pauseAt(new Date(start.getTime() + 200))
  await page.goto(url)
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(settleMs)
  return page
}

export class Shot {
  constructor(page, dir) {
    this.page = page; this.dir = dir; this.n = 0
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true })
  }
  async frame(ms) {
    await this.page.clock.runFor(ms)
    await this.page.evaluate(() => window.__stepAnims())
    await this.page.screenshot({ path: path.join(this.dir, `${String(this.n++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 })
  }
  /** record `sec` seconds of output; speed > 1 = time-lapse (virtual time runs faster) */
  async rec(sec, speed = 1) {
    const count = Math.round(sec * FPS)
    for (let i = 0; i < count; i++) await this.frame((1000 / FPS) * speed)
    return this
  }
}

/** advance virtual time without saving frames */
export async function skip(page, sec) {
  await page.clock.runFor(sec * 1000)
  await page.evaluate(() => window.__stepAnims())
}

/** click through React's handler (works for invisible hit targets too) */
export async function press(page, selector) {
  const n = await page.locator(selector).count()
  if (!n) throw new Error(`nothing matches ${selector}`)
  await page.locator(selector).first().evaluate((e) => e.click())
}
