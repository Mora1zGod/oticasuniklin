import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { applyUpdate, getWaiting, subscribeUpdate } from './register'

/**
 * Estado do app instalável, para a interface. O registro em si acontece no
 * boot (ver `register.ts`) — aqui só observamos.
 */

type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type PwaState = {
  /** Há uma versão nova esperando para assumir. */
  updateReady: boolean
  applyUpdate: () => void
  /** O navegador aceita instalar (Android/desktop). O iPhone não expõe isso. */
  canInstall: boolean
  install: () => Promise<void>
  /** Já está aberto como aplicativo instalado. */
  installed: boolean
  online: boolean
}

export function usePwa(): PwaState {
  const waiting = useSyncExternalStore(subscribeUpdate, getWaiting, () => null)
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => {
    const onPrompt = (event: Event) => {
      // Sem isto o Chrome mostra o próprio balão, na hora que ele quiser.
      event.preventDefault()
      setPrompt(event as InstallPrompt)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!prompt) return
    await prompt.prompt()
    await prompt.userChoice
    setPrompt(null)
  }, [prompt])

  return {
    updateReady: waiting !== null,
    applyUpdate,
    canInstall: prompt !== null && !installed,
    install,
    installed,
    online,
  }
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS não implementa display-mode; expõe esta propriedade no navigator.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
