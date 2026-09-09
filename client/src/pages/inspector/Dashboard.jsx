import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import api from '../../api/api';
import { PlusCircle, ClipboardList, FileText, CheckCircle, AlertTriangle, XCircle, Activity } from 'lucide-react';

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
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const complianceRate = stats.total > 0 ? Math.round((stats.compliant / stats.total) * 100) : 0;

  const getStatusBadge = (status) => {
    const map = {
      'compliant': { label: '✓ Compliant', cls: 'badge-success' },
      'requires_review': { label: '⚠ Requires Review', cls: 'badge-warning' },
      'potential_non_compliance': { label: '⚠ Potential Non-Compliance', cls: 'badge-danger' },
      'in_progress': { label: '● In Progress', cls: 'badge-info' },
    };
    const s = map[status] || { label: status, cls: 'badge-neutral' };
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  return (
    <Layout>
      <div className="page-header">
        <h2>Inspector Dashboard</h2>
        <p>Welcome back, {user?.name} — {user?.district}, {user?.state}</p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-primary">
          <div className="kpi-label">Total Inspections</div>
          <div className="kpi-value">{stats.total}</div>
        </div>
        <div className="kpi-card kpi-success">
          <div className="kpi-label">Compliant</div>
          <div className="kpi-value">{stats.compliant}</div>
        </div>
        <div className="kpi-card kpi-warning">
          <div className="kpi-label">Requires Review</div>
          <div className="kpi-value">{stats.review}</div>
        </div>
        <div className="kpi-card kpi-danger">
          <div className="kpi-label">Potential Violations</div>
          <div className="kpi-value">{stats.violations}</div>
        </div>
        <div className="kpi-card kpi-info">
          <div className="kpi-label">Compliance Rate</div>
          <div className="kpi-value">{complianceRate}%</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <Link to="/inspection/new" className="btn btn-primary btn-lg">
          <PlusCircle size={18} /> New Inspection
        </Link>
        <Link to="/inspections" className="btn btn-outline">
          <ClipboardList size={16} /> Inspection History
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header">
          <h3><Activity size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> Recent Activity</h3>
        </div>
        {loading ? (
          <div className="loading-container"><div className="spinner" /></div>
        ) : inspections.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={48} />
            <h3>No inspections yet</h3>
            <p>Start your first inspection to see activity here.</p>
            <Link to="/inspection/new" className="btn btn-primary">
              <PlusCircle size={16} /> New Inspection
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Inspection ID</th>
                  <th>Product</th>
                  <th>Business</th>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {inspections.map(insp => (
                  <tr key={insp.id}>
                    <td><code style={{ fontSize: '0.78rem' }}>{insp.inspection_number}</code></td>
                    <td>{insp.product_name || '—'}</td>
                    <td>{insp.business_name || '—'}</td>
                    <td>{insp.inspection_date}</td>
                    <td><strong>{insp.compliance_score != null ? `${Math.round(insp.compliance_score)}/100` : '—'}</strong></td>
                    <td>{getStatusBadge(insp.status)}</td>
                    <td>
                      <Link to={`/inspection/${insp.id}`} className="btn btn-sm btn-outline">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
