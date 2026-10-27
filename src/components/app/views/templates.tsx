'use client'

// Templates gallery: all builtin templates + user-saved templates.

import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../app-context'
import { TEMPLATES } from '@/lib/design/templates'
import { docToSvg } from '@/lib/design/svg'
import { fillLogoPlaceholders, useOfficialLogoDataUrl } from '@/lib/design/logo-resolver'
import { projectApi } from '@/lib/api-client'
import type { ProjectSummary } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Pencil, LayoutTemplate, FolderOpen, Trash2, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const TYPE_LABELS: Record<string, string> = {
  logo: 'Logos', letterhead: 'Letterheads', 'business-card': 'Business Cards',
  'complimentary-card': 'Complimentary Cards', flyer: 'Flyers', 'social-post': 'Social Posts',
}

function Thumb({ templateId }: { templateId: string }) {
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

export function TemplatesView() {
  const { brand, openEditor } = useApp()
  const [tab, setTab] = useState('all')
  const [userTpls, setUserTpls] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await projectApi.list({ templates: 'only', archived: false })
        if (!cancelled) setUserTpls(r.projects)
      } catch {
        // non-fatal
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const builtin = tab === 'all' ? TEMPLATES : TEMPLATES.filter((t) => t.type === tab)

  const unsave = async (id: string) => {
    try {
      await projectApi.update(id, { isTemplate: false })
      toast.success('Removed from your templates (the design itself is kept in My Designs).')
      const r = await projectApi.list({ templates: 'only', archived: false })
      setUserTpls(r.projects)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    }
  }

  const duplicateAsProject = async (p: ProjectSummary) => {
    try {
      await projectApi.duplicate(p.id)
      toast.success('Duplicated — find it in My Designs.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8" data-testid="templates">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><LayoutTemplate className="h-6 w-6 text-amber-600" /> Templates</h1>
        <p className="text-sm text-muted-foreground">Professional starting points using your current brand. Customising a template creates your own editable copy.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <TabsTrigger key={k} value={k} className="text-xs">{v}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <section>
        <h2 className="mb-3 text-lg font-bold">Studio templates</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {builtin.map((t) => (
            <div key={t.id} className="overflow-hidden rounded-xl border bg-background transition hover:shadow-md">
              <Thumb templateId={t.id} />
              <div className="p-3">
                <p className="text-xs font-semibold">{t.name}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{t.description}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full text-xs"
                  onClick={() => openEditor({ templateId: t.id, initialName: t.name, initialType: t.type, backTo: 'templates' })}
                >
                  <Pencil className="mr-1 h-3 w-3" /> Use template
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Your saved templates</h2>
        {loading ? (
          <div className="flex h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : userTpls.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Save any design as a template from My Designs → it will appear here for reuse.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {userTpls.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-xl border bg-background transition hover:shadow-md">
                <div className="flex aspect-[4/3] items-center justify-center bg-muted p-2">
                  {p.preview ? <img src={p.preview} alt={p.name} className="max-h-full max-w-full object-contain" /> : <FolderOpen className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="p-3">
                  <p className="truncate text-xs font-semibold">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{TYPE_LABELS[p.type] ?? p.type}</p>
                  <div className="mt-2 flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => openEditor({ projectId: p.id, backTo: 'templates' })}>Open</Button>
                    <Button size="icon" variant="outline" className="h-7 w-7" title="Duplicate to My Designs" onClick={() => void duplicateAsProject(p)}><Copy className="h-3 w-3" /></Button>
                    <Button size="icon" variant="outline" className="h-7 w-7 text-destructive" title="Remove from templates" onClick={() => void unsave(p.id)}><Trash2 className="h-3 w-3" /></Button>
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
