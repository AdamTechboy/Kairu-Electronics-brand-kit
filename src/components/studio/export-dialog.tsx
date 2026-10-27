'use client'

// Universal export dialog: PNG / JPG / SVG / PDF / Print with a short
// purpose wizard for logos. Every format produces a REAL file.

import { useMemo, useState } from 'react'
import type { DesignDocument } from '@/lib/design/types'
import { pxToMm } from '@/lib/design/types'
import type { RenderPalette } from '@/lib/design/svg'
import type { BrandSettings } from '@/lib/brand'
import { defaultFileName, downloadPdf, downloadRaster, downloadSvg, printDoc } from '@/lib/export/exporter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ColorPicker } from './color-picker'
import { docToSvg } from '@/lib/design/svg'
import { FileDown, Image as ImageIcon, FileText, Printer, FileCode2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type Format = 'png' | 'jpg' | 'svg' | 'pdf' | 'print'

interface Props {
  doc: DesignDocument
  palette: RenderPalette
  brand: BrandSettings
  project: { id: string | null; name: string; type: string }
  onClose: () => void
}

const LOGO_USES = [
  { id: 'web', label: 'Website / web apps', format: 'png' as Format, scale: 2, transparent: true },
  { id: 'social', label: 'Social media profiles', format: 'png' as Format, scale: 2, transparent: false },
  { id: 'marketing', label: 'Digital marketing', format: 'png' as Format, scale: 3, transparent: true },
  { id: 'documents', label: 'Document headers', format: 'png' as Format, scale: 2, transparent: true },
  { id: 'cards', label: 'Business cards', format: 'pdf' as Format, scale: 1, transparent: false },
  { id: 'letterheads', label: 'Letterheads', format: 'pdf' as Format, scale: 1, transparent: false },
  { id: 'signage', label: 'Shop signage', format: 'svg' as Format, scale: 1, transparent: true },
  { id: 'packaging', label: 'Product packaging', format: 'svg' as Format, scale: 1, transparent: true },
  { id: 'merch', label: 'Uniforms / merchandise', format: 'svg' as Format, scale: 1, transparent: true },
  { id: 'print', label: 'General print', format: 'pdf' as Format, scale: 1, transparent: false },
]

export function ExportDialog({ doc, palette, brand, project, onClose }: Props) {
  const isLogo = project.type === 'logo'
  const [format, setFormat] = useState<Format>(isLogo ? 'png' : 'pdf')
  const [scale, setScale] = useState(2)
  const [transparent, setTransparent] = useState(isLogo)
  const [bgColor, setBgColor] = useState('#ffffff')
  const [fileName, setFileName] = useState(() => defaultFileName(brand, project, isLogo ? 'png' : 'pdf'))
  const [pdfMode, setPdfMode] = useState<'vector' | 'image'>('vector')
  const [cropMarks, setCropMarks] = useState(false)
  const [busy, setBusy] = useState(false)
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2>(isLogo ? 0 : 2)
  const [selectedUses, setSelectedUses] = useState<string[]>([])
  const [pageIdx, setPageIdx] = useState(0)

  const mm = pxToMm(doc)
  const previewSvg = useMemo(() => docToSvg(doc, { palette, pageIndex: pageIdx, includeBackground: true }), [doc, palette, pageIdx])

  const extOf = (f: Format) => (f === 'print' ? 'png' : f)
  const changeFormat = (f: Format) => {
    setFormat(f)
    setFileName((prev) => prev.replace(/\.[a-z0-9]+$/i, `.${extOf(f)}`))
  }

  const applyUses = (uses: string[]) => {
    setSelectedUses(uses)
    const first = LOGO_USES.find((u) => u.id === uses[0])
    if (first) {
      changeFormat(first.format)
      setScale(first.scale)
      setTransparent(first.transparent)
    }
  }

  const doExport = async () => {
    setBusy(true)
    try {
      if (format === 'svg') {
        await downloadSvg(doc, palette, fileName, { projectId: project.id, projectName: project.name, projectType: project.type, brand })
        toast.success('SVG downloaded — a genuine vector file you can scale to any size.')
      } else if (format === 'png' || format === 'jpg') {
        await downloadRaster(doc, palette, {
          format,
          scale,
          transparent: format === 'png' ? transparent : false,
          background: transparent ? null : bgColor,
          fileName,
          projectId: project.id,
          projectName: project.name,
          projectType: project.type,
          brand,
          pageIndex: pageIdx,
        })
        toast.success(`${format.toUpperCase()} downloaded at ${Math.round(doc.width * scale)}×${Math.round(doc.height * scale)} px.`)
      } else if (format === 'pdf') {
        const res = await downloadPdf(doc, palette, {
          mode: pdfMode,
          dpi: 300,
          transparent,
          fileName,
          cropMarks,
          projectId: project.id,
          projectName: project.name,
          projectType: project.type,
          brand,
        })
        if (res.usedFallback) {
          toast.warning('PDF exported. Vector conversion was not possible for every effect, so high-resolution rendering was used where needed.')
        } else {
          toast.success(`PDF downloaded (${mm.w.toFixed(0)}×${mm.h.toFixed(0)} mm, ${doc.pages.length} page${doc.pages.length > 1 ? 's' : ''}).`)
        }
      } else {
        await printDoc(doc, palette, brand, 200, pageIdx)
        toast.success('Print dialog opened.')
      }
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed. Your saved design has not been lost.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export “{project.name}”</DialogTitle>
          <DialogDescription>
            {doc.width} × {doc.height} px ≈ {mm.w.toFixed(0)} × {mm.h.toFixed(0)} mm · {doc.pages.length} page{doc.pages.length > 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        {wizardStep === 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">What will you use the logo for?</p>
            <p className="text-xs text-muted-foreground">Select one or more — we&apos;ll recommend the best format and size.</p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {LOGO_USES.map((u) => {
                const active = selectedUses.includes(u.id)
                return (
                  <button
                    key={u.id}
                    onClick={() => applyUses(active ? selectedUses.filter((i) => i !== u.id) : [...selectedUses, u.id])}
                    className={`rounded-lg border p-2 text-left text-xs transition ${active ? 'border-amber-500 bg-amber-50 font-medium' : 'hover:bg-muted'}`}
                  >
                    {u.label}
                  </button>
                )
              })}
            </div>
            <Button className="w-full" onClick={() => setWizardStep(1)}>Continue</Button>
          </div>
        )}

        {wizardStep === 1 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Preferred background</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'transparent', label: 'Transparent (PNG/SVG)' },
                { id: 'white', label: 'White' },
                { id: 'brand', label: 'Brand light colour' },
                { id: 'custom', label: 'Custom colour' },
              ].map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    if (b.id === 'transparent') setTransparent(true)
                    else {
                      setTransparent(false)
                      setBgColor(b.id === 'white' ? '#ffffff' : b.id === 'brand' ? brand.palette.light : bgColor)
                    }
                  }}
                  className={`rounded-lg border p-2 text-xs transition hover:bg-muted`}
                >
                  {b.label}
                </button>
              ))}
            </div>
            {!transparent && (
              <ColorPicker label="Background colour" value={bgColor} palette={brand.palette} onChange={(v) => v.color && setBgColor(v.color)} />
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setWizardStep(0)}>Back</Button>
              <Button className="flex-1" onClick={() => setWizardStep(2)}>Continue</Button>
            </div>
          </div>
        )}

        {wizardStep === 2 && (
          <div className="space-y-4">
            {/* format tabs */}
            <div className="grid grid-cols-5 gap-1">
              {([
                ['png', 'PNG', ImageIcon],
                ['jpg', 'JPG', ImageIcon],
                ['pdf', 'PDF', FileText],
                ['svg', 'SVG', FileCode2],
                ['print', 'Print', Printer],
              ] as const).map(([f, label, Icon]) => (
                <button
                  key={f}
                  onClick={() => changeFormat(f)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[11px] font-medium transition ${format === f ? 'border-amber-500 bg-amber-50' : 'hover:bg-muted'}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* format options */}
            {(format === 'png' || format === 'jpg') && (
              <div className="space-y-3 rounded-lg border p-3">
                <div>
                  <Label className="text-xs">Resolution — {Math.round(doc.width * scale)} × {Math.round(doc.height * scale)} px {format === 'png' && scale >= 3 ? '(print quality)' : ''}</Label>
                  <Slider value={[scale]} min={1} max={4} step={0.5} onValueChange={([v]) => setScale(v)} className="mt-2" />
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>1× screen</span><span>2× sharp</span><span>3–4× print</span></div>
                </div>
                {format === 'png' && (
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Transparent background</Label>
                    <Switch checked={transparent} onCheckedChange={setTransparent} />
                  </div>
                )}
                {!(format === 'png' && transparent) && (
                  <ColorPicker label="Background colour" value={bgColor} palette={brand.palette} onChange={(v) => v.color && setBgColor(v.color)} />
                )}
              </div>
            )}

            {format === 'pdf' && (
              <div className="space-y-3 rounded-lg border p-3">
                <div>
                  <Label className="text-xs">PDF engine</Label>
                  <Select value={pdfMode} onValueChange={(v) => setPdfMode(v as 'vector' | 'image')}>
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vector">Vector (crisp text, small file, recommended)</SelectItem>
                      <SelectItem value="image">High-res image (300 DPI, pixel-perfect)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Add crop marks (for professional printing)</Label>
                  <Switch checked={cropMarks} onCheckedChange={setCropMarks} />
                </div>
                {doc.pages.length > 1 && (
                  <p className="text-xs text-muted-foreground">All {doc.pages.length} pages/sides will be included, in order.</p>
                )}
              </div>
            )}

            {format === 'svg' && (
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Transparent background (recommended for logos)</Label>
                  <Switch checked={transparent} onCheckedChange={setTransparent} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">SVG is a true vector file — infinitely scalable for signage and print.</p>
              </div>
            )}

            {format === 'print' && (
              <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                Opens your printer dialog at the correct physical size ({mm.w.toFixed(0)} × {mm.h.toFixed(0)} mm). Use your printer&apos;s “fit to page” off for exact size.
              </div>
            )}

            {doc.pages.length > 1 && (format === 'png' || format === 'jpg' || format === 'print') && (
              <div>
                <Label className="text-xs">Page / side</Label>
                <Select value={String(pageIdx)} onValueChange={(v) => setPageIdx(+v)}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {doc.pages.map((p, i) => <SelectItem key={p.id} value={String(i)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* preview */}
            <div>
              <Label className="text-xs">Preview</Label>
              <div className="mt-1 flex max-h-48 items-center justify-center overflow-hidden rounded-lg border bg-[#E9E6DE] p-2"
                style={{ backgroundImage: transparent && format !== 'jpg' && format !== 'pdf' ? 'repeating-conic-gradient(#e8e8e8 0% 25%, #ffffff 0% 50%) 50% / 16px 16px' : undefined }}
              >
                <div className="[&_svg]:h-auto [&_svg]:max-h-44 [&_svg]:w-full [&_svg]:max-w-[280px]" dangerouslySetInnerHTML={{ __html: previewSvg }} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">File name</Label>
              <Input value={fileName} onChange={(e) => setFileName(e.target.value)} className="h-9 text-sm" />
            </div>

            <div className="flex gap-2">
              {isLogo && <Button variant="outline" className="flex-1" onClick={() => setWizardStep(1)}>Back</Button>}
              <Button className="flex-1 gap-2" onClick={() => void doExport()} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                {busy ? 'Preparing…' : format === 'print' ? 'Open print dialog' : `Download ${format.toUpperCase()}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
