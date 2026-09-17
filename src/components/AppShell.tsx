import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '@/auth/SessionProvider'
import { useBranding } from '@/branding/BrandingProvider'
import { useTheme, type ThemeChoice } from '@/theme/ThemeProvider'
import { NAV, breadcrumbFor, type NavGroup } from './nav'
import { GlobalSearch, useGlobalSearchHotkey } from './GlobalSearch'
import { NotificationsBell } from './NotificationsBell'
import { InstallButton, PwaNotices } from './PwaNotices'
import { Select, cx } from './ui/primitives'
import {
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

const OPEN_GROUPS_KEY = 'uniklin.menu.groups'

const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

export function AppShell() {
  const { context, branchId, setBranchId, can, signOut } = useSession()
  const { branding } = useBranding()
  const navigate = useNavigate()
  const location = useLocation()

  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useGlobalSearchHotkey(() => setSearchOpen(true))

  // Trocar de tela fecha o que estava aberto por cima dela.
  useEffect(() => {
    setMenuOpen(false)
    setUserOpen(false)
  }, [location.pathname])

  const groups = useMemo(
    () =>
      NAV.map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.permission || can(item.permission)),
      })).filter((group) => group.items.length > 0),
    [can],
  )

  if (context?.status !== 'ready') return null

  const branch = context.branches.find((b) => b.id === branchId)
  const trail = breadcrumbFor(location.pathname)

  return (
    <div className="flex h-full bg-canvas pt-[env(safe-area-inset-top)]">
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-sidebar/60 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* ------------------------------ Menu ------------------------------ */}
      <aside
        className={cx(
          'z-40 flex shrink-0 flex-col bg-sidebar transition-[width]',
          collapsed ? 'lg:w-16' : 'lg:w-64',
          'w-64 max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:shadow-2xl',
          'max-lg:pt-[env(safe-area-inset-top)] max-lg:pb-[env(safe-area-inset-bottom)]',
          menuOpen ? 'max-lg:block' : 'max-lg:hidden',
        )}
      >
        {/* Marca */}
        <button
          onClick={() => navigate('/')}
          className="flex h-16 shrink-0 items-center gap-2.5 px-4 text-left"
        >
          {branding.logoIconUrl ? (
            <img src={branding.logoIconUrl} alt="" className="size-9 rounded-lg object-contain" />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-300">
              <IconGlasses className="size-5" />
            </span>
          )}
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[0.9375rem] leading-tight font-semibold text-white">
                {branding.companyName}
              </span>
              <span className="block truncate text-[0.6875rem] leading-tight text-sidebar-fg/60">
                {branding.subtitle}
              </span>
            </span>
          )}
        </button>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
          <NavLink to="/" end className={itemClass} title="Início">
            <IconHome className="size-4.5 shrink-0" />
            {!collapsed && 'Início'}
          </NavLink>

          <div className="mt-2 space-y-1">
            {groups.map((group) => (
              <MenuGroup
                key={group.id}
                group={group}
                collapsed={collapsed}
                pathname={location.pathname}
              />
            ))}
          </div>
        </nav>

        {!collapsed && (
          <div className="shrink-0 px-3 pb-3">
            <div className="flex items-start gap-2.5 rounded-lg bg-white/6 px-3 py-2.5">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-500/20 text-brand-300">
                <IconIdea className="size-4" />
              </span>
              <p className="text-[0.6875rem] leading-snug text-sidebar-fg/80">
                <span className="block font-semibold text-white">
                  Óticas que crescem
                </span>
                usam {branding.shortName}.
              </p>
            </div>
          </div>
        )}

        <button
          onClick={() => setCollapsed((v) => !v)}
          className="hidden shrink-0 items-center gap-2.5 px-5 py-3 text-[0.75rem] text-sidebar-fg/70 hover:text-white lg:flex"
        >
          <IconChevronRight
            className={cx('size-4 transition-transform', !collapsed && 'rotate-180')}
          />
          {!collapsed && 'Recolher menu'}
        </button>
      </aside>

      {/* ---------------------------- Conteúdo ---------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:gap-3 sm:px-4">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md p-2 text-fg-muted hover:bg-surface-sunken lg:hidden"
            aria-label="Abrir menu"
          >
            {menuOpen ? <IconClose className="size-5" /> : <IconMenu className="size-5" />}
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

const itemClass = ({ isActive }: { isActive: boolean }): string =>
  cx(
    'flex items-center gap-2.5 rounded-lg px-2.5 text-[0.8125rem] transition-colors',
    'py-2.5 lg:py-2',
    isActive
      ? 'bg-brand-600 font-medium text-white'
      : 'text-sidebar-fg/80 hover:bg-white/6 hover:text-white',
  )

/**
 * Grupo do menu: o título é um botão que abre e fecha a lista. A escolha fica
 * guardada, e o grupo da tela aberta abre sozinho — quem navega por link direto
 * não precisa caçar onde está.
 */
function MenuGroup({
  group,
  collapsed,
  pathname,
}: {
  group: NavGroup
  collapsed: boolean
  pathname: string
}) {
  const hasActive = group.items.some(
    (item) => pathname === item.to || pathname.startsWith(item.to + '/'),
  )
  const [open, setOpen] = useState(() => readOpen(group.id))

  // Navegou para uma tela deste grupo: ele se abre.
  useEffect(() => {
    if (hasActive) setOpen(true)
  }, [hasActive])

  const toggle = () => {
    setOpen((previous) => {
      writeOpen(group.id, !previous)
      return !previous
    })
  }

  if (collapsed) {
    return (
      <div className="space-y-0.5 border-t border-white/8 pt-1">
        {group.items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={itemClass}
            title={item.label}
          >
            <item.icon className="size-4.5 shrink-0" />
          </NavLink>
        ))}
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={toggle}
        aria-expanded={open}
        className={cx(
          'flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5',
          'text-[0.6875rem] font-semibold tracking-wider uppercase transition-colors',
          hasActive ? 'text-sidebar-fg' : 'text-sidebar-fg/55',
          'hover:text-white',
        )}
      >
        <IconChevronDown
          className={cx('size-3.5 shrink-0 transition-transform', !open && '-rotate-90')}
        />
        <span className="truncate">{group.label}</span>
      </button>

      {open && (
        <div className="mt-0.5 space-y-0.5">
          {group.items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={itemClass}>
              <item.icon className="size-4.5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function readOpen(id: string): boolean {
  try {
    const raw = localStorage.getItem(OPEN_GROUPS_KEY)
    if (!raw) return true
    const map = JSON.parse(raw) as Record<string, boolean>
    return map[id] ?? true
  } catch {
    return true
  }
}

function writeOpen(id: string, value: boolean): void {
  try {
    const raw = localStorage.getItem(OPEN_GROUPS_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    map[id] = value
    localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(map))
  } catch {
    // sem storage a preferência não persiste; o menu continua funcionando
  }
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
