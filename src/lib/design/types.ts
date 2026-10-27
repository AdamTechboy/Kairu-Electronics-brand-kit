// Editable design document model.
// Designs are stored as structured, editable data (never flattened).
// A single SVG-string renderer (svg.ts) is the source of truth for both
// the on-screen editor and every export format, guaranteeing WYSIWYG.

export type ProjectType =
  | 'logo'
  | 'letterhead'
  | 'business-card'
  | 'complimentary-card'
  | 'flyer'
  | 'social-post'
  | 'document'
  | 'other'

export type ElementType =
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'image'
  | 'qr'
  | 'path'
  | 'symbol'

export type ColorRole = 'primary' | 'secondary' | 'accent' | 'dark' | 'light'

export interface Shadow {
  color: string
  blur: number
  offsetX: number
  offsetY: number
}

export interface GradientStop {
  offset: number
  color: string
  opacity?: number
}

export interface GradientFill {
  type: 'linear' | 'radial'
  angle?: number
  stops: GradientStop[]
}

export interface DesignElement {
  id: string
  type: ElementType
  name?: string
  // Geometry: x/y = top-left of un-rotated bbox; rotation is around the center.
  x: number
  y: number
  w: number
  h: number
  rotation?: number
  opacity?: number // 0..1
  visible?: boolean // default true
  locked?: boolean // default false
  // Paint
  fill?: string | null // resolved color, hex/rgb
  gradient?: GradientFill | null
  colorRole?: ColorRole | null // when set, fill resolves from brand palette at render time
  stroke?: string | null
  strokeRole?: ColorRole | null
  strokeWidth?: number
  radius?: number // rounded corners (rect, image)
  shadow?: Shadow | null
  // path
  d?: string // path data in local 0..w / 0..h space
  // symbol
  symbol?: string // key into symbol library
  symbolWeight?: 'thin' | 'regular' | 'bold'
  // text
  text?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  italic?: boolean
  align?: 'left' | 'center' | 'right'
  vAlign?: 'top' | 'middle' | 'bottom'
  lineHeight?: number // multiplier, default 1.25
  letterSpacing?: number // px
  underline?: boolean
  uppercase?: boolean
  // image / qr
  src?: string // data-url
  fit?: 'cover' | 'contain' | 'fill'
  flipX?: boolean // mirror horizontally
  flipY?: boolean // mirror vertically
  /** Photo adjustments — 1 = neutral. brightness/contrast/saturation. */
  adjust?: { brightness?: number; contrast?: number; saturation?: number } | null
  qrData?: string
  // flyer/product metadata (kept on element for regeneration)
  meta?: Record<string, string>
}

export interface DesignPage {
  id: string
  name: string
  background: string | null
  elements: DesignElement[]
}

export interface DesignDocument {
  version: 1
  width: number
  height: number
  background: string | null // page background color; null = transparent
  pages: DesignPage[]
  meta?: {
    type?: ProjectType
    templateId?: string
    notes?: string
  }
}

export const FONT_OPTIONS = [
  { label: 'Arial', value: 'Arial' },
  { label: 'Helvetica', value: 'Helvetica' },
  { label: 'Trebuchet MS', value: 'Trebuchet MS' },
  { label: 'Verdana', value: 'Verdana' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Courier New', value: 'Courier New' },
]

// Canvas presets in design px (96/inch). Exports scale as needed.
export const CANVAS_PRESETS: Record<string, { label: string; width: number; height: number; group: string }> = {
  'a4-portrait': { label: 'A4 Portrait (letterhead)', width: 794, height: 1123, group: 'print' },
  'a5-portrait': { label: 'A5 Portrait', width: 559, height: 794, group: 'print' },
  'a4-landscape': { label: 'A4 Landscape', width: 1123, height: 794, group: 'print' },
  'a5-landscape': { label: 'A5 Landscape', width: 794, height: 559, group: 'print' },
  'business-card': { label: 'Business Card 3.5×2in', width: 336, height: 192, group: 'print' },
  'comp-card': { label: 'Complimentary Card A6', width: 397, height: 560, group: 'print' },
  'square-1080': { label: 'Square Post 1080×1080', width: 1080, height: 1080, group: 'social' },
  'portrait-1080': { label: 'Portrait Post 1080×1350', width: 1080, height: 1350, group: 'social' },
  'status-1080': { label: 'WhatsApp Status / Story 1080×1920', width: 1080, height: 1920, group: 'social' },
  'landscape-1200': { label: 'Facebook Post 1200×630', width: 1200, height: 630, group: 'social' },
  'logo-1000': { label: 'Logo Canvas 1000×1000', width: 1000, height: 1000, group: 'logo' },
}

// Physical size mapping for PDF export (in mm).
export const PDF_MM: Record<string, { w: number; h: number }> = {
  'a4-portrait': { w: 210, h: 297 },
  'a5-portrait': { w: 148, h: 210 },
  'a4-landscape': { w: 297, h: 210 },
  'a5-landscape': { w: 210, h: 148 },
  'business-card': { w: 88.9, h: 50.8 },
  'comp-card': { w: 105, h: 148 },
}

export function pxToMm(doc: DesignDocument): { w: number; h: number } {
  const key = doc.meta?.templateId && PDF_MM[doc.meta.templateId]
  if (key) return key
  const factor = 25.4 / 96
  return { w: +(doc.width * factor).toFixed(2), h: +(doc.height * factor).toFixed(2) }
}

export function uid(): string {
  return 'el_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function newPage(name = 'Page 1', background: string | null = '#ffffff'): DesignPage {
  return { id: uid(), name, background, elements: [] }
}

export function el(type: ElementType, props: Partial<DesignElement> = {}): DesignElement {
  return {
    id: uid(),
    type,
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    visible: true,
    locked: false,
    opacity: 1,
    ...props,
  } as DesignElement
}

/** Load a data-url and return its natural pixel size (client-side). */
export function imageNaturalSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return reject(new Error('Client only'))
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height })
    img.onerror = () => reject(new Error('Could not read the image'))
    img.src = src
  })
}

/**
 * Resize an image frame so the whole picture is visible without cropping:
 * keeps the frame centre fixed, matches the image aspect ratio, clamps to the
 * page bounds (never wider than the page, allowing some vertical overflow).
 */
export function fitFrameToImage(
  frame: { x: number; y: number; w: number; h: number },
  natural: { width: number; height: number },
  docSize: { width: number; height: number }
): { x: number; y: number; w: number; h: number } {
  const ratio = natural.width && natural.height ? natural.width / natural.height : frame.w / frame.h
  let w = frame.w
  let h = w / ratio
  if (h > docSize.height * 0.96) {
    h = docSize.height * 0.96
    w = h * ratio
  }
  if (w > docSize.width * 0.96) {
    w = docSize.width * 0.96
    h = w / ratio
  }
  const cx = frame.x + frame.w / 2
  const cy = frame.y + frame.h / 2
  return {
    x: Math.round(cx - w / 2),
    y: Math.round(cy - h / 2),
    w: Math.max(8, Math.round(w)),
    h: Math.max(8, Math.round(h)),
  }
}

export function cloneDoc(doc: DesignDocument): DesignDocument {
  return JSON.parse(JSON.stringify(doc))
}

// Palette application: rewrite elements that carry a colorRole
export function applyPaletteToDoc(doc: DesignDocument, palette: Record<ColorRole, string>): DesignDocument {
  const next = cloneDoc(doc)
  for (const page of next.pages) {
    for (const e of page.elements) {
      if (e.colorRole && palette[e.colorRole]) e.fill = palette[e.colorRole]
      if (e.strokeRole && palette[e.strokeRole]) e.stroke = palette[e.strokeRole]
    }
  }
  return next
}
