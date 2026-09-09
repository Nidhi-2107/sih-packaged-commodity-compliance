import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../api/api';
import { Scale, Plus, CheckCircle, XCircle, AlertCircle, Edit2, Shield } from 'lucide-react';

export default function AdminRules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    rule_code: '',
    name: '',
    description: '',
    legal_reference: '',
    category: 'packaged_food',
    field_name: '',
    required: true,
    severity: 'major'
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const res = await api.get('/rules');
      setRules(res.data.rules || []);
    } catch (err) {
      console.error('Error fetching rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (rule) => {
    try {
      await api.put(`/rules/${rule.id}`, { active: !rule.active });
      setRules(rules.map(r => r.id === rule.id ? { ...r, active: !rule.active } : r));
    } catch (err) {
      alert('Failed to update rule status: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleOpenAdd = () => {
    setEditingRule(null);
    setFormData({
      rule_code: '',
      name: '',
      description: '',
      legal_reference: 'Legal Metrology (Packaged Commodities) Rules, 2011',
      category: 'packaged_food',
      field_name: '',
      required: true,
      severity: 'major'
    });
    setErrorMsg('');
    setShowModal(true);
  };

  const handleOpenEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      rule_code: rule.rule_code,
      name: rule.name,
      description: rule.description || '',
      legal_reference: rule.legal_reference || '',
      category: rule.category || 'packaged_food',
      field_name: rule.field_name || '',
      required: Boolean(rule.required),
      severity: rule.severity || 'major'
    });
    setErrorMsg('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);
    try {
      if (editingRule) {
        await api.put(`/rules/${editingRule.id}`, formData);
      } else {
        await api.post('/rules', formData);
      }
      setShowModal(false);
      loadRules();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const filteredRules = rules.filter(r => {
    if (categoryFilter && r.category !== categoryFilter) return false;
    if (severityFilter && r.severity !== severityFilter) return false;
    return true;
  });

  const totalRules = rules.length;
  const activeRules = rules.filter(r => r.active).length;
  const requiredRules = rules.filter(r => r.required).length;

  return (
    <Layout>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Legal Metrology Compliance Rules</h2>
          <p>Configure rule definitions, legal references, mandatory declarations, and severity weights</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={16} /> Add Compliance Rule
        </button>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card kpi-primary">
          <div className="kpi-label">Configured Rules</div>
          <div className="kpi-value">{totalRules}</div>
          <div className="kpi-sub">Legal Metrology Framework</div>
        </div>
        <div className="kpi-card kpi-success">
          <div className="kpi-label">Active Rules</div>
          <div className="kpi-value">{activeRules}</div>
          <div className="kpi-sub">Currently evaluated in scans</div>
        </div>
        <div className="kpi-card kpi-warning">
          <div className="kpi-label">Mandatory Declarations</div>
          <div className="kpi-value">{requiredRules}</div>
          <div className="kpi-sub">Rule 6(1) Enforced Fields</div>
        </div>
      </div>

      <div className="filter-bar" style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          style={{ maxWidth: 220 }}
        >
          <option value="">All Categories</option>
          <option value="packaged_food">Packaged Food</option>
          <option value="general">General Commodities</option>
        </select>

        <select
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value)}
          style={{ maxWidth: 220 }}
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="major">Major</option>
          <option value="minor">Minor</option>
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
                  <th>Rule Code</th>
                  <th>Rule Name & Legal Reference</th>
                  <th>Target Field</th>
                  <th>Category</th>
                  <th>Mandatory</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No compliance rules found matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredRules.map(r => (
                    <tr key={r.id}>
                      <td>
                        <strong style={{ color: 'var(--navy)', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                          {r.rule_code}
                        </strong>
                      </td>
                      <td style={{ maxWidth: 320 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{r.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {r.legal_reference}
                        </div>
                        {r.description && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {r.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <code style={{ background: 'var(--gray-200)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
                          {r.field_name}
                        </code>
                      </td>
                      <td>
                        <span style={{ textTransform: 'capitalize', fontSize: '0.8rem' }}>
                          {r.category ? r.category.replace('_', ' ') : 'General'}
                        </span>
                      </td>
                      <td>
                        {r.required ? (
                          <span className="badge badge-danger">Mandatory</span>
                        ) : (
                          <span className="badge badge-neutral">Optional</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${
                          r.severity === 'critical' ? 'badge-danger' :
                          r.severity === 'major' ? 'badge-warning' : 'badge-info'
                        }`}>
                          {r.severity}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => handleToggleActive(r)}
                          style={{
                            background: 'transparent',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {r.active ? (
                            <span className="badge badge-success" style={{ cursor: 'pointer' }}>
                              <CheckCircle size={12} /> Active
                            </span>
                          ) : (
                            <span className="badge badge-neutral" style={{ cursor: 'pointer' }}>
                              <XCircle size={12} /> Inactive
                            </span>
                          )}
                        </button>
                      </td>
                      <td>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleOpenEdit(r)}
                          title="Edit rule parameters"
                        >
                          <Edit2 size={13} /> Edit
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

      {/* Add/Edit Modal */}
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
                <Shield size={18} />
                {editingRule ? `Edit Rule: ${editingRule.rule_code}` : 'Add Legal Metrology Rule'}
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
                    Rule Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingRule)}
                    placeholder="e.g. Rule 6(1)(a)"
                    value={formData.rule_code}
                    onChange={e => setFormData({ ...formData, rule_code: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                    Target Field Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. manufacturer_name"
                    value={formData.field_name}
                    onChange={e => setFormData({ ...formData, field_name: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                  Rule Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Manufacturer / Packer Identification"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                  Legal Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Legal Metrology (Packaged Commodities) Rules, 2011"
                  value={formData.legal_reference}
                  onChange={e => setFormData({ ...formData, legal_reference: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                  Description / Guidance
                </label>
                <textarea
                  rows={2}
                  placeholder="Legal description and compliance criteria..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="packaged_food">Packaged Food</option>
                    <option value="general">General Commodities</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                    Severity
                  </label>
                  <select
                    value={formData.severity}
                    onChange={e => setFormData({ ...formData, severity: e.target.value })}
                  >
                    <option value="critical">Critical</option>
                    <option value="major">Major</option>
                    <option value="minor">Minor</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="req_check"
                  style={{ width: 'auto' }}
                  checked={formData.required}
                  onChange={e => setFormData({ ...formData, required: e.target.checked })}
                />
                <label htmlFor="req_check" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                  Mandatory Declaration under Legal Metrology Act
                </label>
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
                  {saving ? 'Saving...' : (editingRule ? 'Update Rule' : 'Create Rule')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
