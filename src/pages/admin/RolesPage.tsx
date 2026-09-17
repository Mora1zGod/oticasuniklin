import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppContext } from '@/auth/SessionProvider'
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
  SearchInput,
  cx,
} from '@/components/ui/primitives'
import { Spinner } from '@/components/ui/Spinner'
import { StatTile } from '@/components/ui/StatTile'
import {
  IconBox,
  IconCart,
  IconChevronDown,
  IconClock,
  IconFile,
  IconGlasses,
  IconMoney,
  IconPlus,
  IconSettings,
  IconShield,
  IconUsers,
  IconWrench,
} from '@/components/ui/icons'
import { describeError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'

/**
 * Papéis e permissões.
 *
 * O que se marca aqui não é enfeite de interface: a permissão efetiva alimenta
 * a RLS do banco. Por isso a tela mostra o papel inteiro de uma vez — quantas
 * permissões tem, quem o usa e o que ele alcança — em vez de esconder o efeito
 * atrás de uma lista de caixinhas.
 *
 * Marcar e desmarcar grava na hora: um papel meio salvo é um papel que dá acesso
 * a algo que ninguém revisou.
 */

/** Ícone e nome de cada área de permissão, na ordem em que o domínio acontece. */
const MODULES: { id: string; label: string; detail: string; icon: typeof IconUsers }[] = [
  { id: 'clientes', label: 'Clientes', detail: 'Cadastro e consentimentos.', icon: IconUsers },
  { id: 'optica', label: 'Óptica', detail: 'Receitas e dados clínicos.', icon: IconGlasses },
  { id: 'comercial', label: 'Comercial', detail: 'Vendas, orçamentos e descontos.', icon: IconCart },
  { id: 'producao', label: 'Produção', detail: 'Ordens de serviço e laboratório.', icon: IconWrench },
  { id: 'produtos', label: 'Produtos', detail: 'Produtos, marcas e preços.', icon: IconFile },
  { id: 'estoque', label: 'Estoque', detail: 'Saldos e movimentações.', icon: IconBox },
  { id: 'financeiro', label: 'Financeiro', detail: 'Contas, baixas e comissões.', icon: IconMoney },
  { id: 'administracao', label: 'Administração', detail: 'Configurações gerais do sistema.', icon: IconSettings },
]

export function RolesPage() {
  const ctx = useAppContext()
  const queryClient = useQueryClient()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [term, setTerm] = useState('')
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({})
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState<{ id: string; label: string } | null>(null)
  const [draft, setDraft] = useState({ code: '', label: '' })
  const [error, setError] = useState<string | null>(null)

  const roles = useQuery({
    queryKey: ['roles-detail', ctx.tenant_id],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('roles')
        .select('id,code,label,is_system,tenant_id,created_at,role_permissions(permission_code)')
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
        .select('code,label,module')
        .order('code')
      if (err) throw err
      return data ?? []
    },
  })

  /** Quem usa cada papel — o número que impede apagar acesso sem perceber. */
  const usage = useQuery({
    queryKey: ['role-usage', ctx.tenant_id],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('user_branch_access')
        .select('role_id,app_users(id,full_name)')
      if (err) throw err
      const map = new Map<string, { id: string; name: string }[]>()
      for (const row of data ?? []) {
        if (!row.app_users) continue
        const list = map.get(row.role_id) ?? []
        // O mesmo usuário aparece uma vez por filial; aqui interessa a pessoa.
        if (!list.some((person) => person.id === row.app_users!.id)) {
          list.push({ id: row.app_users.id, name: row.app_users.full_name })
        }
        map.set(row.role_id, list)
      }
      return map
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

  const createRole = useMutation({
    mutationFn: async () => {
      setError(null)
      const code = draft.code.trim().toLowerCase().replace(/\s+/g, '_')
      if (!code || !draft.label.trim()) throw new Error('Informe código e nome do papel.')
      const { data, error: err } = await supabase
        .from('roles')
        .insert({ tenant_id: ctx.tenant_id, code, label: draft.label.trim() })
        .select('id')
        .single()
      if (err) throw err
      return data.id
    },
    onSuccess: (id) => {
      setCreating(false)
      setDraft({ code: '', label: '' })
      setSelectedId(id)
      void queryClient.invalidateQueries({ queryKey: ['roles-detail'] })
    },
    onError: (err) => setError(describeError(err)),
  })

  const rename = useMutation({
    mutationFn: async () => {
      setError(null)
      if (!renaming || !renaming.label.trim()) throw new Error('Informe o nome do papel.')
      const { error: err } = await supabase
        .from('roles')
        .update({ label: renaming.label.trim() })
        .eq('id', renaming.id)
      if (err) throw err
    },
    onSuccess: () => {
      setRenaming(null)
      void queryClient.invalidateQueries({ queryKey: ['roles-detail'] })
    },
    onError: (err) => setError(describeError(err)),
  })

  /** Duplicar economiza a parte chata: nasce com as mesmas permissões. */
  const duplicate = useMutation({
    mutationFn: async (roleId: string) => {
      setError(null)
      const source = roles.data?.find((role) => role.id === roleId)
      if (!source) return
      const { data, error: err } = await supabase
        .from('roles')
        .insert({
          tenant_id: ctx.tenant_id,
          code: `${source.code}_copia`,
          label: `${source.label} (cópia)`,
        })
        .select('id')
        .single()
      if (err) throw err

      const codes = source.role_permissions.map((p) => p.permission_code)
      if (codes.length > 0) {
        const { error: permError } = await supabase
          .from('role_permissions')
          .insert(codes.map((code) => ({ role_id: data.id, permission_code: code })))
        if (permError) throw permError
      }
      return data.id
    },
    onSuccess: (id) => {
      if (id) setSelectedId(id)
      void queryClient.invalidateQueries({ queryKey: ['roles-detail'] })
    },
    onError: (err) => setError(describeError(err)),
  })

  const list = roles.data ?? []

  // Sem escolha do usuário, abre o primeiro papel.
  useEffect(() => {
    if (!selectedId && list.length > 0) setSelectedId(list[0]!.id)
  }, [list, selectedId])

  const selected = list.find((role) => role.id === selectedId) ?? null
  const granted = useMemo(
    () => new Set(selected?.role_permissions.map((p) => p.permission_code) ?? []),
    [selected],
  )

  const allPermissions = permissions.data ?? []
  const filtered = list.filter((role) =>
    role.label.toLowerCase().includes(term.trim().toLowerCase()),
  )

  const coverage =
    allPermissions.length === 0
      ? 0
      : Math.round((granted.size / allPermissions.length) * 100)

  const lastChange = list
    .map((role) => role.created_at)
    .sort()
    .at(-1)

  if (roles.isLoading || permissions.isLoading) return <Spinner />

  return (
    <>
      <PageHeader
        title="Papéis e permissões"
        subtitle="Defina o que cada perfil pode ver, editar e executar no sistema."
        actions={
          <Button onClick={() => setCreating(true)}>
            <IconPlus className="size-4" />
            Novo papel
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={IconUsers}
          tone="brand"
          label="Papéis cadastrados"
          value={String(list.length)}
          hint="perfis de acesso no sistema"
        />
        <StatTile
          icon={IconShield}
          tone="success"
          label="Permissões deste papel"
          value={String(granted.size)}
          hint={`de ${allPermissions.length} disponíveis`}
        />
        <StatTile
          icon={IconUsers}
          tone="violet"
          label="Usuários vinculados"
          value={String(
            new Set(
              [...(usage.data?.values() ?? [])].flat().map((person) => person.id),
            ).size,
          )}
          hint="em todos os papéis"
        />
        <StatTile
          icon={IconClock}
          tone="warning"
          label="Papel mais recente"
          value={lastChange ? formatDateTime(lastChange).slice(0, 10) : '—'}
          hint="data de criação"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        {/* ------------------------------ Papéis ------------------------------ */}
        <Card
          title={
            <span className="text-sm font-semibold text-fg">
              Papéis ({filtered.length})
            </span>
          }
          bodyClassName="p-2"
        >
          <div className="mb-2 px-1">
            <SearchInput
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Buscar papel…"
            />
          </div>

          <ul className="space-y-1.5">
            {filtered.map((role) => {
              const people = usage.data?.get(role.id) ?? []
              const active = role.id === selectedId
              return (
                <li key={role.id}>
                  <button
                    onClick={() => setSelectedId(role.id)}
                    className={cx(
                      'w-full rounded-xl border px-3 py-3 text-left transition-colors',
                      active
                        ? 'border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/10'
                        : 'border-line hover:bg-surface-sunken',
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cx(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg',
                          active
                            ? 'bg-brand-600 text-white'
                            : 'bg-surface-sunken text-fg-muted',
                        )}
                      >
                        <IconShield className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="min-w-0 truncate text-sm font-semibold text-fg">
                            {role.label}
                          </p>
                          {role.is_system && (
                            <Badge tone="neutral" className="shrink-0">
                              sistema
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-fg-subtle">
                          {role.role_permissions.length} permiss
                          {role.role_permissions.length === 1 ? 'ão' : 'ões'} ·{' '}
                          {people.length} usuário{people.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
            {filtered.length === 0 && (
              <li className="px-2 py-8 text-center text-xs text-fg-subtle">
                Nenhum papel com esse nome.
              </li>
            )}
          </ul>
        </Card>

        {/* --------------------------- Papel aberto --------------------------- */}
        {selected && (
          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]">
            <Card bodyClassName="p-0">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                    <IconShield className="size-5" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold tracking-tight text-fg">
                        {selected.label}
                      </h2>
                      <Badge tone={coverage === 100 ? 'success' : 'info'} dot>
                        {coverage === 100 ? 'Acesso completo' : `${coverage}% do sistema`}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-fg-subtle">
                      Código <span className="font-mono">{selected.code}</span>
                      {selected.is_system && ' · papel do sistema'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => duplicate.mutate(selected.id)}
                    disabled={duplicate.isPending}
                  >
                    Duplicar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setRenaming({ id: selected.id, label: selected.label })
                    }
                  >
                    Editar nome
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-sm font-semibold text-fg">Permissões do papel</p>
                <button
                  onClick={() => {
                    const allOpen = MODULES.every((module) => openModules[module.id])
                    setOpenModules(
                      Object.fromEntries(
                        MODULES.map((module) => [module.id, !allOpen]),
                      ),
                    )
                  }}
                  className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
                >
                  <IconChevronDown className="size-3.5" />
                  {MODULES.every((module) => openModules[module.id])
                    ? 'Recolher todas'
                    : 'Expandir todas'}
                </button>
              </div>

              <div className="space-y-2 px-4 pb-4">
                {MODULES.map((module) => {
                  const items = allPermissions.filter((p) => p.module === module.id)
                  if (items.length === 0) return null
                  const open = openModules[module.id] ?? false
                  const on = items.filter((p) => granted.has(p.code)).length

                  return (
                    <div
                      key={module.id}
                      className="overflow-hidden rounded-xl border border-line"
                    >
                      <button
                        onClick={() =>
                          setOpenModules((prev) => ({ ...prev, [module.id]: !open }))
                        }
                        aria-expanded={open}
                        className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-surface-sunken"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-fg-muted">
                          <module.icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-fg">
                            {module.label}
                          </span>
                          <span className="block truncate text-xs text-fg-subtle">
                            {module.detail}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-md bg-surface-sunken px-2 py-1 text-[0.6875rem] text-fg-muted">
                          {on}/{items.length}
                        </span>
                        <IconChevronDown
                          className={cx(
                            'size-4 shrink-0 text-fg-subtle transition-transform',
                            !open && '-rotate-90',
                          )}
                        />
                      </button>

                      {open && (
                        <div className="grid gap-1.5 border-t border-line px-3 py-3 sm:grid-cols-2">
                          {items.map((permission) => (
                            <Checkbox
                              key={permission.code}
                              label={permission.label}
                              checked={granted.has(permission.code)}
                              disabled={toggle.isPending}
                              onChange={(event) =>
                                toggle.mutate({
                                  roleId: selected.id,
                                  code: permission.code,
                                  enabled: event.target.checked,
                                })
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>

            <div className="space-y-4">
              <Card
                title={
                  <span className="text-sm font-semibold text-fg">
                    Usuários com este papel ({(usage.data?.get(selected.id) ?? []).length})
                  </span>
                }
              >
                {(usage.data?.get(selected.id) ?? []).length === 0 ? (
                  <p className="py-6 text-center text-xs text-fg-subtle">
                    Ninguém usa este papel ainda.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-3">
                    {(usage.data?.get(selected.id) ?? []).map((person) => (
                      <li
                        key={person.id}
                        className="flex w-16 flex-col items-center gap-1.5 text-center"
                      >
                        <span className="flex size-10 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                          {person.name
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((part) => part[0]?.toUpperCase() ?? '')
                            .join('')}
                        </span>
                        <span className="w-full truncate text-[0.6875rem] text-fg-muted">
                          {person.name.split(/\s+/)[0]}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title={<span className="text-sm font-semibold text-fg">Nível de acesso</span>}>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className="h-full rounded-full bg-brand-600 transition-[width]"
                      style={{ width: `${coverage}%` }}
                    />
                  </div>
                  <span className="tnum shrink-0 text-sm font-semibold text-fg">
                    {coverage}%
                  </span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-fg-subtle">
                  {coverage === 100
                    ? 'Este papel alcança todas as funcionalidades do sistema.'
                    : `Este papel alcança ${granted.size} das ${allPermissions.length} permissões existentes.`}
                </p>
              </Card>

              <Card title={<span className="text-sm font-semibold text-fg">Como isso vale</span>}>
                <p className="text-xs leading-relaxed text-fg-subtle">
                  A permissão marcada aqui não esconde só o botão: ela vale no banco, pela
                  RLS. O que o papel não alcança, o sistema recusa mesmo que alguém chame
                  a API direto — e a mudança passa a valer no próximo carregamento da
                  sessão de quem tem o papel.
                </p>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------- Modais ------------------------------- */}
      <Modal
        open={creating}
        title="Novo papel"
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button onClick={() => createRole.mutate()} disabled={createRole.isPending}>
              {createRole.isPending ? 'Criando…' : 'Criar papel'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Nome" required hint="É o que aparece para quem administra.">
            <Input
              value={draft.label}
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
              placeholder="Vendedor do balcão"
            />
          </Field>
          <Field
            label="Código"
            required
            hint="Identificador interno, sem espaços nem acento."
          >
            <Input
              value={draft.code}
              onChange={(event) => setDraft({ ...draft, code: event.target.value })}
              placeholder="vendedor_balcao"
              className="font-mono"
            />
          </Field>
          <Alert tone="info">
            O papel nasce sem nenhuma permissão. Marque o que ele pode fazer logo
            depois de criar.
          </Alert>
        </div>
      </Modal>

      <Modal
        open={renaming !== null}
        title="Editar nome do papel"
        onClose={() => setRenaming(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              Cancelar
            </Button>
            <Button onClick={() => rename.mutate()} disabled={rename.isPending}>
              {rename.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </>
        }
      >
        {renaming && (
          <Field label="Nome" required>
            <Input
              value={renaming.label}
              onChange={(event) =>
                setRenaming({ ...renaming, label: event.target.value })
              }
            />
          </Field>
        )}
      </Modal>
    </>
  )
}
