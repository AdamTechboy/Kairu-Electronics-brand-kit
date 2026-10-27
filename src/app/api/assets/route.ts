import { db } from '@/lib/db'
import { withAuth, ok, parseBody, assetCreateSchema } from '@/lib/api-helpers'
import type { SessionUser } from '@/lib/auth/server'

// GET /api/assets?kind=&projectId= — metadata list (no heavy payloads)
export async function GET(req: Request) {
  return withAuth(async (user: SessionUser) => {
    const url = new URL(req.url)
    const kind = url.searchParams.get('kind') || undefined
    const rows = await db.asset.findMany({
      where: { userId: user.id, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        id: true,
        filename: true,
        mimeType: true,
        kind: true,
        size: true,
        width: true,
        height: true,
        createdAt: true,
      },
    })
    return ok({ assets: rows })
  })
}

// POST /api/assets — upload (data-url stored in SQLite; validated type + size)
export async function POST(req: Request) {
  return withAuth(async (user: SessionUser) => {
    const parsed = await parseBody(req, assetCreateSchema)
    if (parsed instanceof Response) return parsed
    const base64 = parsed.dataUrl.split(',')[1] ?? ''
    const sizeBytes = Math.round((base64.length * 3) / 4)
    const MAX = 6 * 1024 * 1024
    if (sizeBytes > MAX) {
      return ok({ error: 'Image is too large (max 6 MB after decode).' }, 413)
    }
    const row = await db.asset.create({
      data: {
        userId: user.id,
        filename: parsed.filename.replace(/[^\w.\- ()]/g, '_').slice(0, 190),
        mimeType: parsed.mimeType,
        kind: parsed.kind ?? 'image',
        size: sizeBytes,
        width: parsed.width ?? 0,
        height: parsed.height ?? 0,
        data: parsed.dataUrl,
        projectId: parsed.projectId ?? null,
      },
    })
    return ok({
      asset: {
        id: row.id,
        filename: row.filename,
        mimeType: row.mimeType,
        kind: row.kind,
        size: row.size,
        width: row.width,
        height: row.height,
        createdAt: row.createdAt,
      },
    })
  })
}
