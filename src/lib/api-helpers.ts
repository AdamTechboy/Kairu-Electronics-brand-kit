import { NextResponse } from 'next/server'
import { AuthError, requireUser } from '@/lib/auth/server'
import type { SessionUser } from '@/lib/auth/server'
import { z } from 'zod'

export function ok<T>(data: T, init?: number) {
  return NextResponse.json(data as object, { status: init ?? 200 })
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

// Wrap a handler with auth + error handling
export async function withAuth<T>(fn: (user: SessionUser) => Promise<T>): Promise<T | NextResponse> {
  try {
    const user = await requireUser()
    return await fn(user)
  } catch (err) {
    if (err instanceof AuthError) return fail('Please sign in to continue.', 401)
    console.error('[api]', err)
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    return fail(message, 500)
  }
}

export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T | NextResponse> {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return fail('Invalid JSON body', 400)
  }
  const result = schema.safeParse(json)
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ')
    return fail(msg || 'Invalid input', 400)
  }
  return result.data
}

// ---------- shared zod schemas ----------

export const paletteSchema = z.object({
  primary: z.string().min(3).max(40),
  secondary: z.string().min(3).max(40),
  accent: z.string().min(3).max(40),
  dark: z.string().min(3).max(40),
  light: z.string().min(3).max(40),
})

export const docSchema = z.any() // deep-validated client-side; shape checked on save

export const projectCreateSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.string().min(1).max(40),
  doc: docSchema,
  isTemplate: z.boolean().optional(),
  templateOf: z.string().max(80).optional().nullable(),
  preview: z.string().max(500_000).optional(),
})

export const projectUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  doc: docSchema.optional(),
  preview: z.string().max(500_000).optional(),
  isTemplate: z.boolean().optional(),
  archived: z.boolean().optional(),
  versionLabel: z.string().max(120).optional(),
  snapshot: z.boolean().optional(),
})

export const assetCreateSchema = z.object({
  filename: z.string().min(1).max(200),
  mimeType: z.string().refine((m) => ['image/png', 'image/jpeg', 'image/webp'].includes(m), {
    message: 'Only PNG, JPG and WebP images are supported',
  }),
  dataUrl: z
    .string()
    .min(24)
    .max(8_000_000)
    .refine((v) => v.startsWith('data:image/'), { message: 'dataUrl must be an image data-url' }),
  kind: z.enum(['image', 'logo-reference', 'product', 'background']).optional(),
  width: z.number().int().min(0).max(20000).optional(),
  height: z.number().int().min(0).max(20000).optional(),
  projectId: z.string().max(80).optional().nullable(),
})

export const productSchema = z.object({
  name: z.string().min(1).max(140),
  category: z.string().max(80).optional(),
  description: z.string().max(2000).optional(),
  price: z.string().max(40).optional(),
  availability: z.string().max(40).optional(),
  stockRef: z.string().max(80).optional(),
  notes: z.string().max(2000).optional(),
  imageAssetIds: z.array(z.string().max(80)).max(10).optional(),
})

export const brandUpdateSchema = z.object({
  businessName: z.string().min(1).max(140).optional(),
  businessCategory: z.string().max(140).optional(),
  description: z.string().max(4000).optional(),
  shortDescription: z.string().max(1000).optional(),
  tagline: z.string().max(200).optional(),
  address: z.string().max(400).optional(),
  phones: z.array(z.string().max(40)).max(6).optional(),
  email: z.string().max(140).optional(),
  website: z.string().max(200).optional(),
  socials: z.array(z.object({ label: z.string().max(40), handle: z.string().max(120) })).max(10).optional(),
  openingHours: z.string().max(300).optional(),
  extraInfo: z.string().max(1000).optional(),
  logoProjectId: z.string().max(80).nullable().optional(),
  logoApplyToSite: z.boolean().optional(),
  logoApplyToNewDesigns: z.boolean().optional(),
  palette: paletteSchema.optional(),
  typography: z
    .object({ headingFont: z.string().max(80), bodyFont: z.string().max(80) })
    .optional(),
})
