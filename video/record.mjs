// Records every shot of the launch video for one language:  bun record.mjs en|tr [shot...]
import { launch, open, Shot, skip, press, BASE } from './rig.mjs'

const lang = process.argv[2] === 'tr' ? 'tr' : 'en'
const only = new Set(process.argv.slice(3))
const want = (name) => !only.size || only.has(name)
const dir = (name) => `frames/${lang}/${name}`
const t0 = Date.now()
const log = (m) => console.log(`[${lang} ${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`)

const browser = await launch()

// ── title cards ──
for (const [card, sec] of [['hook', 2.4], ['silent', 1.3], ['talking', 1.5], ['end', 4]]) {
  if (!want(card)) continue
  const page = await open(browser, `${BASE}/video/cards.html?card=${card}&lang=${lang}`, 1500)
  await new Shot(page, dir(card)).rec(sec)
  await page.close()
  log(`card ${card}`)
}

// ── the app, one continuous session ──
if (want('app')) {
  const page = await open(browser, `${BASE}/?boot&lang=${lang}`)

  // boot loader → logo flies into the nav → terrain reveal + markers ping in
  await new Shot(page, dir('moon_intro')).rec(9)
  log('moon intro')

  // fly to Apollo 11, story panel + photo slideshow
  await press(page, 'button.view')
  await new Shot(page, dir('a11')).rec(5)
  log('apollo 11')

  // close the story, ▶ PLAY: 1966 → today, markers land and go silent (3× time-lapse)
  await press(page, '.story .close')
  await skip(page, 0.8)
  await press(page, '.sig__play')
  await new Shot(page, dir('play')).rec(5.2, 3)
  log('play')
  await skip(page, 2)

  // Mars: remount + reveal, then Perseverance (still talking)
  await press(page, '.planet-switch button:nth-child(2)')
  await skip(page, 0.3)
  await new Shot(page, dir('mars_intro')).rec(5.5)
  await press(page, '.markers button[aria-label$="— Perseverance"]')
  await new Shot(page, dir('perseverance')).rec(4.5)
  log('mars')

  // Deep space: LED boot + camera glide, then Voyager 1's road replays to today
  await press(page, '.planet-switch button:nth-child(3)')
  await skip(page, 0.3)
  await new Shot(page, dir('deep_intro')).rec(6.5)
  await press(page, '.markers button[aria-label^="Voyager 1 —"]')
  await new Shot(page, dir('voyager')).rec(6)
  log('deep space')
  await page.close()
}

await browser.close()
log('done')
