'use client'

// Export Centre: history of every real file produced by the studio.

import { useEffect, useState } from 'react'
import { useApp } from '../app-context'
import { exportApi } from '@/lib/api-client'
import type { ExportRecord } from '@/lib/api-client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, Loader2, FileDown } from 'lucide-react'

const FORMAT_COLORS: Record<string, string> = {
  pdf: 'bg-red-100 text-red-800',
  png: 'bg-green-100 text-green-800',
  jpg: 'bg-blue-100 text-blue-800',
  svg: 'bg-purple-100 text-purple-800',
  zip: 'bg-amber-100 text-amber-800',
  print: 'bg-muted text-muted-foreground',
}

export function ExportCentreView() {
  const { navigate, openEditor } = useApp()
  const [exports, setExports] = useState<ExportRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    exportApi.list().then((r) => setExports(r.exports)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 lg:p-8" data-testid="exports">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Download className="h-6 w-6 text-amber-600" /> Export Centre</h1>
        <p className="text-sm text-muted-foreground">Every file you have downloaded or printed, newest first. Reopen a design to export a fresh copy.</p>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : exports.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <FileDown className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No exports yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Open any design and press Export — PDF, PNG, JPG and SVG downloads are recorded here.</p>
          <Button className="mt-4 bg-[#1F2A44] hover:bg-[#2a3a5c]" onClick={() => navigate('designs')}>Go to My Designs</Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">File</th>
                <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Design</th>
                <th className="px-4 py-2.5 font-semibold">Format</th>
                <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Details</th>
                <th className="px-4 py-2.5 font-semibold">Date</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {exports.map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="max-w-44 truncate px-4 py-2.5 font-medium">{e.fileName}</td>
                  <td className="hidden max-w-36 truncate px-4 py-2.5 text-muted-foreground sm:table-cell">{e.projectName || '—'}</td>
                  <td className="px-4 py-2.5"><Badge variant="secondary" className={`uppercase ${FORMAT_COLORS[e.format] ?? ''}`}>{e.format}</Badge></td>
                  <td className="hidden px-4 py-2.5 text-xs text-muted-foreground md:table-cell">
                    {[e.paperSize, e.width && e.height ? `${e.width}×${e.height}px` : '', e.scale !== '1' ? e.scale : ''].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-right">
                    {e.projectId && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEditor({ projectId: e.projectId!, backTo: 'exports' })}>
                        Reopen
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
