import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Traduz os erros que o banco levanta de propósito (constraints e triggers dos
 * ADRs) para mensagens que o operador da ótica entende.
 */
const RULES: { match: RegExp; message: string }[] = [
  {
    match: /dados clinicos sao imutaveis/i,
    message:
      'Esta receita já foi emitida e não pode ser editada. Cadastre uma nova versão da receita.',
  },
  {
    match: /Medidas da receita .* nao podem ser alteradas/i,
    message: 'Receita já emitida: as medidas são definitivas. Crie uma nova versão.',
  },
  {
    match: /Receita utilizada da O\.S\. .* e imutavel/i,
    message:
      'A O.S. já saiu do rascunho: a receita utilizada está congelada. Abra uma nova O.S. ou registre retrabalho.',
  },
  {
    match: /Venda avulsa \(anonima\) nao pode gerar O\.S\./i,
    message: 'Venda avulsa não gera O.S. Identifique o cliente para abrir a ordem de serviço.',
  },
  {
    match: /Forma de pagamento exige cliente identificado/i,
    message: 'Esta forma de pagamento exige cliente identificado. Venda avulsa aceita só à vista.',
  },
  {
    match: /exige altura de montagem/i,
    message: 'Lente multifocal/bifocal exige a altura de montagem de cada olho.',
  },
  {
    match: /exige adicao na receita utilizada/i,
    message: 'Lente multifocal/bifocal exige adição na receita utilizada nesta O.S.',
  },
  {
    match: /Cadastro incompleto: faltam (.+)/i,
    message: 'Cadastro incompleto. Faltam: $1',
  },
  {
    match: /Transicao de status nao permitida/i,
    message: 'Esta mudança de situação não é permitida pelo fluxo de produção configurado.',
  },
  {
    match: /Este usuario ja pertence a uma otica/i,
    message: 'Este usuário já está vinculado a uma ótica.',
  },
  {
    match: /duplicate key value .* individual_profiles_cpf_unique/i,
    message: 'Já existe um cliente com este CPF nesta ótica.',
  },
  {
    match: /duplicate key value .* company_profiles_cnpj_unique/i,
    message: 'Já existe um cliente com este CNPJ nesta ótica.',
  },
  {
    match: /violates check constraint "individual_profiles_cpf_valid"/i,
    message: 'CPF inválido.',
  },
  {
    match: /violates check constraint "company_profiles_cnpj_valid"/i,
    message: 'CNPJ inválido.',
  },
  {
    match: /violates check constraint "sales_customer_matches_type"/i,
    message: 'Venda identificada exige cliente; venda avulsa não pode ter cliente.',
  },
  {
    match: /violates row-level security/i,
    message: 'Você não tem permissão para esta operação nesta filial.',
  },
  {
    match: /stock_balances_reserve_limit|stock_balances_non_negative/i,
    message: 'Estoque insuficiente para reservar ou baixar esta quantidade.',
  },
]

export function describeError(error: unknown): string {
  const raw =
    typeof error === 'string'
      ? error
      : ((error as PostgrestError | Error | null)?.message ?? 'Erro inesperado.')

  for (const rule of RULES) {
    const found = raw.match(rule.match)
    if (found) {
      return rule.message.replace('$1', found[1] ?? '')
    }
  }
  return raw
}
