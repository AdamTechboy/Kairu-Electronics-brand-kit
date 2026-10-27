// Color utilities: parsing, hex/rgb conversion, contrast, resolution against brand palette.

import type { ColorRole } from './types'

export function normalizeHex(input: string): string {
  if (!input) return '#000000'
  let c = input.trim()
  if (c.startsWith('rgb')) {
    const m = c.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
    if (m) return rgbToHex(+m[1], +m[2], +m[3])
  }
  if (!c.startsWith('#')) c = '#' + c
  if (/^#[0-9a-fA-F]{3}$/.test(c)) {
    return '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]
  }
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase()
  return '#000000'
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const c = normalizeHex(hex)
  return {
    r: parseInt(c.slice(1, 3), 16),
    g: parseInt(c.slice(3, 5), 16),
    b: parseInt(c.slice(5, 7), 16),
  }
}

export function hexToRgbString(hex: string): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgb(${r}, ${g}, ${b})`
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const f = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a)
  const l2 = relativeLuminance(b)
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

export function readableOn(bg: string, dark = '#101820', light = '#FFFFFF'): string {
  return contrastRatio(bg, dark) >= contrastRatio(bg, light) ? dark : light
}

export function colorDistance(a: string, b: string): number {
  const c1 = hexToRgb(a)
  const c2 = hexToRgb(b)
  return Math.sqrt((c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2)
}

// Resolve an element's fill/stroke against the brand palette
export function resolveColor(
  value: string | null | undefined,
  role: ColorRole | null | undefined,
  palette: Partial<Record<ColorRole, string>>
): string | null {
  if (role && palette[role]) return palette[role]
  if (value === undefined || value === null) return null
  return value
}

export interface PaletteSuggestion {
  name: string
  palette: { primary: string; secondary: string; accent: string; dark: string; light: string }
}

export const PALETTE_SUGGESTIONS: PaletteSuggestion[] = [
  {
    name: 'Owner Reference (Navy & Solar Amber)',
    palette: { primary: '#1F2A44', secondary: '#F5A623', accent: '#C43D2F', dark: '#101820', light: '#F7F5F0' },
  },
  {
    name: 'Solar Gold',
    palette: { primary: '#2D2A1F', secondary: '#F0A500', accent: '#1F6E43', dark: '#14120B', light: '#FBF7EE' },
  },
  {
    name: 'Energy Green',
    palette: { primary: '#1E3B2C', secondary: '#3FA34D', accent: '#F2B705', dark: '#0F1F16', light: '#F4FAF5' },
  },
  {
    name: 'Warm Trade',
    palette: { primary: '#3A2A20', secondary: '#E07A2F', accent: '#2F6F6A', dark: '#1C120C', light: '#FAF4EC' },
  },
  {
    name: 'Premium Graphite',
    palette: { primary: '#23262B', secondary: '#C9A227', accent: '#B23A2F', dark: '#0E1013', light: '#F5F5F2' },
  },
]
