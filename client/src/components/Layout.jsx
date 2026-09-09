import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  BarChart3,
  Users,
  Shield,
  LogOut,
  AlertTriangle,
  BookOpen,
  ScrollText,
  Menu,
  X,
  Plus
} from 'lucide-react';

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const inspectorLinks = [
    {
      section: 'Main',
      links: [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/inspection/new', icon: PlusCircle, label: 'New Inspection' },
        { to: '/inspections', icon: ClipboardList, label: 'Inspection History' },
      ]
    }
  ];

  const adminLinks = [
    {
      section: 'Overview',
      links: [
        { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
      ]
    },
    {
      section: 'Monitoring',
      links: [
        { to: '/admin/inspectors', icon: Users, label: 'Inspector Monitoring' },
        { to: '/admin/inspections', icon: ClipboardList, label: 'All Inspections' },
        { to: '/admin/violations', icon: AlertTriangle, label: 'Violations' },
        { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
      ]
    },
    {
      section: 'Management',
      links: [
        { to: '/admin/rules', icon: BookOpen, label: 'Compliance Rules' },
        { to: '/admin/users', icon: Users, label: 'User Management' },
        { to: '/admin/audit-logs', icon: ScrollText, label: 'Audit Log' },
      ]
    }
  ];

  const navSections = isAdmin ? adminLinks : inspectorLinks;

  return (
    <>
      {/* Official Government Strip */}
      <div className="gov-bar">
        <span>Government of India — Ministry of Consumer Affairs, Food & Public Distribution</span>
        <span className="prototype-badge">Legal Metrology</span>
      </div>

      {/* Main Header */}
      <header className="header">
        <div className="header-brand">
          <button 
            type="button" 
            className="mobile-menu-btn" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <Shield size={28} className="brand-logo" />
          <div>
            <h1>PRAMAN</h1>
            <span className="subtitle">AI-Assisted Packaged Commodity Compliance & Inspection System</span>
          </div>
        </div>

        <div className="header-right">
          <div className="header-user">
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{user?.name}</div>
              <div style={{ fontSize: '0.68rem', opacity: 0.8 }}>
                {user?.employee_id || (isAdmin ? 'Central Admin' : 'Field Inspector')} • {user?.district || 'HQ'}
              </div>
            </div>
            <div className="user-avatar">{user?.name?.charAt(0) || 'U'}</div>
          </div>
          <button 
            className="btn btn-sm logout-btn" 
            onClick={handleLogout} 
            style={{ background: 'rgba(255,255,255,0.18)', color: 'white', minHeight: '38px', padding: '0.4rem 0.8rem' }}
          >
            <LogOut size={15} /> <span className="hide-on-mobile">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Body Layout */}
      <div className="layout">
        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div 
            className="sidebar-backdrop" 
            onClick={() => setMobileMenuOpen(false)} 
          />
        )}

        {/* Sidebar Navigation */}
        <nav className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <div className="mobile-sidebar-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={22} color="var(--navy)" />
              <strong style={{ fontSize: '1rem', color: 'var(--navy)' }}>PRAMAN Menu</strong>
            </div>
            <button 
              type="button" 
              className="btn btn-sm" 
              onClick={() => setMobileMenuOpen(false)}
              style={{ background: 'none', color: 'var(--gray-700)', padding: '0.25rem' }}
            >
              <X size={20} />
            </button>
          </div>

          {navSections.map(sec => (
            <div className="sidebar-section" key={sec.section}>
              <div className="sidebar-section-title">{sec.section}</div>
              {sec.links.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`sidebar-link ${isActive(link.to) ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <link.icon size={18} />
                  {link.label}
                </Link>
              ))}
            </div>
          ))}

          {/* Quick Info Box in Sidebar */}
          <div style={{ marginTop: 'auto', padding: '1rem', background: 'var(--gray-50)', borderRadius: 'var(--border-radius)', fontSize: '0.75rem', border: '1px solid var(--gray-200)' }}>
            <div style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: '0.25rem' }}>Legal Metrology Act, 2009</div>
            <div style={{ color: 'var(--text-secondary)' }}>Packaged Commodities Rules, 2011 — Official Enforcement Portal</div>
          </div>
        </nav>

        {/* Page Content */}
        <main className="main-content">
          {children}
        </main>
      </div>

      {/* Mobile Floating Bottom Bar for Field Inspectors */}
      {!isAdmin && (
        <div className="mobile-bottom-nav">
          <Link to="/dashboard" className={`mobile-nav-item ${isActive('/dashboard') ? 'active' : ''}`}>
            <LayoutDashboard size={20} />
            <span>Home</span>
          </Link>
          <Link to="/inspection/new" className={`mobile-nav-item new-btn ${isActive('/inspection/new') ? 'active' : ''}`}>
            <div className="new-btn-circle">
              <Plus size={22} />
            </div>
            <span>Inspect</span>
          </Link>
          <Link to="/inspections" className={`mobile-nav-item ${isActive('/inspections') ? 'active' : ''}`}>
            <ClipboardList size={20} />
            <span>History</span>
          </Link>
        </div>
      )}
    </>
  );
}
