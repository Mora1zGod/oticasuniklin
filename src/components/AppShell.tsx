import { useState, type ComponentType, type SVGProps } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSession } from '@/auth/SessionProvider'
import { Select, cx } from './ui/primitives'
import {
  IconBox,
  IconCart,
  IconChart,
  IconClose,
  IconGlasses,
  IconHome,
  IconLogout,
  IconMenu,
  IconMoney,
  IconSettings,
  IconUsers,
  IconWrench,
} from './ui/icons'

/**
 * Menu derivado do domínio (ADR-011): cada grupo é um contexto do modelo, não
 * um agrupamento de telas. Não existe "Cadastros → Tabelas".
 */
type NavItem = { to: string; label: string; permission?: string; end?: boolean }
type NavGroup = {
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  items: NavItem[]
}

const NAV: NavGroup[] = [
  {
    label: 'Clientes',
    icon: IconUsers,
    items: [
      { to: '/clientes', label: 'Clientes', permission: 'customer.read', end: true },
      { to: '/clientes/comunicacoes', label: 'Comunicações', permission: 'customer.read' },
    ],
  },
  {
    label: 'Óptica',
    icon: IconGlasses,
    items: [
      { to: '/optica/receitas', label: 'Receitas', permission: 'clinical.prescription.read' },
      { to: '/optica/prescritores', label: 'Prescritores' },
      { to: '/optica/tipos-de-lente', label: 'Tipos de lente' },
      { to: '/optica/materiais', label: 'Materiais' },
      { to: '/optica/tratamentos', label: 'Tratamentos' },
      { to: '/optica/laboratorios', label: 'Laboratórios' },
    ],
  },
  {
    label: 'Comercial',
    icon: IconCart,
    items: [
      { to: '/comercial/vendas/nova', label: 'Nova venda', permission: 'sale.write' },
      { to: '/comercial/vendas', label: 'Vendas', permission: 'sale.read', end: true },
      { to: '/comercial/orcamentos', label: 'Orçamentos', permission: 'sale.read' },
    ],
  },
  {
    label: 'Ordens de serviço',
    icon: IconWrench,
    items: [
      { to: '/producao', label: 'Painel de produção', permission: 'service_order.read' },
      { to: '/ordens-de-servico', label: 'Ordens de serviço', permission: 'service_order.read', end: true },
      { to: '/laboratorio/pedidos', label: 'Pedidos ao laboratório', permission: 'service_order.read' },
      { to: '/ordens-de-servico/situacoes', label: 'Situações', permission: 'admin.manage' },
    ],
  },
  {
    label: 'Produtos',
    icon: IconBox,
    items: [
      { to: '/produtos', label: 'Produtos', permission: 'product.read', end: true },
      { to: '/produtos/categorias', label: 'Categorias', permission: 'product.read' },
      { to: '/produtos/marcas', label: 'Marcas', permission: 'product.read' },
      { to: '/produtos/tabelas-de-preco', label: 'Tabelas de preço', permission: 'product.read' },
      { to: '/produtos/fornecedores', label: 'Fornecedores', permission: 'product.read' },
    ],
  },
  {
    label: 'Estoque',
    icon: IconChart,
    items: [
      { to: '/estoque', label: 'Saldos por filial', permission: 'product.read', end: true },
      { to: '/estoque/movimentacoes', label: 'Movimentações', permission: 'product.read' },
    ],
  },
  {
    label: 'Financeiro',
    icon: IconMoney,
    items: [
      { to: '/financeiro/receber', label: 'Contas a receber', permission: 'finance.read' },
      { to: '/financeiro/pagar', label: 'Contas a pagar', permission: 'finance.read' },
      { to: '/financeiro/comissoes', label: 'Comissões', permission: 'commission.read' },
      { to: '/financeiro/creditos', label: 'Crédito de clientes', permission: 'finance.read' },
      { to: '/financeiro/formas-de-pagamento', label: 'Formas de pagamento', permission: 'finance.read' },
      { to: '/financeiro/plano-de-contas', label: 'Plano de contas', permission: 'finance.read' },
    ],
  },
  {
    label: 'Administração',
    icon: IconSettings,
    items: [
      { to: '/admin/empresa', label: 'Empresa', permission: 'admin.manage' },
      { to: '/admin/filiais', label: 'Filiais', permission: 'admin.manage' },
      { to: '/admin/usuarios', label: 'Usuários e convites', permission: 'admin.manage' },
      { to: '/admin/papeis', label: 'Papéis e permissões', permission: 'admin.manage' },
      { to: '/admin/catalogos', label: 'Listas configuráveis', permission: 'admin.manage' },
    ],
  },
]

const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

export function AppShell() {
  const { context, branchId, setBranchId, can, signOut } = useSession()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  if (context?.status !== 'ready') return null

  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || can(item.permission)),
  })).filter((group) => group.items.length > 0)

  const branch = context.branches.find((b) => b.id === branchId)

  const itemClass = ({ isActive }: { isActive: boolean }): string =>
    cx(
      'relative flex items-center rounded-md py-1.5 pr-2.5 pl-8 text-[0.8125rem] transition-colors',
      isActive
        ? 'bg-white/10 font-medium text-white'
        : 'text-ink-300 hover:bg-white/5 hover:text-white',
    )

  return (
    <div className="flex h-full flex-col bg-ink-50">
      {/* ---------------------------------------------------------------- */}
      <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-ink-100 bg-white px-3 sm:px-4">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 lg:hidden"
          aria-label="Abrir menu"
        >
          {menuOpen ? <IconClose className="size-5" /> : <IconMenu className="size-5" />}
        </button>

        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 text-left"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-ink-900 text-white">
            <IconGlasses className="size-4.5" />
          </span>
          <span className="hidden sm:block">
            <span className="block text-sm leading-tight font-semibold tracking-tight text-ink-900">
              {context.tenant.trade_name}
            </span>
            <span className="block text-[0.6875rem] leading-tight text-ink-400">
              gestão para óticas
            </span>
          </span>
        </button>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {context.branches.length > 1 ? (
            <Select
              value={branchId ?? ''}
              onChange={(e) => setBranchId(e.target.value)}
              className="h-9 w-44 py-0 text-xs"
              aria-label="Filial"
            >
              {context.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.trade_name}
                </option>
              ))}
            </Select>
          ) : (
            <span className="hidden rounded-md bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-600 md:block">
              {branch?.trade_name}
            </span>
          )}

          <div className="flex items-center gap-2 border-l border-ink-100 pl-2 sm:pl-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
              {initials(context.full_name)}
            </span>
            <div className="hidden leading-tight lg:block">
              <p className="text-xs font-medium text-ink-800">{context.full_name}</p>
              <p className="text-[0.6875rem] text-ink-400">
                {context.is_tenant_admin ? 'Administrador' : (branch?.role ?? '')}
              </p>
            </div>
            <button
              onClick={() => void signOut()}
              className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
              aria-label="Sair"
              title="Sair"
            >
              <IconLogout className="size-4.5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* -------------------------------------------------------------- */}
        {menuOpen && (
          <div
            className="fixed inset-0 z-20 bg-ink-950/40 lg:hidden"
            onClick={() => setMenuOpen(false)}
          />
        )}

        <aside
          className={cx(
            'z-20 w-62 shrink-0 overflow-y-auto bg-ink-900 px-2.5 py-3',
            'max-lg:fixed max-lg:inset-y-14 max-lg:left-0 max-lg:shadow-2xl',
            menuOpen ? 'block' : 'hidden lg:block',
          )}
        >
          <NavLink
            to="/"
            end
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
              cx(
                'mb-3 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-white/10 font-medium text-white'
                  : 'text-ink-300 hover:bg-white/5 hover:text-white',
              )
            }
          >
            <IconHome className="size-4.5 shrink-0" />
            Início
          </NavLink>

          {groups.map((group) => {
            const GroupIcon = group.icon
            return (
              <div key={group.label} className="mb-4">
                <p className="mb-1 flex items-center gap-2 px-2.5 text-[0.6875rem] font-semibold tracking-wider text-ink-400 uppercase">
                  <GroupIcon className="size-3.5 shrink-0" />
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setMenuOpen(false)}
                      className={itemClass}
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute top-1.5 bottom-1.5 left-3 w-0.5 rounded-full bg-brand-400" />
                          )}
                          {item.label}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}

          <p className="px-2.5 pt-2 pb-1 text-[0.625rem] text-ink-500">
            Óticas Uniklin · {context.tenant.slug}
          </p>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1600px] p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
