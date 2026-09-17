import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/auth/SessionProvider'
import { Alert, Button, Field, Input } from '@/components/ui/primitives'
import { describeError } from '@/lib/errors'
import { digitsOnly, isValidCnpj } from '@/lib/format'

const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)

/**
 * Primeiro acesso: o usuário existe no Supabase Auth mas ainda não pertence a
 * nenhuma ótica. `bootstrap_tenant` cria tenant + matriz + admin + todos os
 * padrões operacionais numa transação (migration 0010).
 */
export function OnboardingPage() {
  const { authSession, context, loading, reload } = useSession()
  const navigate = useNavigate()
  const [tradeName, setTradeName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [branchName, setBranchName] = useState('Matriz')
  const [taxDocument, setTaxDocument] = useState('')
  const [adminName, setAdminName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && !authSession) return <Navigate to="/entrar" replace />
  if (!loading && context?.status === 'ready') return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const cnpj = digitsOnly(taxDocument)
    if (cnpj && !isValidCnpj(cnpj)) {
      setError('CNPJ inválido.')
      return
    }

    setBusy(true)
    const { error: err } = await supabase.rpc('bootstrap_tenant', {
      p_slug: slugify(tradeName),
      p_legal_name: legalName || tradeName,
      p_trade_name: tradeName,
      p_branch_name: branchName || 'Matriz',
      p_admin_name: adminName || null,
      p_tax_document: cnpj || null,
    })
    setBusy(false)

    if (err) {
      setError(describeError(err))
      return
    }
    await reload()
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Vamos criar sua ótica</h1>
          <p className="mt-1 text-sm text-slate-500">
            Em um passo: sua ótica já nasce com situações de O.S., formas de pagamento,
            plano de contas e tabela de preço configurados.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        >
          {error && <Alert>{error}</Alert>}

          <Field label="Nome fantasia" required hint="É o nome que aparece no sistema.">
            <Input
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
              placeholder="Óticas Uniklin"
              required
            />
          </Field>

          <Field label="Razão social" hint="Se deixar vazio, usamos o nome fantasia.">
            <Input
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Óticas Uniklin LTDA"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CNPJ">
              <Input
                value={taxDocument}
                onChange={(e) => setTaxDocument(e.target.value)}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
              />
            </Field>

            <Field label="Nome da primeira loja" required>
              <Input
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="Matriz - Centro"
                required
              />
            </Field>
          </div>

          <Field label="Seu nome" hint="Você fica como administrador da ótica.">
            <Input
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="Gabriel Moura"
            />
          </Field>

          <Button type="submit" className="w-full" disabled={busy || !tradeName}>
            {busy ? 'Criando…' : 'Criar ótica e começar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
