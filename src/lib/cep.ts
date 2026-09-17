/**
 * Consulta de endereço pelo CEP (ViaCEP).
 *
 * Digitar rua, bairro e cidade à mão no balcão é onde nasce a maior parte dos
 * cadastros errados — e endereço errado é entrega errada. O CEP resolve isso
 * com oito dígitos.
 *
 * O serviço é externo e pode estar fora do ar: a busca NUNCA bloqueia o
 * cadastro. Falhou, o operador digita; o formulário continua inteiro.
 */
export type CepAddress = {
  zipCode: string
  street: string
  district: string
  city: string
  stateCode: string
}

export class CepError extends Error {}

const cache = new Map<string, CepAddress>()

export const onlyDigits = (value: string): string => value.replace(/\D/g, '')

/** 12345678 → 12345-678, enquanto digita. */
export function formatCep(value: string): string {
  const digits = onlyDigits(value).slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

export const isCompleteCep = (value: string): boolean => onlyDigits(value).length === 8

export async function lookupCep(value: string): Promise<CepAddress> {
  const cep = onlyDigits(value)
  if (cep.length !== 8) throw new CepError('CEP deve ter 8 dígitos.')

  const cached = cache.get(cep)
  if (cached) return cached

  let response: Response
  try {
    response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
  } catch {
    throw new CepError('Não foi possível consultar o CEP agora. Preencha manualmente.')
  }
  if (!response.ok) {
    throw new CepError('Não foi possível consultar o CEP agora. Preencha manualmente.')
  }

  const data = (await response.json()) as {
    erro?: boolean | string
    logradouro?: string
    bairro?: string
    localidade?: string
    uf?: string
  }
  // O ViaCEP responde 200 com {"erro": true} para CEP inexistente.
  if (data.erro) throw new CepError('CEP não encontrado.')

  const address: CepAddress = {
    zipCode: formatCep(cep),
    street: data.logradouro ?? '',
    district: data.bairro ?? '',
    city: data.localidade ?? '',
    stateCode: (data.uf ?? '').toUpperCase(),
  }
  cache.set(cep, address)
  return address
}
