import { db } from '@/lib/db'
import { verifyPassword, setSessionCookie, issueSessionToken, checkRateLimit, clearRateLimit } from '@/lib/auth/server'
import { fail, ok, parseBody } from '@/lib/api-helpers'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(100),
})

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  if (!checkRateLimit(`login:${ip}`)) {
    return fail('Too many sign-in attempts. Please wait a few minutes and try again.', 429)
  }

  const parsed = await parseBody(req, schema)
  if (parsed instanceof Response) return parsed

  const email = parsed.email.toLowerCase().trim()
  const user = await db.user.findUnique({ where: { email } })
  if (!user) return fail('Incorrect email or password.', 401)

  const valid = await verifyPassword(parsed.password, user.passwordHash)
  if (!valid) return fail('Incorrect email or password.', 401)

  clearRateLimit(`login:${ip}`)
  await setSessionCookie(user.id)
  const token = await issueSessionToken(user.id)
  return ok({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, token })
}
