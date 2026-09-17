import { useState } from 'react'
import { usePwa } from '@/pwa/usePwa'
import { Button } from './ui/primitives'
import { IconCloudOff, IconDownload, IconRefresh } from './ui/icons'

/**
 * Os dois avisos que um sistema de balcão precisa dar e nenhum a mais:
 * caiu a internet, e saiu versão nova.
 *
 * Ficam presos ao rodapé porque o operador está com a mão no teclado e a
 * atenção no cliente — um balão no topo passaria batido.
 */
export function PwaNotices() {
  const { updateReady, applyUpdate, online } = usePwa()

  if (!online) {
    return (
      <Bar tone="warning">
        <IconCloudOff className="size-4 shrink-0" />
        <span>
          Sem conexão. O que você já abriu continua na tela, mas nada é salvo até a
          internet voltar.
        </span>
      </Bar>
    )
  }

  if (updateReady) {
    return (
      <Bar tone="info">
        <IconRefresh className="size-4 shrink-0" />
        <span>Uma versão nova do sistema está pronta.</span>
        <button
          onClick={applyUpdate}
          className="ml-1 shrink-0 font-semibold underline underline-offset-2"
        >
          Atualizar agora
        </button>
      </Bar>
    )
  }

  return null
}

/** Botão de instalar, para o cabeçalho. Some sozinho onde não se aplica. */
export function InstallButton() {
  const { canInstall, install } = usePwa()
  const [busy, setBusy] = useState(false)

  if (!canInstall) return null

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await install()
        setBusy(false)
      }}
      title="Instalar o sistema neste aparelho"
    >
      <IconDownload className="size-4" />
      <span className="hidden sm:inline">Instalar</span>
    </Button>
  )
}

function Bar({
  tone,
  children,
}: {
  tone: 'warning' | 'info'
  children: React.ReactNode
}) {
  return (
    <div
      role="status"
      className={
        'fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2 ' +
        'px-4 py-2 text-xs ' +
        'pb-[max(0.5rem,env(safe-area-inset-bottom))] ' +
        (tone === 'warning'
          ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200'
          : 'bg-brand-600 text-white')
      }
    >
      {children}
    </div>
  )
}
