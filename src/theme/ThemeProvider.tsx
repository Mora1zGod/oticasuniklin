import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'

type ThemeState = {
  /** O que o usuário escolheu — inclusive "acompanhar o sistema". */
  choice: ThemeChoice
  /** O tema que está valendo agora. */
  resolved: 'light' | 'dark'
  setChoice: (choice: ThemeChoice) => void
  /** Alterna entre claro e escuro a partir do que está valendo. */
  toggle: () => void
}

const STORAGE_KEY = 'uniklin.theme'
const ThemeCtx = createContext<ThemeState | null>(null)

function readStored(): ThemeChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'light' || value === 'dark' || value === 'system') return value
  } catch {
    // navegador sem storage (janela privada, cookies bloqueados)
  }
  return 'system'
}

const systemPrefersDark = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readStored)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  // Acompanha a troca de tema do sistema operacional enquanto a escolha for
  // "system" — o usuário muda no Windows e a tela segue junto.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolved: 'light' | 'dark' =
    choice === 'system' ? (systemDark ? 'dark' : 'light') : choice

  // O atributo carrega o tema JÁ RESOLVIDO, não a escolha: o CSS tem um único
  // bloco escuro e não precisa repetir os tokens numa consulta de mídia.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved)
  }, [resolved])

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // preferência não persiste; a sessão atual continua funcionando
    }
  }, [])

  const value = useMemo<ThemeState>(
    () => ({
      choice,
      resolved,
      setChoice,
      toggle: () => setChoice(resolved === 'dark' ? 'light' : 'dark'),
    }),
    [choice, resolved, setChoice],
  )

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeCtx)
  if (!ctx) throw new Error('useTheme precisa estar dentro de <ThemeProvider>')
  return ctx
}
