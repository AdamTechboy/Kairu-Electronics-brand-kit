// Server-side auth: JWT sessions (jose) + bcrypt password hashing.
// The session rides on an httpOnly cookie AND an Authorization: Bearer token.
// The Bearer path keeps the owner signed in even in browsers or embedded
// preview frames that block cookies — no more phantom "please sign in" popups.

import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies, headers } from 'next/headers'
import { randomBytes } from 'crypto'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'

const COOKIE_NAME = 'mk_session'
export const SESSION_DAYS = 30

async function getSecretKey(): Promise<Uint8Array> {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32) {
    return new TextEncoder().encode(process.env.AUTH_SECRET)
  }
  // Production instances must share a stable secret; ephemeral filesystem secrets
  // would invalidate sessions across serverless instances and cold starts.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET must be configured in production (use a stable random secret of at least 32 characters).')
  }
  // File-based fallback for local development only.
  const secretPath = path.join(process.cwd(), 'db', '.auth-secret')
  try {
    const existing = await readFile(secretPath, 'utf8')
    if (existing.trim().length >= 16) return new TextEncoder().encode(existing.trim())
  } catch {}
  const generated = randomBytes(32).toString('hex')
  await mkdir(path.dirname(secretPath), { recursive: true })
  await writeFile(secretPath, generated, { mode: 0o600 })
  return new TextEncoder().encode(generated)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function issueSessionToken(userId: string): Promise<string> {
  const key = await getSecretKey()
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key)
}

export async function setSessionCookie(userId: string): Promise<void> {
  const token = await issueSessionToken(userId)
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_ALLOW_HTTP !== '1',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: '/',
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.set(COOKIE_NAME, '', { httpOnly: true, maxAge: 0, path: '/' })
}

export interface SessionUser {
  id: string
  email: string
  name: string | null
  role: string
}

async function verifyToken(token: string): Promise<string | null> {
  try {
    const key = await getSecretKey()
    const { payload } = await jwtVerify(token, key)
    return payload.sub ?? null
  } catch {
    return null
  }
}

/**
 * Resolves the signed-in owner from either the httpOnly cookie or an
 * `Authorization: Bearer <token>` header. Returns null when neither carries a
 * valid, non-expired token for an existing user.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    let token: string | undefined

    const store = await cookies()
    token = store.get(COOKIE_NAME)?.value

    if (!token) {
      const hdrs = await headers()
      const auth = hdrs.get('authorization') ?? hdrs.get('Authorization')
      if (auth?.toLowerCase().startsWith('bearer ')) {
        token = auth.slice(7).trim()
      }
    }

    if (!token) return null
    const userId = await verifyToken(token)
    if (!userId) return null
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) return null
    return { id: user.id, email: user.email, name: user.name, role: user.role }
  } catch {
    return null
  }
}

export class AuthError extends Error {
  status = 401
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new AuthError('Not authenticated')
  return user
}

// ---- simple in-memory login rate limiting (per IP) ----
const attempts = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(key: string, max = 10, windowMs = 5 * 60 * 1000): boolean {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  entry.count++
  return entry.count <= max
}

export function clearRateLimit(key: string): void {
  attempts.delete(key)
}
