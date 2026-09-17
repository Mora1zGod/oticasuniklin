import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppContext } from '@/auth/SessionProvider'
import { CrudPage } from '@/components/CrudPage'
import { DataTable } from '@/components/DataTable'
import { Modal } from '@/components/ui/Modal'
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  PageHeader,
  Select,
} from '@/components/ui/primitives'
import { Spinner } from '@/components/ui/Spinner'
import { describeError } from '@/lib/errors'
import { formatDate, formatDateTime } from '@/lib/format'

export function CompanyPage() {
  const ctx = useAppContext()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})

  const tenant = useQuery({
    queryKey: ['tenant', ctx.tenant_id],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', ctx.tenant_id)
        .single()
      if (err) throw err
      return data
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      setError(null)
      const { error: err } = await supabase
        .from('tenants')
        .update({
          trade_name: form['trade_name'] ?? tenant.data?.trade_name ?? '',
          legal_name: form['legal_name'] ?? tenant.data?.legal_name ?? '',
          tax_document: form['tax_document'] ?? tenant.data?.tax_document ?? null,
        })
        .eq('id', ctx.tenant_id)
      if (err) throw err
    },
    onSuccess: () => {
      setSaved(true)
      void queryClient.invalidateQueries({ queryKey: ['tenant'] })
    },
    onError: (err) => setError(describeError(err)),
  })

  if (tenant.isLoading) return <Spinner />
  const value = (key: keyof NonNullable<typeof tenant.data>) =>
    form[key] ?? String(tenant.data?.[key] ?? '')

  return (
    <>
      <PageHeader title="Empresa" subtitle="Dados da rede que contrata o sistema." />
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {saved && (
        <div className="mb-4">
          <Alert tone="success">Dados salvos.</Alert>
        </div>
      )}
      <Card>
        <div className="grid grid-cols-12 gap-3">
          <Field label="Nome fantasia" required className="col-span-12 sm:col-span-6">
            <Input
              value={value('trade_name')}
              onChange={(e) => {
                setForm({ ...form, trade_name: e.target.value })
                setSaved(false)
              }}
            />
          </Field>
          <Field label="Razão social" className="col-span-12 sm:col-span-6">
            <Input
              value={value('legal_name')}
              onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
            />
          </Field>
          <Field label="CNPJ" className="col-span-12 sm:col-span-4">
            <Input
              value={value('tax_document')}
              onChange={(e) => setForm({ ...form, tax_document: e.target.value })}
            />
          </Field>
          <Field label="Identificador" className="col-span-12 sm:col-span-4">
            <Input value={tenant.data?.slug ?? ''} disabled />
          </Field>
          <Field label="Plano" className="col-span-12 sm:col-span-4">
            <Input value={tenant.data?.plan_code ?? ''} disabled />
          </Field>
        </div>
        <div className="mt-4">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Salvar
          </Button>
        </div>
      </Card>
    </>
  )
}

export function BranchesPage() {
  return (
    <CrudPage
      table="branches"
      title="Filiais"
      singular="filial"
      subtitle="O cliente é da rede; a filial é onde a operação acontece."
      searchColumn="trade_name"
      orderBy={{ column: 'trade_name', ascending: true }}
      columns={[
        { key: 'name', header: 'Filial', render: (r) => r.trade_name },
        { key: 'code', header: 'Código', render: (r) => r.code },
        { key: 'doc', header: 'CNPJ', render: (r) => r.tax_document ?? '—' },
        {
          key: 'city',
          header: 'Cidade',
          render: (r) => [r.city, r.state_code].filter(Boolean).join(' / ') || '—',
        },
        {
          key: 'active',
          header: '',
          render: (r) => (r.is_active ? null : <Badge tone="warning">inativa</Badge>),
        },
      ]}
      fields={[
        { name: 'code', label: 'Código', required: true, span: 3 },
        { name: 'trade_name', label: 'Nome fantasia', required: true, span: 9 },
        { name: 'legal_name', label: 'Razão social', required: true, span: 8 },
        { name: 'tax_document', label: 'CNPJ', span: 4 },
        { name: 'phone', label: 'Telefone', span: 4 },
        { name: 'email', label: 'E-mail', type: 'email', span: 4 },
        { name: 'zip_code', label: 'CEP', span: 4 },
        { name: 'street', label: 'Logradouro', span: 8 },
        { name: 'street_number', label: 'Número', span: 4 },
        { name: 'district', label: 'Bairro', span: 6 },
        { name: 'city', label: 'Cidade', span: 4 },
        { name: 'state_code', label: 'UF', span: 2 },
        { name: 'is_active', label: 'Ativa', type: 'checkbox', span: 6, defaultValue: true },
      ]}
    />
  )
}

export function UsersPage() {
  const ctx = useAppContext()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState({
    email: '',
    full_name: '',
    role_id: '',
    branch_ids: [] as string[],
    is_salesperson: false,
  })

  const users = useQuery({
    queryKey: ['app-users', ctx.tenant_id],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('app_users')
        .select('*, user_branch_access(branch_id, roles(code, label), branches(trade_name))')
        .is('deleted_at', null)
        .order('full_name')
      if (err) throw err
      return data ?? []
    },
  })

  const invitations = useQuery({
    queryKey: ['user-invitations', ctx.tenant_id],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('user_invitations')
        .select('*, roles(label)')
        .is('accepted_at', null)
        .order('created_at', { ascending: false })
      if (err) throw err
      return data ?? []
    },
  })

  const roles = useQuery({
    queryKey: ['roles', ctx.tenant_id],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('roles')
        .select('id, code, label')
        .order('label')
      if (err) throw err
      return data ?? []
    },
  })

  /**
   * Convite: o acesso é criado no signup pelo trigger on_auth_user_created
   * (migration 0010) — não existe criação manual de usuário por aqui.
   */
  const send = useMutation({
    mutationFn: async () => {
      setError(null)
      if (!invite.email.trim()) throw new Error('Informe o e-mail.')
      if (!invite.role_id) throw new Error('Escolha o papel.')
      if (invite.branch_ids.length === 0) throw new Error('Escolha ao menos uma filial.')

      const { error: err } = await supabase.from('user_invitations').insert({
        tenant_id: ctx.tenant_id,
        email: invite.email.trim(),
        full_name: invite.full_name || null,
        role_id: invite.role_id,
        branch_ids: invite.branch_ids,
        is_salesperson: invite.is_salesperson,
        invited_by: ctx.app_user_id,
      })
      if (err) throw err
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-invitations'] })
      setOpen(false)
      setInvite({ email: '', full_name: '', role_id: '', branch_ids: [], is_salesperson: false })
    },
    onError: (err) => setError(describeError(err)),
  })

  const cancelInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error: err } = await supabase.from('user_invitations').delete().eq('id', id)
      if (err) throw err
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['user-invitations'] }),
    onError: (err) => setError(describeError(err)),
  })

  return (
    <>
      <PageHeader
        title="Usuários e convites"
        subtitle="Convide pelo e-mail: ao se cadastrar, a pessoa já entra com papel e filial."
        actions={<Button onClick={() => setOpen(true)}>+ Convidar</Button>}
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="space-y-4">
        <Card title="Equipe" bodyClassName="p-0">
          <DataTable
            rows={users.data}
            loading={users.isLoading}
            rowKey={(row) => row.id}
            emptyTitle="Nenhum usuário"
            columns={[
              { key: 'name', header: 'Nome', render: (r) => r.full_name },
              { key: 'email', header: 'E-mail', render: (r) => r.email },
              {
                key: 'branches',
                header: 'Filiais',
                render: (r) => (
                  <div className="flex flex-wrap gap-1">
                    {r.user_branch_access.map((a) => (
                      <Badge key={a.branch_id}>
                        {a.branches?.trade_name} · {a.roles?.label}
                      </Badge>
                    ))}
                  </div>
                ),
              },
              {
                key: 'flags',
                header: '',
                render: (r) => (
                  <div className="flex gap-1">
                    {r.is_tenant_admin && <Badge tone="info">admin</Badge>}
                    {r.is_salesperson && <Badge>vendedor</Badge>}
                    {!r.is_active && <Badge tone="warning">inativo</Badge>}
                  </div>
                ),
              },
            ]}
          />
        </Card>

        <Card title="Convites pendentes" bodyClassName="p-0">
          <DataTable
            rows={invitations.data}
            loading={invitations.isLoading}
            rowKey={(row) => row.id}
            emptyTitle="Nenhum convite pendente"
            columns={[
              { key: 'email', header: 'E-mail', render: (r) => r.email },
              { key: 'name', header: 'Nome', render: (r) => r.full_name ?? '—' },
              { key: 'role', header: 'Papel', render: (r) => r.roles?.label ?? '—' },
              { key: 'sent', header: 'Enviado', render: (r) => formatDateTime(r.created_at) },
              { key: 'expires', header: 'Expira', render: (r) => formatDate(r.expires_at) },
              {
                key: 'actions',
                header: '',
                numeric: true,
                render: (r) => (
                  <Button variant="ghost" size="sm" onClick={() => cancelInvite.mutate(r.id)}>
                    Cancelar
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      </div>

      <Modal
        open={open}
        title="Convidar para a equipe"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => send.mutate()} disabled={send.isPending}>
              Enviar convite
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="E-mail" required hint="Precisa ser o mesmo e-mail do cadastro.">
            <Input
              type="email"
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })}
            />
          </Field>
          <Field label="Nome">
            <Input
              value={invite.full_name}
              onChange={(e) => setInvite({ ...invite, full_name: e.target.value })}
            />
          </Field>
          <Field label="Papel" required>
            <Select
              value={invite.role_id}
              onChange={(e) => setInvite({ ...invite, role_id: e.target.value })}
            >
              <option value="">—</option>
              {roles.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-700">Filiais</p>
            <div className="space-y-1">
              {ctx.branches.map((b) => (
                <Checkbox
                  key={b.id}
                  label={b.trade_name}
                  checked={invite.branch_ids.includes(b.id)}
                  onChange={(e) =>
                    setInvite({
                      ...invite,
                      branch_ids: e.target.checked
                        ? [...invite.branch_ids, b.id]
                        : invite.branch_ids.filter((id) => id !== b.id),
                    })
                  }
                />
              ))}
            </div>
          </div>
          <Checkbox
            label="Pode ser atribuído como vendedor (comissão)"
            checked={invite.is_salesperson}
            onChange={(e) => setInvite({ ...invite, is_salesperson: e.target.checked })}
          />
        </div>
      </Modal>
    </>
  )
}

export function RolesPage() {
  const ctx = useAppContext()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const roles = useQuery({
    queryKey: ['roles-detail', ctx.tenant_id],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('roles')
        .select('*, role_permissions(permission_code)')
        .order('label')
      if (err) throw err
      return data ?? []
    },
  })

  const permissions = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('permissions')
        .select('*')
        .order('module')
      if (err) throw err
      return data ?? []
    },
  })

  const toggle = useMutation({
    mutationFn: async ({
      roleId,
      code,
      enabled,
    }: {
      roleId: string
      code: string
      enabled: boolean
    }) => {
      setError(null)
      if (enabled) {
        const { error: err } = await supabase
          .from('role_permissions')
          .insert({ role_id: roleId, permission_code: code })
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', roleId)
          .eq('permission_code', code)
        if (err) throw err
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['roles-detail'] }),
    onError: (err) => setError(describeError(err)),
  })

  if (roles.isLoading || permissions.isLoading) return <Spinner />

  const modules = [...new Set((permissions.data ?? []).map((p) => p.module))]

  return (
    <>
      <PageHeader
        title="Papéis e permissões"
        subtitle="As permissões efetivas alimentam a RLS do banco, não só a interface."
      />
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="space-y-4">
        {roles.data?.map((role) => {
          const granted = new Set(role.role_permissions.map((p) => p.permission_code))
          return (
            <Card key={role.id} title={role.label}>
              {modules.map((module) => (
                <div key={module} className="mb-3">
                  <p className="mb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                    {module}
                  </p>
                  <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {permissions.data
                      ?.filter((p) => p.module === module)
                      .map((p) => (
                        <Checkbox
                          key={p.code}
                          label={p.label}
                          checked={granted.has(p.code)}
                          onChange={(e) =>
                            toggle.mutate({
                              roleId: role.id,
                              code: p.code,
                              enabled: e.target.checked,
                            })
                          }
                        />
                      ))}
                  </div>
                </div>
              ))}
            </Card>
          )
        })}
      </div>
    </>
  )
}

export function CatalogsPage() {
  const ctx = useAppContext()
  const [catalogKey, setCatalogKey] = useState('customer_origin')

  const definitions = useQuery({
    queryKey: ['catalog-definitions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catalog_definitions')
        .select('*')
        .order('label')
      if (error) throw error
      return data ?? []
    },
  })

  return (
    <>
      <PageHeader
        title="Listas configuráveis"
        subtitle="Listas descritivas sem comportamento. Itens da plataforma aparecem para todos; os seus ficam por cima."
      />

      <div className="mb-4 max-w-md">
        <Field label="Lista">
          <Select value={catalogKey} onChange={(e) => setCatalogKey(e.target.value)}>
            {definitions.data?.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <CrudPage
        key={catalogKey}
        table="catalog_entries"
        title={definitions.data?.find((d) => d.key === catalogKey)?.label ?? 'Lista'}
        singular="item"
        filter={{ catalog_key: catalogKey }}
        orderBy={{ column: 'sort_order', ascending: true }}
        columns={[
          { key: 'label', header: 'Item', render: (r) => r.label },
          { key: 'code', header: 'Código', render: (r) => r.code },
          { key: 'order', header: 'Ordem', numeric: true, render: (r) => r.sort_order },
          {
            key: 'scope',
            header: '',
            render: (r) =>
              r.tenant_id === null ? (
                <Badge>plataforma</Badge>
              ) : (
                <Badge tone="info">{ctx.tenant.trade_name}</Badge>
              ),
          },
        ]}
        fields={[
          { name: 'catalog_key', label: 'Lista', span: 6, defaultValue: catalogKey },
          { name: 'code', label: 'Código', required: true, span: 6 },
          { name: 'label', label: 'Rótulo', required: true, span: 8 },
          { name: 'sort_order', label: 'Ordem', type: 'number', span: 4, defaultValue: 10 },
          { name: 'is_active', label: 'Ativo', type: 'checkbox', span: 6, defaultValue: true },
        ]}
      />
    </>
  )
}

export function CustomerCommunicationsPage() {
  const list = useQuery({
    queryKey: ['communications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_communications')
        .select('*, customers(display_name)')
        .order('occurred_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data ?? []
    },
  })

  return (
    <>
      <PageHeader
        title="Comunicações"
        subtitle="Mensagens enviadas ao cliente, incluindo os avisos automáticos de O.S. pronta."
      />
      <Card bodyClassName="p-0">
        <DataTable
          rows={list.data}
          loading={list.isLoading}
          rowKey={(row) => row.id}
          emptyTitle="Nenhuma comunicação registrada"
          columns={[
            { key: 'when', header: 'Quando', render: (r) => formatDateTime(r.occurred_at) },
            { key: 'customer', header: 'Cliente', render: (r) => r.customers?.display_name ?? '—' },
            { key: 'channel', header: 'Canal', render: (r) => <Badge>{r.channel}</Badge> },
            { key: 'subject', header: 'Assunto', render: (r) => r.subject ?? '—' },
            { key: 'body', header: 'Mensagem', render: (r) => r.body ?? '—' },
          ]}
        />
      </Card>
    </>
  )
}
