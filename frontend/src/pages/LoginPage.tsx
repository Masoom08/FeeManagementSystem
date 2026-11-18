import { useState } from 'react'
import { Icon } from '../components/ui/AppIcon'
import iccmrtLogo from '../assets/logo-iccmrt.png'
import collegeBackground from '../assets/college.jpeg'

export function LoginPage({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('superadmin@gmail.com')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  return <main className="login-shell" style={{ backgroundImage: `linear-gradient(90deg, rgb(8 20 36 / 44%), rgb(8 20 36 / 62%)), url(${collegeBackground})` }}>
    <section className="login-art">
      <a className="brand brand-light" href="#"><img className="brand-logo" src={iccmrtLogo} alt="ICCMRT logo" /><span>ICCMRT <small>ADMIN PORTAL</small></span></a>
      <div className="art-copy"><h1>ICCMRT - Institute of Co-operative &amp; Corporate Management, Research &amp; Training</h1><p className="login-institute-subtitle">Fee Management System</p></div>
      <div className="art-summary"><div><strong>₹4.82L</strong><span>collected this month</span></div><div className="summary-chart"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div>
      <span className="art-footer">ICCMRT · INSTITUTIONAL FINANCE</span>
    </section>
    <section className="login-panel"><div className="login-card"><div className="mobile-brand"><img className="brand-logo" src={iccmrtLogo} alt="ICCMRT logo" /> ICCMRT</div><div className="eyebrow">SUPER ADMIN ACCESS</div><h2>Welcome back</h2><p className="login-subtitle">Sign in to manage students, courses, and fees.</p>
      <form onSubmit={async e => { e.preventDefault(); if (!email.trim() || !password.trim()) { setError('Enter your email and password to continue.'); return } setLoading(true); setError(''); try { await onLogin(email.trim(), password) } catch (loginError) { setError(loginError instanceof Error ? loginError.message : 'Could not sign in. Check the API connection and credentials.') } finally { setLoading(false) } }}>
        <label htmlFor="email">Email address</label><input id="email" type="email" placeholder="name@iccmrt.edu.in" value={email} onChange={e => setEmail(e.target.value)} required />
        <div className="password-label"><label htmlFor="password">Password</label><a href="#help" onClick={e => { e.preventDefault(); setError('Please contact your institution administrator to reset your password.') }}>Forgot password?</a></div><input id="password" type="password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required />
        {error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button login-button" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'} <Icon name="chevron" size={16}/></button>
      </form><p className="login-legal">Super Admin access</p></div></section>
  </main>
}
