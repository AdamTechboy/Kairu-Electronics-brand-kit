'use client'

// Brand Settings: persistent business profile + brand identity controls.

import { useEffect, useRef, useState } from 'react'
import { useApp } from '../app-context'
import { brandApi, projectApi } from '@/lib/api-client'
import type { ProjectSummary } from '@/lib/api-client'
import { compressImageFile } from '@/components/studio/media-utils'
import { el, newPage, type DesignDocument } from '@/lib/design/types'
import { makeThumbnail } from '@/lib/export/exporter'
import { clearOfficialLogoCache, fillLogoPlaceholders, getOfficialLogoDataUrl } from '@/lib/design/logo-resolver'
import type { BrandSettings, SocialHandle } from '@/lib/brand'
import { PALETTE_SUGGESTIONS } from '@/lib/design/colors'
import { FONT_OPTIONS } from '@/lib/design/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { QuickColorInput } from '@/components/studio/color-picker'
import { toast } from 'sonner'
import { Save, Plus, Trash2, Loader2, Eye, Phone, ShieldCheck, Upload } from 'lucide-react'

export function BrandSettingsView() {
  const { brand, reloadBrand, navigate } = useApp()
  const [form, setForm] = useState<BrandSettings>(brand)
  const [saving, setSaving] = useState(false)
  const [logoProjects, setLogoProjects] = useState<ProjectSummary[]>([])
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [applyExistingSaved, setApplyExistingSaved] = useState(false)
  const logoUploadRef = useRef<HTMLInputElement>(null)

  useEffect(() => setForm(brand), [brand])

  useEffect(() => {
    projectApi.list({ type: 'logo', templates: 'exclude', archived: false })
      .then((r) => setLogoProjects(r.projects))
      .catch(() => {})
  }, [])

  const set = <K extends keyof BrandSettings>(k: K, v: BrandSettings[K]) => setForm((f) => ({ ...f, [k]: v }))

  const uploadOfficialLogo = async (file: File | undefined) => {
    if (!file || uploadingLogo) return
    setUploadingLogo(true)
    try {
      const compressed = await compressImageFile(file, 1400, 0.86, 1_200_000)
      const doc: DesignDocument = {
        version: 1, width: 1000, height: 1000, background: null,
        pages: [{ ...newPage('Uploaded official logo', null), elements: [
          el('image', { name: 'Uploaded logo artwork', src: compressed.dataUrl, x: 70, y: 70, w: 860, h: 860, fit: 'contain', radius: 0 }),
        ] }],
        meta: { type: 'logo', notes: 'Imported official image. It remains a movable, resizable and rotatable image layer; add editable text and vector shapes separately in Logo Studio.' },
      }
      const name = `${form.businessName || 'Business'} Official Logo`.slice(0, 120)
      const preview = await makeThumbnail(doc, form.palette, 420)
      const { project } = await projectApi.create({ name, type: 'logo', doc, preview })
      set('logoProjectId', project.id)
      set('logoApplyToSite', true)
      set('logoApplyToNewDesigns', true)
      const { projects } = await projectApi.list({ type: 'logo', templates: 'exclude', archived: false })
      setLogoProjects(projects)
      toast.success('Logo imported as a transformable image layer. Choose where to apply it, then commit changes.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not upload the official logo')
    } finally {
      setUploadingLogo(false)
      if (logoUploadRef.current) logoUploadRef.current.value = ''
    }
  }

  const save = async (applyEverywhere = false) => {
    if ((applyEverywhere || applyExistingSaved) && !form.logoProjectId) {
      toast.error('Choose or upload an official logo before applying it to saved designs.')
      return
    }
    setSaving(true)
    let updated = 0
    let skipped = 0
    try {
      const nextForm: BrandSettings = applyEverywhere
        ? { ...form, logoApplyToSite: true, logoApplyToNewDesigns: true }
        : form
      const { brand: savedBrand } = await brandApi.update(nextForm)
      setForm(savedBrand)
      clearOfficialLogoCache()
      await reloadBrand()
      if ((applyExistingSaved || applyEverywhere) && savedBrand.logoProjectId) {
        const officialLogo = await getOfficialLogoDataUrl({ ...savedBrand, logoApplyToNewDesigns: true }, 'always')
        if (!officialLogo) throw new Error('Brand settings were saved, but the selected logo could not be rendered.')
        const { projects } = await projectApi.list({ archived: false, limit: 500 })
        for (const summary of projects) {
          if (summary.type === 'logo') continue
          try {
            const { project } = await projectApi.get(summary.id)
            const currentDoc = project.doc as DesignDocument
            const updatedDoc = fillLogoPlaceholders(currentDoc, officialLogo, true)
            if (updatedDoc === currentDoc) continue
            const preview = await makeThumbnail(updatedDoc, savedBrand.palette, 420)
            await projectApi.update(summary.id, { doc: updatedDoc, preview, snapshot: true, versionLabel: 'Applied official logo' })
            updated += 1
          } catch {
            skipped += 1
          }
        }
        setApplyExistingSaved(false)
      }
      const scopeMessage = applyEverywhere
        ? 'Site logo and future designs are enabled; marked logo placeholders in saved designs were refreshed.'
        : 'Selected brand settings saved.'
      toast.success(`${scopeMessage} Updated ${updated} saved design(s).${skipped ? ` ${skipped} design(s) could not be updated.` : ''}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not commit brand changes')
    } finally {
      setSaving(false)
    }
  }

  const setPhone = (i: number, v: string) => {
    const phones = [...form.phones]
    phones[i] = v
    set('phones', phones)
  }

  const setSocial = (i: number, patch: Partial<SocialHandle>) => {
    const socials = form.socials.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    set('socials', socials)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 lg:p-8" data-testid="brand-settings">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Brand Settings</h1>
          <p className="text-sm text-muted-foreground">Saved details are reused across every design — enter them once.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => navigate('brand-kit')}><Eye className="h-4 w-4" /> Preview Brand Kit</Button>
          <Button className="gap-2 bg-[#1F2A44] hover:bg-[#2a3a5c]" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
          </Button>
        </div>
      </div>

      {/* business info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Business information</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Business name</Label>
            <Input value={form.businessName} onChange={(e) => set('businessName', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Business category</Label>
            <Input value={form.businessCategory} onChange={(e) => set('businessCategory', e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tagline (optional)</Label>
            <Input value={form.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="e.g. Powering Homes. Entertaining Families." />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Full business description</Label>
            <Textarea rows={5} value={form.description} onChange={(e) => set('description', e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Used on flyers and profiles. Shorten per-campaign in the flyer generator if needed.</p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Short description (for social posts)</Label>
            <Textarea rows={2} value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1"><Phone className="h-3 w-3" /> Phone numbers</Label>
            {form.phones.map((p, i) => (
              <div key={i} className="flex gap-2">
                <Input value={p} onChange={(e) => setPhone(i, e.target.value)} placeholder="0703 836 5737" />
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive" onClick={() => set('phones', form.phones.filter((_, idx) => idx !== i))} aria-label="Remove phone"><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {form.phones.length < 3 && (
              <Button variant="outline" size="sm" className="gap-1" onClick={() => set('phones', [...form.phones, ''])}><Plus className="h-3.5 w-3.5" /> Add phone</Button>
            )}
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email (optional)</Label>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="Leave empty if you don't use email" />
            </div>
            <div className="space-y-1.5">
              <Label>Website (optional)</Label>
              <Input value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="Leave empty if you don't have one" />
            </div>
            <div className="space-y-1.5">
              <Label>Opening hours (optional)</Label>
              <Input value={form.openingHours} onChange={(e) => set('openingHours', e.target.value)} placeholder="e.g. Mon–Sat, 8am – 6pm" />
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Social media handles (optional)</Label>
            {form.socials.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Select value={s.label} onValueChange={(v) => setSocial(i, { label: v })}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="Facebook">Facebook</SelectItem>
                    <SelectItem value="Instagram">Instagram</SelectItem>
                    <SelectItem value="TikTok">TikTok</SelectItem>
                    <SelectItem value="X">X</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={s.handle} onChange={(e) => setSocial(i, { handle: e.target.value })} placeholder="@handle or number" />
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive" onClick={() => set('socials', form.socials.filter((_, idx) => idx !== i))} aria-label="Remove social"><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1" onClick={() => set('socials', [...form.socials, { label: 'WhatsApp', handle: '' }])}><Plus className="h-3.5 w-3.5" /> Add social</Button>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Additional business information (optional)</Label>
            <Textarea rows={2} value={form.extraInfo} onChange={(e) => set('extraInfo', e.target.value)} placeholder="Warranty notes, delivery info, anything you often print" />
          </div>
        </CardContent>
      </Card>

      {/* official logo and application targets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Official logo &amp; application targets</CardTitle>
          <p className="text-sm text-muted-foreground">Upload the real business logo or choose a saved logo project. Imported artwork stays a transformable image layer in Logo Studio.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input ref={logoUploadRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { void uploadOfficialLogo(e.target.files?.[0]) }} />
            <Button variant="outline" className="gap-2" onClick={() => logoUploadRef.current?.click()} disabled={uploadingLogo}>
              {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload official logo
            </Button>
            <Button variant="outline" onClick={() => navigate('logo-studio')}>Open Logo Studio</Button>
          </div>
          {logoProjects.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No saved logos yet. Upload one or create it in Logo Studio.</div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              <button type="button" onClick={() => set('logoProjectId', null)} className={`aspect-square rounded-xl border-2 p-2 text-[11px] ${!form.logoProjectId ? 'border-amber-500 bg-amber-50' : 'hover:bg-muted'}`}>No official logo</button>
              {logoProjects.map((p) => (
                <button type="button" key={p.id} onClick={() => set('logoProjectId', p.id)} className={`aspect-square overflow-hidden rounded-xl border-2 bg-transparent p-1 transition ${form.logoProjectId === p.id ? 'border-amber-500 ring-2 ring-amber-200' : 'hover:border-amber-300'}`} title={p.name}>
                  {p.preview ? <img src={p.preview} alt={p.name} className="h-full w-full object-contain" /> : <span className="text-[10px]">{p.name}</span>}
                </button>
              ))}
            </div>
          )}
          <div className="rounded-xl border p-4">
            <p className="mb-3 text-sm font-semibold">Where should the logo be used?</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium">Site logo / navigation / favicon</p><p className="text-xs text-muted-foreground">Use the selected logo for the MK badge and site icon.</p></div><Switch checked={form.logoApplyToSite !== false} onCheckedChange={(v) => set('logoApplyToSite', v)} /></div>
              <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium">New designs</p><p className="text-xs text-muted-foreground">Use the logo in new flyers, letterheads and templates wherever a logo placeholder exists.</p></div><Switch checked={form.logoApplyToNewDesigns !== false} onCheckedChange={(v) => set('logoApplyToNewDesigns', v)} /></div>
              <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium">Refresh existing saved designs</p><p className="text-xs text-muted-foreground">Update only marked logo placeholders and save revisions. Custom logo art is preserved.</p></div><Switch checked={applyExistingSaved} onCheckedChange={setApplyExistingSaved} /></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button className="bg-[#1F2A44] hover:bg-[#2a3a5c]" onClick={() => void save(false)} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />} Commit selected changes</Button>
              <Button variant="outline" onClick={() => void save(true)} disabled={saving || !form.logoProjectId}>Apply official logo everywhere</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* palette */}
      <Card>
        <CardHeader><CardTitle className="text-base">Brand colour palette</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-5">
            {(['primary', 'secondary', 'accent', 'dark', 'light'] as const).map((k) => (
              <div key={k} className="space-y-1.5">
                <Label className="text-xs capitalize">{k} colour</Label>
                <QuickColorInput label={`${k} colour`} value={form.palette[k]} onChange={(c) => set('palette', { ...form.palette, [k]: c })} />
              </div>
            ))}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Suggested palettes (click to apply)</Label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {PALETTE_SUGGESTIONS.map((s) => (
                <button key={s.name} onClick={() => set('palette', s.palette)} className="rounded-lg border p-2 text-left text-xs transition hover:border-amber-400 hover:bg-amber-50/50">
                  <div className="mb-1.5 flex gap-1">
                    {Object.values(s.palette).map((c) => <span key={c} className="h-5 flex-1 rounded" style={{ background: c }} />)}
                  </div>
                  <span className="font-medium">{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* typography */}
      <Card>
        <CardHeader><CardTitle className="text-base">Brand typography</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Heading font</Label>
            <Select value={form.typography.headingFont} onValueChange={(v) => set('typography', { ...form.typography, headingFont: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FONT_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Body font</Label>
            <Select value={form.typography.bodyFont} onValueChange={(v) => set('typography', { ...form.typography, bodyFont: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FONT_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pb-4">
        <Button variant="outline" onClick={() => setForm(brand)}>Reset changes</Button>
        <Button className="gap-2 bg-[#1F2A44] hover:bg-[#2a3a5c]" onClick={() => void save(false)} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Commit changes
        </Button>
      </div>
    </div>
  )
}
