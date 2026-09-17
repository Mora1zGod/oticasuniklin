import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Tabs, TabPanel } from '@/components/ui/Tabs'
import { Alert, Badge, Button, Card, PageHeader } from '@/components/ui/primitives'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate, formatDocument, formatMoney } from '@/lib/format'
import { CustomerDataTab } from './tabs/CustomerDataTab'
import { CustomerContactsTab } from './tabs/CustomerContactsTab'
import { CustomerRelationshipsTab } from './tabs/CustomerRelationshipsTab'
import { CustomerHistoryTabs } from './tabs/CustomerHistoryTabs'
import { CustomerConsentsTab } from './tabs/CustomerConsentsTab'

const PENDING_LABELS: Record<string, string> = {
  display_name: 'nome',
  contact: 'contato',
  cpf: 'CPF',
  cnpj: 'CNPJ',
  birth_date: 'data de nascimento',
  legal_name: 'razão social',
  state_registration: 'inscrição estadual',
  address: 'endereço',
  consent_data_processing: 'consentimento LGPD',
}

export function CustomerDetailPage() {
  const { id = '' } = useParams()
  const [tab, setTab] = useState('dados')

  const customer = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })

  const overview = useQuery({
    queryKey: ['customer-overview', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_customer_overview')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })

  const counts = useQuery({
    queryKey: ['customer-counts', id],
    queryFn: async () => {
      const [prescriptions, sales, orders, receivables] = await Promise.all([
        supabase
          .from('optical_prescriptions')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', id),
        supabase
          .from('sales')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', id),
        supabase
          .from('service_orders')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', id),
        supabase
          .from('receivables')
          .select('amount, paid_amount')
          .eq('customer_id', id)
          .in('status', ['open', 'partially_paid', 'overdue']),
      ])
      const aberto = (receivables.data ?? []).reduce(
        (sum, r) => sum + (Number(r.amount) - Number(r.paid_amount)),
        0,
      )
      return {
        prescriptions: prescriptions.count ?? 0,
        sales: sales.count ?? 0,
        orders: orders.count ?? 0,
        openAmount: aberto,
      }
    },
  })

  if (customer.isLoading) return <Spinner />
  if (customer.error || !customer.data) {
    return <Alert>Cliente não encontrado.</Alert>
  }

  const row = customer.data
  const pending = overview.data?.pending_fields ?? []

  return (
    <>
      <PageHeader
        title={row.display_name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={row.party_type === 'company' ? 'info' : 'neutral'}>
              {row.party_type === 'company' ? 'Pessoa jurídica' : 'Pessoa física'}
            </Badge>
            {overview.data?.tax_document && (
              <span>{formatDocument(overview.data.tax_document)}</span>
            )}
            {row.status !== 'active' && <Badge tone="warning">{row.status}</Badge>}
            {counts.data && counts.data.openAmount > 0 && (
              <Badge tone="warning">
                Em aberto: {formatMoney(counts.data.openAmount)}
              </Badge>
            )}
          </span>
        }
        actions={
          <>
            <Link to={`/optica/receitas/nova?cliente=${id}`}>
              <Button variant="secondary">+ Receita</Button>
            </Link>
            <Link to={`/comercial/vendas/nova?cliente=${id}`}>
              <Button>+ Venda</Button>
            </Link>
          </>
        }
      />

      {pending.length > 0 && (
        <div className="mb-4">
          <Alert tone="warning">
            Cadastro incompleto. Faltam:{' '}
            {pending.map((f) => PENDING_LABELS[f] ?? f).join(', ')}.
          </Alert>
        </div>
      )}

      <Card bodyClassName="px-4 pt-0 pb-4">
        <Tabs
          active={tab}
          onChange={setTab}
          items={[
            { id: 'dados', label: 'Dados' },
            { id: 'contatos', label: 'Contatos e endereços' },
            { id: 'relacionamentos', label: 'Relacionamentos' },
            { id: 'receitas', label: 'Receitas', badge: counts.data?.prescriptions },
            { id: 'vendas', label: 'Vendas', badge: counts.data?.sales },
            { id: 'os', label: 'Ordens de serviço', badge: counts.data?.orders },
            { id: 'financeiro', label: 'Financeiro' },
            { id: 'lgpd', label: 'LGPD' },
          ]}
        />

        <TabPanel>
          {tab === 'dados' && <CustomerDataTab customer={row} />}
          {tab === 'contatos' && <CustomerContactsTab customerId={id} tenantId={row.tenant_id} />}
          {tab === 'relacionamentos' && (
            <CustomerRelationshipsTab customerId={id} tenantId={row.tenant_id} />
          )}
          {(tab === 'receitas' || tab === 'vendas' || tab === 'os' || tab === 'financeiro') && (
            <CustomerHistoryTabs customerId={id} tab={tab} />
          )}
          {tab === 'lgpd' && <CustomerConsentsTab customerId={id} tenantId={row.tenant_id} />}
        </TabPanel>
      </Card>

      <p className="mt-4 text-xs text-slate-400">
        Cadastrado em {formatDate(row.created_at)}
        {overview.data?.created_at_branch_name
          ? ` · filial de origem: ${overview.data.created_at_branch_name}`
          : ''}
      </p>
    </>
  )
}
