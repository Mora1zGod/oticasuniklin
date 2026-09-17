import { useEffect, useRef, useState } from 'react'
import { Field, Input, cx } from './ui/primitives'
import { CepError, formatCep, isCompleteCep, lookupCep, type CepAddress } from '@/lib/cep'

/**
 * Campo de CEP que preenche o resto do endereço.
 *
 * Busca sozinho ao completar os oito dígitos — ninguém deveria precisar clicar
 * em "buscar". O que vier preenche rua, bairro, cidade e UF; número e
 * complemento continuam com o operador, porque o CEP não sabe deles.
 */
export function CepField({
  value,
  onChange,
  onFound,
  className,
  label = 'CEP',
}: {
  value: string
  onChange: (value: string) => void
  onFound: (address: CepAddress) => void
  className?: string
  label?: string
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const lastLookup = useRef('')

  useEffect(() => {
    if (!isCompleteCep(value)) {
      setState('idle')
      setMessage(null)
      lastLookup.current = ''
      return
    }
    // Já buscamos este CEP: não repetir a cada tecla.
    if (lastLookup.current === value) return
    lastLookup.current = value

    let cancelled = false
    setState('loading')
    setMessage(null)

    lookupCep(value)
      .then((address) => {
        if (cancelled) return
        setState('ok')
        setMessage(`${address.city} — ${address.stateCode}`)
        onFound(address)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState('error')
        setMessage(
          error instanceof CepError
            ? error.message
            : 'Não foi possível consultar o CEP. Preencha manualmente.',
        )
      })

    return () => {
      cancelled = true
    }
    // `onFound` costuma ser uma função nova a cada render; depender dela
    // relançaria a busca sem motivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <Field
      label={label}
      className={className}
      hint={state === 'loading' ? 'Buscando endereço…' : (state === 'ok' ? (message ?? undefined) : undefined)}
      error={state === 'error' ? message : null}
    >
      <div className="relative">
        <Input
          value={value}
          onChange={(event) => onChange(formatCep(event.target.value))}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          maxLength={9}
          className={cx(state === 'loading' && 'pr-9')}
        />
        {state === 'loading' && (
          <span
            aria-hidden
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-line-strong border-t-brand-600"
          />
        )}
      </div>
    </Field>
  )
}
