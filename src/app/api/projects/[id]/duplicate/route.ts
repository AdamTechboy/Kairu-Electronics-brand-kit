import { db } from '@/lib/db'
import { withAuth, ok, fail } from '@/lib/api-helpers'
import type { SessionUser } from '@/lib/auth/server'

type Params = { params: Promise<{ id: string }> }

// POST /api/projects/[id]/duplicate
export async function POST(_req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (user: SessionUser) => {
    const row = await db.designProject.findUnique({ where: { id } })
    if (!row || row.userId !== user.id) return fail('Project not found', 404)
    const copy = await db.designProject.create({
      data: {
        userId: user.id,
        name: `${row.name} (copy)`,
        type: row.type,
        doc: row.doc,
        preview: row.preview,
        isTemplate: false,
        templateOf: row.templateOf,
      },
    })
    await db.projectVersion.create({
      data: { projectId: copy.id, label: 'Duplicated copy', doc: row.doc },
    })
    return ok({ project: { id: copy.id, name: copy.name } })
  })
}
