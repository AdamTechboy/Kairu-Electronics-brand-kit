'use client'

// Interactive canvas stage: renders the design SVG and layers selection,
// drag, resize, rotate and snapping on top. The SVG string itself is produced
// by the shared renderer so what you see is exactly what exports.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DesignDocument, DesignElement } from '@/lib/design/types'
import { pageToSvg } from '@/lib/design/svg'
import type { RenderPalette } from '@/lib/design/svg'

type HandleDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'rot'

interface Props {
  doc: DesignDocument
  pageIndex: number
  palette: RenderPalette
  zoom: number
  selectedIds: string[]
  onSelectIds: (ids: string[]) => void
  onPatchElements: (updater: (els: DesignElement[]) => DesignElement[], commitLabel?: string) => void
  onBeginInteraction: () => void
  snapEnabled: boolean
  editingEnabled?: boolean
  /** Double-clicking an image/logo placeholder asks the host to open the file picker. */
  onRequestImageReplace?: (el: DesignElement) => void
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
  rotation: number
}

function elemRect(e: DesignElement): Rect {
  const rotation = e.rotation ?? 0
  const cx = e.x + e.w / 2
  const cy = e.y + e.h / 2
  if (!rotation) return { x: e.x, y: e.y, w: e.w, h: e.h, rotation: 0 }
  const rad = (rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const w = e.w * cos + e.h * sin
  const h = e.w * sin + e.h * cos
  return { x: cx - w / 2, y: cy - h / 2, w, h, rotation }
}

export function CanvasStage({
  doc,
  pageIndex,
  palette,
  zoom,
  selectedIds,
  onSelectIds,
  onPatchElements,
  onBeginInteraction,
  snapEnabled,
  editingEnabled = true,
  onRequestImageReplace,
}: Props) {
  const page = doc.pages[pageIndex]
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const svgHostRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{
    mode: 'move' | 'resize' | 'rotate' | null
    handle?: HandleDir
    startPointer: { x: number; y: number }
    originals: Map<string, DesignElement>
    primaryId?: string
    snapTargetsX: number[]
    snapTargetsY: number[]
  }>({ mode: null, startPointer: { x: 0, y: 0 }, originals: new Map(), snapTargetsX: [], snapTargetsY: [] })
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] })
  const [textEdit, setTextEdit] = useState<{ id: string; value: string } | null>(null)
  const textEditRef = useRef<{ id: string; value: string } | null>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  const setTextEditSafe = useCallback((next: { id: string; value: string } | null) => {
    textEditRef.current = next
    setTextEdit(next)
  }, [])

  const commitTextEdit = useCallback(
    (cancel = false) => {
      const cur = textEditRef.current
      if (!cur) return
      textEditRef.current = null
      if (!cancel) {
        onPatchElements((els) => els.map((e0) => (e0.id === cur.id ? { ...e0, text: cur.value } : e0)))
      }
      setTextEdit(null)
    },
    [onPatchElements]
  )

  const beginTextEdit = useCallback(
    (el: DesignElement) => {
      onBeginInteraction()
      onSelectIds([el.id])
      setTextEditSafe({ id: el.id, value: el.text ?? '' })
      // focus after mount
      requestAnimationFrame(() => {
        const node = textAreaRef.current
        if (node) {
          node.focus()
          node.select()
        }
      })
    },
    [onBeginInteraction, onSelectIds, setTextEditSafe]
  )

  const svgString = useMemo(
    () => pageToSvg(doc, page, { palette, includeBackground: true, idPrefix: `stage${pageIndex}` }),
    [doc, page, palette, pageIndex]
  )

  const toDesign = useCallback(
    (clientX: number, clientY: number) => {
      const rect = pageRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom }
    },
    [zoom]
  )

  // keep selected elements scrolled into view when selection changes externally — skip.
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const hitTest = (clientX: number, clientY: number): string | null => {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null
    const g = el?.closest?.('[data-id]') as HTMLElement | null
    return g?.dataset?.id ?? null
  }

  const beginDrag = (clientX: number, clientY: number, mode: 'move' | 'resize' | 'rotate', handle?: HandleDir, dragIds?: string[]) => {
    const idsToDrag = dragIds ?? selectedIds
    const targets = page.elements.filter((e) => idsToDrag.includes(e.id) && !e.locked)
    if (mode === 'move' && targets.length === 0) return
    onBeginInteraction()
    const draggedSet = new Set(targets.map((t) => t.id))
    const others = page.elements.filter((e) => !draggedSet.has(e.id) && e.visible !== false)
    const snapTargetsX: number[] = [0, doc.width / 2, doc.width]
    const snapTargetsY: number[] = [0, doc.height / 2, doc.height]
    for (const o of others) {
      const r = elemRect(o)
      snapTargetsX.push(r.x, r.x + r.w / 2, r.x + r.w)
      snapTargetsY.push(r.y, r.y + r.h / 2, r.y + r.h)
    }
    dragState.current = {
      mode,
      handle,
      startPointer: toDesign(clientX, clientY),
      originals: new Map(targets.map((e) => [e.id, { ...e }])),
      primaryId: idsToDrag[idsToDrag.length - 1],
      snapTargetsX,
      snapTargetsY,
    }
  }

  const onPointerDownStage = (ev: React.PointerEvent) => {
    if (!editingEnabled) return
    if (textEdit) {
      commitTextEdit()
      return
    }
    const target = ev.target as HTMLElement
    const handleEl = target.closest?.('[data-handle]') as HTMLElement | null
    if (handleEl) {
      ev.stopPropagation()
      const dir = handleEl.dataset.handle as HandleDir
      beginDrag(ev.clientX, ev.clientY, dir === 'rot' ? 'rotate' : 'resize', dir)
      return
    }
    const id = hitTest(ev.clientX, ev.clientY)
    const elObj = id ? page.elements.find((e) => e.id === id) : null
    if (elObj) {
      let dragIds: string[]
      if (ev.shiftKey) {
        const next = selectedSet.has(elObj.id) ? selectedIds.filter((i) => i !== elObj.id) : [...selectedIds, elObj.id]
        onSelectIds(next)
        dragIds = next
      } else if (selectedSet.has(elObj.id)) {
        dragIds = selectedIds
      } else {
        onSelectIds([elObj.id])
        dragIds = [elObj.id]
      }
      if (!elObj.locked) beginDrag(ev.clientX, ev.clientY, 'move', undefined, dragIds)
    } else {
      onSelectIds([])
    }
  }

  const onDoubleClickStage = (ev: React.MouseEvent) => {
    if (!editingEnabled) return
    const id = hitTest(ev.clientX, ev.clientY)
    if (!id) return
    const elObj = page.elements.find((e) => e.id === id)
    if (!elObj || elObj.locked) return
    if (elObj.type === 'text') {
      beginTextEdit(elObj)
    } else if (elObj.type === 'image' && onRequestImageReplace) {
      onSelectIds([elObj.id])
      onRequestImageReplace(elObj)
    }
  }

  const snapValue = (value: number, targets: number[], threshold: number): { value: number; guide: number | null } => {
    if (!snapEnabled) return { value, guide: null }
    let best: number | null = null
    let bestDist = threshold
    for (const t of targets) {
      const d = Math.abs(value - t)
      if (d < bestDist) {
        bestDist = d
        best = t
      }
    }
    return { value: best ?? value, guide: best }
  }

  const onPointerMove = (ev: React.PointerEvent) => {
    const st = dragState.current
    if (!st.mode) return
    const cur = toDesign(ev.clientX, ev.clientY)
    const dx = cur.x - st.startPointer.x
    const dy = cur.y - st.startPointer.y
    const threshold = 6 / zoom

    if (st.mode === 'move') {
      let sdx = dx
      let sdy = dy
      const gx: number[] = []
      const gy: number[] = []
      const primary = st.originals.get(st.primaryId ?? '')
      if (primary) {
        const sx = snapValue(primary.x + dx, st.snapTargetsX, threshold)
        const sy = snapValue(primary.y + dy, st.snapTargetsY, threshold)
        if (sx.guide !== null) {
          sdx = sx.value - primary.x
          gx.push(sx.guide)
        }
        if (sy.guide !== null) {
          sdy = sy.value - primary.y
          gy.push(sy.guide)
        }
      }
      setGuides({ x: gx, y: gy })
      onPatchElements((els) =>
        els.map((e) => {
          const orig = st.originals.get(e.id)
          return orig ? { ...e, x: Math.round(orig.x + sdx), y: Math.round(orig.y + sdy) } : e
        })
      )
    } else if (st.mode === 'resize' && st.handle && st.primaryId) {
      const orig = st.originals.get(st.primaryId)
      if (!orig) return
      const h = st.handle
      let { x, y, w, h: hh } = { x: orig.x, y: orig.y, w: orig.w, h: orig.h }
      if (h.includes('e')) w = orig.w + dx
      if (h.includes('s')) hh = orig.h + dy
      if (h.includes('w')) {
        w = orig.w - dx
        x = orig.x + dx
      }
      if (h.includes('n')) {
        hh = orig.h - dy
        y = orig.y + dy
      }
      if (ev.shiftKey && orig.w > 0 && orig.h > 0) {
        const ratio = orig.w / orig.h
        if (h === 'ne' || h === 'nw' || h === 'se' || h === 'sw') hh = w / ratio
        if (h.includes('n')) y = orig.y + (orig.h - hh)
      }
      w = Math.max(8, Math.round(w))
      hh = Math.max(8, Math.round(hh))
      x = Math.round(x)
      y = Math.round(y)
      onPatchElements((els) =>
        els.map((e) => (e.id === st.primaryId ? { ...e, x, y, w, h: hh } : e))
      )
    } else if (st.mode === 'rotate' && st.primaryId) {
      const orig = st.originals.get(st.primaryId)
      if (!orig) return
      const cx = orig.x + orig.w / 2
      const cy = orig.y + orig.h / 2
      let angle = (Math.atan2(cur.y - cy, cur.x - cx) * 180) / Math.PI + 90
      if (ev.shiftKey) angle = Math.round(angle / 15) * 15
      angle = Math.round(angle)
      onPatchElements((els) => els.map((e) => (e.id === st.primaryId ? { ...e, rotation: ((angle % 360) + 360) % 360 } : e)))
    }
  }

  const endDrag = () => {
    dragState.current.mode = null
    setGuides({ x: [], y: [] })
  }

  // ---- selection box + handles ----
  const selectedEls = page.elements.filter((e) => selectedSet.has(e.id))
  let selBox: Rect | null = null
  if (selectedEls.length === 1) {
    selBox = elemRect(selectedEls[0])
  } else if (selectedEls.length > 1) {
    const boxes = selectedEls.map(elemRect)
    const minX = Math.min(...boxes.map((b) => b.x))
    const minY = Math.min(...boxes.map((b) => b.y))
    const maxX = Math.max(...boxes.map((b) => b.x + b.w))
    const maxY = Math.max(...boxes.map((b) => b.y + b.h))
    selBox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY, rotation: 0 }
  }

  const handles: { dir: HandleDir; style: React.CSSProperties; cursor: string }[] = selBox && selectedEls.length === 1
    ? [
        { dir: 'nw', style: { left: 0, top: 0 }, cursor: 'nwse-resize' },
        { dir: 'n', style: { left: '50%', top: 0 }, cursor: 'ns-resize' },
        { dir: 'ne', style: { left: '100%', top: 0 }, cursor: 'nesw-resize' },
        { dir: 'e', style: { left: '100%', top: '50%' }, cursor: 'ew-resize' },
        { dir: 'se', style: { left: '100%', top: '100%' }, cursor: 'nwse-resize' },
        { dir: 's', style: { left: '50%', top: '100%' }, cursor: 'ns-resize' },
        { dir: 'sw', style: { left: 0, top: '100%' }, cursor: 'nesw-resize' },
        { dir: 'w', style: { left: 0, top: '50%' }, cursor: 'ew-resize' },
      ]
    : []

  // wheel zoom with ctrl/meta
  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault()
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div ref={scrollRef} className="relative h-full w-full overflow-auto bg-[#E9E6DE]" data-testid="canvas-scroll">
      <div className="flex min-h-full min-w-full items-center justify-center p-8">
        <div
          ref={pageRef}
          className="relative shrink-0 grow-0 shadow-[0_8px_40px_rgba(0,0,0,0.18)]"
          style={{ width: doc.width * zoom, height: doc.height * zoom }}
          onPointerDown={onPointerDownStage}
          onDoubleClick={onDoubleClickStage}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          data-testid="design-page"
        >
          <div
            ref={svgHostRef}
            className="absolute inset-0 [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
            style={{ pointerEvents: editingEnabled ? 'auto' : 'none' }}
            dangerouslySetInnerHTML={{ __html: svgString }}
          />
          {editingEnabled && textEdit && (() => {
            const el0 = page.elements.find((e0) => e0.id === textEdit.id)
            if (!el0) return null
            const fs = (el0.fontSize ?? 16) * zoom
            const lh = (el0.lineHeight ?? 1.25) * fs
            const anchor = el0.align === 'center' ? 'center' : el0.align === 'right' ? 'right' : 'left'
            return (
              <textarea
                ref={textAreaRef}
                value={textEdit.value}
                onChange={(e0) => setTextEditSafe({ id: textEdit.id, value: e0.target.value })}
                onPointerDown={(e0) => e0.stopPropagation()}
                onDoubleClick={(e0) => e0.stopPropagation()}
                onBlur={() => commitTextEdit()}
                onKeyDown={(e0) => {
                  if (e0.key === 'Escape') {
                    e0.preventDefault()
                    commitTextEdit(true)
                  } else if (e0.key === 'Enter' && (e0.metaKey || e0.ctrlKey)) {
                    e0.preventDefault()
                    commitTextEdit()
                  }
                  e0.stopPropagation()
                }}
                spellCheck={false}
                className="absolute z-10 resize-none overflow-hidden border-2 border-[#F5A623] bg-white/95 p-0 text-[#111] shadow-lg outline-none"
                style={{
                  left: el0.x * zoom,
                  top: el0.y * zoom,
                  width: el0.w * zoom,
                  height: Math.max(el0.h * zoom, lh * 1.2),
                  fontFamily: el0.fontFamily ?? 'Arial',
                  fontSize: fs,
                  fontWeight: el0.fontWeight ?? 400,
                  fontStyle: el0.italic ? 'italic' : 'normal',
                  lineHeight: `${lh}px`,
                  letterSpacing: (el0.letterSpacing ?? 0) * zoom,
                  textAlign: anchor,
                  textTransform: el0.uppercase ? 'uppercase' : 'none',
                  textDecoration: el0.underline ? 'underline' : 'none',
                  color: el0.fill ?? '#000000',
                  transform: el0.rotation ? `rotate(${el0.rotation}deg)` : undefined,
                }}
                aria-label="Edit text"
              />
            )
          })()}
          {editingEnabled && selBox && (
            <div
              className="pointer-events-none absolute border-2 border-[#F5A623]"
              style={{ left: selBox.x * zoom, top: selBox.y * zoom, width: selBox.w * zoom, height: selBox.h * zoom }}
              data-testid="selection-box"
            >
              {handles.map((h) => (
                <div
                  key={h.dir}
                  data-handle={h.dir}
                  className="pointer-events-auto absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#F5A623] bg-white shadow"
                  style={{ ...h.style, cursor: h.cursor, left: `calc(${h.style.left} )`, touchAction: 'none' }}
                />
              ))}
              <div
                data-handle="rot"
                className="pointer-events-auto absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 -translate-y-8 rounded-full border-2 border-[#F5A623] bg-white shadow"
                style={{ cursor: 'grab', touchAction: 'none' }}
                title="Rotate"
              />
              <div className="absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 -translate-y-full bg-[#F5A623]" />
            </div>
          )}
          {editingEnabled && selBox && selectedEls.length > 1 && (
            <div className="pointer-events-none absolute border border-dashed border-[#F5A623]/70" style={{ left: selBox.x * zoom, top: selBox.y * zoom, width: selBox.w * zoom, height: selBox.h * zoom }} />
          )}
          {guides.x.map((g, i) => (
            <div key={`gx${i}`} className="pointer-events-none absolute top-0 h-full w-px bg-pink-500" style={{ left: g * zoom }} />
          ))}
          {guides.y.map((g, i) => (
            <div key={`gy${i}`} className="pointer-events-none absolute left-0 h-px w-full bg-pink-500" style={{ top: g * zoom }} />
          ))}
        </div>
      </div>
    </div>
  )
}
