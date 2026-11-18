import { useState } from 'react'
import { Icon, type IconName } from '../components/ui/AppIcon'
import { LateFeeWaivers } from '../features/fees/components/LateFeeWaivers'
import { OverviewDashboard } from '../features/dashboard/components/OverviewDashboard'
import { StudentFeeManagement } from '../features/students/components/StudentFeeManagement'
import { FeeStructurePage } from '../features/fees/components/FeeStructurePage'
import { AdminManagementModal, AdminManagementPage, type ManagementFormSection, type ManagementListSection } from './AdminManagementPage'
import iccmrtLogo from '../assets/logo-iccmrt.png'

export type DashboardPageName = 'Overview' | 'Students' | 'Fee structure' | 'Courses' | 'Academic years' | 'Semesters' | 'Reminder history' | 'Late fee waivers'
type DashboardPageProps = {
  onLogout: () => void
  initialPage: DashboardPageName
  role: 'TEACHER' | 'SUPERADMIN'
  onNavigate: (page: DashboardPageName) => void
}

const navItems: { label: DashboardPageName; icon: IconName }[] = [
  { label: 'Overview', icon: 'grid' },
  { label: 'Students', icon: 'users' },
  { label: 'Fee structure', icon: 'receipt' },
  { label: 'Courses', icon: 'settings' },
  { label: 'Academic years', icon: 'calendar' },
  { label: 'Semesters', icon: 'calendar' },
  { label: 'Reminder history', icon: 'bell' },
  { label: 'Late fee waivers', icon: 'receipt' },
]

export function DashboardPage({ onLogout, initialPage, role, onNavigate }: DashboardPageProps) {
  const active = initialPage
  const [notice, setNotice] = useState('')
  const [createSection, setCreateSection] = useState<ManagementFormSection | null>(null)
  const [dataRefreshKey, setDataRefreshKey] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)


  const today = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date())

  const setActive = (page: DashboardPageName) => onNavigate(page)
  const visibleNavItems = role === 'SUPERADMIN' ? navItems : navItems.filter(item => !['Courses', 'Academic years', 'Semesters'].includes(item.label))

  return <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand-row"><a className="brand" href="#top" onClick={() => setActive('Overview')}>
        <img className="brand-logo" src={iccmrtLogo} alt="ICCMRT logo" /><span>ICCMRT <small>FEE PORTAL</small></span>
      </a><button className="sidebar-toggle" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Minimize sidebar'} title={sidebarCollapsed ? 'Expand sidebar' : 'Minimize sidebar'} aria-expanded={!sidebarCollapsed} onClick={() => setSidebarCollapsed(current => !current)}><Icon name="chevron" size={17}/></button></div>
      <div className="side-section-label">WORKSPACE</div>
      <nav className="side-nav">
        {visibleNavItems.map(item => <button key={item.label} title={sidebarCollapsed ? item.label : undefined} aria-label={item.label} className={`nav-item ${active === item.label ? 'active' : ''}`} onClick={() => { setActive(item.label); setMenuOpen(false) }}>
          <Icon name={item.icon}/><span>{item.label}</span>
        </button>)}
      </nav>
      <div className="sidebar-bottom">
        <button className="profile" onClick={onLogout}><span className="avatar avatar-profile">{role === 'SUPERADMIN' ? 'SA' : 'T'}</span><span className="profile-copy"><strong>{role === 'SUPERADMIN' ? 'Super Admin' : 'Teacher'}</strong><small>{role === 'SUPERADMIN' ? 'Administrator' : 'Staff account'}</small></span><Icon name="logout" size={17}/></button>
      </div>
    </aside>

    <main className="main-area" id="top">
      <header className="topbar">
        <button className="mobile-menu" aria-label="Open menu" onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu"/></button>
        <div className="breadcrumb">Workspace <Icon name="chevron" size={14}/> <strong>{active}</strong></div>
        <div className="top-actions">
          <span className="top-divider"/><span className="top-date"><Icon name="calendar" size={15}/> {today}</span>
        </div>
      </header>

      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div>}
      <div className="page-content">
        {active === 'Students' ? <StudentFeeManagement onNotice={setNotice} view="students" refreshKey={dataRefreshKey} onAddStudent={role === 'SUPERADMIN' ? () => setCreateSection('Add student') : undefined}/> : active === 'Reminder history' ? <StudentFeeManagement onNotice={setNotice} view="reminders"/> : active === 'Fee structure' ? <FeeStructurePage refreshKey={dataRefreshKey} onAddFeeStructure={role === 'SUPERADMIN' ? () => setCreateSection('Add fee structure') : undefined}/> : active === 'Late fee waivers' ? <LateFeeWaivers/> : role === 'SUPERADMIN' && (active === 'Courses' || active === 'Academic years' || active === 'Semesters') ? <AdminManagementPage section={active as ManagementListSection} refreshKey={dataRefreshKey} onCreate={setCreateSection} onNotice={setNotice}/> : <OverviewDashboard onNotice={setNotice} onFeeStructure={() => setActive('Fee structure')}/>}
      </div>
      {createSection && role === 'SUPERADMIN' && <AdminManagementModal section={createSection} onClose={() => setCreateSection(null)} onSaved={() => setDataRefreshKey(key => key + 1)} onNotice={setNotice}/>}
    </main>
  </div>
}


