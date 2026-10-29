'use client'

// Flyer Generator: guided multi-step wizard → generates a fully EDITABLE
// flyer (real text/images/prices, never a flattened picture).

import { useEffect, useRef, useState } from 'react'
import { useApp } from '../app-context'
import { CANVAS_PRESETS } from '@/lib/design/types'
import { generateFlyerDoc, composeFlyerDoc, FLYER_STYLES, type FlyerStyle } from '@/lib/design/flyer-layout'
import { docToSvg } from '@/lib/design/svg'
import type { DesignDocument } from '@/lib/design/types'
import { productApi, assetApi } from '@/lib/api-client'
import type { Product } from '@/lib/api-client'
import { compressImageFile, compressImageDataUrl, symbolCategoryFallback } from '@/components/studio/media-utils'
import { ImageCropDialog, type CropResult } from '@/components/studio/image-crop-dialog'
import { getOfficialLogoDataUrl } from '@/lib/design/logo-resolver'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  ArrowLeft, ArrowRight, Wand2, Upload, PackagePlus, Trash2, ImageIcon, CheckCircle2, Loader2, AlertTriangle, Plus, Crop,
} from 'lucide-react'
import { formatNaira, AVAILABILITY_OPTIONS } from '@/lib/brand'

interface WizardProduct {
  key: string
  name: string
  description: string
  price: string
  availability: string
  customAvailability?: string
  imageDataUrl?: string
  symbol?: string
  fromLibraryId?: string
  imageAssetIds?: string[]
}

const PURPOSES = [
  { id: 'single', label: 'Single-product promotion', headline: 'Deal of the Week', eyebrow: 'Special Offer', cta: 'Call to Enquire' },
  { id: 'catalogue', label: 'Multiple-product catalogue', headline: 'Our Products & Prices', eyebrow: 'Now Available', cta: 'Visit Our Shop' },
  { id: 'new', label: 'New product announcement', headline: 'Just Arrived!', eyebrow: 'New Stock', cta: 'Be the First to Buy' },
  { id: 'availability', label: 'Product availability announcement', headline: 'Now In Stock', eyebrow: 'Available Today', cta: 'Call to Confirm' },
  { id: 'discount', label: 'Discount or sale', headline: 'Big Discounts This Week', eyebrow: 'Sale! Sale!! Sale!!!', cta: 'Hurry While Stock Lasts' },
  { id: 'special', label: 'Special offer / bundle', headline: 'Special Bundle Offer', eyebrow: 'Limited Time', cta: 'Call to Enquire' },
  { id: 'seasonal', label: 'Seasonal promotion', headline: 'Season Specials', eyebrow: 'For This Season', cta: 'Visit Us Today' },
  { id: 'stock', label: 'New stock announcement', headline: 'Fresh Stock Landed', eyebrow: 'Just Arrived', cta: 'Come and See' },
  { id: 'clearance', label: 'Clearance sale', headline: 'Clearance — Everything Must Go', eyebrow: 'Final Reductions', cta: 'Grab Yours Now' },
  { id: 'general', label: 'General business advertisement', headline: 'Your Trusted Electronics & Solar Partner', eyebrow: '', cta: 'Contact Us Today' },
  { id: 'custom', label: 'Custom flyer', headline: '', eyebrow: '', cta: 'Call to Enquire' },
]

const FORMAT_GROUPS: { label: string; ids: string[] }[] = [
  { label: 'Print flyers', ids: ['a4-portrait', 'a5-portrait', 'a4-landscape', 'a5-landscape'] },
  { label: 'Social media', ids: ['square-1080', 'portrait-1080', 'status-1080', 'landscape-1200'] },
]

export function FlyerWizardView() {
  const { brand, openEditor } = useApp()
  const [step, setStep] = useState(1)
  const [purpose, setPurpose] = useState(PURPOSES[0])
  const [formatId, setFormatId] = useState('a4-portrait')
  const [custom, setCustom] = useState<{ w: string; h: string }>({ w: '', h: '' })
  const [headline, setHeadline] = useState('')
  const [subheading, setSubheading] = useState('')
  const [offer, setOffer] = useState('')
  const [cta, setCta] = useState('')
  const [description, setDescription] = useState('')
  const [showDescription, setShowDescription] = useState(false)
  const [showAddress, setShowAddress] = useState(true)
  const [showLogo, setShowLogo] = useState(true)
  const [style, setStyle] = useState<FlyerStyle>('premium')
  const [products, setProducts] = useState<WizardProduct[]>([])
  const [library, setLibrary] = useState<Product[]>([])
  const [selectedLib, setSelectedLib] = useState<string[]>([])
  const [loadingLib, setLoadingLib] = useState(false)
  const [pendingImages, setPendingImages] = useState<{ dataUrl: string; name: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [cropTarget, setCropTarget] = useState<{ kind: 'product'; key: string; src: string; name: string } | { kind: 'pending'; index: number; src: string; name: string } | null>(null)
  const [generating, setGenerating] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const productsRef = useRef<WizardProduct[]>([])
  useEffect(() => {
    productsRef.current = products
  }, [products])

  useEffect(() => {
    setLoadingLib(true)
    productApi.list().then((r) => setLibrary(r.products)).catch(() => {}).finally(() => setLoadingLib(false))
  }, [])

  const applyPurpose = (p: (typeof PURPOSES)[number]) => {
    setPurpose(p)
    setHeadline(p.headline)
    setCta(p.cta)
    setOffer('')
    if (p.id === 'catalogue' || p.id === 'general') {
      setShowDescription(true)
      setDescription((d) => d || brand.shortDescription)
    }
  }

  const addFromLibrary = () => {
    const chosen = library.filter((p) => selectedLib.includes(p.id))
    const mapped: WizardProduct[] = chosen.map((p) => ({
      key: `lib-${p.id}-${Date.now()}`,
      name: p.name,
      description: p.description,
      price: p.price,
      availability: p.availability,
      symbol: symbolCategoryFallback(p.category),
      fromLibraryId: p.id,
      imageAssetIds: p.imageAssetIds,
    }))
    setProducts((prev) => [...prev.filter((x) => !x.fromLibraryId || !selectedLib.includes(x.fromLibraryId)), ...mapped])
    setSelectedLib([])
    toast.success(`${mapped.length} product${mapped.length === 1 ? '' : 's'} added from your library.`)
    // Photos saved on the library product appear automatically.
    void loadLibraryImages(mapped.map((m) => ({ key: m.key, ids: m.imageAssetIds ?? [] })))
  }

  const loadLibraryImages = async (items: { key: string; ids: string[] }[]) => {
    const withImages = items.filter((i) => i.ids.length > 0)
    if (!withImages.length) return
    const updates = await Promise.all(
      withImages.map(async (i) => {
        try {
          const { asset } = await assetApi.get(i.ids[0])
          const compressed = await compressImageDataUrl(asset.data, `flyer-product-${i.key}.png`, 1000, 0.82, 300_000)
          return { key: i.key, dataUrl: compressed.dataUrl }
        } catch {
          return null
        }
      })
    )
    const ok = updates.filter((u): u is { key: string; dataUrl: string } => u !== null)
    if (!ok.length) return
    setProducts((prev) => prev.map((p) => {
      const upd = ok.find((u) => u.key === p.key)
      return upd && !p.imageDataUrl ? { ...p, imageDataUrl: upd.dataUrl } : p
    }))
  }

  const loadLibraryImage = async (prodKey: string, assetIds: string[]) => {
    if (!assetIds.length) return
    try {
      const { asset } = await assetApi.get(assetIds[0])
      const compressed = await compressImageDataUrl(asset.data, `flyer-product-${prodKey}.png`, 1000, 0.82, 300_000)
      setProducts((prev) => prev.map((p) => (p.key === prodKey ? { ...p, imageDataUrl: compressed.dataUrl } : p)))
    } catch {
      toast.error('Could not load the product image')
    }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const results: { dataUrl: string; name: string }[] = []
      for (const file of Array.from(files).slice(0, 10)) {
        const c = await compressImageFile(file, 1000, 0.82, 300_000)
        results.push({ dataUrl: c.dataUrl, name: file.name })
      }
      // Assign to products without a photo first (in order); the rest stay in
      // the "unassigned" tray for manual assignment below.
      const assigned = new Map<string, string>()
      const stillPending: { dataUrl: string; name: string }[] = []
      for (const r of results) {
        const target = productsRef.current.find((p) => !p.imageDataUrl && !assigned.has(p.key))
        if (target) assigned.set(target.key, r.dataUrl)
        else stillPending.push(r)
      }
      if (assigned.size) {
        setProducts((prev) => prev.map((p) => (assigned.has(p.key) ? { ...p, imageDataUrl: assigned.get(p.key) } : p)))
      }
      if (stillPending.length) setPendingImages((pi) => [...pi, ...stillPending])
      const autoCount = assigned.size
      toast.success(
        autoCount > 0
          ? `${results.length} photo${results.length === 1 ? '' : 's'} processed${autoCount ? ` — ${autoCount} assigned automatically` : ''}.`
          : `${results.length} unassigned photo${results.length === 1 ? '' : 's'} — assign them to products below.`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const assignPending = (idx: number, prodKey: string) => {
    const img = pendingImages[idx]
    if (!img) return
    setProducts((prev) => prev.map((p) => (p.key === prodKey ? { ...p, imageDataUrl: img.dataUrl } : p)))
    setPendingImages((pi) => pi.filter((_, i) => i !== idx))
  }

  const updateProduct = (key: string, patch: Partial<WizardProduct>) => {
    setProducts((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  }

  const generate = async () => {
    if (!headline.trim()) {
      toast.error('Please enter a headline for your flyer.')
      setStep(3)
      return
    }
    setGenerating(true)
    try {
      // The official logo is baked into the flyer header when shown.
      const logoDataUrl = showLogo ? await getOfficialLogoDataUrl(brand) : null
      if (showLogo && !logoDataUrl) {
        toast.info('Tip: set an official logo in the Logo Studio and it will appear on your flyers automatically.')
      }
      const preset = CANVAS_PRESETS[formatId]
      const size = custom.w && custom.h
        ? { width: Math.max(200, Math.min(4000, +custom.w)), height: Math.max(200, Math.min(4000, +custom.h)), presetId: formatId }
        : { width: preset.width, height: preset.height, presetId: formatId }
      // Unassigned photos get their own frames in a photo gallery band.
      const extraImages = pendingImages.map((p) => p.dataUrl)
      const { doc, warnings } = await generateFlyerDoc(
        {
          headline: headline.trim(),
          eyebrow: purpose.eyebrow || undefined,
          subheading: subheading.trim() || undefined,
          description: description.trim() || undefined,
          offer: offer.trim() || undefined,
          cta: cta.trim() || undefined,
          products: products.map((p) => ({
            name: p.name || 'Product',
            description: p.description || undefined,
            price: p.price ? formatNaira(p.price) : undefined,
            availability: (p.availability === 'custom' ? p.customAvailability?.trim() : p.availability.trim()) || undefined,
            imageDataUrl: p.imageDataUrl,
            symbol: p.symbol,
          })),
          extraImages,
          style,
          showLogo,
          showAddress,
          showDescription,
          logoDataUrl: logoDataUrl ?? undefined,
        },
        size,
        brand
      )
      for (const w of warnings) toast.warning(w, { duration: 6000 })
      openEditor({
        initialDoc: doc,
        initialName: headline.trim().slice(0, 60) || 'Product flyer',
        initialType: 'flyer',
        backTo: 'flyer',
      })
      toast.success('Your flyer has been generated — edit anything on the canvas.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not generate the flyer')
    } finally {
      setGenerating(false)
    }
  }

  const steps = ['Purpose', 'Format', 'Content', 'Products & photos', 'Style']

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-8" data-testid="flyer-wizard">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Wand2 className="h-6 w-6 text-amber-600" /> Flyer Generator</h1>
        <p className="text-sm text-muted-foreground">Answer a few short steps — get a professional flyer you can still edit piece by piece.</p>
      </div>

      {/* progress */}
      <div className="flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i + 1)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${step === i + 1 ? 'bg-[#1F2A44] text-white' : step > i + 1 ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            {step > i + 1 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="tabular-nums">{i + 1}</span>} {s}
          </button>
        ))}
      </div>

      {/* STEP 1 — purpose */}
      {step === 1 && (
        <section className="rounded-2xl border bg-background p-5">
          <h2 className="mb-1 font-bold">What is this flyer for?</h2>
          <p className="mb-4 text-xs text-muted-foreground">This pre-fills your headline and call-to-action — everything stays editable.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PURPOSES.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPurpose(p)}
                className={`rounded-xl border p-3 text-left text-sm transition ${purpose.id === p.id ? 'border-amber-500 bg-amber-50 font-semibold' : 'hover:bg-muted'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button className="gap-2" onClick={() => setStep(2)}>Next: Format <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </section>
      )}

      {/* STEP 2 — format */}
      {step === 2 && (
        <section className="rounded-2xl border bg-background p-5">
          <h2 className="mb-1 font-bold">Choose the format</h2>
          <p className="mb-4 text-xs text-muted-foreground">You can change the canvas size later in the editor without losing your content.</p>
          {FORMAT_GROUPS.map((g) => (
            <div key={g.label} className="mb-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{g.label}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {g.ids.map((id) => {
                  const preset = CANVAS_PRESETS[id]
                  return (
                    <button
                      key={id}
                      onClick={() => { setFormatId(id); setCustom({ w: '', h: '' }) }}
                      className={`rounded-xl border p-3 text-left transition ${formatId === id && !custom.w ? 'border-amber-500 bg-amber-50' : 'hover:bg-muted'}`}
                    >
                      <div className="mb-2 flex h-12 items-center justify-center">
                        <span className="block rounded border-2 border-current/30 bg-muted" style={{ width: preset.width > preset.height ? 56 : (56 * preset.width) / preset.height, height: preset.width > preset.height ? (56 * preset.height) / preset.width : 56 }} />
                      </div>
                      <p className="text-xs font-semibold leading-tight">{preset.label}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          <div className="rounded-xl border border-dashed p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Custom size (px)</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input className="w-28" placeholder="Width" value={custom.w} onChange={(e) => setCustom((c) => ({ ...c, w: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" />
              <span className="text-muted-foreground">×</span>
              <Input className="w-28" placeholder="Height" value={custom.h} onChange={(e) => setCustom((c) => ({ ...c, h: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" />
              {custom.w && custom.h && <Badge variant="secondary">Custom {custom.w}×{custom.h}</Badge>}
            </div>
          </div>
          <div className="mt-4 flex justify-between">
            <Button variant="outline" className="gap-2" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4" /> Back</Button>
            <Button className="gap-2" onClick={() => setStep(3)}>Next: Content <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </section>
      )}

      {/* STEP 3 — content */}
      {step === 3 && (
        <section className="rounded-2xl border bg-background p-5">
          <h2 className="mb-4 font-bold">Flyer content</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Headline (main message) *</Label>
              <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Big Discounts This Week" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Subheading (optional)</Label>
              <Input value={subheading} onChange={(e) => setSubheading(e.target.value)} placeholder="e.g. Solar systems, TVs and fridges at unbeatable prices" />
            </div>
            <div className="space-y-1.5">
              <Label>Promotional offer (optional)</Label>
              <Input value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="e.g. 10% off all solar panels" />
            </div>
            <div className="space-y-1.5">
              <Label>Call to action</Label>
              <Input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="e.g. Call to Enquire" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm">Include business description</Label>
                <p className="text-[11px] text-muted-foreground">Your saved description from Brand Settings.</p>
              </div>
              <Switch checked={showDescription} onCheckedChange={setShowDescription} />
            </div>
            <div className="space-y-1.5">
              <Label>Description text</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} disabled={!showDescription} placeholder={brand.shortDescription} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div><Label className="text-sm">Show address in footer</Label></div>
              <Switch checked={showAddress} onCheckedChange={setShowAddress} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div><Label className="text-sm">Show logo in header</Label></div>
              <Switch checked={showLogo} onCheckedChange={setShowLogo} />
            </div>
          </div>
          <div className="mt-4 flex justify-between">
            <Button variant="outline" className="gap-2" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4" /> Back</Button>
            <Button className="gap-2" onClick={() => setStep(4)}>Next: Products &amp; photos <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </section>
      )}

      {/* STEP 4 — products */}
      {step === 4 && (
        <section className="space-y-4">
          <div className="rounded-2xl border bg-background p-5">
            <h2 className="mb-1 font-bold">Add products</h2>
            <p className="mb-3 text-xs text-muted-foreground">Pick saved products from your library, or add them fresh. Every field stays optional.</p>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Select value={selectedLib[0] ?? ''} onValueChange={(v) => setSelectedLib((s) => s.includes(v) ? s : [...s, v])}>
                <SelectTrigger className="w-64"><SelectValue placeholder={loadingLib ? 'Loading library…' : 'Add from product library…'} /></SelectTrigger>
                <SelectContent>
                  {library.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} {p.price ? `— ${formatNaira(p.price)}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2" onClick={addFromLibrary} disabled={!selectedLib.length}>
                <PackagePlus className="h-4 w-4" /> Add selected {selectedLib.length ? `(${selectedLib.length})` : ''}
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setProducts((p) => [...p, { key: `new-${Date.now()}`, name: '', description: '', price: '', availability: 'In Stock' }])}>
                <Plus className="h-4 w-4" /> New product row
              </Button>
            </div>
          </div>

          {/* bulk upload */}
          <div className="rounded-2xl border bg-background p-5">
            <h3 className="mb-1 font-bold">Upload product photos</h3>
            <p className="mb-3 text-xs text-muted-foreground">Select several photos at once — they are assigned to products automatically, in order. Any photo left over gets its own framed cell in a photo gallery on the flyer.</p>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 text-sm text-muted-foreground transition hover:border-amber-400 hover:bg-amber-50/50"
              data-testid="flyer-photo-upload"
            >
              {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
              {uploading ? 'Processing…' : 'Tap to choose images (PNG, JPG, WebP — up to 10 at a time)'}
            </button>
            <input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { void handleFiles(e.target.files); e.currentTarget.value = '' }} />
            {pendingImages.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold">{pendingImages.length} unassigned photo{pendingImages.length > 1 ? 's' : ''} — {pendingImages.length > 1 ? 'each will get its own frame in a photo gallery' : 'it will get its own frame in a photo gallery'}. Or assign one to a product:</p>
                {pendingImages.map((img, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-3 rounded-lg border p-2">
                    <img src={img.dataUrl} alt={img.name} className="h-12 w-12 rounded border object-contain" />
                    <span className="min-w-0 flex-1 truncate text-xs">{img.name}</span>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setCropTarget({ kind: 'pending', index: i, src: img.dataUrl, name: img.name })}><Crop className="h-3.5 w-3.5" /> Crop / rotate</Button>
                    <Select onValueChange={(v) => assignPending(i, v)}>
                      <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Assign to product…" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.key} value={p.key}>{p.name || 'Unnamed product'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setPendingImages((pi) => pi.filter((_, idx) => idx !== i))} aria-label="Remove photo"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* product rows */}
          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-amber-500" />
              No products yet — add from your library or create rows above. A flyer without products still works (headline + description).
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((p, i) => (
                <div key={p.key} className="rounded-2xl border bg-background p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <Badge variant="secondary">Product {i + 1}</Badge>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setProducts((prev) => prev.filter((x) => x.key !== p.key))} aria-label="Remove product"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-3">
                      {p.imageDataUrl ? (
                        <div className="space-y-2">
                          <div className="overflow-hidden rounded-lg border bg-muted">
                            <img src={p.imageDataUrl} alt={p.name || 'Product'} className="h-24 w-full object-contain" />
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <Button size="sm" variant="outline" className="gap-1 px-1 text-[11px]" onClick={() => setCropTarget({ kind: 'product', key: p.key, src: p.imageDataUrl!, name: p.name || 'Product photo' })}><Crop className="h-3 w-3" /> Crop</Button>
                            <Button size="sm" variant="outline" className="gap-1 px-1 text-[11px]" onClick={() => updateProduct(p.key, { imageDataUrl: undefined })}>Replace / remove</Button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => fileRef.current?.click()} className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-[11px] text-muted-foreground hover:border-amber-400">
                          <ImageIcon className="h-4 w-4" /> Add photo
                        </button>
                      )}
                    </div>
                    <div className="grid gap-2 sm:col-span-9 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Product name</Label>
                        <Input value={p.name} onChange={(e) => updateProduct(p.key, { name: e.target.value })} placeholder="e.g. 300W Solar Panel" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Price (₦, optional)</Label>
                          <Input value={p.price} onChange={(e) => updateProduct(p.key, { price: e.target.value })} placeholder="45000" inputMode="numeric" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Availability</Label>
                          <Select value={p.availability} onValueChange={(v) => updateProduct(p.key, { availability: v })}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {AVAILABILITY_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                              <SelectItem value="custom">Custom…</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {p.availability === 'custom' && (
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs">Custom availability text</Label>
                          <Input value={p.customAvailability ?? ''} onChange={(e) => updateProduct(p.key, { customAvailability: e.target.value })} placeholder="e.g. 5 units left" />
                        </div>
                      )}
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">Short description (optional)</Label>
                        <Input value={p.description} onChange={(e) => updateProduct(p.key, { description: e.target.value })} placeholder="e.g. High-efficiency monocrystalline panel, 25-year warranty" />
                      </div>
                      {p.fromLibraryId && !p.imageDataUrl && (
                        <p className="text-[11px] text-muted-foreground sm:col-span-2">From library — photo loading… {" "}
                          <button className="text-amber-700 underline" onClick={() => void loadLibraryImage(p.key, library.find((l) => l.id === p.fromLibraryId)?.imageAssetIds ?? [])}>try again</button>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" className="gap-2" onClick={() => setStep(3)}><ArrowLeft className="h-4 w-4" /> Back</Button>
            <Button className="gap-2" onClick={() => setStep(5)}>Next: Style <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </section>
      )}

      {/* STEP 5 — style */}
      {step === 5 && (
        <section className="rounded-2xl border bg-background p-5">
          <h2 className="mb-1 font-bold">Pick a design style</h2>
          <p className="mb-4 text-xs text-muted-foreground">These are starting styles — colours and layout stay fully editable after generation.</p>
          <StylePicker style={style} setStyle={setStyle} />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" className="gap-2" onClick={() => setStep(4)}><ArrowLeft className="h-4 w-4" /> Back</Button>
            <Button className="gap-2 bg-amber-600 hover:bg-amber-700" onClick={() => void generate()} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {generating ? 'Generating…' : 'Generate Flyer'}
            </Button>
          </div>
        </section>
      )}
      <ImageCropDialog
        key={cropTarget ? `${cropTarget.kind}-${cropTarget.kind === 'product' ? cropTarget.key : cropTarget.index}-${cropTarget.src.slice(-24)}` : 'no-crop'}
        open={!!cropTarget}
        imageSrc={cropTarget?.src ?? ''}
        fileName={cropTarget?.name}
        frameAspect={null}
        onCancel={() => setCropTarget(null)}
        onApply={(result: CropResult) => {
          if (cropTarget?.kind === 'product') {
            updateProduct(cropTarget.key, { imageDataUrl: result.dataUrl })
          } else if (cropTarget?.kind === 'pending') {
            setPendingImages((items) => items.map((item, index) => index === cropTarget.index ? { ...item, dataUrl: result.dataUrl } : item))
          }
          setCropTarget(null)
          toast.success('Photo updated. The original upload remains unchanged.')
        }}
      />
    </div>
  )
}

function StylePicker({ style, setStyle }: { style: FlyerStyle; setStyle: (s: FlyerStyle) => void }) {
  const { brand } = useApp()
  const mini = (s: FlyerStyle) => {
    const preset = CANVAS_PRESETS['a4-portrait']
    const { doc } = composeFlyerDoc(
      {
        headline: 'Big Discounts',
        eyebrow: 'Sale',
        subheading: 'TVs, fridges & solar',
        cta: 'Call to Enquire',
        products: [
          { name: 'Solar Panel', price: '₦45,000', availability: 'In Stock' },
          { name: 'LED TV', price: '₦120,000', availability: 'Limited Stock' },
        ],
        style: s,
        showLogo: false,
        showAddress: false,
        showDescription: false,
      },
      { width: preset.width, height: preset.height, presetId: 'a4-portrait' },
      brand
    )
    return doc
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {FLYER_STYLES.map((s) => {
        const doc = mini(s.id)
        const svg = docToSvg(doc, { palette: brand.palette, pageIndex: 0, includeBackground: true })
        return (
          <button
            key={s.id}
            onClick={() => setStyle(s.id)}
            className={`overflow-hidden rounded-xl border text-left transition ${style === s.id ? 'border-amber-500 ring-2 ring-amber-200' : 'hover:shadow-md'}`}
          >
            <div className="flex aspect-[3/4] items-center justify-center bg-[#EDEAE2] p-1">
              <div className="[&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            </div>
            <div className="p-2">
              <p className="text-[11px] font-semibold leading-tight">{s.name}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{s.description}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
