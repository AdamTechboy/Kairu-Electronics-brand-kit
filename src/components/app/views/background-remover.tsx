'use client'

import { useRef, useState } from 'react'
import { useApp } from '../app-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { compressImageFile, compressImageDataUrl } from '@/components/studio/media-utils'
import { aiApi } from '@/lib/api-client'
import { el, newPage, type DesignDocument } from '@/lib/design/types'
import { Download, Eraser, ImagePlus, Loader2, Pencil, RefreshCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

function saveDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function BackgroundRemoverView() {
  const { brand, openEditor } = useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [original, setOriginal] = useState<string | null>(null)
  const [result, setResult] = useState<{ dataUrl: string; width: number; height: number } | null>(null)
  const [loading, setLoading] = useState(false)

  const chooseFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Choose an image file first.'); return }
    setLoading(true)
    try {
      const prepared = await compressImageFile(file, 1400, 0.84, 2_500_000)
      setOriginal(prepared.dataUrl)
      setFileName(file.name.replace(/\.[^.]+$/, '') || 'image')
      setResult(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read this image')
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const removeBackground = async () => {
    if (!original || loading) return
    setLoading(true)
    try {
      const response = await aiApi.removeBackground({ image: original })
      if (!response.transparencyApplied || !response.dataUrl.startsWith('data:image/png')) {
        throw new Error('The service did not return a transparent PNG. Try an image with a cleaner background.')
      }
      setResult({ dataUrl: response.dataUrl, width: response.width, height: response.height })
      toast.success('Background removed. Review the transparent edges before using or sending the image.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Background removal failed')
    } finally {
      setLoading(false)
    }
  }

  const useInEditor = async () => {
    if (!result) return
    setLoading(true)
    try {
      const compressed = await compressImageDataUrl(result.dataUrl, `${fileName || 'image'}-transparent.png`, 1200, 0.82, 1_200_000)
      const ratio = compressed.width / compressed.height
      const width = ratio >= 1 ? 1000 : Math.max(420, Math.round(1000 * ratio))
      const height = ratio < 1 ? 1000 : Math.max(420, Math.round(1000 / ratio))
      const doc: DesignDocument = {
        version: 1, width: 1000, height: 1000, background: null,
        pages: [{
          ...newPage('Transparent cutout', null),
          elements: [el('image', {
            name: `${fileName || 'Image'} transparent cutout`,
            src: compressed.dataUrl,
            x: (1000 - width) / 2,
            y: (1000 - height) / 2,
            w: width,
            h: height,
            fit: 'contain',
            radius: 0,
          })],
        }],
        meta: { type: 'other', notes: 'Background-removed PNG. Select the image layer to resize, rotate, crop, or add it to a design.' },
      }
      openEditor({ initialDoc: doc, initialName: `${fileName || 'Image'} - transparent`.slice(0, 120), initialType: 'other', backTo: 'removebg' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not prepare the image for the editor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8" data-testid="background-remover">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Eraser className="h-6 w-6 text-amber-600" /> Background Remover</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Upload a product photo or logo, remove the background and download a transparent PNG. Keep the original untouched; use the result in Logo Studio or any editable design.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ImagePlus className="h-4 w-4" /> 1. Choose an image</CardTitle></CardHeader>
        <CardContent>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { void chooseFile(e.target.files?.[0]) }} />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="gap-2" onClick={() => inputRef.current?.click()} disabled={loading}><ImagePlus className="h-4 w-4" /> Upload image</Button>
            {original && <Button variant="ghost" className="gap-2" onClick={() => inputRef.current?.click()} disabled={loading}><RefreshCw className="h-4 w-4" /> Choose another</Button>}
            {fileName && <span className="max-w-full truncate text-sm text-muted-foreground">{fileName}</span>}
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Best results come from a clear product or logo that contrasts with the background. Very fine hair, transparent glass, shadows or busy backgrounds can need manual cleanup.</div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Original image</CardTitle></CardHeader>
          <CardContent>
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-muted/50 p-3">
              {original ? <img src={original} alt="Original uploaded image" className="max-h-full max-w-full object-contain" /> : <div className="text-center text-sm text-muted-foreground"><ImagePlus className="mx-auto mb-2 h-8 w-8 opacity-40" />Your original image will appear here.</div>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Transparent result</CardTitle></CardHeader>
          <CardContent>
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border p-3" style={{ backgroundImage: 'linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0,0 10px,10px -10px,-10px 0' }}>
              {result ? <img src={result.dataUrl} alt="Background removed PNG with transparency" className="max-h-full max-w-full object-contain" /> : <div className="text-center text-sm text-muted-foreground"><Eraser className="mx-auto mb-2 h-8 w-8 opacity-40" />The cutout will appear here on a transparency preview.</div>}
            </div>
            {result && <p className="mt-2 text-xs text-muted-foreground">{result.width} × {result.height} px · PNG with transparency</p>}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button className="gap-2 bg-[#1F2A44] hover:bg-[#2a3a5c]" onClick={() => void removeBackground()} disabled={!original || loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />} Remove background</Button>
        <Button variant="outline" className="gap-2" onClick={() => result && saveDataUrl(result.dataUrl, `${fileName || 'image'}-transparent.png`)} disabled={!result || loading}><Download className="h-4 w-4" /> Download transparent PNG</Button>
        <Button variant="outline" className="gap-2" onClick={() => void useInEditor()} disabled={!result || loading}><Pencil className="h-4 w-4" /> Use in editor</Button>
      </div>
    </div>
  )
}
