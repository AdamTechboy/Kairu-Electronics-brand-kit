'use client'

// Account settings: profile + password change.

import { useState } from 'react'
import { useApp } from '../app-context'
import { authApi } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, UserRound, KeyRound } from 'lucide-react'
import { toast } from 'sonner'

export function AccountView() {
  const { user, brand } = useApp()
  const [name, setName] = useState(user.name ?? '')
  const [savingName, setSavingName] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  const saveName = async () => {
    setSavingName(true)
    try {
      await authApi.updateAccount({ name })
      toast.success('Name updated.')
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update your name')
    } finally {
      setSavingName(false)
    }
  }

  const savePassword = async () => {
    if (next.length < 8) {
      toast.error('New password must be at least 8 characters.')
      return
    }
    setSavingPw(true)
    try {
      await authApi.updateAccount({ currentPassword: current, newPassword: next })
      toast.success('Password changed.')
      setCurrent('')
      setNext('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change the password')
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 lg:p-8" data-testid="account">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><UserRound className="h-6 w-6 text-amber-600" /> Account Settings</h1>
        <p className="text-sm text-muted-foreground">Signed in as {user.email} — owner of {brand.businessName}.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-4 w-4" /> Profile</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Your name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email (sign-in)</Label>
            <Input value={user.email} disabled />
          </div>
          <Button onClick={() => void saveName()} disabled={savingName || !name.trim()}>
            {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save profile
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" /> Change password</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Current password</Label>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="space-y-1.5">
            <Label>New password (min 8 characters)</Label>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </div>
          <Button variant="outline" onClick={() => void savePassword()} disabled={savingPw || !current || !next}>
            {savingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Change password
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
