import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Emblem from '../components/Emblem';
import { Shield, LogIn, AlertTriangle, Lock, Mail, UserCheck, CheckCircle2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('inspector');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password, role);
      navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (type) => {
    if (type === 'inspector') {
      setEmail('inspector@praman.gov.in');
      setPassword('Inspector@123');
      setRole('inspector');
    } else {
      setEmail('admin@praman.gov.in');
      setPassword('Admin@123');
      setRole('admin');
    }
  };

  return (
    <div className="gov-login-wrapper">
      {/* 1. Official Government Top Strip */}
      <div className="gov-top-utility-bar">
        <div className="gov-top-utility-left">
          <strong>भारत सरकार</strong>
          <span className="separator">|</span>
          <span>Government of India</span>
          <span className="separator hide-on-mobile">•</span>
          <span className="hide-on-mobile">Ministry of Consumer Affairs, Food & Public Distribution</span>
        </div>
        <div className="gov-top-utility-right">
          <span className="gov-util-lang-pill">हिन्दी / En</span>
        </div>
      </div>

      {/* 2. Indian National Tricolor Hairline Accent */}
      <div className="gov-tricolor-accent" />

      {/* 3. Main Login Card Container */}
      <div className="gov-login-container">
        <div className="gov-login-card">
          {/* Official Emblem & Portal Header */}
          <div className="gov-login-card-header">
            <div style={{ margin: '0 auto 0.65rem', display: 'inline-block' }}>
              <Emblem size={56} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '0.04em', margin: 0, textTransform: 'uppercase' }}>
              PRAMAN <span style={{ fontFamily: 'Noto Sans Devanagari, sans-serif', color: '#ffb74d' }}>प्रमाण</span>
            </h1>
            <div style={{ fontSize: '0.82rem', color: '#e2e8f0', marginTop: '4px' }}>
              Packaged Commodity Compliance & Inspection Portal
            </div>
            <div style={{ fontSize: '0.72rem', color: '#cbd5e1', opacity: 0.85, marginTop: '2px' }}>
              Legal Metrology Division • Government of India
            </div>
          </div>

          <div className="card-body" style={{ padding: '1.75rem 1.5rem' }}>
            <div style={{ borderBottom: '1.5px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--gov-navy-800)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={16} color="var(--gov-navy-700)" /> Official Portal Sign In
              </div>
              <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>AUTHORIZED ACCESS ONLY</span>
            </div>

            {error && (
              <div className="disclaimer" style={{ background: 'var(--status-violation-bg)', borderColor: 'var(--status-violation-border)', color: 'var(--status-violation-text)', marginBottom: '1.25rem' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">
                  Official Email / Officer Employee ID <span style={{ color: 'var(--gov-red)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="e.g. inspector@praman.gov.in"
                    required
                    style={{ paddingLeft: '2.25rem' }}
                  />
                  <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Security Password <span style={{ color: 'var(--gov-red)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter account password"
                    required
                    style={{ paddingLeft: '2.25rem' }}
                  />
                  <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Designated Official Role</label>
                <select value={role} onChange={e => setRole(e.target.value)}>
                  <option value="inspector">Legal Metrology Field Inspector</option>
                  <option value="admin">Central / State Directorate Administrator</option>
                </select>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading}
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                {loading ? 'Authenticating with Secure Server...' : <><LogIn size={17} /> Secure Officer Sign In</>}
              </button>
            </form>

            {/* Quick-Fill Demonstration Panel for Reviewers */}
            <div style={{ marginTop: '1.5rem', background: 'var(--surface-body)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '1rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gov-navy-800)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <UserCheck size={14} color="var(--gov-saffron)" /> Quick Prototype Credentials
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.65rem' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => fillDemo('inspector')}
                >
                  Fill Field Inspector
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => fillDemo('admin')}
                >
                  Fill Administrator
                </button>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.6rem', lineHeight: 1.4 }}>
                • <strong>Inspector:</strong> <code>inspector@praman.gov.in</code> (Pass: <code>Inspector@123</code>)<br />
                • <strong>Admin:</strong> <code>admin@praman.gov.in</code> (Pass: <code>Admin@123</code>)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Official Government Portal Footer */}
      <footer className="gov-login-footer">
        <div>
          <strong>Government of India — Ministry of Consumer Affairs, Food & Public Distribution</strong>
        </div>
        <div style={{ marginTop: '3px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          PRAMAN: Legal Metrology Packaged Commodities (PC) Rules Enforcement System • Prototype SIH 2026
        </div>
      </footer>
    </div>
  );
}
