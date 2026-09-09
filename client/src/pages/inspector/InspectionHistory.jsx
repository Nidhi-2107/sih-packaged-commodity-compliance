import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api/api';
import { Search, Filter, ClipboardList } from 'lucide-react';

export default function InspectionHistory() {
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
      const res = await api.get(`/inspections?${params}`);
      setInspections(res.data.inspections || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

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
        <h2>My Inspections</h2>
        <p>View and search your inspection history</p>
      </div>

      <div className="filter-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input style={{ paddingLeft: '2rem' }} placeholder="Search by ID, product, or business..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">All Status</option>
          <option value="compliant">Compliant</option>
          <option value="requires_review">Requires Review</option>
          <option value="potential_non_compliance">Potential Non-Compliance</option>
          <option value="in_progress">In Progress</option>
        </select>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-container"><div className="spinner" /></div>
        ) : inspections.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={48} />
            <h3>No inspections found</h3>
            <p>Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>ID</th><th>Product</th><th>Business</th><th>Date</th><th>Category</th><th>Score</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {inspections.map(i => (
                  <tr key={i.id}>
                    <td><code style={{ fontSize: '0.75rem' }}>{i.inspection_number}</code></td>
                    <td>{i.product_name}</td>
                    <td>{i.business_name}</td>
                    <td>{i.inspection_date}</td>
                    <td style={{ textTransform: 'capitalize' }}>{i.category?.replace(/_/g, ' ')}</td>
                    <td><strong>{i.compliance_score != null ? Math.round(i.compliance_score) : '—'}</strong></td>
                    <td>{getStatusBadge(i.status)}</td>
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
