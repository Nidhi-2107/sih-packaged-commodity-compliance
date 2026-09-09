import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, LogIn, AlertTriangle } from 'lucide-react';

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
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
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
    <div className="login-page">
      <div className="gov-bar">
        <span>Government of India — Ministry of Consumer Affairs, Food & Public Distribution</span>
        <span className="prototype-badge">Prototype</span>
      </div>

      <div style={{ background: 'var(--navy)', padding: '1.25rem 2rem', textAlign: 'center', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          <Shield size={28} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.25rem', letterSpacing: '0.05em' }}>PRAMAN</div>
            <div style={{ fontSize: '0.65rem', opacity: 0.75 }}>AI-Assisted Packaged Commodity Compliance & Inspection System</div>
          </div>
        </div>
      </div>

      <div className="login-container">
        <div className="login-card">
          <div className="login-card-header">
            <h2><LogIn size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> Secure Login</h2>
          </div>
          <div className="login-card-body">
            {error && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.6rem 0.75rem', borderRadius: 'var(--border-radius)', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={14} /> {error}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Employee ID / Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" required />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select value={role} onChange={e => setRole(e.target.value)}>
                  <option value="inspector">Inspector</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading} style={{ marginTop: '0.5rem' }}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="demo-credentials">
              <h4>Demo Credentials (Prototype)</h4>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button className="btn btn-sm btn-outline" onClick={() => fillDemo('inspector')} type="button">
                  Fill Inspector
                </button>
                <button className="btn btn-sm btn-outline" onClick={() => fillDemo('admin')} type="button">
                  Fill Admin
                </button>
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <div><strong>Inspector:</strong> <code>inspector@praman.gov.in</code> / <code>Inspector@123</code></div>
                <div><strong>Admin:</strong> <code>admin@praman.gov.in</code> / <code>Admin@123</code></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="footer">
        <div>Government of India — Ministry of Consumer Affairs, Food & Public Distribution</div>
        <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', opacity: 0.6 }}>PRAMAN — SIH 2026 Prototype</div>
      </footer>
    </div>
  );
}
