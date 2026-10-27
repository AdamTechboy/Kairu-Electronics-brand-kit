'use client'

// App shell: persistent navigation (sidebar on desktop, drawer on mobile),
// sticky footer, and the main content area.

import { useState } from 'react'
import { useApp, type ViewId } from './app-context'
import { authApi, forgetLocalSession } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  LayoutDashboard, Palette, Settings2, Sparkles, FileImage, FileText, IdCard, MessageSquareQuote,
  Share2, LayoutTemplate, Package, FolderOpen, Download, UserRound, Menu, LogOut, PanelsTopLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  id: ViewId
  label: string
  icon: React.ComponentType<{ className?: string }>
  param?: string
}

const CREATE: NavItem[] = [
  { id: 'logo-studio', label: 'Logo Studio', icon: Sparkles },
  { id: 'flyer', label: 'Flyer Generator', icon: FileImage },
  { id: 'designer', label: 'Letterhead Designer', icon: FileText, param: 'letterhead' },
  { id: 'designer', label: 'Business Card', icon: IdCard, param: 'business-card' },
  { id: 'designer', label: 'Complimentary Card', icon: MessageSquareQuote, param: 'complimentary-card' },
  { id: 'designer', label: 'Social Media Post', icon: Share2, param: 'social-post' },
]

const MANAGE: NavItem[] = [
  { id: 'designs', label: 'My Designs', icon: FolderOpen },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'products', label: 'Product Library', icon: Package },
  { id: 'exports', label: 'Export Centre', icon: Download },
]

const BRAND: NavItem[] = [
  { id: 'brand-kit', label: 'My Brand Kit', icon: Palette },
  { id: 'brand-settings', label: 'Brand Settings', icon: Settings2 },
  { id: 'account', label: 'Account Settings', icon: UserRound },
]

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition',
        active ? 'bg-amber-100 font-semibold text-amber-900' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  )
}

function NavSections({ current, currentParam, onNavigate }: { current: ViewId; currentParam?: string; onNavigate: (v: ViewId, p?: string) => void }) {
  const isNavActive = (item: NavItem) => current === item.id && (item.param ? currentParam === item.param || !currentParam : true)
  return (
    <nav className="space-y-4" aria-label="Main navigation">
      <div>
        <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Create</p>
        <div className="space-y-0.5">
          <NavButton item={{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }} active={current === 'dashboard'} onClick={() => onNavigate('dashboard')} />
          {CREATE.map((item) => (
            <NavButton key={item.label} item={item} active={isNavActive(item)} onClick={() => onNavigate(item.id, item.param)} />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Manage</p>
        <div className="space-y-0.5">
          {MANAGE.map((item) => (
            <NavButton key={item.id} item={item} active={isNavActive(item)} onClick={() => onNavigate(item.id)} />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Brand</p>
        <div className="space-y-0.5">
          {BRAND.map((item) => (
            <NavButton key={item.id} item={item} active={isNavActive(item)} onClick={() => onNavigate(item.id)} />
          ))}
        </div>
      </div>
    </nav>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { brand, user, view, viewParam, navigate } = useApp()
  const [mobileOpen, setMobileOpen] = useState(false)

  const logout = async () => {
    try {
      await authApi.logout()
    } finally {
      forgetLocalSession()
      window.location.reload()
    }
  }

  const initials = (brand.businessName || 'MK')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="flex min-h-dvh w-full flex-col bg-[#F4F2EC]">
      {/* mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b bg-background px-3 py-2 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 overflow-y-auto p-4">
            <SheetHeader className="p-0 pb-3">
              <SheetTitle className="flex items-center gap-2 text-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1F2A44] font-black text-[#F5A623]">{initials}</span>
                {brand.businessName}
              </SheetTitle>
            </SheetHeader>
            <NavSections
              current={view}
              currentParam={viewParam}
              onNavigate={(v, p) => {
                navigate(v, p)
                setMobileOpen(false)
              }}
            />
            <Button variant="outline" className="mt-4 w-full gap-2" onClick={() => void logout()}><LogOut className="h-4 w-4" /> Sign out</Button>
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1F2A44] text-[11px] font-black text-[#F5A623]">{initials}</span>
          <span className="text-sm font-bold">{brand.businessName}</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-background lg:flex">
          <div className="flex items-center gap-2.5 border-b px-4 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1F2A44] text-xs font-black text-[#F5A623]">{initials}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">{brand.businessName}</p>
              <p className="text-[11px] text-muted-foreground">Design Studio</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5">
            <NavSections current={view} currentParam={viewParam} onNavigate={navigate} />
          </div>
          <div className="border-t p-3">
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-900">
                {(user.name ?? user.email).slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{user.name ?? 'Owner'}</p>
                <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={() => void logout()}><LogOut className="h-3.5 w-3.5" /> Sign out</Button>
          </div>
        </aside>

        {/* main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="min-h-0 flex-1">{children}</main>
          <footer className="mt-auto border-t bg-background px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><PanelsTopLeft className="h-3.5 w-3.5" /> {brand.businessName} — Brand Kit &amp; Design Studio</span>
              <span>{brand.address ? `${brand.address.split(',').slice(0, 2).join(',')}` : ''} {brand.phones[0] ? `• ${brand.phones[0]}` : ''}</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
