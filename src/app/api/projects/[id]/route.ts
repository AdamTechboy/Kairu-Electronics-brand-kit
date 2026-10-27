import { db } from '@/lib/db'
import { withAuth, ok, fail, parseBody, projectUpdateSchema } from '@/lib/api-helpers'
import type { SessionUser } from '@/lib/auth/server'

type Params = { params: Promise<{ id: string }> }

async function getOwnedProject(userId: string, id: string) {
  const row = await db.designProject.findUnique({ where: { id } })
  if (!row || row.userId !== userId) return null
  return row
}

// GET full project with editable doc
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (user: SessionUser) => {
    const row = await getOwnedProject(user.id, id)
    if (!row) return fail('Project not found', 404)
    let doc: unknown = null
    try {
      doc = JSON.parse(row.doc)
    } catch {
      doc = null
    }
    return ok({
      project: {
        id: row.id,
        name: row.name,
        type: row.type,
        doc,
        preview: row.preview,
        isTemplate: row.isTemplate,
        templateOf: row.templateOf,
        archived: row.archived,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    })
  })
}

// PUT update (doc / name / preview / flags). snapshot: true → also record a version.
export async function PUT(req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (user: SessionUser) => {
    const parsed = await parseBody(req, projectUpdateSchema)
    if (parsed instanceof Response) return parsed
    const row = await getOwnedProject(user.id, id)
    if (!row) return fail('Project not found', 404)

    const data: Record<string, unknown> = {}
    if (parsed.name !== undefined) data.name = parsed.name
    if (parsed.doc !== undefined) data.doc = JSON.stringify(parsed.doc)
    if (parsed.preview !== undefined) data.preview = parsed.preview
    if (parsed.isTemplate !== undefined) data.isTemplate = parsed.isTemplate
    if (parsed.archived !== undefined) data.archived = parsed.archived

    const updated = await db.designProject.update({ where: { id }, data })

    if (parsed.doc !== undefined && parsed.snapshot) {
      await db.projectVersion.create({
        data: {
          projectId: id,
          label: parsed.versionLabel || 'Saved version',
          doc: JSON.stringify(parsed.doc),
        },
      })
      // keep history manageable: retain newest 40 versions
      const versions = await db.projectVersion.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'desc' },
        skip: 40,
        select: { id: true },
      })
      if (versions.length) {
        await db.projectVersion.deleteMany({ where: { id: { in: versions.map((v) => v.id) } } })
      }
    }
    return ok({ project: { id: updated.id, name: updated.name, type: updated.type, updatedAt: updated.updatedAt } })
  })
}

// DELETE → archive (soft). ?hard=true → permanent delete.
export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (user: SessionUser) => {
    const row = await getOwnedProject(user.id, id)
    if (!row) return fail('Project not found', 404)
    const hard = new URL(req.url).searchParams.get('hard') === 'true'
    if (hard) {
      await db.designProject.delete({ where: { id } })
      return ok({ deleted: true, hard: true })
    }
    await db.designProject.update({ where: { id }, data: { archived: true } })
    return ok({ deleted: true, hard: false })
  })
}
