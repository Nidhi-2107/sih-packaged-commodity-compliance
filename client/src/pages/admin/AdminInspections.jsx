import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api/api';
import { Search } from 'lucide-react';

export default function AdminInspections() {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { loadData(); }, [search, statusFilter]);

  const loadData = async () => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get(`/admin/inspections?${params}`);
      setInspections(res.data.inspections || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <Layout>
      <div className="page-header">
        <h2>All Inspections</h2>
        <p>View inspections from all inspectors across the organization</p>
      </div>

      <div className="filter-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input style={{ paddingLeft: '2rem' }} placeholder="Search inspections..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">All Status</option>
          <option value="compliant">Compliant</option>
          <option value="requires_review">Requires Review</option>
          <option value="potential_non_compliance">Non-Compliance</option>
        </select>
      </div>

      <div className="card">
        {loading ? <div className="loading-container"><div className="spinner" /></div> : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>ID</th><th>Inspector</th><th>Product</th><th>Business</th><th>Category</th><th>Date</th><th>Score</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {inspections.map(i => (
                  <tr key={i.id}>
                    <td><code style={{ fontSize: '0.75rem' }}>{i.inspection_number}</code></td>
                    <td><strong>{i.inspector_name}</strong><br/><span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{i.employee_id}</span></td>
                    <td>{i.product_name}</td>
                    <td>{i.business_name}</td>
                    <td style={{ textTransform: 'capitalize' }}>{i.category?.replace(/_/g, ' ')}</td>
                    <td>{i.inspection_date}</td>
                    <td><strong>{i.compliance_score != null ? Math.round(i.compliance_score) : '—'}</strong></td>
                    <td><span className={`badge ${i.status === 'compliant' ? 'badge-success' : i.status === 'requires_review' ? 'badge-warning' : i.status === 'potential_non_compliance' ? 'badge-danger' : 'badge-info'}`}>{i.status?.replace(/_/g, ' ')}</span></td>
                    <td><Link to={`/inspection/${i.id}`} className="btn btn-sm btn-outline">View</Link></td>
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
