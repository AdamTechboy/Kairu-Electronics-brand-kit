import { db } from '@/lib/db'
import { DEFAULT_PALETTE } from '@/lib/brand'
import { docToSvg } from '@/lib/design/svg'
import type { DesignDocument } from '@/lib/design/types'

// Public by design: the official logo is business identity artwork, not account data.
export async function GET(request: Request) {
  const fallback = () => Response.redirect(new URL('/logo.svg', request.url), 302)
  try {
    const brand = await db.brandSettings.findFirst({ orderBy: { updatedAt: 'desc' } })
    if (!brand || !brand.logoApplyToSite || !brand.logoProjectId) return fallback()
    const project = await db.designProject.findFirst({
      where: { id: brand.logoProjectId, userId: brand.userId, type: 'logo' },
    })
    if (!project) return fallback()
    const doc = JSON.parse(project.doc) as DesignDocument
    let storedPalette: unknown = {}
    try { storedPalette = JSON.parse(brand.palette) } catch { storedPalette = {} }
    const palette = { ...DEFAULT_PALETTE, ...(storedPalette as Partial<typeof DEFAULT_PALETTE>) }
    const svg = docToSvg(doc, { palette, includeBackground: false })
    return new Response(svg, {
      headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch {
    return fallback()
  }
}
