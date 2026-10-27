// Vector symbol library: product silhouettes & utility icons used by the logo
// and design templates. All symbols are pure vector markup so they export as
// real vectors (SVG + vector PDF). Stroke-based line art, scalable to any bbox.

export interface SymbolDef {
  key: string
  label: string
  group: 'product' | 'contact' | 'deco'
  viewBox: number // native design space (square)
  parts: SymbolPart[]
}

export type SymbolPart =
  | { kind: 'path'; d: string; fill?: boolean }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill?: boolean }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rot?: number; fill?: boolean }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r?: number; fill?: boolean }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }

const PRODUCT = 100

// ---- Product symbols (custom line art in 100×100 space) ----

export const SUN_HALF: SymbolDef = {
  key: 'sun-half',
  label: 'Rising Sun',
  group: 'product',
  viewBox: PRODUCT,
  parts: [
    { kind: 'path', d: 'M15 78 A35 35 0 0 1 85 78 Z', fill: true },
    { kind: 'line', x1: 14.8, y1: 48.4, x2: 7.1, y2: 42 },
    { kind: 'line', x1: 32.8, y1: 35.4, x2: 28.3, y2: 24.2 },
    { kind: 'line', x1: 50, y1: 32, x2: 50, y2: 20 },
    { kind: 'line', x1: 67.2, y1: 35.4, x2: 71.7, y2: 24.2 },
    { kind: 'line', x1: 85.2, y1: 48.4, x2: 92.9, y2: 42 },
  ],
}

export const SOLAR_PANEL: SymbolDef = {
  key: 'solar-panel',
  label: 'Solar Panel',
  group: 'product',
  viewBox: PRODUCT,
  parts: [
    // tilted panel frame (kept exactly in this arrangement, matching the owner's reference)
    { kind: 'path', d: 'M12 70 L58 42 L88 50 L42 80 Z' },
    { kind: 'line', x1: 27.3, y1: 60.7, x2: 68, y2: 44.7 },
    { kind: 'line', x1: 42.7, y1: 51.3, x2: 78, y2: 47.3 },
    { kind: 'line', x1: 22, y1: 73.3, x2: 57.3, y2: 70 },
    { kind: 'line', x1: 32, y1: 76.7, x2: 72.7, y2: 60 },
    // stand legs
    { kind: 'line', x1: 62, y1: 77, x2: 62, y2: 88 },
    { kind: 'line', x1: 42, y1: 82, x2: 42, y2: 90 },
    { kind: 'line', x1: 32, y1: 90, x2: 72, y2: 90 },
  ],
}

export const TV: SymbolDef = {
  key: 'tv',
  label: 'Television',
  group: 'product',
  viewBox: PRODUCT,
  parts: [
    { kind: 'rect', x: 14, y: 24, w: 72, h: 50, r: 5 },
    { kind: 'line', x1: 50, y1: 74, x2: 50, y2: 85 },
    { kind: 'line', x1: 34, y1: 88, x2: 66, y2: 88 },
  ],
}

export const FRIDGE: SymbolDef = {
  key: 'fridge',
  label: 'Refrigerator',
  group: 'product',
  viewBox: PRODUCT,
  parts: [
    { kind: 'rect', x: 30, y: 8, w: 40, h: 84, r: 4 },
    { kind: 'line', x1: 30, y1: 40, x2: 70, y2: 40 },
    { kind: 'line', x1: 62, y1: 18, x2: 62, y2: 30 },
    { kind: 'line', x1: 62, y1: 48, x2: 62, y2: 62 },
  ],
}

export const FAN: SymbolDef = {
  key: 'fan',
  label: 'Electric Fan',
  group: 'product',
  viewBox: PRODUCT,
  parts: [
    { kind: 'circle', cx: 50, cy: 38, r: 27 },
    { kind: 'ellipse', cx: 63, cy: 30, rx: 12, ry: 7.5, rot: 35, fill: true },
    { kind: 'ellipse', cx: 37, cy: 30, rx: 12, ry: 7.5, rot: -35, fill: true },
    { kind: 'ellipse', cx: 50, cy: 52, rx: 12, ry: 7.5, rot: 90, fill: true },
    { kind: 'circle', cx: 50, cy: 38, r: 5.5, fill: true },
    { kind: 'line', x1: 50, y1: 65, x2: 50, y2: 86 },
    { kind: 'rect', x: 34, y: 86, w: 32, h: 7, r: 3.5 },
  ],
}

export const INVERTER: SymbolDef = {
  key: 'inverter',
  label: 'Inverter',
  group: 'product',
  viewBox: PRODUCT,
  parts: [
    { kind: 'rect', x: 24, y: 26, w: 52, h: 48, r: 4 },
    { kind: 'rect', x: 32, y: 36, w: 22, h: 14, r: 2 },
    { kind: 'circle', cx: 64, cy: 40, r: 2.4, fill: true },
    { kind: 'circle', cx: 64, cy: 48, r: 2.4, fill: true },
    { kind: 'line', x1: 32, y1: 60, x2: 68, y2: 60 },
    { kind: 'line', x1: 32, y1: 66, x2: 56, y2: 66 },
    { kind: 'line', x1: 40, y1: 74, x2: 40, y2: 82 },
    { kind: 'line', x1: 60, y1: 74, x2: 60, y2: 82 },
  ],
}

export const BATTERY: SymbolDef = {
  key: 'battery',
  label: 'Solar Battery',
  group: 'product',
  viewBox: PRODUCT,
  parts: [
    { kind: 'rect', x: 18, y: 32, w: 64, h: 46, r: 4 },
    { kind: 'rect', x: 27, y: 24, w: 10, h: 8, r: 2 },
    { kind: 'rect', x: 63, y: 24, w: 10, h: 8, r: 2 },
    { kind: 'path', d: 'M54 38 L43 57 L50 57 L46 70 L58 52 L51 52 Z', fill: true },
  ],
}

export const PLUG: SymbolDef = {
  key: 'plug',
  label: 'Power Plug',
  group: 'product',
  viewBox: PRODUCT,
  parts: [
    { kind: 'rect', x: 32, y: 34, w: 36, h: 30, r: 6 },
    { kind: 'line', x1: 42, y1: 34, x2: 42, y2: 18 },
    { kind: 'line', x1: 58, y1: 34, x2: 58, y2: 18 },
    { kind: 'path', d: 'M50 64 L50 74 A14 14 0 0 1 36 88' },
  ],
}

// ---- Utility / contact icons (Feather-style, 24×24 space, stroke) ----

const U = 24

export const CONTACT_ICONS: SymbolDef[] = [
  {
    key: 'phone',
    label: 'Phone',
    group: 'contact',
    viewBox: U,
    parts: [
      {
        kind: 'path',
        d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
      },
    ],
  },
  {
    key: 'location',
    label: 'Location',
    group: 'contact',
    viewBox: U,
    parts: [{ kind: 'path', d: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z' }, { kind: 'circle', cx: 12, cy: 10, r: 3 }],
  },
  {
    key: 'clock',
    label: 'Clock',
    group: 'contact',
    viewBox: U,
    parts: [{ kind: 'circle', cx: 12, cy: 12, r: 10 }, { kind: 'path', d: 'M12 6v6l4 2' }],
  },
  {
    key: 'mail',
    label: 'Mail',
    group: 'contact',
    viewBox: U,
    parts: [{ kind: 'rect', x: 2, y: 4, w: 20, h: 16, r: 2 }, { kind: 'path', d: 'M22 6 12 13 2 6' }],
  },
  {
    key: 'globe',
    label: 'Website',
    group: 'contact',
    viewBox: U,
    parts: [
      { kind: 'circle', cx: 12, cy: 12, r: 10 },
      { kind: 'line', x1: 2, y1: 12, x2: 22, y2: 12 },
      { kind: 'path', d: 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' },
    ],
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    group: 'contact',
    viewBox: U,
    parts: [
      {
        kind: 'path',
        d: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
      },
    ],
  },
  {
    key: 'facebook',
    label: 'Facebook',
    group: 'contact',
    viewBox: U,
    parts: [{ kind: 'path', d: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z' }],
  },
  {
    key: 'instagram',
    label: 'Instagram',
    group: 'contact',
    viewBox: U,
    parts: [
      { kind: 'rect', x: 2, y: 2, w: 20, h: 20, r: 5 },
      { kind: 'path', d: 'M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z' },
      { kind: 'line', x1: 17.5, y1: 6.5, x2: 17.5, y2: 6.5 },
    ],
  },
  {
    key: 'check',
    label: 'Check',
    group: 'contact',
    viewBox: U,
    parts: [{ kind: 'path', d: 'M20 6 9 17l-5-5' }],
  },
  {
    key: 'star',
    label: 'Star',
    group: 'deco',
    viewBox: U,
    parts: [{ kind: 'path', d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' }],
  },
  {
    key: 'bolt',
    label: 'Power Bolt',
    group: 'deco',
    viewBox: U,
    parts: [{ kind: 'path', d: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z' }],
  },
  {
    key: 'shield',
    label: 'Shield',
    group: 'deco',
    viewBox: U,
    parts: [{ kind: 'path', d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' }],
  },
  {
    key: 'arrow-right',
    label: 'Arrow Right',
    group: 'deco',
    viewBox: U,
    parts: [{ kind: 'line', x1: 5, y1: 12, x2: 19, y2: 12 }, { kind: 'path', d: 'M12 5l7 7-7 7' }],
  },
]

export const SYMBOLS: Record<string, SymbolDef> = Object.fromEntries(
  [SUN_HALF, SOLAR_PANEL, TV, FRIDGE, FAN, INVERTER, BATTERY, PLUG, ...CONTACT_ICONS].map((s) => [s.key, s])
)

export const SYMBOL_LIST = [SUN_HALF, SOLAR_PANEL, TV, FRIDGE, FAN, INVERTER, BATTERY, PLUG, ...CONTACT_ICONS]

const WEIGHT_FACTOR: Record<string, number> = { thin: 0.7, regular: 1, bold: 1.6 }

/**
 * Render a symbol as an SVG fragment positioned at (x,y) sized w×h.
 * Line art scales uniformly to fit; stroke width scales with the symbol size.
 */
export function symbolToSvg(
  symbolKey: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  weight: 'thin' | 'regular' | 'bold' = 'regular'
): string | null {
  const def = SYMBOLS[symbolKey]
  if (!def) return null
  const vb = def.viewBox
  const s = Math.min(w / vb, h / vb)
  const offX = x + (w - vb * s) / 2
  const offY = y + (h - vb * s) / 2
  // Stroke width is specified in symbol units — the group's scale() applies
  // the size scaling exactly once (browsers and svg2pdf treat it the same).
  const sw = (vb === 24 ? 2 : 4.5) * WEIGHT_FACTOR[weight]
  const pieces: string[] = []
  for (const p of def.parts) {
    const common = `stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`
    if (p.kind === 'path') {
      pieces.push(`<path d="${p.d}" fill="${p.fill ? color : 'none'}" ${p.fill ? '' : common} />`)
    } else if (p.kind === 'circle') {
      pieces.push(`<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${p.fill ? color : 'none'}" ${p.fill ? '' : common} />`)
    } else if (p.kind === 'ellipse') {
      const t = p.rot ? ` transform="rotate(${p.rot} ${p.cx} ${p.cy})"` : ''
      pieces.push(
        `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}"${t} fill="${p.fill ? color : 'none'}" ${p.fill ? '' : common} />`
      )
    } else if (p.kind === 'rect') {
      pieces.push(
        `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.r ?? 0}" fill="${p.fill ? color : 'none'}" ${p.fill ? '' : common} />`
      )
    } else if (p.kind === 'line') {
      pieces.push(`<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" ${common} />`)
    }
  }
  return `<g transform="translate(${offX.toFixed(2)} ${offY.toFixed(2)}) scale(${s.toFixed(4)})">${pieces.join('')}</g>`
}
