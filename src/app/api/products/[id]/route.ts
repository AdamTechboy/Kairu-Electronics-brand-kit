import { db } from '@/lib/db'
import { withAuth, ok, fail, parseBody, productSchema } from '@/lib/api-helpers'
import type { SessionUser } from '@/lib/auth/server'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (user: SessionUser) => {
    const parsed = await parseBody(req, productSchema)
    if (parsed instanceof Response) return parsed
    const row = await db.product.findUnique({ where: { id } })
    if (!row || row.userId !== user.id) return fail('Product not found', 404)
    const updated = await db.product.update({
      where: { id },
      data: {
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
    return ok({ product: { ...updated, imageAssetIds: JSON.parse(updated.imageAssetIds || '[]') as string[] } })
  })
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (user: SessionUser) => {
    const row = await db.product.findUnique({ where: { id } })
    if (!row || row.userId !== user.id) return fail('Product not found', 404)
    await db.product.delete({ where: { id } })
    return ok({ deleted: true })
  })
}
