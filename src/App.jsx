import { useEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BrainCircuit,
  Building2,
  Check,
  ClipboardCheck,
  Command,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  canAccessStudent,
  dashboardPaths,
  demoAccounts,
  isValidEmail,
} from './auth/demoAuth'
import { apiRequest } from './api/client'

const groups = [
  ['Command', [['/admin/dashboard', 'Command Center', LayoutDashboard]]],
  ['Campus', [['/campus', 'Campus Pulse', Activity], ['/concerns', 'Concern Radar', AlertTriangle]]],
  ['Students', [['/students', 'Student Directory', Users], ['/students/ST102', 'Student 360°', UserRound]]],
  ['Intelligence', [['/campus-brain', 'Campus Brain', BrainCircuit], ['/explainable', 'Explainable Intelligence', Sparkles], ['/feedback', 'NLP Feedback', MessageIcon], ['/knowledge-graph', 'Risk factor summary', Network], ['/simulation', 'Scenario planning', Target]]],
  ['Support', [['/interventions', 'Intervention Center', ClipboardCheck], ['/guardian', 'Guardian Connect', Send]]],
  ['Analytics', [['/analytics', 'Analytics', Activity], ['/reports', 'Reports', FileText]]],
  ['System', [['/admin/users', 'User & role management', Users], ['/admin/departments', 'Departments', Building2], ['/notifications', 'Notifications', Bell], ['/audit-log', 'Activity Log', Command], ['/settings', 'Settings', Settings]]],
]
const roleDetails = [
  { id: 'admin', label: 'Admin', description: 'Campus operations', Icon: ShieldCheck },
  { id: 'faculty', label: 'Faculty', description: 'Teaching & support', Icon: Users },
  { id: 'student', label: 'Student', description: 'Personal progress', Icon: GraduationCap },
  { id: 'parent', label: 'Parent / Guardian', description: 'Linked student view', Icon: HeartHandshake },
]
const facultyGroups = [
  ['Faculty workspace', [['/faculty/dashboard', 'Faculty dashboard', LayoutDashboard], ['/students', 'Assigned students', Users], ['/feedback', 'Feedback review', Sparkles], ['/explainable', 'Risk explanations', BrainCircuit], ['/interventions', 'Interventions', ClipboardCheck], ['/reports', 'Reports', FileText]]],
]

function MessageIcon(props) {
  return <Sparkles {...props} />
}

export default function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState('')
  const [operationError, setOperationError] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [assistant, setAssistant] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    apiRequest('/auth/me')
      .then(({ user: currentUser }) => {
        if (active) setUser(currentUser)
      })
      .catch((error) => {
        if (active) setAuthError(error.message)
      })
      .finally(() => {
        if (active) setAuthReady(true)
      })
    return () => { active = false }
  }, [])

  const onLogin = async (email, password, role) => {
    const { user: authenticatedUser } = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password, selected_role: role },
    })
    setAuthError('')
    setUser(authenticatedUser)
    return authenticatedUser
  }

  const onLogout = async () => {
    setOperationError('')
    try {
      await apiRequest('/auth/logout', { method: 'POST' })
      setUser(null)
      setAssistant(false)
      navigate('/login', { replace: true })
    } catch (error) {
      setOperationError(error.message)
    }
  }

  if (!authReady) return <div className="auth-loading" role="status">Checking your campus session…</div>

  if (!user) {
    if (location.pathname === '/login' || location.pathname === '/') {
      return <Login onLogin={onLogin} initialError={authError} />
    }
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return (
    <div className={`app ${collapsed ? 'collapsed' : ''}`}>
      <Sidebar user={user} collapsed={collapsed} toggle={() => setCollapsed(!collapsed)} onLogout={onLogout} />
      <div className="main">
        <Topbar user={user} openAssistant={() => setAssistant(true)} />
        <main>
          {operationError && <div className="error-banner" role="alert">{operationError}</div>}
          <Routes>
            <Route path="/" element={<Navigate to={dashboardPaths[user.role]} replace />} />
            <Route path="/login" element={<Navigate to={dashboardPaths[user.role]} replace />} />
            <Route path="/admin/dashboard" element={<RoleRoute user={user} roles={['admin']}><Dashboard ask={() => setAssistant(true)} user={user} /></RoleRoute>} />
            <Route path="/faculty/dashboard" element={<RoleRoute user={user} roles={['faculty']}><FacultyDashboard user={user} /></RoleRoute>} />
            <Route path="/student/dashboard" element={<RoleRoute user={user} roles={['student']}><StudentDashboard user={user} /></RoleRoute>} />
            <Route path="/parent/dashboard" element={<RoleRoute user={user} roles={['parent']}><ParentDashboard user={user} /></RoleRoute>} />
            <Route path="/admin/users" element={<RoleRoute user={user} roles={['admin']}><UserManagement /></RoleRoute>} />
            <Route path="/admin/departments" element={<RoleRoute user={user} roles={['admin']}><DepartmentManagement /></RoleRoute>} />
            <Route path="/dashboard" element={<RoleRoute user={user} roles={['admin']}><Navigate to="/admin/dashboard" replace /></RoleRoute>} />
            <Route path="/campus" element={<RoleRoute user={user} roles={['admin']}><CampusPulse /></RoleRoute>} />
            <Route path="/concerns" element={<RoleRoute user={user} roles={['admin']}><ConcernRadar /></RoleRoute>} />
            <Route path="/students" element={<RoleRoute user={user} roles={['admin', 'faculty']}><Directory user={user} /></RoleRoute>} />
            <Route path="/students/:id" element={<StudentRecordRoute user={user} />} />
            <Route path="/campus-brain" element={<RoleRoute user={user} roles={['admin']}><Brain /></RoleRoute>} />
            <Route path="/explainable" element={<RoleRoute user={user} roles={['admin', 'faculty']}><Explainable /></RoleRoute>} />
            <Route path="/feedback" element={<RoleRoute user={user} roles={['admin', 'faculty']}><Feedback /></RoleRoute>} />
            <Route path="/knowledge-graph" element={<RoleRoute user={user} roles={['admin']}><KnowledgeGraph /></RoleRoute>} />
            <Route path="/simulation" element={<RoleRoute user={user} roles={['admin']}><Simulation /></RoleRoute>} />
            <Route path="/interventions" element={<RoleRoute user={user} roles={['admin', 'faculty']}><Interventions /></RoleRoute>} />
            <Route path="/guardian" element={<RoleRoute user={user} roles={['admin']}><GuardianConnect /></RoleRoute>} />
            <Route path="/analytics" element={<RoleRoute user={user} roles={['admin']}><Analytics /></RoleRoute>} />
            <Route path="/reports" element={<RoleRoute user={user} roles={['admin', 'faculty']}><Reports /></RoleRoute>} />
            <Route path="/notifications" element={<RoleRoute user={user} roles={['admin']}><NotificationsPage /></RoleRoute>} />
            <Route path="/audit-log" element={<RoleRoute user={user} roles={['admin']}><AuditLog /></RoleRoute>} />
            <Route path="/settings" element={<RoleRoute user={user} roles={['admin']}><SettingsPage /></RoleRoute>} />
            <Route path="*" element={<Navigate to={dashboardPaths[user.role]} replace />} />
          </Routes>
        </main>
      </div>
      {['admin', 'faculty'].includes(user.role) && <button className="assistant-fab" onClick={() => setAssistant(true)}><Sparkles size={16} /> Campus AI</button>}
      {assistant && ['admin', 'faculty'].includes(user.role) && <Assistant close={() => setAssistant(false)} />}
    </div>
  )
}

function RoleRoute({ user, roles, children }) {
  return roles.includes(user.role) ? children : <Navigate to={dashboardPaths[user.role]} replace />
}

function StudentRecordRoute({ user }) {
  const { id = '' } = useParams()
  if (!['admin', 'faculty'].includes(user.role) || !canAccessStudent(user, id)) {
    return <Navigate to={dashboardPaths[user.role]} replace />
  }
  return <Student360 studentId={id} />
}

function Login({ onLogin, initialError = '' }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('admin')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email address and password to continue.')
      return
    }
    if (!isValidEmail(email)) {
      setError('Enter a valid email address, such as name@campus.edu.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const authenticatedUser = await onLogin(email, password, role)
      navigate(dashboardPaths[authenticatedUser.role], { replace: true })
    } catch (loginError) {
      setError(loginError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-visual">
        <div className="login-brand"><div className="brand-mark"><Building2 size={19} /></div>AI CAMPUS <b>360°</b></div>
        <div className="visual-copy">
          <span className="eyebrow">INTELLIGENCE LAYER · DEMO ENVIRONMENT</span>
          <h1>From campus data<br /><em>to better outcomes.</em></h1>
          <p>Monitor the pulse of your campus, understand the signal, and help every student move forward.</p>
        </div>
        <div className="orbit">
          <div className="orbit-ring" />
          <div className="orbit-ring ring-two" />
          <div className="orbit-core"><BrainCircuit size={28} /><span>Campus<br />intelligence</span></div>
          <div className="orbit-node node-one">ATTENDANCE <b>Saved records</b></div>
          <div className="orbit-node node-two">SUPPORT <b>Human-led</b></div>
        </div>
        <div className="visual-footer"><span>MONITOR</span><i>→</i><span>UNDERSTAND</span><i>→</i><span>SUPPORT</span></div>
      </section>
      <section className="login-panel">
        <form className="login-form role-login-form" onSubmit={handleSubmit}>
          <span className="eyebrow">WELCOME BACK</span>
          <h2>Sign in to your campus.</h2>
          <p className="muted">Choose a role, then enter the matching demo account.</p>
          <div className="demo-note"><Sparkles size={16} /><span><b>Local demonstration mode</b><small>Local API · fictional CSV data</small></span></div>
          <fieldset className="role-picker">
            <legend>Select your role</legend>
            <div className="role-card-grid">
              {roleDetails.map(({ id, label, description, Icon }) => (
                <button type="button" className={`role-card ${role === id ? 'selected' : ''}`} key={id} onClick={() => setRole(id)} aria-pressed={role === id}>
                  <Icon size={17} /><span><b>{label}</b><small>{description}</small></span>
                </button>
              ))}
            </div>
          </fieldset>
          <label htmlFor="login-email">Email address<input id="login-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@campus.edu" /></label>
          <label htmlFor="login-password">Password
            <span className="password-control">
              <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </span>
          </label>
          {error && <div className="error-banner" role="alert">{error}</div>}
          <button className="primary-button full sign-in-button" type="submit" disabled={loading}>{loading ? 'Signing in…' : `Sign in as ${roleDetails.find((item) => item.id === role).label}`} {loading ? <span className="button-spinner" /> : <ArrowUpRight size={16} />}</button>
          <section className="demo-accounts" aria-labelledby="demo-accounts-title">
            <div className="demo-accounts-heading"><div><span className="eyebrow">QUICK START</span><h3 id="demo-accounts-title">Demo accounts</h3></div><span>Local only</span></div>
            {demoAccounts.map((account) => (
              <div className="demo-account-row" key={account.role}>
                <div><b>{account.role === 'parent' ? 'Parent / Guardian' : account.role[0].toUpperCase() + account.role.slice(1)}</b><small>{account.email} · {account.password}</small></div>
                <button type="button" className="text-button" onClick={() => { setRole(account.role); setEmail(account.email); setPassword(account.password); setError('') }}>Fill account</button>
              </div>
            ))}
          </section>
          <p className="login-foot">Selecting a demo account only fills the form. You must choose <b>Sign in</b> to continue.</p>
        </form>
      </section>
    </div>
  )
}

function Sidebar({ user, collapsed, toggle, onLogout }) {
  const menuGroups = user.role === 'admin' ? groups : user.role === 'faculty' ? facultyGroups : [
    [user.role === 'parent' ? 'Guardian workspace' : 'Student workspace', [[dashboardPaths[user.role], user.role === 'parent' ? 'Guardian dashboard' : 'My dashboard', user.role === 'parent' ? HeartHandshake : GraduationCap]]],
  ]
  return (
    <aside className="sidebar">
      <div className="side-top">
        <div className="brand"><div className="brand-mark"><Building2 size={18} /></div>{!collapsed && <>AI CAMPUS <b>360°</b></>}</div>
        <button className="icon-button" onClick={toggle}><Menu size={18} /></button>
      </div>
      <div className="demo-pill"><span className="live-dot" />{!collapsed && 'Demo environment'}</div>
      <nav>
        {menuGroups.map(([label, items]) => (
          <div className="nav-group" key={label}>
            <div className="nav-label">{!collapsed && label}</div>
            {items.map(([to, text, Icon]) => (
              <NavLink className="nav-link" to={to} key={to} title={collapsed ? text : ''}>
                <Icon size={16} />
                <span>{!collapsed && text}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-user">
        <div className="avatar">{user.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>
        {!collapsed && <div><b>{user.name}</b><small>{roleDetails.find((item) => item.id === user.role).label}</small></div>}
        <button className="icon-button compact" onClick={onLogout} title="Log out" aria-label="Log out"><LogOut size={14} /></button>
      </div>
    </aside>
  )
}

function Topbar({ user, openAssistant }) {
  const location = useLocation()
  const [isOpen, setOpen] = useState(false)
  const [visibleNotifications, setVisibleNotifications] = useState([])
  const [notificationError, setNotificationError] = useState('')
  const [updatingNotificationId, setUpdatingNotificationId] = useState('')

  useEffect(() => {
    let active = true
    apiRequest('/notifications')
      .then(({ items }) => {
        if (active) setVisibleNotifications(items)
      })
      .catch((error) => {
        if (active) setNotificationError(error.message)
      })
    return () => { active = false }
  }, [user.id])

  const markNotificationRead = async (notification) => {
    setNotificationError('')
    setUpdatingNotificationId(notification.id)
    try {
      const { item } = await apiRequest(`/notifications/${encodeURIComponent(notification.id)}`, { method: 'PUT' })
      setVisibleNotifications((current) => current.map((entry) => entry.id === item.id ? item : entry))
    } catch (error) {
      setNotificationError(error.message)
    } finally {
      setUpdatingNotificationId('')
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="breadcrumb">AI Campus 360° <span>/</span> <b>{location.pathname.split('/')[1] || 'dashboard'}</b></div>
        <div className="top-actions">
          <button className="search-trigger" onClick={openAssistant}><Search size={15} /> <span>Search campus data</span><kbd>⌘ K</kbd></button>
          <button className="icon-button notification-button" onClick={() => setOpen(!isOpen)} aria-label={`${visibleNotifications.filter((item) => item.read !== 'true').length} unread notifications`}>
            <Bell size={17} />
            <i>{visibleNotifications.filter((item) => item.read !== 'true').length}</i>
          </button>
          <div className="top-user"><span className="top-avatar">{user.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span><b>{user.name}</b><small>{roleDetails.find((item) => item.id === user.role).label}</small></span></div>
        </div>
      </header>
      {isOpen && <NotificationPanel notificationsForUser={visibleNotifications} error={notificationError} updatingId={updatingNotificationId} onMarkRead={markNotificationRead} onClose={() => setOpen(false)} />}
    </>
  )
}

function NotificationPanel({ notificationsForUser, error, updatingId, onMarkRead, onClose }) {
  return (
    <div className="notification-panel">
      <div className="panel-heading">
        <div>
          <b>Alerts</b>
          <small>Updated now</small>
        </div>
        <button className="icon-button" onClick={onClose}><X size={15} /></button>
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notificationsForUser.map((item) => (
        <div className="notification-item" key={item.id}>
          <span className={`signal-dot ${item.read === 'true' ? 'green' : 'blue'}`} />
          <div>
            <b>{item.type}</b>
            <p>{item.message}</p>
            <small>{item.created_at}</small>
          </div>
          {item.read !== 'true' && <button className="text-button" onClick={() => onMarkRead(item)} disabled={updatingId === item.id}>{updatingId === item.id ? 'Saving…' : 'Mark read'}</button>}
        </div>
      ))}
      {!notificationsForUser.length && <p className="role-copy">No notifications in your account inbox.</p>}
    </div>
  )
}

function Page({ eyebrow, title, subtitle, action, children }) {
  return (
    <section className="page-wrap">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Dashboard({ ask, user }) {
  const [dashboardData, setDashboardData] = useState(null)
  const [overviewError, setOverviewError] = useState('')

  useEffect(() => {
    let active = true
    const loadDashboard = async () => {
      const [overview, { items: roster }, { items: risks }, { items: cases }, { items: departments }, { items: trends }] = await Promise.all([
        apiRequest('/overview'),
        apiRequest('/students'),
        apiRequest('/risk'),
        apiRequest('/interventions'),
        apiRequest('/departments'),
        apiRequest('/trends'),
      ])
      const riskByStudent = new Map(risks.map((risk) => [risk.student_id, risk]))
      if (active) setDashboardData({
        overview,
        roster,
        risks: roster.map((studentRecord) => ({
          ...studentRecord,
          ...(riskByStudent.get(studentRecord.id) || {}),
        })),
        cases,
        departments,
        trends,
      })
    }
    loadDashboard().catch((loadError) => {
      if (active) setOverviewError(loadError.message)
    })
    return () => { active = false }
  }, [])

  const overview = dashboardData?.overview
  const overviewKpis = overview
    ? [
      { label: 'Total students', value: overview.total_students, change: 'Active student records', tone: 'blue' },
      { label: 'Average attendance', value: overview.attendance_percent === null ? 'No data' : `${overview.attendance_percent}%`, change: 'Calculated from saved attendance', tone: 'cyan' },
      { label: 'Academic health', value: overview.academic_average === null ? 'No data' : `${overview.academic_average}%`, change: 'Calculated from saved marks', tone: 'green' },
      { label: 'Open interventions', value: overview.open_interventions, change: `${overview.pending_followups} follow-ups due`, tone: 'amber' },
    ]
    : ['Total students', 'Average attendance', 'Academic health', 'Open interventions'].map((label) => ({
      label,
      value: '—',
      change: 'Loading saved campus records',
      tone: 'blue',
    }))

  return (
    <Page eyebrow="CAMPUS COMMAND CENTER" title={`Good morning, ${user.name}.`} subtitle="Current indicators calculated from authorized local campus records." action={<button className="primary-button" onClick={ask}><Sparkles size={15} /> Ask about records</button>}>
      {overviewError && <div className="error-banner" role="alert">{overviewError}</div>}
      <div className="hero-grid">
        <section className="pulse-card">
          <div className="section-top">
            <div><span className="eyebrow">SAVED-RECORD OVERVIEW</span><h2>Campus pulse</h2></div>
            <span className="status-chip blue">{dashboardData ? 'Local API' : 'Loading'}</span>
          </div>
          <div className="pulse-content">
            <div className="pulse-ring"><div><strong>{overview?.total_students ?? '—'}</strong><span>students</span><small>active records</small></div></div>
            <div className="pulse-stats">
              {[
                ['Attendance', overview?.attendance_percent, 'cyan'],
                ['Academic', overview?.academic_average, 'green'],
                ['Open cases', overview?.open_interventions, 'amber'],
                ['Due follow-ups', overview?.pending_followups, 'blue'],
              ].map(([name, value, tone]) => (
                <div className="pulse-stat" key={name}>
                  <div><span>{name}</span><b>{value === null || value === undefined ? '—' : ['Attendance', 'Academic'].includes(name) ? `${value}%` : value}</b></div>
                  {['Attendance', 'Academic'].includes(name) && <div className="mini-track"><i className={tone} style={{ width: `${Math.max(0, Math.min(100, Number(value) || 0))}%` }} /></div>}
                </div>
              ))}
            </div>
          </div>
          <div className="pulse-foot"><span>Calculated from saved attendance, marks, and cases</span><span>Fictional demo data</span></div>
        </section>

        <section className="signal-card">
          <span className="eyebrow">HUMAN REVIEW QUEUE</span>
          <h2>Students requiring support</h2>
          <div className="signal-quote">{dashboardData ? `${dashboardData.risks.filter((item) => item.category === 'High / Support Review Required').length} students currently have a high support-review score.` : 'Loading student risk records…'}</div>
          <div className="evidence"><span>Moderate <b>{dashboardData?.risks.filter((item) => item.category === 'Moderate').length ?? '—'}</b></span><span>Low <b>{dashboardData?.risks.filter((item) => item.category === 'Low').length ?? '—'}</b></span><span>Data needed <b>{dashboardData?.risks.filter((item) => !item.data_sufficient).length ?? '—'}</b></span></div>
          <NavLink className="outline-button role-link" to="/concerns">Review support queue <ArrowUpRight size={14} /></NavLink>
        </section>
      </div>

      <div className="kpi-grid">
        {overviewKpis.map((k) => (
          <div className={`kpi-card ${k.tone}`} key={k.label}>
            <div className="kpi-icon"><Activity size={16} /></div>
            <span>{k.label}</span>
            <strong>{k.value}</strong>
            <small><ArrowUpRight size={12} /> {k.change}</small>
          </div>
        ))}
        <div className="kpi-card blue">
          <div className="kpi-icon"><Users size={16} /></div>
          <span>Total faculty (demo)</span>
          <strong>{overview?.total_faculty_accounts ?? '—'}</strong>
          <small>Accounts stored in the local user registry</small>
        </div>
      </div>

      <div className="content-grid">
        <section className="panel">
          <div className="section-top">
            <div><span className="eyebrow">STUDENT DISTRIBUTION</span><h2>Departments</h2></div>
            <NavLink className="text-button" to="/admin/departments">Department view <ArrowUpRight size={13} /></NavLink>
          </div>
          <div className="campus-map">
            {(dashboardData?.departments || []).map((department) => (
              <div className="campus-node blue" key={department.name}>
                <span className="node-icon"><Building2 size={16} /></span>
                <div><b>{department.name}</b><small>{department.support_required} support · {department.monitor} monitor</small></div>
                <strong>{department.student_count}</strong>
              </div>
            ))}
            {!dashboardData?.departments?.length && <p className="role-copy">Department records are loading or unavailable.</p>}
          </div>
        </section>
        <SupportRadar items={dashboardData?.risks || []} />
      </div>

      <div className="content-grid lower-grid">
        <section className="panel chart-panel">
          <div className="section-top">
            <div><span className="eyebrow">RECORD HISTORY</span><h2>Attendance & academic records by date</h2></div>
          </div>
          <div className="chart-legend"><span>● Attendance</span><span>● Academic health</span></div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dashboardData?.trends || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dce5ef" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} domain={[50, 100]} />
              <Tooltip />
              <Line connectNulls type="monotone" dataKey="attendance" stroke="#10a9c4" strokeWidth={3} dot={false} />
              <Line connectNulls type="monotone" dataKey="academic" stroke="#5267db" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          {!dashboardData?.trends?.length && <p className="demo-limit-note">No dated attendance or assessment records are available.</p>}
        </section>

        <section className="panel">
          <div className="section-top"><div><span className="eyebrow">ACTION QUEUE</span><h2>Intervention progress</h2></div></div>
          {(dashboardData?.cases || []).map((item) => (
            <div className="intervention-row" key={item.id}>
              <span className="status-mark blue"><Check size={12} /></span>
              <div><b>{item.action}</b><small>{item.student_id} · Due {item.due_date}</small></div>
              <span className="status-chip blue">{item.status}</span>
            </div>
          ))}
          {!dashboardData?.cases?.length && <p className="role-copy">{dashboardData ? 'No intervention cases are recorded.' : 'Loading saved cases…'}</p>}
        </section>
      </div>
    </Page>
  )
}

function FacultyDashboard({ user }) {
  const [rows, setRows] = useState([])
  const [assignedCases, setAssignedCases] = useState([])
  const [feedbackRecords, setFeedbackRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingIds, setSavingIds] = useState([])
  const [savedIds, setSavedIds] = useState([])
  const [invalidIds, setInvalidIds] = useState([])
  const [savingFollowUp, setSavingFollowUp] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    let active = true
    const loadRoster = async () => {
      const [{ items: roster }, { items: cases }, { items: feedbackItems }] = await Promise.all([
        apiRequest('/students'),
        apiRequest('/interventions'),
        apiRequest('/feedback'),
      ])
      const rosterRows = await Promise.all(roster.map(async (studentRecord) => {
        const studentId = studentRecord.id
        const [{ item: risk }, { items: marks }, { items: attendanceRecords }] = await Promise.all([
          apiRequest(`/risk?student_id=${encodeURIComponent(studentId)}`),
          apiRequest(`/students/${encodeURIComponent(studentId)}/marks`),
          apiRequest(`/students/${encodeURIComponent(studentId)}/attendance`),
        ])
        const latestMark = [...marks].sort((left, right) => right.date.localeCompare(left.date))[0]
        const todayAttendance = attendanceRecords.find((item) => item.date === today && item.subject === 'Faculty dashboard')
        return {
          id: studentId,
          name: studentRecord.name,
          department: studentRecord.department,
          attendance: risk.attendance_percent,
          attendanceStatus: todayAttendance?.status || '',
          attendanceId: todayAttendance?.id || '',
          mark: latestMark && Number(latestMark.max_score)
            ? Math.round(Number(latestMark.score) / Number(latestMark.max_score) * 100)
            : '',
          markId: latestMark?.id || '',
          markSubject: latestMark?.subject || 'General',
          markAssessment: latestMark?.assessment || 'Faculty dashboard',
          markMaxScore: Number(latestMark?.max_score) || 100,
          markDate: latestMark?.date || today,
          riskCategory: risk.category,
          riskScore: risk.score,
          riskExplanation: risk.explanation,
          riskFactors: risk.factors,
        }
      }))
      if (active) {
        setRows(rosterRows)
        setAssignedCases(cases)
        setFeedbackRecords(feedbackItems)
      }
    }
    loadRoster()
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [today])

  const updateRow = (id, field, value) => {
    setRows((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item))
    setSavedIds((current) => current.filter((savedId) => savedId !== id))
    setInvalidIds((current) => current.filter((invalidId) => invalidId !== id))
  }

  const saveRow = async (id) => {
    const row = rows.find((item) => item.id === id)
    if (!row || !row.attendanceStatus || row.mark === '' || !Number.isFinite(Number(row.mark)) || Number(row.mark) < 0 || Number(row.mark) > 100) {
      setInvalidIds((current) => current.includes(id) ? current : [...current, id])
      return
    }
    setInvalidIds((current) => current.filter((invalidId) => invalidId !== id))
    setError('')
    setSavingIds((current) => current.includes(id) ? current : [...current, id])
    try {
      const attendanceItem = row.attendanceId
        ? (await apiRequest(`/attendance/${encodeURIComponent(row.attendanceId)}`, {
          method: 'PUT',
          body: { status: row.attendanceStatus },
        })).item
        : (await apiRequest('/attendance', {
          method: 'POST',
          body: { student_id: id, date: today, subject: 'Faculty dashboard', status: row.attendanceStatus },
        })).item
      setRows((current) => current.map((item) => item.id === id
        ? { ...item, attendanceId: attendanceItem.id, attendanceStatus: attendanceItem.status }
        : item))

      const score = Number(row.mark) * row.markMaxScore / 100
      const markItem = row.markId
        ? (await apiRequest(`/marks/${encodeURIComponent(row.markId)}`, {
          method: 'PUT',
          body: { score, max_score: row.markMaxScore },
        })).item
        : (await apiRequest('/marks', {
          method: 'POST',
          body: {
            student_id: id,
            subject: row.markSubject,
            assessment: row.markAssessment,
            score: Number(row.mark),
            max_score: 100,
            date: today,
          },
        })).item
      setRows((current) => current.map((item) => item.id === id
        ? {
          ...item,
          markId: markItem.id,
          markSubject: markItem.subject,
          markAssessment: markItem.assessment,
          markMaxScore: Number(markItem.max_score) || 100,
          markDate: markItem.date,
          mark: Number(markItem.max_score) ? Math.round(Number(markItem.score) / Number(markItem.max_score) * 100) : 0,
        }
        : item))
      setSavedIds((current) => current.includes(id) ? current : [...current, id])
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSavingIds((current) => current.filter((savingId) => savingId !== id))
    }
  }

  const openCase = assignedCases.find((item) => ['Open', 'In Progress'].includes(item.status))
  const followUpDone = assignedCases.some((item) => item.status === 'Completed')
  const highestRisk = [...rows].sort((left, right) => right.riskScore - left.riskScore)[0]
  const recentFeedback = [...feedbackRecords].sort((left, right) => right.created_at.localeCompare(left.created_at))[0]
  const markSummary = [...rows.reduce((grouped, item) => {
    if (item.markSubject && item.mark !== '') {
      const current = grouped.get(item.markSubject) || { subject: item.markSubject, marks: [] }
      current.marks.push(Number(item.mark))
      grouped.set(item.markSubject, current)
    }
    return grouped
  }, new Map()).values()].map((item) => ({
    subject: item.subject,
    mark: Math.round(item.marks.reduce((sum, score) => sum + score, 0) / item.marks.length),
  }))
  const recordFollowUp = async () => {
    if (!openCase) return
    setError('')
    setSavingFollowUp(true)
    try {
      const { item } = await apiRequest(`/interventions/${encodeURIComponent(openCase.id)}`, {
        method: 'PUT',
        body: {
          status: 'Completed',
          follow_up_notes: 'Follow-up recorded from the faculty dashboard.',
          outcome: 'Faculty follow-up completed.',
        },
      })
      setAssignedCases((current) => current.map((entry) => entry.id === item.id ? item : entry))
    } catch (followUpError) {
      setError(followUpError.message)
    } finally {
      setSavingFollowUp(false)
    }
  }

  return (
    <Page eyebrow="FACULTY WORKSPACE" title={`Welcome, ${user.name}.`} subtitle="Review assigned students, record progress, and coordinate support.">
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className="metric-grid">
        <Metric label="Assigned students" value={rows.length} note={loading ? 'Loading authorized roster' : 'Scope enforced by the API'} tone="blue" />
        <Metric label="Students to monitor" value={rows.filter((item) => (item.attendance !== null && item.attendance < 75) || (item.mark !== '' && item.mark < 60)).length} note="Based on saved attendance and marks" tone="amber" />
        <Metric label="Open intervention cases" value={assignedCases.length} note="Assigned to your students" tone="cyan" />
        <Metric label="Follow-up records" value={followUpDone ? 'Updated' : openCase ? '1 due' : 'None'} note="Saved to the campus service" tone="green" />
      </div>
      <section className="panel table-panel role-table-panel">
        <div className="section-top"><div><span className="eyebrow">ROSTER & RECORDS</span><h2>Assigned students</h2></div><span className="status-chip blue">Faculty API scope</span></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Student</th><th>Department</th><th>Saved attendance</th><th>Today's attendance</th><th>Latest mark %</th><th>Record</th><th>Save</th></tr></thead>
          <tbody>{rows.map((item) => (
            <tr key={item.id}>
              <td><b>{item.name}</b><small className="table-subtext">{item.id}</small></td><td>{item.department}</td>
              <td>{item.attendance === null ? 'No data' : `${item.attendance}%`}</td>
              <td><label className="sr-only" htmlFor={`attendance-${item.id}`}>{item.name} attendance status</label><select id={`attendance-${item.id}`} className="table-number-input" value={item.attendanceStatus} onChange={(event) => updateRow(item.id, 'attendanceStatus', event.target.value)}><option value="">Select status</option><option>Present</option><option>Absent</option><option>Excused</option></select></td>
              <td><label className="sr-only" htmlFor={`mark-${item.id}`}>{item.name} latest mark percentage</label><input id={`mark-${item.id}`} className="table-number-input" type="number" min="0" max="100" step="1" value={item.mark} onChange={(event) => updateRow(item.id, 'mark', event.target.value)} /></td>
              <td><NavLink className="text-button" to={`/students/${item.id}`}>Review profile</NavLink></td>
              <td><button className="outline-button compact" onClick={() => saveRow(item.id)} disabled={savingIds.includes(item.id)}>{savingIds.includes(item.id) ? 'Saving…' : savedIds.includes(item.id) ? 'Saved' : 'Save records'}{invalidIds.includes(item.id) && <small className="field-error">Choose attendance and enter a mark from 0 to 100.</small>}</button></td>
            </tr>
          ))}{!rows.length && <tr><td colSpan="7" className="empty-table">{loading ? 'Loading assigned students…' : 'No assigned students are available.'}</td></tr>}</tbody>
        </table></div>
        <small className="demo-limit-note">Attendance is recorded for today; the latest mark record is updated or a new demo mark is created. Both changes persist in the local API.</small>
      </section>
      <div className="content-grid">
        <section className="panel chart-panel">
          <div className="section-top"><div><span className="eyebrow">LATEST SAVED MARKS</span><h2>Assigned student assessment averages</h2></div></div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={markSummary}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="subject" /><YAxis domain={[0, 100]} /><Tooltip /><Bar dataKey="mark" fill="#5267db" />
            </BarChart>
          </ResponsiveContainer>
          {!markSummary.length && <p className="role-copy">No assessment records are available for the assigned roster.</p>}
        </section>
        <section className="panel">
          <span className="eyebrow">FEEDBACK & RISK EXPLANATION</span><h2>{highestRisk ? `${highestRisk.name} · ${highestRisk.riskCategory}` : 'No risk records available'}</h2>
          <p className="role-copy">{recentFeedback ? `“${recentFeedback.text}”` : 'No saved student feedback is available.'}</p>
          {highestRisk && <><div className="result-tags"><span>Score {highestRisk.riskScore}</span><span>{highestRisk.attendance === null ? 'Attendance unavailable' : `Attendance ${highestRisk.attendance}%`}</span><span>{highestRisk.mark === '' ? 'Marks unavailable' : `${highestRisk.markSubject} ${highestRisk.mark}%`}</span></div><p className="role-copy">{highestRisk.riskExplanation}</p></>}
          <NavLink className="outline-button role-link" to="/explainable">Open explanation <ArrowUpRight size={14} /></NavLink>
        </section>
      </div>
      <div className="content-grid">
        <section className="panel">
          <div className="section-top"><div><span className="eyebrow">INTERVENTION CASE MANAGEMENT</span><h2>Assigned cases</h2></div><NavLink className="text-button" to="/interventions">View center</NavLink></div>
          {assignedCases.map((item) => <div className="intervention-row" key={item.id}><span className="status-mark blue"><ClipboardCheck size={12} /></span><div><b>{item.action}</b><small>{item.student_id} · Follow-up {item.due_date || 'not scheduled'}</small></div><span className="status-chip blue">{item.status}</span></div>)}
          <button className="outline-button role-link" onClick={recordFollowUp} disabled={!openCase || savingFollowUp}>{savingFollowUp ? 'Saving…' : followUpDone ? 'Follow-up recorded' : openCase ? 'Record follow-up' : 'No follow-up due'} <Check size={14} /></button>
        </section>
        <section className="panel"><span className="eyebrow">RELEVANT REPORTS</span><h2>Academic support reports</h2><p className="role-copy">Review the current campus demo trends and student support activity.</p><NavLink className="primary-button role-link" to="/reports">Open reports <ArrowUpRight size={14} /></NavLink></section>
      </div>
    </Page>
  )
}

function StudentDashboard({ user }) {
  const [feedback, setFeedback] = useState('')
  const [feedbackHistory, setFeedbackHistory] = useState([])
  const [record, setRecord] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const studentId = user.studentId
    let active = true
    Promise.all([
      apiRequest(`/students/${encodeURIComponent(studentId)}`),
      apiRequest(`/risk?student_id=${encodeURIComponent(studentId)}`),
      apiRequest(`/students/${encodeURIComponent(studentId)}/marks`),
      apiRequest(`/students/${encodeURIComponent(studentId)}/attendance`),
      apiRequest(`/students/${encodeURIComponent(studentId)}/feedback`),
      apiRequest(`/students/${encodeURIComponent(studentId)}/interventions`),
      apiRequest('/recommendations'),
      apiRequest('/notifications'),
    ])
      .then(([{ item: studentRecord }, { item: risk }, { items: marks }, { items: attendanceRecords }, { items: feedbackItems }, { items: interventionsList }, { items: recommendationItems }, { items: notices }]) => {
        if (!active) return
        const attendanceTrend = attendanceRecords
          .filter((item) => ['Present', 'Absent'].includes(item.status))
          .sort((left, right) => left.date.localeCompare(right.date))
          .map((item) => ({
            period: item.date,
            attendance: Number(item.total_count) > 0
              ? Math.round(Number(item.present_count) / Number(item.total_count) * 100)
              : item.status === 'Present' ? 100 : 0,
          }))
        setRecord({
          student: {
            ...studentRecord,
            initials: studentRecord.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase(),
            semester: studentRecord.semester.startsWith('Semester') ? studentRecord.semester : `Semester ${studentRecord.semester}`,
          },
          risk,
          marks,
          attendanceTrend,
          interventions: interventionsList,
          recommendations: recommendationItems,
          notifications: notices,
        })
        setFeedbackHistory([...feedbackItems].reverse())
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
    return () => { active = false }
  }, [user.studentId])

  const selectedStudent = record?.student
  if (error && !record) return <Page eyebrow="STUDENT WORKSPACE" title="Unable to load your record" subtitle={error} />
  if (!record) return <Page eyebrow="STUDENT WORKSPACE" title="Loading your record…" subtitle="Retrieving your authorized campus data." />
  if (!selectedStudent || !canAccessStudent(user, selectedStudent.id)) {
    return <Page eyebrow="STUDENT WORKSPACE" title="Student record unavailable" subtitle="No record is linked to this demo account." />
  }

  const submitFeedback = async (event) => {
    event.preventDefault()
    const cleanFeedback = feedback.trim()
    if (!cleanFeedback) return
    setError('')
    setSubmitting(true)
    try {
      const { item } = await apiRequest('/feedback', {
        method: 'POST',
        body: { student_id: selectedStudent.id, text: cleanFeedback },
      })
      setFeedbackHistory((current) => [item, ...current])
      setFeedback('')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }
  const subjects = record.marks.map((item) => ({
    subject: item.subject,
    mark: Number(item.max_score) ? Math.round(Number(item.score) / Number(item.max_score) * 100) : 0,
  }))
  const weakestSubject = [...subjects].sort((a, b) => a.mark - b.mark)[0]
  const supportCase = record.interventions[0]
  const recommendation = record.recommendations[0]
  const averageMark = subjects.length
    ? Math.round(subjects.reduce((total, item) => total + item.mark, 0) / subjects.length)
    : null

  return (
    <Page eyebrow="STUDENT WORKSPACE · PRIVATE DEMO VIEW" title={`Hello, ${selectedStudent.name}.`} subtitle={`${selectedStudent.id} · ${selectedStudent.department} · ${selectedStudent.semester}`}>
      <div className="student-hero">
        <div className="profile-block"><div className="avatar large">{selectedStudent.initials}</div><div><h2>My progress</h2><p>Only the record linked to your student account is shown.</p></div></div>
        <span className="status-chip red">{selectedStudent.status}</span>
      </div>
      <div className="metric-grid">
        <Metric label="Attendance" value={record.risk.attendance_percent === null ? 'No data' : `${record.risk.attendance_percent}%`} note="Calculated from saved attendance records" tone={record.risk.attendance_percent !== null && record.risk.attendance_percent < 70 ? 'red' : 'green'} />
        <Metric label="Academic progress" value={averageMark === null ? 'No data' : `${averageMark}%`} note="Average of saved mark records" tone="blue" />
        <Metric label="Weak subject insight" value={weakestSubject?.subject || 'No data'} note={weakestSubject ? `${weakestSubject.mark}% · review with your faculty team` : 'No marks have been recorded.'} tone="amber" />
        <Metric label="Support case" value={supportCase?.status || 'None'} note={supportCase?.action || 'No intervention is currently recorded.'} tone="green" />
      </div>
      <div className="content-grid">
        <section className="panel chart-panel">
          <div className="section-top"><div><span className="eyebrow">MY ATTENDANCE TREND</span><h2>Recent attendance</h2></div></div>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={record.attendanceTrend}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="period" /><YAxis domain={[0, 100]} /><Tooltip /><Line type="monotone" dataKey="attendance" stroke="#10a9c4" strokeWidth={3} /></LineChart>
          </ResponsiveContainer>
          {!record.attendanceTrend.length && <p className="demo-limit-note">No dated attendance records are available.</p>}
        </section>
        <section className="panel chart-panel">
          <div className="section-top"><div><span className="eyebrow">MY SUBJECT MARKS</span><h2>Academic progress</h2></div></div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={subjects}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="subject" /><YAxis domain={[0, 100]} /><Tooltip /><Bar dataKey="mark" fill="#5267db" /></BarChart>
          </ResponsiveContainer>
        </section>
      </div>
      <div className="content-grid">
        <section className="panel"><span className="eyebrow">PERSONAL RECOMMENDATION</span><h2>{recommendation?.issue || supportCase?.action || 'Stay connected with your faculty team'}</h2><p className="role-copy">{recommendation?.action || 'Your saved support plan and progress are shown here.'}</p>{recommendation && <div className="result-tags"><span>{recommendation.status}</span><span>{recommendation.evidence}</span></div>}{supportCase && <div className="intervention-row"><span className="status-mark blue"><ClipboardCheck size={12} /></span><div><b>{supportCase.action}</b><small>Case status · {supportCase.status} · Follow-up {supportCase.due_date || 'not scheduled'}</small></div><span className="status-chip blue">{supportCase.status}</span></div>}<div className="info-row"><b>Assignments</b><span>Assignment data is not available.</span></div></section>
        <section className="panel"><span className="eyebrow">PROGRESS TIMELINE</span><h2>Recent updates</h2><div className="timeline role-timeline"><div><b>Support case opened</b><small>Faculty review recommended practical mentoring.</small></div><div><b>Next follow-up</b><small>Review attendance and DBMS practice progress.</small></div><div><b>Feedback received</b><small>{feedbackHistory.length} feedback item{feedbackHistory.length === 1 ? '' : 's'} in your demo history.</small></div></div></section>
      </div>
      <section className="panel role-feedback-panel">
        <span className="eyebrow">MY FEEDBACK</span><h2>Submit feedback</h2>
        {error && <div className="error-banner" role="alert">{error}</div>}
        <form onSubmit={submitFeedback}><label className="role-field-label" htmlFor="student-feedback">Your message</label><textarea id="student-feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Share a note with your faculty team…" /><button className="primary-button role-link" type="submit" disabled={!feedback.trim() || submitting}>{submitting ? 'Submitting…' : 'Submit feedback'} <Send size={14} /></button></form>
        <div className="feedback-history"><b>Feedback history</b>{feedbackHistory.map((item) => <p key={item.id}>{item.text}</p>)}</div>
      </section>
      <section className="panel">
        <span className="eyebrow">MY NOTIFICATIONS</span><h2>Recent personal alerts</h2>
        {record.notifications.map((item) => <div className="notification-item" key={item.id}><span className="signal-dot blue" /><div><b>{item.type}</b><p>{item.message}</p><small>{item.created_at}</small></div></div>)}
      </section>
    </Page>
  )
}

function ParentDashboard({ user }) {
  const [record, setRecord] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const studentId = user.linkedStudentId
    let active = true
    Promise.all([
      apiRequest(`/students/${encodeURIComponent(studentId)}`),
      apiRequest(`/risk?student_id=${encodeURIComponent(studentId)}`),
      apiRequest(`/students/${encodeURIComponent(studentId)}/marks`),
      apiRequest(`/students/${encodeURIComponent(studentId)}/attendance`),
      apiRequest(`/students/${encodeURIComponent(studentId)}/interventions`),
      apiRequest('/recommendations'),
      apiRequest('/notifications'),
    ])
      .then(([{ item: studentRecord }, { item: risk }, { items: marks }, { items: attendanceRecords }, { items: interventionsList }, { items: recommendationItems }, { items: notices }]) => {
        if (!active) return
        setRecord({
          student: {
            ...studentRecord,
            initials: studentRecord.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase(),
            semester: studentRecord.semester.startsWith('Semester') ? studentRecord.semester : `Semester ${studentRecord.semester}`,
          },
          risk,
          marks: marks.map((item) => ({
            subject: item.subject,
            mark: Number(item.max_score) ? Math.round(Number(item.score) / Number(item.max_score) * 100) : 0,
          })),
          attendanceTrend: attendanceRecords
            .filter((item) => ['Present', 'Absent'].includes(item.status))
            .sort((left, right) => left.date.localeCompare(right.date))
            .map((item) => ({
              period: item.date,
              attendance: Number(item.total_count) > 0
                ? Math.round(Number(item.present_count) / Number(item.total_count) * 100)
                : item.status === 'Present' ? 100 : 0,
            })),
          interventions: interventionsList,
          recommendations: recommendationItems,
          notifications: notices,
        })
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
    return () => { active = false }
  }, [user.linkedStudentId])

  if (error) return <Page eyebrow="GUARDIAN WORKSPACE" title="Unable to load linked student" subtitle={error} />
  if (!record) return <Page eyebrow="GUARDIAN WORKSPACE" title="Loading linked student…" subtitle="Retrieving the authorized guardian view." />
  const linkedStudent = record.student
  const isLinked = canAccessStudent(user, linkedStudent.id)
  if (!isLinked) return <Page eyebrow="GUARDIAN WORKSPACE" title="No linked student" subtitle="This demo guardian account has no permitted student record." />
  const averageMark = record.marks.length
    ? Math.round(record.marks.reduce((total, item) => total + item.mark, 0) / record.marks.length)
    : null
  const supportCase = record.interventions[0]
  const recommendation = record.recommendations[0]

  return (
    <Page eyebrow="GUARDIAN WORKSPACE · LINKED STUDENT VIEW" title="Student support overview" subtitle={`${linkedStudent.name} · ${linkedStudent.id} · ${linkedStudent.department}`}>
      <div className="demo-note guardian-scope-note"><HeartHandshake size={17} /><span><b>Explicitly linked demo record</b><small>This guardian account can only view {linkedStudent.name} ({linkedStudent.id}).</small></span></div>
      <div className="metric-grid">
        <Metric label="Attendance" value={record.risk.attendance_percent === null ? 'No data' : `${record.risk.attendance_percent}%`} note="Calculated from saved attendance records" tone="red" />
        <Metric label="Academic progress" value={averageMark === null ? 'No data' : `${averageMark}%`} note="Average of saved mark records" tone="amber" />
        <Metric label="Recommendation" value={record.risk.recommendation} note={record.risk.explanation} tone="blue" />
        <Metric label="Intervention status" value={supportCase?.status || 'None'} note={supportCase?.due_date || 'No follow-up date recorded.'} tone="green" />
      </div>
      <div className="content-grid">
        <section className="panel chart-panel"><div className="section-top"><div><span className="eyebrow">ACADEMIC RECORDS</span><h2>Linked student marks</h2></div></div><ResponsiveContainer width="100%" height={220}><BarChart data={record.marks}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="subject" /><YAxis domain={[0, 100]} /><Tooltip /><Bar dataKey="mark" fill="#5267db" /></BarChart></ResponsiveContainer></section>
        <section className="panel"><span className="eyebrow">GUARDIAN NOTIFICATIONS</span><h2>Recent alerts</h2>{record.notifications.length ? record.notifications.map((item) => <div className="notification-item" key={item.id}><span className="signal-dot blue" /><div><b>{item.type}</b><p>{item.message}</p><small>{item.created_at}</small></div></div>) : <p className="role-copy">No current alerts for the linked student.</p>}</section>
      </div>
      <section className="panel chart-panel guardian-trend-panel"><div className="section-top"><div><span className="eyebrow">ATTENDANCE RECORDS</span><h2>Linked student attendance by date</h2></div></div><ResponsiveContainer width="100%" height={210}><LineChart data={record.attendanceTrend}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="period" /><YAxis domain={[0, 100]} /><Tooltip /><Line type="monotone" dataKey="attendance" stroke="#10a9c4" strokeWidth={3} /></LineChart></ResponsiveContainer>{!record.attendanceTrend.length && <p className="demo-limit-note">No dated attendance records are available.</p>}</section>
      <section className="panel chart-panel guardian-trend-panel"><div className="section-top"><div><span className="eyebrow">ACADEMIC FOLLOW-UP</span><h2>Recorded marks by subject</h2></div></div><ResponsiveContainer width="100%" height={190}><BarChart data={record.marks}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="subject" /><YAxis domain={[0, 100]} /><Tooltip /><Bar dataKey="mark" fill="#5267db" /></BarChart></ResponsiveContainer><p className="demo-limit-note">Scores are read from saved assessment records.</p></section>
      <div className="content-grid">
        <section className="panel"><span className="eyebrow">INTERVENTION UPDATES</span><h2>Support plan</h2>{supportCase ? <div className="intervention-row"><span className="status-mark blue"><ClipboardCheck size={12} /></span><div><b>{supportCase.action}</b><small>Follow-up {supportCase.due_date || 'not scheduled'}</small></div><span className="status-chip blue">{supportCase.status}</span></div> : <p className="role-copy">No intervention has been recorded.</p>}<p className="role-copy">This summary is read from the linked student's saved support plan.</p></section>
        <section className="panel"><span className="eyebrow">COMMUNICATION HISTORY</span><h2>Guardian updates</h2>{record.notifications.length ? record.notifications.map((item) => <div className="notification-item" key={item.id}><span className="signal-dot blue" /><div><b>{item.type}</b><p>{item.message}</p><small>{item.created_at}</small></div></div>) : <p className="role-copy">No guardian updates are recorded.</p>}{recommendation && <p className="role-copy">Current recommendation: {recommendation.action}</p>}</section>
      </div>
    </Page>
  )
}

function UserManagement() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiRequest('/users')
      .then(({ items }) => {
        if (active) setAccounts(items)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  return (
    <Page eyebrow="SYSTEM ADMINISTRATION" title="User & role management" subtitle="Review account status, role, and authorized student scope from the local API.">
      {error && <div className="error-banner" role="alert">{error}</div>}
      <section className="panel table-panel role-table-panel"><div className="table-head"><b>Campus accounts</b><span>{loading ? 'Loading accounts…' : `${accounts.length} accounts`}</span></div><div className="table-wrap"><table><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Permitted student scope</th><th>Status</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td><b>{account.name}</b></td><td>{account.email}</td><td><span className="status-chip blue">{account.role}</span></td><td>{account.role === 'admin' ? 'Campus-wide' : account.role === 'faculty' ? account.assignedStudentIds.join(', ') || 'No assigned students' : account.studentId || account.linkedStudentId || 'Not linked'}</td><td><span className={`status-chip ${account.active ? 'green' : 'red'}`}>{account.active ? 'Active' : 'Inactive'}</span></td></tr>)}</tbody></table></div>{!loading && !accounts.length && <p className="role-copy">No user accounts are available.</p>}<p className="demo-limit-note">Accounts are stored locally for demonstration. Password hashes are never returned by this endpoint.</p></section>
      <div className="metric-grid"><Metric label="Student accounts" value={accounts.filter((account) => account.role === 'student').length} note="API user records" tone="blue" /><Metric label="Faculty accounts" value={accounts.filter((account) => account.role === 'faculty').length} note="API user records" tone="cyan" /><Metric label="Role types" value={new Set(accounts.map((account) => account.role)).size} note="Distinct account roles" tone="green" /><Metric label="Guardian accounts" value={accounts.filter((account) => account.role === 'parent').length} note="API user records" tone="amber" /></div>
    </Page>
  )
}

function DepartmentManagement() {
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiRequest('/departments')
      .then(({ items }) => {
        if (active) setDepartments(items)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  return (
    <Page eyebrow="CAMPUS ADMINISTRATION" title="Department management" subtitle="Department summaries are derived from active student records in the local API.">
      {error && <div className="error-banner" role="alert">{error}</div>}
      {loading && <p className="role-copy">Loading department summaries…</p>}
      <div className="department-grid">{departments.map((department) => (
        <section className="panel department-card" key={department.name}><div className="brand-mark"><Building2 size={17} /></div><span className="eyebrow">DEPARTMENT</span><h2>{department.name}</h2><p>{department.student_count} active student records.</p><div className="result-tags"><span>{department.stable} stable</span><span>{department.monitor} monitor</span><span>{department.support_required} support required</span></div><NavLink className="text-button" to="/students">Open student management <ArrowUpRight size={13} /></NavLink></section>
      ))}</div>
      {!loading && !departments.length && !error && <p className="role-copy">No departments can be derived from active student records.</p>}
      <p className="demo-limit-note">This view is read-only; departments are grouped from student records rather than maintained as independent entities.</p>
    </Page>
  )
}

function SupportRadar({ items }) {
  const priority = [...items]
    .filter((item) => item.data_sufficient)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)

  return (
    <section className="panel">
      <div className="section-top">
        <div><span className="eyebrow">STUDENT SUPPORT RADAR</span><h2>Highest review scores</h2></div>
        <NavLink className="text-button" to="/concerns">View all</NavLink>
      </div>
      <div className="radar-visual">
        <div className="radar-list">
          {priority.map((studentItem) => (
            <div className="radar-student" key={studentItem.id}>
              <div className="avatar small">{studentItem.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>
              <div><b>{studentItem.name}</b><small>{studentItem.id} · {studentItem.department}</small></div>
              <span className="status-chip amber">{studentItem.category} · {studentItem.score}</span>
            </div>
          ))}
          {!priority.length && <p className="role-copy">No sufficient risk records are available yet.</p>}
        </div>
      </div>
    </section>
  )
}

function Directory({ user }) {
  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState('All departments')
  const [support, setSupport] = useState('All support levels')
  const [studentList, setStudentList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    apiRequest('/students')
      .then(({ items }) => {
        if (active) setStudentList(items.map((item) => ({
          ...item,
          initials: item.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase(),
          semester: item.semester.startsWith('Semester') ? item.semester : `Semester ${item.semester}`,
        })))
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const filteredStudents = useMemo(() => {
    return studentList.filter((item) => canAccessStudent(user, item.id)).filter((item) => {
      const matchText = `${item.name} ${item.id}`.toLowerCase().includes(query.toLowerCase())
      const matchDepartment = department === 'All departments' || item.department === department
      const matchSupport = support === 'All support levels' || item.status === support
      return matchText && matchDepartment && matchSupport
    })
  }, [department, query, studentList, support, user])

  const handleDelete = async (id) => {
    const studentToRemove = studentList.find((item) => item.id === id)
    if (!studentToRemove) return
    if (window.confirm(`Delete ${studentToRemove.name} from directory?`)) {
      setError('')
      try {
        await apiRequest(`/students/${encodeURIComponent(id)}`, { method: 'DELETE' })
        setStudentList((current) => current.filter((item) => item.id !== id))
      } catch (deleteError) {
        setError(deleteError.message)
      }
    }
  }

  const [showAddForm, setShowAddForm] = useState(false)
  const [newStudent, setNewStudent] = useState({
    name: '',
    id: '',
    email: '',
    department: 'Computer Science',
    semester: 'Semester 1',
  })

  const addStudent = async () => {
    setError('')
    setSaving(true)
    try {
      const { item } = await apiRequest('/students', { method: 'POST', body: newStudent })
      setStudentList((current) => [{
        ...item,
        initials: item.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase(),
        semester: item.semester.startsWith('Semester') ? item.semester : `Semester ${item.semester}`,
      }, ...current])
      setNewStudent({ name: '', id: '', email: '', department: 'Computer Science', semester: 'Semester 1' })
      setShowAddForm(false)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page eyebrow="STUDENT INTELLIGENCE" title="Student directory" subtitle="Browse and manage the role-scoped records stored by the local campus API.">
      <div className="directory-toolbar">
        <div className="input-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by student name or ID" /></div>
        <select value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option>All departments</option>
          {[...new Set(studentList.map((item) => item.department))].sort().map((name) => <option key={name}>{name}</option>)}
        </select>
        <select value={support} onChange={(e) => setSupport(e.target.value)}>
          <option>All support levels</option>
          <option>Stable</option>
          <option>Monitor</option>
          <option>Support Required</option>
        </select>
        {user.role === 'admin' && <button className="primary-button" onClick={() => setShowAddForm((value) => !value)}>Add student</button>}
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}

      {showAddForm && (
        <section className="panel form-panel">
          <div className="form-grid">
            <label>Full name<input value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} /></label>
            <label>Student ID<input value={newStudent.id} onChange={(e) => setNewStudent({ ...newStudent, id: e.target.value })} /></label>
            <label>Email address<input type="email" value={newStudent.email} onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })} /></label>
            <label>Department<select value={newStudent.department} onChange={(e) => setNewStudent({ ...newStudent, department: e.target.value })}><option>Computer Science</option><option>Engineering</option><option>Science</option></select></label>
            <label>Semester<select value={newStudent.semester} onChange={(e) => setNewStudent({ ...newStudent, semester: e.target.value })}><option>Semester 1</option><option>Semester 2</option><option>Semester 4</option><option>Semester 6</option></select></label>
          </div>
          <div className="student-actions">
            <button className="primary-button" onClick={addStudent} disabled={saving}>{saving ? 'Saving…' : 'Save student'}</button>
            <button className="outline-button" onClick={() => setShowAddForm(false)}>Cancel</button>
          </div>
        </section>
      )}

      <section className="panel table-panel">
        <div className="table-head"><b>Students</b><span>{loading ? 'Loading records…' : `Showing ${filteredStudents.length} records`}</span></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Department</th>
                <th>Email</th>
                <th>Support level</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length ? filteredStudents.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="student-cell">
                      <div className="avatar small">{item.initials || item.name.slice(0, 2).toUpperCase()}</div>
                      <div><b>{item.name}</b><small>{item.id} · {item.semester}</small></div>
                    </div>
                  </td>
                  <td>{item.department}</td>
                  <td>{item.email}</td>
                  <td><span className={`status-chip ${item.status === 'Stable' ? 'green' : item.status === 'Monitor' ? 'amber' : 'red'}`}>{item.status}</span></td>
                  <td>
                    <div className="student-actions compact-actions">
                      <NavLink className="text-button" to={`/students/${item.id}`}>View profile</NavLink>
                      {user.role === 'admin' && <button className="text-button danger" onClick={() => handleDelete(item.id)}>Deactivate</button>}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="empty-table">{loading ? 'Loading student records…' : 'No students match the current filters.'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </Page>
  )
}

function Student360({ studentId }) {
  const [profile, setProfile] = useState(null)
  const [subjectScores, setSubjectScores] = useState([])
  const [attendance, setAttendance] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest(`/students/${encodeURIComponent(studentId)}`),
      apiRequest(`/risk?student_id=${encodeURIComponent(studentId)}`),
      apiRequest(`/students/${encodeURIComponent(studentId)}/marks`),
    ])
      .then(([{ item }, { item: risk }, { items: marks }]) => {
        if (!active) return
        setProfile({
          ...item,
          initials: item.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase(),
          semester: item.semester.startsWith('Semester') ? item.semester : `Semester ${item.semester}`,
        })
        setAttendance(risk.attendance_percent)
        setSubjectScores(marks.map((mark) => ({
          subject: mark.subject,
          current: Number(mark.max_score) ? Number(mark.score) / Number(mark.max_score) * 100 : 0,
        })))
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
    return () => { active = false }
  }, [studentId])

  if (error) return <Page eyebrow={`STUDENT 360° · ${studentId}`} title="Unable to load student record" subtitle={error} />
  if (!profile) return <Page eyebrow={`STUDENT 360° · ${studentId}`} title="Loading student record…" subtitle="Retrieving authorized student data." />

  const selectedStudent = { ...profile, attendance }
  const academicScore = subjectScores.length
    ? Math.round(subjectScores.reduce((total, item) => total + item.current, 0) / subjectScores.length)
    : null

  return (
    <Page eyebrow={`STUDENT 360° · ${selectedStudent.id}`} title={selectedStudent.name} subtitle={`${selectedStudent.id} · ${selectedStudent.department} · ${selectedStudent.semester}`} action={<span className={`status-chip ${selectedStudent.status === 'Stable' ? 'green' : selectedStudent.status === 'Monitor' ? 'amber' : 'red'}`}>{selectedStudent.status}</span>}>
      <div className="student-hero">
        <div className="profile-block">
          <div className="avatar large">{selectedStudent.initials}</div>
          <div>
            <h2>{selectedStudent.name}</h2>
            <p>Profile details from the local API.</p>
          </div>
        </div>
        <NavLink className="primary-button role-link" to="/interventions">Create intervention <ClipboardCheck size={15} /></NavLink>
      </div>

      <div className="metric-grid">
        <Metric label="Attendance" value={selectedStudent.attendance === null ? 'No data' : `${selectedStudent.attendance}%`} note={selectedStudent.attendance === null ? 'No saved attendance' : 'Calculated from saved records'} tone={selectedStudent.attendance !== null && selectedStudent.attendance < 70 ? 'red' : 'green'} />
        <Metric label="Academic health" value={academicScore === null ? 'No data' : `${academicScore}%`} note={`${subjectScores.length} mark records`} tone="amber" />
        <Metric label="Assignments" value="Not recorded" note="Assignment data is not available." tone="amber" />
        <Metric label="Support status" value={selectedStudent.status} note="From the saved student record" tone="blue" />
      </div>

      <div className="content-grid student-grid">
        <section className="panel">
          <div className="section-top"><div><span className="eyebrow">PERFORMANCE</span><h2>Subject performance</h2></div></div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={subjectScores}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="subject" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="previous" fill="#dfe7f2" />
              <Bar dataKey="current" fill="#5267db" />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="panel">
          <span className="eyebrow">STUDENT JOURNEY</span>
          <h2>Signal timeline</h2>
          <p className="role-copy">Student status: {selectedStudent.status}. Additional journey events are not available in this record.</p>
        </section>
      </div>
    </Page>
  )
}

function Metric({ label, value, note, tone }) {
  return (
    <div className={`metric-box ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  )
}

function Explainable() {
  const [studentList, setStudentList] = useState([])
  const [studentId, setStudentId] = useState('')
  const [record, setRecord] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiRequest('/students')
      .then(({ items }) => {
        if (!active) return
        setStudentList(items)
        setStudentId(items[0]?.id || '')
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!studentId) return undefined
    let active = true
    Promise.all([
      apiRequest(`/students/${encodeURIComponent(studentId)}`),
      apiRequest(`/risk?student_id=${encodeURIComponent(studentId)}`),
      apiRequest(`/students/${encodeURIComponent(studentId)}/marks`),
    ])
      .then(([{ item: studentRecord }, { item: risk }, { items: marks }]) => {
        if (active) setRecord({ student: studentRecord, risk, marks })
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
    return () => { active = false }
  }, [studentId])

  const academicAverage = record?.marks.length
    ? Math.round(record.marks.reduce((total, item) => total + (Number(item.max_score) ? Number(item.score) / Number(item.max_score) * 100 : 0), 0) / record.marks.length)
    : null

  return (
    <Page eyebrow="EXPLAINABLE INTELLIGENCE" title="Why is this student flagged?" subtitle="Review the selected student's current rule-based score, recorded evidence, and limitations.">
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className="directory-toolbar"><label className="form-label">Student<select value={studentId} onChange={(event) => { setRecord(null); setError(''); setStudentId(event.target.value) }}><option value="">Select a student</option>{studentList.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.id})</option>)}</select></label></div>
      {studentId && record?.student.id !== studentId && <p className="role-copy">Loading selected student's evidence…</p>}
      {record?.student.id === studentId && <>
      <div className="explain-grid">
        <section className="panel">
          <div className="profile-block">
            <div className="avatar large">{record.student.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>
            <div><h2>{record.student.name}</h2><p>{record.student.id} · {record.student.department} · {record.student.semester.startsWith('Semester') ? record.student.semester : `Semester ${record.student.semester}`}</p></div>
          </div>
          <div className="signal-summary">
            <span className={`status-chip ${record.risk.category === 'High / Support Review Required' ? 'red' : record.risk.category === 'Moderate' ? 'amber' : 'green'}`}>{record.risk.category} · {record.risk.score}</span>
            <p>{record.risk.explanation}</p>
          </div>
          <div className="evidence-list">
            {record.risk.attendance_percent !== null && <Evidence label="Attendance" value={`${record.risk.attendance_percent}%`} width={`${record.risk.attendance_percent}%`} tone={record.risk.attendance_percent < 60 ? 'red' : 'amber'} />}
            {record.risk.academic_average !== null && <Evidence label="Academic average" value={`${record.risk.academic_average}%`} width={`${record.risk.academic_average}%`} tone={record.risk.academic_average < 40 ? 'red' : 'amber'} />}
            {record.risk.factors.map((factor) => <div className="info-row" key={factor.factor}><b>{factor.factor.replaceAll('_', ' ')} · {factor.points} points</b><span>{factor.reason}</span></div>)}
            {!record.risk.data_sufficient && <p className="role-copy">There is not enough recorded data to assess this student.</p>}
          </div>
        </section>

        <section className="recommendation-card">
          <Sparkles size={19} />
          <span className="eyebrow">RULE-BASED SUGGESTION</span>
          <h2>{record.risk.recommendation}</h2>
          <p>This suggestion is generated from current thresholds and is not a validated prediction. Human review is required.</p>
          <div className="result-tags"><span>{record.marks.length} saved mark records</span><span>{academicAverage === null ? 'No marks' : `Average ${academicAverage}%`}</span></div>
          <NavLink className="primary-button role-link" to="/interventions">Create intervention <ArrowUpRight size={14} /></NavLink>
        </section>
      </div>
      </>}
    </Page>
  )
}

function Evidence({ label, value, width, tone }) {
  return (
    <div className="evidence-row">
      <div className="evidence-row-head"><span>{label}</span><b>{value}</b></div>
      <div className="evidence-track"><i className={tone} style={{ width }} /></div>
    </div>
  )
}

function Brain() {
  const [stages, setStages] = useState([])
  const [cases, setCases] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([apiRequest('/data-flow'), apiRequest('/interventions'), apiRequest('/recommendations')])
      .then(([flow, { items: interventionItems }, { items: recommendationItems }]) => {
        if (!active) return
        setStages(flow.stages)
        setCases(interventionItems)
        setRecommendations(recommendationItems)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
    return () => { active = false }
  }, [])
  const steps = ['Data', 'Analysis', 'Insights', 'Explanation', 'Recommendation', 'Human review', 'Intervention', 'Follow-up', 'Outcome']
  return (
    <Page eyebrow="INTELLIGENCE ORCHESTRATION" title="Campus Brain" subtitle="Current data pipeline counts from local storage; this is a workflow map, not an autonomous decision system.">
      {error && <div className="error-banner" role="alert">{error}</div>}
      <section className="brain-stage">
        <span className="eyebrow">LOCAL API DATA FLOW</span>
        <h2>Saved records to human review</h2>
        <div className="brain-flow">
          {steps.map((step, index) => (
            <div className="brain-step" key={step}>
              <div className={`brain-node ${index === 4 ? 'active' : ''}`}><span>{String(index + 1).padStart(2, '0')}</span><Sparkles size={19} /></div>
              <b>{step}</b>
              {index < 8 && <i className="flow-line" />}
            </div>
          ))}
        </div>
        <div className="brain-detail">
          <Sparkles size={20} />
          <div>
            <span className="eyebrow">CURRENT SAVED RECORDS</span>
            <h3>{recommendations.length} recommendations · {cases.length} intervention cases</h3>
            <p>Risk results use prototype rules. A person must review the underlying evidence and decide on any support action.</p>
          </div>
          <NavLink className="outline-button role-link" to="/interventions">Review cases <ArrowUpRight size={14} /></NavLink>
        </div>
        <div className="list-stack">{stages.map((stage) => <div className="info-row" key={stage.stage}><b>{stage.stage}</b><span>{stage.count} records · {stage.source}</span></div>)}</div>
      </section>
    </Page>
  )
}

function Simulation() {
  const [attendance, setAttendance] = useState(64)

  return (
    <Page eyebrow="DECISION SUPPORT" title="Scenario planning" subtitle="The app does not have a validated what-if model. Set a planning target without treating it as a predicted outcome.">
      <div className="simulation-grid">
        <section className="panel">
          <span className="eyebrow">PLANNING INPUT</span>
          <h2>Set a possible attendance target</h2>
          <label className="range-label">Target <b>{attendance}%</b><input type="range" min="50" max="100" value={attendance} onChange={(e) => setAttendance(Number(e.target.value))} /></label>
          <p className="role-copy">This value is a planning prompt only. It is not saved and does not change a student record.</p>
          <NavLink className="primary-button role-link" to="/interventions">Create a real support case <ArrowUpRight size={14} /></NavLink>
        </section>

        <section className="panel sim-result">
          <span className="eyebrow">MODEL AVAILABILITY</span>
          <h2>No outcome projection is available</h2>
          <p className="role-copy">There is no validated model to estimate attendance, academic scores, or support outcomes from a target. The app will not display invented projections.</p>
        </section>
      </div>
    </Page>
  )
}

function Interventions() {
  const [items, setItems] = useState([])
  const [studentList, setStudentList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newCase, setNewCase] = useState({
    student_id: '',
    action: '',
    due_date: new Date().toISOString().slice(0, 10),
  })

  useEffect(() => {
    let active = true
    Promise.all([apiRequest('/interventions'), apiRequest('/students')])
      .then(([{ items: interventionItems }, { items: studentsForUser }]) => {
        if (!active) return
        setItems(interventionItems)
        setStudentList(studentsForUser)
        setNewCase((current) => ({
          ...current,
          student_id: current.student_id || studentsForUser[0]?.id || '',
        }))
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const createCase = async (event) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const { item } = await apiRequest('/interventions', { method: 'POST', body: newCase })
      setItems((current) => [item, ...current])
      setNewCase((current) => ({ ...current, action: '' }))
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (item, status) => {
    setError('')
    try {
      const { item: updated } = await apiRequest(`/interventions/${encodeURIComponent(item.id)}`, {
        method: 'PUT',
        body: { status },
      })
      setItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry))
    } catch (updateError) {
      setError(updateError.message)
    }
  }

  const statuses = [
    { value: 'Open', label: 'Open' },
    { value: 'In Progress', label: 'In progress' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Cancelled', label: 'Cancelled' },
  ]

  return (
    <Page eyebrow="SUPPORT OPERATIONS" title="Intervention center" subtitle="Coordinate human support from first signal through follow-up.">
      {error && <div className="error-banner" role="alert">{error}</div>}
      <section className="panel form-panel">
        <span className="eyebrow">CREATE SUPPORT CASE</span>
        <form className="form-grid" onSubmit={createCase}>
          <label>Student<select required value={newCase.student_id} onChange={(event) => setNewCase({ ...newCase, student_id: event.target.value })}><option value="">Select student</option>{studentList.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select></label>
          <label>Follow-up date<input required type="date" value={newCase.due_date} onChange={(event) => setNewCase({ ...newCase, due_date: event.target.value })} /></label>
          <label className="wide-field">Support action<input required maxLength="500" value={newCase.action} onChange={(event) => setNewCase({ ...newCase, action: event.target.value })} placeholder="Describe the human-led follow-up" /></label>
          <button className="primary-button" type="submit" disabled={saving || !studentList.length}>{saving ? 'Saving…' : 'Create intervention'}</button>
        </form>
      </section>
      <div className="kanban">
        {statuses.map(({ value, label }) => {
          const group = items.filter((item) => item.status === value)
          return (
            <section className="kanban-col" key={value}>
              <div className="kanban-head"><b>{label}</b><span>{group.length}</span></div>
              {group.length ? group.map((item) => {
                const owner = studentList.find((studentRecord) => studentRecord.id === item.student_id)
                return (
                  <div className="intervention-card" key={item.id}>
                    <span className="status-chip blue">{item.status}</span>
                    <h3>{item.action}</h3>
                    <div className="card-meta">
                      <div className="avatar tiny">{owner?.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase() || item.student_id.slice(0, 2)}</div>
                      <span>{owner?.name || item.student_id}</span>
                      <small>Due {item.due_date || 'not scheduled'}</small>
                    </div>
                    <label className="sr-only" htmlFor={`intervention-status-${item.id}`}>Update status for {item.action}</label>
                    <select id={`intervention-status-${item.id}`} value={item.status} onChange={(event) => updateStatus(item, event.target.value)}>{statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                  </div>
                )
              }) : (
                <div className="empty-kanban"><Check size={16} /><span>{loading ? 'Loading cases…' : 'No cases here'}</span></div>
              )}
          </section>
          )
        })}
      </div>
    </Page>
  )
}

function GuardianConnect() {
  const [studentsList, setStudentsList] = useState([])
  const [accounts, setAccounts] = useState([])
  const [studentId, setStudentId] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sentUpdates, setSentUpdates] = useState([])

  useEffect(() => {
    let active = true
    Promise.all([apiRequest('/students'), apiRequest('/users')])
      .then(([{ items: roster }, { items: users }]) => {
        if (!active) return
        const guardians = users.filter((account) => account.role === 'parent' && account.active && account.linkedStudentId)
        const linkedIds = new Set(guardians.map((account) => account.linkedStudentId))
        setStudentsList(roster.filter((studentRecord) => linkedIds.has(studentRecord.id)))
        setAccounts(guardians)
        setStudentId(roster.find((studentRecord) => linkedIds.has(studentRecord.id))?.id || '')
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const selectedGuardians = accounts.filter((account) => account.linkedStudentId === studentId)
  const sendUpdate = async (event) => {
    event.preventDefault()
    if (!studentId || !message.trim()) {
      setError('Select a linked student and enter an update.')
      return
    }
    setError('')
    setSuccess('')
    setSending(true)
    try {
      const { items } = await apiRequest('/notifications', {
        method: 'POST',
        body: { student_id: studentId, message },
      })
      setSentUpdates((current) => [...items, ...current])
      setMessage('')
      setSuccess(`Portal update saved for ${items.length} linked guardian account${items.length === 1 ? '' : 's'}. No SMS or email was sent.`)
    } catch (sendError) {
      setError(sendError.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Page eyebrow="COMMUNICATION" title="Guardian connect" subtitle="Create a saved notification in a linked guardian's portal inbox.">
      {error && <div className="error-banner" role="alert">{error}</div>}
      {success && <div className="success-banner" role="status">{success}</div>}
      <div className="content-grid">
        <section className="panel">
          <span className="eyebrow">ACTIVE LINKED ACCOUNTS</span>
          <h2>Parents and guardians</h2>
          {loading && <p className="role-copy">Loading linked accounts…</p>}
          <div className="list-stack">
            {studentsList.map((studentRecord) => (
              <div className="contact-row" key={studentRecord.id}>
                <div className="avatar small">{studentRecord.name.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase()}</div>
                <div><b>{studentRecord.name}</b><small>{studentRecord.id} · {accounts.filter((account) => account.linkedStudentId === studentRecord.id).map((account) => account.email).join(', ')}</small></div>
                <span className="status-chip green">Portal linked</span>
              </div>
            ))}
            {!loading && !studentsList.length && <p className="role-copy">No active guardian accounts are linked to the available students.</p>}
          </div>
        </section>

        <section className="panel">
          <span className="eyebrow">PORTAL INBOX</span>
          <h2>Create guardian update</h2>
          <form onSubmit={sendUpdate}>
            <label className="form-label">Linked student<select value={studentId} onChange={(event) => setStudentId(event.target.value)} disabled={loading || sending}><option value="">Select a student</option>{studentsList.map((studentRecord) => <option value={studentRecord.id} key={studentRecord.id}>{studentRecord.name} ({studentRecord.id})</option>)}</select></label>
            <p className="role-copy">{selectedGuardians.length ? `Recipients: ${selectedGuardians.map((account) => account.email).join(', ')}` : 'Choose a student with an active linked guardian.'}</p>
            <label className="form-label">Message<textarea value={message} maxLength={2000} onChange={(event) => setMessage(event.target.value)} placeholder="Write an update for the guardian portal…" disabled={sending} required /></label>
            <div className="feedback-footer"><span>{message.length}/2000 · Portal notification only</span><button className="primary-button" type="submit" disabled={sending || loading || !selectedGuardians.length}>{sending ? 'Saving…' : 'Save portal update'}</button></div>
          </form>
          {!!sentUpdates.length && <div className="list-stack">{sentUpdates.map((item) => <div className="notification-item" key={item.id}><span className="signal-dot green" /><div><b>{item.type} · {item.student_id}</b><p>{item.message}</p><small>{item.created_at}</small></div></div>)}</div>}
        </section>
      </div>
    </Page>
  )
}

function Feedback() {
  const [items, setItems] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiRequest('/feedback')
      .then(({ items: feedbackItems }) => {
        if (!active) return
        setItems(feedbackItems)
        setSelectedId(feedbackItems[0]?.id || '')
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const selectedItem = items.find((item) => item.id === selectedId)
  const analyzeSelected = async () => {
    if (!selectedItem) return
    setError('')
    setAnalyzing(true)
    try {
      const { item } = await apiRequest(`/feedback/${encodeURIComponent(selectedItem.id)}`, {
        method: 'POST',
        body: {},
      })
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...item } : entry))
      setAnalysis(item)
    } catch (analysisError) {
      setError(analysisError.message)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <Page eyebrow="LANGUAGE INTELLIGENCE" title="Feedback intelligence" subtitle="Turn student voice into a signal faculty can act on.">
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className="feedback-grid">
        <section className="panel">
          <div className="section-top"><div><span className="eyebrow">STUDENT VOICE</span><h2>Saved feedback</h2></div><span>{loading ? 'Loading…' : `${items.length} records`}</span></div>
          <div className="list-stack feedback-record-list">
            {items.map((item) => (
              <button className={`feedback-record ${selectedId === item.id ? 'selected' : ''}`} type="button" key={item.id} onClick={() => { setSelectedId(item.id); setAnalysis(null) }}>
                <b>{item.student_id}</b><span>{item.text}</span><small>{item.created_at}</small>
              </button>
            ))}
            {!items.length && !loading && <p className="role-copy">No feedback is available in your authorized scope.</p>}
          </div>
          {selectedItem && <><h3>Selected feedback</h3><textarea value={selectedItem.text} readOnly /></>}
          <div className="feedback-footer">
            <span>Analysis is performed and saved by the local API.</span>
            <button className="primary-button" onClick={analyzeSelected} disabled={!selectedItem || analyzing}>{analyzing ? 'Analyzing…' : 'Analyze feedback'} <Sparkles size={14} /></button>
          </div>
        </section>

        {analysis ? (
          <section className="analysis-result">
            <span className="eyebrow">SAVED ANALYSIS</span>
            <h2>{analysis.uncertain ? 'Manual review recommended.' : `${analysis.category} feedback signal`}</h2>
            <div className="result-tags"><span>{analysis.sentiment} sentiment</span><span>{analysis.category} category</span></div>
            <div className="result-details">
              <div><small>KEYWORDS</small><b>{analysis.keywords.join(' · ') || 'No strong keywords'}</b></div>
              <div><small>SUGGESTED ACTION</small><b>{analysis.action}</b></div>
            </div>
            <p className="role-copy">{analysis.explanation}</p>
          </section>
        ) : (
          <section className="empty-analysis"><Sparkles size={22} /><h2>Your analysis will appear here.</h2><p>Select a saved student feedback record to analyze and save its review.</p></section>
        )}
      </div>
    </Page>
  )
}

function KnowledgeGraph() {
  const [factors, setFactors] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiRequest('/risk')
      .then(({ items }) => {
        if (!active) return
        const counts = new Map()
        items.forEach((item) => item.factors.forEach((factor) => {
          const current = counts.get(factor.factor) || { name: factor.factor.replaceAll('_', ' '), students: 0, points: 0 }
          current.students += 1
          current.points += Number(factor.points)
          counts.set(factor.factor, current)
        }))
        setFactors([...counts.values()].sort((left, right) => right.students - left.students))
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
    return () => { active = false }
  }, [])

  return (
    <Page eyebrow="RELATIONSHIP VIEW" title="Risk factor summary" subtitle="Counts of recorded risk factors in the authorized student scope; these are not causal relationships.">
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className="content-grid">
        <section className="panel">
          <span className="eyebrow">RECORDED FACTORS</span>
          <h2>Risk factor incidence</h2>
          {factors.length ? <div className="list-stack">{factors.map((factor) => <div className="info-row" key={factor.name}><b>{factor.name}</b><span>{factor.students} student records · {factor.points} total prototype points</span></div>)}</div> : <p className="role-copy">No risk factors are recorded in the available scope.</p>}
        </section>
        <section className="panel">
          <span className="eyebrow">MODEL LIMITS</span>
          <h2>How to read this view</h2>
          <p className="role-copy">Factor counts summarize current rule-based risk records. They do not establish correlation, cause, or future outcomes. Review individual evidence before taking action.</p>
          <NavLink className="outline-button role-link" to="/explainable">Review risk explanations <ArrowUpRight size={14} /></NavLink>
        </section>
      </div>
    </Page>
  )
}

function Analytics() {
  const [analytics, setAnalytics] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([apiRequest('/overview'), apiRequest('/risk'), apiRequest('/trends')])
      .then(([overview, { items: risks }, { items: trends }]) => {
        if (active) setAnalytics({ overview, risks, trends })
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
    return () => { active = false }
  }, [])

  return (
    <Page eyebrow="CAMPUS INTELLIGENCE" title="Analytics" subtitle="Aggregates calculated from authorized student records.">
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className="analytics-kpis">
        <Metric label="Average attendance" value={analytics?.overview.attendance_percent == null ? '—' : `${analytics.overview.attendance_percent}%`} note="Across saved attendance records" tone="green" />
        <Metric label="High review scores" value={analytics?.risks.filter((item) => item.category === 'High / Support Review Required').length ?? '—'} note="Rule-based; requires human review" tone="amber" />
        <Metric label="Open interventions" value={analytics?.overview.open_interventions ?? '—'} note="Saved open or in-progress cases" tone="blue" />
      </div>

      <section className="panel">
        <span className="eyebrow">SAVED RECORD HISTORY</span>
        <h2>Attendance and academic records by date</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analytics?.trends || []}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Line connectNulls type="monotone" dataKey="attendance" stroke="#10a9c4" strokeWidth={3} />
            <Line connectNulls type="monotone" dataKey="academic" stroke="#5267db" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </section>
      <p className="demo-limit-note">Daily percentages are calculated only from records dated on that day; this view does not imply a forecast or trend direction.</p>
    </Page>
  )
}

function Reports() {
  const [reports, setReports] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    apiRequest('/reports')
      .then(({ reports: availableReports }) => {
        if (active) setReports(availableReports)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  return (
    <Page eyebrow="REPORTING" title="Reports" subtitle="Export authorized, saved campus records for faculty and support teams.">
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className="content-grid">
        <section className="panel">
          <span className="eyebrow">AVAILABLE EXPORTS</span>
          <h2>Download CSV reports</h2>
          <div className="list-stack">
            {reports.map((report) => <div className="info-row" key={report}><b>{report[0].toUpperCase() + report.slice(1)}</b><a className="text-button" href={`/api/reports/${encodeURIComponent(report)}.csv`} download={`${report}.csv`}>Download CSV</a></div>)}
            {!reports.length && <p className="role-copy">{loading ? 'Loading available reports…' : 'No reports are available.'}</p>}
          </div>
        </section>
        <section className="panel">
          <span className="eyebrow">ACCESS SCOPE</span>
          <h2>Role-scoped exports</h2>
          <div className="list-stack">
            <p className="role-copy">The API checks your role and student relationships before returning each CSV. Faculty exports are limited to assigned records.</p>
          </div>
        </section>
      </div>
    </Page>
  )
}

function NotificationsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingIds, setUpdatingIds] = useState([])

  useEffect(() => {
    let active = true
    apiRequest('/notifications')
      .then(({ items: notices }) => {
        if (active) setItems(notices)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const markRead = async (item) => {
    setError('')
    setUpdatingIds((current) => [...current, item.id])
    try {
      const { item: updated } = await apiRequest(`/notifications/${encodeURIComponent(item.id)}`, { method: 'PUT' })
      setItems((current) => current.map((notice) => notice.id === updated.id ? updated : notice))
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setUpdatingIds((current) => current.filter((id) => id !== item.id))
    }
  }

  return (
    <Page eyebrow="ALERTS" title="Notifications" subtitle="The latest updates from the campus monitoring layer.">
      {error && <div className="error-banner" role="alert">{error}</div>}
      <section className="panel">
        <div className="list-stack">
          {items.map((item) => (
            <div className={`notification-item full-width ${item.read === 'true' ? 'read' : ''}`} key={item.id}>
              <span className={`signal-dot ${item.read === 'true' ? 'green' : 'blue'}`} />
              <div>
                <b>{item.type}</b>
                <p>{item.message}</p>
                <small>{item.created_at} · {item.read === 'true' ? 'Read' : 'Unread'}</small>
              </div>
              {item.read !== 'true' && <button className="text-button" onClick={() => markRead(item)} disabled={updatingIds.includes(item.id)}>{updatingIds.includes(item.id) ? 'Saving…' : 'Mark read'}</button>}
            </div>
          ))}
          {!items.length && <p className="role-copy">{loading ? 'Loading notifications…' : 'No notifications in your authorized scope.'}</p>}
        </div>
      </section>
    </Page>
  )
}

function AuditLog() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiRequest('/audit')
      .then(({ items: entries }) => {
        if (active) setItems(entries)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  return (
    <Page eyebrow="SYSTEM" title="Activity log" subtitle="Recent operational and review events across the campus system.">
      {error && <div className="error-banner" role="alert">{error}</div>}
      <section className="panel">
        <div className="list-stack">
          {items.map((item) => <div className="info-row" key={item.id}><b>{item.timestamp} · {item.action}</b><span>{item.summary} · {item.actor_id} · {item.record_id}</span></div>)}
          {!items.length && <p className="role-copy">{loading ? 'Loading activity…' : 'No activity has been recorded.'}</p>}
        </div>
      </section>
    </Page>
  )
}

function SettingsPage() {
  const [settings, setSettings] = useState({
    attendance_attention_percent: '',
    attendance_urgent_percent: '',
    academic_attention_percent: '',
    academic_urgent_percent: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let active = true
    apiRequest('/settings')
      .then(({ items }) => {
        if (active) setSettings((current) => ({
          ...current,
          ...Object.fromEntries(items.map((item) => [item.key, item.value])),
        }))
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const updateSetting = (event) => {
    setSettings((current) => ({ ...current, [event.target.name]: event.target.value }))
    setSaved(false)
  }

  const saveSettings = async (event) => {
    event.preventDefault()
    setError('')
    setSaved(false)
    setSaving(true)
    try {
      const { items } = await apiRequest('/settings', { method: 'PUT', body: settings })
      setSettings((current) => ({
        ...current,
        ...Object.fromEntries(items.map((item) => [item.key, item.value])),
      }))
      setSaved(true)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page eyebrow="SYSTEM" title="Settings" subtitle="Server-managed demo thresholds for explainable campus risk signals.">
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className="content-grid">
        <section className="panel">
          <span className="eyebrow">SIGNAL CONFIG</span>
          <h2>Monitoring thresholds</h2>
          <form className="form-grid" onSubmit={saveSettings}>
            <label>Attendance attention (%)<input required type="number" min="0" max="100" step="0.1" name="attendance_attention_percent" value={settings.attendance_attention_percent} onChange={updateSetting} disabled={loading} /></label>
            <label>Attendance urgent (%)<input required type="number" min="0" max="100" step="0.1" name="attendance_urgent_percent" value={settings.attendance_urgent_percent} onChange={updateSetting} disabled={loading} /></label>
            <label>Academic attention (%)<input required type="number" min="0" max="100" step="0.1" name="academic_attention_percent" value={settings.academic_attention_percent} onChange={updateSetting} disabled={loading} /></label>
            <label>Academic urgent (%)<input required type="number" min="0" max="100" step="0.1" name="academic_urgent_percent" value={settings.academic_urgent_percent} onChange={updateSetting} disabled={loading} /></label>
            <button className="primary-button" type="submit" disabled={loading || saving}>{loading ? 'Loading…' : saving ? 'Saving…' : 'Save thresholds'}</button>
            {saved && <span role="status">Thresholds saved.</span>}
          </form>
        </section>
        <section className="panel">
          <span className="eyebrow">USER SETTINGS</span>
          <h2>Admin</h2>
          <div className="list-stack">
            <div className="info-row"><b>Role</b><span>Campus operations</span></div>
            <div className="info-row"><b>Region</b><span>India</span></div>
            <div className="info-row"><b>Mode</b><span>Demo</span></div>
          </div>
        </section>
      </div>
    </Page>
  )
}

function CampusPulse() {
  const [overview, setOverview] = useState(null)
  const [departments, setDepartments] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([apiRequest('/overview'), apiRequest('/departments')])
      .then(([summary, { items }]) => {
        if (!active) return
        setOverview(summary)
        setDepartments(items)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
    return () => { active = false }
  }, [])

  return (
    <Page eyebrow="CAMPUS OVERVIEW" title="Campus pulse" subtitle="A snapshot of active student, attendance, academic, and intervention records.">
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className="content-grid">
        <section className="panel">
          <span className="eyebrow">DEPARTMENT SUMMARY</span>
          <h2>{overview?.total_students ?? '—'} active student records</h2>
          <div className="metric-grid"><Metric label="Average attendance" value={overview?.attendance_percent == null ? '—' : `${overview.attendance_percent}%`} note="Saved records" tone="cyan" /><Metric label="Academic average" value={overview?.academic_average == null ? '—' : `${overview.academic_average}%`} note="Normalized saved marks" tone="blue" /><Metric label="Open cases" value={overview?.open_interventions ?? '—'} note="Open or in progress" tone="amber" /></div>
        </section>
        <section className="panel">
          <span className="eyebrow">STUDENT DISTRIBUTION</span>
          <h2>Active records by department</h2>
          <div className="list-stack">{departments.map((item) => <div className="info-row" key={item.name}><b>{item.name}</b><span>{item.student_count} students · {item.support_required} support required · {item.monitor} monitor</span></div>)}</div>
          {!departments.length && <p className="role-copy">No department data is available.</p>}
        </section>
      </div>
      <p className="demo-limit-note">Department counts are grouped from active student records. Campus-area sensors and location telemetry are not connected.</p>
    </Page>
  )
}

function ConcernRadar() {
  const [items, setItems] = useState([])
  const [cases, setCases] = useState([])
  const [studentsById, setStudentsById] = useState(new Map())
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([apiRequest('/risk'), apiRequest('/interventions'), apiRequest('/students')])
      .then(([{ items: riskItems }, { items: interventionItems }, { items: roster }]) => {
        if (!active) return
        setItems(riskItems)
        setCases(interventionItems.filter((item) => ['Open', 'In Progress'].includes(item.status)))
        setStudentsById(new Map(roster.map((studentRecord) => [studentRecord.id, studentRecord])))
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
    return () => { active = false }
  }, [])
  const priorityItems = [...items].filter((item) => item.data_sufficient).sort((left, right) => right.score - left.score)

  return (
    <Page eyebrow="RISK MONITOR" title="Concern radar" subtitle="The current set of flagged issues needing attention.">
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className="content-grid">
        <section className="panel">
          <span className="eyebrow">ISSUE LOAD</span>
          <h2>Risk distribution</h2>
          <div className="radar-visual">
            <div className="radar-list">
              {priorityItems.map((item) => <div className="radar-student" key={item.student_id}><div className="avatar small">{(studentsById.get(item.student_id)?.name || item.student_id).split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div><div><b>{studentsById.get(item.student_id)?.name || item.student_id}</b><small>{item.student_id} · {item.factors.map((factor) => factor.factor.replaceAll('_', ' ')).join(', ') || 'No threshold factor'}</small></div><span className={`status-chip ${item.category === 'High / Support Review Required' ? 'red' : item.category === 'Moderate' ? 'amber' : 'green'}`}>{item.category} · {item.score}</span></div>)}
              {!priorityItems.length && <p className="role-copy">No sufficient risk records are available.</p>}
            </div>
          </div>
        </section>
        <section className="panel">
          <span className="eyebrow">ACTION BOARD</span>
          <h2>Open items</h2>
          <div className="list-stack">{cases.map((item) => <div className="info-row" key={item.id}><b>{item.action}</b><span>{studentsById.get(item.student_id)?.name || item.student_id} · Due {item.due_date}</span></div>)}</div>
          {!cases.length && <p className="role-copy">No open or in-progress cases.</p>}
        </section>
      </div>
      <p className="demo-limit-note">Risk scores are prototype rules intended for human review, not validated predictions.</p>
    </Page>
  )
}

function Assistant({ close }) {
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const answerFromRecords = async (question) => {
    setError('')
    setReply('')
    setLoading(true)
    try {
      const [{ items: roster }, { items: cases }] = await Promise.all([
        apiRequest('/students'),
        apiRequest('/interventions'),
      ])
      if (question === 'roster') {
        setReply(`Your authorized scope contains ${roster.length} student record${roster.length === 1 ? '' : 's'}: ${roster.map((item) => `${item.name} (${item.id})`).join(', ') || 'none'}.`)
      } else if (question === 'support') {
        setReply(roster.length
          ? roster.map((item) => `${item.name} (${item.id}): ${item.status}`).join(' · ')
          : 'No student records are available in your authorized scope.')
      } else {
        const activeCases = cases.filter((item) => ['Open', 'In Progress'].includes(item.status))
        setReply(activeCases.length
          ? `${activeCases.length} active case${activeCases.length === 1 ? '' : 's'}: ${activeCases.map((item) => `${item.student_id} — ${item.action} (${item.status})`).join('; ')}.`
          : 'No open or in-progress intervention cases are recorded in your authorized scope.')
      }
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="assistant-overlay" onClick={close}>
      <aside className="assistant-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="assistant-head">
          <div>
            <span className="assistant-icon"><Sparkles size={15} /></span>
            <b>Campus records</b>
            <small>Answers use authorized saved records</small>
          </div>
          <button className="icon-button" onClick={close}><X size={17} /></button>
        </div>
        <div className="assistant-body">
          <div className="assistant-message"><p>Choose a summary. I will only report data returned by your account's API scope.</p></div>
          <div className="suggestions">
            <button onClick={() => answerFromRecords('roster')} disabled={loading}>Summarize my roster<ArrowUpRight size={13} /></button>
            <button onClick={() => answerFromRecords('support')} disabled={loading}>Show saved support statuses<ArrowUpRight size={13} /></button>
            <button onClick={() => answerFromRecords('cases')} disabled={loading}>Show active cases<ArrowUpRight size={13} /></button>
          </div>
          {loading && <p className="role-copy">Loading authorized records…</p>}
          {error && <div className="error-banner" role="alert">{error}</div>}
          {reply && <div className="assistant-message response"><p>{reply}</p></div>}
        </div>
        <div className="assistant-compose"><span className="role-copy">No generative or predictive answer is enabled.</span></div>
      </aside>
    </div>
  )
}
