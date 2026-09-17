import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { AppShell } from '@/components/AppShell'
import { LoginPage } from '@/pages/auth/LoginPage'
import { OnboardingPage } from '@/pages/auth/OnboardingPage'
import { DashboardPage } from '@/pages/DashboardPage'

import { CustomerListPage } from '@/pages/customers/CustomerListPage'
import { CustomerDetailPage } from '@/pages/customers/CustomerDetailPage'

import { PrescriptionListPage } from '@/pages/optics/PrescriptionListPage'
import { PrescriptionFormPage } from '@/pages/optics/PrescriptionFormPage'
import { PrescriptionDetailPage } from '@/pages/optics/PrescriptionDetailPage'
import {
  LaboratoriesPage,
  LensMaterialsPage,
  LensTreatmentsPage,
  LensTypesPage,
  PrescribersPage,
  ServiceOrderStatusesPage,
} from '@/pages/optics/OpticsCatalogPages'

import { SaleFormPage } from '@/pages/sales/SaleFormPage'
import { QuoteListPage, SaleDetailPage, SaleListPage } from '@/pages/sales/SalePages'

import { ServiceOrderFormPage } from '@/pages/service-orders/ServiceOrderFormPage'
import { ServiceOrderDetailPage } from '@/pages/service-orders/ServiceOrderDetailPage'
import {
  LabOrderListPage,
  ProductionBoardPage,
  ServiceOrderListPage,
} from '@/pages/service-orders/ProductionBoardPage'

import {
  BrandsPage,
  PriceTablesPage,
  ProductCategoriesPage,
  ProductsPage,
  SuppliersPage,
} from '@/pages/products/ProductPages'
import { StockBalancesPage, StockMovementsPage } from '@/pages/inventory/InventoryPages'

import {
  ChartAccountsPage,
  CommissionsPage,
  CustomerCreditsPage,
  PayablesPage,
  PaymentMethodsPage,
  ReceivablesPage,
} from '@/pages/finance/FinancePages'

import {
  BranchesPage,
  CatalogsPage,
  CompanyPage,
  CustomerCommunicationsPage,
  RolesPage,
  UsersPage,
} from '@/pages/admin/AdminPages'

export function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<LoginPage />} />
      <Route path="/primeiro-acesso" element={<OnboardingPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />

        {/* Clientes */}
        <Route path="clientes" element={<CustomerListPage />} />
        <Route path="clientes/comunicacoes" element={<CustomerCommunicationsPage />} />
        <Route path="clientes/:id" element={<CustomerDetailPage />} />

        {/* Óptica */}
        <Route path="optica/receitas" element={<PrescriptionListPage />} />
        <Route path="optica/receitas/nova" element={<PrescriptionFormPage />} />
        <Route path="optica/receitas/:id" element={<PrescriptionDetailPage />} />
        <Route path="optica/prescritores" element={<PrescribersPage />} />
        <Route path="optica/tipos-de-lente" element={<LensTypesPage />} />
        <Route path="optica/materiais" element={<LensMaterialsPage />} />
        <Route path="optica/tratamentos" element={<LensTreatmentsPage />} />
        <Route path="optica/laboratorios" element={<LaboratoriesPage />} />

        {/* Comercial */}
        <Route path="comercial/orcamentos" element={<QuoteListPage />} />
        <Route path="comercial/vendas" element={<SaleListPage />} />
        <Route path="comercial/vendas/nova" element={<SaleFormPage />} />
        <Route path="comercial/vendas/:id" element={<SaleDetailPage />} />

        {/* Produção */}
        <Route path="producao" element={<ProductionBoardPage />} />
        <Route path="ordens-de-servico" element={<ServiceOrderListPage />} />
        <Route path="ordens-de-servico/nova" element={<ServiceOrderFormPage />} />
        <Route path="ordens-de-servico/situacoes" element={<ServiceOrderStatusesPage />} />
        <Route path="ordens-de-servico/:id" element={<ServiceOrderDetailPage />} />
        <Route path="laboratorio/pedidos" element={<LabOrderListPage />} />

        {/* Produtos e estoque */}
        <Route path="produtos" element={<ProductsPage />} />
        <Route path="produtos/categorias" element={<ProductCategoriesPage />} />
        <Route path="produtos/marcas" element={<BrandsPage />} />
        <Route path="produtos/tabelas-de-preco" element={<PriceTablesPage />} />
        <Route path="produtos/fornecedores" element={<SuppliersPage />} />
        <Route path="estoque" element={<StockBalancesPage />} />
        <Route path="estoque/movimentacoes" element={<StockMovementsPage />} />

        {/* Financeiro */}
        <Route path="financeiro/receber" element={<ReceivablesPage />} />
        <Route path="financeiro/pagar" element={<PayablesPage />} />
        <Route path="financeiro/comissoes" element={<CommissionsPage />} />
        <Route path="financeiro/creditos" element={<CustomerCreditsPage />} />
        <Route path="financeiro/formas-de-pagamento" element={<PaymentMethodsPage />} />
        <Route path="financeiro/plano-de-contas" element={<ChartAccountsPage />} />

        {/* Administração */}
        <Route path="admin/empresa" element={<CompanyPage />} />
        <Route path="admin/filiais" element={<BranchesPage />} />
        <Route path="admin/usuarios" element={<UsersPage />} />
        <Route path="admin/papeis" element={<RolesPage />} />
        <Route path="admin/catalogos" element={<CatalogsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
