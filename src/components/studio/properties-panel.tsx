'use client'

// Properties panel: edit the selected element's geometry, typography, colours,
// shadow and page alignment. Everything here maps 1:1 to the design document.

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ColorPicker } from './color-picker'
import { FONT_OPTIONS, type ColorRole, type DesignElement } from '@/lib/design/types'
import { SYMBOL_LIST } from '@/lib/design/symbols'
import {
  Trash2, Copy, Lock, Unlock, ArrowUp, ArrowDown, AlignLeft, AlignCenter, AlignRight,
  AlignVerticalSpaceAround, Replace, Underline, Link2, Link2Off, Contrast,
  Crop, Frame, FlipHorizontal, FlipVertical, Sun, Contrast as ContrastIcon, Palette,
} from 'lucide-react'

interface Props {
  element: DesignElement | null
  palette: Record<ColorRole, string>
  docSize: { width: number; height: number }
  onPatch: (patch: Partial<DesignElement>, label?: string) => void
  onDuplicate: () => void
  onDelete: () => void
  onLayerChange: (dir: 'up' | 'down') => void
  onAlignPage: (to: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => void
  onRequestImageReplace: () => void
  onCropImage?: () => void
  onFitFrameToImage?: () => void
}

const num = (v: number | undefined, fallback = 0) => (v === undefined ? fallback : Math.round(v * 10) / 10)

export function PropertiesPanel({ element, palette, docSize, onPatch, onDuplicate, onDelete, onLayerChange, onAlignPage, onRequestImageReplace, onCropImage, onFitFrameToImage }: Props) {
  const [aspectLock, setAspectLock] = useState(false)
  if (!element) {
    return (
      <div className="p-4 text-sm text-muted-foreground" data-testid="properties-empty">
        Select an object on the canvas to edit its properties.
        <div className="mt-4 space-y-2 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed">
          <p className="font-medium text-foreground">Quick tips</p>
          <p>• <span className="font-semibold">Double-click any text to edit it right on the canvas.</span></p>
          <p>• Double-click an image or the logo box to replace the picture — you can crop it first.</p>
          <p>• “Fit frame” resizes the picture frame so nothing is cut off.</p>
          <p>• Drag objects to move them. Guides appear automatically.</p>
          <p>• Use the round handle above a selection to rotate.</p>
          <p>• Hold Shift while resizing to keep proportions.</p>
          <p>• Arrow keys nudge; Shift + arrows move faster.</p>
        </div>
      </div>
    )
  }

  const isText = element.type === 'text'
  const hasStroke = ['rect', 'ellipse', 'path', 'image', 'line', 'text'].includes(element.type)
  const canShadow = ['text', 'rect', 'ellipse', 'path', 'symbol', 'image'].includes(element.type)
  const shadowOn = !!element.shadow && element.shadow.blur > 0

  const setSize = (k: 'w' | 'h', value: number) => {
    const v = Math.max(2, Math.round(value))
    if (aspectLock && element.w > 0 && element.h > 0) {
      const ratio = element.w / element.h
      if (k === 'w') onPatch({ w: v, h: Math.max(2, Math.round(v / ratio)) }, 'Resize')
      else onPatch({ h: v, w: Math.max(2, Math.round(v * ratio)) }, 'Resize')
    } else {
      onPatch({ [k]: v } as Partial<DesignElement>, 'Resize')
    }
  }

  return (
    <div className="space-y-4 p-4" data-testid="properties-panel">
      <div className="flex items-center justify-between gap-2">
        <Input
          value={element.name ?? ''}
          onChange={(e) => onPatch({ name: e.target.value }, 'Rename')}
          placeholder="Object name"
          className="h-8 text-xs"
          aria-label="Object name"
        />
        <div className="flex shrink-0 gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Bring forward" onClick={() => onLayerChange('up')}><ArrowUp className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Send backward" onClick={() => onLayerChange('down')}><ArrowDown className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Duplicate" onClick={onDuplicate}><Copy className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Delete" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* geometry */}
      <div className="grid grid-cols-2 gap-2">
        {(['x', 'y'] as const).map((k) => (
          <div key={k} className="space-y-1">
            <Label className="text-[11px] uppercase text-muted-foreground">{k === 'x' ? 'X position' : 'Y position'}</Label>
            <Input
              type="number"
              value={num(element[k])}
              onChange={(e) => onPatch({ [k]: Math.round(+e.target.value) } as Partial<DesignElement>, 'Move')}
              className="h-8 text-xs"
            />
          </div>
        ))}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] uppercase text-muted-foreground">Width</Label>
            <button
              onClick={() => setAspectLock((v) => !v)}
              title={aspectLock ? 'Aspect ratio locked' : 'Lock aspect ratio'}
              className="text-muted-foreground transition hover:text-foreground"
            >
              {aspectLock ? <Link2 className="h-3.5 w-3.5 text-amber-600" /> : <Link2Off className="h-3.5 w-3.5" />}
            </button>
          </div>
          <Input type="number" value={num(element.w)} onChange={(e) => setSize('w', +e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] uppercase text-muted-foreground">Height</Label>
            {aspectLock && <span className="text-[10px] text-amber-600">linked</span>}
          </div>
          <Input type="number" value={num(element.h)} onChange={(e) => setSize('h', +e.target.value)} className="h-8 text-xs" />
        </div>
      </div>

      {/* page alignment */}
      <div className="space-y-1">
        <Label className="text-[11px] uppercase text-muted-foreground">Align on page</Label>
        <div className="grid grid-cols-6 gap-1">
          {([
            ['left', 'Left edge', AlignLeft],
            ['hcenter', 'Horizontal centre', AlignCenter],
            ['right', 'Right edge', AlignRight],
            ['top', 'Top edge', AlignVerticalSpaceAround],
            ['vcenter', 'Vertical centre', AlignVerticalSpaceAround],
            ['bottom', 'Bottom edge', AlignVerticalSpaceAround],
          ] as const).map(([to, title, Icon]) => (
            <Button key={to} size="icon" variant="outline" className="h-8 w-8" title={title} onClick={() => onAlignPage(to)}>
              <Icon className="h-3.5 w-3.5" />
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] uppercase text-muted-foreground">Rotation °</Label>
          <Input type="number" value={num(element.rotation)} onChange={(e) => onPatch({ rotation: +e.target.value }, 'Rotate')} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] uppercase text-muted-foreground">Opacity — {Math.round(num(element.opacity, 1) * 100)}%</Label>
          <Slider
            value={[num(element.opacity, 1) * 100]}
            min={5} max={100} step={5}
            onValueChange={([v]) => onPatch({ opacity: v / 100 }, 'Opacity')}
            className="mt-2"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs">Visible</Label>
        <Switch checked={element.visible !== false} onCheckedChange={(v) => onPatch({ visible: v }, 'Visibility')} />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs flex items-center gap-1">{element.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />} Locked</Label>
        <Switch checked={element.locked === true} onCheckedChange={(v) => onPatch({ locked: v }, 'Lock')} />
      </div>

      <div className="h-px bg-border" />

      {/* type specific */}
      {isText && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-[11px] uppercase text-muted-foreground">Text</Label>
            <Textarea value={element.text ?? ''} onChange={(e) => onPatch({ text: e.target.value }, 'Edit text')} rows={3} className="text-xs" />
            <p className="text-[11px] text-muted-foreground">Tip: you can also double-click the text on the canvas to type in place.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] uppercase text-muted-foreground">Font</Label>
              <Select value={element.fontFamily ?? 'Arial'} onValueChange={(v) => onPatch({ fontFamily: v }, 'Font')}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{FONT_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase text-muted-foreground">Weight</Label>
              <Select value={String(element.fontWeight ?? 400)} onValueChange={(v) => onPatch({ fontWeight: +v }, 'Weight')}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="300">Light</SelectItem>
                  <SelectItem value="400">Regular</SelectItem>
                  <SelectItem value="600">Semibold</SelectItem>
                  <SelectItem value="700">Bold</SelectItem>
                  <SelectItem value="900">Black</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] uppercase text-muted-foreground">Size</Label>
              <Input type="number" value={num(element.fontSize, 16)} onChange={(e) => onPatch({ fontSize: Math.max(4, +e.target.value) }, 'Font size')} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase text-muted-foreground">Letter spacing</Label>
              <Input type="number" value={num(element.letterSpacing)} onChange={(e) => onPatch({ letterSpacing: +e.target.value }, 'Spacing')} className="h-8 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] uppercase text-muted-foreground">Line height</Label>
              <Input
                type="number"
                step="0.05"
                min="0.8"
                value={num(element.lineHeight, 1.25)}
                onChange={(e) => onPatch({ lineHeight: Math.max(0.8, +e.target.value || 1.25) }, 'Line height')}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase text-muted-foreground">Vertical align</Label>
              <Select value={element.vAlign ?? 'top'} onValueChange={(v) => onPatch({ vAlign: v as 'top' | 'middle' | 'bottom' }, 'Vertical align')}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="middle">Middle</SelectItem>
                  <SelectItem value="bottom">Bottom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-1">
            {(['left', 'center', 'right'] as const).map((a) => (
              <Button key={a} size="sm" variant={element.align === a ? 'default' : 'outline'} className="h-8 flex-1" onClick={() => onPatch({ align: a }, 'Align')}>
                {a === 'left' ? <AlignLeft className="h-3.5 w-3.5" /> : a === 'center' ? <AlignCenter className="h-3.5 w-3.5" /> : <AlignRight className="h-3.5 w-3.5" />}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
              <Label className="text-xs">Caps</Label>
              <Switch checked={element.uppercase === true} onCheckedChange={(v) => onPatch({ uppercase: v }, 'Uppercase')} />
            </div>
            <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
              <Label className="text-xs">Italic</Label>
              <Switch checked={element.italic === true} onCheckedChange={(v) => onPatch({ italic: v }, 'Italic')} />
            </div>
            <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
              <Label className="flex items-center gap-1 text-xs"><Underline className="h-3 w-3" /> Line</Label>
              <Switch checked={element.underline === true} onCheckedChange={(v) => onPatch({ underline: v }, 'Underline')} />
            </div>
          </div>
        </div>
      )}

      {element.type === 'rect' && (
        <div className="space-y-1">
          <Label className="text-[11px] uppercase text-muted-foreground">Corner radius</Label>
          <Input type="number" value={num(element.radius)} onChange={(e) => onPatch({ radius: Math.max(0, +e.target.value) }, 'Radius')} className="h-8 text-xs" />
        </div>
      )}

      {element.type === 'image' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-[11px] uppercase text-muted-foreground">Image fit in frame</Label>
            <Select value={element.fit ?? 'contain'} onValueChange={(v) => onPatch({ fit: v as 'cover' | 'contain' | 'fill' }, 'Fit')}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cover">Fill frame (crop overflow)</SelectItem>
                <SelectItem value="contain">Fit inside (letterbox)</SelectItem>
                <SelectItem value="fill">Stretch to frame</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onCropImage} disabled={!element.src} title="Crop this picture">
              <Crop className="h-3.5 w-3.5" /> Crop
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onFitFrameToImage} disabled={!element.src} title="Resize the frame to show the whole picture">
              <Frame className="h-3.5 w-3.5" /> Fit frame
            </Button>
            <Button
              variant={element.flipX ? 'default' : 'outline'}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => onPatch({ flipX: !element.flipX }, 'Flip')}
              title="Mirror horizontally"
            >
              <FlipHorizontal className="h-3.5 w-3.5" /> Flip H
            </Button>
            <Button
              variant={element.flipY ? 'default' : 'outline'}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => onPatch({ flipY: !element.flipY }, 'Flip')}
              title="Mirror vertically"
            >
              <FlipVertical className="h-3.5 w-3.5" /> Flip V
            </Button>
          </div>

          {/* photo adjustments */}
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs"><Sun className="h-3.5 w-3.5" /> Photo adjustments</Label>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                disabled={!element.adjust}
                onClick={() => onPatch({ adjust: null }, 'Reset photo')}
              >
                Reset
              </Button>
            </div>
            {([
              ['brightness', 'Brightness', Sun, 0.3, 1.8],
              ['contrast', 'Contrast', ContrastIcon, 0.3, 1.8],
              ['saturation', 'Saturation', Palette, 0, 2],
            ] as const).map(([key, label, Icon, min, max]) => {
              const val = element.adjust?.[key] ?? 1
              const setAdjust = (v: number) =>
                onPatch(
                  {
                    adjust: {
                      brightness: element.adjust?.brightness ?? 1,
                      contrast: element.adjust?.contrast ?? 1,
                      saturation: element.adjust?.saturation ?? 1,
                      [key]: v,
                    } as NonNullable<DesignElement['adjust']>,
                  },
                  label
                )
              return (
                <div key={key} className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <Slider value={[val]} min={min} max={max} step={0.05} onValueChange={([v]) => setAdjust(v)} className="flex-1" />
                  <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">{Math.round(val * 100)}%</span>
                </div>
              )
            })}
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] uppercase text-muted-foreground">Corner radius</Label>
            <Input type="number" value={num(element.radius)} onChange={(e) => onPatch({ radius: Math.max(0, +e.target.value) }, 'Radius')} className="h-8 text-xs" />
          </div>
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={onRequestImageReplace}>
            <Replace className="h-3.5 w-3.5" /> Replace this image
          </Button>
        </div>
      )}

      {element.type === 'symbol' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-[11px] uppercase text-muted-foreground">Symbol</Label>
            <Select value={element.symbol ?? 'tv'} onValueChange={(v) => onPatch({ symbol: v }, 'Symbol')}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SYMBOL_LIST.map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase text-muted-foreground">Line weight</Label>
            <Select value={element.symbolWeight ?? 'regular'} onValueChange={(v) => onPatch({ symbolWeight: v as 'thin' | 'regular' | 'bold' }, 'Weight')}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="thin">Thin</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="bold">Bold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {element.type === 'qr' && (
        <div className="space-y-1">
          <Label className="text-[11px] uppercase text-muted-foreground">QR code content (URL, phone, text…)</Label>
          <Textarea
            value={element.qrData ?? ''}
            onChange={(e) => onPatch({ qrData: e.target.value }, 'QR content')}
            rows={3}
            className="text-xs"
            placeholder="e.g. tel:07038365737 or https://…"
          />
          <p className="text-[11px] text-muted-foreground">The QR image regenerates automatically from this content.</p>
        </div>
      )}

      {/* paint */}
      {element.type !== 'image' && element.type !== 'qr' && (
        <ColorPicker
          label={element.type === 'line' ? 'Colour' : 'Fill colour'}
          value={element.fill ?? null}
          role={element.colorRole ?? null}
          palette={palette}
          allowNone={element.type === 'rect' || element.type === 'ellipse' || element.type === 'path'}
          onChange={(v) => onPatch({ fill: v.color, colorRole: v.role }, 'Colour')}
        />
      )}
      {hasStroke && (
        <div className="space-y-2">
          <ColorPicker
            label={isText ? 'Text outline colour' : 'Border colour'}
            value={element.stroke ?? null}
            role={element.strokeRole ?? null}
            palette={palette}
            onChange={(v) => onPatch({ stroke: v.color, strokeRole: v.role }, isText ? 'Text outline' : 'Border')}
          />
          <div className="space-y-1">
            <Label className="text-[11px] uppercase text-muted-foreground">{isText ? 'Outline width' : 'Border width'}</Label>
            <Input type="number" min={0} step="0.5" value={num(element.strokeWidth)} onChange={(e) => onPatch({ strokeWidth: Math.max(0, +e.target.value) }, 'Outline width')} className="h-8 text-xs" />
          </div>
        </div>
      )}

      {/* shadow */}
      {canShadow && (
        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-xs"><Contrast className="h-3.5 w-3.5" /> Drop shadow</Label>
            <Switch
              checked={shadowOn}
              onCheckedChange={(v) =>
                onPatch(
                  {
                    shadow: v
                      ? { color: '#000000', blur: 12, offsetX: 0, offsetY: 4 }
                      : null,
                  },
                  'Shadow'
                )
              }
            />
          </div>
          {shadowOn && element.shadow && (
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['blur', 'Blur', 40],
                  ['offsetX', 'X', 40],
                  ['offsetY', 'Y', 40],
                ] as const).map(([k, label, max]) => (
                  <div key={k} className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>
                    <Input
                      type="number"
                      value={num(element.shadow![k])}
                      onChange={(e) =>
                        onPatch({ shadow: { ...element.shadow!, [k]: Math.max(-60, Math.min(max, +e.target.value)) } }, 'Shadow')
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                ))}
              </div>
              <ColorPicker
                label="Shadow colour"
                value={element.shadow.color}
                palette={palette}
                onChange={(v) => v.color && onPatch({ shadow: { ...element.shadow!, color: v.color } }, 'Shadow colour')}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
