/**
 * Identidade visual da ótica (white label).
 *
 * Os valores padrão abaixo são o tema do produto: é o que qualquer ótica vê
 * enquanto não personalizar nada. Toda tela lê daqui — nunca de texto fixo no
 * componente — para que a personalização alcance o sistema inteiro.
 */

export type Branding = {
  tenantId: string | null
  slug: string | null

  companyName: string
  shortName: string
  subtitle: string
  logoUrl: string | null
  logoIconUrl: string | null
  faviconUrl: string | null

  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  cardColor: string
  textColor: string

  loginImageUrl: string | null
  loginBackgroundUrl: string | null
  loginHeadline: string
  loginHighlight: string
  loginDescription: string
  benefit1: string
  benefit2: string
  benefit3: string
  loginFootnote: string
}

export const DEFAULT_BRANDING: Branding = {
  tenantId: null,
  slug: null,

  companyName: 'Óticas Uniklin',
  shortName: 'Uniklin',
  subtitle: 'Gestão para óticas',
  logoUrl: null,
  logoIconUrl: null,
  faviconUrl: null,

  primaryColor: '#2a7fff',
  secondaryColor: '#0f2744',
  accentColor: '#38bdf8',
  backgroundColor: '#0a1628',
  cardColor: '#0f2137',
  textColor: '#e8eef7',

  loginImageUrl: null,
  loginBackgroundUrl: null,
  loginHeadline: 'Mais visão para o seu negócio.',
  loginHighlight: 'negócio.',
  loginDescription:
    'Uma plataforma completa para a gestão da sua ótica, com mais praticidade, organização e resultados.',
  benefit1: 'Gestão simplificada',
  benefit2: 'Mais clientes satisfeitos',
  benefit3: 'Seu negócio mais seguro',
  loginFootnote:
    'Foi convidado pela sua ótica? Crie a conta com o mesmo e-mail do convite — o acesso é liberado automaticamente.',
}

/** Linha do banco (ou do preview) → objeto de marca, caindo no padrão. */
export function toBranding(
  row: Partial<Record<string, string | null>> | null | undefined,
  tenantId?: string | null,
): Branding {
  const pick = (key: string, fallback: string): string => {
    const value = row?.[key]
    return value !== null && value !== undefined && value !== '' ? value : fallback
  }
  const pickOrNull = (key: string): string | null => {
    const value = row?.[key]
    return value !== null && value !== undefined && value !== '' ? value : null
  }

  return {
    tenantId: tenantId ?? (row?.['tenant_id'] as string | null) ?? null,
    slug: pickOrNull('slug'),

    companyName: pick('company_name', pick('trade_name', DEFAULT_BRANDING.companyName)),
    shortName: pick('short_name', DEFAULT_BRANDING.shortName),
    subtitle: pick('subtitle', DEFAULT_BRANDING.subtitle),
    logoUrl: pickOrNull('logo_url'),
    logoIconUrl: pickOrNull('logo_icon_url'),
    faviconUrl: pickOrNull('favicon_url'),

    primaryColor: pick('primary_color', DEFAULT_BRANDING.primaryColor),
    secondaryColor: pick('secondary_color', DEFAULT_BRANDING.secondaryColor),
    accentColor: pick('accent_color', DEFAULT_BRANDING.accentColor),
    backgroundColor: pick('background_color', DEFAULT_BRANDING.backgroundColor),
    cardColor: pick('card_color', DEFAULT_BRANDING.cardColor),
    textColor: pick('text_color', DEFAULT_BRANDING.textColor),

    loginImageUrl: pickOrNull('login_image_url'),
    loginBackgroundUrl: pickOrNull('login_background_url'),
    loginHeadline: pick('login_headline', DEFAULT_BRANDING.loginHeadline),
    loginHighlight: pick('login_highlight', DEFAULT_BRANDING.loginHighlight),
    loginDescription: pick('login_description', DEFAULT_BRANDING.loginDescription),
    benefit1: pick('benefit_1', DEFAULT_BRANDING.benefit1),
    benefit2: pick('benefit_2', DEFAULT_BRANDING.benefit2),
    benefit3: pick('benefit_3', DEFAULT_BRANDING.benefit3),
    loginFootnote: pick('login_footnote', DEFAULT_BRANDING.loginFootnote),
  }
}

/**
 * Variáveis CSS da marca. Ficam no elemento que as recebe, então servem tanto
 * para a aplicação inteira (no <html>) quanto para o preview (num contêiner).
 */
export function brandingCssVars(branding: Branding): Record<string, string> {
  return {
    '--brand-primary': branding.primaryColor,
    '--brand-secondary': branding.secondaryColor,
    '--brand-accent': branding.accentColor,
    '--brand-background': branding.backgroundColor,
    '--brand-surface': branding.cardColor,
    '--brand-text': branding.textColor,
  }
}

/**
 * Qual ótica é esta? A tela de login não tem sessão, então o slug vem do
 * subdomínio (uniklin.sistema.com) ou de ?otica=. Sem nenhum dos dois, o banco
 * resolve sozinho quando a instalação tem uma única ótica.
 */
export function resolveTenantSlug(): string | null {
  if (typeof window === 'undefined') return null

  const fromQuery = new URLSearchParams(window.location.search).get('otica')
  if (fromQuery) return fromQuery

  const host = window.location.hostname
  const ignored = ['www', 'localhost', 'app', 'sistema']
  const parts = host.split('.')
  // domínio próprio com subdomínio: uniklin.sistema.com.br
  if (parts.length > 2 && parts[0] && !ignored.includes(parts[0])) {
    return parts[0]
  }
  return null
}

// ---------------------------------------------------------------------------
// Persistência
// ---------------------------------------------------------------------------

/** Campos editáveis na tela de Identidade Visual (tudo menos a identificação). */
export type BrandingField = Exclude<keyof Branding, 'tenantId' | 'slug'>

/** Campo editável → coluna de `tenant_branding`. Único ponto que conhece o de/para. */
export const BRANDING_COLUMNS: Record<BrandingField, string> = {
  companyName: 'company_name',
  shortName: 'short_name',
  subtitle: 'subtitle',
  logoUrl: 'logo_url',
  logoIconUrl: 'logo_icon_url',
  faviconUrl: 'favicon_url',

  primaryColor: 'primary_color',
  secondaryColor: 'secondary_color',
  accentColor: 'accent_color',
  backgroundColor: 'background_color',
  cardColor: 'card_color',
  textColor: 'text_color',

  loginImageUrl: 'login_image_url',
  loginBackgroundUrl: 'login_background_url',
  loginHeadline: 'login_headline',
  loginHighlight: 'login_highlight',
  loginDescription: 'login_description',
  benefit1: 'benefit_1',
  benefit2: 'benefit_2',
  benefit3: 'benefit_3',
  loginFootnote: 'login_footnote',
}

/** Campos que guardam imagem — vão para o storage, nunca para o banco em base64. */
export const BRANDING_IMAGE_FIELDS = [
  'logoUrl',
  'logoIconUrl',
  'faviconUrl',
  'loginImageUrl',
  'loginBackgroundUrl',
] as const

export type BrandingImageField = (typeof BRANDING_IMAGE_FIELDS)[number]

/**
 * Marca → linha do banco. Vazio e "igual ao padrão do produto" viram NULL:
 * ausência de personalização é nulo. É o que faz "restaurar padrão" devolver a
 * ótica ao tema do produto de verdade — e não congelar uma cópia dele.
 */
export function brandingToRow(branding: Branding): Record<string, string | null> {
  const row: Record<string, string | null> = {}
  for (const [field, column] of Object.entries(BRANDING_COLUMNS) as [
    BrandingField,
    string,
  ][]) {
    const value = branding[field]
    row[column] =
      value === null || value === '' || value === DEFAULT_BRANDING[field] ? null : value
  }
  return row
}

/** Cor aceita pelo banco (constraint tenant_branding_colors_format). */
export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}
