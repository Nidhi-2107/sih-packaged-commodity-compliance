import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api/api';
import { Search, Eye, Trash2, AlertTriangle, CheckCircle2, X } from 'lucide-react';

export default function AdminInspections() {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Delete modal state
  const [inspectionToDelete, setInspectionToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => { loadData(); }, [search, statusFilter]);

  const loadData = async () => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get(`/admin/inspections?${params}`);
      setInspections(res.data.inspections || []);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleDeleteClick = (inspection) => {
    setInspectionToDelete(inspection);
  };

  const handleCancelDelete = () => {
    if (deleting) return;
    setInspectionToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!inspectionToDelete) return;
    setDeleting(true);
    try {
      const res = await api.delete(`/inspections/${inspectionToDelete.id}`);
      if (res.data?.success) {
        setInspections(prev => prev.filter(i => i.id !== inspectionToDelete.id));
        setFeedback({ 
          type: 'success', 
          text: `Inspection ${inspectionToDelete.inspection_number} has been deleted successfully.` 
        });
        setInspectionToDelete(null);
      } else {
        setFeedback({ 
          type: 'error', 
          text: 'Unable to delete inspection. Please try again.' 
        });
      }
    } catch (err) {
      console.error('Delete inspection failed:', err);
      const errMsg = err.response?.data?.error || 'Unable to delete inspection. Please try again.';
      setFeedback({ type: 'error', text: errMsg });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <div className="gov-page-header">
        <div className="gov-page-title-row">
          <h2>Central Statutory Inspection Register</h2>
          <span className="gov-badge-gold">All Jurisdictions</span>
        </div>
        <p>Comprehensive register of packaged commodity inspections across all field circles and districts</p>
      </div>

      {/* Success / Error Feedback Banner */}
      {feedback && (
        <div 
          className="disclaimer" 
          style={{ 
            marginBottom: '1rem', 
            background: feedback.type === 'success' ? '#f0fdf4' : 'var(--status-violation-bg)', 
            borderColor: feedback.type === 'success' ? '#86efac' : 'var(--status-violation-border)', 
            color: feedback.type === 'success' ? '#166534' : 'var(--status-violation-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.85rem 1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} color="#16a34a" /> : <AlertTriangle size={18} />}
            <span>{feedback.text}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setFeedback(null)} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}
            aria-label="Close message"
          >
            <X size={16} />
          </button>
        </div>
      )}

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
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Inspector</th>
                  <th>Product</th>
                  <th>Business</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center', minWidth: '150px' }}>Actions</th>
                </tr>
              </thead>
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
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Link 
                          to={`/inspection/${i.id}`} 
                          className="btn btn-sm btn-outline"
                          title="View Case File"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0.3rem 0.55rem' }}
                        >
                          <Eye size={13} /> View
                        </Link>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteClick(i)}
                          title="Delete Inspection"
                          style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '4px', 
                            padding: '0.3rem 0.55rem',
                            background: '#fee2e2',
                            color: '#991b1b',
                            border: '1px solid #fca5a5'
                          }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Delete Inspection */}
      {inspectionToDelete && (
        <div 
          className="modal-overlay" 
          onClick={handleCancelDelete}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(12, 35, 64, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div 
            className="modal" 
            style={{ 
              maxWidth: 520, 
              width: '100%', 
              background: '#ffffff', 
              borderRadius: '8px', 
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)', 
              overflow: 'hidden' 
            }} 
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-delete-dialog-title"
          >
            <div 
              className="modal-header" 
              style={{ 
                padding: '1.2rem 1.5rem', 
                borderBottom: '1px solid var(--border-color)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                background: '#fff1f2'
              }}
            >
              <h3 
                id="admin-delete-dialog-title" 
                style={{ 
                  margin: 0, 
                  fontSize: '1.15rem', 
                  color: '#991b1b', 
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <AlertTriangle size={20} color="#b91c1c" /> Delete this inspection?
              </h3>
              <button 
                type="button" 
                onClick={handleCancelDelete} 
                disabled={deleting}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.5rem', fontSize: '0.92rem', color: '#334155', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 1rem 0' }}>
                Deleting this inspection will remove the inspection record and its associated analysis/evidence. This action cannot be undone.
              </p>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.85rem 1rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Inspection Case File</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gov-navy-900)' }}>
                  {inspectionToDelete.inspection_number}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '3px' }}>
                  Inspector: <strong>{inspectionToDelete.inspector_name}</strong> • Product: <strong>{inspectionToDelete.product_name}</strong>
                </div>
              </div>
            </div>

            <div 
              className="modal-footer" 
              style={{ 
                padding: '1rem 1.5rem', 
                borderTop: '1px solid var(--border-color)', 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: '0.75rem',
                background: '#f8fafc'
              }}
            >
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={handleCancelDelete}
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={handleConfirmDelete}
                disabled={deleting}
                style={{ 
                  background: '#dc2626', 
                  color: '#ffffff', 
                  border: 'none', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '6px' 
                }}
              >
                <Trash2 size={16} />
                {deleting ? 'Deleting...' : 'Delete Inspection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
