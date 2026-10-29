'use client'

// AppRoot: session gate + hash-based SPA routing + brand context + editor host.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { BrandSettings } from '@/lib/brand'
import { authApi, UNAUTHORIZED_EVENT, forgetLocalSession } from '@/lib/api-client'
import type { SessionUser } from '@/lib/api-client'
import { AppContext, type ViewId, type EditorState, VALID_VIEWS } from './app-context'
import type { ViewId as V } from './app-context'
import { AuthScreen } from './auth-screen'
import { SessionExpiredDialog } from './session-dialog'
import { Shell } from './shell'
import { DashboardView } from './views/dashboard'
import { BrandKitView } from './views/brand-kit'
import { BrandSettingsView } from './views/brand-settings'
import { LogoStudioView } from './views/logo-studio'
import { DesignerView } from './views/designer'
import { FlyerWizardView } from './views/flyer-wizard'
import { MyDesignsView } from './views/my-designs'
import { ProductLibraryView } from './views/product-library'
import { TemplatesView } from './views/templates'
import { ExportCentreView } from './views/export-centre'
import { AccountView } from './views/account'
import { DocumentsView } from './views/documents'
import { BackgroundRemoverView } from './views/background-remover'
import { DesignEditor } from '@/components/studio/design-editor'
import { DEFAULT_BRAND } from '@/lib/brand'

function parseHash(): { view: V; param?: string } {
  const h = window.location.hash.replace(/^#\/?/, '')
  const [v, param] = h.split('/')
  const view = (VALID_VIEWS as readonly string[]).includes(v) ? (v as V) : 'dashboard'
  return { view, param }
}

export function AppRoot() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [hasOwner, setHasOwner] = useState(true)
  const [brand, setBrand] = useState<BrandSettings>(DEFAULT_BRAND)
  const [route, setRoute] = useState<{ view: V; param?: string }>(() =>
    typeof window === 'undefined' ? { view: 'dashboard' } : parseHash()
  )
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [sessionEnded, setSessionEnded] = useState(false)
  const sessionEndedRef = useRef(false)

  // A single, professional dialog replaces any number of failed-request toasts.
  useEffect(() => {
    const onUnauthorized = () => {
      if (sessionEndedRef.current) return
      sessionEndedRef.current = true
      setSessionEnded(true)
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const loadBrand = useCallback(async () => {
    try {
      const { brand: b } = await import('@/lib/api-client').then((m) => m.brandApi.get())
      setBrand(b)
    } catch {
      // keep defaults on failure
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const { user: u, hasOwner: ho } = await authApi.session()
        setUser(u)
        setHasOwner(ho)
        if (u) await loadBrand()
      } catch {
        // network problem — show auth screen with sign-in
      } finally {
        setLoading(false)
      }
    })()
  }, [loadBrand])

  const navigate = useCallback((view: ViewId, param?: string) => {
    window.location.hash = `/${view}${param ? `/${param}` : ''}`
    setRoute({ view, param })
    setEditor(null)
  }, [])

  const openEditor = useCallback((state: EditorState) => {
    setEditor(state)
  }, [])

  const closeEditor = useCallback(() => {
    setEditor(null)
    void loadBrand()
  }, [loadBrand])

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#141a26]">
        <div className="text-center text-white">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5A623] text-xl font-black text-[#1F2A44]">MK</div>
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[#F5A623] border-t-transparent" />
          <p className="mt-3 text-sm text-white/60">Opening your design studio…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <AuthScreen
        hasOwner={hasOwner}
        onAuthed={(u) => {
          setUser(u)
          setSessionEnded(false)
          sessionEndedRef.current = false
          void loadBrand()
          window.location.hash = '/dashboard'
        }}
      />
    )
  }

  let content: React.ReactNode = null
  switch (route.view) {
    case 'brand-kit':
      content = <BrandKitView />
      break
    case 'brand-settings':
      content = <BrandSettingsView />
      break
    case 'logo-studio':
      content = <LogoStudioView />
      break
    case 'designer':
      content = <DesignerView />
      break
    case 'flyer':
      content = <FlyerWizardView />
      break
    case 'designs':
      content = <MyDesignsView />
      break
    case 'products':
      content = <ProductLibraryView />
      break
    case 'templates':
      content = <TemplatesView />
      break
    case 'exports':
      content = <ExportCentreView />
      break
    case 'account':
      content = <AccountView />
      break
    case 'documents':
      content = <DocumentsView />
      break
    case 'removebg':
      content = <BackgroundRemoverView />
      break
    default:
      content = <DashboardView />
  }

  return (
    <AppContext.Provider
      value={{
        user,
        brand,
        reloadBrand: loadBrand,
        navigate,
        view: route.view,
        viewParam: route.param,
        editor,
        openEditor,
        closeEditor,
      }}
    >
      <Shell>
        {editor ? (
          <DesignEditor
            key={editor.projectId ?? editor.templateId ?? 'new'}
            projectId={editor.projectId}
            templateId={editor.templateId}
            initialDoc={editor.initialDoc}
            initialName={editor.initialName}
            initialType={editor.initialType}
            brand={brand}
            onBack={closeEditor}
          />
        ) : (
          content
        )}
      </Shell>
      <SessionExpiredDialog
        open={sessionEnded}
        onSignIn={() => {
          forgetLocalSession()
          setSessionEnded(false)
          sessionEndedRef.current = false
          setUser(null)
          window.location.hash = '/dashboard'
        }}
      />
    </AppContext.Provider>
  )
}
