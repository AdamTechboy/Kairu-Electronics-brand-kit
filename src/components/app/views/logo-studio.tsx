'use client'

// Logo Studio: create/edit logo variants, set the official logo, export wizard.

import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../app-context'
import { projectApi } from '@/lib/api-client'
import type { ProjectSummary } from '@/lib/api-client'
import { buildLogoDoc, type LogoVariant } from '@/lib/design/templates'
import { docToSvg } from '@/lib/design/svg'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Sparkles, Pencil, Plus, ShieldCheck, Loader2, Upload, Wand2, FileDown } from 'lucide-react'

const VARIANTS: { id: LogoVariant; name: string; desc: string }[] = [
  { id: 'primary', name: 'Primary full logo', desc: 'Badge with business name — your main identity.' },
  { id: 'symbol', name: 'Symbol only', desc: 'Emblem for avatars, stamps and watermarks.' },
  { id: 'compact', name: 'Compact', desc: 'Small-size friendly roundel.' },
  { id: 'horizontal', name: 'Horizontal', desc: 'Signage, website headers, banners.' },
  { id: 'stacked', name: 'Stacked', desc: 'Posters, packaging, shop boards.' },
  { id: 'light', name: 'Light background', desc: 'For white surfaces.' },
  { id: 'dark', name: 'Dark background', desc: 'For navy/black surfaces.' },
  { id: 'mono', name: 'Monochrome', desc: 'Single colour for stamps & engraving.' },
]

function VariantThumb({ variant }: { variant: LogoVariant }) {
  const { brand } = useApp()
  const svg = useMemo(() => {
    const doc = buildLogoDoc(variant, brand)
    return docToSvg(doc, { palette: brand.palette, pageIndex: 0, includeBackground: true })
  }, [variant, brand])
  return (
    <div
      className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border p-2"
      style={{ background: variant === 'dark' ? '#101820' : variant === 'light' ? '#ffffff' : '#EDEAE2' }}
    >
      <div className="[&_svg]:h-auto [&_svg]:w-auto [&_svg]:max-h-full [&_svg]:max-w-full" style={{ maxHeight: 130 }} dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  )
}

export function LogoStudioView() {
  const { brand, openEditor, reloadBrand } = useApp()
  const [logos, setLogos] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [settingOfficial, setSettingOfficial] = useState<string | null>(null)

  const loadLogos = () => {
    setLoading(true)
    projectApi.list({ type: 'logo', templates: 'exclude', archived: false })
      .then((r) => setLogos(r.projects))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(loadLogos, [])

  const setOfficial = async (id: string) => {
    setSettingOfficial(id)
    try {
      const [{ brandApi }, { clearOfficialLogoCache }] = await Promise.all([
        import('@/lib/api-client'),
        import('@/lib/design/logo-resolver'),
      ])
      await brandApi.update({ logoProjectId: id })
      clearOfficialLogoCache()
      await reloadBrand()
      toast.success('Official logo updated.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not set the official logo')
    } finally {
      setSettingOfficial(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8" data-testid="logo-studio">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Logo Studio</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Your reference badge — sun, solar panel, product silhouettes and bold MK — recreated as fully editable vectors. Change colours, text, sizes; the solar panel keeps its original position.
          </p>
        </div>
        <Button
          className="gap-2 bg-[#1F2A44] hover:bg-[#2a3a5c]"
          onClick={() => openEditor({ templateId: 'logo-primary', initialName: 'Primary Logo', initialType: 'logo', backTo: 'logo-studio' })}
        >
          <Plus className="h-4 w-4" /> New logo from template
        </Button>
      </div>

      {/* guidance */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-background p-4">
          <Sparkles className="mb-2 h-5 w-5 text-amber-600" />
          <p className="text-sm font-semibold">Fully editable</p>
          <p className="mt-1 text-xs text-muted-foreground">Every letter, symbol and colour is an individual object — move, recolour, resize, undo anything.</p>
        </div>
        <div className="rounded-xl border bg-background p-4">
          <Wand2 className="mb-2 h-5 w-5 text-amber-600" />
          <p className="text-sm font-semibold">AI assistance</p>
          <p className="mt-1 text-xs text-muted-foreground">Inside the editor, ask the AI assistant for changes and preview before accepting. Upload references in the AI → Reference tab.</p>
        </div>
        <div className="rounded-xl border bg-background p-4">
          <FileDown className="mb-2 h-5 w-5 text-amber-600" />
          <p className="text-sm font-semibold">Export wizard</p>
          <p className="mt-1 text-xs text-muted-foreground">Tell us what the logo is for (signage, web, print) and get the right format: SVG, PDF, PNG or JPG.</p>
        </div>
      </div>

      {/* start-from-template gallery */}
      <section>
        <h2 className="mb-3 text-lg font-bold">Start from a variant</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {VARIANTS.map((v) => (
            <div key={v.id} className="overflow-hidden rounded-xl border bg-background transition hover:shadow-md">
              <VariantThumb variant={v.id} />
              <div className="p-3">
                <p className="text-xs font-semibold">{v.name}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{v.desc}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full text-xs"
                  onClick={() => openEditor({ templateId: `logo-${v.id}`, initialName: v.name, initialType: 'logo', backTo: 'logo-studio' })}
                >
                  <Pencil className="mr-1 h-3 w-3" /> Customise
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* saved logos */}
      <section>
        <h2 className="mb-3 text-lg font-bold">Your saved logos</h2>
        {loading ? (
          <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : logos.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No saved logos yet — customise a variant above and it will appear here.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {logos.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-xl border bg-background transition hover:shadow-md">
                <div className="flex aspect-[4/3] items-center justify-center bg-muted p-2">
                  {p.preview ? <img src={p.preview} alt={p.name} className="max-h-full max-w-full object-contain" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-xs font-semibold">{p.name}</p>
                    {brand.logoProjectId === p.id && <Badge className="bg-green-100 text-[10px] text-green-800">Official</Badge>}
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => openEditor({ projectId: p.id, backTo: 'logo-studio' })}>Edit</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 flex-1 gap-1 text-xs"
                      onClick={() => void setOfficial(p.id)}
                      disabled={settingOfficial === p.id}
                    >
                      {settingOfficial === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                      {brand.logoProjectId === p.id ? 'Official' : 'Set official'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
