import { db } from '@/lib/db'
import { ok } from '@/lib/api-helpers'

export async function GET() {
  try {
    await db.user.count()
    return ok({ status: 'ok', database: 'connected', time: new Date().toISOString() })
  } catch (err) {
    return ok({ status: 'degraded', database: 'unavailable', error: err instanceof Error ? err.message : 'unknown' })
  }
}
