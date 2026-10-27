import { ok, fail, parseBody } from '@/lib/api-helpers'
import { z } from 'zod'
import { getSessionUser } from '@/lib/auth/server'

const SIZES = ['1024x1024', '768x1344', '864x1152', '1344x768', '1152x864', '1440x720', '720x1440'] as const
type AiSize = (typeof SIZES)[number]

const schema = z.object({
  prompt: z.string().min(3).max(1000),
  size: z.string().max(12).optional(),
})

// POST /api/ai/image — generate an AI image (backgrounds, inspiration).
// Clearly a raster result: never presented as the editable vector design itself.
export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return fail('Please sign in to continue.', 401)

  const parsed = await parseBody(req, schema)
  if (parsed instanceof Response) return parsed
  const size: AiSize = (SIZES as readonly string[]).includes(parsed.size ?? '') ? (parsed.size as AiSize) : '1024x1024'

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()
    const response = await zai.images.generations.create({ prompt: parsed.prompt, size })
    const base64 = response.data?.[0]?.base64
    if (!base64) return fail('The image service returned an empty result. Please try again.', 502)
    return ok({ dataUrl: `data:image/png;base64,${base64}`, size })
  } catch (err) {
    console.error('[ai/image]', err)
    return fail('AI image generation is not available right now. All manual design tools remain fully usable.', 503)
  }
}
