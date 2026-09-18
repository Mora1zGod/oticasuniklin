import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '@/auth/SessionProvider'
import { useBranding } from '@/branding/BrandingProvider'
import { useTheme, type ThemeChoice } from '@/theme/ThemeProvider'
import { NAV, breadcrumbFor, type NavGroup, type NavItem } from './nav'
import { GlobalSearch, useGlobalSearchHotkey } from './GlobalSearch'
import { NotificationsBell } from './NotificationsBell'
import { InstallButton, PwaNotices } from './PwaNotices'
import { Select, cx } from './ui/primitives'
import {
  IconBuilding,
  IconChevronDown,
  IconChevronRight,
  IconClose,
  IconGlasses,
  IconHome,
  IconIdea,
  IconLogout,
  IconMenu,
  IconMonitor,
  IconMoon,
  IconPin,
  IconSearch,
  IconSun,
} from './ui/icons'

/**
 * O menu lateral tem três estados, e os três existem pelo mesmo motivo: a tela
 * do operador é estreita e o trabalho dele não é navegar.
 *
 *   RECOLHIDO   — o padrão. Só os ícones; a tela inteira é do conteúdo.
 *   PASSAGEM    — o ponteiro encosta e o menu abre por cima, sem empurrar nada.
 *                 Some quando o ponteiro sai. Não existe onde não há ponteiro:
 *                 no toque, "passar por cima" não é um gesto.
 *   FIXADO      — quem navega o dia inteiro prega o menu aberto, e ele passa a
 *                 ocupar lugar no leiaute. A escolha fica guardada.
 *
 * Em tela estreita nada disso vale: o menu é uma gaveta que entra por cima e
 * fecha assim que a pessoa escolhe para onde vai.
 */
const PIN_KEY = 'sidebar_pinned'
const OPEN_GROUPS_KEY = 'uniklin.menu.groups'

/**
 * Quantos grupos ficam abertos ao mesmo tempo. Dois: o do trabalho de agora e
 * o que ele consulta. Mais que isso e a lista volta a ser um paredão.
 */
const MAX_OPEN_GROUPS = 2

const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

export function AppShell() {
  const { context, branchId, setBranchId, can, signOut, tenants, isPlatformOwner } =
    useSession()
  const { branding } = useBranding()
  const navigate = useNavigate()
  const location = useLocation()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)

  const [pinned, setPinned] = useState(readPinned)
  const [hovering, setHovering] = useState(false)
  const canHover = useMedia('(hover: hover) and (pointer: fine)')
  const isDesktop = useMedia('(min-width: 1024px)')

  useGlobalSearchHotkey(() => setSearchOpen(true))

  // Trocar de tela fecha o que estava aberto por cima dela — inclusive a
  // gaveta, que em tela estreita cobre o conteúdo.
  useEffect(() => {
    setDrawerOpen(false)
    setUserOpen(false)
  }, [location.pathname])

  const groups = useMemo(
    () =>
      NAV
        // O grupo da plataforma não é um nível de permissão dentro da ótica:
        // é uma relação entre óticas, e só a dona a tem.
        .filter((group) => !group.platformOnly || isPlatformOwner)
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !item.permission || can(item.permission)),
        }))
        .filter((group) => group.items.length > 0),
    [can, isPlatformOwner],
  )

  // ------------------------------- Acordeão -------------------------------
  const [openGroups, setOpenGroups] = useState<string[]>(() => readOpenGroups() ?? [])

  const activeGroupId = useMemo(
    () => groups.find((group) => group.items.some((item) => matches(item, location.pathname)))?.id,
    [groups, location.pathname],
  )

  // Chegou numa tela por link direto ou pela busca: o grupo dela se abre, sem
  // que ninguém precise caçar onde está.
  useEffect(() => {
    if (!activeGroupId) return
    setOpenGroups((previous) =>
      previous.includes(activeGroupId)
        ? previous
        : writeOpenGroups([...previous, activeGroupId].slice(-MAX_OPEN_GROUPS)),
    )
  }, [activeGroupId])

  // Primeira visita: o menu não abre vazio. Sem preferência guardada e sem
  // grupo ativo (o painel inicial não pertence a nenhum), o primeiro grupo
  // fica aberto — o operador vê que aquilo abre.
  useEffect(() => {
    if (readOpenGroups() !== null) return
    const first = groups[0]?.id
    if (first) setOpenGroups(writeOpenGroups([first]))
  }, [groups])

  const toggleGroup = useCallback((id: string) => {
    setOpenGroups((previous) =>
      writeOpenGroups(
        previous.includes(id)
          ? previous.filter((other) => other !== id)
          : // O terceiro empurra o mais antigo para fora.
            [...previous, id].slice(-MAX_OPEN_GROUPS),
      ),
    )
  }, [])

  const togglePin = () => {
    setPinned((previous) => {
      writePinned(!previous)
      return !previous
    })
  }

  if (context?.status !== 'ready') return null

  const branch = context.branches.find((b) => b.id === branchId)
  const trail = breadcrumbFor(location.pathname)

  /**
   * O menu está mostrando os rótulos?
   *
   * Em tela larga, quando fixado ou sob o ponteiro. Em tela estreita ele é uma
   * gaveta e sempre aparece inteiro — lá não existe trilho de ícones.
   */
  const expanded = isDesktop ? pinned || (canHover && hovering) : true

  return (
    <div className="flex h-full bg-canvas pt-[env(safe-area-inset-top)]">
      {/* A gaveta de tela estreita escurece o que está atrás e fecha ao toque. */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink-950/60 backdrop-blur-[1px] lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
      )}

      {/*
        O lugar que o menu ocupa no leiaute. Fixado, ele empurra o conteúdo;
        aberto só de passagem, não — senão a tela toda dançaria a cada vez que
        o ponteiro encostasse na borda.
      */}
      <div
        className={cx(
          'hidden shrink-0 transition-[width] duration-200 ease-out lg:block',
          pinned ? 'w-64' : 'w-[4.5rem]',
        )}
        aria-hidden
      />

      {/* ------------------------------ Menu ------------------------------ */}
      <aside
        onMouseEnter={canHover ? () => setHovering(true) : undefined}
        onMouseLeave={canHover ? () => setHovering(false) : undefined}
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar',
          'transition-[width,transform] duration-200 ease-out',
          'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
          // Tela estreita: gaveta que entra pela esquerda.
          'w-72 max-lg:shadow-2xl',
          drawerOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full',
          // Tela larga: trilho ou painel, e sombra só quando abre por cima.
          expanded ? 'lg:w-64' : 'lg:w-[4.5rem]',
          !pinned && expanded && 'lg:shadow-2xl lg:shadow-ink-950/40',
        )}
      >
        {/* Marca */}
        <button
          onClick={() => navigate('/')}
          className="flex h-16 shrink-0 items-center gap-2.5 px-4 text-left"
          title={branding.companyName}
        >
          {branding.logoIconUrl ? (
            <img
              src={branding.logoIconUrl}
              alt=""
              className="size-9 shrink-0 rounded-lg object-contain"
            />
          ) : (
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              <IconGlasses className="size-5" />
            </span>
          )}
          <span
            className={cx(
              'min-w-0 transition-opacity duration-200',
              expanded ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          >
            <span className="block truncate text-[0.9375rem] leading-tight font-semibold text-white">
              {branding.companyName}
            </span>
            <span className="block truncate text-[0.6875rem] leading-tight text-sidebar-fg/60">
              {branding.subtitle}
            </span>
          </span>
        </button>

        <nav className="scroll-none min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2.5 pb-3">
          <MenuLink
            to="/"
            end
            icon={IconHome}
            label="Início"
            expanded={expanded}
            onNavigate={() => setDrawerOpen(false)}
          />

          <div className="mt-2 space-y-1">
            {groups.map((group) => (
              <MenuGroup
                key={group.id}
                group={group}
                expanded={expanded}
                open={openGroups.includes(group.id)}
                onToggle={() => toggleGroup(group.id)}
                pathname={location.pathname}
                onNavigate={() => setDrawerOpen(false)}
              />
            ))}
          </div>
        </nav>

        {expanded && (
          <div className="shrink-0 px-3 pb-2">
            <div className="flex items-start gap-2.5 rounded-lg bg-white/6 px-3 py-2.5">
              <span
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-white"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                <IconIdea className="size-4" />
              </span>
              <p className="text-[0.6875rem] leading-snug text-sidebar-fg/80">
                <span className="block font-semibold text-white">Óticas que crescem</span>
                usam {branding.shortName}.
              </p>
            </div>
          </div>
        )}

        {/* Fixar: a única coisa que o operador decide sobre o menu. */}
        <button
          onClick={togglePin}
          aria-pressed={pinned}
          title={pinned ? 'Soltar o menu' : 'Fixar o menu aberto'}
          className={cx(
            'hidden shrink-0 items-center gap-2.5 px-5 py-3 text-[0.75rem]',
            'text-sidebar-fg/70 transition-colors hover:text-white lg:flex',
          )}
        >
          <IconPin
            className={cx('size-4 shrink-0 transition-transform', !pinned && 'rotate-45')}
          />
          {expanded && (pinned ? 'Soltar o menu' : 'Fixar o menu')}
        </button>
      </aside>

      {/* ---------------------------- Conteúdo ---------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:gap-3 sm:px-4">
          <button
            onClick={() => setDrawerOpen((v) => !v)}
            className="rounded-md p-2 text-fg-muted hover:bg-surface-sunken lg:hidden"
            aria-label={drawerOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={drawerOpen}
          >
            {drawerOpen ? <IconClose className="size-5" /> : <IconMenu className="size-5" />}
          </button>

          {/* Busca global */}
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Buscar no sistema"
            className={cx(
              'flex h-10 items-center gap-2 rounded-xl border border-line bg-canvas',
              'text-sm text-fg-subtle transition-colors hover:border-line-strong',
              // No celular o cabeçalho é disputado: a busca vira só o ícone.
              'w-10 shrink-0 justify-center px-0 sm:w-auto sm:min-w-0 sm:flex-1 sm:justify-start sm:px-3 sm:max-w-xl',
            )}
          >
            <IconSearch className="size-4 shrink-0" />
            <span className="hidden truncate sm:block">
              Buscar cliente, O.S., venda ou tela…
            </span>
            <kbd className="ml-auto hidden shrink-0 rounded border border-line px-1.5 py-0.5 text-[0.625rem] text-fg-subtle sm:block">
              Ctrl K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <TenantSwitcher current={context.tenant.slug} tenants={tenants} />

            {context.branches.length > 1 ? (
              <label className="relative hidden md:block">
                <IconPin className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-subtle" />
                <Select
                  value={branchId ?? ''}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="h-10 w-48 py-0 pl-8 text-xs"
                  aria-label="Filial"
                >
                  {context.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.trade_name}
                    </option>
                  ))}
                </Select>
              </label>
            ) : (
              <span className="hidden items-center gap-1.5 rounded-lg bg-surface-sunken px-2.5 py-2 text-xs font-medium text-fg-muted md:flex">
                <IconPin className="size-3.5 text-fg-subtle" />
                {branch?.trade_name}
              </span>
            )}

            <InstallButton />
            <ThemeSwitch />
            <NotificationsBell />

            {/* Usuário */}
            <div className="relative">
              <button
                onClick={() => setUserOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg p-1 pr-1.5 hover:bg-surface-sunken"
                aria-haspopup="menu"
                aria-expanded={userOpen}
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                  {initials(context.full_name)}
                </span>
                <span className="hidden text-left leading-tight lg:block">
                  <span className="block text-xs font-semibold text-fg">
                    {context.full_name}
                  </span>
                  <span className="block text-[0.6875rem] text-fg-subtle">
                    {context.is_tenant_admin ? 'Administrador' : (branch?.role ?? '')}
                  </span>
                </span>
                <IconChevronDown className="hidden size-4 text-fg-subtle lg:block" />
              </button>

              {userOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1.5 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
                    <div className="border-b border-line px-2.5 py-2">
                      <p className="truncate text-sm font-medium text-fg">
                        {context.full_name}
                      </p>
                      <p className="truncate text-xs text-fg-subtle">{context.email}</p>
                    </div>

                    {context.branches.length > 1 && (
                      <div className="border-b border-line px-2.5 py-2 md:hidden">
                        <p className="mb-1 text-[0.6875rem] text-fg-subtle">Filial</p>
                        <Select
                          value={branchId ?? ''}
                          onChange={(e) => setBranchId(e.target.value)}
                          className="h-9 py-0 text-xs"
                          aria-label="Filial"
                        >
                          {context.branches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.trade_name}
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}

                    <button
                      onClick={() => void signOut()}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-fg-muted hover:bg-surface-sunken hover:text-fg"
                    >
                      <IconLogout className="size-4" />
                      Sair
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div
            className={
              'mx-auto flex min-h-full max-w-[1600px] flex-col p-4 sm:p-6 ' +
              'pb-[max(1rem,env(safe-area-inset-bottom))] ' +
              'pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] ' +
              'sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]'
            }
          >
            {trail.length > 0 && (
              <nav
                aria-label="Você está em"
                className="mb-3 flex flex-wrap items-center gap-1 text-xs text-fg-subtle"
              >
                {trail.map((step, index) => (
                  <span key={step.label + index} className="flex items-center gap-1">
                    {index > 0 && <IconChevronRight className="size-3" />}
                    {step.to ? (
                      <NavLink to={step.to} className="hover:text-fg">
                        {step.label}
                      </NavLink>
                    ) : (
                      <span className={index === trail.length - 1 ? 'text-fg-muted' : ''}>
                        {step.label}
                      </span>
                    )}
                  </span>
                ))}
              </nav>
            )}

            <div className="flex-1">
              <Outlet />
            </div>

            <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-[0.6875rem] text-fg-subtle">
              <span>
                {branding.companyName} · © {new Date().getFullYear()}
              </span>
              <span>{context.tenant.slug}</span>
            </footer>
          </div>
        </main>
      </div>

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
      <PwaNotices />
    </div>
  )
}

// ---------------------------------------------------------------------------

const matches = (item: NavItem, pathname: string): boolean =>
  item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + '/')

/**
 * Item do menu. Recolhido, o rótulo vira etiqueta ao lado do ícone — é o que
 * permite navegar pelo teclado ou reconhecer um ícone sem abrir o menu.
 */
function MenuLink({
  to,
  end,
  icon: Icon,
  label,
  expanded,
  onNavigate,
}: {
  to: string
  end?: boolean
  icon: NavItem['icon']
  label: string
  expanded: boolean
  onNavigate: () => void
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      title={label}
      className={({ isActive }) =>
        cx(
          'group relative flex items-center gap-2.5 rounded-lg px-2.5 text-[0.8125rem]',
          'py-2.5 transition-colors lg:py-2',
          isActive
            ? 'font-medium text-white'
            : 'text-sidebar-fg/80 hover:bg-white/8 hover:text-white',
        )
      }
      style={({ isActive }) =>
        // A cor do item ativo é a da ótica, não uma cor do produto.
        isActive ? { backgroundColor: 'var(--brand-primary)' } : undefined
      }
    >
      <Icon className="size-4.5 shrink-0" />
      <span className={cx('truncate transition-opacity duration-200', !expanded && 'hidden')}>
        {label}
      </span>

      {!expanded && (
        <span
          className={cx(
            'pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap',
            'rounded-md bg-ink-950 px-2 py-1 text-xs text-white opacity-0 shadow-lg',
            'transition-opacity duration-150 group-hover:opacity-100',
            'group-focus-visible:opacity-100 lg:block',
          )}
          role="tooltip"
        >
          {label}
        </span>
      )}
    </NavLink>
  )
}

/**
 * Grupo do menu: o título abre e fecha a lista, e a escolha fica guardada.
 * Recolhido, o grupo vira um traço entre os ícones — continua separando os
 * contextos do domínio sem gastar largura com o nome.
 */
function MenuGroup({
  group,
  expanded,
  open,
  onToggle,
  pathname,
  onNavigate,
}: {
  group: NavGroup
  expanded: boolean
  open: boolean
  onToggle: () => void
  pathname: string
  onNavigate: () => void
}) {
  const hasActive = group.items.some((item) => matches(item, pathname))

  // Recolhido não há acordeão: esconder ícone atrás de um título que não
  // aparece deixaria telas inalcançáveis.
  const showItems = expanded ? open || hasActive : true

  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={open || hasActive}
        title={group.label}
        className={cx(
          'flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5',
          'text-[0.6875rem] font-semibold tracking-wider uppercase transition-colors',
          hasActive ? 'text-sidebar-fg' : 'text-sidebar-fg/55',
          'hover:text-white',
          !expanded && 'hidden',
        )}
      >
        <IconChevronDown
          className={cx(
            'size-3.5 shrink-0 transition-transform duration-200',
            !(open || hasActive) && '-rotate-90',
          )}
        />
        <span className="truncate">{group.label}</span>
      </button>

      {!expanded && <div className="mx-2.5 my-1 border-t border-white/10" />}

      {showItems && (
        <div className="mt-0.5 space-y-0.5">
          {group.items.map((item) => (
            <MenuLink
              key={item.to}
              to={item.to}
              end={item.end}
              icon={item.icon}
              label={item.label}
              expanded={expanded}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Seletor de ótica: só existe para quem alcança mais de uma — hoje, a ótica
 * que opera a plataforma. Trocar de ótica é ir para o endereço dela, porque é
 * o endereço que diz ao banco em qual ótica a sessão está.
 */
function TenantSwitcher({
  current,
  tenants,
}: {
  current: string
  tenants: { tenant_id: string; slug: string; trade_name: string }[]
}) {
  if (tenants.length < 2) return null
  return (
    <label className="relative hidden lg:block">
      <IconBuilding className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-subtle" />
      <Select
        value={current}
        onChange={(event) => {
          if (event.target.value !== current) {
            window.location.assign(`/${event.target.value}/`)
          }
        }}
        className="h-10 w-44 py-0 pl-8 text-xs"
        aria-label="Ótica"
      >
        {tenants.map((tenant) => (
          <option key={tenant.tenant_id} value={tenant.slug}>
            {tenant.trade_name}
          </option>
        ))}
      </Select>
    </label>
  )
}

// --------------------------- Preferências guardadas -------------------------

function readPinned(): boolean {
  try {
    return localStorage.getItem(PIN_KEY) === 'true'
  } catch {
    return false
  }
}

function writePinned(value: boolean): void {
  try {
    localStorage.setItem(PIN_KEY, String(value))
  } catch {
    // sem storage a preferência não persiste; o menu continua funcionando
  }
}

/** Preferência guardada, ou `null` quando ainda não há nenhuma. */
function readOpenGroups(): string[] | null {
  try {
    const raw = localStorage.getItem(OPEN_GROUPS_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? (parsed.filter((id) => typeof id === 'string') as string[]).slice(-MAX_OPEN_GROUPS)
      : null
  } catch {
    return null
  }
}

function writeOpenGroups(ids: string[]): string[] {
  try {
    localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(ids))
  } catch {
    // idem
  }
  return ids
}

/**
 * Acompanha uma consulta de mídia.
 *
 * Duas perguntas do menu dependem disto. "Existe ponteiro de verdade?" — num
 * tablet, passar por cima não é gesto nenhum: o navegador simula o hover no
 * toque e o menu abriria sozinho ao tocar em qualquer item. E "a tela é larga?"
 * — abaixo disso o menu é gaveta, e gaveta não tem trilho de ícones.
 */
function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(
    () => window.matchMedia?.(query).matches ?? false,
  )
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/** Claro, escuro ou o que o sistema operacional estiver usando. */
const THEME_OPTIONS: {
  value: ThemeChoice
  label: string
  icon: typeof IconSun
}[] = [
  { value: 'light', label: 'Tema claro', icon: IconSun },
  { value: 'dark', label: 'Tema escuro', icon: IconMoon },
  { value: 'system', label: 'Acompanhar o sistema', icon: IconMonitor },
]

function ThemeSwitch() {
  const { choice, resolved, toggle, setChoice } = useTheme()
  return (
    <>
      <button
        onClick={toggle}
        aria-label={resolved === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
        className="rounded-lg p-2 text-fg-muted hover:bg-surface-sunken hover:text-fg sm:hidden"
      >
        {resolved === 'dark' ? (
          <IconSun className="size-5" />
        ) : (
          <IconMoon className="size-5" />
        )}
      </button>

      <div
        className="hidden items-center gap-0.5 rounded-lg bg-surface-sunken p-0.5 sm:flex"
        role="group"
        aria-label="Tema"
      >
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setChoice(value)}
            aria-label={label}
            aria-pressed={choice === value}
            title={label}
            className={cx(
              'rounded-md p-1.5 transition-colors',
              choice === value
                ? 'bg-surface text-fg shadow-xs'
                : 'text-fg-subtle hover:text-fg',
            )}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
    </>
  )
}
