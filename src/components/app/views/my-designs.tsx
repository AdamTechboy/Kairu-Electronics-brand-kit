'use client'

// My Designs: manage every saved project — search, filter, sort, duplicate,
// archive/restore, versions, template toggle.

import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../app-context'
import { projectApi } from '@/lib/api-client'
import type { ProjectSummary } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Search, FolderOpen, MoreVertical, Pencil, Copy, Trash2, History, LayoutTemplate, Archive, RotateCcw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const TYPE_LABELS: Record<string, string> = {
  all: 'All types', logo: 'Logos', letterhead: 'Letterheads', 'business-card': 'Business Cards',
  'complimentary-card': 'Complimentary Cards', flyer: 'Flyers', 'social-post': 'Social Posts', other: 'Other',
}

export function MyDesignsView() {
  const { openEditor } = useApp()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [archived, setArchived] = useState(false)
  const [sort, setSort] = useState<'updated' | 'name' | 'type'>('updated')
  const [confirmDelete, setConfirmDelete] = useState<ProjectSummary | null>(null)
  const [versionsFor, setVersionsFor] = useState<ProjectSummary | null>(null)
  const [versions, setVersions] = useState<{ id: string; label: string; createdAt: string }[]>([])
  const [renaming, setRenaming] = useState<ProjectSummary | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await projectApi.list({
        templates: 'exclude',
        archived,
        q: q || undefined,
        type: type !== 'all' ? type : undefined,
      })
      let list = r.projects
      if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
      if (sort === 'type') list = [...list].sort((a, b) => a.type.localeCompare(b.type))
      setProjects(list)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load designs')
    } finally {
      setLoading(false)
    }
  }, [q, type, archived, sort])

  useEffect(() => {
    const t = setTimeout(() => void load(), 250)
    return () => clearTimeout(t)
  }, [load])

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn()
      toast.success(msg)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    }
  }

  const openVersions = async (p: ProjectSummary) => {
    setVersionsFor(p)
    try {
      const r = await projectApi.versions(p.id)
      setVersions(r.versions)
    } catch {
      setVersions([])
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 lg:p-8" data-testid="my-designs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Designs</h1>
          <p className="text-sm text-muted-foreground">Every design keeps its editable content — reopen, change a price, export again.</p>
        </div>
        <Tabs value={archived ? 'archived' : 'active'} onValueChange={(v) => setArchived(v === 'archived')}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search designs…" className="w-52 pl-8" />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as 'updated' | 'name' | 'type')}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Newest first</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="type">By type</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <FolderOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">{archived ? 'No archived designs' : 'No designs found'}</p>
          <p className="mt-1 text-sm text-muted-foreground">{archived ? 'Deleted designs rest here until permanently removed.' : 'Create your first design from the dashboard or any studio.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {projects.map((p) => (
            <div key={p.id} className="group overflow-hidden rounded-xl border bg-background transition hover:shadow-md">
              <button className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-muted p-2" onClick={() => openEditor({ projectId: p.id, backTo: 'designs' })}>
                {p.preview ? <img src={p.preview} alt={p.name} className="max-h-full max-w-full object-contain" /> : <FolderOpen className="h-6 w-6 text-muted-foreground" />}
              </button>
              <div className="p-3">
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{TYPE_LABELS[p.type] ?? p.type} · {new Date(p.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label="Actions"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditor({ projectId: p.id, backTo: 'designs' })}><Pencil className="mr-2 h-3.5 w-3.5" /> Open &amp; edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setRenaming(p); setRenameValue(p.name) }}><Pencil className="mr-2 h-3.5 w-3.5" /> Rename</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void act(() => projectApi.duplicate(p.id), 'Design duplicated.')}><Copy className="mr-2 h-3.5 w-3.5" /> Duplicate</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void openVersions(p)}><History className="mr-2 h-3.5 w-3.5" /> Version history</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void act(() => projectApi.update(p.id, { isTemplate: !p.isTemplate }), p.isTemplate ? 'Removed from templates.' : 'Saved as a reusable template.')}>
                        <LayoutTemplate className="mr-2 h-3.5 w-3.5" /> {p.isTemplate ? 'Unset template' : 'Save as template'}
                      </DropdownMenuItem>
                      {archived ? (
                        <>
                          <DropdownMenuItem onClick={() => void act(() => projectApi.update(p.id, { archived: false }), 'Design restored.')}><RotateCcw className="mr-2 h-3.5 w-3.5" /> Restore</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(p)}><Trash2 className="mr-2 h-3.5 w-3.5" /> Delete forever</DropdownMenuItem>
                        </>
                      ) : (
                        <DropdownMenuItem className="text-destructive" onClick={() => void act(() => projectApi.remove(p.id), 'Moved to Archived. Restore it any time.')}><Archive className="mr-2 h-3.5 w-3.5" /> Archive</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {p.isTemplate && <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-800">Template</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{confirmDelete?.name}” forever?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the design and its version history. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => confirmDelete && void act(() => projectApi.remove(confirmDelete.id, true), 'Deleted permanently.')}
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* versions */}
      <Dialog open={!!versionsFor} onOpenChange={(v) => !v && setVersionsFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Versions — {versionsFor?.name}</DialogTitle>
            <DialogDescription>Restore any saved version. The current state is snapshotted first, so nothing is lost.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-1.5 overflow-y-auto pr-2">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                <div>
                  <p className="font-medium">{v.label}</p>
                  <p className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => versionsFor && void act(async () => { await projectApi.restore(versionsFor.id, v.id) }, 'Version restored.')}>Restore</Button>
              </div>
            ))}
            {versions.length === 0 && <p className="text-sm text-muted-foreground">No versions recorded yet.</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* rename */}
      <Dialog open={!!renaming} onOpenChange={(v) => !v && setRenaming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Rename design</DialogTitle></DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <Button
            className="w-full"
            onClick={() => renaming && void act(() => projectApi.update(renaming.id, { name: renameValue || renaming.name }), 'Renamed.')}
          >
            Save name
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
