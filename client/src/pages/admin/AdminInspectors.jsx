import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api/api';
import { Users, Search } from 'lucide-react';

export default function AdminInspectors() {
  const [inspectors, setInspectors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await api.get('/admin/inspectors');
      setInspectors(res.data.inspectors || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadProfile = async (id) => {
    try {
      const res = await api.get(`/admin/inspectors/${id}`);
      setProfile(res.data);
      setSelected(id);
    } catch (e) { console.error(e); }
  };

  if (loading) return <Layout><div className="loading-container"><div className="spinner" /></div></Layout>;

  return (
    <Layout>
      <div className="page-header">
        <h2>Inspector Monitoring</h2>
        <p>Track inspector activity, performance and compliance rates</p>
      </div>

      {/* Inspector Table */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header"><h3><Users size={16} style={{ marginRight: '0.5rem' }} /> All Inspectors</h3></div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr><th>Inspector</th><th>Employee ID</th><th>District</th><th>Inspections</th><th>Avg Score</th><th>Confirmed Violations</th><th>Last Login</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {inspectors.map(insp => (
                <tr key={insp.id} style={{ background: selected === insp.id ? 'var(--navy-50)' : 'transparent' }}>
                  <td><strong>{insp.name}</strong></td>
                  <td><code>{insp.employee_id}</code></td>
                  <td>{insp.district}</td>
                  <td><strong>{insp.total_inspections}</strong></td>
                  <td>{insp.avg_score ? Math.round(insp.avg_score) : '—'}</td>
                  <td>{insp.confirmed_violations || 0}</td>
                  <td style={{ fontSize: '0.78rem' }}>{insp.last_login || '—'}</td>
                  <td><span className={`badge ${insp.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{insp.status}</span></td>
                  <td><button className="btn btn-sm btn-outline" onClick={() => loadProfile(insp.id)}>Profile</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspector Profile */}
      {profile && (
        <div className="card">
          <div className="card-header">
            <h3>Inspector Profile — {profile.inspector.name}</h3>
            <button className="btn btn-sm btn-outline" onClick={() => { setSelected(null); setProfile(null); }}>Close</button>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div><strong>Employee ID:</strong> {profile.inspector.employee_id}</div>
              <div><strong>District:</strong> {profile.inspector.district}</div>
              <div><strong>Department:</strong> {profile.inspector.department}</div>
              <div><strong>Status:</strong> <span className={`badge ${profile.inspector.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{profile.inspector.status}</span></div>
              <div><strong>Registered:</strong> {profile.inspector.created_at}</div>
              <div><strong>Last Login:</strong> {profile.inspector.last_login || 'Never'}</div>
            </div>

            <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="kpi-card kpi-primary"><div className="kpi-label">Total Inspections</div><div className="kpi-value">{profile.stats.total_inspections}</div></div>
              <div className="kpi-card kpi-info"><div className="kpi-label">This Month</div><div className="kpi-value">{profile.stats.this_month}</div></div>
              <div className="kpi-card kpi-success"><div className="kpi-label">Avg Score</div><div className="kpi-value">{profile.stats.avg_score}</div></div>
              <div className="kpi-card kpi-danger"><div className="kpi-label">Confirmed Violations</div><div className="kpi-value">{profile.stats.confirmed_violations}</div></div>
              <div className="kpi-card kpi-warning"><div className="kpi-label">Dismissed</div><div className="kpi-value">{profile.stats.dismissed_findings}</div></div>
            </div>

            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>Recent Inspections</h4>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Product</th><th>Business</th><th>Date</th><th>Score</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {profile.recentInspections?.map(i => (
                    <tr key={i.id}>
                      <td>{i.product_name}</td>
                      <td>{i.business_name}</td>
                      <td>{i.inspection_date}</td>
                      <td><strong>{i.compliance_score != null ? Math.round(i.compliance_score) : '—'}</strong></td>
                      <td><span className={`badge ${i.status === 'compliant' ? 'badge-success' : i.status === 'requires_review' ? 'badge-warning' : 'badge-danger'}`}>{i.status?.replace(/_/g, ' ')}</span></td>
                      <td><Link to={`/inspection/${i.id}`} className="btn btn-sm btn-outline">View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
