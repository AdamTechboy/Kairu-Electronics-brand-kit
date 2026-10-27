'use client'

// Designer view: template picker for letterhead / business card /
// complimentary card / social post, then opens the shared editor.
// Also accepts the owner's own uploaded artwork as a starting point — the
// upload becomes a fully editable canvas (add text, logo, prices, export).

import { useApp } from '../app-context'
import { TEMPLATES } from '@/lib/design/templates'
import { docToSvg } from '@/lib/design/svg'
import { fillLogoPlaceholders, useOfficialLogoDataUrl } from '@/lib/design/logo-resolver'
import { el, newPage, type ProjectType, type DesignDocument } from '@/lib/design/types'
import { compressImageFile } from '@/components/studio/media-utils'
import { Button } from '@/components/ui/button'
import { Pencil, FileText, IdCard, MessageSquareQuote, Share2, FolderOpen, Upload, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { projectApi } from '@/lib/api-client'
import type { ProjectSummary } from '@/lib/api-client'
import { toast } from 'sonner'

const TYPE_META: Record<string, { title: string; blurb: string; icon: React.ComponentType<{ className?: string }> }> = {
  letterhead: { title: 'Letterhead Designer', blurb: 'Official letters, quotations and proposals on branded A4.', icon: FileText },
  'business-card': { title: 'Business Card Designer', blurb: 'Front and back, print-ready at 3.5×2 inches.', icon: IdCard },
  'complimentary-card': { title: 'Complimentary Card Designer', blurb: 'Thank-you, appreciation and promo insert cards.', icon: MessageSquareQuote },
  'social-post': { title: 'Social Media Designer', blurb: 'Square, story and landscape promotional posts.', icon: Share2 },
}

function TemplateThumb({ templateId }: { templateId: string }) {
  const { brand } = useApp()
  const logoDataUrl = useOfficialLogoDataUrl(brand)
  const svg = useMemo(() => {
    const t = TEMPLATES.find((x) => x.id === templateId)
    if (!t) return ''
    const doc = t.build(brand)
    return docToSvg(logoDataUrl ? fillLogoPlaceholders(doc, logoDataUrl) : doc, { palette: brand.palette, pageIndex: 0, includeBackground: true })
  }, [templateId, brand, logoDataUrl])
  return (
    <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border bg-[#EDEAE2] p-2">
      <div className="[&_svg]:h-auto [&_svg]:w-auto [&_svg]:max-h-full [&_svg]:max-w-full" style={{ maxHeight: 140 }} dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  )
}

export function DesignerView() {
  const { viewParam, brand, openEditor } = useApp()
  const type = (viewParam || 'letterhead') as ProjectType
  const meta = TYPE_META[type] ?? TYPE_META.letterhead
  const templates = TEMPLATES.filter((t) => t.type === type)
  const [saved, setSaved] = useState<ProjectSummary[]>([])
  const [uploading, setUploading] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)
  const Icon = meta.icon

  useEffect(() => {
    projectApi.list({ type, templates: 'exclude', archived: false })
      .then((r) => setSaved(r.projects))
      .catch(() => {})
  }, [type])

  // Turn an uploaded picture into an editable document: the picture fills the
  // canvas as a movable/resizable image and every text/logo tool still works.
  const handleUpload = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const img = await compressImageFile(file, 1600)
      const long = Math.max(img.width, img.height)
      const scale = Math.min(1, 1080 / long)
      const W = Math.max(200, Math.round(img.width * scale))
      const H = Math.max(200, Math.round(img.height * scale))
      const doc: DesignDocument = {
        version: 1,
        width: W,
        height: H,
        background: '#ffffff',
        pages: [
          {
            ...newPage('Custom design', '#ffffff'),
            elements: [el('image', { name: file.name.slice(0, 40) || 'Uploaded design', src: img.dataUrl, x: 0, y: 0, w: W, h: H, fit: 'contain' })],
          },
        ],
        meta: { type, notes: 'Uploaded custom design' },
      }
      openEditor({
        initialDoc: doc,
        initialName: (file.name.replace(/\.[a-z0-9]+$/i, '') || 'Custom design').slice(0, 60),
        initialType: type,
        backTo: 'designer',
      })
      toast.success('Your design is open in the editor — add text, prices and your logo, then export.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read that image')
    } finally {
      setUploading(false)
      if (uploadRef.current) uploadRef.current.value = ''
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8" data-testid="designer">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Icon className="h-6 w-6 text-amber-600" /> {meta.title}</h1>
        <p className="text-sm text-muted-foreground">{meta.blurb} Your business details from Brand Settings are filled in automatically.</p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Choose a starting design</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {/* upload own design */}
          <div className="flex flex-col overflow-hidden rounded-xl border-2 border-dashed bg-background transition hover:border-amber-400">
            <button
              onClick={() => uploadRef.current?.click()}
              disabled={uploading}
              className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center"
              data-testid="upload-custom-design"
            >
              {uploading ? <Loader2 className="h-6 w-6 animate-spin text-amber-600" /> : <Upload className="h-6 w-6 text-amber-600" />}
              <p className="text-xs font-semibold leading-tight">Upload your own design</p>
              <p className="text-[11px] text-muted-foreground">Use a picture or template file — then add text, prices and your logo on top.</p>
            </button>
            <div className="p-3 pt-0">
              <Button size="sm" variant="outline" className="w-full text-xs" disabled={uploading} onClick={() => uploadRef.current?.click()}>
                Choose file
              </Button>
            </div>
            <input
              ref={uploadRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files)}
            />
          </div>

          {templates.map((t) => (
            <div key={t.id} className="overflow-hidden rounded-xl border bg-background transition hover:shadow-md">
              <TemplateThumb templateId={t.id} />
              <div className="p-3">
                <p className="text-xs font-semibold">{t.name}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{t.description}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full text-xs"
                  onClick={() => openEditor({ templateId: t.id, initialName: t.name, initialType: t.type, backTo: 'designer' })}
                >
                  <Pencil className="mr-1 h-3 w-3" /> Customise
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {saved.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Continue your {meta.title.replace(' Designer', '').replace('Designer', '')} designs</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {saved.map((p) => (
              <button key={p.id} onClick={() => openEditor({ projectId: p.id, backTo: 'designer' })} className="overflow-hidden rounded-xl border bg-background text-left transition hover:shadow-md">
                <div className="flex aspect-[4/3] items-center justify-center bg-muted p-2">
                  {p.preview ? <img src={p.preview} alt={p.name} className="max-h-full max-w-full object-contain" /> : <FolderOpen className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="p-3">
                  <p className="truncate text-xs font-semibold">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">Edited {new Date(p.updatedAt).toLocaleDateString()}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
