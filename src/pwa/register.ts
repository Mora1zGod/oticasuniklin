/**
 * Registro do service worker.
 *
 * Fica fora do React e é chamado no boot (main.tsx): a tela de login não monta
 * o AppShell, então prender o registro a um componente deixaria quem ainda não
 * entrou sem app instalável — justamente quem vai instalar.
 *
 * Em desenvolvimento não registra: o cache esconderia as mudanças do Vite.
 */

let waiting: ServiceWorker | null = null
let registration: ServiceWorkerRegistration | null = null
const listeners = new Set<() => void>()

const notify = () => {
  for (const listener of listeners) listener()
}

export function subscribeUpdate(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getWaiting = (): ServiceWorker | null => waiting

export function registerServiceWorker(): void {
  if (import.meta.env.DEV) return
  if (!('serviceWorker' in navigator)) return

  const watch = (reg: ServiceWorkerRegistration) => {
    registration = reg
    if (reg.waiting) {
      waiting = reg.waiting
      notify()
    }
    reg.addEventListener('updatefound', () => {
      const next = reg.installing
      if (!next) return
      next.addEventListener('statechange', () => {
        // "installed" com um controller já ativo = atualização, não 1ª visita.
        if (next.state === 'installed' && navigator.serviceWorker.controller) {
          waiting = next
          notify()
        }
      })
    })
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(watch)
      .catch(() => {
        // Sem service worker o sistema funciona igual, só não abre offline.
      })
  })

  // Volta do bolso: confere se saiu deploy enquanto o app estava parado.
  window.addEventListener('focus', () => void registration?.update())
}

export function applyUpdate(): void {
  if (!waiting) return
  // Quando o worker novo assume o controle, a página recarrega uma única vez.
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => window.location.reload(),
    { once: true },
  )
  waiting.postMessage('skip-waiting')
}
