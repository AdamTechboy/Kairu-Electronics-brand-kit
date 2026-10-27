'use client'

// Authentication screen: first-run owner registration or sign-in.

import { useState } from 'react'
import { authApi } from '@/lib/api-client'
import type { SessionUser } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, LogIn, ShieldCheck, Zap, Sun, Fan, Tv, BatteryCharging } from 'lucide-react'

interface Props {
  hasOwner: boolean
  onAuthed: (user: SessionUser) => void
}

export function AuthScreen({ hasOwner, onAuthed }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>(hasOwner ? 'login' : 'register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res =
        mode === 'register'
          ? await authApi.register({ email, password, name })
          : await authApi.login({ email, password })
      toast.success(mode === 'register' ? 'Owner account created. Welcome!' : 'Welcome back!')
      onAuthed(res.user)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#141a26] lg:flex-row" data-testid="auth-screen">
      {/* brand panel */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-[#1F2A44] p-8 text-white lg:w-[55%] lg:p-14">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#F5A623]/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[#F5A623]/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5A623] font-black text-[#1F2A44]">MK</div>
            <div>
              <p className="text-lg font-bold leading-tight">Muhammad Kairu Electronics</p>
              <p className="text-xs text-white/60">Brand Kit &amp; Design Studio</p>
            </div>
          </div>
          <h1 className="mt-14 max-w-md text-3xl font-bold leading-tight lg:text-4xl">
            Create your logos, flyers, cards and letterheads — <span className="text-[#F5A623]">without a designer.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70">
            A private studio for your business: edit your logo, generate product flyers with prices and availability, design business cards, and download real print-ready files.
          </p>
          <div className="mt-8 flex flex-wrap gap-6 text-xs text-white/60">
            <span className="flex items-center gap-2"><Sun className="h-4 w-4 text-[#F5A623]" /> Solar &amp; energy</span>
            <span className="flex items-center gap-2"><Tv className="h-4 w-4 text-[#F5A623]" /> Electronics</span>
            <span className="flex items-center gap-2"><Fan className="h-4 w-4 text-[#F5A623]" /> Home comfort</span>
            <span className="flex items-center gap-2"><BatteryCharging className="h-4 w-4 text-[#F5A623]" /> Reliable power</span>
          </div>
        </div>
        <p className="relative mt-10 text-[11px] text-white/40">No. 41 Ahmadu Bello Way, Shop 31A, Rochas Plaza, Jos, Plateau State, Nigeria</p>
      </div>

      {/* form */}
      <div className="flex flex-1 items-center justify-center bg-[#141a26] p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
          <div className="mb-6 flex items-center gap-2 text-[#1F2A44]">
            <ShieldCheck className="h-5 w-5 text-[#F5A623]" />
            <h2 className="text-lg font-bold">{hasOwner ? 'Owner sign in' : 'Create your owner account'}</h2>
          </div>
          <form onSubmit={submit} className="space-y-4">
            {!hasOwner && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Muhammad Kairu" autoComplete="name" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@example.com" autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={hasOwner ? 'Your password' : 'At least 8 characters'}
                autoComplete={hasOwner ? 'current-password' : 'new-password'}
              />
              {!hasOwner && <p className="text-[11px] text-muted-foreground">This is the only account — keep the password safe. There are no default passwords.</p>}
            </div>
            <Button type="submit" disabled={busy} className="w-full gap-2 bg-[#1F2A44] hover:bg-[#2a3a5c]">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {hasOwner ? 'Sign in' : 'Create account & start'}
            </Button>
          </form>
          {hasOwner && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              <Zap className="mr-1 inline h-3 w-3 text-[#F5A623]" />
              Private studio — only the owner account can sign in.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
