import type { ComponentType, SVGProps } from 'react'
import {
  IconBank,
  IconBox,
  IconBuilding,
  IconCart,
  IconChart,
  IconClipboard,
  IconCoin,
  IconDroplet,
  IconFile,
  IconFlask,
  IconGlasses,
  IconLayers,
  IconList,
  IconMoney,
  IconPalette,
  IconPercent,
  IconPlus,
  IconPriceTag,
  IconSettings,
  IconShield,
  IconSparkle,
  IconTag,
  IconTruck,
  IconUserCheck,
  IconUsers,
  IconWallet,
  IconWrench,
} from './ui/icons'

/**
 * O menu é a planta do domínio (ADR-011): cada grupo é um contexto do modelo,
 * não uma gaveta de telas. Mora aqui, e não dentro do AppShell, porque três
 * coisas leem a mesma lista — o menu, a trilha de navegação e a busca global.
 */
export type NavItem = {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  permission?: string
  end?: boolean
  /** Fora da busca global: atalhos e telas de formulário. */
  hidden?: boolean
}

export type NavGroup = {
  id: string
  label: string
  items: NavItem[]
  /**
   * Grupo que só existe para a ótica que opera a plataforma. Não é permissão
   * dentro da ótica: é uma relação entre óticas (ver 0014), por isso não cabe
   * no `permission` do item.
   */
  platformOnly?: boolean
}

export const NAV: NavGroup[] = [
  {
    id: 'plataforma',
    label: 'Plataforma',
    platformOnly: true,
    items: [
      { to: '/plataforma/oticas', label: 'Óticas atendidas', icon: IconBuilding },
      { to: '/plataforma/cobrancas', label: 'Cobranças', icon: IconCoin },
    ],
  },
  {
    id: 'clientes',
    label: 'Clientes',
    items: [
      { to: '/clientes', label: 'Clientes', icon: IconUsers, permission: 'customer.read', end: true },
      { to: '/clientes/comunicacoes', label: 'Comunicações', icon: IconFile, permission: 'customer.read' },
    ],
  },
  {
    id: 'optica',
    label: 'Óptica',
    items: [
      { to: '/optica/receitas', label: 'Receitas', icon: IconGlasses, permission: 'clinical.prescription.read' },
      { to: '/optica/prescritores', label: 'Prescritores', icon: IconUserCheck },
      { to: '/optica/tipos-de-lente', label: 'Tipos de lente', icon: IconLayers },
      { to: '/optica/materiais', label: 'Materiais', icon: IconDroplet },
      { to: '/optica/tratamentos', label: 'Tratamentos', icon: IconSparkle },
      { to: '/optica/laboratorios', label: 'Laboratórios', icon: IconFlask },
    ],
  },
  {
    id: 'comercial',
    label: 'Comercial',
    items: [
      { to: '/comercial/vendas/nova', label: 'Nova venda', icon: IconPlus, permission: 'sale.write' },
      { to: '/comercial/vendas', label: 'Vendas', icon: IconCart, permission: 'sale.read', end: true },
      { to: '/comercial/orcamentos', label: 'Orçamentos', icon: IconFile, permission: 'sale.read' },
    ],
  },
  {
    id: 'ordens',
    label: 'Ordens de serviço',
    items: [
      { to: '/producao', label: 'Painel de produção', icon: IconWrench, permission: 'service_order.read' },
      { to: '/ordens-de-servico', label: 'Ordens de serviço', icon: IconClipboard, permission: 'service_order.read', end: true },
      { to: '/laboratorio/pedidos', label: 'Pedidos ao laboratório', icon: IconFlask, permission: 'service_order.read' },
      { to: '/ordens-de-servico/situacoes', label: 'Situações', icon: IconList, permission: 'admin.manage' },
    ],
  },
  {
    id: 'produtos',
    label: 'Produtos',
    items: [
      { to: '/produtos', label: 'Produtos', icon: IconBox, permission: 'product.read', end: true },
      { to: '/produtos/categorias', label: 'Categorias', icon: IconList, permission: 'product.read' },
      { to: '/produtos/marcas', label: 'Marcas', icon: IconTag, permission: 'product.read' },
      { to: '/produtos/tabelas-de-preco', label: 'Tabelas de preço', icon: IconPriceTag, permission: 'product.read' },
      { to: '/produtos/fornecedores', label: 'Fornecedores', icon: IconTruck, permission: 'product.read' },
    ],
  },
  {
    id: 'estoque',
    label: 'Estoque',
    items: [
      { to: '/estoque', label: 'Saldos por filial', icon: IconChart, permission: 'product.read', end: true },
      { to: '/estoque/movimentacoes', label: 'Movimentações', icon: IconList, permission: 'product.read' },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    items: [
      { to: '/financeiro/receber', label: 'Contas a receber', icon: IconMoney, permission: 'finance.read' },
      { to: '/financeiro/pagar', label: 'Contas a pagar', icon: IconWallet, permission: 'finance.read' },
      { to: '/financeiro/comissoes', label: 'Comissões', icon: IconPercent, permission: 'commission.read' },
      { to: '/financeiro/creditos', label: 'Crédito de clientes', icon: IconCoin, permission: 'finance.read' },
      { to: '/financeiro/formas-de-pagamento', label: 'Formas de pagamento', icon: IconWallet, permission: 'finance.read' },
      { to: '/financeiro/plano-de-contas', label: 'Plano de contas', icon: IconBank, permission: 'finance.read' },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    items: [
      { to: '/admin/empresa', label: 'Empresa', icon: IconBuilding, permission: 'admin.manage' },
      { to: '/admin/identidade-visual', label: 'Identidade visual', icon: IconPalette, permission: 'admin.manage' },
      { to: '/admin/filiais', label: 'Filiais', icon: IconBuilding, permission: 'admin.manage' },
      { to: '/admin/usuarios', label: 'Usuários e convites', icon: IconUsers, permission: 'admin.manage' },
      { to: '/admin/papeis', label: 'Papéis e permissões', icon: IconShield, permission: 'admin.manage' },
      { to: '/admin/catalogos', label: 'Listas configuráveis', icon: IconSettings, permission: 'admin.manage' },
    ],
  },
]

/**
 * Trilha de navegação da rota atual: grupo › tela › (detalhe).
 * Deriva do próprio menu, então nunca diverge dele.
 */
export function breadcrumbFor(pathname: string): { label: string; to?: string }[] {
  let best: { group: NavGroup; item: NavItem } | null = null

  for (const group of NAV) {
    for (const item of group.items) {
      if (pathname === item.to || pathname.startsWith(item.to + '/')) {
        if (!best || item.to.length > best.item.to.length) best = { group, item }
      }
    }
  }
  if (!best) return []

  const trail: { label: string; to?: string }[] = [
    { label: best.group.label },
    { label: best.item.label, to: best.item.to },
  ]

  const rest = pathname.slice(best.item.to.length).replace(/^\//, '')
  if (rest) trail.push({ label: rest === 'nova' ? 'Nova' : 'Detalhe' })

  // A última parada é onde já estamos: não vira link.
  const last = trail[trail.length - 1]
  if (last) delete last.to
  return trail
}
