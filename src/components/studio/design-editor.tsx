'use client'

// DesignEditor: shared editing surface for logos, letterheads, cards, flyers
// and social posts. Editing is fully structural (undo/redo, drag, layers);
// saving persists the editable document — never a flattened image.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DesignDocument, DesignElement, ColorRole, ProjectType } from '@/lib/design/types'
import { CANVAS_PRESETS, applyPaletteToDoc, el, uid } from '@/lib/design/types'
import { makeThumbnail } from '@/lib/export/exporter'
import { docToSvg, generateQrDataUrl } from '@/lib/design/svg'
import type { RenderPalette } from '@/lib/design/svg'
import type { BrandSettings } from '@/lib/brand'
import { projectApi } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { toast } from 'sonner'
import {
  ArrowLeft, Bold, Circle, Image as ImageIcon, Layers, Minus, Plus, QrCode, Redo2, Save, Shapes,
  Square, Type as TypeIcon, Undo2, ZoomIn, ZoomOut, Maximize, Sparkles, Download, Eye, History,
  Palette as PaletteIcon, Menu, CheckCircle2, AlertTriangle, Monitor, Upload, ShieldCheck, Magnet,
} from 'lucide-react'
import { CanvasStage } from './canvas-stage'
import { PropertiesPanel } from './properties-panel'
import { LayersPanel } from './layers-panel'
import { ColorPicker } from './color-picker'
import { colorDistance as colorDist } from '@/lib/design/colors'
import { ExportDialog } from './export-dialog'
import { AiPanel } from './ai-panel'
import { compressImageFile } from './media-utils'
import { ImageCropDialog, type CropResult } from './image-crop-dialog'
import { fitFrameToImage, imageNaturalSize } from '@/lib/design/types'
import { getOfficialLogoDataUrl, withOfficialLogo } from '@/lib/design/logo-resolver'

export interface DesignEditorProps {
  projectId?: string
  templateId?: string
  initialDoc?: DesignDocument
  initialName?: string
  initialType?: ProjectType
  brand: BrandSettings
  onBack: () => void
  onOpenProject?: (id: string) => void
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

export function DesignEditor({ projectId, templateId, initialDoc, initialName, initialType, brand, onBack, onOpenProject }: DesignEditorProps) {
  const [doc, setDoc] = useState<DesignDocument | null>(null)
  const [name, setName] = useState(initialName ?? 'Untitled design')
  const [type, setType] = useState<ProjectType>(initialType ?? 'other')
  const [currentId, setCurrentId] = useState<string | undefined>(projectId)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [zoom, setZoom] = useState(0.8)
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [past, setPast] = useState<DesignDocument[]>([])
  const [future, setFuture] = useState<DesignDocument[]>([])
  const [mobilePanel, setMobilePanel] = useState<'layers' | 'props' | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [versions, setVersions] = useState<{ id: string; label: string; createdAt: string }[]>([])
  const [showExport, setShowExport] = useState(false)
  const [showAi, setShowAi] = useState(false)
  const [proposalDoc, setProposalDoc] = useState<DesignDocument | null>(null)
  const [checking, setChecking] = useState(false)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadedRef = useRef(false)

  const palette: RenderPalette = brand.palette

  // ---------- load / create ----------
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    ;(async () => {
      try {
        if (projectId) {
          const { project } = await projectApi.get(projectId)
          // Bring the official logo into any empty logo placeholders.
          const filled = await withOfficialLogo(project.doc as DesignDocument, brand)
          setDoc(filled)
          setName(project.name)
          setType(project.type as ProjectType)
          setCurrentId(project.id)
          if (filled !== project.doc) setStatus('unsaved')
        } else {
          let newDoc: DesignDocument | undefined = initialDoc
          let newName = initialName ?? 'Untitled design'
          let newType = (initialType ?? 'other') as ProjectType
          if (!newDoc && templateId) {
            const { getTemplate } = await import('@/lib/design/templates')
            const tpl = getTemplate(templateId)
            if (tpl) {
              newDoc = tpl.build(brand)
              newName = tpl.name
              newType = tpl.type
            }
          }
          if (!newDoc) return
          newDoc = await withOfficialLogo(newDoc, brand)
          setDoc(newDoc)
          setName(newName)
          setType(newType)
          let preview = ''
          try {
            preview = await makeThumbnail(newDoc, brand.palette, 420)
          } catch {}
          const { project } = await projectApi.create({
            name: newName,
            type: newType,
            doc: newDoc,
            templateOf: templateId,
            preview,
          })
          setCurrentId(project.id)
          onOpenProject?.(project.id)
          toast.success('Design created — it saves automatically as you work.')
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not open the design')
      }
    })()
  }, [])

  // fit zoom on first load
  useEffect(() => {
    if (!doc) return
    const fit = () => {
      const availableH = window.innerHeight - 210
      const availableW = (window.innerWidth < 1024 ? window.innerWidth - 40 : window.innerWidth - 560)
      const z = Math.min(availableW / doc.width, availableH / doc.height, 1.6)
      setZoom(Math.max(0.05, Math.round(z * 100) / 100))
    }
    fit()
  }, [doc?.width, doc?.height])

  // ---------- history ----------
  const pushPast = useCallback((snapshot: DesignDocument) => {
    setPast((p) => [...p.slice(-59), snapshot])
    setFuture([])
  }, [])

  const patchElements = useCallback(
    (updater: (els: DesignElement[]) => DesignElement[], opts?: { history?: boolean }) => {
      setDoc((prev) => {
        if (!prev) return prev
        if (opts?.history !== false) pushPast(prev)
        const pages = [...prev.pages]
        const page = { ...pages[pageIndex] }
        page.elements = updater(page.elements)
        pages[pageIndex] = page
        return { ...prev, pages }
      })
      setStatus('unsaved')
    },
    [pageIndex, pushPast]
  )

  const beginInteraction = useCallback(() => {
    setDoc((prev) => {
      if (prev) pushPast(prev)
      return prev
    })
  }, [pushPast])

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p
      const prevDoc = p[p.length - 1]
      setDoc((cur) => {
        if (cur) setFuture((f) => [...f.slice(-59), cur])
        return prevDoc
      })
      return p.slice(0, -1)
    })
    setStatus('unsaved')
  }, [])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f
      const nextDoc = f[f.length - 1]
      setDoc((cur) => {
        if (cur) setPast((p) => [...p.slice(-59), cur])
        return nextDoc
      })
      return f.slice(0, -1)
    })
    setStatus('unsaved')
  }, [])

  // ---------- autosave ----------
  const saveNow = useCallback(
    async (snapshot = false) => {
      if (!doc || !currentId) return
      setStatus('saving')
      try {
        const thumb = await makeThumbnail(doc, palette, 420)
        await projectApi.update(currentId, { doc, name, preview: thumb, snapshot, versionLabel: snapshot ? `Saved ${new Date().toLocaleTimeString()}` : undefined })
        if (type === 'logo') {
          // the official-logo raster must follow logo edits
          const { clearOfficialLogoCache } = await import('@/lib/design/logo-resolver')
          clearOfficialLogoCache()
        }
        setStatus('saved')
        if (snapshot) toast.success('Version saved — you can restore it any time.')
      } catch (err) {
        setStatus('error')
        toast.error(err instanceof Error ? `Autosave failed: ${err.message}` : 'Autosave failed. Your design is still open — do not close the tab.')
      }
    },
    [doc, currentId, name, palette, type]
  )

  useEffect(() => {
    if (status !== 'unsaved' || !currentId) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => void saveNow(false), 1600)
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [doc, name, status])

  // ---------- keyboard ----------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveNow(true)
      } else if (mod && e.key.toLowerCase() === 'd' && selectedIds.length) {
        e.preventDefault()
        duplicateSelected()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length) {
        e.preventDefault()
        deleteSelected()
      } else if (e.key === 'Escape') {
        setSelectedIds([])
        setProposalDoc(null)
      } else if (e.key.startsWith('Arrow') && selectedIds.length) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        patchElements((els) => els.map((el0) => (selectedIds.includes(el0.id) ? { ...el0, x: el0.x + dx, y: el0.y + dy } : el0)))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedIds, undo, redo, saveNow])

  // ---------- element ops ----------
  const patchElement = (id: string, patch: Partial<DesignElement>, label?: string) => {
    patchElements((els) => els.map((e0) => (e0.id === id ? { ...e0, ...patch } : e0)), { history: true })
    void label
  }

  const deleteSelected = () => {
    if (!selectedIds.length) return
    patchElements((els) => els.filter((e0) => !selectedIds.includes(e0.id)))
    setSelectedIds([])
    toast.success('Object deleted. Undo with Ctrl+Z if that was a mistake.')
  }

  const duplicateSelected = () => {
    if (!selectedIds.length) return
    const newIds: string[] = []
    patchElements((els) => {
      const copies = els
        .filter((e0) => selectedIds.includes(e0.id))
        .map((e0) => {
          const copy = { ...e0, id: uid(), x: e0.x + 16, y: e0.y + 16, name: e0.name ? `${e0.name} copy` : undefined }
          newIds.push(copy.id)
          return copy
        })
      return [...els, ...copies]
    })
    setSelectedIds(newIds)
  }

  const reorder = (id: string, dir: 'up' | 'down') => {
    patchElements((els) => {
      const idx = els.findIndex((e0) => e0.id === id)
      if (idx === -1) return els
      const target = dir === 'up' ? idx + 1 : idx - 1
      if (target < 0 || target >= els.length) return els
      const copy = [...els]
      ;[copy[idx], copy[target]] = [copy[target], copy[idx]]
      return copy
    })
  }

  const addElement = async (kind: 'text' | 'rect' | 'ellipse' | 'line' | 'symbol' | 'qr' | 'image', symbol?: string) => {
    if (!doc) return
    const page = doc.pages[pageIndex]
    const cxDoc = doc.width / 2
    const cyDoc = doc.height / 2
    let element: DesignElement
    if (kind === 'text') {
      element = el('text', { x: cxDoc - 140, y: cyDoc - 20, w: 280, h: 44, text: 'Your text here', fontSize: Math.max(16, Math.round(doc.width * 0.04)), fontFamily: brand.typography.headingFont, align: 'center', fill: brand.palette.primary, name: 'Text' })
    } else if (kind === 'rect') {
      element = el('rect', { x: cxDoc - 100, y: cyDoc - 60, w: 200, h: 120, radius: 8, fill: brand.palette.secondary, colorRole: 'secondary', name: 'Rectangle' })
    } else if (kind === 'ellipse') {
      element = el('ellipse', { x: cxDoc - 80, y: cyDoc - 80, w: 160, h: 160, fill: brand.palette.secondary, colorRole: 'secondary', name: 'Circle' })
    } else if (kind === 'line') {
      element = el('line', { x: cxDoc - 120, y: cyDoc, w: 240, h: 4, stroke: brand.palette.primary, colorRole: 'primary', strokeWidth: 4, name: 'Line' })
    } else if (kind === 'symbol') {
      element = el('symbol', { x: cxDoc - 70, y: cyDoc - 70, w: 140, h: 140, symbol: symbol ?? 'sun-half', fill: brand.palette.secondary, colorRole: 'secondary', symbolWeight: 'regular', name: 'Symbol' })
    } else if (kind === 'qr') {
      const data = brand.phones[0] ? `tel:${brand.phones[0]}` : 'https://'
      element = el('qr', { x: cxDoc - 60, y: cyDoc - 60, w: 120, h: 120, qrData: data, name: 'QR code' })
      try {
        element.src = await generateQrDataUrl(data)
      } catch {}
    } else {
      // image → open picker
      fileInputRef.current?.click()
      return
    }
    patchElements((els) => [...els, element])
    setSelectedIds([element.id])
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingReplaceRef = useRef<string | null>(null)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [cropState, setCropState] = useState<{
    src: string
    fileName: string
    frameAspect: number | null
    replaceId: string | null
  } | null>(null)

  const openReplaceImage = (targetId?: string) => {
    const id = targetId ?? selectedIds[selectedIds.length - 1]
    if (!id) return
    pendingReplaceRef.current = id
    fileInputRef.current?.click()
  }

  /** Re-open the crop step for an image that is already on the canvas. */
  const openCropForElement = (id: string) => {
    const el0 = doc?.pages[pageIndex].elements.find((e0) => e0.id === id)
    if (!el0 || el0.type !== 'image' || !el0.src) return
    setCropState({ src: el0.src, fileName: el0.name ?? 'image', frameAspect: el0.w / el0.h, replaceId: el0.id })
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || !doc) return
    const file = files[0]
    try {
      const compressed = await compressImageFile(file, 1800)
      const replaceId = pendingReplaceRef.current
      pendingReplaceRef.current = null
      let frameAspect: number | null = null
      if (replaceId) {
        const target = doc.pages[pageIndex].elements.find((e0) => e0.id === replaceId)
        if (target) frameAspect = target.w / target.h
      }
      setCropState({ src: compressed.dataUrl, fileName: file.name, frameAspect, replaceId: replaceId ?? null })
    } catch (err) {
      pendingReplaceRef.current = null
      toast.error(err instanceof Error ? err.message : 'Could not read that image')
    }
  }

  const applyCropResult = (result: CropResult) => {
    const state = cropState
    if (!state || !doc) return
    setCropState(null)
    if (state.replaceId) {
      const target = doc.pages[pageIndex].elements.find((e0) => e0.id === state.replaceId)
      if (!target) return
      if (result.mode === 'whole') {
        // keep everything: resize the frame to the image's exact aspect ratio
        const natural = { width: result.width, height: result.height }
        const geo = fitFrameToImage({ x: target.x, y: target.y, w: target.w, h: target.h }, natural, { width: doc.width, height: doc.height })
        patchElement(target.id, { src: result.dataUrl, fit: 'cover', ...geo })
      } else {
        // cropped to the frame ratio — cover now shows every chosen pixel
        patchElement(target.id, { src: result.dataUrl, fit: 'cover' })
      }
      setSelectedIds([target.id])
      toast.success('Image placed — the frame matches it exactly.')
    } else {
      // brand-new image: the frame takes the picture's own shape, centred
      const ratio = result.width / result.height
      const maxW = doc.width * 0.55
      const maxH = doc.height * 0.7
      let w = maxW
      let h = w / ratio
      if (h > maxH) {
        h = maxH
        w = h * ratio
      }
      const newEl = el('image', {
        x: Math.round(doc.width / 2 - w / 2),
        y: Math.round(doc.height / 2 - h / 2),
        w: Math.round(w),
        h: Math.round(h),
        src: result.dataUrl,
        fit: 'cover',
        name: state.fileName.slice(0, 40),
      })
      patchElements((els) => [...els, newEl])
      setSelectedIds([newEl.id])
      toast.success('Image added — sized to fit its frame exactly.')
    }
    setStatus('unsaved')
  }

  /** Resize the selected image frame so the whole picture shows, uncropped. */
  const fitSelectedFrameToImage = async () => {
    if (!doc || !selectedElement || selectedElement.type !== 'image' || !selectedElement.src) {
      toast.error('Select a picture on the canvas first.')
      return
    }
    try {
      const natural = await imageNaturalSize(selectedElement.src)
      const geo = fitFrameToImage(
        { x: selectedElement.x, y: selectedElement.y, w: selectedElement.w, h: selectedElement.h },
        natural,
        { width: doc.width, height: doc.height }
      )
      patchElement(selectedElement.id, { ...geo, fit: 'cover' })
      toast.success('Frame resized to show the whole picture.')
    } catch {
      toast.error('Could not measure that image')
    }
  }

  const alignSelectedToPage = (to: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => {
    if (!doc || !selectedIds.length) return
    const W = doc.width
    const H = doc.height
    patchElements((els) =>
      els.map((e0) => {
        if (!selectedIds.includes(e0.id)) return e0
        switch (to) {
          case 'left': return { ...e0, x: 0 }
          case 'right': return { ...e0, x: W - e0.w }
          case 'hcenter': return { ...e0, x: Math.round((W - e0.w) / 2) }
          case 'top': return { ...e0, y: 0 }
          case 'bottom': return { ...e0, y: H - e0.h }
          case 'vcenter': return { ...e0, y: Math.round((H - e0.h) / 2) }
        }
      })
    )
  }

  // ---------- brand tools ----------
  const applyBrand = () => {
    if (!doc) return
    pushPast(doc)
    setDoc(applyPaletteToDoc(doc, brand.palette))
    setStatus('unsaved')
    toast.success('Brand colours applied to linked objects.')
  }

  const runBrandCheck = async () => {
    if (!doc) return
    setChecking(true)
    const issues: string[] = []
    const paletteColors = Object.values(brand.palette)
    const usedFonts = new Set<string>()
    let emptyLogo = false
    for (const pg of doc.pages) {
      for (const e0 of pg.elements) {
        if (e0.type === 'text' && e0.fontFamily) usedFonts.add(e0.fontFamily)
        const c = e0.fill
        if (c && !e0.colorRole && /^#[0-9a-fA-F]{6}$/.test(c)) {
          const far = paletteColors.every((pc) => colorDist(c, pc) > 60)
          if (far) issues.push(`“${e0.name ?? e0.type}” uses off-brand colour ${c}.`)
        }
        if (e0.type === 'image' && e0.meta?.placeholder === 'logo' && !e0.src) emptyLogo = true
      }
    }
    for (const f of usedFonts) {
      if (f !== brand.typography.headingFont && f !== brand.typography.bodyFont) {
        issues.push(`Font “${f}” differs from your brand typography (${brand.typography.headingFont}).`)
      }
    }
    if (emptyLogo) issues.push('A logo placeholder is still empty — insert your official logo or upload one.')
    setBrandIssues(issues)
    setChecking(false)
    if (!issues.length) toast.success('Brand check passed — everything matches your identity.')
  }
  const [brandIssues, setBrandIssues] = useState<string[]>([])

  const insertOfficialLogo = async () => {
    if (!doc) return
    try {
      const dataUrl = await getOfficialLogoDataUrl(brand)
      if (!dataUrl) {
        toast.error('No official logo is set yet. Open the Logo Studio and click “Set as official logo” first.')
        return
      }
      const sel = doc.pages[pageIndex].elements.find((e0) => selectedIds.includes(e0.id) && (e0.type === 'image' || e0.meta?.placeholder === 'logo'))
      const emptyPlaceholder = doc.pages[pageIndex].elements.find((e0) => e0.meta?.placeholder === 'logo' && !e0.src && !selectedIds.includes(e0.id))
      if (sel) {
        patchElement(sel.id, { src: dataUrl, meta: { ...sel.meta, placeholder: 'logo' }, fit: 'contain' })
      } else if (emptyPlaceholder) {
        patchElement(emptyPlaceholder.id, { src: dataUrl, meta: { ...emptyPlaceholder.meta, placeholder: 'logo' }, fit: 'contain' })
        setSelectedIds([emptyPlaceholder.id])
      } else {
        const size = Math.round(doc.width * 0.18)
        const newEl = el('image', { x: Math.round(doc.width * 0.06), y: Math.round(doc.height * 0.06), w: size, h: size, src: dataUrl, fit: 'contain', meta: { placeholder: 'logo' }, name: 'Official logo' })
        patchElements((els) => [...els, newEl])
        setSelectedIds([newEl.id])
      }
      toast.success('Official logo inserted.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not insert the logo')
    }
  }

  // ---------- versions ----------
  const loadVersions = async () => {
    if (!currentId) return
    try {
      const { versions: v } = await projectApi.versions(currentId)
      setVersions(v)
      setShowVersions(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load version history')
    }
  }

  const restoreVersion = async (versionId: string) => {
    if (!currentId) return
    try {
      const { project } = await projectApi.restore(currentId, versionId)
      if (doc) pushPast(doc)
      setDoc(project.doc)
      setStatus('unsaved')
      setShowVersions(false)
      toast.success('Previous version restored. Your latest work was kept as a snapshot too.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Restore failed')
    }
  }

  // ---------- AI proposal handling ----------
  const applyProposal = () => {
    if (!proposalDoc || !doc) return
    pushPast(doc)
    setDoc(proposalDoc)
    setProposalDoc(null)
    setStatus('unsaved')
    toast.success('AI changes applied. Undo is available if you dislike them.')
  }

  // ---------- derived ----------
  const page = doc?.pages[pageIndex]
  const selectedElement = page?.elements.find((e0) => e0.id === selectedIds[selectedIds.length - 1]) ?? null

  const statusBadge =
    status === 'saving' ? <Badge variant="secondary" className="gap-1 text-[11px]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" /> Saving…</Badge>
    : status === 'unsaved' ? <Badge variant="outline" className="text-[11px]">Unsaved changes</Badge>
    : status === 'error' ? <Badge variant="destructive" className="text-[11px]">Save failed — retry pending</Badge>
    : <Badge variant="outline" className="gap-1 text-[11px] text-green-700"><CheckCircle2 className="h-3 w-3" /> All changes saved</Badge>

  if (!doc || !page) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center text-sm text-muted-foreground">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          Opening your design…
        </div>
      </div>
    )
  }

  const layerProps = {
    elements: page.elements,
    selectedIds,
    onSelect: setSelectedIds,
    onPatch: patchElement,
    onReorder: reorder,
    onDuplicate: (id: string) => {
      patchElements((els) => {
        const src = els.find((e0) => e0.id === id)
        if (!src) return els
        return [...els, { ...src, id: uid(), x: src.x + 16, y: src.y + 16 }]
      })
    },
    onDelete: (id: string) => {
      patchElements((els) => els.filter((e0) => e0.id !== id))
      setSelectedIds((s) => s.filter((i) => i !== id))
    },
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden" data-testid="design-editor">
      {/* ------- toolbar ------- */}
      <div className="flex flex-wrap items-center gap-1.5 border-b bg-background px-2 py-1.5 md:px-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 gap-1 px-2"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Back</span></Button>
        <Input
          value={name}
          onChange={(e) => { setName(e.target.value); setStatus('unsaved') }}
          className="h-8 w-32 font-medium sm:w-48"
          aria-label="Design name"
        />
        {statusBadge}
        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} disabled={!future.length} title="Redo (Ctrl+Y)"><Redo2 className="h-4 w-4" /></Button>

        {/* Add menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1"><Plus className="h-4 w-4" /> Add</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => void addElement('text')}><TypeIcon className="mr-2 h-4 w-4" /> Text</DropdownMenuItem>
            <DropdownMenuItem onClick={() => void addElement('rect')}><Square className="mr-2 h-4 w-4" /> Rectangle</DropdownMenuItem>
            <DropdownMenuItem onClick={() => void addElement('ellipse')}><Circle className="mr-2 h-4 w-4" /> Circle</DropdownMenuItem>
            <DropdownMenuItem onClick={() => void addElement('line')}><Minus className="mr-2 h-4 w-4" /> Line</DropdownMenuItem>
            <DropdownMenuItem onClick={() => void addElement('image')}><ImageIcon className="mr-2 h-4 w-4" /> Upload image</DropdownMenuItem>
            <DropdownMenuItem onClick={() => void addElement('qr')}><QrCode className="mr-2 h-4 w-4" /> QR code</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Product symbols</DropdownMenuLabel>
            {[['sun-half', 'Sun'], ['solar-panel', 'Solar panel'], ['tv', 'Television'], ['fridge', 'Refrigerator'], ['fan', 'Fan'], ['inverter', 'Inverter'], ['battery', 'Battery']].map(([k, l]) => (
              <DropdownMenuItem key={k} onClick={() => void addElement('symbol', k)}><Shapes className="mr-2 h-4 w-4" /> {l}</DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void insertOfficialLogo()}><ShieldCheck className="mr-2 h-4 w-4" /> Insert official logo</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

          {/* zoom */}
        <div className="hidden items-center gap-0.5 md:flex">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(0.05, z - 0.1))} title="Zoom out"><ZoomOut className="h-4 w-4" /></Button>
          <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(4, z + 0.1))} title="Zoom in"><ZoomIn className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(Math.min(1.6, Math.max(0.05, Math.round((window.innerHeight - 260) / doc.height * 100) / 100)))} title="Fit to screen"><Maximize className="h-4 w-4" /></Button>
          <Button
            variant={snapEnabled ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setSnapEnabled((v) => !v)}
            title={snapEnabled ? 'Snapping on — click to disable' : 'Snapping off — click to enable'}
          >
            <Magnet className="h-4 w-4" />
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-8 gap-1" onClick={applyBrand} title="Apply your brand colours to linked objects"><PaletteIcon className="h-4 w-4" /><span className="hidden lg:inline">Brand colours</span></Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1"><ShieldCheck className="h-4 w-4" /><span className="hidden lg:inline">Brand check</span></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="flex items-center justify-between">
                Brand consistency
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => void runBrandCheck()} disabled={checking}>{checking ? 'Checking…' : 'Run check'}</Button>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {brandIssues.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">Run the check to find off-brand colours, fonts or empty placeholders in this design.</div>
              ) : (
                brandIssues.map((iss, i) => (
                  <div key={i} className="flex gap-2 px-3 py-1.5 text-xs"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />{iss}</div>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setShowPreview(true)}><Eye className="h-4 w-4" /><span className="hidden lg:inline">Preview</span></Button>
          <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => void loadVersions()}><History className="h-4 w-4" /><span className="hidden lg:inline">Versions</span></Button>
          <Button variant="outline" size="sm" className="h-8 gap-1 border-amber-500 text-amber-700 hover:bg-amber-50" onClick={() => setShowAi(true)}><Sparkles className="h-4 w-4" /> AI</Button>
          <Button size="sm" className="h-8 gap-1" onClick={() => void saveNow(true)}><Save className="h-4 w-4" /><span className="hidden lg:inline">Save version</span></Button>
          <Button size="sm" className="h-8 gap-1 bg-amber-600 hover:bg-amber-700" onClick={() => setShowExport(true)}><Download className="h-4 w-4" /> Export</Button>

          {/* mobile panel toggles */}
          <Sheet open={mobilePanel === 'layers'} onOpenChange={(v) => setMobilePanel(v ? 'layers' : null)}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 lg:hidden" title="Layers"><Layers className="h-4 w-4" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="sr-only"><SheetTitle>Layers</SheetTitle></SheetHeader>
              <LayersPanel {...layerProps} />
            </SheetContent>
          </Sheet>
          <Sheet open={mobilePanel === 'props'} onOpenChange={(v) => setMobilePanel(v ? 'props' : null)}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 lg:hidden" title="Properties"><Menu className="h-4 w-4" /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 overflow-y-auto p-0">
              <SheetHeader className="sr-only"><SheetTitle>Properties</SheetTitle></SheetHeader>
              <PropertiesPanel
                element={selectedElement}
                palette={brand.palette}
                docSize={{ width: doc.width, height: doc.height }}
                onPatch={(patch, label) => selectedElement && patchElement(selectedElement.id, patch, label)}
                onDuplicate={duplicateSelected}
                onDelete={deleteSelected}
                onLayerChange={(dir) => selectedElement && reorder(selectedElement.id, dir)}
                onAlignPage={alignSelectedToPage}
                onRequestImageReplace={() => openReplaceImage()}
                onCropImage={() => selectedElement && openCropForElement(selectedElement.id)}
                onFitFrameToImage={() => selectedElement && void fitSelectedFrameToImage()}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* page tabs */}
      {doc.pages.length > 1 && (
        <div className="flex gap-1 border-b bg-muted/40 px-2 py-1">
          {doc.pages.map((p, i) => (
            <button key={p.id} onClick={() => { setPageIndex(i); setSelectedIds([]) }} className={`rounded-md px-3 py-1 text-xs font-medium transition ${i === pageIndex ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* ------- main area ------- */}
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 border-r bg-background lg:block">
          <LayersPanel {...layerProps} />
        </aside>
        <main className="relative min-w-0 flex-1">
          {proposalDoc && (
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 bg-amber-500 px-3 py-1.5 text-xs font-medium text-white">
              <span>Previewing AI-proposed changes — nothing is saved until you accept.</span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" className="h-6 px-2 text-xs" onClick={applyProposal}>Apply</Button>
                <Button size="sm" variant="secondary" className="h-6 px-2 text-xs" onClick={() => setProposalDoc(null)}>Discard</Button>
              </div>
            </div>
          )}
          <CanvasStage
            doc={proposalDoc ?? doc}
            pageIndex={pageIndex}
            palette={palette}
            zoom={zoom}
            selectedIds={selectedIds}
            onSelectIds={setSelectedIds}
            onPatchElements={(u) => patchElements(u, { history: false })}
            onBeginInteraction={beginInteraction}
            snapEnabled={snapEnabled}
            onRequestImageReplace={(el0) => openReplaceImage(el0.id)}
          />
        </main>
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-l bg-background lg:block">
          <PropertiesPanel
            element={selectedElement}
            palette={brand.palette}
            docSize={{ width: doc.width, height: doc.height }}
            onPatch={(patch, label) => selectedElement && patchElement(selectedElement.id, patch, label)}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onLayerChange={(dir) => selectedElement && reorder(selectedElement.id, dir)}
            onAlignPage={alignSelectedToPage}
            onRequestImageReplace={() => openReplaceImage()}
            onCropImage={() => selectedElement && openCropForElement(selectedElement.id)}
            onFitFrameToImage={() => selectedElement && void fitSelectedFrameToImage()}
          />
          {!selectedElement && (
            <div className="border-t p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Page background</p>
              <ColorPicker
                label="Background colour"
                value={page.background}
                palette={brand.palette}
                allowNone
                onChange={(v) => {
                  patchElements((els) => els, { history: true })
                  setDoc((prev) => {
                    if (!prev) return prev
                    const pages = [...prev.pages]
                    pages[pageIndex] = { ...pages[pageIndex], background: v.color }
                    return { ...prev, pages }
                  })
                  setStatus('unsaved')
                }}
              />
              <p className="mt-3 text-xs text-muted-foreground">Canvas: {doc.width} × {doc.height} px {doc.meta?.templateId && CANVAS_PRESETS[doc.meta.templateId] ? `(${CANVAS_PRESETS[doc.meta.templateId].label})` : ''}</p>
            </div>
          )}
        </aside>
      </div>

      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { void handleFiles(e.target.files); e.currentTarget.value = '' }} />

      {/* crop & place step for every uploaded picture (keyed per session) */}
      <ImageCropDialog
        key={cropState ? `${cropState.replaceId ?? 'new'}:${cropState.src.length}:${cropState.src.slice(-24)}` : 'crop-closed'}
        open={!!cropState}
        imageSrc={cropState?.src ?? ''}
        fileName={cropState?.fileName}
        frameAspect={cropState?.frameAspect ?? null}
        onCancel={() => setCropState(null)}
        onApply={applyCropResult}
      />

      {/* preview */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Monitor className="h-4 w-4" /> Preview — {name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-auto rounded-lg bg-[#E9E6DE] p-4">
            <PreviewContent doc={doc} pageIndex={pageIndex} palette={palette} />
          </div>
          <p className="text-xs text-muted-foreground">This is an accurate preview. Use Export to produce a real file (PDF, PNG, JPG or SVG).</p>
        </DialogContent>
      </Dialog>

      {/* versions */}
      <Dialog open={showVersions} onOpenChange={setShowVersions}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Version history</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-80">
            <div className="space-y-1.5 pr-3">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <div>
                    <p className="font-medium">{v.label}</p>
                    <p className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void restoreVersion(v.id)}>Restore</Button>
                </div>
              ))}
              {versions.length === 0 && <p className="text-sm text-muted-foreground">No versions yet — click “Save version” to create one.</p>}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* export */}
      {showExport && (
        <ExportDialog
          doc={doc}
          palette={palette}
          brand={brand}
          project={{ id: currentId ?? null, name, type }}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* AI */}
      <AiPanel
        open={showAi}
        onOpenChange={setShowAi}
        doc={doc}
        brand={brand}
        designType={type}
        onPreview={(d) => setProposalDoc(d)}
        onCommit={(d) => {
          if (doc) pushPast(doc)
          setDoc(d)
          setStatus('unsaved')
          toast.success('AI changes applied.')
        }}
      />
    </div>
  )
}

// static preview renderer (non-interactive)
function PreviewContent({ doc, pageIndex, palette }: { doc: DesignDocument; pageIndex: number; palette: RenderPalette }) {
  const svg = useMemo(() => docToSvg(doc, { palette, pageIndex, includeBackground: true }), [doc, pageIndex, palette])
  return (
    <div className="mx-auto" style={{ maxWidth: doc.width }}>
      <div className="[&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  )
}
