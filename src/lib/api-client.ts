// Typed client-side API layer.
// Every request carries the session in TWO ways: the httpOnly cookie (set by
// the server) AND an `Authorization: Bearer` header (persisted client-side).
// If the browser drops the cookie — which happens in embedded preview frames
// and strict-privacy browsers — the Bearer header keeps the owner signed in.
// A 401 triggers one silent recovery attempt before surfacing an error.

import type { DesignDocument, ProjectType } from '@/lib/design/types'
import type { BrandSettings } from '@/lib/brand'

// ---------- session token store (cookie-independent) ----------

const TOKEN_KEY = 'mk_session_token'

const memoryStore: { token: string | null } = { token: null }

function readStoredToken(): string | null {
  if (memoryStore.token) return memoryStore.token
  try {
    const t = window.localStorage.getItem(TOKEN_KEY)
    if (t) return t
  } catch {}
  try {
    const t = window.sessionStorage.getItem(TOKEN_KEY)
    if (t) return t
  } catch {}
  return null
}

function writeStoredToken(token: string) {
  memoryStore.token = token
  try {
    window.localStorage.setItem(TOKEN_KEY, token)
  } catch {}
  try {
    window.sessionStorage.setItem(TOKEN_KEY, token)
  } catch {}
}

function clearStoredToken() {
  memoryStore.token = null
  try {
    window.localStorage.removeItem(TOKEN_KEY)
  } catch {}
  try {
    window.sessionStorage.removeItem(TOKEN_KEY)
  } catch {}
}

export function currentSessionToken(): string | null {
  return readStoredToken()
}

/** Thrown when the owner must sign in again. Caught globally by AppRoot. */
export class UnauthenticatedError extends Error {
  constructor() {
    super('Your session has ended. Please sign in again.')
    this.name = 'UnauthenticatedError'
  }
}

/** Fired (once per incident) whenever a request cannot be authenticated. */
export const UNAUTHORIZED_EVENT = 'mk:unauthorized'

async function request<T>(url: string, options?: RequestInit, retry = true): Promise<T> {
  const token = readStoredToken()
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  })
  if (res.status === 401 && retry && !url.startsWith('/api/auth/login') && !url.startsWith('/api/auth/register')) {
    // Silent recovery: ask the session endpoint to re-mint our token, then
    // retry the original request once.
    try {
      const sessionRes = await fetch('/api/auth/session', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const sessionJson = (await sessionRes.json().catch(() => ({}))) as { token?: string | null }
      if (sessionRes.ok && sessionJson.token) {
        writeStoredToken(sessionJson.token)
        return request<T>(url, options, false)
      }
    } catch {}
    clearStoredToken()
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
    throw new UnauthenticatedError()
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((json as { error?: string }).error || `Request failed (${res.status})`)
  }
  const data = json as T & { token?: string | null }
  if (data && typeof data === 'object' && typeof data.token === 'string' && data.token.length > 20) {
    writeStoredToken(data.token)
  }
  return json as T
}

export function forgetLocalSession() {
  clearStoredToken()
}

// ---------- auth ----------

export interface SessionUser {
  id: string
  email: string
  name: string | null
  role: string
}

export const authApi = {
  session: () => request<{ user: SessionUser | null; hasOwner: boolean; token?: string | null }>('/api/auth/session'),
  register: (body: { email: string; password: string; name?: string }) =>
    request<{ user: SessionUser; token: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ user: SessionUser; token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
  updateAccount: (body: { name?: string; currentPassword?: string; newPassword?: string }) =>
    request<{ user: SessionUser }>('/api/auth/account', { method: 'PUT', body: JSON.stringify(body) }),
}

// ---------- brand ----------

export const brandApi = {
  get: () => request<{ brand: BrandSettings }>('/api/brand'),
  update: (patch: Partial<BrandSettings>) =>
    request<{ brand: BrandSettings }>('/api/brand', { method: 'PUT', body: JSON.stringify(patch) }),
}

// ---------- projects ----------

export interface ProjectSummary {
  id: string
  name: string
  type: string
  preview: string
  isTemplate: boolean
  templateOf: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface ProjectFull extends ProjectSummary {
  doc: DesignDocument
}

export const projectApi = {
  list: (params?: { type?: string; templates?: 'only' | 'exclude'; archived?: boolean; q?: string; limit?: number }) => {
    const sp = new URLSearchParams()
    if (params?.type) sp.set('type', params.type)
    if (params?.templates) sp.set('templates', params.templates)
    if (params?.archived) sp.set('archived', 'true')
    if (params?.q) sp.set('q', params.q)
    if (params?.limit) sp.set('limit', String(params.limit))
    const qs = sp.toString()
    return request<{ projects: ProjectSummary[] }>(`/api/projects${qs ? `?${qs}` : ''}`)
  },
  get: (id: string) => request<{ project: ProjectFull }>(`/api/projects/${id}`),
  create: (body: { name: string; type: ProjectType; doc: DesignDocument; isTemplate?: boolean; templateOf?: string; preview?: string }) =>
    request<{ project: { id: string; name: string; type: string } }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (
    id: string,
    body: { name?: string; doc?: DesignDocument; preview?: string; isTemplate?: boolean; archived?: boolean; snapshot?: boolean; versionLabel?: string }
  ) => request<{ project: { id: string; updatedAt: string } }>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string, hard = false) => request<{ deleted: boolean }>(`/api/projects/${id}?hard=${hard}`, { method: 'DELETE' }),
  duplicate: (id: string) => request<{ project: { id: string; name: string } }>(`/api/projects/${id}/duplicate`, { method: 'POST' }),
  versions: (id: string) =>
    request<{ versions: { id: string; label: string; createdAt: string }[] }>(`/api/projects/${id}/versions`),
  snapshot: (id: string, label?: string) =>
    request<{ version: { id: string } }>(`/api/projects/${id}/versions`, { method: 'POST', body: JSON.stringify({ label }) }),
  restore: (id: string, versionId: string) =>
    request<{ project: { id: string; doc: DesignDocument } }>(`/api/projects/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify({ versionId }),
    }),
}

// ---------- assets ----------

export interface AssetMeta {
  id: string
  filename: string
  mimeType: string
  kind: string
  size: number
  width: number
  height: number
  createdAt: string
}

export const assetApi = {
  list: (kind?: string) => request<{ assets: AssetMeta[] }>(`/api/assets${kind ? `?kind=${kind}` : ''}`),
  get: (id: string) => request<{ asset: AssetMeta & { data: string } }>(`/api/assets/${id}`),
  upload: (body: {
    filename: string
    mimeType: string
    dataUrl: string
    kind?: 'image' | 'logo-reference' | 'product' | 'background'
    width?: number
    height?: number
    projectId?: string
  }) => request<{ asset: AssetMeta }>('/api/assets', { method: 'POST', body: JSON.stringify(body) }),
  remove: (id: string) => request<{ deleted: boolean }>(`/api/assets/${id}`, { method: 'DELETE' }),
}

// ---------- products ----------

export interface Product {
  id: string
  name: string
  category: string
  description: string
  price: string
  availability: string
  stockRef: string
  notes: string
  imageAssetIds: string[]
  createdAt: string
  updatedAt: string
}

export const productApi = {
  list: () => request<{ products: Product[] }>('/api/products'),
  create: (body: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) =>
    request<{ product: Product }>('/api/products', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) =>
    request<{ product: Product }>(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string) => request<{ deleted: boolean }>(`/api/products/${id}`, { method: 'DELETE' }),
}

// ---------- exports ----------

export interface ExportRecord {
  id: string
  projectId: string | null
  projectName: string
  projectType: string
  format: string
  fileName: string
  width: number
  height: number
  scale: string
  paperSize: string
  createdAt: string
}

export const exportApi = {
  list: () => request<{ exports: ExportRecord[] }>('/api/exports'),
  record: (body: Omit<ExportRecord, 'id' | 'createdAt'>) =>
    request<{ record: ExportRecord }>('/api/exports', { method: 'POST', body: JSON.stringify(body) }),
}

// ---------- ai ----------

export interface AiProposal {
  reply: string
  updates: { id: string; patch: Record<string, unknown> }[]
  removeIds: string[]
  recolor: { role: string; color: string } | null
}

export const aiApi = {
  assistant: (body: { instruction: string; docSummary: string; brandContext?: string; designType?: string }) =>
    request<AiProposal>('/api/ai/assistant', { method: 'POST', body: JSON.stringify(body) }),
  generateImage: (body: { prompt: string; size?: string }) =>
    request<{ dataUrl: string; size: string }>('/api/ai/image', { method: 'POST', body: JSON.stringify(body) }),
  editImage: (body: { image: string; prompt: string; size?: string }) =>
    request<{ dataUrl: string; size: string; flattened: boolean }>('/api/ai/edit-image', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  removeBackground: (body: { image: string }) =>
    request<{ dataUrl: string; width: number; height: number; transparencyApplied: boolean }>('/api/ai/remove-background', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}
