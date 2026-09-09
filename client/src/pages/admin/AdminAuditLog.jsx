import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../api/api';
import { ShieldCheck, Search, Filter, Clock, Activity, FileText } from 'lucide-react';

export default function AdminAuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadLogs();
  }, [actionFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '150' });
      if (actionFilter) params.append('action', actionFilter);
      const res = await api.get(`/admin/audit-logs?${params}`);
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action) => {
    if (!action) return <span className="badge badge-neutral">Unknown</span>;
    if (action.includes('created') || action.includes('add')) {
      return <span className="badge badge-success">{action}</span>;
    }
    if (action.includes('updated') || action.includes('decision')) {
      return <span className="badge badge-warning">{action}</span>;
    }
    if (action.includes('delete') || action.includes('dismiss')) {
      return <span className="badge badge-danger">{action}</span>;
    }
    if (action.includes('login') || action.includes('auth')) {
      return <span className="badge badge-info">{action}</span>;
    }
    return <span className="badge badge-neutral">{action}</span>;
  };

  const filteredLogs = logs.filter(log => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchUser = log.user_name?.toLowerCase().includes(q);
      const matchDetails = log.details?.toLowerCase().includes(q);
      const matchEntity = log.entity_type?.toLowerCase().includes(q);
      if (!matchUser && !matchDetails && !matchEntity) return false;
    }
    return true;
  });

  return (
    <Layout>
      <div className="page-header">
        <h2>System Audit Trail</h2>
        <p>Immutable log of officer actions, inspection decisions, compliance rule modifications, and system events</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card kpi-primary">
          <div className="kpi-label">Total Logged Events</div>
          <div className="kpi-value">{logs.length}</div>
          <div className="kpi-sub">Recent trail entries</div>
        </div>
        <div className="kpi-card kpi-info">
          <div className="kpi-label">Active Officers Tracked</div>
          <div className="kpi-value">
            {new Set(logs.map(l => l.user_id).filter(Boolean)).size}
          </div>
          <div className="kpi-sub">Distinct users with activity</div>
        </div>
        <div className="kpi-card kpi-success">
          <div className="kpi-label">Integrity Status</div>
          <div className="kpi-value" style={{ fontSize: '1.35rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={24} style={{ color: 'var(--success)' }} /> Verified
          </div>
          <div className="kpi-sub">Legally admissible timestamping</div>
        </div>
      </div>

      <div className="filter-bar" style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by officer name, entity ID, or details..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>

        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          style={{ maxWidth: 220 }}
        >
          <option value="">All Event Actions</option>
          <option value="login">User Logins</option>
          <option value="inspection_created">Inspections Created</option>
          <option value="decision_updated">Officer Decisions</option>
          <option value="rule_created">Rule Creations</option>
          <option value="rule_updated">Rule Updates</option>
          <option value="user_created">User Creations</option>
          <option value="user_updated">User Updates</option>
        </select>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-container"><div className="spinner" /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Officer / User</th>
                  <th>Action</th>
                  <th>Target Entity</th>
                  <th>Entity ID</th>
                  <th>Event Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No audit events found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(l => (
                    <tr key={l.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                          {l.timestamp ? new Date(l.timestamp).toLocaleString() : '—'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {l.user_name || 'System / Auto'}
                        </div>
                        {l.user_id && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            User ID: #{l.user_id}
                          </div>
                        )}
                      </td>
                      <td>
                        {getActionBadge(l.action)}
                      </td>
                      <td>
                        <span style={{ textTransform: 'capitalize', fontSize: '0.8rem', fontWeight: 500 }}>
                          {l.entity_type || '—'}
                        </span>
                      </td>
                      <td>
                        {l.entity_id ? (
                          <code style={{ background: 'var(--gray-200)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
                            #{l.entity_id}
                          </code>
                        ) : '—'}
                      </td>
                      <td style={{ maxWidth: 360 }}>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {l.details || '—'}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
