import { useQuery } from '@tanstack/react-query'
import { CrudPage, type CrudField } from '@/components/CrudPage'
import { Badge } from '@/components/ui/primitives'
import { formatMoney } from '@/lib/format'
import { supabase } from '@/lib/supabase'

const KIND_LABEL: Record<string, string> = {
  frame: 'Armação',
  sunglass: 'Solar',
  lens: 'Lente',
  contact_lens: 'Lente de contato',
  accessory: 'Acessório',
  service: 'Serviço',
  lens_treatment: 'Tratamento',
}

function useProductOptions() {
  const categories = useQuery({
    queryKey: ['product-categories-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('id, label')
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return data ?? []
    },
  })

  const brands = useQuery({
    queryKey: ['brands-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })

  const suppliers = useQuery({
    queryKey: ['suppliers-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, trade_name')
        .is('deleted_at', null)
        .order('trade_name')
      if (error) throw error
      return data ?? []
    },
  })

  return {
    categoryOptions: (categories.data ?? []).map((c) => ({ value: c.id, label: c.label })),
    brandOptions: (brands.data ?? []).map((b) => ({ value: b.id, label: b.name })),
    supplierOptions: (suppliers.data ?? []).map((s) => ({ value: s.id, label: s.trade_name })),
  }
}

export function ProductsPage() {
  const { categoryOptions, brandOptions, supplierOptions } = useProductOptions()

  const fields: CrudField[] = [
    { name: 'name', label: 'Nome', required: true, span: 8 },
    { name: 'sku', label: 'SKU', span: 4 },
    {
      name: 'product_kind',
      label: 'Tipo',
      type: 'select',
      required: true,
      span: 4,
      defaultValue: 'frame',
      hint: 'Muda o comportamento: lente surfaçada não tem estoque próprio.',
      options: Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label })),
    },
    { name: 'category_id', label: 'Categoria', type: 'select', span: 4, options: categoryOptions },
    { name: 'brand_id', label: 'Marca', type: 'select', span: 4, options: brandOptions },
    { name: 'supplier_id', label: 'Fornecedor', type: 'select', span: 6, options: supplierOptions },
    { name: 'gtin', label: 'Código de barras', span: 6 },
    { name: 'cost_price', label: 'Custo', type: 'number', step: '0.01', span: 4 },
    { name: 'list_price', label: 'Preço de tabela', type: 'number', step: '0.01', span: 4 },
    { name: 'unit', label: 'Unidade', span: 4, defaultValue: 'UN' },
    {
      name: 'tracks_stock',
      label: 'Controla estoque',
      type: 'checkbox',
      span: 6,
      defaultValue: true,
    },
    {
      name: 'is_made_to_order',
      label: 'Sob encomenda (lente surfaçada)',
      type: 'checkbox',
      span: 6,
      hint: 'Sob encomenda e controle de estoque são mutuamente exclusivos.',
    },
    { name: 'ncm_code', label: 'NCM', span: 4 },
    { name: 'cest_code', label: 'CEST', span: 4 },
    { name: 'is_active', label: 'Ativo', type: 'checkbox', span: 4, defaultValue: true },
  ]

  return (
    <CrudPage
      table="products"
      title="Produtos"
      singular="produto"
      subtitle="Armações, lentes, acessórios e serviços."
      searchColumn="name"
      orderBy={{ column: 'name', ascending: true }}
      columns={[
        { key: 'name', header: 'Produto', render: (r) => r.name },
        { key: 'sku', header: 'SKU', render: (r) => r.sku ?? '—' },
        {
          key: 'kind',
          header: 'Tipo',
          render: (r) => <Badge>{KIND_LABEL[r.product_kind] ?? r.product_kind}</Badge>,
        },
        {
          key: 'cost',
          header: 'Custo',
          numeric: true,
          render: (r) => (r.cost_price === null ? '—' : formatMoney(Number(r.cost_price))),
        },
        {
          key: 'price',
          header: 'Preço',
          numeric: true,
          render: (r) => (r.list_price === null ? '—' : formatMoney(Number(r.list_price))),
        },
        {
          key: 'stock',
          header: 'Estoque',
          render: (r) =>
            r.is_made_to_order ? (
              <Badge tone="info">sob encomenda</Badge>
            ) : r.tracks_stock ? (
              'controlado'
            ) : (
              '—'
            ),
        },
        {
          key: 'active',
          header: '',
          render: (r) => (r.is_active ? null : <Badge tone="warning">inativo</Badge>),
        },
      ]}
      fields={fields}
    />
  )
}

export function ProductCategoriesPage() {
  return (
    <CrudPage
      table="product_categories"
      title="Categorias de produto"
      singular="categoria"
      orderBy={{ column: 'sort_order', ascending: true }}
      columns={[
        { key: 'label', header: 'Categoria', render: (r) => r.label },
        { key: 'code', header: 'Código', render: (r) => r.code },
        { key: 'order', header: 'Ordem', numeric: true, render: (r) => r.sort_order },
      ]}
      fields={[
        { name: 'code', label: 'Código', required: true, span: 4 },
        { name: 'label', label: 'Nome', required: true, span: 8 },
        { name: 'sort_order', label: 'Ordem', type: 'number', span: 6, defaultValue: 10 },
        { name: 'is_active', label: 'Ativa', type: 'checkbox', span: 6, defaultValue: true },
      ]}
    />
  )
}

export function BrandsPage() {
  return (
    <CrudPage
      table="brands"
      title="Marcas"
      singular="marca"
      searchColumn="name"
      orderBy={{ column: 'name', ascending: true }}
      columns={[
        { key: 'name', header: 'Marca', render: (r) => r.name },
        { key: 'manufacturer', header: 'Fabricante', render: (r) => r.manufacturer_name ?? '—' },
      ]}
      fields={[
        { name: 'name', label: 'Marca', required: true, span: 6 },
        { name: 'manufacturer_name', label: 'Fabricante', span: 6 },
        { name: 'is_active', label: 'Ativa', type: 'checkbox', span: 6, defaultValue: true },
      ]}
    />
  )
}

export function SuppliersPage() {
  return (
    <CrudPage
      table="suppliers"
      title="Fornecedores"
      singular="fornecedor"
      searchColumn="trade_name"
      orderBy={{ column: 'trade_name', ascending: true }}
      columns={[
        { key: 'name', header: 'Fornecedor', render: (r) => r.trade_name },
        { key: 'doc', header: 'CNPJ', render: (r) => r.tax_document ?? '—' },
        { key: 'contact', header: 'Contato', render: (r) => r.contact_name ?? '—' },
        { key: 'phone', header: 'Telefone', render: (r) => r.phone ?? '—' },
        {
          key: 'status',
          header: '',
          render: (r) =>
            r.record_status === 'quick' ? <Badge tone="warning">Cadastro rápido</Badge> : null,
        },
      ]}
      fields={[
        { name: 'trade_name', label: 'Nome fantasia', required: true, span: 8 },
        { name: 'tax_document', label: 'CNPJ', span: 4 },
        { name: 'legal_name', label: 'Razão social', span: 12 },
        { name: 'contact_name', label: 'Contato', span: 4 },
        { name: 'phone', label: 'Telefone', span: 4 },
        { name: 'email', label: 'E-mail', type: 'email', span: 4 },
        {
          name: 'record_status',
          label: 'Situação do cadastro',
          type: 'select',
          span: 6,
          defaultValue: 'complete',
          options: [
            { value: 'quick', label: 'Cadastro rápido' },
            { value: 'complete', label: 'Completo' },
          ],
        },
        { name: 'is_active', label: 'Ativo', type: 'checkbox', span: 6, defaultValue: true },
      ]}
    />
  )
}

export function PriceTablesPage() {
  return (
    <CrudPage
      table="price_tables"
      title="Tabelas de preço"
      singular="tabela"
      subtitle="Podem valer para toda a rede ou para filiais específicas."
      orderBy={{ column: 'label', ascending: true }}
      columns={[
        { key: 'label', header: 'Tabela', render: (r) => r.label },
        { key: 'code', header: 'Código', render: (r) => r.code },
        {
          key: 'default',
          header: '',
          render: (r) => (r.is_default ? <Badge tone="info">padrão</Badge> : null),
        },
        {
          key: 'active',
          header: '',
          render: (r) => (r.is_active ? null : <Badge tone="warning">inativa</Badge>),
        },
      ]}
      fields={[
        { name: 'code', label: 'Código', required: true, span: 4 },
        { name: 'label', label: 'Nome', required: true, span: 8 },
        { name: 'valid_from', label: 'Vigente de', type: 'date', span: 6 },
        { name: 'valid_to', label: 'Vigente até', type: 'date', span: 6 },
        { name: 'is_default', label: 'Tabela padrão', type: 'checkbox', span: 6 },
        { name: 'is_active', label: 'Ativa', type: 'checkbox', span: 6, defaultValue: true },
      ]}
    />
  )
}
