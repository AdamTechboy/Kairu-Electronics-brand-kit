'use client'

// ImageCropDialog: professional crop step shown whenever a picture is placed
// into a frame. The owner can trim the photo, rotate it, lock the crop to the
// target frame's aspect ratio, or keep the whole image and let the frame
// resize itself. Output is a new data-url — the original file is untouched.
//
// The parent remounts this dialog per crop session (via `key`), so all state
// initialisers read fresh props and no effect needs synchronous setState.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { RotateCcw, RotateCw, Crop as CropIcon, Maximize2, Square, Frame } from 'lucide-react'

export type CropApplyMode = 'fill' | 'whole'

export interface CropResult {
  dataUrl: string
  width: number
  height: number
  /** Original (uncropped, un-rotated) data-url for "keep whole image". */
  fullDataUrl: string
  mode: CropApplyMode
  rotated: boolean
}

interface Props {
  open: boolean
  imageSrc: string
  fileName?: string
  /** Aspect ratio (w/h) of the target frame, when replacing one. */
  frameAspect?: number | null
  onCancel: () => void
  onApply: (result: CropResult) => void
}

type AspectPreset = { label: string; value: number | null }

const ASPECTS: AspectPreset[] = [
  { label: 'Frame', value: -1 }, // resolved to frameAspect at runtime
  { label: 'Free', value: null },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
]

const MAX_OUT_PX = 1800
const VIEW_W = 560
const VIEW_H = 360

interface Box { x: number; y: number; w: number; h: number }

/** Largest centred box with the requested ratio inside w×h (full box when aspect is null). */
function computeBox(w: number, h: number, aspect: number | null): Box {
  if (!w || !h) return { x: 0, y: 0, w: 0, h: 0 }
  let bw = w
  let bh = h
  if (aspect) {
    if (w / h > aspect) {
      bw = h * aspect
      bh = h
    } else {
      bw = w
      bh = w / aspect
    }
  }
  return { x: Math.round((w - bw) / 2), y: Math.round((h - bh) / 2), w: Math.round(bw), h: Math.round(bh) }
}

export function ImageCropDialog({ open, imageSrc, fileName, frameAspect, onCancel, onApply }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [aspectIdx, setAspectIdx] = useState(frameAspect ? 0 : 1)
  const [rot90, setRot90] = useState(0) // accumulated quarter turns
  const [box, setBox] = useState<Box>({ x: 0, y: 0, w: 0, h: 0 })
  const [drag, setDrag] = useState<null | { kind: 'move' | 'resize'; dir?: string; sx: number; sy: number; orig: Box }>(null)
  const [quality, setQuality] = useState(92)
  const viewRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef(box)
  const activeAspectRef = useRef<number | null>(null)

  // keep refs in sync for pointer handlers (never read refs during render)
  useEffect(() => {
    boxRef.current = box
  }, [box])

  const swapped = rot90 % 180 !== 0

  const natW = img ? (swapped ? img.naturalHeight : img.naturalWidth) : 0
  const natH = img ? (swapped ? img.naturalWidth : img.naturalHeight) : 0

  const activeAspect = (() => {
    const a = ASPECTS[aspectIdx]
    if (a.value === -1) return frameAspect ?? null
    return a.value
  })()

  useEffect(() => {
    activeAspectRef.current = activeAspect
  }, [activeAspect])

  // fit image into the dialog viewport
  const viewScale = natW && natH ? Math.min(VIEW_W / natW, VIEW_H / natH, 1) : 1
  const dispW = natW * viewScale
  const dispH = natH * viewScale

  // load the image (setState happens only in async callbacks)
  useEffect(() => {
    if (!open || !imageSrc) return
    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      setImg(image)
      // initial crop box: full image, or the largest centred frame-ratio box
      setBox(computeBox(image.naturalWidth, image.naturalHeight, activeAspectRef.current))
    }
    image.onerror = () => {
      if (!cancelled) setLoadError('That file could not be read as an image.')
    }
    image.src = imageSrc
    return () => {
      cancelled = true
    }
  }, [open, imageSrc])

  const applyAspect = useCallback((idx: number) => {
    setAspectIdx(idx)
    const a = ASPECTS[idx]
    const aspect = a.value === -1 ? (frameAspect ?? null) : a.value
    if (boxRef.current.w && boxRef.current.h) {
      // refit around the box centre using the current (rotated) dims
      const w = boxRef.current.w
      const h = boxRef.current.h
      setBox(computeBox(w, h, aspect))
    }
  }, [frameAspect])

  // pointer interactions on the crop rect
  const toImgCoords = (clientX: number, clientY: number) => {
    const r = viewRef.current?.getBoundingClientRect()
    if (!r) return { x: 0, y: 0 }
    return { x: (clientX - r.left) / viewScale, y: (clientY - r.top) / viewScale }
  }

  const onPointerDown = (kind: 'move' | 'resize', dir?: string) => (ev: React.PointerEvent) => {
    ev.stopPropagation()
    ev.preventDefault()
    const p = toImgCoords(ev.clientX, ev.clientY)
    setDrag({ kind, dir, sx: p.x, sy: p.y, orig: boxRef.current })
    ;(ev.target as HTMLElement).setPointerCapture?.(ev.pointerId)
  }

  const onPointerMove = (ev: React.PointerEvent) => {
    if (!drag) return
    const p = toImgCoords(ev.clientX, ev.clientY)
    const dx = p.x - drag.sx
    const dy = p.y - drag.sy
    const o = drag.orig
    const min = 24
    const clampBox = (b: Box): Box => {
      const w = Math.max(min, Math.min(natW, Math.round(b.w)))
      const h = Math.max(min, Math.min(natH, Math.round(b.h)))
      return {
        w,
        h,
        x: Math.max(0, Math.min(natW - w, Math.round(b.x))),
        y: Math.max(0, Math.min(natH - h, Math.round(b.y))),
      }
    }
    if (drag.kind === 'move') {
      setBox(clampBox({ ...o, x: o.x + dx, y: o.y + dy }))
      return
    }
    const dir = drag.dir ?? 'se'
    const aspect = activeAspectRef.current
    let next: Box
    if (aspect) {
      // locked ratio: size from the dominant drag axis, anchored at the opposite corner
      const anchorX = dir.includes('w') ? o.x + o.w : o.x
      const anchorY = dir.includes('n') ? o.y + o.h : o.y
      const fromW = dir === 'e' || dir === 'w' || (dir.length === 2 && Math.abs(dx) >= Math.abs(dy))
      let nw = fromW ? o.w + (dir.includes('w') ? -dx : dx) : (o.h + (dir.includes('n') ? -dy : dy)) * aspect
      let nh = nw / aspect
      if (nh > natH) {
        nh = natH
        nw = nh * aspect
      }
      if (nw > natW) {
        nw = natW
        nh = nw / aspect
      }
      nw = Math.max(min, nw)
      nh = Math.max(min, nh)
      next = clampBox({ x: dir.includes('w') ? anchorX - nw : anchorX, y: dir.includes('n') ? anchorY - nh : anchorY, w: nw, h: nh })
    } else {
      let { x, y, w, h } = o
      if (dir.includes('e')) w = o.w + dx
      if (dir.includes('s')) h = o.h + dy
      if (dir.includes('w')) {
        w = o.w - dx
        x = o.x + dx
      }
      if (dir.includes('n')) {
        h = o.h - dy
        y = o.y + dy
      }
      next = clampBox({ x, y, w, h })
    }
    setBox(next)
  }

  const endDrag = () => setDrag(null)

  const rotate = (dir: 1 | -1) => {
    const next = ((rot90 + dir * 90) % 360 + 360) % 360
    const nextSwapped = next % 180 !== 0
    const w = img ? (nextSwapped ? img.naturalHeight : img.naturalWidth) : 0
    const h = img ? (nextSwapped ? img.naturalWidth : img.naturalHeight) : 0
    setRot90(next)
    if (w && h) setBox(computeBox(w, h, activeAspectRef.current))
  }

  const applyCrop = (mode: CropApplyMode) => {
    if (!img || !box.w || !box.h) return
    // 1) build the rotated source once (displayed orientation), then crop
    //    straight out of it — always geometrically correct.
    const rotCanvas = document.createElement('canvas')
    rotCanvas.width = natW
    rotCanvas.height = natH
    const rctx = rotCanvas.getContext('2d')!
    if (rot90 === 0) {
      rctx.drawImage(img, 0, 0)
    } else {
      rctx.translate(natW / 2, natH / 2)
      rctx.rotate((rot90 * Math.PI) / 180)
      rctx.drawImage(img, -(rot90 === 180 ? natW : natH) / 2, -(rot90 === 180 ? natH : natW) / 2)
    }
    // 2) output region: the crop box, or the whole (rotated) image for "whole" mode
    const rx = mode === 'whole' ? 0 : box.x
    const ry = mode === 'whole' ? 0 : box.y
    const rw = mode === 'whole' ? natW : box.w
    const rh = mode === 'whole' ? natH : box.h
    const scale = Math.min(1, MAX_OUT_PX / Math.max(rw, rh))
    const outW = Math.max(1, Math.round(rw * scale))
    const outH = Math.max(1, Math.round(rh * scale))
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(rotCanvas, rx, ry, rw, rh, 0, 0, outW, outH)
    // 3) Prefer JPEG only when the cropped pixels are fully opaque. Encoding a
    // transparent PNG/WebP crop as JPEG would silently replace transparency with
    // a solid background, so keep PNG whenever any output pixel has alpha < 255.
    let dataUrl = canvas.toDataURL('image/png')
    if (quality < 100) {
      try {
        const pixels = ctx.getImageData(0, 0, outW, outH).data
        let hasTransparency = false
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] < 255) {
            hasTransparency = true
            break
          }
        }
        if (!hasTransparency) {
          const jpeg = canvas.toDataURL('image/jpeg', quality / 100)
          if (jpeg.length < dataUrl.length) dataUrl = jpeg
        }
      } catch {
        // If pixel inspection is blocked, preserve the PNG rather than risk
        // flattening transparent pixels into JPEG.
      }
    }
    onApply({
      dataUrl,
      width: outW,
      height: outH,
      fullDataUrl: imageSrc,
      mode,
      rotated: swapped,
    })
  }

  const pct = (v: number, total: number) => `${total ? (v / total) * 100 : 0}%`
  const handles = ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w']

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-2xl" data-testid="image-crop-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CropIcon className="h-4 w-4 text-amber-600" /> Crop &amp; place image</DialogTitle>
          <DialogDescription>
            {frameAspect
              ? 'Choose how the picture sits in its frame — crop it to fill, or keep everything and let the frame resize.'
              : 'Trim the picture if you like. The frame will match the image exactly — nothing gets cut off.'}
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{loadError}</div>
        ) : !img ? (
          <div className="flex h-64 items-center justify-center rounded-lg bg-muted">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* crop viewport */}
            <div
              ref={viewRef}
              className="relative mx-auto select-none overflow-hidden rounded-lg"
              style={{
                width: dispW || 320,
                height: dispH || 240,
                backgroundImage: 'conic-gradient(#d4d0c8 0 25%, #ffffff 0 50%, #d4d0c8 0 75%, #ffffff 0)',
                backgroundSize: '16px 16px',
              }}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
            >
              <img
                src={imageSrc}
                alt={fileName || 'Crop source'}
                draggable={false}
                className="absolute opacity-50"
                style={{
                  width: (swapped ? img.naturalHeight : img.naturalWidth) * viewScale,
                  height: (swapped ? img.naturalWidth : img.naturalHeight) * viewScale,
                  left: swapped ? (dispW - dispH) / 2 : 0,
                  top: swapped ? (dispH - dispW) / 2 : 0,
                  transform: `rotate(${rot90}deg)`,
                }}
              />
              {/* crop window */}
              <div
                className="absolute cursor-move border-2 border-amber-500 shadow-[0_0_0_9999px_rgba(15,18,25,0.55)]"
                style={{
                  left: pct(box.x, natW),
                  top: pct(box.y, natH),
                  width: pct(box.w, natW),
                  height: pct(box.h, natH),
                  touchAction: 'none',
                }}
                onPointerDown={onPointerDown('move')}
                data-testid="crop-rect"
              >
                {/* thirds guides */}
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute left-1/3 top-0 h-full w-px bg-white/40" />
                  <div className="absolute left-2/3 top-0 h-full w-px bg-white/40" />
                  <div className="absolute left-0 top-1/3 h-px w-full bg-white/40" />
                  <div className="absolute left-0 top-2/3 h-px w-full bg-white/40" />
                </div>
                {handles.map((dir) => (
                  <div
                    key={dir}
                    onPointerDown={onPointerDown('resize', dir)}
                    className={`absolute h-3.5 w-3.5 rounded-full border-2 border-amber-500 bg-white shadow ${
                      dir.includes('n') ? '-top-1.5' : dir.includes('s') ? '-bottom-1.5' : ''
                    } ${dir.includes('w') ? '-left-1.5' : dir.includes('e') ? '-right-1.5' : ''} ${
                      ['n', 's'].includes(dir) ? 'left-1/2 -translate-x-1/2' : ['e', 'w'].includes(dir) ? 'top-1/2 -translate-y-1/2' : ''
                    } ${dir === 'nw' || dir === 'se' ? 'cursor-nwse-resize' : dir === 'ne' || dir === 'sw' ? 'cursor-nesw-resize' : dir === 'n' || dir === 's' ? 'cursor-ns-resize' : 'cursor-ew-resize'}`}
                    style={{ touchAction: 'none' }}
                  />
                ))}
              </div>
            </div>

            <p className="text-center text-[11px] tabular-nums text-muted-foreground">
              Crop {Math.round(box.w)} × {Math.round(box.h)} px from {natW} × {natH}
            </p>

            {/* controls */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] uppercase text-muted-foreground">Shape</Label>
                <div className="flex flex-wrap gap-1">
                  {ASPECTS.map((a, i) => {
                    const disabled = a.value === -1 && !frameAspect
                    return (
                      <Button
                        key={a.label}
                        size="sm"
                        variant={aspectIdx === i ? 'default' : 'outline'}
                        className="h-7 px-2 text-[11px]"
                        disabled={disabled}
                        onClick={() => applyAspect(i)}
                      >
                        {a.value === -1 ? <Frame className="mr-1 h-3 w-3" /> : a.label === 'Free' ? <Square className="mr-1 h-3 w-3" /> : null}
                        {a.label}
                      </Button>
                    )
                  })}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="outline" className="h-7 w-7" title="Rotate left" onClick={() => rotate(-1)}><RotateCcw className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="outline" className="h-7 w-7" title="Rotate right" onClick={() => rotate(1)}><RotateCw className="h-3.5 w-3.5" /></Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-[11px]"
                  onClick={() => setBox(computeBox(natW, natH, activeAspectRef.current))}
                >
                  <Maximize2 className="h-3 w-3" /> Reset
                </Button>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Label className="text-[11px] text-muted-foreground">Quality</Label>
                <Slider value={[quality]} min={60} max={100} step={2} onValueChange={([v]) => setQuality(v)} className="w-28" />
                <span className="w-8 text-right text-[11px] tabular-nums text-muted-foreground">{quality}%</span>
              </div>
            </div>

            {/* apply modes */}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                onClick={() => applyCrop('fill')}
                disabled={!img}
                className="h-auto flex-col items-start gap-0.5 bg-amber-600 py-2 text-left hover:bg-amber-700"
                data-testid="crop-apply-fill"
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold"><CropIcon className="h-4 w-4" /> Crop into the frame</span>
                <span className="text-[11px] font-normal opacity-90">Fill the frame edge-to-edge using the area you selected.</span>
              </Button>
              <Button
                onClick={() => applyCrop('whole')}
                disabled={!img}
                variant="outline"
                className="h-auto flex-col items-start gap-0.5 py-2 text-left"
                data-testid="crop-apply-whole"
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold"><Maximize2 className="h-4 w-4" /> Keep the whole image</span>
                <span className="text-[11px] font-normal text-muted-foreground">The frame resizes to match the picture — nothing is cut off.</span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
