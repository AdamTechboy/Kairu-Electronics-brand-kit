import { db } from '@/lib/db'
import { withAuth, ok, fail, parseBody } from '@/lib/api-helpers'
import { z } from 'zod'
import type { SessionUser } from '@/lib/auth/server'

type Params = { params: Promise<{ id: string }> }

// GET /api/projects/[id]/versions — revision history
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (user: SessionUser) => {
    const row = await db.designProject.findUnique({ where: { id }, select: { userId: true } })
    if (!row || row.userId !== user.id) return fail('Project not found', 404)
    const versions = await db.projectVersion.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: { id: true, label: true, createdAt: true },
    })
    return ok({ versions })
  })
}

// POST — create a snapshot of the current doc
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (user: SessionUser) => {
    const row = await db.designProject.findUnique({ where: { id } })
    if (!row || row.userId !== user.id) return fail('Project not found', 404)
    const parsed = await parseBody(req, z.object({ label: z.string().max(120).optional() }))
    if (parsed instanceof Response) return parsed
    const version = await db.projectVersion.create({
      data: { projectId: id, label: parsed.label || 'Manual snapshot', doc: row.doc },
    })
    return ok({ version: { id: version.id, label: version.label, createdAt: version.createdAt } })
  })
}
