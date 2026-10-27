import { db } from '@/lib/db'
import { withAuth, ok, parseBody, projectCreateSchema } from '@/lib/api-helpers'
import type { SessionUser } from '@/lib/auth/server'

// GET /api/projects?type=&templates=&archived=&q=
export async function GET(req: Request) {
  return withAuth(async (user: SessionUser) => {
    const url = new URL(req.url)
    const type = url.searchParams.get('type') || undefined
    const templates = url.searchParams.get('templates') // 'only' | 'exclude' | undefined(all)
    const archived = url.searchParams.get('archived') === 'true'
    const q = url.searchParams.get('q') || undefined
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 500)

    const rows = await db.designProject.findMany({
      where: {
        userId: user.id,
        ...(type ? { type } : {}),
        ...(templates === 'only' ? { isTemplate: true } : templates === 'exclude' ? { isTemplate: false } : {}),
        archived,
        ...(q ? { name: { contains: q } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        type: true,
        preview: true,
        isTemplate: true,
        templateOf: true,
        archived: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return ok({ projects: rows })
  })
}

// POST /api/projects
export async function POST(req: Request) {
  return withAuth(async (user: SessionUser) => {
    const parsed = await parseBody(req, projectCreateSchema)
    if (parsed instanceof Response) return parsed
    const row = await db.designProject.create({
      data: {
        userId: user.id,
        name: parsed.name,
        type: parsed.type,
        doc: JSON.stringify(parsed.doc),
        preview: parsed.preview ?? '',
        isTemplate: parsed.isTemplate ?? false,
        templateOf: parsed.templateOf ?? null,
      },
    })
    await db.projectVersion.create({
      data: {
        projectId: row.id,
        label: 'Initial version',
        doc: JSON.stringify(parsed.doc),
      },
    })
    return ok({ project: { id: row.id, name: row.name, type: row.type } })
  })
}
