'use client'

// Layers panel: order, visibility, lock, select.

import type { DesignElement } from '@/lib/design/types'
import { Button } from '@/components/ui/button'
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Lock, Unlock, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  elements: DesignElement[]
  selectedIds: string[]
  onSelect: (ids: string[]) => void
  onPatch: (id: string, patch: Partial<DesignElement>, label?: string) => void
  onReorder: (id: string, dir: 'up' | 'down') => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

function iconFor(e: DesignElement): string {
  switch (e.type) {
    case 'text': return 'T'
    case 'rect': return '▭'
    case 'ellipse': return '◯'
    case 'line': return '─'
    case 'image': return '🖼'
    case 'qr': return '▩'
    case 'symbol': return '✦'
    case 'path': return '✎'
  }
}

export function LayersPanel({ elements, selectedIds, onSelect, onPatch, onReorder, onDuplicate, onDelete }: Props) {
  const ordered = [...elements].reverse() // top-most first
  return (
    <div className="flex h-full flex-col" data-testid="layers-panel">
      <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Layers</div>
      <div className="max-h-full flex-1 overflow-y-auto p-1.5">
        {ordered.length === 0 && <p className="p-3 text-xs text-muted-foreground">No objects yet. Use “Add” to create text, shapes or images.</p>}
        {ordered.map((e) => {
          const selected = selectedIds.includes(e.id)
          return (
            <div
              key={e.id}
              className={cn(
                'group mb-0.5 flex items-center gap-1 rounded-md px-1.5 py-1.5 text-xs transition',
                selected ? 'bg-amber-100 text-foreground' : 'hover:bg-muted'
              )}
            >
              <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={(ev) => onSelect(ev.shiftKey ? (selected ? selectedIds.filter((i) => i !== e.id) : [...selectedIds, e.id]) : [e.id])}>
                <span className="w-4 shrink-0 text-center text-muted-foreground">{iconFor(e)}</span>
                <span className={cn('truncate', e.visible === false && 'text-muted-foreground line-through')}>{e.name || e.type}</span>
              </button>
              <div className="flex shrink-0 opacity-60 transition group-hover:opacity-100">
                <button title={e.visible === false ? 'Show' : 'Hide'} onClick={() => onPatch(e.id, { visible: e.visible === false }, 'Visibility')} className="rounded p-1 hover:bg-background">
                  {e.visible === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button title={e.locked ? 'Unlock' : 'Lock'} onClick={() => onPatch(e.id, { locked: !e.locked }, 'Lock')} className="rounded p-1 hover:bg-background">
                  {e.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                </button>
                <button title="Bring forward" onClick={() => onReorder(e.id, 'up')} className="rounded p-1 hover:bg-background"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button title="Send backward" onClick={() => onReorder(e.id, 'down')} className="rounded p-1 hover:bg-background"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button title="Duplicate" onClick={() => onDuplicate(e.id)} className="rounded p-1 hover:bg-background"><Copy className="h-3.5 w-3.5" /></button>
                <button title="Delete" onClick={() => onDelete(e.id)} className="rounded p-1 hover:bg-background hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
