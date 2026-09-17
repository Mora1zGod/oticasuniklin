import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppContext, useSession } from '@/auth/SessionProvider'
import { useBranding } from '@/branding/BrandingProvider'
import {
  BRANDING_IMAGE_FIELDS,
  DEFAULT_BRANDING,
  brandingToRow,
  isHexColor,
  toBranding,
  type Branding,
  type BrandingImageField,
} from '@/branding/branding'
import { LoginPreview } from '@/pages/auth/LoginPreview'
import { Alert, Button, Card, Field, Input, PageHeader, Textarea } from '@/components/ui/primitives'
import { Spinner } from '@/components/ui/Spinner'
import { describeError } from '@/lib/errors'
import type { Database } from '@/types/database'

type BrandingInsert = Database['public']['Tables']['tenant_branding']['Insert']

/** O bucket `branding` (migration 0012) aceita só isto — repetido aqui para dar
 *  a mensagem antes de subir o arquivo, não depois do erro do storage. */
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon']
const MAX_BYTES = 2 * 1024 * 1024

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
}

/**
 * Identidade visual da ótica (white label).
 *
 * Duas regras moldam esta tela:
 *  - só SALVAR persiste. Enquanto o administrador edita, nada sai do navegador —
 *    nem o texto, nem as imagens escolhidas (que só sobem ao storage no save).
 *  - o preview é a tela de login de verdade (LoginPreview), não uma imitação.
 */
export function BrandingPage() {
  const ctx = useAppContext()
  const { can } = useSession()
  const { refresh } = useBranding()
  const queryClient = useQueryClient()

  const [draft, setDraft] = useState<Branding | null>(null)
  const [files, setFiles] = useState<Partial<Record<BrandingImageField, File>>>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const allowed = can('admin.manage')

  const current = useQuery({
    queryKey: ['tenant-branding', ctx.tenant_id],
    queryFn: async (): Promise<Branding> => {
      const { data, error: err } = await supabase
        .from('tenant_branding')
        .select('*')
        .eq('tenant_id', ctx.tenant_id)
        .maybeSingle()
      if (err) throw err
      return toBranding(
        { company_name: ctx.tenant.trade_name, ...(data ?? {}) },
        ctx.tenant_id,
      )
    },
  })

  // A edição começa do que está salvo; recarregar depois do save traz o novo.
  useEffect(() => {
    if (current.data) setDraft(current.data)
  }, [current.data])

  // Imagem escolhida ainda não existe no servidor: o preview usa uma URL local.
  const localUrls = useMemo(() => {
    const urls: Partial<Record<BrandingImageField, string>> = {}
    for (const field of BRANDING_IMAGE_FIELDS) {
      const file = files[field]
      if (file) urls[field] = URL.createObjectURL(file)
    }
    return urls
  }, [files])

  useEffect(
    () => () => {
      for (const url of Object.values(localUrls)) URL.revokeObjectURL(url)
    },
    [localUrls],
  )

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) return
      setError(null)

      const next: Branding = { ...draft }

      // Só agora os arquivos sobem — antes disso, cancelar não deixa lixo.
      for (const field of BRANDING_IMAGE_FIELDS) {
        const file = files[field]
        if (!file) continue
        const ext = EXTENSIONS[file.type] ?? 'bin'
        // A pasta é o tenant: é assim que a policy do storage isola cada ótica.
        const path = `${ctx.tenant_id}/${field}-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('branding')
          .upload(path, file, { contentType: file.type, upsert: false })
        if (upErr) throw upErr
        next[field] = supabase.storage.from('branding').getPublicUrl(path).data.publicUrl
      }

      const payload = {
        tenant_id: ctx.tenant_id,
        ...brandingToRow(next),
      } as BrandingInsert

      const { error: err } = await supabase.from('tenant_branding').upsert(payload)
      if (err) throw err
      return next
    },
    onSuccess: async () => {
      setFiles({})
      setSaved(true)
      await queryClient.invalidateQueries({ queryKey: ['tenant-branding'] })
      await refresh()
    },
    onError: (err) => setError(describeError(err)),
  })

  if (!allowed) {
    return (
      <>
        <PageHeader title="Identidade visual" />
        <Alert>
          Só quem administra a ótica pode alterar a identidade visual. Peça a um
          administrador.
        </Alert>
      </>
    )
  }

  if (current.isLoading || !draft) return <Spinner />
  if (current.error) return <Alert>{describeError(current.error)}</Alert>

  const preview: Branding = { ...draft, ...localUrls }

  const set = (patch: Partial<Branding>) => {
    setDraft({ ...draft, ...patch })
    setSaved(false)
  }

  const chooseFile = (field: BrandingImageField, file: File | null) => {
    if (!file) return
    if (!ACCEPTED.includes(file.type)) {
      setError(`"${file.name}": use PNG, JPEG, WEBP, SVG ou ICO.`)
      return
    }
    if (file.size > MAX_BYTES) {
      setError(`"${file.name}" tem ${(file.size / 1024 / 1024).toFixed(1)} MB. O limite é 2 MB.`)
      return
    }
    setError(null)
    setFiles({ ...files, [field]: file })
    setSaved(false)
  }

  const removeImage = (field: BrandingImageField) => {
    const rest = { ...files }
    delete rest[field]
    setFiles(rest)
    set({ [field]: null } as Partial<Branding>)
  }

  const dirty =
    Object.keys(files).length > 0 ||
    JSON.stringify(draft) !== JSON.stringify(current.data)

  const invalidColor = COLORS.some(({ field }) => !isHexColor(draft[field]))
  const canSave = dirty && !invalidColor && draft.companyName.trim() !== ''

  return (
    <>
      <PageHeader
        title="Identidade visual"
        subtitle="Nome, logo, cores e textos da tela de login desta ótica. Cada ótica tem a sua."
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setDraft(current.data ?? DEFAULT_BRANDING)
                setFiles({})
                setError(null)
                setSaved(false)
              }}
              disabled={!dirty || save.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDraft({
                  ...DEFAULT_BRANDING,
                  tenantId: draft.tenantId,
                  slug: draft.slug,
                  companyName: ctx.tenant.trade_name,
                })
                setFiles({})
                setError(null)
                setSaved(false)
              }}
              disabled={save.isPending}
            >
              Restaurar padrão
            </Button>
            <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending}>
              {save.isPending ? 'Salvando…' : 'Salvar alterações'}
            </Button>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {saved && !dirty && (
        <div className="mb-4">
          <Alert tone="success">Identidade visual salva.</Alert>
        </div>
      )}
      {dirty && (
        <div className="mb-4">
          <Alert tone="info">
            Alterações ainda não salvas — o preview já mostra como vai ficar.
          </Alert>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,27rem)_minmax(0,1fr)]">
        {/* ------------------------- Edição ------------------------- */}
        <div className="order-last space-y-5 xl:order-none">
          <Card title="Identidade">
            <div className="space-y-3">
              <Field label="Nome da ótica" required>
                <Input
                  value={draft.companyName}
                  onChange={(e) => set({ companyName: e.target.value })}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome curto" hint="Usado onde falta espaço.">
                  <Input
                    value={draft.shortName}
                    onChange={(e) => set({ shortName: e.target.value })}
                  />
                </Field>
                <Field label="Subtítulo">
                  <Input
                    value={draft.subtitle}
                    onChange={(e) => set({ subtitle: e.target.value })}
                  />
                </Field>
              </div>

              <ImageField
                label="Logo"
                hint="Aparece no lugar do nome, na tela de login."
                url={preview.logoUrl}
                pending={Boolean(files.logoUrl)}
                onChoose={(file) => chooseFile('logoUrl', file)}
                onRemove={() => removeImage('logoUrl')}
              />
              <ImageField
                label="Logo reduzida"
                hint="Símbolo quadrado, sem o nome escrito."
                url={preview.logoIconUrl}
                pending={Boolean(files.logoIconUrl)}
                onChoose={(file) => chooseFile('logoIconUrl', file)}
                onRemove={() => removeImage('logoIconUrl')}
              />
              <ImageField
                label="Favicon"
                hint="Ícone da aba do navegador."
                url={preview.faviconUrl}
                pending={Boolean(files.faviconUrl)}
                onChoose={(file) => chooseFile('faviconUrl', file)}
                onRemove={() => removeImage('faviconUrl')}
              />
            </div>
          </Card>

          <Card title="Cores">
            <div className="space-y-3">
              {COLORS.map(({ field, label, hint }) => (
                <ColorField
                  key={field}
                  label={label}
                  hint={hint}
                  value={draft[field]}
                  onChange={(value) => set({ [field]: value } as Partial<Branding>)}
                />
              ))}
            </div>
          </Card>

          <Card title="Tela de login">
            <div className="space-y-3">
              <ImageField
                label="Imagem lateral"
                hint="Foto institucional à direita. Sem ela, o login usa só as cores."
                url={preview.loginImageUrl}
                pending={Boolean(files.loginImageUrl)}
                onChoose={(file) => chooseFile('loginImageUrl', file)}
                onRemove={() => removeImage('loginImageUrl')}
              />
              <ImageField
                label="Imagem de fundo"
                hint="Cobre a tela inteira, por trás de tudo."
                url={preview.loginBackgroundUrl}
                pending={Boolean(files.loginBackgroundUrl)}
                onChoose={(file) => chooseFile('loginBackgroundUrl', file)}
                onRemove={() => removeImage('loginBackgroundUrl')}
              />

              <Field label="Frase principal">
                <Input
                  value={draft.loginHeadline}
                  onChange={(e) => set({ loginHeadline: e.target.value })}
                />
              </Field>
              <Field
                label="Palavra destacada"
                hint="Trecho final da frase, pintado com a cor primária."
                error={
                  draft.loginHighlight &&
                  !draft.loginHeadline.includes(draft.loginHighlight)
                    ? 'Este trecho não aparece na frase principal — nada será destacado.'
                    : null
                }
              >
                <Input
                  value={draft.loginHighlight}
                  onChange={(e) => set({ loginHighlight: e.target.value })}
                />
              </Field>
              <Field label="Texto institucional">
                <Textarea
                  value={draft.loginDescription}
                  onChange={(e) => set({ loginDescription: e.target.value })}
                />
              </Field>

              <div className="space-y-3">
                <Field label="Benefício 1">
                  <Input
                    value={draft.benefit1}
                    onChange={(e) => set({ benefit1: e.target.value })}
                  />
                </Field>
                <Field label="Benefício 2">
                  <Input
                    value={draft.benefit2}
                    onChange={(e) => set({ benefit2: e.target.value })}
                  />
                </Field>
                <Field label="Benefício 3">
                  <Input
                    value={draft.benefit3}
                    onChange={(e) => set({ benefit3: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="Texto inferior" hint="Abaixo do formulário de acesso.">
                <Textarea
                  value={draft.loginFootnote}
                  onChange={(e) => set({ loginFootnote: e.target.value })}
                />
              </Field>
            </div>
          </Card>
        </div>

        {/* ------------------------- Preview ------------------------- */}
        {/* Em tela estreita o preview vem antes: é a referência de tudo que
            vem abaixo, e ninguém deveria rolar até o fim para vê-lo. */}
        <div className="order-first xl:order-none xl:sticky xl:top-4 xl:self-start">
          <Card
            title="Preview da tela de login"
            actions={
              <span className="text-xs text-fg-subtle">Atualiza enquanto você edita</span>
            }
            bodyClassName="p-3"
          >
            <PreviewFrame branding={preview} />
            <p className="mt-3 text-xs text-fg-subtle">
              É a tela de login de verdade, em escala reduzida — o que aparece aqui é
              exatamente o que o cliente vê ao acessar.
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------

const COLORS: { field: 'primaryColor' | 'secondaryColor' | 'accentColor' | 'backgroundColor' | 'cardColor' | 'textColor'; label: string; hint: string }[] = [
  { field: 'primaryColor', label: 'Primária', hint: 'Botões, destaques e a palavra da frase principal.' },
  { field: 'secondaryColor', label: 'Secundária', hint: 'Apoio da cor primária.' },
  { field: 'accentColor', label: 'Destaque', hint: 'Links e ícones.' },
  { field: 'backgroundColor', label: 'Fundo', hint: 'Fundo da tela de login.' },
  { field: 'cardColor', label: 'Cards', hint: 'Fundo do cartão de acesso.' },
  { field: 'textColor', label: 'Textos', hint: 'Cor do texto sobre o fundo.' },
]

function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: string
  onChange: (value: string) => void
}) {
  const valid = isHexColor(value)
  return (
    <Field
      label={label}
      hint={hint}
      error={valid ? null : 'Use um hexadecimal de 6 dígitos, como #2a7fff.'}
    >
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={valid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="size-9.5 shrink-0 cursor-pointer rounded-lg border border-line-strong bg-surface p-1"
          aria-label={`Cor ${label}`}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="font-mono"
        />
      </div>
    </Field>
  )
}

function ImageField({
  label,
  hint,
  url,
  pending,
  onChoose,
  onRemove,
}: {
  label: string
  hint: string
  url: string | null
  /** Escolhida agora e ainda não salva. */
  pending: boolean
  onChoose: (file: File | null) => void
  onRemove: () => void
}) {
  const input = useRef<HTMLInputElement>(null)

  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-fg-muted">{label}</span>
      <div className="flex items-center gap-3 rounded-lg border border-line bg-canvas p-2.5">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface">
          {url ? (
            <img src={url} alt="" className="size-full object-contain" />
          ) : (
            <span className="text-[0.625rem] text-fg-subtle">sem imagem</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-fg-subtle">{hint}</p>
          <p className="mt-1 text-[0.6875rem] text-fg-subtle">
            PNG, JPEG, WEBP, SVG ou ICO · até 2 MB
            {pending && ' · será enviada ao salvar'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => input.current?.click()}>
              Enviar imagem
            </Button>
            {url && (
              <Button size="sm" variant="ghost" onClick={onRemove}>
                Remover
              </Button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(e) => {
          onChoose(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
    </div>
  )
}

/**
 * O login é uma tela de largura cheia: mostrá-lo numa coluna estreita mudaria a
 * composição. Por isso ele é montado no tamanho real e reduzido por escala —
 * o que se vê é proporção verdadeira, não outro layout.
 */
const LOGICAL_W = 1180
const LOGICAL_H = 740

function PreviewFrame({ branding }: { branding: Branding }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / LOGICAL_W)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={box}
      className="relative w-full overflow-hidden rounded-lg border border-line"
      style={{ height: LOGICAL_H * scale }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ width: LOGICAL_W, height: LOGICAL_H, transform: `scale(${scale})` }}
      >
        <LoginPreview branding={branding} />
      </div>
    </div>
  )
}
