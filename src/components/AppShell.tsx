import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSession } from '@/auth/SessionProvider'
import { Button, Select, cx } from './ui/primitives'

/**
 * Menu derivado do domínio (ADR-011): cada grupo é um contexto do modelo, não
 * um agrupamento de telas. Não existe "Cadastros → Tabelas".
 */
type NavItem = { to: string; label: string; permission?: string }
type NavGroup = { label: string; icon: string; items: NavItem[] }

const NAV: NavGroup[] = [
  {
    label: 'Clientes',
    icon: '👤',
    items: [
      { to: '/clientes', label: 'Clientes', permission: 'customer.read' },
      { to: '/clientes/comunicacoes', label: 'Comunicações', permission: 'customer.read' },
    ],
  },
  {
    label: 'Óptica',
    icon: '👓',
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
    icon: '🛒',
    items: [
      { to: '/comercial/orcamentos', label: 'Orçamentos', permission: 'sale.read' },
      { to: '/comercial/vendas', label: 'Vendas', permission: 'sale.read' },
      { to: '/comercial/vendas/nova', label: 'Nova venda', permission: 'sale.write' },
    ],
  },
  {
    label: 'Ordens de serviço',
    icon: '🔧',
    items: [
      { to: '/producao', label: 'Painel de produção', permission: 'service_order.read' },
      { to: '/ordens-de-servico', label: 'Ordens de serviço', permission: 'service_order.read' },
      { to: '/laboratorio/pedidos', label: 'Pedidos ao laboratório', permission: 'service_order.read' },
      { to: '/ordens-de-servico/situacoes', label: 'Situações', permission: 'admin.manage' },
    ],
  },
  {
    label: 'Produtos',
    icon: '📦',
    items: [
      { to: '/produtos', label: 'Produtos', permission: 'product.read' },
      { to: '/produtos/categorias', label: 'Categorias', permission: 'product.read' },
      { to: '/produtos/marcas', label: 'Marcas', permission: 'product.read' },
      { to: '/produtos/tabelas-de-preco', label: 'Tabelas de preço', permission: 'product.read' },
      { to: '/produtos/fornecedores', label: 'Fornecedores', permission: 'product.read' },
    ],
  },
  {
    label: 'Estoque',
    icon: '📊',
    items: [
      { to: '/estoque', label: 'Saldos por filial', permission: 'product.read' },
      { to: '/estoque/movimentacoes', label: 'Movimentações', permission: 'product.read' },
    ],
  },
  {
    label: 'Financeiro',
    icon: '💰',
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
    icon: '⚙️',
    items: [
      { to: '/admin/empresa', label: 'Empresa', permission: 'admin.manage' },
      { to: '/admin/filiais', label: 'Filiais', permission: 'admin.manage' },
      { to: '/admin/usuarios', label: 'Usuários e convites', permission: 'admin.manage' },
      { to: '/admin/papeis', label: 'Papéis e permissões', permission: 'admin.manage' },
      { to: '/admin/catalogos', label: 'Listas configuráveis', permission: 'admin.manage' },
    ],
  },
]

export function AppShell() {
  const { context, branchId, setBranchId, can, signOut } = useSession()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  if (context?.status !== 'ready') return null

  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || can(item.permission)),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Abrir menu"
        >
          ☰
        </Button>

        <button
          onClick={() => navigate('/')}
          className="text-sm font-semibold text-slate-900 hover:text-brand-700"
        >
          {context.tenant.trade_name}
        </button>

        <div className="ml-auto flex items-center gap-3">
          {context.branches.length > 1 ? (
            <Select
              value={branchId ?? ''}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-48 py-1.5 text-xs"
              aria-label="Filial"
            >
              {context.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.trade_name}
                </option>
              ))}
            </Select>
          ) : (
            <span className="hidden text-xs text-slate-500 sm:block">
              {context.branches[0]?.trade_name}
            </span>
          )}

          <div className="hidden text-right sm:block">
            <p className="text-xs font-medium text-slate-700">{context.full_name}</p>
            <p className="text-[11px] text-slate-400">{context.email}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void signOut()}>
            Sair
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={cx(
            'w-60 shrink-0 overflow-y-auto border-r border-slate-200 bg-white px-2 py-3',
            menuOpen ? 'block' : 'hidden lg:block',
          )}
        >
          <NavLink
            to="/"
            end
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
              cx(
                'mb-2 flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium',
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100',
              )
            }
          >
            🏠 Início
          </NavLink>

          {groups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                {group.icon} {group.label}
              </p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/clientes' || item.to === '/produtos'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      'block rounded-md px-2.5 py-1.5 text-sm',
                      isActive
                        ? 'bg-brand-50 font-medium text-brand-700'
                        : 'text-slate-600 hover:bg-slate-100',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
