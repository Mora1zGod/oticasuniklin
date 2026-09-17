import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppContext, useBranchId } from '@/auth/SessionProvider'
import { Modal } from '@/components/ui/Modal'
import { Alert, Button, Field, Input, Select } from '@/components/ui/primitives'
import { describeError } from '@/lib/errors'
import { digitsOnly, isValidCnpj, isValidCpf } from '@/lib/format'
import { useCatalog } from '@/hooks/useCatalog'

type PartyType = 'individual' | 'company'

/**
 * Cadastro rápido (ADR-006): grava nas MESMAS tabelas e passa pelas MESMAS
 * validações do cadastro completo — muda só o nível exigido agora
 * (`record_status = 'quick'`). O que faltar aparece como pendência na ficha.
 */
export function CustomerQuickCreate({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated?: (customerId: string) => void
}) {
  const ctx = useAppContext()
  const branchId = useBranchId()
  const queryClient = useQueryClient()
  const origins = useCatalog('customer_origin')

  const [partyType, setPartyType] = useState<PartyType>('individual')
  const [name, setName] = useState('')
  const [document, setDocument] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [originId, setOriginId] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPartyType('individual')
    setName('')
    setDocument('')
    setPhone('')
    setEmail('')
    setBirthDate('')
    setOriginId('')
    setError(null)
  }, [open])

  const create = useMutation({
    mutationFn: async () => {
      const doc = digitsOnly(document)
      if (doc && partyType === 'individual' && !isValidCpf(doc)) throw new Error('CPF inválido.')
      if (doc && partyType === 'company' && !isValidCnpj(doc)) throw new Error('CNPJ inválido.')
      if (!phone.trim() && !email.trim()) {
        throw new Error('Informe ao menos um contato (telefone ou e-mail).')
      }

      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
          tenant_id: ctx.tenant_id,
          party_type: partyType,
          display_name: name.trim(),
          record_status: 'quick',
          created_at_branch_id: branchId,
          preferred_branch_id: branchId,
          origin_entry_id: originId || null,
          created_by: ctx.app_user_id,
        })
        .select('id')
        .single()
      if (customerError) throw customerError

      const customerId = customer.id

      if (partyType === 'individual') {
        const { error: err } = await supabase.from('individual_profiles').insert({
          customer_id: customerId,
          tenant_id: ctx.tenant_id,
          cpf: doc || null,
          birth_date: birthDate || null,
        })
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('company_profiles').insert({
          customer_id: customerId,
          tenant_id: ctx.tenant_id,
          cnpj: doc || null,
          legal_name: name.trim(),
        })
        if (err) throw err
      }

      const contacts = []
      if (phone.trim()) {
        contacts.push({
          customer_id: customerId,
          tenant_id: ctx.tenant_id,
          kind: 'whatsapp' as const,
          value: phone.trim(),
          is_primary: true,
        })
      }
      if (email.trim()) {
        contacts.push({
          customer_id: customerId,
          tenant_id: ctx.tenant_id,
          kind: 'email' as const,
          value: email.trim(),
          is_primary: true,
        })
      }
      if (contacts.length > 0) {
        const { error: err } = await supabase.from('customer_contacts').insert(contacts)
        if (err) throw err
      }

      // Perfil na filial: vendedor preferencial é por unidade (ADR-008).
      await supabase.from('customer_branch_profiles').insert({
        customer_id: customerId,
        tenant_id: ctx.tenant_id,
        branch_id: branchId,
        preferred_salesperson_id: ctx.is_salesperson ? ctx.app_user_id : null,
        first_interaction_at: new Date().toISOString(),
      })

      return customerId
    },
    onSuccess: (customerId) => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
      onClose()
      onCreated?.(customerId)
    },
    onError: (err) => setError(describeError(err)),
  })

  return (
    <Modal
      open={open}
      title="Novo cliente"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !name.trim()}>
            {create.isPending ? 'Salvando…' : 'Salvar e abrir ficha'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mb-4 flex gap-2">
        {(['individual', 'company'] as const).map((type) => (
          <Button
            key={type}
            size="sm"
            variant={partyType === type ? 'primary' : 'secondary'}
            onClick={() => setPartyType(type)}
          >
            {type === 'individual' ? 'Pessoa física' : 'Pessoa jurídica'}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-3">
        <Field
          label={partyType === 'individual' ? 'Nome completo' : 'Razão social'}
          required
          className="col-span-12"
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>

        <Field
          label={partyType === 'individual' ? 'CPF' : 'CNPJ'}
          className="col-span-12 sm:col-span-6"
          hint="Pode ficar para depois — o cadastro fica marcado como incompleto."
        >
          <Input
            value={document}
            onChange={(e) => setDocument(e.target.value)}
            inputMode="numeric"
          />
        </Field>

        {partyType === 'individual' && (
          <Field label="Nascimento" className="col-span-12 sm:col-span-6">
            <Input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </Field>
        )}

        <Field label="WhatsApp / Telefone" className="col-span-12 sm:col-span-6" required>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(68) 99999-0000"
          />
        </Field>

        <Field label="E-mail" className="col-span-12 sm:col-span-6">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>

        <Field label="Como chegou até a ótica" className="col-span-12">
          <Select value={originId} onChange={(e) => setOriginId(e.target.value)}>
            <option value="">—</option>
            {origins.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}
