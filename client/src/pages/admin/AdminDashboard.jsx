import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import api from '../../api/api';
import { BarChart3, Users, ClipboardList, AlertTriangle, CheckCircle, Activity, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#1a237e', '#FF9933', '#138808', '#c62828', '#1565c0', '#f57f17'];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await api.get('/admin/dashboard');
      setData(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return <Layout><div className="loading-container"><div className="spinner" /></div></Layout>;
  if (!data) return <Layout><div className="empty-state"><h3>Failed to load dashboard</h3></div></Layout>;

  const { stats, recentInspections, violationsByCategory, violationsByDistrict } = data;

  const getStatusBadge = (status) => {
    const map = {
      'compliant': { label: '✓ Compliant', cls: 'badge-success' },
      'requires_review': { label: '⚠ Review', cls: 'badge-warning' },
      'potential_non_compliance': { label: '⚠ Non-Compliance', cls: 'badge-danger' },
      'in_progress': { label: '● In Progress', cls: 'badge-info' },
    };
    const s = map[status] || { label: status, cls: 'badge-neutral' };
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  return (
    <Layout>
      <div className="gov-page-header">
        <div className="gov-page-title-row">
          <h2>State Enforcement Headquarters — Executive Overview</h2>
          <span className="gov-badge-gold">Administrative Authority</span>
        </div>
        <p>National Compliance Monitoring & Statutory Intelligence • {user?.department || 'Department of Legal Metrology'}</p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-primary">
          <div className="kpi-label">Total Inspections</div>
          <div className="kpi-value">{stats.totalInspections}</div>
        </div>
        <div className="kpi-card kpi-info">
          <div className="kpi-label">Active Inspectors</div>
          <div className="kpi-value">{stats.totalInspectors}</div>
        </div>
        <div className="kpi-card kpi-info">
          <div className="kpi-label">Businesses Inspected</div>
          <div className="kpi-value">{stats.totalBusinesses}</div>
        </div>
        <div className="kpi-card kpi-success">
          <div className="kpi-label">Compliant</div>
          <div className="kpi-value">{stats.compliant}</div>
        </div>
        <div className="kpi-card kpi-warning">
          <div className="kpi-label">Pending Reviews</div>
          <div className="kpi-value">{stats.pendingReviews}</div>
        </div>
        <div className="kpi-card kpi-danger">
          <div className="kpi-label">Confirmed Violations</div>
          <div className="kpi-value">{stats.confirmedViolations}</div>
        </div>
        <div className="kpi-card kpi-primary">
          <div className="kpi-label">Compliance Rate</div>
          <div className="kpi-value">{stats.complianceRate}%</div>
        </div>
        <div className="kpi-card kpi-info">
          <div className="kpi-label">Average Score</div>
          <div className="kpi-value">{stats.avgScore}</div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* Violations by Category */}
        <div className="card">
          <div className="card-header"><h3>Violations by Category</h3></div>
          <div className="card-body" style={{ height: 280 }}>
            {violationsByCategory?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={violationsByCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1a237e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty-state"><p>No violation data</p></div>}
          </div>
        </div>

        {/* Violations by District */}
        <div className="card">
          <div className="card-header"><h3>Violations by District</h3></div>
          <div className="card-body" style={{ height: 280 }}>
            {violationsByDistrict?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={violationsByDistrict} dataKey="count" nameKey="district" cx="50%" cy="50%" outerRadius={100} label={({ district, count }) => `${district}: ${count}`}>
                    {violationsByDistrict.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="empty-state"><p>No district data</p></div>}
          </div>
        </div>
      </div>

      {/* Recent Inspections */}
      <div className="card">
        <div className="card-header">
          <h3><Activity size={16} style={{ marginRight: '0.5rem' }} /> Recent Inspections (All Inspectors)</h3>
          <Link to="/admin/inspections" className="btn btn-sm btn-outline">View All</Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr><th>ID</th><th>Inspector</th><th>Product</th><th>Business</th><th>Date</th><th>Score</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {recentInspections?.map(i => (
                <tr key={i.id}>
                  <td><code style={{ fontSize: '0.75rem' }}>{i.inspection_number}</code></td>
                  <td><strong>{i.inspector_name}</strong><br/><span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{i.employee_id}</span></td>
                  <td>{i.product_name}</td>
                  <td>{i.business_name}</td>
                  <td>{i.inspection_date}</td>
                  <td><strong>{i.compliance_score != null ? Math.round(i.compliance_score) : '—'}</strong></td>
                  <td>{getStatusBadge(i.status)}</td>
                  <td><Link to={`/inspection/${i.id}`} className="btn btn-sm btn-outline">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
