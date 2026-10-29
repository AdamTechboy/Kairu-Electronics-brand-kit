// SVG renderer: converts a DesignDocument into an SVG string.
// This single renderer powers the on-screen editor, thumbnails, and every
// export format (SVG / PNG / JPG / vector PDF) so exports match the preview.

import type { ColorRole, DesignDocument, DesignElement, DesignPage } from './types'
import { resolveColor } from './colors'
import { symbolToSvg } from './symbols'

export interface RenderPalette {
  primary: string
  secondary: string
  accent: string
  dark: string
  light: string
}

export interface RenderOptions {
  palette: RenderPalette
  pageIndex?: number
  includeBackground?: boolean // default true (set false for transparent exports)
  idPrefix?: string
  extraClass?: string
}

// ---------- text measurement ----------

let measureCtx: CanvasRenderingContext2D | null = null
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  if (!measureCtx) {
    const c = document.createElement('canvas')
    c.width = 8
    c.height = 8
    measureCtx = c.getContext('2d')
  }
  return measureCtx
}

export function measureTextWidth(text: string, el: DesignElement, scale = 1): number {
  const fontSize = (el.fontSize ?? 16) * scale
  const ls = (el.letterSpacing ?? 0) * scale
  const ctx = getMeasureCtx()
  if (!ctx) return text.length * fontSize * 0.56
  ctx.font = `${el.italic ? 'italic ' : ''}${el.fontWeight ?? 400} ${fontSize}px ${el.fontFamily ?? 'Arial'}`
  let w = 0
  const ctxAny = ctx as unknown as { letterSpacing?: string }
  if (ctxAny.letterSpacing !== undefined) ctxAny.letterSpacing = `${ls}px`
  w = ctx.measureText(text).width
  if (!w && text.length) w = text.length * fontSize * 0.56
  if (ctxAny.letterSpacing === undefined) w += ls * Math.max(0, text.length - 1)
  return w
}

export function wrapText(text: string, el: DesignElement, maxWidth: number): string[] {
  const paragraphs = (el.uppercase ? text.toUpperCase() : text).split('\n')
  const lines: string[] = []
  for (const para of paragraphs) {
    if (!para) {
      lines.push('')
      continue
    }
    const words = para.split(/(\s+)/)
    let line = ''
    for (const word of words) {
      const candidate = line + word
      if (measureTextWidth(candidate, el) <= maxWidth || !line.trim()) {
        line = candidate
      } else {
        lines.push(line.trimEnd())
        line = word.trimStart()
      }
    }
    lines.push(line.trimEnd())
  }
  return lines.length ? lines : ['']
}

export function textBlockHeight(el: DesignElement, maxWidth: number): number {
  const lh = (el.lineHeight ?? 1.25) * (el.fontSize ?? 16)
  return wrapText(el.text ?? '', el, maxWidth).length * lh
}

// ---------- xml helpers ----------

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function num(n: number): string {
  return String(Math.round(n * 100) / 100)
}

// ---------- element rendering ----------

interface Ctx {
  palette: RenderPalette
  defs: string[]
  prefix: string
  counter: { n: number }
}

function paintOf(e: DesignElement, kind: 'fill' | 'stroke', ctx: Ctx): string | null {
  const role = kind === 'fill' ? e.colorRole : e.strokeRole
  const raw = kind === 'fill' ? e.fill : e.stroke
  const color = resolveColor(raw ?? undefined, role ?? undefined, ctx.palette)
  if (!color) return null
  const gradient = kind === 'fill' ? e.gradient : null
  if (gradient && gradient.stops.length) {
    const id = `${ctx.prefix}-grad-${ctx.counter.n++}`
    const angle = gradient.angle ?? 0
    const stops = gradient.stops
      .map(
        (s) =>
          `<stop offset="${num(s.offset * 100)}%" stop-color="${escapeXml(s.color)}" stop-opacity="${s.opacity ?? 1}"/>`
      )
      .join('')
    if (gradient.type === 'linear') {
      ctx.defs.push(
        `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0" gradientTransform="rotate(${angle} 0.5 0.5)">${stops}</linearGradient>`
      )
    } else {
      ctx.defs.push(`<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.75">${stops}</radialGradient>`)
    }
    return `url(#${id})`
  }
  return color
}

function shadowFilter(e: DesignElement, ctx: Ctx): string | null {
  if (!e.shadow || !e.shadow.blur) return null
  const id = `${ctx.prefix}-sh-${ctx.counter.n++}`
  ctx.defs.push(
    `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${num(e.shadow.offsetX)}" dy="${num(
      e.shadow.offsetY
    )}" stdDeviation="${num(e.shadow.blur / 2)}" flood-color="${escapeXml(e.shadow.color)}" flood-opacity="0.35"/></filter>`
  )
  return id
}

/**
 * Combined photo filter: drop shadow + brightness/contrast/saturation in one
 * filter so a single `filter` attribute stays WYSIWYG across screen and export.
 */
function photoFilter(e: DesignElement, ctx: Ctx): string | null {
  const hasShadow = !!e.shadow && !!e.shadow.blur
  const a = e.adjust
  const bright = a?.brightness ?? 1
  const contrast = a?.contrast ?? 1
  const sat = a?.saturation ?? 1
  const hasAdjust = !!(a && (bright !== 1 || contrast !== 1 || sat !== 1))
  if (!hasShadow && !hasAdjust) return null
  const id = `${ctx.prefix}-pf-${ctx.counter.n++}`
  let inner = ''
  if (hasAdjust) {
    // brightness (multiply) then contrast (pivot 0.5) combined into one linear
    // transfer per channel: out = contrast*brightness*in + 0.5*(1-contrast)
    const slope = contrast * bright
    const intercept = 0.5 * (1 - contrast)
    inner += `<feColorMatrix type="saturate" values="${num(Math.max(0, sat))}" in="SourceGraphic" result="adjS"/>` +
      `<feComponentTransfer in="adjS" result="adjC">` +
      `<feFuncR type="linear" slope="${num(slope)}" intercept="${num(intercept)}"/>` +
      `<feFuncG type="linear" slope="${num(slope)}" intercept="${num(intercept)}"/>` +
      `<feFuncB type="linear" slope="${num(slope)}" intercept="${num(intercept)}"/>` +
      `</feComponentTransfer>`
  }
  if (hasShadow) {
    const input = hasAdjust ? 'adjC' : 'SourceGraphic'
    inner += `<feDropShadow in="${input}" dx="${num(e.shadow!.offsetX)}" dy="${num(e.shadow!.offsetY)}" stdDeviation="${num(
      e.shadow!.blur / 2
    )}" flood-color="${escapeXml(e.shadow!.color)}" flood-opacity="0.35"/>`
  }
  ctx.defs.push(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">${inner}</filter>`)
  return id
}

/** Combined transform for flips around the element centre. */
function flipTransform(e: DesignElement): string {
  const fx = e.flipX ? -1 : 1
  const fy = e.flipY ? -1 : 1
  if (fx === 1 && fy === 1) return ''
  const cx = e.x + e.w / 2
  const cy = e.y + e.h / 2
  return ` translate(${num(cx)} ${num(cy)}) scale(${fx} ${fy}) translate(${num(-cx)} ${num(-cy)})`
}

function imageClip(e: DesignElement, ctx: Ctx): string | null {
  const r = e.radius ?? 0
  if (!r) return null
  const id = `${ctx.prefix}-clip-${ctx.counter.n++}`
  // The clip rect must sit at the element's own position — clipPath units are
  // the user space of the referencing element, NOT the element's local box.
  ctx.defs.push(
    `<clipPath id="${id}"><rect x="${num(e.x)}" y="${num(e.y)}" width="${num(e.w)}" height="${num(e.h)}" rx="${num(r)}"/></clipPath>`
  )
  return id
}

function renderElement(e: DesignElement, ctx: Ctx): string {
  if (e.visible === false) return ''
  const fill = paintOf(e, 'fill', ctx)
  const stroke = paintOf(e, 'stroke', ctx)
  const sw = e.strokeWidth ?? 0
  const filterId = shadowFilter(e, ctx)
  const filterAttr = filterId ? ` filter="url(#${filterId})"` : ''
  const op = e.opacity !== undefined && e.opacity < 1 ? ` opacity="${e.opacity}"` : ''

  const cx = e.x + e.w / 2
  const cy = e.y + e.h / 2
  const rot = e.rotation ? ` rotate(${num(e.rotation)} ${num(cx)} ${num(cy)})` : ''
  const flip = flipTransform(e)
  const transformAttr = rot || flip ? ` transform="${[rot.trim(), flip.trim()].filter(Boolean).join(' ')}"` : ''

  let body = ''

  switch (e.type) {
    case 'rect': {
      const rx = e.radius ?? 0
      body = `<rect x="${num(e.x)}" y="${num(e.y)}" width="${num(e.w)}" height="${num(e.h)}" rx="${num(rx)}" fill="${
        fill ?? 'none'
      }"${stroke ? ` stroke="${stroke}" stroke-width="${num(sw)}"` : ''} />`
      break
    }
    case 'ellipse': {
      body = `<ellipse cx="${num(cx)}" cy="${num(cy)}" rx="${num(e.w / 2)}" ry="${num(e.h / 2)}" fill="${
        fill ?? 'none'
      }"${stroke ? ` stroke="${stroke}" stroke-width="${num(sw)}"` : ''} />`
      break
    }
    case 'line': {
      const yy = e.y + e.h / 2
      body = `<rect x="${num(e.x)}" y="${num(yy - Math.max(sw, 1) / 2)}" width="${num(e.w)}" height="${num(
        Math.max(sw, 1)
      )}" fill="${stroke ?? fill ?? '#000000'}" />`
      break
    }
    case 'path': {
      body = `<path d="${e.d ?? ''}" fill="${fill ?? 'none'}"${
        stroke ? ` stroke="${stroke}" stroke-width="${num(sw)}" stroke-linecap="round" stroke-linejoin="round"` : ''
      } />`
      break
    }
    case 'symbol': {
      body = symbolToSvg(e.symbol ?? '', e.x, e.y, e.w, e.h, fill ?? stroke ?? '#000000', e.symbolWeight ?? 'regular') ?? ''
      break
    }
    case 'image': {
      if (!e.src) {
        const isLogo = e.meta?.placeholder === 'logo'
        const label = isLogo ? 'LOGO' : 'Image'
        const hint = isLogo ? 'Add ▸ Insert official logo' : 'Upload a picture'
        const fs = Math.max(8, Math.min(e.w, e.h) * 0.12)
        body = `<rect x="${num(e.x)}" y="${num(e.y)}" width="${num(e.w)}" height="${num(e.h)}" rx="${num(Math.min(e.radius ?? 0, Math.min(e.w, e.h) / 8))}" fill="#EFECE4" stroke="#C9C4B8" stroke-dasharray="6 4" /><text x="${num(
          cx
        )}" y="${num(cy - fs * 0.35)}" font-family="Arial" font-size="${num(fs)}" font-weight="700" letter-spacing="1" fill="#8A8577" text-anchor="middle" dominant-baseline="middle">${escapeXml(label)}</text><text x="${num(
          cx
        )}" y="${num(cy + fs * 0.75)}" font-family="Arial" font-size="${num(fs * 0.52)}" fill="#A8A396" text-anchor="middle" dominant-baseline="middle">${escapeXml(hint)}</text>`
      } else {
        const clipId = imageClip(e, ctx)
        const clipAttr = clipId ? ` clip-path="url(#${clipId})"` : ''
        const preserve = e.fit === 'contain' ? 'xMidYMid meet' : e.fit === 'fill' ? 'none' : 'xMidYMid slice'
        const photoId = photoFilter(e, ctx)
        const fAttr = photoId ? ` filter="url(#${photoId})"` : ''
        const strokeAttr = stroke ? ` stroke="${stroke}" stroke-width="${num(sw)}"` : ''
        const imageSrc = escapeXml(e.src)
        body = `<image href="${imageSrc}" xlink:href="${imageSrc}" x="${num(e.x)}" y="${num(e.y)}" width="${num(e.w)}" height="${num(
          e.h
        )}" preserveAspectRatio="${preserve}"${clipAttr}${fAttr} ${strokeAttr} />`
      }
      break
    }
    case 'qr': {
      if (e.src) {
        const imageSrc = escapeXml(e.src)
        body = `<image href="${imageSrc}" xlink:href="${imageSrc}" x="${num(e.x)}" y="${num(e.y)}" width="${num(e.w)}" height="${num(e.h)}" />`
      } else {
        body = `<rect x="${num(e.x)}" y="${num(e.y)}" width="${num(e.w)}" height="${num(e.h)}" fill="#ffffff" stroke="#999" /><text x="${num(
          cx
        )}" y="${num(cy)}" font-family="Arial" font-size="10" fill="#999" text-anchor="middle" dominant-baseline="middle">QR</text>`
      }
      break
    }
    case 'text': {
      const fontSize = e.fontSize ?? 16
      const lh = (e.lineHeight ?? 1.25) * fontSize
      const lines = wrapText(e.text ?? '', e, e.w)
      const blockH = lines.length * lh
      let startY = e.y
      if (e.vAlign === 'middle') startY = e.y + (e.h - blockH) / 2
      else if (e.vAlign === 'bottom') startY = e.y + e.h - blockH
      const anchor = e.align === 'center' ? 'middle' : e.align === 'right' ? 'end' : 'start'
      const tx = e.align === 'center' ? cx : e.align === 'right' ? e.x + e.w : e.x
      const underline = e.underline ? ' text-decoration="underline"' : ''
      const style = `font-family="${escapeXml(e.fontFamily ?? 'Arial')}" font-size="${num(fontSize)}" font-weight="${
        e.fontWeight ?? 400
      }"${e.italic ? ' font-style="italic"' : ''}${e.letterSpacing ? ` letter-spacing="${num(e.letterSpacing)}"` : ''}${underline}`
      const parts = lines.map((line, i) => {
        const baseline = startY + i * lh + fontSize * 0.8
        return `<text x="${num(tx)}" y="${num(baseline)}" ${style} fill="${fill ?? '#000000'}" text-anchor="${anchor}" xml:space="preserve">${escapeXml(
          line
        )}</text>`
      })
      body = parts.join('')
      break
    }
  }

  return `<g data-id="${e.id}"${op}${transformAttr}>` + body + '</g>'
}

// ---------- page / document rendering ----------

export function pageToSvg(doc: DesignDocument, page: DesignPage, opts: RenderOptions, pageBgOverride?: string | null): string {
  const prefix = opts.idPrefix ?? 'r'
  const ctx: Ctx = { palette: opts.palette, defs: [], prefix, counter: { n: 0 } }
  const includeBg = opts.includeBackground !== false
  const bg = pageBgOverride !== undefined ? pageBgOverride : page.background ?? doc.background
  let out = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${num(
    doc.width
  )}" height="${num(doc.height)}" viewBox="0 0 ${num(doc.width)} ${num(doc.height)}"${opts.extraClass ? ` class="${opts.extraClass}"` : ''}>`
  if (includeBg && bg) {
    out += `<rect x="0" y="0" width="${num(doc.width)}" height="${num(doc.height)}" fill="${escapeXml(bg)}" />`
  }
  out += `<defs>${ctx.defs.join('')}</defs>`
  for (const e of page.elements) out += renderElement(e, ctx)
  out += '</svg>'
  // defs may have been pushed during element rendering; rebuild header
  out = out.replace('<defs></defs>', `<defs>${ctx.defs.join('')}</defs>`)
  return out
}

export function docToSvg(doc: DesignDocument, opts: RenderOptions): string {
  const idx = opts.pageIndex ?? 0
  const page = doc.pages[idx] ?? doc.pages[0]
  return pageToSvg(doc, page, opts)
}

export function docPagesToSvg(doc: DesignDocument, opts: RenderOptions): string[] {
  return doc.pages.map((p) => pageToSvg(doc, p, opts))
}

// ---------- qr helper ----------

export async function generateQrDataUrl(data: string, dark = '#000000', light = '#ffffff'): Promise<string> {
  const QR = (await import('qrcode')).default
  return QR.toDataURL(data || ' ', {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 512,
    color: { dark, light },
  })
}
