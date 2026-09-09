import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../api/api';
import { Users, UserPlus, Shield, UserCheck, CheckCircle, XCircle, Search } from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'inspector',
    employee_id: '',
    department: 'Legal Metrology Department',
    district: '',
    state: ''
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (user) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/users/${user.id}`, { status: newStatus });
      setUsers(users.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
    } catch (err) {
      alert('Failed to update user status: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'inspector',
      employee_id: `LM-INS-${Math.floor(1000 + Math.random() * 9000)}`,
      department: 'Legal Metrology Department',
      district: '',
      state: 'Delhi'
    });
    setErrorMsg('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);
    try {
      await api.post('/users', formData);
      setShowModal(false);
      loadUsers();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(u => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (statusFilter && u.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = u.name?.toLowerCase().includes(q);
      const matchEmail = u.email?.toLowerCase().includes(q);
      const matchEmp = u.employee_id?.toLowerCase().includes(q);
      const matchDist = u.district?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchEmp && !matchDist) return false;
    }
    return true;
  });

  const totalUsers = users.length;
  const activeInspectors = users.filter(u => u.role === 'inspector' && u.status === 'active').length;
  const totalAdmins = users.filter(u => u.role === 'admin').length;
  const uniqueDistricts = new Set(users.map(u => u.district).filter(Boolean)).size;

  return (
    <Layout>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>User & Inspector Management</h2>
          <p>Manage Legal Metrology enforcement officers, administrative credentials, and jurisdictional assignments</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <UserPlus size={16} /> Register Officer
        </button>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card kpi-primary">
          <div className="kpi-label">Total Officers</div>
          <div className="kpi-value">{totalUsers}</div>
          <div className="kpi-sub">Registered in system</div>
        </div>
        <div className="kpi-card kpi-success">
          <div className="kpi-label">Active Field Inspectors</div>
          <div className="kpi-value">{activeInspectors}</div>
          <div className="kpi-sub">Authorized for inspections</div>
        </div>
        <div className="kpi-card kpi-info">
          <div className="kpi-label">Jurisdictional Districts</div>
          <div className="kpi-value">{uniqueDistricts}</div>
          <div className="kpi-sub">Field enforcement coverage</div>
        </div>
        <div className="kpi-card kpi-warning">
          <div className="kpi-label">System Administrators</div>
          <div className="kpi-value">{totalAdmins}</div>
          <div className="kpi-sub">Compliance superintendents</div>
        </div>
      </div>

      <div className="filter-bar" style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by name, email, employee ID, or district..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>

        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          style={{ maxWidth: 180 }}
        >
          <option value="">All Roles</option>
          <option value="inspector">Inspectors</option>
          <option value="admin">Administrators</option>
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ maxWidth: 180 }}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
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
                  <th>Officer Name</th>
                  <th>Employee ID</th>
                  <th>Email Address</th>
                  <th>Role</th>
                  <th>Jurisdiction</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No users found matching the query.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{u.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.department || 'Legal Metrology'}</div>
                      </td>
                      <td>
                        <code style={{ background: 'var(--gray-200)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
                          {u.employee_id || '—'}
                        </code>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem' }}>{u.email}</span>
                      </td>
                      <td>
                        <span className={`badge ${u.role === 'admin' ? 'badge-primary' : 'badge-info'}`}>
                          {u.role === 'admin' ? <Shield size={11} /> : <UserCheck size={11} />}
                          {u.role ? u.role.toUpperCase() : 'USER'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>{u.district || 'All Districts'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.state || 'National'}</div>
                      </td>
                      <td>
                        <span className={`badge ${u.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                          {u.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className="btn btn-outline btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          {u.status === 'active' ? (
                            <>
                              <XCircle size={13} style={{ color: 'var(--danger)' }} />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <CheckCircle size={13} style={{ color: 'var(--success)' }} />
                              Activate
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Officer Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--white)',
            borderRadius: 'var(--border-radius-lg)',
            width: '100%',
            maxWidth: 540,
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden'
          }}>
            <div className="card-header" style={{ background: 'var(--navy)', color: 'var(--white)' }}>
              <h3 style={{ color: 'var(--white)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} /> Register Officer / Inspector
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', color: 'var(--white)', fontSize: '1.2rem', padding: '0 4px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '1.25rem' }}>
              {errorMsg && (
                <div style={{
                  padding: '0.75rem',
                  background: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  borderRadius: 'var(--border-radius)',
                  marginBottom: '1rem',
                  fontSize: '0.85rem'
                }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                    Full Officer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Chandra Sharma"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                    Government Employee ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LM-DEL-1045"
                    value={formData.employee_id}
                    onChange={e => setFormData({ ...formData, employee_id: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                    Official Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="officer@nic.in"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                    Temporary Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                    Role Assignment *
                  </label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="inspector">Legal Metrology Inspector</option>
                    <option value="admin">System Administrator</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                    District Jurisdiction
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. New Delhi"
                    value={formData.district}
                    onChange={e => setFormData({ ...formData, district: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                    State / UT
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Delhi"
                    value={formData.state}
                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Creating Officer...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
