import { db } from '@/lib/db'
import { requireUser, hashPassword, verifyPassword } from '@/lib/auth/server'
import { fail, ok, parseBody } from '@/lib/api-helpers'
import { z } from 'zod'

const schema = z.object({
  name: z.string().max(120).optional(),
  currentPassword: z.string().max(100).optional(),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(100).optional(),
})

export async function PUT(req: Request) {
  const parsed = await parseBody(req, schema)
  if (parsed instanceof Response) return parsed
  try {
    const session = await requireUser()
    const data: { name?: string; passwordHash?: string } = {}
    if (parsed.name !== undefined) data.name = parsed.name.trim()
    if (parsed.newPassword) {
      const user = await db.user.findUnique({ where: { id: session.id } })
      if (!user) return fail('Account not found', 404)
      if (!parsed.currentPassword || !(await verifyPassword(parsed.currentPassword, user.passwordHash))) {
        return fail('Current password is incorrect.', 403)
      }
      data.passwordHash = await hashPassword(parsed.newPassword)
    }
    const updated = await db.user.update({ where: { id: session.id }, data })
    return ok({ user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role } })
  } catch {
    return fail('Please sign in to continue.', 401)
  }
}
