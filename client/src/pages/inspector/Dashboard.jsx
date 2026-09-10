import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import api from '../../api/api';
import {
  PlusCircle,
  ClipboardList,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Activity,
  ShieldAlert,
  FileText,
  Building2,
  Calendar,
  Check,
  ChevronRight
} from 'lucide-react';

export default function InspectorDashboard() {
  const { user } = useAuth();
  const [inspections, setInspections] = useState([]);
  const [stats, setStats] = useState({ total: 0, compliant: 0, review: 0, violations: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await api.get('/inspections?limit=10');
      const all = res.data.inspections || [];
      setInspections(all);
      
      // Load all for stats
      const allRes = await api.get('/inspections?limit=500');
      const allInsp = allRes.data.inspections || [];
      setStats({
        total: allInsp.length,
        compliant: allInsp.filter(i => i.status === 'compliant').length,
        review: allInsp.filter(i => i.status === 'requires_review').length,
        violations: allInsp.filter(i => i.status === 'potential_non_compliance').length,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const complianceRate = stats.total > 0 ? Math.round((stats.compliant / stats.total) * 100) : 0;

  const getStatusBadge = (status) => {
    const map = {
      'compliant': { label: '✓ COMPLIANT', cls: 'badge-success' },
      'requires_review': { label: '⚠ REQUIRES REVIEW', cls: 'badge-warning' },
      'potential_non_compliance': { label: '✕ NON-COMPLIANCE', cls: 'badge-danger' },
      'in_progress': { label: '● IN PROGRESS', cls: 'badge-info' },
    };
    const s = map[status] || { label: status?.toUpperCase() || 'UNKNOWN', cls: 'badge-neutral' };
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  const todayStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <Layout>
      {/* 1. Official Government Welcome Banner */}
      <div className="gov-welcome-banner">
        <div>
          <div className="gov-welcome-title">
            Legal Metrology Packaged Commodities Enforcement Portal
          </div>
          <div className="gov-welcome-sub">
            AI-Assisted Field Inspection & Verification Platform • Legal Metrology Act, 2009
          </div>
        </div>
        <div className="gov-welcome-jurisdiction">
          <Calendar size={14} />
          <span>{todayStr}</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span>Jurisdiction: <strong>{user?.district || 'Central District'}, {user?.state || 'Madhya Pradesh'}</strong></span>
        </div>
      </div>

      {/* 2. Page Header & Primary Actions */}
      <div className="gov-page-header">
        <div>
          <h2>Inspector Operations Dashboard</h2>
          <p>Logged in as: <strong>{user?.name}</strong> ({user?.employee_id || 'OFFICER'}) • Department of Consumer Affairs</p>
        </div>
        <div className="quick-actions" style={{ marginBottom: 0 }}>
          <Link to="/inspection/new" className="btn btn-primary btn-lg">
            <PlusCircle size={18} /> New Package Inspection
          </Link>
          <Link to="/inspections" className="btn btn-outline">
            <ClipboardList size={16} /> Inspection Register
          </Link>
        </div>
      </div>

      {/* 3. Institutional KPI Grid */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-primary">
          <div className="kpi-label">Total Inspections</div>
          <div className="kpi-value">{stats.total}</div>
          <div className="kpi-sub">Field inspections recorded</div>
        </div>
        <div className="kpi-card kpi-success">
          <div className="kpi-label">Compliant Packages</div>
          <div className="kpi-value" style={{ color: 'var(--gov-green)' }}>{stats.compliant}</div>
          <div className="kpi-sub">Satisfied all statutory rules</div>
        </div>
        <div className="kpi-card kpi-warning">
          <div className="kpi-label">Pending Reviews</div>
          <div className="kpi-value" style={{ color: 'var(--gov-saffron)' }}>{stats.review}</div>
          <div className="kpi-sub">Awaiting officer physical sign-off</div>
        </div>
        <div className="kpi-card kpi-danger">
          <div className="kpi-label">Potential Violations</div>
          <div className="kpi-value" style={{ color: '#b71c1c' }}>{stats.violations}</div>
          <div className="kpi-sub">Infractions under PC Rules, 2011</div>
        </div>
        <div className="kpi-card kpi-info">
          <div className="kpi-label">Compliance Rate</div>
          <div className="kpi-value" style={{ color: 'var(--gov-navy-700)' }}>{complianceRate}%</div>
          <div className="kpi-sub">Statutory compliance average</div>
        </div>
      </div>

      {/* 4. Recent Field Inspections Register Table */}
      <div className="card">
        <div className="card-header">
          <h3>
            <Activity size={17} color="var(--gov-navy-700)" />
            Recent Statutory Inspections Register
          </h3>
          <Link to="/inspections" className="btn btn-sm btn-outline">
            View Complete Register <ChevronRight size={14} />
          </Link>
        </div>
        {loading ? (
          <div className="loading-container">
            <div className="spinner" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading statutory inspection records...</span>
          </div>
        ) : inspections.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={48} color="var(--gov-navy-700)" style={{ margin: '0 auto 0.75rem' }} />
            <h3>No Inspections Recorded in This Jurisdiction</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Initiate your first packaged commodity verification to populate the official register.
            </p>
            <Link to="/inspection/new" className="btn btn-primary">
              <PlusCircle size={16} /> Record First Inspection
            </Link>
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 140 }}>Inspection No.</th>
                  <th style={{ minWidth: 170 }}>Commodity / Brand</th>
                  <th style={{ minWidth: 180 }}>Business Inspected</th>
                  <th style={{ minWidth: 110 }}>Date</th>
                  <th style={{ minWidth: 90 }}>Score</th>
                  <th style={{ minWidth: 160 }}>Compliance Status</th>
                  <th style={{ minWidth: 80, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {inspections.map(insp => (
                  <tr key={insp.id}>
                    <td>
                      <code style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--gov-navy-700)' }}>
                        {insp.inspection_number}
                      </code>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-primary)' }}>{insp.product_name || '—'}</strong>
                      {insp.category && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          Category: {insp.category.replace(/_/g, ' ')}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{insp.business_name || '—'}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {insp.district || user?.district}, {insp.state || user?.state}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.84rem' }}>{insp.inspection_date}</td>
                    <td>
                      <span style={{ fontSize: '0.92rem', fontWeight: 800, color: insp.compliance_score >= 90 ? 'var(--gov-green)' : insp.compliance_score >= 60 ? 'var(--gov-saffron)' : '#b71c1c' }}>
                        {insp.compliance_score != null ? Math.round(insp.compliance_score) : '—'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/100</span>
                    </td>
                    <td>{getStatusBadge(insp.status)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <Link to={`/inspection/${insp.id}`} className="btn btn-sm btn-outline" style={{ padding: '0.3rem 0.65rem' }}>
                        View Case
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Statutory Advisory Strip */}
      <div className="disclaimer" style={{ marginTop: '1.5rem' }}>
        <AlertTriangle size={18} color="var(--gov-saffron)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong>Legal Metrology Statutory Directive:</strong> All automated OCR findings and computer-vision declaration extractions are indicative aids. Inspection officers must visually verify physical packages before initiating legal proceedings or issuing notices under Section 39 of the Legal Metrology Act, 2009.
        </div>
      </div>
    </Layout>
  );
}
