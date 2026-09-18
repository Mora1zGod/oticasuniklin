import { useEffect, useRef, useState } from 'react'

/**
 * O que estava sendo preenchido volta depois de uma interrupção.
 *
 * Nem toda interrupção está sob o controle do aplicativo: o navegador descarta
 * a aba para liberar memória, alguém aperta F5, a máquina hiberna. Em qualquer
 * um desses casos a tela volta do zero — e quem estava há dez minutos montando
 * uma venda de três itens recomeça do nada.
 *
 * POR QUE `sessionStorage`, E NÃO `localStorage`
 *
 * Aqui dentro passa nome de cliente, CPF e medida de receita — dado de saúde.
 * O computador da ótica fica no balcão e é de todo mundo: um rascunho guardado
 * em `localStorage` continuaria legível para o próximo operador, horas depois,
 * mesmo após o logout. `sessionStorage` é da aba: sobrevive à recarga e ao
 * descarte de memória, que é o que precisamos, e morre quando a aba fecha, que
 * é o que a LGPD agradece.
 *
 * A tela de Identidade Visual usa `localStorage` de propósito — lá não há dado
 * de pessoa nenhuma, só a marca da ótica, e vale a pena sobreviver ao
 * fechamento do navegador.
 */
function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, raw: string): void {
  try {
    sessionStorage.setItem(key, raw)
  } catch {
    // sem storage o rascunho não sobrevive à recarga; preencher continua igual
  }
}

export function clearDraft(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // idem
  }
}

export function useDraft<T>({
  key,
  value,
  restore,
  enabled,
  reset,
}: {
  /** Uma chave por tela e por ótica — rascunho de uma não reaparece na outra. */
  key: string
  /** O que guardar. Só o que a pessoa digitou; nada de busca ou mensagem de erro. */
  value: T
  /** Como devolver o rascunho aos campos. Chamado uma vez, na montagem. */
  restore: (saved: T) => void
  /**
   * Há algo que valha guardar? Um formulário recém-aberto não gera rascunho —
   * senão a tela avisaria "recuperamos o que você estava editando" para quem
   * não estava editando nada.
   */
  enabled: boolean
  /**
   * Como esvaziar os campos.
   *
   * Descartar tem que esvaziar a tela, não só apagar o que estava guardado: o
   * que ficasse nos campos seria regravado no instante seguinte, e o botão
   * viraria mentira.
   */
  reset: () => void
}): { recovered: boolean; discard: () => void } {
  const [recovered, setRecovered] = useState(false)
  const jaRestaurou = useRef(false)
  const ultimoGravado = useRef<string | null>(null)

  // A restauração acontece uma vez, na montagem, antes de qualquer gravação.
  useEffect(() => {
    if (jaRestaurou.current) return
    jaRestaurou.current = true
    const guardado = read<T>(key)
    if (guardado) {
      restore(guardado)
      setRecovered(true)
    }
    // `restore` é recriada a cada render e não deve reexecutar este efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    if (!jaRestaurou.current || !enabled) return
    const raw = JSON.stringify(value)
    if (raw === ultimoGravado.current) return
    ultimoGravado.current = raw
    write(key, raw)
  }, [key, value, enabled])

  return {
    recovered,
    discard: () => {
      clearDraft(key)
      ultimoGravado.current = null
      setRecovered(false)
      reset()
    },
  }
}
