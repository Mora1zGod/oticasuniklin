import type { SVGProps } from 'react'

/**
 * Ícones de traço, desenhados inline. Emoji no menu dá cara de protótipo e não
 * acompanha a cor nem o peso do texto — isto acompanha.
 */
type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconHome = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
  </Icon>
)

export const IconUsers = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 5.5a3.25 3.25 0 0 1 0 6" />
    <path d="M17.5 14.5A6.5 6.5 0 0 1 21.5 20" />
  </Icon>
)

/** Óculos: a marca do domínio. */
export const IconGlasses = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="6" cy="14" r="3.5" />
    <circle cx="18" cy="14" r="3.5" />
    <path d="M9.5 14c.8-1 4.2-1 5 0" />
    <path d="M2.5 14 5 7.5h2" />
    <path d="M21.5 14 19 7.5h-2" />
  </Icon>
)

export const IconCart = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 3.5h2l2.2 10.4a2 2 0 0 0 2 1.6h7.1a2 2 0 0 0 2-1.5L19.5 7H6" />
    <circle cx="9.5" cy="19.5" r="1.4" />
    <circle cx="17" cy="19.5" r="1.4" />
  </Icon>
)

export const IconWrench = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.7 6.3a4.5 4.5 0 0 0 5.9 5.9l-8.5 8.5a2.5 2.5 0 0 1-3.5-3.5Z" />
    <path d="M14.7 6.3 18 3l3 3-3.3 3.3" />
  </Icon>
)

export const IconBox = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 3.5 7v10L12 21l8.5-4V7Z" />
    <path d="M3.5 7 12 11l8.5-4" />
    <path d="M12 11v10" />
  </Icon>
)

export const IconChart = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 20.5h17" />
    <path d="M6.5 17V11" />
    <path d="M11 17V6" />
    <path d="M15.5 17v-4" />
    <path d="M20 17V9" />
  </Icon>
)

export const IconMoney = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.75" />
    <path d="M6 10.5v3M18 10.5v3" />
  </Icon>
)

export const IconSettings = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
  </Icon>
)

export const IconMenu = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
)

export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)

export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Icon>
)

export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const IconChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 5 7 7-7 7" />
  </Icon>
)

export const IconLogout = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </Icon>
)

export const IconAlert = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 8.5v5" />
    <circle cx="12" cy="17" r=".6" fill="currentColor" stroke="none" />
    <path d="M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
  </Icon>
)

export const IconSun = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
  </Icon>
)

export const IconMoon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.2 8.2 0 1 0 20 14.2Z" />
  </Icon>
)

export const IconMonitor = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
    <path d="M9 20.5h6M12 16.5v4" />
  </Icon>
)

export const IconDownload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5v11" />
    <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
    <path d="M4 20.5h16" />
  </Icon>
)

export const IconRefresh = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20.5 3.5V9h-5.5" />
  </Icon>
)

export const IconCloudOff = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 3l18 18" />
    <path d="M8.5 18.5h8.8a3.7 3.7 0 0 0 1.2-7.2A5.8 5.8 0 0 0 9.8 7.2" />
    <path d="M6.9 9.1A4.7 4.7 0 0 0 7.5 18.5" />
  </Icon>
)

export const IconChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9.5 6 6 6-6" />
  </Icon>
)

export const IconBell = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9Z" />
    <path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
  </Icon>
)

export const IconPin = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Icon>
)

export const IconIdea = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.5 18h5" />
    <path d="M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 2h5.2c0-.8.3-1.5.9-2A6 6 0 0 0 12 3Z" />
  </Icon>
)

export const IconFile = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5" />
  </Icon>
)

export const IconClipboard = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="4.5" width="14" height="16" rx="2" />
    <path d="M9 4.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4.5v1H9Z" />
    <path d="M9 11h6M9 15h4" />
  </Icon>
)

export const IconUserCheck = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="8" r="3.5" />
    <path d="M3.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="m16.5 11.5 1.8 1.8 3.2-3.4" />
  </Icon>
)

export const IconLayers = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 3 8.5 4.5L12 12 3.5 7.5Z" />
    <path d="m4 12 8 4.3 8-4.3" />
    <path d="m4 16.5 8 4.3 8-4.3" />
  </Icon>
)

export const IconDroplet = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3s6 6.3 6 10a6 6 0 0 1-12 0c0-3.7 6-10 6-10Z" />
  </Icon>
)

export const IconFlask = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.5 3v6.2L4.8 17a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3l-4.7-7.8V3" />
    <path d="M8.5 3h7" />
    <path d="M7.2 14.5h9.6" />
  </Icon>
)

export const IconSparkle = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5 13.6 9l5.4 1.6-5.4 1.6L12 17.7l-1.6-5.5L5 10.6 10.4 9Z" />
    <path d="M18.5 16.5 19.2 19l2.3.7-2.3.7-.7 2.3" />
  </Icon>
)

export const IconTag = (p: IconProps) => (
  <Icon {...p}>
    <path d="M11 3.5H4.5V10L14 19.5a2 2 0 0 0 2.8 0l3.7-3.7a2 2 0 0 0 0-2.8Z" />
    <circle cx="8" cy="7" r="1.2" />
  </Icon>
)

export const IconTruck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 6.5h10v9h-10Z" />
    <path d="M12.5 10h4l3 3v2.5h-7Z" />
    <circle cx="7" cy="17.5" r="1.8" />
    <circle cx="16.5" cy="17.5" r="1.8" />
  </Icon>
)

export const IconPriceTag = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7.5h16M4 12h16M4 16.5h9" />
  </Icon>
)

export const IconBank = (p: IconProps) => (
  <Icon {...p}>
    <path d="m3.5 9.5 8.5-5 8.5 5" />
    <path d="M5.5 9.5v8M10 9.5v8M14 9.5v8M18.5 9.5v8" />
    <path d="M3 20.5h18" />
  </Icon>
)

export const IconPercent = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 18 12-12" />
    <circle cx="7.5" cy="7.5" r="2" />
    <circle cx="16.5" cy="16.5" r="2" />
  </Icon>
)

export const IconWallet = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5H17a1 1 0 0 1 1 1v1.5" />
    <rect x="3.5" y="7.5" width="17" height="11.5" rx="2" />
    <circle cx="16.5" cy="13.2" r="1.1" fill="currentColor" stroke="none" />
  </Icon>
)

export const IconBuilding = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4.5" y="3.5" width="15" height="17" rx="1.5" />
    <path d="M8.5 7.5h2M13.5 7.5h2M8.5 11.5h2M13.5 11.5h2" />
    <path d="M10 20.5v-4h4v4" />
  </Icon>
)

export const IconShield = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 5 5.8v5.4c0 4.2 2.9 7.6 7 9.3 4.1-1.7 7-5.1 7-9.3V5.8Z" />
  </Icon>
)

export const IconList = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 6.5h11M9 12h11M9 17.5h11" />
    <circle cx="4.8" cy="6.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="4.8" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="4.8" cy="17.5" r="1" fill="currentColor" stroke="none" />
  </Icon>
)

export const IconPalette = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.4-1-1.8-1-2.9 0-.8.7-1.4 1.6-1.4h1.4A4.7 4.7 0 0 0 20.5 10c0-3.6-3.6-6.5-8.5-6.5Z" />
    <circle cx="8" cy="10" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7.8" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15.8" cy="9.8" r="1.1" fill="currentColor" stroke="none" />
  </Icon>
)

export const IconPhone = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 3.8 9.2 3.5l1.6 3.8-1.9 1.3a10.5 10.5 0 0 0 5.5 5.5l1.3-1.9 3.8 1.6-.3 2.2a2 2 0 0 1-2.2 1.7C10.6 17 6.9 13.3 5.3 6a2 2 0 0 1 1.7-2.2Z" />
  </Icon>
)

export const IconCake = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20.5h16" />
    <path d="M4.5 20.5v-5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v5" />
    <path d="M8 13.5v-2M12 13.5v-2M16 13.5v-2" />
    <path d="M8 8.2c0-.9 1-1.4 1-2.4M12 8.2c0-.9 1-1.4 1-2.4M16 8.2c0-.9 1-1.4 1-2.4" />
  </Icon>
)

export const IconBolt = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13.5 3 5.5 13.5h5L10 21l8.5-10.5h-5Z" />
  </Icon>
)

export const IconArrowUp = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 19.5v-15M6 10.5 12 4.5l6 6" />
  </Icon>
)

export const IconArrowDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4.5v15M6 13.5l6 6 6-6" />
  </Icon>
)

export const IconArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5" />
  </Icon>
)

export const IconCheckCircle = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.2 2.4 2.4 4.6-4.9" />
  </Icon>
)

export const IconClock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </Icon>
)

export const IconCoin = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M14.2 9.3a2.6 2.6 0 0 0-2.2-1c-1.3 0-2.3.7-2.3 1.8 0 2.4 4.6 1.2 4.6 3.7 0 1.2-1 1.9-2.3 1.9a2.7 2.7 0 0 1-2.3-1.1" />
    <path d="M12 6.8v10.4" />
  </Icon>
)

export const IconCalendar = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
  </Icon>
)
