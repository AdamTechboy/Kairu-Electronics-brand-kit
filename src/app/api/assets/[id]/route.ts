import { db } from '@/lib/db'
import { withAuth, ok, fail } from '@/lib/api-helpers'
import type { SessionUser } from '@/lib/auth/server'

type Params = { params: Promise<{ id: string }> }

// GET /api/assets/[id] — full asset with data-url (owner only)
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (user: SessionUser) => {
    const row = await db.asset.findUnique({ where: { id } })
    if (!row || row.userId !== user.id) return fail('Asset not found', 404)
    return ok({
      asset: {
        id: row.id,
        filename: row.filename,
        mimeType: row.mimeType,
        kind: row.kind,
        size: row.size,
        width: row.width,
        height: row.height,
        data: row.data,
        createdAt: row.createdAt,
      },
    })
  })
}

// DELETE /api/assets/[id]
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (user: SessionUser) => {
    const row = await db.asset.findUnique({ where: { id } })
    if (!row || row.userId !== user.id) return fail('Asset not found', 404)
    await db.asset.delete({ where: { id } })
    return ok({ deleted: true })
  })
}
