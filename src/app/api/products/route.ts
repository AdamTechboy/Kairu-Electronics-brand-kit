import { db } from '@/lib/db'
import { withAuth, ok, parseBody, productSchema } from '@/lib/api-helpers'
import type { SessionUser } from '@/lib/auth/server'

export async function GET() {
  return withAuth(async (user: SessionUser) => {
    const rows = await db.product.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    })
    return ok({
      products: rows.map((r) => ({
        ...r,
        imageAssetIds: JSON.parse(r.imageAssetIds || '[]') as string[],
      })),
    })
  })
}

export async function POST(req: Request) {
  return withAuth(async (user: SessionUser) => {
    const parsed = await parseBody(req, productSchema)
    if (parsed instanceof Response) return parsed
    const row = await db.product.create({
      data: {
        userId: user.id,
        name: parsed.name,
        category: parsed.category ?? '',
        description: parsed.description ?? '',
        price: parsed.price ?? '',
        availability: parsed.availability ?? 'In Stock',
        stockRef: parsed.stockRef ?? '',
        notes: parsed.notes ?? '',
        imageAssetIds: JSON.stringify(parsed.imageAssetIds ?? []),
      },
    })
    return ok({ product: { ...row, imageAssetIds: JSON.parse(row.imageAssetIds || '[]') as string[] } })
  })
}
