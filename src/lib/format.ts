const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export const formatMoney = (value: number | null | undefined): string =>
  money.format(value ?? 0)

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  // Datas puras (YYYY-MM-DD) não podem passar por fuso: viram o dia anterior.
  const parts = value.slice(0, 10).split('-')
  const [y, m, d] = [parts[0], parts[1], parts[2]]
  if (!y || !m || !d) return '—'
  return dateFmt.format(new Date(Number(y), Number(m) - 1, Number(d)))
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return dateTimeFmt.format(new Date(value))
}

export const today = (): string => new Date().toISOString().slice(0, 10)

/** Grau ótico: sempre com sinal e duas casas (-2,00 / +1,75). */
export function formatDiopter(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${Math.abs(value).toFixed(2).replace('.', ',')}`
}

export function formatMm(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${value.toFixed(1).replace('.', ',')} mm`
}

export const digitsOnly = (value: string): string => value.replace(/\D/g, '')

export function formatDocument(value: string | null | undefined): string {
  const v = digitsOnly(value ?? '')
  if (v.length === 11) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (v.length === 14) return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return value ?? '—'
}

export function formatPhone(value: string | null | undefined): string {
  const v = digitsOnly(value ?? '')
  if (v.length === 13) return v.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4')
  if (v.length === 11) return v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (v.length === 10) return v.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return value ?? '—'
}

/** Validação de CPF idêntica à do banco (public.is_valid_cpf). */
export function isValidCpf(value: string): boolean {
  const v = digitsOnly(value)
  if (v.length !== 11 || /^(\d)\1{10}$/.test(v)) return false
  const digit = (len: number): number => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(v[i]) * (len + 1 - i)
    const d = 11 - (sum % 11)
    return d >= 10 ? 0 : d
  }
  return digit(9) === Number(v[9]) && digit(10) === Number(v[10])
}

/** Validação de CNPJ idêntica à do banco (public.is_valid_cnpj). */
export function isValidCnpj(value: string): boolean {
  const v = digitsOnly(value)
  if (v.length !== 14 || /^(\d)\1{13}$/.test(v)) return false
  const digit = (weights: number[]): number => {
    const sum = weights.reduce((acc, w, i) => acc + Number(v[i]) * w, 0)
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }
  const d1 = digit([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = digit([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return d1 === Number(v[12]) && d2 === Number(v[13])
}
