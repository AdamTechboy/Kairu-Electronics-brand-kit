'use client'

import { useEffect, useState } from 'react'
import { useApp } from '../app-context'
import { projectApi, exportApi } from '@/lib/api-client'
import type { ProjectSummary, ExportRecord } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles, FileImage, FileText, IdCard, MessageSquareQuote, Share2, CheckCircle2, AlertCircle,
  ArrowRight, Clock, CheckCheck, UserRound,
} from 'lucide-react'

const QUICK = [
  { label: 'Logo Studio', desc: 'Edit your emblem', icon: Sparkles, view: 'logo-studio' as const },
  { label: 'Generate Flyer', desc: 'Products + prices', icon: FileImage, view: 'flyer' as const },
  { label: 'Letterhead', desc: 'Official documents', icon: FileText, view: 'designer' as const, param: 'letterhead' },
  { label: 'Business Card', desc: 'Front & back', icon: IdCard, view: 'designer' as const, param: 'business-card' },
  { label: 'Complimentary Card', desc: 'Thank-you notes', icon: MessageSquareQuote, view: 'designer' as const, param: 'complimentary-card' },
  { label: 'Social Post', desc: 'WhatsApp & Instagram', icon: Share2, view: 'designer' as const, param: 'social-post' },
]

export function DashboardView() {
  const { brand, user, navigate, openEditor } = useApp()
  const [recent, setRecent] = useState<ProjectSummary[]>([])
  const [exports, setExports] = useState<ExportRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [projectCount, setProjectCount] = useState(0)
  const [exportCount, setExportCount] = useState(0)

  useEffect(() => {
    ;(async () => {
      try {
        const [p, e] = await Promise.all([projectApi.list({ templates: 'exclude', archived: false }), exportApi.list()])
        setProjectCount(p.projects.length)
        setExportCount(e.exports.length)
        setRecent(p.projects.slice(0, 6))
        setExports(e.exports.slice(0, 5))
      } catch {
        // non-fatal
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const contactReady = brand.phones.length > 0 && !!brand.address
  const brandScore = [!!brand.logoProjectId, contactReady, !!brand.description, Object.keys(brand.palette).length === 5].filter(Boolean).length

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8" data-testid="dashboard">
      {/* welcome */}
      <section className="relative isolate overflow-hidden rounded-3xl bg-[#1F2A44] p-6 text-white shadow-lg shadow-slate-900/10 sm:p-8 lg:p-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full border-[36px] border-white/[0.06]" />
        <div aria-hidden="true" className="pointer-events-none absolute right-16 top-24 -z-10 h-28 w-28 rounded-full bg-[#F5A623]/15 blur-2xl" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1 text-[11px] font-medium tracking-wide text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F5A623]" /> YOUR CREATIVE WORKSPACE
            </div>
            <p className="mt-5 text-sm text-[#F5A623]">Welcome back, {(user.name ?? 'Owner').split(' ')[0]}</p>
            <h1 className="mt-1 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">{brand.businessName}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">{brand.tagline || brand.businessCategory || 'Create consistent, professional designs for your business.'}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button className="gap-2 bg-[#F5A623] font-semibold text-[#1F2A44] hover:bg-[#ffc04d]" onClick={() => navigate('flyer')}><FileImage className="h-4 w-4" /> Create a product flyer <ArrowRight className="h-4 w-4" /></Button>
              <Button variant="outline" className="border-white/25 bg-white/[0.06] text-white hover:bg-white/10 hover:text-white" onClick={() => navigate('brand-settings')}>Manage brand identity</Button>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-white/60">Brand readiness</p>
                <p className="mt-1 text-2xl font-bold">{Math.round((brandScore / 4) * 100)}<span className="text-sm font-medium text-white/60">%</span></p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5A623] text-[#1F2A44]"><Sparkles className="h-6 w-6" /></div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#F5A623] transition-all" style={{ width: `${(brandScore / 4) * 100}%` }} />
            </div>
            <p className="mt-3 text-xs leading-5 text-white/60">{brandScore === 4 ? 'Your core brand details are ready to reuse across new designs.' : `${4 - brandScore} setup item${4 - brandScore === 1 ? '' : 's'} left before your brand kit is complete.`}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
              <div><p className="text-xl font-semibold">{projectCount}</p><p className="text-[11px] text-white/55">Saved designs</p></div>
              <div><p className="text-xl font-semibold">{exportCount}</p><p className="text-[11px] text-white/55">Recorded exports</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* quick create */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Create something new</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {QUICK.map((q) => {
            const Icon = q.icon
            return (
              <button
                key={q.label}
                onClick={() => navigate(q.view, 'param' in q ? q.param : undefined)}
                className="group rounded-xl border bg-background p-4 text-left transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md"
              >
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-800 transition group-hover:bg-amber-500 group-hover:text-white">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <p className="text-sm font-semibold leading-tight">{q.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{q.desc}</p>
              </button>
            )
          })}
        </div>
      </section>

      {/* brand status */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">Brand identity status</h3>
              <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => navigate('brand-settings')}>Edit <ArrowRight className="h-3 w-3" /></Button>
            </div>
            <div className="space-y-2.5 text-sm">
              <StatusRow ok={!!brand.logoProjectId} label="Official logo set" action="Choose in Brand Settings" onView={() => navigate('brand-settings')} />
              <StatusRow ok={contactReady} label="Contact details (phone & address)" action="Add in Brand Settings" onView={() => navigate('brand-settings')} />
              <StatusRow ok={!!brand.description} label="Business description" action="Write one" onView={() => navigate('brand-settings')} />
              <StatusRow ok={Object.keys(brand.palette).length === 5} label="Brand colour palette" action="Choose colours" onView={() => navigate('brand-settings')} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 font-bold">Recent exports</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : exports.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing exported yet. Files you download appear here.</p>
            ) : (
              <ul className="space-y-2">
                {exports.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-xs">
                    <Badge variant="secondary" className="uppercase">{e.format}</Badge>
                    <span className="min-w-0 flex-1 truncate">{e.projectName || e.fileName}</span>
                    <span className="shrink-0 text-muted-foreground">{new Date(e.createdAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
            <Button size="sm" variant="outline" className="mt-3 w-full text-xs" onClick={() => navigate('exports')}>Open Export Centre</Button>
          </CardContent>
        </Card>
      </section>

      {/* continue editing */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Clock className="h-4 w-4 text-amber-600" /> Continue editing</h2>
          <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => navigate('designs')}>My Designs <ArrowRight className="h-3 w-3" /></Button>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : recent.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="font-medium">No designs yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Start with your logo — everything else reuses it.</p>
            <Button className="mt-4 bg-[#1F2A44] hover:bg-[#2a3a5c]" onClick={() => navigate('logo-studio')}>Open Logo Studio</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {recent.map((p) => (
              <button
                key={p.id}
                onClick={() => openEditor({ projectId: p.id, backTo: 'dashboard' })}
                className="group overflow-hidden rounded-xl border bg-background text-left transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted">
                  {p.preview ? <img src={p.preview} alt={p.name} className="h-full w-full object-contain" /> : <span className="text-xs text-muted-foreground">{p.type}</span>}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-semibold">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(p.updatedAt).toLocaleDateString()}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatusRow({ ok, label, action, onView }: { ok: boolean; label: string; action: string; onView: () => void }) {
  return (
    <div className="flex items-center gap-2.5">
      {ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" /> : <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />}
      <span className="flex-1">{label}</span>
      {!ok && (
        <button onClick={onView} className="text-xs font-medium text-amber-700 underline-offset-2 hover:underline">{action}</button>
      )}
    </div>
  )
}
