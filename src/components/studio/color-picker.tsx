'use client'

// Colour picker: HEX input, RGB inputs, brand roles, preset swatches.

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pipette } from 'lucide-react'
import { hexToRgb, rgbToHex, contrastRatio } from '@/lib/design/colors'
import type { ColorRole } from '@/lib/design/types'

export interface ColorValue {
  color: string
  role: ColorRole | null
}

const SWATCHES = [
  '#1F2A44', '#F5A623', '#C43D2F', '#101820', '#F7F5F0', '#FFFFFF', '#000000',
  '#2E7D32', '#B3261E', '#B97A0C', '#3A2E14', '#FBF4E4', '#101318', '#6A6A6A',
  '#2F6B3A', '#E89B0C', '#8A8577', '#C9A227',
]

interface Props {
  value: string | null
  role?: ColorRole | null
  palette: Record<ColorRole, string>
  onChange: (v: { color: string | null; role: ColorRole | null }) => void
  allowNone?: boolean
  label?: string
}

export function ColorPicker({ value, role, palette, onChange, allowNone, label }: Props) {
  const [open, setOpen] = useState(false)
  const [hex, setHex] = useState(value ?? '#000000')
  const rgb = hexToRgb(value || '#000000')

  const commitHex = (raw: string) => {
    const clean = raw.trim().startsWith('#') ? raw.trim() : `#${raw.trim()}`
    if (/^#[0-9a-fA-F]{6}$/.test(clean) || /^#[0-9a-fA-F]{3}$/.test(clean)) {
      setHex(clean)
      onChange({ color: clean.toLowerCase(), role: null })
    } else {
      setHex(raw)
    }
  }

  const display = role ? palette[role] : value
  const contrast = display ? contrastRatio(display, '#FFFFFF') : 1

  return (
    <div className="space-y-1.5">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <div className="flex items-center gap-1.5">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={label ?? 'Choose colour'}
              className="h-8 w-10 shrink-0 rounded-md border shadow-sm transition hover:scale-105"
              style={{
                background:
                  display
                    ? `linear-gradient(45deg, ${display} 0 46%, #ddd 46% 54%, ${display} 54% 100%)`
                    : 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 10px 10px',
              }}
            />
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="h-10 w-10 shrink-0 rounded-md border" style={{ background: role ? palette[role] : value ?? 'transparent' }} />
                <div className="flex-1 space-y-1">
                  <Input value={hex} onChange={(e) => commitHex(e.target.value)} placeholder="#RRGGBB" className="h-8 font-mono text-xs" />
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      min={0} max={255}
                      value={rgb.r}
                      onChange={(e) => { const c = rgbToHex(+e.target.value, rgb.g, rgb.b); setHex(c); onChange({ color: c, role: null }) }}
                      className="h-7 text-xs" aria-label="Red"
                    />
                    <Input
                      type="number" min={0} max={255}
                      value={rgb.g}
                      onChange={(e) => { const c = rgbToHex(rgb.r, +e.target.value, rgb.b); setHex(c); onChange({ color: c, role: null }) }}
                      className="h-7 text-xs" aria-label="Green"
                    />
                    <Input
                      type="number" min={0} max={255}
                      value={rgb.b}
                      onChange={(e) => { const c = rgbToHex(rgb.r, rgb.g, +e.target.value); setHex(c); onChange({ color: c, role: null }) }}
                      className="h-7 text-xs" aria-label="Blue"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-9 gap-1">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => { setHex(c); onChange({ color: c, role: null }) }}
                    className="h-5 w-5 rounded border border-black/10 transition hover:scale-110"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Link to brand colour</Label>
                <Select
                  value={role ?? 'none'}
                  onValueChange={(v) => onChange({ color: value, role: v === 'none' ? null : (v as ColorRole) })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Custom colour</SelectItem>
                    <SelectItem value="primary">Brand primary</SelectItem>
                    <SelectItem value="secondary">Brand secondary</SelectItem>
                    <SelectItem value="accent">Brand accent</SelectItem>
                    <SelectItem value="dark">Brand dark</SelectItem>
                    <SelectItem value="light">Brand light</SelectItem>
                  </SelectContent>
                </Select>
                {role && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Linked — updates automatically when you change your brand palette.</p>
                )}
              </div>
              {display && (
                <p className="text-[11px] text-muted-foreground">
                  Contrast vs white: <span className={contrast >= 3 ? 'text-green-700 font-medium' : 'text-amber-700 font-medium'}>{contrast.toFixed(1)}:1</span>
                  {contrast < 3 && ' — may be hard to read'}
                </p>
              )}
              {allowNone && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => { onChange({ color: null, role: null }); setOpen(false) }}>
                  Remove fill
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Input
          value={role ? `${role} (linked)` : value ?? ''}
          readOnly
          className="h-8 flex-1 font-mono text-xs"
          aria-label={label ?? 'Colour value'}
        />
      </div>
    </div>
  )
}

// Native colour input helper (used in brand settings for quick edits)
export function QuickColorInput({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <label className="relative h-9 w-9 shrink-0 cursor-pointer rounded-md border shadow-sm" style={{ background: value }} aria-label={label}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        <Pipette className="pointer-events-none absolute inset-0 m-auto h-4 w-4 text-white mix-blend-difference" />
      </label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 flex-1 font-mono text-xs" aria-label={label} />
    </div>
  )
}
