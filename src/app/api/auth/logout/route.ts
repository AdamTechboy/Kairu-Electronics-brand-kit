import { clearSessionCookie } from '@/lib/auth/server'
import { ok } from '@/lib/api-helpers'

export async function POST() {
  await clearSessionCookie()
  return ok({ success: true })
}
