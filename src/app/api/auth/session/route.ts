import { db } from '@/lib/db'
import { getSessionUser, issueSessionToken } from '@/lib/auth/server'
import { ok } from '@/lib/api-helpers'

export async function GET() {
  const [user, ownerCount] = await Promise.all([getSessionUser(), db.user.count()])
  // Sliding session: every time a valid credential is presented we hand back a
  // freshly minted token so an active owner is never logged out mid-work.
  const token = user ? await issueSessionToken(user.id) : null
  return ok({ user, hasOwner: ownerCount > 0, token })
}
