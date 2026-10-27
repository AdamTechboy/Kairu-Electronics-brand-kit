import { db } from '@/lib/db'
import { withAuth, ok, parseBody, brandUpdateSchema } from '@/lib/api-helpers'
import type { SessionUser } from '@/lib/auth/server'
import { parseBrand, defaultBrandRowData } from '@/lib/brand-server'

export async function GET() {
  return withAuth(async (user: SessionUser) => {
    let row = await db.brandSettings.findUnique({ where: { userId: user.id } })
    if (!row) {
      row = await db.brandSettings.create({ data: { userId: user.id, ...defaultBrandRowData() } })
    }
    return ok({ brand: parseBrand(row) })
  })
}

export async function PUT(req: Request) {
  return withAuth(async (user: SessionUser) => {
    const parsed = await parseBody(req, brandUpdateSchema)
    if (parsed instanceof Response) return parsed
    const existing = await db.brandSettings.findUnique({ where: { userId: user.id } })
    if (!existing) return ok({ brand: null }, 404)
    const data: Record<string, string | null> = {}
    for (const key of [
      'businessName',
      'businessCategory',
      'description',
      'shortDescription',
      'tagline',
      'address',
      'email',
      'website',
      'openingHours',
      'extraInfo',
    ] as const) {
      if (parsed[key] !== undefined) data[key] = parsed[key] as string
    }
    if (parsed.phones !== undefined) data.phones = JSON.stringify(parsed.phones)
    if (parsed.socials !== undefined) data.socials = JSON.stringify(parsed.socials)
    if (parsed.palette !== undefined) data.palette = JSON.stringify(parsed.palette)
    if (parsed.typography !== undefined) data.typography = JSON.stringify(parsed.typography)
    if (parsed.logoProjectId !== undefined) data.logoProjectId = parsed.logoProjectId
    const row = await db.brandSettings.update({ where: { userId: user.id }, data })
    return ok({ brand: parseBrand(row) })
  })
}
