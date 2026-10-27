'use client'

// Brand Kit: the owner's approved identity in one place + live material previews.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../app-context'
import { projectApi } from '@/lib/api-client'
import type { DesignDocument } from '@/lib/design/types'
import { docToSvg } from '@/lib/design/svg'
import { fillLogoPlaceholders, useOfficialLogoDataUrl } from '@/lib/design/logo-resolver'
import { getTemplate, TEMPLATES } from '@/lib/design/templates'
import { downloadBrandKitZip } from '@/lib/export/exporter'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, Download, Pencil, Sparkles, FileText, IdCard, MessageSquareQuote, Share2 } from 'lucide-react'

function DocPreview({ doc: rawDoc, maxHeight = 150 }: { doc: DesignDocument; maxHeight?: number }) {
  const { brand } = useApp()
  const logoDataUrl = useOfficialLogoDataUrl(brand)
  const doc = useMemo(
    () => (logoDataUrl ? fillLogoPlaceholders(rawDoc, logoDataUrl) : rawDoc),
    [rawDoc, logoDataUrl]
  )
  const svg = useMemo(() => docToSvg(doc, { palette: brand.palette, pageIndex: 0, includeBackground: true }), [doc, brand.palette])
  const boxRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => {
      const cw = el.clientWidth
      const ch = el.clientHeight
      const scale = Math.min(cw / doc.width, ch / doc.height)
      setFit({ w: Math.floor(doc.width * scale), h: Math.floor(doc.height * scale) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [doc.width, doc.height])

  return (
    <div ref={boxRef} className="flex items-center justify-center overflow-hidden rounded-lg border bg-[#EDEAE2] p-2" style={{ height: maxHeight }}>
      {fit.w > 0 && (
        <div
          className="[&_svg]:block [&_svg]:h-full [&_svg]:w-full"
          style={{ width: fit.w, height: fit.h }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  )
}

export function BrandKitView() {
  const { brand, navigate, openEditor } = useApp()
  const [logoDoc, setLogoDoc] = useState<DesignDocument | null>(null)
  const [logoLoading, setLogoLoading] = useState(true)
  const [zipping, setZipping] = useState(false)

  useEffect(() => {
    setLogoLoading(true)
    if (!brand.logoProjectId) {
      setLogoDoc(null)
      setLogoLoading(false)
      return
    }
    projectApi.get(brand.logoProjectId)
      .then(({ project }) => setLogoDoc(project.doc as DesignDocument))
      .catch(() => setLogoDoc(null))
      .finally(() => setLogoLoading(false))
  }, [brand.logoProjectId])

  const materials = TEMPLATES.filter((t) => t.type !== 'logo')
  const materialIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    letterhead: FileText, 'business-card': IdCard, 'complimentary-card': MessageSquareQuote, 'social-post': Share2,
  }

  const zip = async () => {
    setZipping(true)
    try {
      const name = await downloadBrandKitZip(brand, brand.palette)
      toast.success(`Brand kit downloaded: ${name}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not build the brand kit ZIP')
    } finally {
      setZipping(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8" data-testid="brand-kit">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Brand Kit</h1>
          <p className="text-sm text-muted-foreground">Your approved identity — every new design starts from here.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => void zip()} disabled={zipping}>
          {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download brand kit (ZIP)
        </Button>
      </div>

      {/* logo */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-background p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Primary logo</h2>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => navigate('logo-studio')}><Pencil className="h-3.5 w-3.5" /> Edit in Logo Studio</Button>
          </div>
          {logoLoading ? (
            <div className="flex h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : logoDoc ? (
            <DocPreview doc={logoDoc} maxHeight={260} />
          ) : (
            <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center">
              <Sparkles className="h-8 w-8 text-amber-500" />
              <div>
                <p className="font-medium">No official logo selected yet</p>
                <p className="text-sm text-muted-foreground">Open the Logo Studio to create or choose one.</p>
              </div>
              <Button size="sm" className="bg-[#1F2A44] hover:bg-[#2a3a5c]" onClick={() => navigate('logo-studio')}>Open Logo Studio</Button>
            </div>
          )}
          <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
            <div className="rounded-lg bg-muted/70 p-2.5"><p className="font-semibold">{brand.businessName}</p><p className="text-muted-foreground">Business name</p></div>
            <div className="rounded-lg bg-muted/70 p-2.5"><p className="font-semibold">{brand.phones.join(' • ') || '—'}</p><p className="text-muted-foreground">Phone numbers</p></div>
            <div className="rounded-lg bg-muted/70 p-2.5"><p className="truncate font-semibold">{brand.address || '—'}</p><p className="text-muted-foreground">Address</p></div>
          </div>
        </div>

        {/* palette + typography */}
        <div className="space-y-4">
          <div className="rounded-2xl border bg-background p-5">
            <h2 className="mb-3 font-bold">Colour palette</h2>
            <div className="space-y-2">
              {(['primary', 'secondary', 'accent', 'dark', 'light'] as const).map((k) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="h-9 w-9 shrink-0 rounded-lg border shadow-inner" style={{ background: brand.palette[k] }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold capitalize">{k}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{brand.palette[k]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border bg-background p-5">
            <h2 className="mb-3 font-bold">Typography</h2>
            <p className="text-2xl font-bold" style={{ fontFamily: brand.typography.headingFont }}>{brand.typography.headingFont}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Headings</p>
            <p className="mt-3 text-base" style={{ fontFamily: brand.typography.bodyFont }}>Body text — {brand.typography.bodyFont}</p>
            <p className="mt-1 text-xs text-muted-foreground">Safe, websafe fonts that print reliably.</p>
          </div>
        </div>
      </section>

      {/* materials */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Your materials (live previews with current brand)</h2>
          <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => navigate('templates')}>All templates</Button>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {materials.map((t) => {
            const doc = t.build(brand)
            const Icon = materialIcons[t.type] ?? FileText
            return (
              <div key={t.id} className="overflow-hidden rounded-xl border bg-background transition hover:shadow-md">
                <DocPreview doc={doc} maxHeight={150} />
                <div className="p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold"><Icon className="h-3.5 w-3.5 text-amber-600" /> {t.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{t.description}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full text-xs"
                    onClick={() => openEditor({ templateId: t.id, initialName: t.name, initialType: t.type, backTo: 'brand-kit' })}
                  >
                    Customise
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
