import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import Emblem from '../../components/Emblem';
import parakhLogo from '../../assets/parakh_logo.jpg';
import api from '../../api/api';
import {
  ArrowLeft,
  AlertTriangle,
  FileText,
  Info,
  Edit3,
  CheckCircle,
  HelpCircle,
  XCircle,
  ZoomIn,
  X,
  QrCode,
  Calendar,
  Shield,
  Printer,
  Check,
  Building,
  Package
} from 'lucide-react';

export default function InspectionDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  // Inspector Verification & Crop Preview
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [fieldStatuses, setFieldStatuses] = useState({});
  const [inspectorRemarks, setInspectorRemarks] = useState('');
  const [previewCrop, setPreviewCrop] = useState(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const res = await api.get(`/inspections/${id}`);
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = () => {
    const initial = {};
    const statuses = {};
    (data?.declarations || []).forEach(d => {
      initial[d.field_name] = d.verified_value || d.extracted_value || '';
      statuses[d.field_name] = d.is_verified ? 'verified' : (d.status || 'detected');
    });
    setEditFields(initial);
    setFieldStatuses(statuses);
    setInspectorRemarks(data?.inspection?.remarks || '');
    setShowEditModal(true);
  };

  const handleSaveVerification = async () => {
    setVerifying(true);
    try {
      const updates = Object.keys(editFields).map(field_name => ({
        field_name,
        verified_value: editFields[field_name],
        status: fieldStatuses[field_name] === 'verified' ? 'detected' : fieldStatuses[field_name]
      }));
      await api.put(`/inspections/${id}/verify-declarations`, {
        verified_fields: updates,
        remarks: inspectorRemarks
      });
      setShowEditModal(false);
      await loadData();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to verify declarations');
    } finally {
      setVerifying(false);
    }
  };

  const handleRunAnalysis = async (demoMode = false) => {
    setAnalyzing(true);
    try {
      await api.post(`/inspections/${id}/analyze`, { demo_mode: demoMode });
      await loadData();
    } catch (e) {
      alert(e.response?.data?.error || e.response?.data?.message || 'Vision AI analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="loading-container"><div className="spinner" /></div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="empty-state"><h3>Inspection not found</h3></div>
      </Layout>
    );
  }

  const { inspection: insp, images, ocrResults, declarations, violations, decisions, compliance, qr_barcode } = data;

  const statusColor = insp.status === 'compliant' ? 'var(--success)' : insp.status === 'requires_review' ? 'var(--warning)' : 'var(--danger)';

  // Find date declarations
  const findDecl = (name) => declarations?.find(d => d.field_name === name);
  const mfgDate = insp.manufacturing_date || findDecl('manufacturing_date')?.verified_value || findDecl('manufacturing_date')?.extracted_value || '—';
  const pkdDate = insp.packing_date || findDecl('packing_date')?.verified_value || findDecl('packing_date')?.extracted_value || '—';
  const expDate = insp.expiry_date || findDecl('expiry_date')?.verified_value || findDecl('expiry_date')?.extracted_value || '—';
  const useByDate = insp.use_by_date || findDecl('use_by_date')?.verified_value || findDecl('use_by_date')?.extracted_value || '—';
  const bestBefore = insp.best_before || findDecl('best_before')?.verified_value || findDecl('best_before')?.extracted_value || '—';
  const shelfLife = insp.shelf_life || findDecl('shelf_life')?.verified_value || findDecl('shelf_life')?.extracted_value || '—';

  return (
    <Layout>
      {/* Official Government of India Header for PDF / Print Output */}
      <div className="print-only-header">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
          <img 
            src={parakhLogo} 
            alt="PARAKH Official Ministry Emblem" 
            style={{ height: '52px', width: 'auto', objectFit: 'contain', borderRadius: '4px' }} 
          />
        </div>
        <h1 style={{ margin: '4px 0', fontSize: '16pt', letterSpacing: '1px' }}>भारत सरकार | GOVERNMENT OF INDIA</h1>
        <p style={{ margin: '2px 0', fontSize: '10pt', fontWeight: 700, color: '#333' }}>
          MINISTRY OF CONSUMER AFFAIRS, FOOD & PUBLIC DISTRIBUTION • DEPARTMENT OF LEGAL METROLOGY
        </p>
        <p style={{ fontWeight: 800, marginTop: '4px', fontSize: '11pt', color: 'var(--gov-navy-900)' }}>
          PARAKH — STATUTORY PACKAGED COMMODITY COMPLIANCE INSPECTION REPORT
        </p>
        <p style={{ fontWeight: 700, marginTop: '2px', fontSize: '9.5pt', textDecoration: 'underline' }}>
          Legal Metrology (Packaged Commodities) Rules, 2011
        </p>
        <p style={{ fontSize: '9pt', color: '#555', marginTop: '4px' }}>
          Case File: <strong>{insp.inspection_number}</strong> | Date: <strong>{insp.inspection_date || insp.created_at}</strong> | Inspecting Officer: <strong>{insp.inspector_name} ({insp.employee_id})</strong>
        </p>
      </div>

      <div className="gov-page-header">
        <Link to={insp.inspector_id ? '/inspections' : '/admin/inspections'} style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.65rem', color: 'var(--gov-navy-600)', fontWeight: 600 }}>
          <ArrowLeft size={16} /> Back to Statutory Register
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div className="gov-page-title-row">
              <h2>Case File: {insp.inspection_number}</h2>
              <span className="gov-badge-gold">Official Metrology Record</span>
            </div>
            <p>Conducted on {insp.inspection_date} by {insp.inspector_name} ({insp.employee_id}) • State Enforcement Division</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-outline"
              onClick={openEditModal}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Edit3 size={15} /> Officer Verification
            </button>
            <button
              className="btn btn-primary"
              onClick={async () => {
                try {
                  await api.post(`/inspections/reports/${id}`);
                } catch(e) {}
                window.print();
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Printer size={15} /> Print / Export Official Report
            </button>
          </div>
        </div>
      </div>

      {insp.status === 'in_progress' && (
        <div className="card" style={{ marginBottom: '1.25rem', background: 'var(--navy-50)', borderColor: 'var(--navy-100)', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h4 style={{ color: 'var(--navy)', marginBottom: '0.25rem', fontSize: '1rem', fontWeight: 700 }}>
                ⚡ Automated Compliance Inspection Pending
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {images?.length > 0
                  ? `${images.length} package image(s) uploaded. Run Vision AI packaging inspection & Legal Metrology compliance evaluation now.`
                  : 'No package images attached yet. Attach packaging photographs to trigger rule evaluation.'}
              </p>
            </div>
            {images?.length > 0 && (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => handleRunAnalysis(false)}
                  disabled={analyzing}
                >
                  {analyzing ? 'Analyzing with Vision AI...' : '⚡ Run Vision AI Analysis'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary KPI Grid */}
      <div className="kpi-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="kpi-card kpi-primary">
          <div className="kpi-label">Commodity & Brand</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{insp.product_name}</div>
          <div className="kpi-sub">{insp.brand || 'Parle'} • {insp.category?.replace(/_/g, ' ')}</div>
        </div>
        <div className="kpi-card kpi-info">
          <div className="kpi-label">Business Inspected</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{insp.business_name}</div>
          <div className="kpi-sub">{insp.district}, {insp.state}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: `4px solid ${statusColor}` }}>
          <div className="kpi-label">Compliance Score (Rule Engine)</div>
          <div className="kpi-value" style={{ color: statusColor }}>
            {insp.compliance_score != null ? Math.round(insp.compliance_score) : '—'}
            <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/100</span>
          </div>
          <div className="kpi-sub" style={{ textTransform: 'uppercase', color: statusColor, fontWeight: 700 }}>
            {insp.status === 'compliant' ? '✓ COMPLIANT' : insp.status === 'requires_review' ? '⚠ REQUIRES REVIEW' : '✕ POTENTIAL NON-COMPLIANCE'}
          </div>
        </div>
        <div className="kpi-card kpi-warning">
          <div className="kpi-label">Legal Findings / Reviews</div>
          <div className="kpi-value">{violations?.length || 0}</div>
          <div className="kpi-sub">{violations?.filter(v => v.status === 'confirmed').length || 0} confirmed by officer</div>
        </div>
      </div>

      {/* 1. Prominent Expiry & Best-Before Panel */}
      <div className="card" style={{ marginBottom: '1.25rem', borderLeft: '4px solid var(--info)' }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} color="var(--info)" />
          <h3 style={{ margin: 0 }}>Packaged Food — Expiry & Best-Before Information</h3>
          <span className="badge badge-info" style={{ marginLeft: 'auto', fontSize: '0.72rem' }}>
            Rule 6(1)(d), Legal Metrology Rules, 2011
          </span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'var(--gray-50)', padding: '0.75rem 1rem', borderRadius: 'var(--border-radius)', border: '1px solid var(--gray-200)' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Manufacturing Date (MFG)</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>{mfgDate}</div>
            </div>
            <div style={{ background: 'var(--gray-50)', padding: '0.75rem 1rem', borderRadius: 'var(--border-radius)', border: '1px solid var(--gray-200)' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Packing Date (PKD)</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>{pkdDate}</div>
            </div>
            <div style={{ background: 'var(--gray-50)', padding: '0.75rem 1rem', borderRadius: 'var(--border-radius)', border: '1px solid var(--gray-200)' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Expiry Date (EXP)</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: expDate !== '—' ? 'var(--danger)' : 'var(--text)', marginTop: '4px' }}>{expDate}</div>
            </div>
            <div style={{ background: 'var(--gray-50)', padding: '0.75rem 1rem', borderRadius: 'var(--border-radius)', border: '1px solid var(--gray-200)' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Use-By Date</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>{useByDate}</div>
            </div>
            <div style={{ background: 'var(--gray-50)', padding: '0.75rem 1rem', borderRadius: 'var(--border-radius)', border: '1px solid var(--gray-200)', gridColumn: 'span 2' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Best-Before Statement</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy)', marginTop: '4px' }}>{bestBefore}</div>
              {shelfLife !== '—' && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Shelf Life Duration: {shelfLife}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. QR Code & Barcode Supplementary Evidence Card */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <QrCode size={18} color="var(--navy)" />
          <h3 style={{ margin: 0 }}>QR Code & Barcode Supplementary Verification</h3>
          <span className="badge badge-neutral" style={{ marginLeft: 'auto', fontSize: '0.72rem' }}>
            Supplementary Evidence
          </span>
        </div>
        <div className="card-body">
          {qr_barcode && qr_barcode.code_present ? (
            <div style={{ background: 'var(--gray-50)', padding: '1rem', borderRadius: 'var(--border-radius)', border: '1px solid var(--gray-300)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span className="badge badge-success" style={{ fontWeight: 700 }}>
                  ✓ {qr_barcode.code_type || 'CODE'} DECODED
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Source: {qr_barcode.source || 'Packaging Code'}
                </span>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all', background: 'var(--white)', padding: '0.65rem 0.85rem', borderRadius: '4px', border: '1px solid var(--gray-200)' }}>
                {qr_barcode.raw_content}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                {qr_barcode.supplementary_info}
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.5rem 0' }}>
              No QR code or Barcode was optical-decoded from the provided packaging images. (Status: NOT_DETECTED).
            </div>
          )}
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.65rem', borderTop: '1px dashed var(--gray-300)', paddingTop: '0.5rem' }}>
            * Note: In accordance with Legal Metrology Regulations, QR and Barcode data serve as supplementary verification and do not substitute for mandatory printed declarations on the physical commodity panel.
          </div>
        </div>
      </div>

      {/* 3. Uploaded Package Images Gallery */}
      {images && images.length > 0 && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Package Photographic Evidence</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {images.length} panel photograph(s) inspected
            </span>
          </div>
          <div className="card-body">
            <div className="gallery-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              {images.map(img => (
                <div key={img.id} style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--border-radius)', overflow: 'hidden', background: 'var(--white)' }}>
                  <img
                    src={img.image_path}
                    alt={img.image_type}
                    style={{ width: '100%', height: 180, objectFit: 'cover', cursor: 'pointer' }}
                    onClick={() => setPreviewCrop({ url: img.image_path, name: `${img.image_type} Panel (${img.original_name})` })}
                  />
                  <div style={{ padding: '0.5rem 0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize' }}>
                      {img.image_type} Panel
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                      {img.original_name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Complete Legal Metrology Compliance Checklist (8 Columns) */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>Legal Metrology Statutory Compliance Checklist</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Evaluated deterministically by PARAKH Rule Engine (Legal Metrology Packaged Commodities Rules, 2011)
            </span>
          </div>
          <button className="btn btn-sm btn-primary" onClick={openEditModal} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Edit3 size={14} /> Verify Declarations
          </button>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 150 }}>Requirement</th>
                <th style={{ minWidth: 140 }}>Extracted / Observed Value</th>
                <th style={{ minWidth: 120 }}>Required / Expected</th>
                <th style={{ minWidth: 140 }}>Compliance Status</th>
                <th style={{ minWidth: 70 }}>Confidence</th>
                <th style={{ minWidth: 160 }}>Evidence & Source</th>
                <th style={{ minWidth: 160 }}>Legal Rule Reference</th>
                <th style={{ minWidth: 180 }}>Explanation</th>
              </tr>
            </thead>
            <tbody>
              {(compliance?.checklist || []).map((item, idx) => {
                const isCompliant = item.status === 'compliant';
                const isReview = item.status === 'requires_manual_verification';
                const isViolation = item.status === 'potential_non_compliance';

                return (
                  <tr key={idx} style={{ background: isCompliant && item.is_verified ? 'rgba(46, 125, 50, 0.04)' : undefined }}>
                    <td>
                      <strong>{item.requirement || item.rule_name}</strong>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{item.rule_code}</div>
                    </td>
                    <td>
                      {item.is_verified ? (
                        <div>
                          <strong style={{ color: 'var(--success)' }}>{item.detected_value || item.extracted_value}</strong>
                          <div style={{ fontSize: '0.68rem', color: 'var(--success)' }}>✓ Officer Confirmed</div>
                        </div>
                      ) : item.detected_value ? (
                        <span>{item.detected_value}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>— Not detected</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {item.required_expected || (item.required ? 'Mandatory declaration' : 'Conditional')}
                    </td>
                    <td>
                      {isCompliant ? (
                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={12} /> ✓ COMPLIANT
                        </span>
                      ) : isReview ? (
                        <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={12} /> ⚠ REQUIRES MANUAL REVIEW
                        </span>
                      ) : isViolation ? (
                        <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <XCircle size={12} /> ✕ POTENTIAL NON-COMPLIANCE
                        </span>
                      ) : (
                        <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <HelpCircle size={12} /> — NOT DETECTED / NOT VISIBLE
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: isCompliant ? 'var(--success)' : isReview ? 'var(--warning)' : 'var(--danger)' }}>
                        {item.confidence > 0 ? `${Math.round(item.confidence)}%` : '—'}
                      </span>
                    </td>
                    <td>
                      {item.evidence && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text)' }}>"{item.evidence}"</div>
                      )}
                      {item.crop_path && (
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => setPreviewCrop({ url: item.crop_path, name: item.requirement })}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', padding: '2px 6px', marginTop: '4px' }}
                        >
                          <ZoomIn size={12} /> View Crop
                        </button>
                      )}
                      {!item.evidence && !item.crop_path && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {item.legal_reference || 'Legal Metrology (PC) Rules, 2011'}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {item.explanation || item.message || 'Standard declaration verification.'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Potential Violations & Manual Review Items */}
      {violations && violations.length > 0 && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header">
            <h3 style={{ margin: 0 }}>
              <AlertTriangle size={18} style={{ marginRight: '6px', color: 'var(--danger)' }} />
              Potential Legal Metrology Violations & Review Items
            </h3>
          </div>
          <div>
            {violations.map(v => {
              const dec = decisions?.find(d => d.violation_id === v.id);
              return (
                <div key={v.id} style={{ padding: '1rem', borderBottom: '1px solid var(--gray-200)', background: v.status === 'confirmed' ? 'var(--danger-bg)' : v.status === 'dismissed' ? 'var(--gray-50)' : 'transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`badge ${v.severity === 'critical' ? 'badge-danger' : v.severity === 'major' ? 'badge-warning' : 'badge-info'}`}>
                          {v.severity.toUpperCase()}
                        </span>
                        <strong style={{ fontSize: '0.95rem' }}>{v.rule_name || 'Compliance Finding'}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({v.rule_code})</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginTop: '0.35rem' }}>
                        <strong>Issue:</strong> {v.description}
                      </div>
                      {v.legal_reference && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          <strong>Legal Reference:</strong> {v.legal_reference}
                        </div>
                      )}
                      {dec && (
                        <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--text-secondary)', background: 'var(--white)', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--gray-300)' }}>
                          Officer Decision: <strong>{dec.decision.toUpperCase()}</strong> by {dec.officer_name} — "{dec.remarks}"
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                      <span className={`badge ${v.status === 'confirmed' ? 'badge-danger' : v.status === 'dismissed' ? 'badge-neutral' : 'badge-warning'}`}>
                        {v.status.toUpperCase()}
                      </span>
                      {!dec && (
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={async () => {
                              await api.post(`/inspections/violations/${v.id}/decision`, { decision: 'confirmed', remarks: 'Confirmed non-compliance by officer' });
                              loadData();
                            }}
                          >
                            ✓ Confirm
                          </button>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={async () => {
                              const reason = prompt('Reason for dismissal:') || 'Physical package verified compliant upon visual check';
                              await api.post(`/inspections/violations/${v.id}/decision`, { decision: 'dismissed', remarks: reason });
                              loadData();
                            }}
                          >
                            ✕ Dismiss
                          </button>
                          <button
                            className="btn btn-sm btn-warning"
                            onClick={async () => {
                              await api.post(`/inspections/violations/${v.id}/decision`, { decision: 'manual_review', remarks: 'Requires secondary physical inspection' });
                              loadData();
                            }}
                          >
                            ⚠ Review
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Officer Verification Summary */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header">
          <h3 style={{ margin: 0 }}>Inspecting Officer Verification & Audit Trail</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned Officer</div>
              <div style={{ fontWeight: 700 }}>{insp.inspector_name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ID: {insp.employee_id} • {insp.district}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Officer Remarks</div>
              <div style={{ fontStyle: insp.remarks ? 'normal' : 'italic', color: 'var(--text)' }}>
                {insp.remarks || 'No remarks recorded yet.'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last Record Update</div>
              <div style={{ fontSize: '0.85rem' }}>{insp.updated_at || insp.created_at}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Statutory Government Disclaimer */}
      <div className="disclaimer" style={{ marginBottom: '2rem' }}>
        <AlertTriangle size={16} />
        <span style={{ fontSize: '0.8rem' }}>
          <strong>Statutory Notice:</strong> PARAKH is an AI-assisted inspection support system. Automated findings are indicative and require verification by an authorized Legal Metrology officer.
        </span>
      </div>

      {/* Inspector Verification Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" style={{ maxWidth: 840, width: '92%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>Officer Declaration Verification</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  Confirm, correct, or mark declarations uncertain. Verified values override automated detections and recalculate the compliance score.
                </p>
              </div>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {Object.keys(editFields).map(key => (
                  <div key={key} style={{ background: 'var(--gray-50)', padding: '0.65rem 0.85rem', borderRadius: 'var(--border-radius)', border: '1px solid var(--gray-300)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'capitalize' }}>
                        {key.replace(/_/g, ' ')}
                      </label>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        Status: {fieldStatuses[key] || 'detected'}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={editFields[key]}
                      onChange={e => setEditFields({ ...editFields, [key]: e.target.value })}
                      placeholder={`Enter verified ${key.replace(/_/g, ' ')}`}
                      style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        style={{ fontSize: '0.68rem', padding: '2px 6px', flex: 1 }}
                        onClick={() => setFieldStatuses({ ...fieldStatuses, [key]: 'verified' })}
                      >
                        ✓ Confirm
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        style={{ fontSize: '0.68rem', padding: '2px 6px', flex: 1, color: 'var(--warning)' }}
                        onClick={() => setFieldStatuses({ ...fieldStatuses, [key]: 'uncertain' })}
                      >
                        ⚠ Uncertain
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '1rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Inspecting Officer Remarks</label>
                <textarea
                  value={inspectorRemarks}
                  onChange={e => setInspectorRemarks(e.target.value)}
                  placeholder="Record verification notes, observations, or physical measurements..."
                  rows={3}
                  style={{ width: '100%', marginTop: '0.25rem', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveVerification} disabled={verifying}>
                {verifying ? 'Recalculating...' : '✓ Save & Recalculate Compliance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visual Crop / Fullscreen Preview Modal */}
      {previewCrop && (
        <div className="modal-overlay" onClick={() => setPreviewCrop(null)}>
          <div className="modal" style={{ maxWidth: 640, width: '90%', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, textTransform: 'capitalize' }}>Evidence Crop — {previewCrop.name}</h4>
              <button onClick={() => setPreviewCrop(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem' }}>
              <img src={previewCrop.url} alt="Evidence Crop" style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: '4px', border: '1px solid var(--gray-300)', margin: '0 auto' }} />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
