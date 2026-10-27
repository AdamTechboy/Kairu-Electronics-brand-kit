import { db } from '@/lib/db'
import { withAuth, ok, fail, parseBody } from '@/lib/api-helpers'
import { z } from 'zod'
import type { SessionUser } from '@/lib/auth/server'

type Params = { params: Promise<{ id: string }> }

// POST /api/projects/[id]/restore { versionId } — restore a previous version
// (current doc is snapshotted first so nothing is lost)
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (user: SessionUser) => {
    const row = await db.designProject.findUnique({ where: { id } })
    if (!row || row.userId !== user.id) return fail('Project not found', 404)
    const parsed = await parseBody(req, z.object({ versionId: z.string().min(1).max(80) }))
    if (parsed instanceof Response) return parsed
    const version = await db.projectVersion.findUnique({ where: { id: parsed.versionId } })
    if (!version || version.projectId !== id) return fail('Version not found', 404)

    // safety snapshot of current state before restoring
    await db.projectVersion.create({
      data: { projectId: id, label: 'Auto-saved before restore', doc: row.doc },
    })
    const updated = await db.designProject.update({
      where: { id },
      data: { doc: version.doc },
    })
    return ok({ project: { id: updated.id, doc: JSON.parse(updated.doc) } })
  })
}
