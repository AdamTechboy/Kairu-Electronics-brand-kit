import { db } from '@/lib/db'
import { withAuth, ok, parseBody } from '@/lib/api-helpers'
import { z } from 'zod'
import type { SessionUser } from '@/lib/auth/server'

const schema = z.object({
  projectId: z.string().max(80).optional().nullable(),
  projectName: z.string().max(140).optional(),
  projectType: z.string().max(40).optional(),
  format: z.enum(['pdf', 'png', 'jpg', 'svg', 'zip', 'print']),
  fileName: z.string().min(1).max(200),
  width: z.number().int().min(0).max(30000).optional(),
  height: z.number().int().min(0).max(30000).optional(),
  scale: z.string().max(10).optional(),
  paperSize: z.string().max(40).optional(),
})

export async function GET() {
  return withAuth(async (user: SessionUser) => {
    const rows = await db.exportRecord.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return ok({ exports: rows })
  })
}

export async function POST(req: Request) {
  return withAuth(async (user: SessionUser) => {
    const parsed = await parseBody(req, schema)
    if (parsed instanceof Response) return parsed
    const row = await db.exportRecord.create({
      data: {
        userId: user.id,
        projectId: parsed.projectId ?? null,
        projectName: parsed.projectName ?? '',
        projectType: parsed.projectType ?? '',
        format: parsed.format,
        fileName: parsed.fileName,
        width: parsed.width ?? 0,
        height: parsed.height ?? 0,
        scale: parsed.scale ?? '1',
        paperSize: parsed.paperSize ?? '',
      },
    })
    return ok({ record: row })
  })
}
