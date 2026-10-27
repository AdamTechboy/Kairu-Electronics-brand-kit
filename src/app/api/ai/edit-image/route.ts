import { ok, fail, parseBody } from '@/lib/api-helpers'
import { z } from 'zod'
import { getSessionUser } from '@/lib/auth/server'

const SIZES = ['1024x1024', '768x1344', '864x1152', '1344x768', '1152x864', '1440x720', '720x1440'] as const
type AiSize = (typeof SIZES)[number]

const schema = z.object({
  image: z
    .string()
    .min(30)
    .max(6_000_000)
    .refine((v) => v.startsWith('data:image/'), { message: 'image must be a data-url' }),
  prompt: z.string().min(3).max(1200),
  size: z.string().max(12).optional(),
})

// POST /api/ai/edit-image — AI edit of an uploaded reference image.
// The result is a FLATTENED raster proposal. The UI must label it as such and
// always keep the original reference + the editable design intact.
export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return fail('Please sign in to continue.', 401)

  const parsed = await parseBody(req, schema)
  if (parsed instanceof Response) return parsed
  const size: AiSize = (SIZES as readonly string[]).includes(parsed.size ?? '') ? (parsed.size as AiSize) : '1024x1024'

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()
    const response = await zai.images.generations.edit({
      prompt: parsed.prompt,
      // The image-edit API expects an `images` array of {url} entries
      // (the data-url is passed inline as the url value).
      images: [{ url: parsed.image }],
      size,
    } as unknown as Parameters<typeof zai.images.generations.edit>[0])
    const base64 = response.data?.[0]?.base64
    if (!base64) return fail('The image editing service returned an empty result. Please try again.', 502)
    return ok({ dataUrl: `data:image/png;base64,${base64}`, size, flattened: true })
  } catch (err) {
    console.error('[ai/edit-image]', err)
    return fail('AI image editing is not available right now. Your uploaded reference was not modified.', 503)
  }
}
