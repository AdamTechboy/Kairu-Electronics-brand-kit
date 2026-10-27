import { ok, fail, parseBody } from '@/lib/api-helpers'
import { z } from 'zod'
import { getSessionUser } from '@/lib/auth/server'

const schema = z.object({
  instruction: z.string().min(2).max(1200),
  docSummary: z.string().max(24000),
  brandContext: z.string().max(4000).optional(),
  designType: z.string().max(40).optional(),
})

const PATCH_KEYS = [
  'fill', 'stroke', 'strokeWidth', 'fontSize', 'fontWeight', 'fontFamily', 'text',
  'x', 'y', 'w', 'h', 'rotation', 'opacity', 'align', 'letterSpacing', 'visible',
  'colorRole', 'strokeRole', 'radius', 'uppercase', 'italic', 'lineHeight', 'name',
] as const

function extractJson(raw: string): unknown | null {
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return null
  }
}

// POST /api/ai/assistant
// LLM design assistant: returns a structured, previewable edit proposal.
// The client previews the proposal and explicitly accepts or rejects it —
// nothing in a saved project is overwritten automatically.
export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return fail('Please sign in to continue.', 401)

  const parsed = await parseBody(req, schema)
  if (parsed instanceof Response) return parsed

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    const system = [
      'You are the AI design assistant inside a brand-kit web app for a business owner who is NOT a designer.',
      'You receive a JSON summary of the currently open editable design (elements with ids, types, positions, styles) plus brand context.',
      'Reply with STRICT JSON only, no markdown fences, matching exactly:',
      '{"reply": string, "updates": [{"id": string, "patch": object}], "removeIds": string[], "recolor": {"role": "primary|secondary|accent|dark|light", "color": string} | null}',
      'Rules:',
      '- "reply": one or two short, friendly sentences describing what you propose.',
      '- "updates": only elements that truly need changing. "patch" may contain ONLY these keys: ' + PATCH_KEYS.join(', ') + '.',
      '- Use the ids exactly as given in the design summary. Never invent ids.',
      '- Colors must be hex like #RRGGBB. Never move or resize the solar panel unless explicitly asked.',
      '- Keep text changes truthful: never invent prices, phone numbers, or business claims.',
      '- If the request cannot be expressed as these edits, leave updates empty and explain kindly in "reply".',
      '- If the user asks to change a brand colour overall, use "recolor".',
    ].join('\n')

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: system },
        {
          role: 'user',
          content: `Design type: ${parsed.designType ?? 'design'}\n\nBrand context: ${
            parsed.brandContext ?? 'none'
          }\n\nCurrent design JSON:\n${parsed.docSummary}\n\nOwner instruction: ${parsed.instruction}`,
        },
      ],
      thinking: { type: 'disabled' },
    })

    const raw = completion.choices[0]?.message?.content ?? ''
    const parsedJson = extractJson(raw)
    if (!parsedJson || typeof parsedJson !== 'object') {
      return ok({
        reply: raw.slice(0, 600) || 'I could not interpret that request. Please try rephrasing.',
        updates: [],
        removeIds: [],
        recolor: null,
      })
    }
    const obj = parsedJson as Record<string, unknown>
    const updates: { id: string; patch: Record<string, unknown> }[] = []
    if (Array.isArray(obj.updates)) {
      for (const u of obj.updates) {
        if (u && typeof u === 'object' && typeof (u as Record<string, unknown>).id === 'string') {
          const patchRaw = (u as Record<string, unknown>).patch
          if (patchRaw && typeof patchRaw === 'object') {
            const clean: Record<string, unknown> = {}
            for (const [k, v] of Object.entries(patchRaw as Record<string, unknown>)) {
              if ((PATCH_KEYS as readonly string[]).includes(k)) clean[k] = v
            }
            if (Object.keys(clean).length) updates.push({ id: (u as { id: string }).id, patch: clean })
          }
        }
      }
    }
    const removeIds = Array.isArray(obj.removeIds) ? obj.removeIds.filter((v) => typeof v === 'string') : []
    let recolor: { role: string; color: string } | null = null
    if (obj.recolor && typeof obj.recolor === 'object') {
      const r = obj.recolor as Record<string, unknown>
      if (typeof r.role === 'string' && typeof r.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(r.color)) {
        recolor = { role: r.role, color: r.color }
      }
    }
    return ok({
      reply: typeof obj.reply === 'string' ? obj.reply.slice(0, 800) : 'Here is my proposal.',
      updates,
      removeIds,
      recolor,
    })
  } catch (err) {
    console.error('[ai/assistant]', err)
    return fail(
      'The AI assistant is not available right now. Your design is safe — please try again later.',
      503
    )
  }
}
