'use client'

// Product Library: reusable catalogue used by the flyer generator.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../app-context'
import { productApi, assetApi } from '@/lib/api-client'
import type { Product } from '@/lib/api-client'
import { compressImageFile } from '@/components/studio/media-utils'
import { ImageCropDialog, type CropResult } from '@/components/studio/image-crop-dialog'
import { AVAILABILITY_OPTIONS, PRODUCT_CATEGORIES, formatNaira } from '@/lib/brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Package, Plus, Pencil, Trash2, Upload, Loader2, X, ChevronLeft, ChevronRight, Crop } from 'lucide-react'
import { toast } from 'sonner'

interface DraftProduct {
  id?: string
  name: string
  category: string
  description: string
  price: string
  availability: string
  stockRef: string
  notes: string
  imageAssetIds: string[]
}

const EMPTY: DraftProduct = { name: '', category: 'Other Electronics', description: '', price: '', availability: 'In Stock', stockRef: '', notes: '', imageAssetIds: [] }

export function ProductLibraryView() {
  const { brand } = useApp()
  const [products, setProducts] = useState<Product[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState(false)
  const [draft, setDraft] = useState<DraftProduct>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null)
  const [imgUrls, setImgUrls] = useState<Record<string, string>>({})
  const [cropTarget, setCropTarget] = useState<{ id: string; index: number; src: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await productApi.list()
      setProducts(r.products)
      const ids = r.products.flatMap((p) => p.imageAssetIds)
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const { asset } = await assetApi.get(id)
            return [id, asset.data] as const
          } catch {
            return [id, ''] as const
          }
        })
      )
      setImgUrls(Object.fromEntries(entries))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load products')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const productCategories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const filteredProducts = products.filter((p) => {
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter
    const matchesQuery = !normalizedQuery || [p.name, p.category, p.description, p.stockRef].some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
    return matchesCategory && matchesQuery
  })

  const openNew = () => { setDraft(EMPTY); setDialog(true) }
  const openEdit = (p: Product) => {
    setDraft({ id: p.id, name: p.name, category: p.category || 'Other Electronics', description: p.description, price: p.price, availability: p.availability, stockRef: p.stockRef, notes: p.notes, imageAssetIds: p.imageAssetIds })
    setDialog(true)
  }

  const handleImage = async (files: FileList | null) => {
    if (!files?.length || uploadingImages) return
    const chosen = Array.from(files).slice(0, Math.max(0, 6 - draft.imageAssetIds.length))
    if (!chosen.length) {
      toast.error('A product can have up to 6 photos. Remove one before adding more.')
      return
    }

    setUploadingImages(true)
    const uploaded: { id: string; dataUrl: string }[] = []
    const failures: string[] = []
    try {
      // Keep successful uploads attached even if a later file in the batch fails.
      for (const file of chosen) {
        try {
          const compressed = await compressImageFile(file, 1200)
          const { asset } = await assetApi.upload({
            filename: file.name,
            mimeType: compressed.mimeType,
            dataUrl: compressed.dataUrl,
            kind: 'product',
            width: compressed.width,
            height: compressed.height,
          })
          uploaded.push({ id: asset.id, dataUrl: compressed.dataUrl })
        } catch {
          failures.push(file.name)
        }
      }

      if (uploaded.length) {
        setDraft((d) => ({ ...d, imageAssetIds: [...d.imageAssetIds, ...uploaded.map((x) => x.id)].slice(0, 6) }))
        setImgUrls((m) => ({ ...m, ...Object.fromEntries(uploaded.map((x) => [x.id, x.dataUrl])) }))
      }
      if (failures.length) {
        toast.error(uploaded.length + ' photo(s) uploaded; ' + failures.length + ' failed: ' + failures.join(', '))
      } else {
        toast.success(uploaded.length + ' photo(s) attached to the product.')
      }
    } finally {
      setUploadingImages(false)
    }
  }

  const movePhoto = (index: number, direction: -1 | 1) => {
    setDraft((d) => {
      const next = [...d.imageAssetIds]
      const target = index + direction
      if (target < 0 || target >= next.length) return d
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...d, imageAssetIds: next }
    })
  }

  const removePhoto = (id: string) => {
    // Remove only the reference from this product; the asset may be used elsewhere.
    setDraft((d) => ({ ...d, imageAssetIds: d.imageAssetIds.filter((photoId) => photoId !== id) }))
  }

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error('Product name is required.')
      return
    }
    setSaving(true)
    try {
      const body = { name: draft.name.trim(), category: draft.category, description: draft.description, price: draft.price, availability: draft.availability, stockRef: draft.stockRef, notes: draft.notes, imageAssetIds: draft.imageAssetIds }
      if (draft.id) await productApi.update(draft.id, body)
      else await productApi.create(body)
      toast.success(draft.id ? 'Product updated. Existing flyers keep their old prices until you edit them.' : 'Product saved — select it in the Flyer Generator any time.')
      setDialog(false)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the product')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 lg:p-8" data-testid="products">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Package className="h-6 w-6 text-amber-600" /> Product Library</h1>
          <p className="text-sm text-muted-foreground">Save products once — pick them in any flyer with names, prices and photos filled in.</p>
        </div>
        <Button className="gap-2 bg-[#1F2A44] hover:bg-[#2a3a5c]" onClick={openNew}><Plus className="h-4 w-4" /> Add product</Button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No products yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add your solar panels, TVs, fridges and more — with prices and availability you can update any time.</p>
          <Button className="mt-4 bg-[#1F2A44] hover:bg-[#2a3a5c]" onClick={openNew}>Add your first product</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, categories, descriptions or SKU…"
              aria-label="Search products"
            />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger aria-label="Filter products by category"><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {productCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="font-medium">No matching products</p>
              <p className="mt-1 text-sm text-muted-foreground">Try a different search or category.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSearchQuery(''); setCategoryFilter('all') }}>Clear filters</Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((p) => (
            <div key={p.id} className="flex gap-3 rounded-xl border bg-background p-3">
              <div className="flex w-20 shrink-0 flex-col gap-1">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {p.imageAssetIds[0] && imgUrls[p.imageAssetIds[0]]
                    ? <img src={imgUrls[p.imageAssetIds[0]]} alt={p.name} className="h-full w-full object-contain" />
                    : <Package className="h-7 w-7 text-muted-foreground/50" />}
                </div>
                {p.imageAssetIds.length > 1 && <p className="text-center text-[10px] text-muted-foreground">+{p.imageAssetIds.length - 1} more photo{p.imageAssetIds.length === 2 ? '' : 's'}</p>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    {p.category && <p className="text-[11px] text-muted-foreground">{p.category}</p>}
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setConfirmDelete(p)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {p.price && <Badge className="bg-amber-100 text-amber-900">{formatNaira(p.price)}</Badge>}
                  <Badge variant={p.availability === 'In Stock' ? 'secondary' : 'outline'} className="text-[10px]">{p.availability}</Badge>
                </div>
                {p.description && <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{p.description}</p>}
              </div>
            </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* dialog */}
      <Dialog open={dialog} onOpenChange={(nextOpen) => { if (!nextOpen && uploadingImages) return; setDialog(nextOpen) }}>
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>{draft.id ? 'Edit product' : 'New product'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Product name *</Label>
              <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. 1.5kVA Inverter" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={draft.category} onValueChange={(v) => setDraft((d) => ({ ...d, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRODUCT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Price (₦, optional)</Label>
                <Input value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value.replace(/[^\d.]/g, '') }))} inputMode="numeric" placeholder="45000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Availability</Label>
                <Select value={draft.availability} onValueChange={(v) => setDraft((d) => ({ ...d, availability: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{AVAILABILITY_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Stock reference (optional)</Label>
                <Input value={draft.stockRef} onChange={(e) => setDraft((d) => ({ ...d, stockRef: e.target.value }))} placeholder="SKU / shelf code" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea rows={2} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Short description used on flyers" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea rows={2} value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Internal notes — never printed" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Product photos ({draft.imageAssetIds.length}/6)</Label>
                <Button variant="outline" size="sm" className="gap-1.5" disabled={uploadingImages || draft.imageAssetIds.length >= 6} onClick={() => fileRef.current?.click()}>{uploadingImages ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {uploadingImages ? 'Uploading…' : 'Add photos'}</Button>
              </div>
              <p className="text-xs text-muted-foreground">The first photo is the primary image. Use the arrows to reorder photos. Removing a photo only detaches it from this product.</p>
              <input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { void handleImage(e.target.files); e.currentTarget.value = '' }} />
              {draft.imageAssetIds.length ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {draft.imageAssetIds.map((id, index) => (
                    <div key={id} className="relative rounded-lg border p-1">
                      <div className="flex aspect-square items-center justify-center overflow-hidden rounded bg-muted">
                        {imgUrls[id] ? <img src={imgUrls[id]} alt={`Product photo ${index + 1}`} className="h-full w-full object-contain" /> : <Package className="h-5 w-5 text-muted-foreground/50" />}
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Move photo left" disabled={index === 0} onClick={() => movePhoto(index, -1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                        <span className="text-[10px] text-muted-foreground">{index === 0 ? 'Primary' : index + 1}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" aria-label="Remove photo" onClick={() => removePhoto(id)}><X className="h-3.5 w-3.5" /></Button>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Move photo right" disabled={index === draft.imageAssetIds.length - 1} onClick={() => movePhoto(index, 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
                      </div>
                      {imgUrls[id] && <Button type="button" variant="outline" size="sm" className="mt-1 h-7 w-full gap-1 px-1 text-[11px]" onClick={() => setCropTarget({ id, index, src: imgUrls[id] })}><Crop className="h-3 w-3" /> Crop / rotate</Button>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground"><Package className="h-6 w-6" /> No photos added yet.</div>
              )}
            </div>
            <Button className="w-full bg-[#1F2A44] hover:bg-[#2a3a5c]" onClick={() => void save()} disabled={saving || uploadingImages}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {draft.id ? 'Save changes' : 'Add product'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImageCropDialog
        key={cropTarget ? `${cropTarget.id}-${cropTarget.index}` : 'no-crop'}
        open={!!cropTarget}
        imageSrc={cropTarget?.src ?? ''}
        fileName={cropTarget ? `Product photo ${cropTarget.index + 1}` : undefined}
        frameAspect={null}
        onCancel={() => setCropTarget(null)}
        onApply={async (result: CropResult) => {
          if (!cropTarget) return
          try {
            const dataUrl = result.dataUrl
            const mimeType = dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
            const { asset } = await assetApi.upload({
              filename: `product-photo-cropped-${Date.now()}.${mimeType === 'image/png' ? 'png' : 'jpg'}`,
              mimeType,
              dataUrl,
              kind: 'product',
              width: result.width,
              height: result.height,
            })
            setDraft((d) => {
              const imageAssetIds = [...d.imageAssetIds]
              if (imageAssetIds[cropTarget.index] === cropTarget.id) imageAssetIds[cropTarget.index] = asset.id
              return { ...d, imageAssetIds }
            })
            setImgUrls((urls) => ({ ...urls, [asset.id]: dataUrl }))
            setCropTarget(null)
            toast.success('Cropped photo added. The original asset is preserved.')
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not save the cropped photo')
          }
        }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{confirmDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Designs already created keep their copied details. This only removes the library entry.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => confirmDelete && void (async () => { try { await productApi.remove(confirmDelete.id); toast.success('Product deleted.'); void load() } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } })()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
