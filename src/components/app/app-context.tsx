'use client'

// Shared app context: brand settings + session + navigation state.

import { createContext, useContext } from 'react'
import type { BrandSettings } from '@/lib/brand'
import type { SessionUser } from '@/lib/api-client'
import type { DesignDocument, ProjectType } from '@/lib/design/types'

export type ViewId =
  | 'dashboard'
  | 'brand-kit'
  | 'brand-settings'
  | 'logo-studio'
  | 'designer'
  | 'flyer'
  | 'designs'
  | 'products'
  | 'templates'
  | 'exports'
  | 'account'
  | 'documents'
  | 'removebg'

export interface EditorState {
  projectId?: string
  templateId?: string
  initialDoc?: DesignDocument
  initialName?: string
  initialType?: ProjectType
  backTo: ViewId
}

export interface AppContextValue {
  user: SessionUser
  brand: BrandSettings
  reloadBrand: () => Promise<void>
  navigate: (view: ViewId, param?: string) => void
  view: ViewId
  viewParam: string | undefined
  editor: EditorState | null
  openEditor: (state: EditorState) => void
  closeEditor: () => void
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppContext')
  return ctx
}

export const VALID_VIEWS: readonly ViewId[] = [
  'dashboard', 'brand-kit', 'brand-settings', 'logo-studio', 'designer', 'flyer',
  'designs', 'products', 'templates', 'exports', 'account', 'documents', 'removebg',
]

export const VIEW_TITLES: Record<ViewId, string> = {
  dashboard: 'Dashboard',
  'brand-kit': 'Brand Kit',
  'brand-settings': 'Brand Settings',
  'logo-studio': 'Logo Studio',
  designer: 'Designers',
  flyer: 'Flyer Generator',
  designs: 'My Designs',
  products: 'Product Library',
  templates: 'Templates',
  exports: 'Export Centre',
  account: 'Account',
  documents: 'Documents & Receipts',
  removebg: 'Background Remover',
}
