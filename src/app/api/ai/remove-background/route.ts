import sharp from 'sharp'
import { z } from 'zod'
import { ok, fail, parseBody } from '@/lib/api-helpers'
import { getSessionUser } from '@/lib/auth/server'
import { removeConnectedBorderColor } from '@/lib/background-removal'

export const runtime = 'nodejs'
export const maxDuration = 60

const schema = z.object({
  image: z.string().min(30).max(6_000_000).refine((v) => /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(v), {
    message: 'Choose a valid base64 image data URL.',
  }),
})

function pixelAlphaRatio(rgba: Uint8Array): number {
  let transparent = 0
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 250) transparent += 1
  return transparent / Math.max(1, rgba.length / 4)
}

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return fail('Please sign in to continue.', 401)
  const parsed = await parseBody(req, schema)
  if (parsed instanceof Response) return parsed

  const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/.exec(parsed.image)
  if (!match) return fail('The uploaded image data is invalid.', 400)

  try {
    const inputBuffer = Buffer.from(match[1], 'base64')
    const inputMeta = await sharp(inputBuffer, { limitInputPixels: 40_000_000 }).metadata()
    if (!inputMeta.width || !inputMeta.height || inputMeta.width * inputMeta.height > 40_000_000) {
      return fail('This image is too large to process safely. Please choose a smaller image.', 413)
    }

    let candidate = inputBuffer
    let aiSucceeded = false
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()
      const response = await zai.images.generations.edit({
        prompt: 'Remove the entire background from this product photo. Keep the complete foreground product intact, with clean anti-aliased edges. Return a PNG with real transparent alpha pixels outside the product, not a white, solid-colour, blurred or checkerboard background. Do not crop, recolour, redesign, or add anything to the product.',
        images: [{ url: parsed.image }],
        size: '1024x1024',
      } as unknown as Parameters<typeof zai.images.generations.edit>[0])
      const base64 = response.data?.[0]?.base64
      if (!base64) throw new Error('The background removal service returned no image data.')
      candidate = Buffer.from(base64, 'base64')
      aiSucceeded = true
    } catch (err) {
      // Keep the feature useful on a flat-color background if AI is temporarily unavailable.
      console.warn('[ai/remove-background] AI fallback to edge-connected matte removal:', err instanceof Error ? err.message : 'unknown error')
    }

    const decoded = await sharp(candidate, { limitInputPixels: 40_000_000 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const width = decoded.info.width
    const height = decoded.info.height
    if (!width || !height || decoded.info.channels !== 4) return fail('The image service returned an unsupported image.', 502)
    let output: Buffer

    const alphaRatio = pixelAlphaRatio(decoded.data)
    if (aiSucceeded && alphaRatio > 0.001 && alphaRatio < 0.998) {
      output = await sharp(candidate).png().toBuffer()
    } else {
      const cleaned = removeConnectedBorderColor(decoded.data, width, height, 58)
      const removedRatio = cleaned.removedPixels / (width * height)
      if (removedRatio < 0.001) {
        return fail('A clear background could not be identified. Try a photo with a plain, contrasting background, or choose a different image.', 422)
      }
      if (removedRatio > 0.985) {
        return fail('The background remover would remove almost the whole image. Try a clearer photo where the product is separated from the background.', 422)
      }
      output = await sharp(Buffer.from(cleaned.data), { raw: { width, height, channels: 4 } }).png().toBuffer()
    }

    const finalMeta = await sharp(output).metadata()
    const finalRaw = await sharp(output).ensureAlpha().raw().toBuffer()
    const transparencyApplied = pixelAlphaRatio(finalRaw) > 0.001
    if (!transparencyApplied) return fail('No transparent background was produced. Try another photo with a clearer subject/background contrast.', 422)

    return ok({
      dataUrl: `data:image/png;base64,${output.toString('base64')}`,
      width: finalMeta.width ?? width,
      height: finalMeta.height ?? height,
      transparencyApplied: true,
    })
  } catch (err) {
    console.error('[ai/remove-background]', err)
    return fail('Could not remove this image background. Use a PNG/JPG/WebP photo with a clearly separated subject and try again.', 502)
  }
}
