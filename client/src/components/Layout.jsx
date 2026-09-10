import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Emblem from './Emblem';
import parakhLogo from '../assets/parakh_logo.jpg';
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
  Languages,
  Eye,
  FileCheck,
  Building2,
  Home
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

  const isActive = (path) => {
    if (path === '/dashboard' || path === '/admin') {
      return location.pathname === path;
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const inspectorLinks = [
    {
      section: 'Inspection Services',
      links: [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard Overview' },
        { to: '/inspection/new', icon: PlusCircle, label: 'New Inspection' },
        { to: '/inspections', icon: ClipboardList, label: 'Inspection Register' },
      ]
    },
    {
      section: 'Statutory References',
      links: [
        { to: '/admin/rules', icon: BookOpen, label: 'Legal Metrology Rules (2011)' },
      ]
    }
  ];

  const adminLinks = [
    {
      section: 'Administration',
      links: [
        { to: '/admin', icon: LayoutDashboard, label: 'State Dashboard' },
        { to: '/admin/analytics', icon: BarChart3, label: 'Compliance Analytics' },
      ]
    },
    {
      section: 'Enforcement Monitoring',
      links: [
        { to: '/admin/inspections', icon: ClipboardList, label: 'All Inspections' },
        { to: '/admin/violations', icon: AlertTriangle, label: 'Reported Violations' },
        { to: '/admin/inspectors', icon: Users, label: 'Field Inspectors' },
      ]
    },
    {
      section: 'Statutory & System Config',
      links: [
        { to: '/admin/rules', icon: BookOpen, label: 'Legal Metrology Rules' },
        { to: '/admin/users', icon: Users, label: 'User Management' },
        { to: '/admin/audit-logs', icon: ScrollText, label: 'Official Audit Trail' },
      ]
    }
  ];

  const navSections = isAdmin ? adminLinks : inspectorLinks;

  return (
    <div className="gov-page-root">
      {/* 1. Top Indian Government Accessibility & Utility Bar */}
      <div className="gov-top-utility-bar">
        <div className="gov-top-utility-left">
          <strong>भारत सरकार</strong>
          <span className="separator">|</span>
          <span className="hide-on-mobile">Government of India</span>
          <span className="separator hide-on-mobile">•</span>
          <span className="hide-on-mobile">उपभोक्ता मामले, खाद्य और सार्वजनिक वितरण मंत्रालय</span>
          <span className="separator hide-on-mobile">|</span>
          <span className="hide-on-mobile">Ministry of Consumer Affairs</span>
        </div>

        <div className="gov-top-utility-right">
          {/* Static Decorative Accessibility Controls */}
          <span className="gov-util-item hide-on-mobile" title="Screen Reader Access (Standard Gov Utility)">
            <Eye size={12} />
            <span>Screen Reader</span>
          </span>

          <div className="gov-util-font-controls" title="Text Size Adjustment (Static)">
            <button type="button" className="gov-util-font-btn" aria-label="Decrease text size">A-</button>
            <button type="button" className="gov-util-font-btn" aria-label="Default text size">A</button>
            <button type="button" className="gov-util-font-btn" aria-label="Increase text size">A+</button>
          </div>

          <span className="gov-util-lang-pill" title="Language: English / हिन्दी (Static)">
            <Languages size={12} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
            हिन्दी / En
          </span>
        </div>
      </div>

      {/* 2. Indian National Tricolor Hairline Accent */}
      <div className="gov-tricolor-accent" />

      {/* 3. Main Government Portal Header */}
      <header className="gov-main-header">
        <div className="gov-header-brand-group">
          {/* Mobile Hamburger Button */}
          <button
            type="button"
            className="gov-hamburger-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Drawer"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Official PARAKH Logo Badge */}
          <div className="gov-emblem-badge" style={{ padding: '2px', background: '#0a1d33', borderRadius: '6px', display: 'flex', alignItems: 'center', border: '1px solid rgba(255,255,255,0.12)' }}>
            <img
              src={parakhLogo}
              alt="PARAKH Official Emblem & Ministry Logo"
              style={{ height: '46px', width: 'auto', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px' }}
            />
          </div>

          <div className="gov-brand-divider" />

          {/* Title & Department Hierarchy */}
          <div className="gov-brand-details">
            <div className="gov-brand-title-row">
              <span className="gov-brand-title">PARAKH</span>
              <span className="gov-brand-hindi">परख</span>
              <span className="gov-brand-tag">PORTAL</span>
            </div>
            <div className="gov-brand-subtitle">
              AI-Assisted Packaged Commodity Compliance & Inspection System
            </div>
            <div className="gov-brand-dept">
              Legal Metrology Division • Department of Consumer Affairs
            </div>
          </div>
        </div>

        {/* Right: Officer Profile Capsule & Logout */}
        <div className="gov-header-user-section">
          <div className="gov-officer-capsule">
            <div className="gov-officer-avatar">
              {user?.name?.charAt(0) || 'O'}
            </div>
            <div className="gov-officer-info">
              <div className="gov-officer-name">{user?.name}</div>
              <div className="gov-officer-meta">
                <span className="gov-officer-badge">
                  {isAdmin ? 'CENTRAL ADMIN' : 'INSPECTOR'}
                </span>
                <span>{user?.employee_id || 'OFFICER'}</span>
                <span>• {user?.district || 'HQ'}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="gov-logout-btn"
            onClick={handleLogout}
            title="Sign Out from PARAKH Portal"
          >
            <LogOut size={15} />
            <span className="hide-on-mobile">Sign Out</span>
          </button>
        </div>
      </header>

      {/* 4. Main App Layout (Sidebar + Viewport) */}
      <div className="gov-app-layout">
        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div
            className="sidebar-backdrop"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Institutional Sidebar */}
        <aside className={`gov-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <div className="gov-sidebar-inner">
            {navSections.map(sec => (
              <div key={sec.section}>
                <div className="gov-nav-section-title">{sec.section}</div>
                {sec.links.map(link => {
                  const active = isActive(link.to);
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={`gov-nav-item ${active ? 'active' : ''}`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Icon size={17} />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legal Metrology Statutory Watermark */}
          <div className="gov-sidebar-footer">
            <strong>Legal Metrology Act, 2009</strong>
            <span>Packaged Commodities Rules, 2011</span>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '4px' }}>
              Ministry of Consumer Affairs • Govt. of India
            </div>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="gov-main-viewport">
          {children}
        </main>
      </div>

      {/* 5. Mobile Bottom Touch Action Bar for Field Officers */}
      <nav className="gov-mobile-bottom-bar" aria-label="Mobile Navigation">
        <Link
          to={isAdmin ? '/admin' : '/dashboard'}
          className={`gov-mobile-nav-link ${isActive(isAdmin ? '/admin' : '/dashboard') ? 'active' : ''}`}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </Link>
        {!isAdmin && (
          <Link
            to="/inspection/new"
            className={`gov-mobile-nav-link ${isActive('/inspection/new') ? 'active' : ''}`}
          >
            <PlusCircle size={18} />
            <span>New Case</span>
          </Link>
        )}
        <Link
          to={isAdmin ? '/admin/inspections' : '/inspections'}
          className={`gov-mobile-nav-link ${isActive(isAdmin ? '/admin/inspections' : '/inspections') ? 'active' : ''}`}
        >
          <ClipboardList size={18} />
          <span>Register</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="gov-mobile-nav-link"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <LogOut size={18} />
          <span>Exit</span>
        </button>
      </nav>
    </div>
  );
}
