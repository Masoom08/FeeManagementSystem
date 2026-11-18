import type { ReactNode } from 'react'

export type IconName = 'grid' | 'users' | 'receipt' | 'chart' | 'settings' | 'search' | 'bell' | 'chevron' | 'arrow' | 'plus' | 'download' | 'menu' | 'logout' | 'calendar' | 'check' | 'clock' | 'wallet'

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const }
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    receipt: <><path d="M4 3h16v18l-3-2-3 2-3-2-3 2-4-2z"/><path d="M8 8h8M8 12h8M8 16h4"/></>,
    chart: <><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-5 5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.1.8-1.1 1.9-1.3-.5a8 8 0 0 1-1.5.9l-.2 1.4h-2.2l-.3-1.4a8 8 0 0 1-1.6-.9l-1.3.5-1.1-1.9 1.1-.9a7 7 0 0 1 0-1.8l-1.1-.9 1.1-1.9 1.3.5a8 8 0 0 1 1.6-.9l.3-1.4h2.2l.2 1.4a8 8 0 0 1 1.5.9l1.3-.5 1.1 1.9-1.1.9a7 7 0 0 1 0 1.8Z" transform="translate(-1 -1)"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>, arrow: <><path d="M7 17 17 7M7 7h10v10"/></>, plus: <><path d="M12 5v14M5 12h14"/></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></>, menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>, logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></>, check: <><path d="m5 12 4 4L19 6"/></>, clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, wallet: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 15h2"/><path d="M3 5V4a2 2 0 0 1 2-2h13"/></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}
