/** Thin line icons (1.5px stroke, 16px grid) matching the reference toolbar style. */
import type { SVGProps } from 'react'

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p,
})

export const IconPulse = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M1.5 8h3l1.5-4 3 8 1.5-4h4" /></svg>
)
export const IconCompass = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="8" cy="8" r="6.25" /><path d="m10.5 5.5-1.6 3.4-3.4 1.6 1.6-3.4z" /></svg>
)
export const IconChevronLeft = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
)
export const IconChevronRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 3.5 10.5 8 6 12.5" /></svg>
)
export const IconChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ width: 10, height: 10, ...p })}><path d="M4 6l4 4 4-4" /></svg>
)
export const IconShuffle = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M1.5 4.5h2.5c3 0 4.5 7 8 7h2.5M12.5 9.5l2 2-2 2M1.5 11.5h2.5c1.2 0 2-1 2.8-2.4M9.2 6.9c.8-1.4 1.6-2.4 2.8-2.4h2.5M12.5 2.5l2 2-2 2" /></svg>
)
export const IconInfo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="8" cy="8" r="6.25" /><path d="M8 7.25v3.75M8 5h.01" /></svg>
)
export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ width: 12, height: 12, ...p })}><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></svg>
)
export const IconArrowRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ width: 12, height: 12, ...p })}><path d="M3 8h10M9 4l4 4-4 4" /></svg>
)
/** "still working" — signal with check */
export const IconSignalOk = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M1.5 9.5 4 7l2 2.5L9.5 4M10 10.5l1.75 1.75L15 9" /></svg>
)
/** "gone silent" — antenna with slash */
export const IconSignalOff = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M8 9v5.5M5.5 14.5h5M5 6.5a4 4 0 0 1 6 0M3 4.5a7 7 0 0 1 10 0M2 2l12 12" /></svg>
)
/** filter sliders — nav toggle on phones */
export const IconFilter = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M2 4.5h7M12.5 4.5H14M2 11.5h1.5M7 11.5h7" /><circle cx="10.75" cy="4.5" r="1.75" /><circle cx="5.25" cy="11.5" r="1.75" /></svg>
)
