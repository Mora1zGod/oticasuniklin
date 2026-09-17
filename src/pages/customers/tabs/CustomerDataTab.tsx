import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Alert, Button, Field, Input, Select } from '@/components/ui/primitives'
import { Spinner } from '@/components/ui/Spinner'
import { describeError } from '@/lib/errors'
import { digitsOnly, isValidCnpj, isValidCpf } from '@/lib/format'
import { useCatalog } from '@/hooks/useCatalog'
import type { Row } from '@/lib/db'

type Customer = Row<'customers'>

/**
 * PF e PJ têm perfis 1:1 distintos (ADR-005): nenhuma coluna existe "nula por
 * não se aplicar" — ela simplesmente não existe na outra tabela.
 */
export function CustomerDataTab({ customer }: { customer: Customer }) {
  const queryClient = useQueryClient()
  const isCompany = customer.party_type === 'company'
  const professions = useCatalog('profession')
  const maritalStatuses = useCatalog('marital_status')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const profile = useQuery({
    queryKey: ['customer-profile', customer.id, customer.party_type],
    queryFn: async () => {
      if (isCompany) {
        const { data, error: err } = await supabase
          .from('company_profiles')
          .select('*')
          .eq('customer_id', customer.id)
          .maybeSingle()
        if (err) throw err
        return data
      }
      const { data, error: err } = await supabase
        .from('individual_profiles')
        .select('*')
        .eq('customer_id', customer.id)
        .maybeSingle()
      if (err) throw err
      return data
    },
  })

  const [form, setForm] = useState<Record<string, string>>({})
  const value = (key: string, fallback: unknown): string =>
    form[key] ?? (fallback === null || fallback === undefined ? '' : String(fallback))
  const set = (key: string, v: string) => {
    setForm((prev) => ({ ...prev, [key]: v }))
    setSaved(false)
  }

  const save = useMutation({
    mutationFn: async () => {
      setError(null)
      const name = value('display_name', customer.display_name).trim()
      if (!name) throw new Error('O nome não pode ficar vazio.')

      const { error: customerError } = await supabase
        .from('customers')
        .update({ display_name: name, notes: value('notes', customer.notes) || null })
        .eq('id', customer.id)
      if (customerError) throw customerError

      if (isCompany) {
        const cnpj = digitsOnly(value('cnpj', profile.data && 'cnpj' in profile.data ? profile.data.cnpj : ''))
        if (cnpj && !isValidCnpj(cnpj)) throw new Error('CNPJ inválido.')
        const payload = {
          customer_id: customer.id,
          tenant_id: customer.tenant_id,
          cnpj: cnpj || null,
          legal_name: value('legal_name', profile.data && 'legal_name' in profile.data ? profile.data.legal_name : '') || null,
          trade_name: value('trade_name', profile.data && 'trade_name' in profile.data ? profile.data.trade_name : '') || null,
          state_registration:
            value('state_registration', profile.data && 'state_registration' in profile.data ? profile.data.state_registration : '') || null,
          municipal_registration:
            value('municipal_registration', profile.data && 'municipal_registration' in profile.data ? profile.data.municipal_registration : '') || null,
          tax_regime: (value('tax_regime', profile.data && 'tax_regime' in profile.data ? profile.data.tax_regime : '') || null) as
            | 'simples_nacional' | 'lucro_presumido' | 'lucro_real' | 'mei' | 'imune' | 'isento' | null,
        }
        const { error: err } = await supabase
          .from('company_profiles')
          .upsert(payload, { onConflict: 'customer_id' })
        if (err) throw err
      } else {
        const cpf = digitsOnly(value('cpf', profile.data && 'cpf' in profile.data ? profile.data.cpf : ''))
        if (cpf && !isValidCpf(cpf)) throw new Error('CPF inválido.')
        const payload = {
          customer_id: customer.id,
          tenant_id: customer.tenant_id,
          cpf: cpf || null,
          national_id: value('national_id', profile.data && 'national_id' in profile.data ? profile.data.national_id : '') || null,
          birth_date: value('birth_date', profile.data && 'birth_date' in profile.data ? profile.data.birth_date : '') || null,
          gender: (value('gender', profile.data && 'gender' in profile.data ? profile.data.gender : '') || null) as
            | 'female' | 'male' | 'other' | 'undisclosed' | null,
          profession_entry_id:
            value('profession_entry_id', profile.data && 'profession_entry_id' in profile.data ? profile.data.profession_entry_id : '') || null,
          marital_status_entry_id:
            value('marital_status_entry_id', profile.data && 'marital_status_entry_id' in profile.data ? profile.data.marital_status_entry_id : '') || null,
        }
        const { error: err } = await supabase
          .from('individual_profiles')
          .upsert(payload, { onConflict: 'customer_id' })
        if (err) throw err
      }
    },
    onSuccess: () => {
      setSaved(true)
      void queryClient.invalidateQueries({ queryKey: ['customer', customer.id] })
      void queryClient.invalidateQueries({ queryKey: ['customer-overview', customer.id] })
      void queryClient.invalidateQueries({ queryKey: ['customer-profile', customer.id] })
    },
    onError: (err) => setError(describeError(err)),
  })

  /** Promove para cadastro completo — o banco recusa se faltar algo (ADR-006). */
  const promote = useMutation({
    mutationFn: async () => {
      setError(null)
      const { error: err } = await supabase
        .from('customers')
        .update({ record_status: 'complete' })
        .eq('id', customer.id)
      if (err) throw err
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customer', customer.id] })
      void queryClient.invalidateQueries({ queryKey: ['customer-overview', customer.id] })
    },
    onError: (err) => setError(describeError(err)),
  })

  if (profile.isLoading) return <Spinner />
  const p = profile.data

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}
      {saved && <Alert tone="success">Dados salvos.</Alert>}

      <div className="grid grid-cols-12 gap-3">
        <Field
          label={isCompany ? 'Razão social' : 'Nome completo'}
          required
          className="col-span-12 sm:col-span-8"
        >
          <Input
            value={value('display_name', customer.display_name)}
            onChange={(e) => set('display_name', e.target.value)}
          />
        </Field>

        <Field label={isCompany ? 'CNPJ' : 'CPF'} className="col-span-12 sm:col-span-4">
          <Input
            value={
              isCompany
                ? value('cnpj', p && 'cnpj' in p ? p.cnpj : '')
                : value('cpf', p && 'cpf' in p ? p.cpf : '')
            }
            onChange={(e) => set(isCompany ? 'cnpj' : 'cpf', e.target.value)}
            inputMode="numeric"
          />
        </Field>

        {isCompany ? (
          <>
            <Field label="Nome fantasia" className="col-span-12 sm:col-span-6">
              <Input
                value={value('trade_name', p && 'trade_name' in p ? p.trade_name : '')}
                onChange={(e) => set('trade_name', e.target.value)}
              />
            </Field>
            <Field
              label="Inscrição estadual"
              className="col-span-12 sm:col-span-3"
              hint="Deixe vazio se for isenta."
            >
              <Input
                value={value('state_registration', p && 'state_registration' in p ? p.state_registration : '')}
                onChange={(e) => set('state_registration', e.target.value)}
              />
            </Field>
            <Field label="Inscrição municipal" className="col-span-12 sm:col-span-3">
              <Input
                value={value('municipal_registration', p && 'municipal_registration' in p ? p.municipal_registration : '')}
                onChange={(e) => set('municipal_registration', e.target.value)}
              />
            </Field>
            <Field label="Regime tributário" className="col-span-12 sm:col-span-6">
              <Select
                value={value('tax_regime', p && 'tax_regime' in p ? p.tax_regime : '')}
                onChange={(e) => set('tax_regime', e.target.value)}
              >
                <option value="">—</option>
                <option value="simples_nacional">Simples Nacional</option>
                <option value="lucro_presumido">Lucro presumido</option>
                <option value="lucro_real">Lucro real</option>
                <option value="mei">MEI</option>
                <option value="imune">Imune</option>
                <option value="isento">Isento</option>
              </Select>
            </Field>
          </>
        ) : (
          <>
            <Field label="Nascimento" className="col-span-12 sm:col-span-4">
              <Input
                type="date"
                value={value('birth_date', p && 'birth_date' in p ? p.birth_date : '')}
                onChange={(e) => set('birth_date', e.target.value)}
              />
            </Field>
            <Field label="RG" className="col-span-12 sm:col-span-4">
              <Input
                value={value('national_id', p && 'national_id' in p ? p.national_id : '')}
                onChange={(e) => set('national_id', e.target.value)}
              />
            </Field>
            <Field label="Gênero" className="col-span-12 sm:col-span-4">
              <Select
                value={value('gender', p && 'gender' in p ? p.gender : '')}
                onChange={(e) => set('gender', e.target.value)}
              >
                <option value="">—</option>
                <option value="female">Feminino</option>
                <option value="male">Masculino</option>
                <option value="other">Outro</option>
                <option value="undisclosed">Prefere não informar</option>
              </Select>
            </Field>
            <Field label="Profissão" className="col-span-12 sm:col-span-6">
              <Select
                value={value('profession_entry_id', p && 'profession_entry_id' in p ? p.profession_entry_id : '')}
                onChange={(e) => set('profession_entry_id', e.target.value)}
              >
                <option value="">—</option>
                {professions.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Estado civil" className="col-span-12 sm:col-span-6">
              <Select
                value={value('marital_status_entry_id', p && 'marital_status_entry_id' in p ? p.marital_status_entry_id : '')}
                onChange={(e) => set('marital_status_entry_id', e.target.value)}
              >
                <option value="">—</option>
                {maritalStatuses.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}

        <Field label="Observações" className="col-span-12">
          <Input value={value('notes', customer.notes)} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
        {customer.record_status === 'quick' && (
          <Button
            variant="secondary"
            onClick={() => promote.mutate()}
            disabled={promote.isPending}
          >
            Marcar cadastro como completo
          </Button>
        )}
      </div>
    </div>
  )
}
