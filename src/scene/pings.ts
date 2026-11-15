/**
 * PINGs sent from the Message time panel (src/ui/SignalDelay.tsx), drawn by the Deep Space map as an
 * LED pulse travelling Earth → craft → Earth. The panel keeps the real countdown; the map plays the
 * trip sped up (PULSE_S per leg) and says by how much.
 */
export const PULSE_S = 6

export interface Ping { id: string; t0: number }
const pings: Ping[] = []

export function sendPing(id: string) {
  pings.push({ id, t0: performance.now() / 1000 })
}

/** Pings still on screen (out + back + a short arrival blink); finished ones are dropped. */
export function livePings(now = performance.now() / 1000): readonly Ping[] {
  for (let i = pings.length - 1; i >= 0; i--) if (now - pings[i].t0 > PULSE_S * 2 + 1) pings.splice(i, 1)
  return pings
}
