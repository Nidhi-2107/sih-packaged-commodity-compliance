import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../api/api';
import { AlertTriangle } from 'lucide-react';

export default function AdminViolations() {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { loadData(); }, [statusFilter]);

  const loadData = async () => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get(`/admin/violations?${params}`);
      setViolations(res.data.violations || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <Layout>
      <div className="page-header">
        <h2>Violations</h2>
        <p>All compliance violations across all inspections</p>
      </div>

      <div className="filter-bar">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="dismissed">Dismissed</option>
          <option value="manual_review">Manual Review</option>
        </select>
      </div>

      <div className="card">
        {loading ? <div className="loading-container"><div className="spinner" /></div> : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>ID</th><th>Inspection</th><th>Product</th><th>Business</th><th>Inspector</th><th>Rule</th><th>Severity</th><th>Confidence</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {violations.map(v => (
                  <tr key={v.id}>
                    <td>{v.id}</td>
                    <td><code style={{ fontSize: '0.75rem' }}>{v.inspection_number}</code></td>
                    <td>{v.product_name}</td>
                    <td>{v.business_name}</td>
                    <td>{v.inspector_name}<br/><span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{v.employee_id}</span></td>
                    <td>{v.rule_name}</td>
                    <td><span className={`badge ${v.severity === 'critical' ? 'badge-danger' : v.severity === 'major' ? 'badge-warning' : 'badge-info'}`}>{v.severity}</span></td>
                    <td>{v.confidence ? `${Math.round(v.confidence)}%` : '—'}</td>
                    <td><span className={`badge ${v.status === 'confirmed' ? 'badge-danger' : v.status === 'dismissed' ? 'badge-neutral' : 'badge-warning'}`}>{v.status}</span></td>
                    <td>{v.created_at}</td>
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
