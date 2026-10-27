'use client'

// Professional full-screen session dialog. Shown once when the app detects
// the session can no longer be authenticated — replaces popup/toast spam.

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LogIn, ShieldAlert } from 'lucide-react'

interface Props {
  open: boolean
  onSignIn: () => void
}

export function SessionExpiredDialog({ open, onSignIn }: Props) {
  return (
    <Dialog open={open}>
      <DialogContent className="max-w-md overflow-hidden rounded-2xl p-0" showCloseButton={false} onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <div className="bg-[#1F2A44] px-6 pb-6 pt-7 text-white">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5A623]/15">
            <ShieldAlert className="h-6 w-6 text-[#F5A623]" />
          </div>
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-lg font-bold text-white">Your session has ended</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-white/70">
              For your security, studio sessions end after a period of inactivity. Any design you already saved is safe — sign in again to continue where you left off.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="flex items-center justify-between gap-3 border-t bg-background px-6 py-4">
          <p className="text-[11px] text-muted-foreground">Saved designs stay in My&nbsp;Designs.</p>
          <Button onClick={onSignIn} className="gap-2 bg-[#1F2A44] hover:bg-[#2a3a5c]">
            <LogIn className="h-4 w-4" />
            Sign in again
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
