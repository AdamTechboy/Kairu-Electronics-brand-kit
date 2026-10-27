'use client'

// AI Design Assistant: LLM edit proposals (preview before apply), image
// generation for backgrounds, and AI editing of uploaded reference images.
// AI results never overwrite saved work without explicit confirmation.

import { useRef, useState } from 'react'
import type { DesignDocument, DesignElement, ProjectType } from '@/lib/design/types'
import { el, uid } from '@/lib/design/types'
import type { BrandSettings } from '@/lib/brand'
import { aiApi } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sparkles, Loader2, Wand2, ImageIcon, Upload, Check, X, Info, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { compressImageFile } from './media-utils'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  doc: DesignDocument
  brand: BrandSettings
  designType: ProjectType
  onPreview: (doc: DesignDocument) => void
  onCommit: (doc: DesignDocument) => void
}

function summarizeDoc(doc: DesignDocument): string {
  const page = doc.pages[0]
  const slim = {
    canvas: { width: doc.width, height: doc.height },
    elements: page.elements.map((e) => ({
      id: e.id,
      type: e.type,
      name: e.name,
      text: e.type === 'text' ? e.text?.slice(0, 80) : undefined,
      x: e.x, y: e.y, w: e.w, h: e.h,
      fontSize: e.fontSize, fontWeight: e.fontWeight, fontFamily: e.fontFamily,
      fill: e.fill, colorRole: e.colorRole, align: e.align,
      symbol: e.symbol,
      locked: e.locked,
    })),
  }
  return JSON.stringify(slim)
}

export function AiPanel({ open, onOpenChange, doc, brand, designType, onPreview, onCommit }: Props) {
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState<string | null>(null)
  const [proposal, setProposal] = useState<DesignDocument | null>(null)
  const [genPrompt, setGenPrompt] = useState('')
  const [genBusy, setGenBusy] = useState(false)
  const [genResult, setGenResult] = useState<string | null>(null)
  const [refImage, setRefImage] = useState<string | null>(null)
  const [refName, setRefName] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [editResult, setEditResult] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const brandContext = [
    `Business: ${brand.businessName} (${brand.businessCategory})`,
    `Colours: primary ${brand.palette.primary}, secondary ${brand.palette.secondary}, accent ${brand.palette.accent}, dark ${brand.palette.dark}, light ${brand.palette.light}`,
    `Fonts: headings ${brand.typography.headingFont}, body ${brand.typography.bodyFont}`,
    `Address: ${brand.address}`,
    `Phones: ${brand.phones.join(', ')}`,
  ].join('\n')

  const runAssistant = async () => {
    if (instruction.trim().length < 2) return
    setBusy(true)
    setReply(null)
    setProposal(null)
    try {
      const result = await aiApi.assistant({
        instruction,
        docSummary: summarizeDoc(doc),
        brandContext,
        designType,
      })
      setReply(result.reply)
      if (result.updates.length || result.removeIds.length || result.recolor) {
        const next: DesignDocument = JSON.parse(JSON.stringify(doc))
        for (const page of next.pages) {
          page.elements = page.elements
            .filter((e) => !result.removeIds.includes(e.id))
            .map((e) => {
              const upd = result.updates.find((u) => u.id === e.id)
              if (!upd) return e
              return { ...e, ...upd.patch } as DesignElement
            })
        }
        if (result.recolor) {
          const role = result.recolor.role as keyof BrandSettings['palette']
          if (brand.palette[role] !== undefined) {
            for (const page of next.pages) {
              for (const e of page.elements) {
                if (e.colorRole === role) e.fill = result.recolor.color
                if (e.strokeRole === role) e.stroke = result.recolor.color
              }
            }
          }
        }
        setProposal(next)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI request failed')
    } finally {
      setBusy(false)
    }
  }

  const generateImage = async () => {
    if (genPrompt.trim().length < 3) return
    setGenBusy(true)
    setGenResult(null)
    try {
      const res = await aiApi.generateImage({ prompt: genPrompt, size: '1024x1024' })
      setGenResult(res.dataUrl)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Image generation failed')
    } finally {
      setGenBusy(false)
    }
  }

  const applyGeneratedImage = (dataUrl: string, asBackground: boolean) => {
    const img = new Image()
    img.onload = () => {
      if (asBackground) {
        const scale = Math.max(doc.width / img.width, doc.height / img.height)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const newEl = el('image', { x: Math.round((doc.width - w) / 2), y: Math.round((doc.height - h) / 2), w, h, src: dataUrl, fit: 'cover', name: 'AI background' })
        // background goes to the very back
        const next: DesignDocument = JSON.parse(JSON.stringify(doc))
        next.pages[0].elements = [newEl, ...next.pages[0].elements]
        onCommit(next)
      } else {
        const w = Math.round(doc.width * 0.45)
        const h = Math.round((w * img.height) / img.width)
        const newEl = el('image', { x: Math.round(doc.width * 0.5 - w / 2), y: Math.round(doc.height * 0.5 - h / 2), w, h, src: dataUrl, fit: 'contain', name: 'AI image' })
        const next: DesignDocument = JSON.parse(JSON.stringify(doc))
        next.pages[0].elements = [...next.pages[0].elements, newEl]
        onCommit(next)
      }
      toast.success('AI image added to the design.')
      onOpenChange(false)
    }
    img.src = dataUrl
  }

  const pickRef = async (file: File | undefined) => {
    if (!file) return
    try {
      const compressed = await compressImageFile(file, 1200)
      setRefImage(compressed.dataUrl)
      setRefName(file.name)
      setEditResult(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read the image')
    }
  }

  const runEditImage = async () => {
    if (!refImage || editPrompt.trim().length < 3) return
    setEditBusy(true)
    setEditResult(null)
    try {
      const res = await aiApi.editImage({ image: refImage, prompt: editPrompt, size: '1024x1024' })
      setEditResult(res.dataUrl)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI image editing failed')
    } finally {
      setEditBusy(false)
    }
  }

  const acceptEditedImage = () => {
    if (!editResult) return
    const img = new Image()
    img.onload = () => {
      const w = Math.round(doc.width * 0.5)
      const h = Math.round((w * img.height) / img.width)
      const newEl = el('image', { x: Math.round(doc.width * 0.5 - w / 2), y: Math.round(doc.height * 0.5 - h / 2), w, h, src: editResult, fit: 'contain', name: `AI edit of ${refName || 'reference'}` })
      const next: DesignDocument = JSON.parse(JSON.stringify(doc))
      next.pages[0].elements = [...next.pages[0].elements, newEl]
      onCommit(next)
      toast.success('AI-edited image added as a new layer — your original reference is untouched.')
      onOpenChange(false)
    }
    img.src = editResult
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-600" /> AI Design Assistant</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="assistant" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-4 mt-3 grid grid-cols-3">
            <TabsTrigger value="assistant" className="text-xs">Assistant</TabsTrigger>
            <TabsTrigger value="generate" className="text-xs">Images</TabsTrigger>
            <TabsTrigger value="reference" className="text-xs">Reference</TabsTrigger>
          </TabsList>

          {/* -------- assistant -------- */}
          <TabsContent value="assistant" className="flex-1 space-y-3 p-4">
            <p className="text-xs text-muted-foreground">
              Describe a change in plain words. The assistant proposes edits that you preview and accept — nothing is applied to your saved design until you confirm.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['Change the main brand colour to dark green', 'Make the business name more readable', 'Make the headline bigger', 'Give the design more whitespace'].map((s) => (
                <button key={s} onClick={() => setInstruction(s)} className="rounded-full border px-2.5 py-1 text-[11px] transition hover:bg-muted">{s}</button>
              ))}
            </div>
            <Textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={3} placeholder='e.g. "Make the prices more prominent and move the contact bar up"' />
            <Button className="w-full gap-2" onClick={() => void runAssistant()} disabled={busy || instruction.trim().length < 2}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {busy ? 'Thinking…' : 'Propose changes'}
            </Button>
            {reply && (
              <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm" data-testid="ai-reply">
                <p className="flex gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />{reply}</p>
                {proposal && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => { onPreview(proposal); onOpenChange(false) }}>
                      <Eye className="h-3.5 w-3.5" /> Preview on canvas
                    </Button>
                    <Button size="sm" className="flex-1 gap-1 bg-green-700 hover:bg-green-800" onClick={() => { onCommit(proposal); onOpenChange(false) }}>
                      <Check className="h-3.5 w-3.5" /> Accept
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* -------- generate -------- */}
          <TabsContent value="generate" className="flex-1 space-y-3 p-4">
            <p className="text-xs text-muted-foreground">
              Generate AI images to use as flyer backgrounds or inspiration. Results are raster images — clearly separate from your editable vector design.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['Subtle navy gradient background with soft light rays', 'Golden bokeh lights on dark background', 'Clean white studio backdrop with soft shadow'].map((s) => (
                <button key={s} onClick={() => setGenPrompt(s)} className="rounded-full border px-2.5 py-1 text-[11px] transition hover:bg-muted">{s}</button>
              ))}
            </div>
            <Textarea value={genPrompt} onChange={(e) => setGenPrompt(e.target.value)} rows={2} placeholder="Describe the image you want…" />
            <Button className="w-full gap-2" onClick={() => void generateImage()} disabled={genBusy || genPrompt.trim().length < 3}>
              {genBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              {genBusy ? 'Generating (may take ~30s)…' : 'Generate image'}
            </Button>
            {genResult && (
              <div className="space-y-2">
                <img src={genResult} alt="AI generated" className="max-h-52 w-full rounded-lg border object-contain" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => applyGeneratedImage(genResult, true)}>Use as background</Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => applyGeneratedImage(genResult, false)}>Insert as image</Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* -------- reference image editing -------- */}
          <TabsContent value="reference" className="flex-1 space-y-3 p-4">
            <p className="text-xs text-muted-foreground">
              Upload your reference (e.g. your original logo) and describe the change. The AI returns a <strong>flattened image proposal</strong> — it never replaces your editable design. You keep the original.
            </p>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { void pickRef(e.target.files?.[0]); e.currentTarget.value = '' }} />
            {!refImage ? (
              <button onClick={() => fileRef.current?.click()} className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm text-muted-foreground transition hover:border-amber-400 hover:bg-amber-50/50">
                <Upload className="h-6 w-6" />
                Upload reference or inspiration image
              </button>
            ) : (
              <div className="space-y-2">
                <img src={refImage} alt={refName || 'Reference'} className="max-h-40 w-full rounded-lg border object-contain" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => fileRef.current?.click()}>Replace</Button>
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => { setRefImage(null); setEditResult(null) }}>Remove</Button>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Instruction</Label>
              <Textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} rows={3} placeholder='e.g. "Keep the solar panel in exactly the same position, make the MK lettering bolder, keep the original style"' />
            </div>
            <Button className="w-full gap-2" onClick={() => void runEditImage()} disabled={editBusy || !refImage || editPrompt.trim().length < 3}>
              {editBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {editBusy ? 'Applying changes (may take ~30s)…' : 'Apply Changes'}
            </Button>
            {editResult && (
              <div className="space-y-2">
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-800">
                  Flattened AI proposal — not an editable vector. Review before using.
                </div>
                <img src={editResult} alt="AI edited proposal" className="max-h-52 w-full rounded-lg border object-contain" />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 gap-1" onClick={acceptEditedImage}><Check className="h-3.5 w-3.5" /> Add to design</Button>
                  <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => setEditResult(null)}><X className="h-3.5 w-3.5" /> Discard</Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
