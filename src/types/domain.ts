// ============================================================================
// GERADO AUTOMATICAMENTE — NAO EDITAR A MAO
// ----------------------------------------------------------------------------
// Fonte: schema real em db/migrations/*.sql, introspectado do Postgres.
// Regerar: ./db/tools/validate.sh && python3 db/tools/gen_types.py
// ============================================================================

import type { Tables, TablesInsert, Views } from './database'

// ---------------------------------------------------------------------------
// Dominios fechados
// ---------------------------------------------------------------------------
// O produto usa CHECK em vez de CREATE TYPE ... AS ENUM (ADR-010). Estas
// unioes sao extraidas dos proprios CHECK do banco — se a migration mudar,
// o tipo muda junto na proxima geracao.

export type CatalogDefinitionScope = 'platform' | 'tenant' | 'both'
export type ChartAccountAccountKind = 'revenue' | 'expense' | 'asset' | 'liability' | 'equity'
export type CommissionRuleBase = 'net_item' | 'gross_item' | 'margin'
export type CommissionRuleProductKind = 'frame' | 'sunglass' | 'lens' | 'contact_lens' | 'accessory' | 'service' | 'lens_treatment'
export type CommissionRuleReleaseEvent = 'sale_confirmed' | 'sale_paid' | 'order_delivered'
export type CommissionStatus = 'pending' | 'released' | 'paid' | 'cancelled'
export type CompanyProfileTaxRegime = 'simples_nacional' | 'lucro_presumido' | 'lucro_real' | 'mei' | 'imune' | 'isento'
export type CustomerAddressKind = 'residential' | 'commercial' | 'billing' | 'delivery' | 'other'
export type CustomerAttachmentKind = 'prescription' | 'document' | 'photo' | 'contract' | 'other'
export type CustomerCommunicationChannel = 'whatsapp' | 'sms' | 'email' | 'phone' | 'in_person' | 'system'
export type CustomerCommunicationDirection = 'inbound' | 'outbound'
export type CustomerConsentPurpose = 'data_processing' | 'marketing' | 'health_data' | 'image_use' | 'third_party_sharing'
export type CustomerContactKind = 'mobile' | 'landline' | 'whatsapp' | 'email' | 'instagram' | 'other'
export type CustomerCreditOrigin = 'return' | 'exchange' | 'courtesy' | 'warranty' | 'adjustment'
export type CustomerCreditStatus = 'active' | 'consumed' | 'expired' | 'cancelled'
export type CustomerPartyType = 'individual' | 'company'
export type CustomerRecordStatus = 'quick' | 'complete'
export type CustomerStatus = 'active' | 'inactive' | 'blocked' | 'merged'
export type DocumentSequenceDocumentType = 'quote' | 'sale' | 'service_order' | 'lab_order' | 'receipt'
export type FrameAttributeGenderTarget = 'female' | 'male' | 'unisex' | 'kids'
export type FrameAttributeRimType = 'full_rim' | 'semi_rimless' | 'rimless'
export type IndividualProfileGender = 'female' | 'male' | 'other' | 'undisclosed'
export type LabOrderItemEye = 'OD' | 'OS'
export type LabOrderStatus = 'draft' | 'sent' | 'acknowledged' | 'in_production' | 'shipped' | 'received' | 'rejected' | 'cancelled'
export type LaboratoryIntegrationKind = 'manual' | 'email' | 'api' | 'edi'
export type LensAttributeDesign = 'spherical' | 'aspheric' | 'bi_aspheric' | 'freeform' | 'digital'
export type LensAttributeSupplyMode = 'stock' | 'surfaced'
export type LensTreatmentTreatmentGroup = 'coating' | 'tint' | 'photochromic' | 'polarized' | 'filter' | 'hardening' | 'other'
export type LensTypeVisionDesign = 'single_vision' | 'bifocal' | 'trifocal' | 'progressive' | 'occupational' | 'contact'
export type OpticalPrescriptionMeasureEye = 'OD' | 'OS'
export type OpticalPrescriptionMeasurePrismHorizontalBase = 'in' | 'out'
export type OpticalPrescriptionMeasurePrismVerticalBase = 'up' | 'down'
export type OpticalPrescriptionMeasureVisionZone = 'far' | 'near' | 'intermediate'
export type OpticalPrescriptionCylinderNotation = 'negative' | 'positive'
export type OpticalPrescriptionPurpose = 'eyeglasses' | 'contact_lenses' | 'both'
export type OpticalPrescriptionSource = 'external_document' | 'in_store_exam' | 'customer_report'
export type OpticalPrescriptionStatus = 'draft' | 'active' | 'superseded' | 'void'
export type OpticalPrescriptionVisionUse = 'far' | 'near' | 'multifocal' | 'bifocal' | 'occupational' | 'intermediate'
export type PayableStatus = 'open' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
export type PaymentMethodKind = 'cash' | 'debit_card' | 'credit_card' | 'pix' | 'bank_slip' | 'store_credit' | 'check' | 'transfer' | 'installment_plan' | 'voucher'
export type PrescriberCouncilType = 'CRM' | 'CRO' | 'CROf' | 'OUTRO'
export type PrescriberKind = 'ophthalmologist' | 'optometrist' | 'other'
export type PrescriberRecordStatus = 'quick' | 'complete'
export type ProductKind = 'frame' | 'sunglass' | 'lens' | 'contact_lens' | 'accessory' | 'service' | 'lens_treatment'
export type ProductRecordStatus = 'quick' | 'complete'
export type QuoteItemEye = 'OD' | 'OS' | 'both'
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted'
export type ReceivableStatus = 'open' | 'partially_paid' | 'paid' | 'overdue' | 'renegotiated' | 'cancelled' | 'written_off'
export type SaleItemEye = 'OD' | 'OS' | 'both'
export type SaleType = 'identified' | 'anonymous'
export type SaleStatus = 'open' | 'confirmed' | 'invoiced' | 'cancelled' | 'returned'
export type ServiceOrderFittingMeasureEye = 'OD' | 'OS'
export type ServiceOrderFittingDpSource = 'measured' | 'derived_from_dnp' | 'from_prescription'
export type ServiceOrderFittingMeasurementMethod = 'manual' | 'pupilometer' | 'digital_photo' | 'app'
export type ServiceOrderLensSpecDesign = 'spherical' | 'aspheric' | 'bi_aspheric' | 'freeform' | 'digital'
export type ServiceOrderLensSpecEye = 'OD' | 'OS'
export type ServiceOrderLensSpecSupplyMode = 'stock' | 'surfaced'
export type ServiceOrderPrescriptionMeasureEye = 'OD' | 'OS'
export type ServiceOrderPrescriptionMeasurePrismHorizontalBase = 'in' | 'out'
export type ServiceOrderPrescriptionMeasurePrismVerticalBase = 'up' | 'down'
export type ServiceOrderPrescriptionMeasureVisionZone = 'far' | 'near' | 'intermediate'
export type ServiceOrderPrescriptionCylinderNotation = 'negative' | 'positive'
export type ServiceOrderStatusStage = 'draft' | 'awaiting_prescription' | 'awaiting_lab' | 'in_production' | 'received_from_lab' | 'assembling' | 'quality_check' | 'ready_for_pickup' | 'delivered' | 'cancelled'
export type ServiceOrderFrameSource = 'store_stock' | 'customer_own' | 'supplier_direct'
export type ServiceOrderPriority = 'low' | 'normal' | 'high' | 'urgent'
export type StockMovementDirection = '-1'
export type StockMovementMovementKind = 'purchase_in' | 'sale_out' | 'reserve' | 'release_reserve' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'return_in' | 'loss' | 'lab_out' | 'lab_in'
export type SupplierRecordStatus = 'quick' | 'complete'

// ---------------------------------------------------------------------------
// Branded types — as distincoes que o compilador precisa vigiar
// ---------------------------------------------------------------------------
// ADR-007: DNP clinica, DNP de montagem e DP total sao medidas diferentes.
// Todas sao `numeric(4,1)` no banco, entao o Postgres nao impede trocar uma pela
// outra. Aqui elas sao tipos distintos: passar a DNP da receita onde se espera a
// de montagem vira erro de compilacao.

declare const brand: unique symbol
type Brand<T, B extends string> = T & { readonly [brand]: B }

/** Distancia naso-pupilar PRESCRITA (receita clinica). */
export type PrescribedDnpMm = Brand<number, 'PrescribedDnpMm'>
/** Distancia naso-pupilar AFERIDA contra a armacao escolhida (O.S.). */
export type FittingDnpMm = Brand<number, 'FittingDnpMm'>
/** DP binocular total (medida de montagem/legado). */
export type TotalDpMm = Brand<number, 'TotalDpMm'>
/** Altura de montagem por olho (obrigatoria em multifocal). */
export type FittingHeightMm = Brand<number, 'FittingHeightMm'>

export const prescribedDnp = (mm: number): PrescribedDnpMm => mm as PrescribedDnpMm
export const fittingDnp = (mm: number): FittingDnpMm => mm as FittingDnpMm
export const totalDp = (mm: number): TotalDpMm => mm as TotalDpMm
export const fittingHeight = (mm: number): FittingHeightMm => mm as FittingHeightMm

// ADR-002: o id de uma receita clinica nao e o id do snapshot usado na O.S.
export type PrescriptionId = Brand<string, 'PrescriptionId'>
export type ServiceOrderPrescriptionId = Brand<string, 'ServiceOrderPrescriptionId'>

// ---------------------------------------------------------------------------
// Aliases de leitura
// ---------------------------------------------------------------------------

export type Customer = Tables<'customers'>
export type CustomerInsert = TablesInsert<'customers'>
export type IndividualProfile = Tables<'individual_profiles'>
export type CompanyProfile = Tables<'company_profiles'>
export type CustomerRelationship = Tables<'customer_relationships'>
export type CustomerBranchProfile = Tables<'customer_branch_profiles'>

export type OpticalPrescription = Tables<'optical_prescriptions'>
export type OpticalPrescriptionMeasure = Tables<'optical_prescription_measures'>

export type Quote = Tables<'quotes'>
export type Sale = Tables<'sales'>
export type SaleItem = Tables<'sale_items'>
export type SalePayment = Tables<'sale_payments'>

export type ServiceOrder = Tables<'service_orders'>
export type ServiceOrderPrescription = Tables<'service_order_prescriptions'>
export type ServiceOrderPrescriptionMeasure = Tables<'service_order_prescription_measures'>
export type ServiceOrderFitting = Tables<'service_order_fittings'>
export type ServiceOrderFittingMeasure = Tables<'service_order_fitting_measures'>
export type ServiceOrderLensSpec = Tables<'service_order_lens_specs'>
export type LabOrder = Tables<'lab_orders'>

export type CustomerOverview = Views<'v_customer_overview'>
export type CustomerPrescriptionRow = Views<'v_customer_prescriptions'>
export type ServiceOrderProduction = Views<'v_service_order_production'>

// ---------------------------------------------------------------------------
// Guardas de dominio
// ---------------------------------------------------------------------------

/** ADR-005: estreita o cliente para o perfil correto de PF/PJ. */
export type IdentifiedCustomer<T extends 'individual' | 'company'> = Customer & {
  party_type: T
}

export const isIndividual = (c: Customer): c is IdentifiedCustomer<'individual'> =>
  c.party_type === 'individual'

export const isCompany = (c: Customer): c is IdentifiedCustomer<'company'> =>
  c.party_type === 'company'

/** ADR-009: venda anonima nunca tem cliente; venda identificada sempre tem. */
export type IdentifiedSale = Sale & { sale_type: 'identified'; customer_id: string }
export type AnonymousSale = Sale & { sale_type: 'anonymous'; customer_id: null }
export type TypedSale = IdentifiedSale | AnonymousSale

export const isIdentifiedSale = (s: Sale): s is IdentifiedSale =>
  s.sale_type === 'identified' && s.customer_id !== null

/**
 * ADR-009: so uma venda identificada pode gerar O.S., crediario ou titulo
 * financeiro. Use como porta de entrada desses fluxos.
 */
export function requireIdentifiedSale(sale: Sale): IdentifiedSale {
  if (!isIdentifiedSale(sale)) {
    throw new Error(
      `Venda ${sale.id} e avulsa (anonima): nao pode gerar O.S., crediario ou titulo.`,
    )
  }
  return sale
}
