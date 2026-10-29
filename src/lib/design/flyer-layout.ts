// Flyer layout engine: composes an editable DesignDocument flyer from the
// owner's content (headline, products, images, prices, contacts) using one of
// 8 professional style presets. Deterministic geometry keeps text legible,
// avoids overlap, and fits the chosen canvas. Output remains fully editable.

import type { DesignDocument, DesignElement, ProjectType } from './types'
import { el, newPage } from './types'
import { measureTextWidth } from './svg'
import type { BrandSettings } from '@/lib/brand'

export type FlyerStyle =
  | 'premium'
  | 'modern-tech'
  | 'solar-energy'
  | 'catalogue'
  | 'bold-sale'
  | 'minimal'
  | 'dark-premium'
  | 'bright-retail'

export interface FlyerProductInput {
  name: string
  description?: string
  price?: string
  availability?: string
  imageDataUrl?: string
  symbol?: string
}

export interface FlyerInput {
  headline: string
  eyebrow?: string
  subheading?: string
  description?: string
  offer?: string
  cta?: string
  products: FlyerProductInput[]
  /** Extra photos without product details — each gets its own framed cell in a photo gallery band. */
  extraImages?: string[]
  style: FlyerStyle
  showLogo: boolean
  showAddress: boolean
  showDescription: boolean
  /** Resolved official logo (transparent PNG data-url) — set by the caller. */
  logoDataUrl?: string
}

interface Theme {
  bg: string
  headerBg: string | null
  headerText: string
  eyebrow: string
  headline: string
  sub: string
  body: string
  cardBg: string
  cardText: string
  cardMuted: string
  priceBg: string
  priceText: string
  ctaBg: string
  ctaText: string
  accent: string
  headFont: string
  bodyFont: string
  decor: 'rays' | 'circles' | 'none'
  dark: boolean
}

const AVAILABILITY_COLORS: Record<string, string> = {
  'In Stock': '#2E7D32',
  'Limited Stock': '#B97A0C',
  'Out of Stock': '#B3261E',
  'Pre-order': '#4E4A45',
  'Coming Soon': '#4E4A45',
}

export const FLYER_STYLES: { id: FlyerStyle; name: string; description: string }[] = [
  { id: 'premium', name: 'Premium Electronics Retail', description: 'Navy luxury with gold accents — flagship feel.' },
  { id: 'modern-tech', name: 'Modern Technology', description: 'Clean white, sharp type, energetic accents.' },
  { id: 'solar-energy', name: 'Solar & Renewable Energy', description: 'Warm sun-inspired palette with green energy hints.' },
  { id: 'catalogue', name: 'Clean Product Catalogue', description: 'Neutral grid that lets product photos speak.' },
  { id: 'bold-sale', name: 'Bold Promotional Sale', description: 'High-contrast red/amber urgency layout.' },
  { id: 'minimal', name: 'Minimalist Professional', description: 'Lots of whitespace, quiet confidence.' },
  { id: 'dark-premium', name: 'Dark Premium Showcase', description: 'Near-black stage for glowing products.' },
  { id: 'bright-retail', name: 'Bright Retail Advertisement', description: 'Friendly amber energy for mass appeal.' },
]

function themeFor(style: FlyerStyle, brand: BrandSettings): Theme {
  const p = brand.palette
  const t: Theme = {
    bg: '#FFFFFF',
    headerBg: null,
    headerText: p.primary,
    eyebrow: p.secondary,
    headline: p.primary,
    sub: '#3A3A3A',
    body: '#4A4A4A',
    cardBg: '#FFFFFF',
    cardText: '#16181D',
    cardMuted: '#6A6A6A',
    priceBg: p.secondary,
    priceText: '#16181D',
    ctaBg: p.primary,
    ctaText: '#FFFFFF',
    accent: p.secondary,
    headFont: 'Arial',
    bodyFont: 'Arial',
    decor: 'none',
    dark: false,
  }
  switch (style) {
    case 'premium':
      return { ...t, bg: p.primary, headerBg: null, headerText: '#FFFFFF', headline: '#FFFFFF', sub: '#E8E2D2', body: '#D8D2C2', cardBg: '#FFFFFF', priceBg: p.secondary, ctaBg: p.secondary, ctaText: '#16181D', decor: 'circles' }
    case 'modern-tech':
      return { ...t, bg: '#FAFAF7', headline: '#16181D', sub: '#3A3A3A', eyebrow: p.secondary, ctaBg: '#16181D', decor: 'circles' }
    case 'solar-energy':
      return { ...t, bg: '#FBF4E4', headline: '#3A2E14', sub: '#5A4A22', body: '#6A5A32', priceBg: '#C77700', priceText: '#FFFFFF', ctaBg: '#2F6B3A', accent: '#E89B0C', decor: 'rays' }
    case 'catalogue':
      return { ...t, bg: '#FFFFFF', cardBg: '#F6F5F1', headline: '#16181D', eyebrow: '#8A8577', ctaBg: '#16181D' }
    case 'bold-sale':
      return { ...t, bg: '#B3261E', headerBg: '#B3261E', headline: '#FFFFFF', sub: '#FFE1DE', body: '#FFD6D2', cardBg: '#FFFFFF', priceBg: '#F5A623', priceText: '#16181D', ctaBg: '#16181D', ctaText: '#FFFFFF', eyebrow: '#FFD34D', decor: 'rays' }
    case 'minimal':
      return { ...t, bg: '#FFFFFF', headline: '#16181D', eyebrow: '#9A958A', cardBg: '#FAFAF8', priceBg: '#16181D', priceText: '#FFFFFF', ctaBg: '#16181D' }
    case 'dark-premium':
      return { ...t, bg: '#101318', headerText: '#FFFFFF', headline: '#FFFFFF', sub: '#C9CDD6', body: '#B4B8C2', cardBg: '#1A1E26', cardText: '#F2F2F2', cardMuted: '#9AA0AC', priceBg: p.secondary, priceText: '#101318', ctaBg: p.secondary, ctaText: '#101318', dark: true, decor: 'circles' }
    case 'bright-retail':
      return { ...t, bg: p.secondary, headline: '#231A05', sub: '#3A2E10', body: '#4A3E1A', cardBg: '#FFFFFF', ctaBg: '#16181D', ctaText: '#FFFFFF', decor: 'rays' }
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function truncateToLines(text: string, maxLines: number, el: DesignElement, maxWidth: number): string {
  if (!text) return ''
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? line + ' ' + word : word
    if (measureTextWidth(candidate, el) <= maxWidth) {
      line = candidate
    } else {
      if (line) lines.push(line)
      line = word
      if (lines.length === maxLines) break
    }
  }
  if (lines.length < maxLines && line) lines.push(line)
  if (lines.length > maxLines) lines.length = maxLines
  let out = lines.join('\n')
  const totalWords = words.length
  const usedWords = out.split(/\s+/).filter(Boolean).length
  if (usedWords < totalWords) out = out.replace(/\s+\S*$/, '') + '…'
  return out
}

export interface FlyerLayoutResult {
  doc: DesignDocument
  warnings: string[]
}

/** Aspect ratio (w/h) of every image frame in the composed flyer, used to pre-crop photos. */
interface FlyerAspects {
  products: (number | null)[]
  gallery: (number | null)[]
}

/**
 * Synchronous composer. Runs twice by generateFlyerDoc: first to learn the
 * frame geometry, then with pre-cropped images so every photo fills its frame
 * exactly (no surprise cut-offs).
 */
function composeFlyer(input: FlyerInput, size: { width: number; height: number; presetId?: string }, brand: BrandSettings): { doc: DesignDocument; warnings: string[]; aspects: FlyerAspects } {
  const aspects: FlyerAspects = { products: [], gallery: [] }
  const W = size.width
  const H = size.height
  const th = themeFor(input.style, brand)
  const warnings: string[] = []
  const els: DesignElement[] = []
  const scale = W / 794 // relative to A4 width reference
  const pad = Math.round(W * 0.055)
  const S = (v: number) => Math.max(6, Math.round(v * scale * 100) / 100)

  // ---------- background + decor ----------
  if (th.bg) {
    els.push(el('rect', { name: 'Background', x: 0, y: 0, w: W, h: H, fill: th.bg }))
  }
  if (th.decor === 'circles') {
    els.push(el('ellipse', { name: 'Decor circle 1', x: W * 0.72, y: -W * 0.14, w: W * 0.42, h: W * 0.42, fill: th.accent, opacity: 0.16 }))
    els.push(el('ellipse', { name: 'Decor circle 2', x: -W * 0.12, y: H - W * 0.3, w: W * 0.34, h: W * 0.34, fill: th.accent, opacity: 0.1 }))
  } else if (th.decor === 'rays') {
    els.push(el('symbol', { name: 'Decor sun rays', symbol: 'sun-half', x: W * 0.78, y: -W * 0.06, w: W * 0.26, h: W * 0.26, fill: th.accent, opacity: 0.22, symbolWeight: 'bold' }))
  }

  let y = pad

  // ---------- header: logo + business name ----------
  if (input.showLogo) {
    const headerH = S(72)
    els.push(el('image', { name: 'Logo', meta: { placeholder: 'logo' }, x: pad, y, w: headerH, h: headerH, fit: 'contain', ...(input.logoDataUrl ? { src: input.logoDataUrl } : {}) }))
    els.push(
      el('text', {
        name: 'Business name',
        x: pad + headerH + S(16),
        y: y + 2,
        w: W - pad * 2 - headerH - S(16),
        h: headerH,
        text: brand.businessName,
        fontFamily: th.headFont,
        fontSize: S(24),
        fontWeight: 700,
        align: 'left',
        vAlign: 'middle',
        fill: th.headerText,
      })
    )
    y += headerH + S(18)
  }

  // ---------- eyebrow ----------
  if (input.eyebrow) {
    els.push(
      el('text', {
        name: 'Eyebrow',
        x: pad,
        y,
        w: W - pad * 2,
        h: S(26),
        text: input.eyebrow.toUpperCase(),
        fontFamily: th.bodyFont,
        fontSize: S(15),
        fontWeight: 700,
        letterSpacing: S(3),
        align: 'left',
        fill: th.eyebrow,
      })
    )
    y += S(30)
  }

  // ---------- headline ----------
  const headlineSize = S(clamp(W * (input.headline.length > 60 ? 0.052 : input.headline.length > 30 ? 0.062 : 0.072), 20, 96))
  const headlineEl: DesignElement = { ...el('text'), fontFamily: th.headFont, fontSize: headlineSize, fontWeight: 900 }
  const headlineMaxLines = 3
  const headlineText = truncateToLines(input.headline, headlineMaxLines, headlineEl, W - pad * 2)
  if (input.headline !== headlineText.replace(/…$/, '')) warnings.push('The headline was long, so it was condensed to fit. You can adjust it in the editor.')
  const headlineLines = headlineText.split('\n').length
  els.push(
    el('text', {
      name: 'Headline',
      x: pad,
      y,
      w: W - pad * 2,
      h: headlineLines * headlineSize * 1.12,
      text: headlineText,
      fontFamily: th.headFont,
      fontSize: headlineSize,
      fontWeight: 900,
      align: 'left',
      lineHeight: 1.12,
      fill: th.headline,
    })
  )
  y += headlineLines * headlineSize * 1.12 + S(12)

  // ---------- subheading ----------
  if (input.subheading) {
    const subSize = S(22)
    const subEl: DesignElement = { ...el('text'), fontFamily: th.bodyFont, fontSize: subSize }
    const subText = truncateToLines(input.subheading, 2, subEl, W - pad * 2)
    const subLines = subText.split('\n').length
    els.push(
      el('text', {
        name: 'Sub heading',
        x: pad,
        y,
        w: W - pad * 2,
        h: subLines * subSize * 1.3,
        text: subText,
        fontFamily: th.bodyFont,
        fontSize: subSize,
        align: 'left',
        lineHeight: 1.3,
        fill: th.sub,
      })
    )
    y += subLines * subSize * 1.3 + S(10)
  }

  // ---------- offer ribbon ----------
  if (input.offer) {
    const ribbonH = S(52)
    const ribbonW = Math.min(W - pad * 2, measureTextWidth(input.offer, { ...el('text'), fontSize: S(24), fontWeight: 900, fontFamily: th.headFont }) + S(48))
    els.push(el('rect', { name: 'Offer ribbon', x: pad, y, w: ribbonW, h: ribbonH, radius: ribbonH / 2, fill: th.priceBg, shadow: { color: '#000000', blur: 10, offsetX: 0, offsetY: 4 } }))
    els.push(
      el('text', {
        name: 'Offer text',
        x: pad + S(24),
        y,
        w: ribbonW - S(48),
        h: ribbonH,
        text: input.offer,
        fontFamily: th.headFont,
        fontSize: S(24),
        fontWeight: 900,
        align: 'left',
        vAlign: 'middle',
        fill: th.priceText,
      })
    )
    y += ribbonH + S(16)
  }

  // ---------- footer (computed first, products fill the middle) ----------
  const footerH = S(input.showAddress ? 92 : 70)
  const footerY = H - pad - footerH + S(8)

  // ---------- description (above products) ----------
  if (input.showDescription && input.description) {
    const descSize = S(15)
    const descEl: DesignElement = { ...el('text'), fontFamily: th.bodyFont, fontSize: descSize }
    const descText = truncateToLines(input.description, 4, descEl, W - pad * 2)
    const descLines = descText.split('\n').length
    els.push(
      el('text', {
        name: 'Description',
        x: pad,
        y,
        w: W - pad * 2,
        h: descLines * descSize * 1.45,
        text: descText,
        fontFamily: th.bodyFont,
        fontSize: descSize,
        align: 'left',
        lineHeight: 1.45,
        fill: th.body,
      })
    )
    y += descLines * descSize * 1.45 + S(10)
  }

  // ---------- photo gallery + products ----------
  const products = input.products.slice(0, 8)
  const galleryImages = (input.extraImages ?? []).filter(Boolean).slice(0, 8)
  if (input.products.length > 8) warnings.push('Only the first 8 products fit on a flyer; extra products were left out.')
  if ((input.extraImages ?? []).length > 8) warnings.push('Only the first 8 extra photos fit on a flyer; the rest were left out.')
  const areaTop = y + S(6)
  const areaBottom = footerY - S(14)
  const areaH = areaBottom - areaTop
  const areaW = W - pad * 2

  if (products.length === 0 && galleryImages.length === 0 && !input.showDescription) {
    warnings.push('No products were added. Add products, photos or a description so the flyer has content.')
  }

  // Split the middle band: framed photos on top, product cards below.
  let photoTop = areaTop
  let photoBottom = areaTop
  let prodTop = areaTop
  const prodBottom = areaBottom
  if (galleryImages.length && products.length) {
    photoBottom = areaTop + areaH * 0.46 - S(8)
    prodTop = photoBottom + S(16)
  } else if (galleryImages.length) {
    photoBottom = areaBottom
  }

  if (galleryImages.length) {
    const gh = Math.max(S(80), photoBottom - photoTop)
    const gap = S(12)
    // Keep photo cells transparent so source pixels sit directly on the flyer.
    const frames: { x: number; y: number; w: number; h: number }[] = []
    if (galleryImages.length === 1) {
      frames.push({ x: pad, y: photoTop, w: areaW, h: gh })
    } else if (galleryImages.length === 2) {
      const fw = (areaW - gap) / 2
      frames.push({ x: pad, y: photoTop, w: fw, h: gh })
      frames.push({ x: pad + fw + gap, y: photoTop, w: fw, h: gh })
    } else if (galleryImages.length === 3) {
      // one hero frame left, two stacked right — classic gallery arrangement
      const bigW = areaW * 0.58
      const smallW = areaW - bigW - gap
      const sh = (gh - gap) / 2
      frames.push({ x: pad, y: photoTop, w: bigW, h: gh })
      frames.push({ x: pad + bigW + gap, y: photoTop, w: smallW, h: sh })
      frames.push({ x: pad + bigW + gap, y: photoTop + sh + gap, w: smallW, h: sh })
    } else {
      const cols = galleryImages.length <= 4 ? 2 : galleryImages.length <= 6 ? 3 : 4
      const rows = Math.ceil(galleryImages.length / cols)
      const fw = (areaW - gap * (cols - 1)) / cols
      const fh = (gh - gap * (rows - 1)) / rows
      for (let i = 0; i < galleryImages.length; i++) {
        const col = i % cols
        const row = Math.floor(i / cols)
        frames.push({ x: pad + col * (fw + gap), y: photoTop + row * (fh + gap), w: fw, h: fh })
      }
    }
    frames.forEach((f, i) => {
      const src = galleryImages[i]
      if (src.startsWith('data:image/')) {
        els.push(el('image', { name: `Photo ${i + 1}`, src, fit: 'contain', x: f.x, y: f.y, w: f.w, h: f.h, radius: 0 }))
      } else {
        warnings.push(`Photo ${i + 1} could not be loaded and was skipped. Re-upload it and try again.`)
      }
      aspects.gallery[i] = f.w / f.h
    })
  }

  const prodAreaTop = prodTop
  const prodAreaBottom = prodBottom
  const prodAreaH = prodAreaBottom - prodAreaTop

  if (products.length === 1) {
    const pDef = products[0]
    const heroH = Math.min(Math.max(S(120), prodAreaH), W * 0.62)
    const imgH = pDef.imageDataUrl ? heroH * 0.62 : heroH * 0.5
    // Keep the photo region free of card fill so transparent PNG pixels reveal the flyer background.
    els.push(el('rect', { name: 'Product info panel', x: pad, y: prodAreaTop + imgH, w: areaW, h: Math.max(0, heroH - imgH), radius: S(12), fill: th.cardBg, shadow: { color: '#000000', blur: 14, offsetX: 0, offsetY: 5 } }))
    if (pDef.imageDataUrl) {
      if (pDef.imageDataUrl.startsWith('data:image/')) {
        els.push(el('image', { name: `${pDef.name} image`, src: pDef.imageDataUrl, fit: 'contain', x: pad, y: prodAreaTop, w: areaW, h: imgH, radius: 0 }))
      } else {
        warnings.push(`${pDef.name || 'A product'} photo could not be loaded; a symbol placeholder is shown instead.`)
        els.push(el('symbol', { name: 'Product symbol', symbol: pDef.symbol || 'tv', x: pad + areaW / 2 - S(60), y: prodAreaTop + imgH / 2 - S(60), w: S(120), h: S(120), fill: th.dark ? '#3A4250' : '#C9C4B4', symbolWeight: 'bold' }))
      }
      aspects.products[0] = areaW / imgH
    } else {
      els.push(el('rect', { name: 'Image placeholder', x: pad, y: prodAreaTop, w: areaW, h: imgH, radius: S(14), fill: th.dark ? '#242A34' : '#EEEBE2' }))
      els.push(el('symbol', { name: 'Product symbol', symbol: pDef.symbol || 'tv', x: pad + areaW / 2 - S(60), y: prodAreaTop + imgH / 2 - S(60), w: S(120), h: S(120), fill: th.dark ? '#3A4250' : '#C9C4B4', symbolWeight: 'bold' }))
      aspects.products[0] = null
    }
    const infoY = prodAreaTop + imgH + S(14)
    const nameSize = S(24)
    els.push(el('text', { name: `${pDef.name} name`, x: pad + S(18), y: infoY, w: areaW - S(36), h: nameSize * 1.25, text: truncateToLines(pDef.name, 1, { ...el('text'), fontSize: nameSize, fontWeight: 700, fontFamily: th.headFont }, areaW - S(140)), fontFamily: th.headFont, fontSize: nameSize, fontWeight: 700, align: 'left', fill: th.cardText }))
    if (pDef.price) {
      els.push(el('rect', { name: 'Price badge', x: pad + areaW - S(120), y: infoY - S(6), w: S(110), h: S(38), radius: S(19), fill: th.priceBg }))
      els.push(el('text', { name: 'Price', x: pad + areaW - S(120), y: infoY - S(6), w: S(110), h: S(38), text: pDef.price, fontFamily: th.headFont, fontSize: S(19), fontWeight: 900, align: 'center', vAlign: 'middle', fill: th.priceText }))
    }
    const descY = infoY + nameSize * 1.25 + S(6)
    if (pDef.description) {
      const dSize = S(14)
      const dText = truncateToLines(pDef.description, 2, { ...el('text'), fontSize: dSize, fontFamily: th.bodyFont }, areaW - S(36))
      els.push(el('text', { name: 'Product description', x: pad + S(18), y: descY, w: areaW - S(36), h: S(42), text: dText, fontFamily: th.bodyFont, fontSize: dSize, align: 'left', lineHeight: 1.4, fill: th.cardMuted }))
    }
    if (pDef.availability) {
      const chipColor = AVAILABILITY_COLORS[pDef.availability] ?? th.accent
      els.push(el('rect', { name: 'Availability chip', x: pad + S(18), y: prodAreaTop + heroH - S(30), w: S(110), h: S(22), radius: S(11), fill: chipColor }))
      els.push(el('text', { name: 'Availability', x: pad + S(18), y: prodAreaTop + heroH - S(30), w: S(110), h: S(22), text: pDef.availability, fontFamily: th.bodyFont, fontSize: S(10.5), fontWeight: 700, align: 'center', vAlign: 'middle', fill: '#FFFFFF' }))
    }
  } else if (products.length > 1) {
    const cols = products.length <= 2 ? 2 : products.length <= 4 ? 2 : 3
    const rows = Math.ceil(products.length / cols)
    const gap = S(14)
    const cardW = (areaW - gap * (cols - 1)) / cols
    const cardH = Math.max(S(120), (prodAreaH - gap * (rows - 1)) / rows)
    if (cardH < S(120)) warnings.push('There are many products for this flyer size — consider a larger format or fewer products/photos.')
    products.forEach((pDef, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = pad + col * (cardW + gap)
      const cy = prodAreaTop + row * (cardH + gap)
      const imgH = pDef.imageDataUrl ? cardH * 0.5 : cardH * 0.42
      // A transparent photo area lets PNG cutouts sit naturally on the flyer background.
      els.push(el('rect', { name: `${pDef.name} info panel`, x: cx, y: cy + imgH, w: cardW, h: Math.max(0, cardH - imgH), radius: S(8), fill: th.cardBg, shadow: { color: '#000000', blur: 10, offsetX: 0, offsetY: 4 } }))
      if (pDef.imageDataUrl) {
        if (pDef.imageDataUrl.startsWith('data:image/')) {
          els.push(el('image', { name: `${pDef.name} image`, src: pDef.imageDataUrl, fit: 'contain', x: cx, y: cy, w: cardW, h: imgH, radius: 0 }))
        } else {
          warnings.push(`${pDef.name || 'A product'} photo could not be loaded; a symbol placeholder is shown instead.`)
          els.push(el('symbol', { name: 'Product symbol', symbol: pDef.symbol || 'tv', x: cx + cardW / 2 - S(26), y: cy + imgH / 2 - S(26), w: S(52), h: S(52), fill: th.dark ? '#3A4250' : '#C9C4B4', symbolWeight: 'bold' }))
        }
        aspects.products[i] = cardW / imgH
      } else {
        els.push(el('rect', { name: 'Image placeholder', x: cx, y: cy, w: cardW, h: imgH, radius: S(10), fill: th.dark ? '#242A34' : '#EEEBE2' }))
        els.push(el('symbol', { name: 'Product symbol', symbol: pDef.symbol || 'tv', x: cx + cardW / 2 - S(26), y: cy + imgH / 2 - S(26), w: S(52), h: S(52), fill: th.dark ? '#3A4250' : '#C9C4B4', symbolWeight: 'bold' }))
        aspects.products[i] = null
      }
      const nameSize = clamp(cardW * 0.075, 10, 26)
      const nameText = truncateToLines(pDef.name, 1, { ...el('text'), fontSize: nameSize, fontWeight: 700, fontFamily: th.headFont }, cardW - S(20))
      els.push(el('text', { name: `${pDef.name} name`, x: cx + S(10), y: cy + imgH + S(8), w: cardW - S(20), h: nameSize * 1.2, text: nameText, fontFamily: th.headFont, fontSize: nameSize, fontWeight: 700, align: 'left', fill: th.cardText }))
      if (pDef.description) {
        const dSize = clamp(nameSize * 0.68, 8, 15)
        const dLines = cardH > S(240) ? 2 : 1
        const dText = truncateToLines(pDef.description, dLines, { ...el('text'), fontSize: dSize, fontFamily: th.bodyFont }, cardW - S(20))
        els.push(el('text', { name: 'Product description', x: cx + S(10), y: cy + imgH + S(8) + nameSize * 1.25, w: cardW - S(20), h: dSize * 1.35 * dLines, text: dText, fontFamily: th.bodyFont, fontSize: dSize, align: 'left', lineHeight: 1.35, fill: th.cardMuted }))
      }
      if (pDef.price) {
        const priceSize = clamp(nameSize * 0.95, 10, 22)
        els.push(el('text', { name: 'Price', x: cx + S(10), y: cy + cardH - S(30), w: cardW * 0.6, h: S(26), text: pDef.price, fontFamily: th.headFont, fontSize: priceSize, fontWeight: 900, align: 'left', vAlign: 'middle', fill: th.dark ? th.accent : '#B3261E' }))
      }
      if (pDef.availability) {
        const chipColor = AVAILABILITY_COLORS[pDef.availability] ?? th.accent
        const chipW = S(76)
        els.push(el('rect', { name: 'Availability chip', x: cx + cardW - chipW - S(10), y: cy + cardH - S(28), w: chipW, h: S(19), radius: S(9.5), fill: chipColor }))
        els.push(el('text', { name: 'Availability', x: cx + cardW - chipW - S(10), y: cy + cardH - S(28), w: chipW, h: S(19), text: pDef.availability, fontFamily: th.bodyFont, fontSize: S(8.5), fontWeight: 700, align: 'center', vAlign: 'middle', fill: '#FFFFFF' }))
      }
    })
  }

  // ---------- contact footer ----------
  els.push(el('rect', { name: 'Footer bar', x: 0, y: footerY, w: W, h: footerH, fill: th.ctaBg }))
  const ctaText = input.cta || 'Call to Enquire'
  const phones = brand.phones.join('  •  ')
  if (input.showAddress) {
    els.push(el('text', { name: 'Call to action', x: pad, y: footerY + S(10), w: W - pad * 2, h: S(28), text: ctaText, fontFamily: th.headFont, fontSize: S(21), fontWeight: 900, align: 'left', fill: th.ctaText }))
    els.push(el('text', { name: 'Phones', x: pad, y: footerY + S(40), w: W - pad * 2, h: S(24), text: phones, fontFamily: th.bodyFont, fontSize: S(16), fontWeight: 700, align: 'left', fill: th.ctaText }))
    els.push(el('text', { name: 'Address', x: pad, y: footerY + S(62), w: W - pad * 2, h: S(22), text: brand.address, fontFamily: th.bodyFont, fontSize: S(12.5), align: 'left', fill: th.ctaText, opacity: 0.85 }))
  } else {
    els.push(el('text', { name: 'Call to action', x: pad, y: footerY, w: W * 0.4, h: footerH, text: ctaText, fontFamily: th.headFont, fontSize: S(21), fontWeight: 900, align: 'left', vAlign: 'middle', fill: th.ctaText }))
    els.push(el('text', { name: 'Phones', x: pad + W * 0.4, y: footerY, w: W - pad * 2 - W * 0.4, h: footerH, text: phones, fontFamily: th.bodyFont, fontSize: S(17), fontWeight: 700, align: 'right', vAlign: 'middle', fill: th.ctaText }))
  }

  const docPage = { ...newPage('Flyer', null), elements: els }
  const result: DesignDocument = {
    version: 1,
    width: W,
    height: H,
    background: null,
    pages: [docPage],
    meta: { type: 'flyer' as ProjectType, templateId: size.presetId },
  }
  return { doc: result, warnings, aspects }
}

/**
 * Generate the flyer document without destructively cropping uploaded photos.
 * Product and gallery images use "contain" so the complete source image remains
 * visible inside its frame. Users can still crop deliberately in the editor.
 */
export async function generateFlyerDoc(
  input: FlyerInput,
  size: { width: number; height: number; presetId?: string },
  brand: BrandSettings
): Promise<FlyerLayoutResult> {
  const result = composeFlyer(input, size, brand)
  return { doc: result.doc, warnings: result.warnings }
}

/** Synchronous one-shot composer (no image pre-cropping) — for live previews. */
export function composeFlyerDoc(
  input: FlyerInput,
  size: { width: number; height: number; presetId?: string },
  brand: BrandSettings
): FlyerLayoutResult {
  const r = composeFlyer(input, size, brand)
  return { doc: r.doc, warnings: r.warnings }
}
