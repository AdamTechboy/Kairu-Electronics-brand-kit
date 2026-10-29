// Official-logo resolver (client-side).
// Rasterises the owner's official logo project into a transparent PNG
// data-url once per session and reuses it everywhere: template placeholders,
// flyer generation, brand-kit previews and the editor's insert action.
// This is what makes the logo actually APPEAR on letterheads, cards,
// complimentary cards and flyers instead of an empty dashed box.

import type { DesignDocument } from './types'
import { docToSvg } from './svg'
import type { BrandSettings } from '@/lib/brand'
import { projectApi } from '@/lib/api-client'
import { useEffect, useState } from 'react'

const cache = new Map<string, string>()

export function clearOfficialLogoCache() {
  cache.clear()
}

async function rasteriseDocToPng(doc: DesignDocument, palette: { primary: string; secondary: string; accent: string; dark: string; light: string }, maxPx = 900): Promise<string> {
  const svg = docToSvg(doc, { palette, includeBackground: false })
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Could not rasterise the logo'))
      img.src = url
    })
    const scale = Math.min(maxPx / Math.max(doc.width, doc.height), 3)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(doc.width * scale))
    canvas.height = Math.max(1, Math.round(doc.height * scale))
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Returns the official logo as a transparent PNG data-url, or null when no
 * official logo is set (or it cannot be rendered). Cached per logo project.
 */
export type OfficialLogoScope = 'site' | 'newDesigns' | 'always'

export async function getOfficialLogoDataUrl(brand: BrandSettings, scope: OfficialLogoScope = 'newDesigns'): Promise<string | null> {
  const id = brand.logoProjectId
  if (!id || (scope === 'site' && brand.logoApplyToSite === false) || (scope === 'newDesigns' && brand.logoApplyToNewDesigns === false)) return null
  const hit = cache.get(id)
  if (hit) return hit
  try {
    const { project } = await projectApi.get(id)
    if (project.type !== 'logo') return null
    const dataUrl = await rasteriseDocToPng(project.doc as DesignDocument, brand.palette)
    cache.set(id, dataUrl)
    return dataUrl
  } catch {
    return null
  }
}

/**
 * Returns a copy of the doc with every empty logo placeholder filled with the
 * given data-url. Pure — does not mutate the input.
 */
export function fillLogoPlaceholders(doc: DesignDocument, dataUrl: string, replaceExisting = false): DesignDocument {
  let changed = false
  const pages = doc.pages.map((page) => {
    let pageTouched = false
    const elements = page.elements.map((e0) => {
      if (e0.type === 'image' && e0.meta?.placeholder === 'logo' && (replaceExisting || !e0.src) && e0.src !== dataUrl) {
        pageTouched = true
        return { ...e0, src: dataUrl, fit: 'contain' as const }
      }
      return e0
    })
    if (pageTouched) {
      changed = true
      return { ...page, elements }
    }
    return page
  })
  return changed ? { ...doc, pages } : doc
}

/**
 * Convenience: resolves the official logo and fills every empty placeholder in
 * the doc. Returns the original doc (same object) when there is nothing to do.
 */
export async function withOfficialLogo(doc: DesignDocument, brand: BrandSettings): Promise<DesignDocument> {
  const needsFill = doc.pages.some((p) => p.elements.some((e0) => e0.type === 'image' && e0.meta?.placeholder === 'logo' && !e0.src))
  if (!needsFill) return doc
  const dataUrl = await getOfficialLogoDataUrl(brand)
  if (!dataUrl) return doc
  return fillLogoPlaceholders(doc, dataUrl)
}

// ---------- React hook for preview surfaces ----------

/**
 * Resolves the official logo data-url once per brand for use in template and
 * brand-kit previews. Returns null while loading or when no logo is set.
 */
export function useOfficialLogoDataUrl(brand: BrandSettings, scope: OfficialLogoScope = 'newDesigns'): string | null {
  const enabled = scope === 'always' || (scope === 'site' ? brand.logoApplyToSite !== false : brand.logoApplyToNewDesigns !== false)
  const [dataUrl, setDataUrl] = useState<string | null>(() => (enabled && brand.logoProjectId ? cache.get(brand.logoProjectId) ?? null : null))
  const logoId = enabled ? brand.logoProjectId : null
  useEffect(() => {
    let cancelled = false
    const apply = (d: string | null) => {
      if (!cancelled) setDataUrl(d)
    }
    if (!logoId) {
      // defer to a microtask so the effect body never sets state synchronously
      Promise.resolve().then(() => apply(null))
      return
    }
    const hit = cache.get(logoId)
    if (hit) {
      apply(hit)
      return
    }
    getOfficialLogoDataUrl(brand).then(apply)
    return () => {
      cancelled = true
    }
  }, [logoId, brand])
  return dataUrl
}
