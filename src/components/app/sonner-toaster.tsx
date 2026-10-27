'use client'

import { Toaster as Sonner } from '@/components/ui/sonner'

export function SonnerToaster() {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        style: { zIndex: 200 },
      }}
    />
  )
}
