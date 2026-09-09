// ============================================================================
// TESTES DE TIPO (compile-time) — rodam com `tsc --noEmit`
// ----------------------------------------------------------------------------
// Cada `@ts-expect-error` e uma assercao: se o erro esperado NAO acontecer, o
// proprio tsc falha ("unused '@ts-expect-error' directive"). Ou seja, este
// arquivo prova que as distincoes dos ADRs estao vigiadas pelo compilador.
// ============================================================================

import type { TablesInsert, Tables } from './database'
import {
  fittingDnp,
  isIdentifiedSale,
  prescribedDnp,
  requireIdentifiedSale,
  type AnonymousSale,
  type Customer,
  type FittingDnpMm,
  type IdentifiedSale,
  type PrescribedDnpMm,
  type Sale,
  type ServiceOrderStatusStage,
} from './domain'

// ---------------------------------------------------------------------------
// ADR-001 — a receita nao aceita atributo de lente
// ---------------------------------------------------------------------------

const receitaValida: TablesInsert<'optical_prescriptions'> = {
  tenant_id: 'uuid',
  customer_id: 'uuid',
  issued_at: '2026-09-04',
}
void receitaValida

const receitaComLente: TablesInsert<'optical_prescriptions'> = {
  tenant_id: 'uuid',
  customer_id: 'uuid',
  issued_at: '2026-09-04',
  // @ts-expect-error ADR-001: material da lente nao existe na receita clinica
  lens_material_id: 'uuid',
}
void receitaComLente

const receitaComTratamento: TablesInsert<'optical_prescriptions'> = {
  tenant_id: 'uuid',
  customer_id: 'uuid',
  issued_at: '2026-09-04',
  // @ts-expect-error ADR-001: tratamento e escolha comercial, vive na O.S.
  treatment_id: 'uuid',
}
void receitaComTratamento

// A especificacao da lente, essa sim, carrega os atributos comerciais:
const lente: TablesInsert<'service_order_lens_specs'> = {
  service_order_id: 'uuid',
  tenant_id: 'uuid',
  eye: 'OD',
  refractive_index: 1.6,
  manufacturer_name: 'Fabricante X',
  supply_mode: 'surfaced',
}
void lente

// ---------------------------------------------------------------------------
// ADR-007 — DNP clinica, DNP de montagem e altura sao tipos diferentes
// ---------------------------------------------------------------------------

declare function centralizarLente(dnpMontagem: FittingDnpMm): void

const dnpDaReceita: PrescribedDnpMm = prescribedDnp(32.0)
const dnpDaMontagem: FittingDnpMm = fittingDnp(32.5)

centralizarLente(dnpDaMontagem)

// @ts-expect-error ADR-007: DNP prescrita nao substitui DNP de montagem
centralizarLente(dnpDaReceita)

// @ts-expect-error ADR-007: number cru tambem nao — obriga passar pelo construtor
centralizarLente(32.5)

// ---------------------------------------------------------------------------
// ADR-009 — venda anonima nunca tem cliente
// ---------------------------------------------------------------------------

declare const vendaQualquer: Sale

if (isIdentifiedSale(vendaQualquer)) {
  const clienteId: string = vendaQualquer.customer_id // estreitado: nao e null
  void clienteId
}

declare const vendaAnonima: AnonymousSale
// @ts-expect-error ADR-009: venda anonima nao pode carregar cliente
const clienteDaAnonima: string = vendaAnonima.customer_id
void clienteDaAnonima

const vendaIdentificada: IdentifiedSale = requireIdentifiedSale(vendaQualquer)
void vendaIdentificada.customer_id.length // string, nao string | null

// ---------------------------------------------------------------------------
// ADR-010 — dominios fechados vindos dos CHECK do banco
// ---------------------------------------------------------------------------

const estagio: ServiceOrderStatusStage = 'awaiting_lab'
void estagio

// @ts-expect-error 'no_lab' e rotulo do tenant (code/label), nao estagio canonico
const estagioInvalido: ServiceOrderStatusStage = 'no_lab'
void estagioInvalido

declare const cliente: Customer
// @ts-expect-error party_type so aceita os valores do CHECK
const tipoInvalido: Customer['party_type'] = 'pessoa_fisica'
void tipoInvalido
void cliente

// ---------------------------------------------------------------------------
// Insert: obrigatorio e o que o banco exige; default e nullable ficam opcionais
// ---------------------------------------------------------------------------

const clienteMinimo: TablesInsert<'customers'> = {
  tenant_id: 'uuid',
  party_type: 'individual',
  display_name: 'Joao da Silva',
}
void clienteMinimo

// @ts-expect-error display_name e NOT NULL sem default: obrigatorio no insert
const clienteSemNome: TablesInsert<'customers'> = {
  tenant_id: 'uuid',
  party_type: 'individual',
}
void clienteSemNome

// O snapshot da O.S. guarda a procedencia da receita (ADR-002)
declare const snapshot: Tables<'service_order_prescriptions'>
const origem: string | null = snapshot.source_prescription_id
const revisao: number | null = snapshot.source_revision
void origem
void revisao
