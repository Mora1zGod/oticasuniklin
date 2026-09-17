import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { DataTable } from '@/components/DataTable'
import { Modal } from '@/components/ui/Modal'
import { Alert, Badge, Button, Card, Field, Input, Select } from '@/components/ui/primitives'
import { describeError } from '@/lib/errors'
import { formatPhone } from '@/lib/format'

const CONTACT_KINDS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'mobile', label: 'Celular' },
  { value: 'landline', label: 'Telefone fixo' },
  { value: 'email', label: 'E-mail' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'other', label: 'Outro' },
] as const

const ADDRESS_KINDS = [
  { value: 'residential', label: 'Residencial' },
  { value: 'commercial', label: 'Comercial' },
  { value: 'billing', label: 'Cobrança' },
  { value: 'delivery', label: 'Entrega' },
  { value: 'other', label: 'Outro' },
] as const

type ContactKind = (typeof CONTACT_KINDS)[number]['value']
type AddressKind = (typeof ADDRESS_KINDS)[number]['value']

export function CustomerContactsTab({
  customerId,
  tenantId,
}: {
  customerId: string
  tenantId: string
}) {
  const queryClient = useQueryClient()
  const [contactOpen, setContactOpen] = useState(false)
  const [addressOpen, setAddressOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [contact, setContact] = useState({
    kind: 'whatsapp' as ContactKind,
    value: '',
    is_primary: false,
  })
  const [address, setAddress] = useState({
    kind: 'residential' as AddressKind,
    zip_code: '',
    street: '',
    street_number: '',
    complement: '',
    district: '',
    city: '',
    state_code: '',
  })

  const contacts = useQuery({
    queryKey: ['customer-contacts', customerId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('customer_contacts')
        .select('*')
        .eq('customer_id', customerId)
        .is('deleted_at', null)
        .order('is_primary', { ascending: false })
      if (err) throw err
      return data ?? []
    },
  })

  const addresses = useQuery({
    queryKey: ['customer-addresses', customerId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('customer_id', customerId)
        .is('deleted_at', null)
        .order('is_primary', { ascending: false })
      if (err) throw err
      return data ?? []
    },
  })

  const saveContact = useMutation({
    mutationFn: async () => {
      setError(null)
      if (!contact.value.trim()) throw new Error('Informe o contato.')
      const { error: err } = await supabase.from('customer_contacts').insert({
        customer_id: customerId,
        tenant_id: tenantId,
        kind: contact.kind,
        value: contact.value.trim(),
        is_primary: contact.is_primary,
      })
      if (err) throw err
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customer-contacts', customerId] })
      void queryClient.invalidateQueries({ queryKey: ['customer-overview', customerId] })
      setContactOpen(false)
      setContact({ kind: 'whatsapp', value: '', is_primary: false })
    },
    onError: (err) => setError(describeError(err)),
  })

  const saveAddress = useMutation({
    mutationFn: async () => {
      setError(null)
      if (!address.street.trim()) throw new Error('Informe o logradouro.')
      const { error: err } = await supabase.from('customer_addresses').insert({
        customer_id: customerId,
        tenant_id: tenantId,
        kind: address.kind,
        zip_code: address.zip_code || null,
        street: address.street,
        street_number: address.street_number || null,
        complement: address.complement || null,
        district: address.district || null,
        city: address.city || null,
        state_code: address.state_code ? address.state_code.toUpperCase().slice(0, 2) : null,
        is_primary: (addresses.data?.length ?? 0) === 0,
      })
      if (err) throw err
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customer-addresses', customerId] })
      void queryClient.invalidateQueries({ queryKey: ['customer-overview', customerId] })
      setAddressOpen(false)
      setAddress({
        kind: 'residential',
        zip_code: '',
        street: '',
        street_number: '',
        complement: '',
        district: '',
        city: '',
        state_code: '',
      })
    },
    onError: (err) => setError(describeError(err)),
  })

  const remove = useMutation({
    mutationFn: async ({ table, id }: { table: 'contacts' | 'addresses'; id: string }) => {
      const target = table === 'contacts' ? 'customer_contacts' : 'customer_addresses'
      const { error: err } = await supabase
        .from(target)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (err) throw err
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customer-contacts', customerId] })
      void queryClient.invalidateQueries({ queryKey: ['customer-addresses', customerId] })
      void queryClient.invalidateQueries({ queryKey: ['customer-overview', customerId] })
    },
    onError: (err) => setError(describeError(err)),
  })

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <Card
        title="Contatos"
        bodyClassName="p-0"
        actions={
          <Button size="sm" onClick={() => setContactOpen(true)}>
            + Contato
          </Button>
        }
      >
        <DataTable
          rows={contacts.data}
          loading={contacts.isLoading}
          rowKey={(row) => row.id}
          emptyTitle="Nenhum contato"
          columns={[
            {
              key: 'kind',
              header: 'Tipo',
              render: (row) =>
                CONTACT_KINDS.find((k) => k.value === row.kind)?.label ?? row.kind,
            },
            {
              key: 'value',
              header: 'Contato',
              render: (row) =>
                row.kind === 'email' ? row.value : formatPhone(row.value),
            },
            {
              key: 'primary',
              header: '',
              render: (row) => (row.is_primary ? <Badge tone="info">Principal</Badge> : null),
            },
            {
              key: 'actions',
              header: '',
              numeric: true,
              render: (row) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove.mutate({ table: 'contacts', id: row.id })}
                >
                  Remover
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Card
        title="Endereços"
        bodyClassName="p-0"
        actions={
          <Button size="sm" onClick={() => setAddressOpen(true)}>
            + Endereço
          </Button>
        }
      >
        <DataTable
          rows={addresses.data}
          loading={addresses.isLoading}
          rowKey={(row) => row.id}
          emptyTitle="Nenhum endereço"
          columns={[
            {
              key: 'kind',
              header: 'Tipo',
              render: (row) =>
                ADDRESS_KINDS.find((k) => k.value === row.kind)?.label ?? row.kind,
            },
            {
              key: 'address',
              header: 'Endereço',
              render: (row) =>
                [row.street, row.street_number, row.district].filter(Boolean).join(', '),
            },
            {
              key: 'city',
              header: 'Cidade',
              render: (row) => [row.city, row.state_code].filter(Boolean).join(' / '),
            },
            {
              key: 'zip',
              header: 'CEP',
              render: (row) => row.zip_code ?? '—',
            },
            {
              key: 'actions',
              header: '',
              numeric: true,
              render: (row) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove.mutate({ table: 'addresses', id: row.id })}
                >
                  Remover
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={contactOpen}
        title="Novo contato"
        onClose={() => setContactOpen(false)}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setContactOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveContact.mutate()} disabled={saveContact.isPending}>
              Salvar
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Tipo">
            <Select
              value={contact.kind}
              onChange={(e) =>
                setContact({ ...contact, kind: e.target.value as ContactKind })
              }
            >
              {CONTACT_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Contato" required>
            <Input
              value={contact.value}
              onChange={(e) => setContact({ ...contact, value: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="size-4 rounded border-slate-300 text-brand-600"
              checked={contact.is_primary}
              onChange={(e) => setContact({ ...contact, is_primary: e.target.checked })}
            />
            Contato principal deste tipo
          </label>
        </div>
      </Modal>

      <Modal
        open={addressOpen}
        title="Novo endereço"
        onClose={() => setAddressOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddressOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveAddress.mutate()} disabled={saveAddress.isPending}>
              Salvar
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-12 gap-3">
          <Field label="Tipo" className="col-span-12 sm:col-span-4">
            <Select
              value={address.kind}
              onChange={(e) =>
                setAddress({ ...address, kind: e.target.value as AddressKind })
              }
            >
              {ADDRESS_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="CEP" className="col-span-12 sm:col-span-4">
            <Input
              value={address.zip_code}
              onChange={(e) => setAddress({ ...address, zip_code: e.target.value })}
              inputMode="numeric"
            />
          </Field>
          <Field label="Logradouro" required className="col-span-12 sm:col-span-8">
            <Input
              value={address.street}
              onChange={(e) => setAddress({ ...address, street: e.target.value })}
            />
          </Field>
          <Field label="Número" className="col-span-12 sm:col-span-4">
            <Input
              value={address.street_number}
              onChange={(e) => setAddress({ ...address, street_number: e.target.value })}
            />
          </Field>
          <Field label="Complemento" className="col-span-12 sm:col-span-6">
            <Input
              value={address.complement}
              onChange={(e) => setAddress({ ...address, complement: e.target.value })}
            />
          </Field>
          <Field label="Bairro" className="col-span-12 sm:col-span-6">
            <Input
              value={address.district}
              onChange={(e) => setAddress({ ...address, district: e.target.value })}
            />
          </Field>
          <Field label="Cidade" className="col-span-12 sm:col-span-8">
            <Input
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
            />
          </Field>
          <Field label="UF" className="col-span-12 sm:col-span-4">
            <Input
              value={address.state_code}
              maxLength={2}
              onChange={(e) => setAddress({ ...address, state_code: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
