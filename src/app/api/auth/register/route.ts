import { db } from '@/lib/db'
import { hashPassword, setSessionCookie, issueSessionToken } from '@/lib/auth/server'
import { fail, ok, parseBody } from '@/lib/api-helpers'
import { z } from 'zod'
import { DEFAULT_BRAND } from '@/lib/brand'

const schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  name: z.string().max(120).optional(),
})

export async function POST(req: Request) {
  const parsed = await parseBody(req, schema)
  if (parsed instanceof Response) return parsed

  const existingUsers = await db.user.count()
  if (existingUsers > 0) {
    return fail('The owner account already exists. Please sign in instead.', 403)
  }

  const email = parsed.email.toLowerCase().trim()
  const duplicate = await db.user.findUnique({ where: { email } })
  if (duplicate) return fail('An account with this email already exists.', 409)

  const passwordHash = await hashPassword(parsed.password)
  const user = await db.user.create({
    data: {
      email,
      name: parsed.name?.trim() || 'Business Owner',
      passwordHash,
      role: 'owner',
    },
  })

  // Seed persistent brand settings with the owner's verified business info
  await db.brandSettings.create({
    data: {
      userId: user.id,
      businessName: DEFAULT_BRAND.businessName,
      businessCategory: DEFAULT_BRAND.businessCategory,
      description: DEFAULT_BRAND.description,
      shortDescription: DEFAULT_BRAND.shortDescription,
      tagline: DEFAULT_BRAND.tagline,
      address: DEFAULT_BRAND.address,
      phones: JSON.stringify(DEFAULT_BRAND.phones),
      email: DEFAULT_BRAND.email,
      website: DEFAULT_BRAND.website,
      socials: JSON.stringify(DEFAULT_BRAND.socials),
      openingHours: DEFAULT_BRAND.openingHours,
      extraInfo: DEFAULT_BRAND.extraInfo,
      palette: JSON.stringify(DEFAULT_BRAND.palette),
      typography: JSON.stringify(DEFAULT_BRAND.typography),
    },
  })

  await setSessionCookie(user.id)
  const token = await issueSessionToken(user.id)
  return ok({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, token })
}
