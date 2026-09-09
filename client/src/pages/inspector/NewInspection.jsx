import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import api from '../../api/api';
import {
  Upload, Camera, Check, AlertTriangle, ChevronRight, ChevronLeft,
  FileText, Eye, X, Info, Edit3, CheckCircle, HelpCircle, XCircle,
  ZoomIn, Calendar, QrCode, ShieldCheck, Printer, ArrowLeft
} from 'lucide-react';

const STEPS = ['Inspection Details', 'Product Details', 'Upload Images', 'OCR & Analysis', 'Compliance Review', 'Officer Verification', 'Report'];
const CATEGORIES = ['rice', 'flour', 'pulses', 'biscuits', 'snacks', 'spices', 'sugar', 'other_packaged_food'];
const INSPECTION_TYPES = [
  { value: 'retail', label: 'Retail Inspection' },
  { value: 'manufacturing', label: 'Manufacturing / Packing Inspection' },
  { value: 'warehouse', label: 'Warehouse Inspection' },
  { value: 'ecommerce', label: 'E-Commerce Listing Inspection' },
];

export default function NewInspection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [inspectionId, setInspectionId] = useState(null);
  const [error, setError] = useState('');

  // Step 1 — Inspection Details
  const [form, setForm] = useState({
    inspection_date: new Date().toISOString().split('T')[0],
    business_name: '', business_address: '', district: '', state: 'Madhya Pradesh',
    inspection_type: 'retail', remarks: '', latitude: '', longitude: ''
  });

  // Step 2 — Product Details
  const [product, setProduct] = useState({
    product_name: '', brand: '', category: 'rice', manufacturer: '', batch_number: '', sku: ''
  });

  // Step 3 — Images
  const [images, setImages] = useState({ front: null, back: null, side: null });
  const [previews, setPreviews] = useState({ front: null, back: null, side: null });
  const fileRefs = { front: useRef(), back: useRef(), side: useRef() };
  const cameraRefs = { front: useRef(), back: useRef(), side: useRef() };

  // Step 4 — Analysis results
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisResult, setAnalysisResult] = useState(null);

  // Step 5 — Compliance
  const [selectedViolation, setSelectedViolation] = useState(null);

  // Step 6 — Officer Decisions
  const [decisions, setDecisions] = useState({});
  const [dismissReason, setDismissReason] = useState('');
  const [showDismissModal, setShowDismissModal] = useState(null);

  // Inspector Verification & Crop Preview
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [previewCrop, setPreviewCrop] = useState(null);
  const [verifying, setVerifying] = useState(false);

  // Step 7 — Report
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const openEditModal = () => {
    const initial = {};
    (analysisResult?.declarations || []).forEach(d => {
      initial[d.field_name] = d.verified_value || d.extracted_value || '';
    });
    if (analysisResult?.dates) {
      Object.entries(analysisResult.dates).forEach(([k, v]) => {
        if (v && !initial[k]) initial[k] = v;
      });
    }
    setEditFields(initial);
    setShowEditModal(true);
  };

  const handleSaveVerification = async () => {
    setVerifying(true);
    setError('');
    try {
      const res = await api.put(`/inspections/${inspectionId}/verify-declarations`, {
        verified_fields: editFields
      });
      setAnalysisResult(prev => ({
        ...prev,
        declarations: res.data.declarations,
        compliance: res.data.compliance,
        dates: res.data.dates
      }));
      setShowEditModal(false);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to verify declarations');
    } finally {
      setVerifying(false);
    }
  };

  const handleImageSelect = (type, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Invalid file type. Allowed: JPG, PNG, WEBP');
      return;
    }
    setImages(prev => ({ ...prev, [type]: file }));
    setPreviews(prev => ({ ...prev, [type]: URL.createObjectURL(file) }));
    setError('');
  };

  const removeImage = (type) => {
    setImages(prev => ({ ...prev, [type]: null }));
    setPreviews(prev => ({ ...prev, [type]: null }));
  };

  const createInspection = async () => {
    try {
      const res = await api.post('/inspections', { ...form, ...product });
      setInspectionId(res.data.id);
      return res.data.id;
    } catch (e) {
      throw new Error(e.response?.data?.error || 'Failed to create inspection');
    }
  };

  const uploadImages = async (id) => {
    const formData = new FormData();
    Object.entries(images).forEach(([type, file]) => {
      if (file) formData.append('images', file);
    });
    formData.append('image_type', 'front');
    await api.post(`/inspections/${id}/images`, formData);
  };

  const runAnalysis = async (id, demoMode = false) => {
    setAnalyzing(true);
    setError('');
    setAnalysisStep(2); // Running OCR

    try {
      const res = await api.post(`/inspections/${id}/analyze`, { demo_mode: demoMode });
      setAnalysisStep(5); // Checking compliance rules
      setAnalysisResult(res.data);
      setStep(4); // Advance to Compliance Review
    } catch (e) {
      setError(e.response?.data?.error || 'Analysis failed. Please check image or try demo mode.');
      setStep(2);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleNext = async () => {
    setError('');
    if (step === 0) {
      if (!form.business_name || !form.inspection_date) {
        setError('Business name and inspection date are required'); return;
      }
      setStep(1);
    } else if (step === 1) {
      if (!product.product_name) {
        setError('Product name is required'); return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!images.front && !images.back) {
        setError('Please upload at least one image'); return;
      }
      setStep(3);
    }
  };

  const handleStartAnalysis = async (demoMode = false) => {
    try {
      setError('');
      setAnalyzing(true);
      setStep(3); // Immediately show Analysis progress screen
      setAnalysisStep(0); // Uploading images

      let id = inspectionId;
      if (!id) {
        id = await createInspection();
      }

      setAnalysisStep(1); // Preprocessing
      await uploadImages(id);
      await runAnalysis(id, demoMode);
    } catch (e) {
      setError(e.message || 'Analysis failed');
      setAnalyzing(false);
      setStep(2);
    }
  };

  const handleDecision = async (violationId, decision) => {
    if (decision === 'dismissed' && !dismissReason) {
      setShowDismissModal(violationId);
      return;
    }
    try {
      await api.post(`/inspections/violations/${violationId}/decision`, {
        decision,
        remarks: decision === 'dismissed' ? dismissReason : 'Finding confirmed by inspector'
      });
      setDecisions(prev => ({ ...prev, [violationId]: decision }));
      setDismissReason('');
      setShowDismissModal(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to record decision');
    }
  };

  const handleFinalize = async () => {
    setSaving(true);
    try {
      // Determine final status
      const hasConfirmed = Object.values(decisions).includes('confirmed');
      const hasPending = analysisResult?.compliance?.violations?.some(v => !decisions[v.id]);
      let finalStatus = 'compliant';
      if (hasConfirmed) finalStatus = 'potential_non_compliance';
      else if (hasPending) finalStatus = 'requires_review';

      await api.put(`/inspections/${inspectionId}`, {
        status: finalStatus,
        compliance_score: analysisResult?.compliance?.score
      });

      await api.post(`/inspections/reports/${inspectionId}`);
      setSaved(true);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save');
    }
    setSaving(false);
  };

  const findDec = (fName) => (analysisResult?.declarations || []).find(d => d.field_name === fName);
  const mfgDate = analysisResult?.dates?.manufacturing_date || findDec('manufacturing_date')?.verified_value || findDec('manufacturing_date')?.extracted_value || findDec('date_of_manufacture')?.verified_value || findDec('date_of_manufacture')?.extracted_value || '—';
  const pkdDate = analysisResult?.dates?.packing_date || findDec('packing_date')?.verified_value || findDec('packing_date')?.extracted_value || '—';
  const expDate = analysisResult?.dates?.expiry_date || findDec('expiry_date')?.verified_value || findDec('expiry_date')?.extracted_value || '—';
  const useByDate = analysisResult?.dates?.use_by_date || findDec('use_by_date')?.verified_value || findDec('use_by_date')?.extracted_value || '—';
  const bestBefore = analysisResult?.dates?.best_before || findDec('best_before')?.verified_value || findDec('best_before')?.extracted_value || '—';
  const shelfLife = analysisResult?.dates?.shelf_life || findDec('shelf_life')?.verified_value || findDec('shelf_life')?.extracted_value || '—';
  const qr_barcode = analysisResult?.qr_barcode;

  const renderSteps = () => (
    <div className="steps">
      {STEPS.map((s, i) => (
        <React.Fragment key={i}>
          <div className={`step ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`}>
            <div className="step-number">{i < step ? '✓' : i + 1}</div>
            <span className="step-label">{s}</span>
          </div>
          {i < STEPS.length - 1 && <div className="step-divider" />}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <Layout>
      <div className="page-header">
        <h2>New Inspection</h2>
        <p>Create a new packaged commodity compliance inspection</p>
      </div>

      {renderSteps()}
      {error && <div className="disclaimer" style={{ marginBottom: '1rem', background: 'var(--danger-bg)', borderColor: '#ef9a9a' }}><AlertTriangle size={16} /><div>{error}</div></div>}

      {/* Step 1: Inspection Details */}
      {step === 0 && (
        <div className="card">
          <div className="card-header"><h3>Inspection Details</h3></div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Inspection Date *</label>
                <input type="date" value={form.inspection_date} onChange={e => setForm({...form, inspection_date: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Inspection Type</label>
                <select value={form.inspection_type} onChange={e => setForm({...form, inspection_type: e.target.value})}>
                  {INSPECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Business Name *</label>
              <input value={form.business_name} onChange={e => setForm({...form, business_name: e.target.value})} placeholder="Enter business name" required />
            </div>
            <div className="form-group">
              <label className="form-label">Business Address</label>
              <input value={form.business_address} onChange={e => setForm({...form, business_address: e.target.value})} placeholder="Enter business address" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">District</label>
                <input value={form.district} onChange={e => setForm({...form, district: e.target.value})} placeholder="e.g. Indore" />
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <input value={form.state} onChange={e => setForm({...form, state: e.target.value})} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Latitude (optional)</label>
                <input type="number" step="any" value={form.latitude} onChange={e => setForm({...form, latitude: e.target.value})} placeholder="e.g. 22.7196" />
              </div>
              <div className="form-group">
                <label className="form-label">Longitude (optional)</label>
                <input type="number" step="any" value={form.longitude} onChange={e => setForm({...form, longitude: e.target.value})} placeholder="e.g. 75.8577" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Inspection Remarks (optional)</label>
              <textarea rows={2} value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} placeholder="Additional notes" />
            </div>
            <div className="form-group" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <strong>Inspector:</strong> {user?.name} ({user?.employee_id})
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={handleNext}>Continue <ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Product Details */}
      {step === 1 && (
        <div className="card">
          <div className="card-header"><h3>Product Details</h3></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Product Name *</label>
              <input value={product.product_name} onChange={e => setProduct({...product, product_name: e.target.value})} placeholder="e.g. Sample Premium Rice" required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Brand</label>
                <input value={product.brand} onChange={e => setProduct({...product, brand: e.target.value})} placeholder="e.g. ABC Premium" />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select value={product.category} onChange={e => setProduct({...product, category: e.target.value})}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Manufacturer</label>
              <input value={product.manufacturer} onChange={e => setProduct({...product, manufacturer: e.target.value})} placeholder="e.g. ABC Foods Pvt Ltd" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Batch / Lot Number</label>
                <input value={product.batch_number} onChange={e => setProduct({...product, batch_number: e.target.value})} placeholder="If visible" />
              </div>
              <div className="form-group">
                <label className="form-label">SKU (optional)</label>
                <input value={product.sku} onChange={e => setProduct({...product, sku: e.target.value})} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setStep(0)}><ChevronLeft size={16} /> Back</button>
              <button className="btn btn-primary" onClick={handleNext}>Continue to Image Upload <ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Upload Images */}
      {step === 2 && (
        <div className="card">
          <div className="card-header"><h3><Camera size={16} style={{ marginRight: '0.5rem' }} /> Upload Product Images</h3></div>
          <div className="card-body">
            {['front', 'back', 'side'].map(type => (
              <div key={type} style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ textTransform: 'capitalize' }}>
                  {type === 'front' ? 'Front of Package (Required)' : type === 'back' ? 'Back of Package (Required if available)' : 'Side / Additional Image (Optional)'}
                </label>
                {previews[type] ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={previews[type]} alt={type} className="upload-preview" />
                    <button onClick={() => removeImage(type)} className="btn btn-sm btn-danger" style={{ position: 'absolute', top: 4, right: 4 }}><X size={12} /></button>
                  </div>
                ) : (
                  <div className="upload-zone">
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => cameraRefs[type].current?.click()}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                      >
                        <Camera size={16} /> Take Photo (Camera)
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => fileRefs[type].current?.click()}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                      >
                        <Upload size={16} /> Choose from Files
                      </button>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Click button above or drag image here</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>JPG, PNG, WEBP • Max 10MB</div>
                  </div>
                )}
                <input ref={fileRefs[type]} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => handleImageSelect(type, e)} hidden />
                <input ref={cameraRefs[type]} type="file" accept="image/*" capture="environment" onChange={e => handleImageSelect(type, e)} hidden />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button className="btn btn-outline" onClick={() => setStep(1)}><ChevronLeft size={16} /> Back</button>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-primary btn-lg" onClick={() => handleStartAnalysis(false)} disabled={analyzing}>
                  <Camera size={16} /> Analyze Product (AI Vision)
                </button>
                <button className="btn btn-outline" onClick={() => handleStartAnalysis(true)} disabled={analyzing} title="Uses simulated demo data for controlled demonstration">
                  <Info size={14} /> Demo Analysis
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3.5: Analysis Loading */}
      {step === 3 && analyzing && (
        <div className="card">
          <div className="card-body">
            <div className="loading-container">
              <div className="spinner" />
              <h3 style={{ fontSize: '1.1rem', color: 'var(--navy)' }}>Analyzing Product with Vision AI</h3>
              <ul className="loading-steps">
                {['Uploading packaging images...', 'Preprocessing image resolution & orientation...', 'Running Multimodal Vision AI model...', 'Extracting visible structured declarations...', 'Validating Legal Metrology compliance rules...', 'Generating inspection report...'].map((s, i) => (
                  <li key={i} className={i < analysisStep ? 'done' : i === analysisStep ? 'active' : ''}>
                    {i < analysisStep ? <Check size={14} /> : i === analysisStep ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <span style={{ width: 14, display: 'inline-block' }} />}
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Compliance Review */}
      {step === 4 && analysisResult && (
        <div>
          {/* Demo Notice */}
          {analysisResult.ocr?.demo_notice && (
            <div className="disclaimer" style={{ marginBottom: '1rem', background: '#fff3e0', borderColor: '#ffcc80' }}>
              <Info size={16} />
              <div><strong>Demo Analysis:</strong> {analysisResult.ocr.demo_notice}</div>
            </div>
          )}

          {/* OCR Confidence Warning */}
          {analysisResult.ocr?.results?.some(r => r.low_confidence) && (
            <div className="disclaimer" style={{ marginBottom: '1rem' }}>
              <AlertTriangle size={16} />
              <div><strong>Low OCR confidence — manual verification recommended.</strong> The OCR engine had difficulty reading the image. Extracted text may be incomplete or inaccurate.</div>
            </div>
          )}

          {/* Compliance Score */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <div className="score-display">
                <div className="score-value" style={{ color: analysisResult.compliance.score >= 90 ? 'var(--success)' : analysisResult.compliance.score >= 60 ? 'var(--warning)' : 'var(--danger)' }}>
                  {analysisResult.compliance.score}<span className="score-max"> / 100</span>
                </div>
                <div className="score-status" style={{ color: analysisResult.compliance.status === 'compliant' ? 'var(--success)' : analysisResult.compliance.status === 'requires_review' ? 'var(--warning)' : 'var(--danger)' }}>
                  {analysisResult.compliance.status.replace(/_/g, ' ')}
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>{analysisResult.compliance.summary}</p>
                <div className="disclaimer" style={{ display: 'inline-flex', marginTop: '1rem' }}>
                  <AlertTriangle size={14} />
                  <span>{analysisResult.compliance.disclaimer}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Prominent Expiry & Best-Before Panel */}
          <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--info)' }}>
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

          {/* QR Code & Barcode Supplementary Evidence Card */}
          <div className="card" style={{ marginBottom: '1rem' }}>
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

          {/* Legal Metrology Statutory Compliance Checklist (8 Columns) */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0 }}>Legal Metrology Statutory Compliance Checklist</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Evaluated deterministically by PRAMAN Rule Engine (Legal Metrology Packaged Commodities Rules, 2011)
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
                  {(analysisResult.compliance.checklist || []).map((item, idx) => {
                    const isCompliant = item.status === 'compliant' || item.status === 'pass';
                    const isReview = item.status === 'requires_manual_verification' || item.status === 'warning';
                    const isViolation = item.status === 'potential_non_compliance' || item.status === 'fail';

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
                          ) : item.detected_value || item.extracted_value ? (
                            <span>{item.detected_value || item.extracted_value}</span>
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
                              <HelpCircle size={12} /> — NOT DETECTED
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
                              onClick={() => setPreviewCrop({ url: item.crop_path, name: item.requirement || item.rule_name })}
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
                          {item.explanation || item.message || 'Standard declaration evaluation.'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button className="btn btn-primary btn-lg" onClick={() => setStep(5)}>Proceed to Officer Verification <ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {/* Step 5: Officer Verification */}
      {step === 5 && analysisResult && (
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-header"><h3>Officer Verification</h3></div>
            <div className="card-body">
              <div className="disclaimer" style={{ marginBottom: '1rem' }}>
                <Info size={16} />
                <div>Review each AI-assisted finding below. As the inspecting officer, confirm, dismiss, or send for manual review. Your decision will be permanently recorded.</div>
              </div>

              {analysisResult.compliance.violations.length === 0 ? (
                <div className="empty-state">
                  <Check size={48} style={{ color: 'var(--success)' }} />
                  <h3>No Violations Detected</h3>
                  <p>All mandatory declarations were detected. No officer action required.</p>
                </div>
              ) : (
                analysisResult.compliance.violations.map((v, i) => {
                  // Find the violation ID from DB
                  const dbViolation = analysisResult._violations_db?.[i];
                  const violationId = dbViolation?.id || i;
                  const decided = decisions[violationId];

                  return (
                    <div key={i} style={{ padding: '1rem', borderBottom: '1px solid var(--gray-200)', background: decided ? (decided === 'confirmed' ? 'var(--danger-bg)' : 'var(--gray-50)') : 'var(--warning-bg)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                        {v.description}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                        Severity: <span className={`badge ${v.severity === 'critical' ? 'badge-danger' : v.severity === 'major' ? 'badge-warning' : 'badge-info'}`}>{v.severity}</span>
                        {v.confidence > 0 && <span style={{ marginLeft: '0.75rem' }}>Confidence: {Math.round(v.confidence)}%</span>}
                      </div>
                      {decided ? (
                        <span className={`badge ${decided === 'confirmed' ? 'badge-danger' : 'badge-neutral'}`}>
                          {decided === 'confirmed' ? '✓ Confirmed by Officer' : '✗ Dismissed by Officer'}
                        </span>
                      ) : (
                        <div className="violation-actions">
                          <button className="btn btn-sm btn-danger" onClick={() => handleDecision(violationId, 'confirmed')}>
                            <Check size={14} /> Confirm Finding
                          </button>
                          <button className="btn btn-sm btn-outline" onClick={() => { setShowDismissModal(violationId); }}>
                            <X size={14} /> Dismiss Finding
                          </button>
                          <button className="btn btn-sm btn-warning" onClick={() => handleDecision(violationId, 'manual_review')}>
                            Send for Manual Review
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
            <button className="btn btn-outline" onClick={() => setStep(4)}><ChevronLeft size={16} /> Back</button>
            <button className="btn btn-primary btn-lg" onClick={() => setStep(6)}>Generate Report <ChevronRight size={16} /></button>
          </div>

          {/* Dismiss Modal */}
          {showDismissModal !== null && (
            <div className="modal-overlay" onClick={() => setShowDismissModal(null)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header"><h3>Dismiss Finding</h3></div>
                <div className="modal-body">
                  <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>Please provide a reason for dismissing this finding:</p>
                  <textarea rows={3} value={dismissReason} onChange={e => setDismissReason(e.target.value)} placeholder="e.g. Text visible but OCR failed to read it." />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={() => { setShowDismissModal(null); setDismissReason(''); }}>Cancel</button>
                  <button className="btn btn-primary" disabled={!dismissReason.trim()} onClick={() => handleDecision(showDismissModal, 'dismissed')}>Submit</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 6: Report */}
      {step === 6 && (
        <div>
          {saved ? (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                <Check size={56} style={{ color: 'var(--success)', margin: '0 auto 1rem' }} />
                <h3 style={{ color: 'var(--success)', marginBottom: '0.5rem' }}>Statutory Inspection Saved Successfully</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  The inspection record and generated compliance report have been permanently stored in the Legal Metrology database.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={() => navigate(`/inspection/${inspectionId}`)}>
                    View Full Inspection Record
                  </button>
                  <button className="btn btn-outline" onClick={() => navigate('/dashboard')}>
                    Return to Dashboard
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-body" style={{ padding: '2rem' }}>
                {/* Official Government Header */}
                <div style={{ textAlign: 'center', borderBottom: '2px solid var(--navy)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy)', letterSpacing: '0.5px' }}>
                    GOVERNMENT OF INDIA / STATE LEGAL METROLOGY DEPARTMENT
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-600)', marginTop: '2px' }}>
                    PACKAGED COMMODITY STATUTORY INSPECTION & COMPLIANCE REPORT
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Issued under the Legal Metrology Act, 2009 & Legal Metrology (Packaged Commodities) Rules, 2011
                  </div>
                </div>

                {/* Metadata Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', background: 'var(--gray-50)', padding: '1rem', borderRadius: 'var(--border-radius)', marginBottom: '1.25rem', border: '1px solid var(--gray-200)' }}>
                  <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Business Name:</span><div style={{ fontWeight: 700 }}>{form.business_name}</div></div>
                  <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Product / Brand:</span><div style={{ fontWeight: 700 }}>{product.product_name} {product.brand ? `(${product.brand})` : ''}</div></div>
                  <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Category:</span><div style={{ textTransform: 'capitalize', fontWeight: 600 }}>{product.category.replace(/_/g, ' ')}</div></div>
                  <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Inspection Date:</span><div style={{ fontWeight: 600 }}>{form.inspection_date}</div></div>
                  <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Inspecting Officer:</span><div style={{ fontWeight: 600 }}>{user?.name} ({user?.employee_id || 'OFFICER'})</div></div>
                  <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>District / State:</span><div style={{ fontWeight: 600 }}>{form.district || user?.district || 'Madhya Pradesh'}</div></div>
                </div>

                {/* Overall Score Banner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: analysisResult?.compliance?.score >= 90 ? '#e8f5e9' : analysisResult?.compliance?.score >= 60 ? '#fff8e1' : '#ffebee', border: `1px solid ${analysisResult?.compliance?.score >= 90 ? '#a5d6a7' : analysisResult?.compliance?.score >= 60 ? '#ffe082' : '#ef9a9a'}`, padding: '1rem 1.25rem', borderRadius: 'var(--border-radius)', marginBottom: '1.25rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                      Overall Compliance Score (Deterministic Rule Engine)
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: analysisResult?.compliance?.score >= 90 ? 'var(--success)' : analysisResult?.compliance?.score >= 60 ? 'var(--warning)' : 'var(--danger)' }}>
                      {analysisResult?.compliance?.score != null ? Math.round(analysisResult.compliance.score) : '—'} / 100
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${analysisResult?.compliance?.status === 'compliant' ? 'badge-success' : analysisResult?.compliance?.status === 'requires_review' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.9rem', padding: '6px 12px' }}>
                      {analysisResult?.compliance?.status === 'compliant' ? '✓ COMPLIANT' : analysisResult?.compliance?.status === 'requires_review' ? '⚠ REQUIRES REVIEW' : '✕ POTENTIAL NON-COMPLIANCE'}
                    </span>
                  </div>
                </div>

                {/* Expiry & Dates Summary */}
                <div style={{ marginBottom: '1.25rem', border: '1px solid var(--gray-200)', borderRadius: 'var(--border-radius)', padding: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={16} /> Rule 6(1)(d) Date Declarations
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', fontSize: '0.8rem' }}>
                    <div><strong>MFG:</strong> {mfgDate}</div>
                    <div><strong>PKD:</strong> {pkdDate}</div>
                    <div><strong>EXP:</strong> {expDate}</div>
                    <div><strong>Use-By:</strong> {useByDate}</div>
                    <div><strong>Best Before:</strong> {bestBefore}</div>
                    <div><strong>Shelf Life:</strong> {shelfLife}</div>
                  </div>
                </div>

                {/* QR / Barcode Summary */}
                {qr_barcode && qr_barcode.code_present && (
                  <div style={{ marginBottom: '1.25rem', border: '1px solid var(--gray-200)', borderRadius: 'var(--border-radius)', padding: '1rem', background: 'var(--gray-50)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <QrCode size={16} /> Supplementary QR / Barcode Evidence
                    </div>
                    <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {qr_barcode.raw_content}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {qr_barcode.supplementary_info}
                    </div>
                  </div>
                )}

                {/* 8-Column Checklist Summary */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.5rem' }}>
                    Statutory Declaration Verification Summary
                  </div>
                  <div className="table-responsive">
                    <table style={{ fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Requirement</th>
                          <th>Observed Value</th>
                          <th>Status</th>
                          <th>Confidence</th>
                          <th>Legal Reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(analysisResult?.compliance?.checklist || []).map((item, idx) => (
                          <tr key={idx}>
                            <td><strong>{item.requirement || item.rule_name}</strong></td>
                            <td>{item.detected_value || item.extracted_value || '— Not detected'}</td>
                            <td>
                              <span className={`badge ${item.status === 'compliant' || item.status === 'pass' ? 'badge-success' : item.status === 'requires_manual_verification' || item.status === 'warning' ? 'badge-warning' : 'badge-danger'}`}>
                                {item.status?.toUpperCase() || 'UNCHECKED'}
                              </span>
                            </td>
                            <td>{item.confidence > 0 ? `${Math.round(item.confidence)}%` : '—'}</td>
                            <td style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{item.legal_reference || 'Legal Metrology (PC) Rules, 2011'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Statutory Disclaimer & Officer Signoff */}
                <div className="disclaimer" style={{ marginBottom: '1.5rem' }}>
                  <AlertTriangle size={16} />
                  <div style={{ fontSize: '0.75rem', lineHeight: 1.5 }}>
                    <strong>Statutory Disclaimer:</strong> This inspection document was generated via PRAMAN (Packaged Commodity Compliance & Inspection System). Computer-vision findings are indicative and serve as inspection assistance. All final enforcement determinations, notices, or penalty proceedings remain the sole authority and responsibility of the duly authorized Legal Metrology Officer.
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--gray-300)', paddingTop: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <button className="btn btn-outline" onClick={() => setStep(5)}>
                    <ChevronLeft size={16} /> Back to Verification
                  </button>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-outline"
                      onClick={async () => {
                        if (inspectionId) {
                          try {
                            await api.post(`/inspections/reports/${inspectionId}`);
                          } catch(e) {}
                        }
                        window.print();
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Printer size={16} /> Print Official Report (PDF)
                    </button>
                    <button className="btn btn-success btn-lg" onClick={handleFinalize} disabled={saving}>
                      {saving ? 'Saving...' : <><Check size={16} /> Finalize & Save Inspection</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inspector Verification Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" style={{ maxWidth: 840, width: '92%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Edit3 size={18} color="var(--primary)" /> Inspector Verification & Field Correction
                </h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Review and verify packaging declarations. Saving will automatically rerun the Legal Metrology rule engine and recalculate the compliance score.
                </div>
              </div>
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditModal(false)}><X size={14} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto', padding: '1rem 1.25rem' }}>
              <div className="disclaimer" style={{ marginBottom: '1rem', background: '#e8f5e9', borderColor: '#a5d6a7' }}>
                <CheckCircle size={16} color="var(--success)" />
                <div style={{ fontSize: '0.8rem' }}>
                  <strong>Legal Metrology Officer Verification Mode:</strong> Correcting or confirming a declaration updates its status to <em>Officer Verified (Compliant)</em> and assigns full compliance weight.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
                {[
                  { key: 'product_name', label: 'Name of Commodity / Brand', placeholder: 'e.g. Parle Hide & Seek' },
                  { key: 'generic_name', label: 'Generic or Common Name', placeholder: 'e.g. Chocolate Chip Cookies' },
                  { key: 'net_quantity', label: 'Net Quantity', placeholder: 'e.g. 100 g, 5 kg, 500 ml' },
                  { key: 'mrp', label: 'Maximum Retail Price (MRP)', placeholder: 'e.g. ₹30' },
                  { key: 'manufacturing_date', label: 'Month & Year of Mfg (MFG)', placeholder: 'e.g. March 2026 or 03/2026' },
                  { key: 'packing_date', label: 'Month & Year of Packing (PKD)', placeholder: 'e.g. March 2026 or 03/2026' },
                  { key: 'expiry_date', label: 'Expiry Date (EXP)', placeholder: 'e.g. 09/2026 or 15/09/2026' },
                  { key: 'best_before', label: 'Best-Before Period / Statement', placeholder: 'e.g. 6 Months from Packaging' },
                  { key: 'shelf_life', label: 'Shelf Life Duration', placeholder: 'e.g. 6 months' },
                  { key: 'use_by_date', label: 'Use-By Date (if any)', placeholder: 'e.g. 15/09/2026' },
                  { key: 'manufacturer_name', label: 'Manufacturer Name', placeholder: 'e.g. Parle Products Pvt Ltd' },
                  { key: 'packer_name', label: 'Packer Name (if applicable)', placeholder: 'e.g. Packer name' },
                  { key: 'importer_name', label: 'Importer Name (if imported)', placeholder: 'e.g. Importer name' },
                  { key: 'manufacturer_address', label: 'Manufacturer Address', placeholder: 'Complete postal address with State / PIN' },
                  { key: 'batch_number', label: 'Batch / Lot Number', placeholder: 'e.g. T3 C' },
                  { key: 'consumer_care', label: 'Consumer Care Phone / Email', placeholder: 'e.g. 1800-22-2000 / care@brand.com' },
                  { key: 'country_of_origin', label: 'Country of Origin', placeholder: 'e.g. India' },
                  { key: 'fssai_license', label: 'FSSAI License No. (Informational)', placeholder: '14-digit number' },
                  { key: 'ingredients', label: 'Ingredients List (Informational)', placeholder: 'Wheat flour, chocolate chips, sugar...' }
                ].map(f => (
                  <div className="form-group" key={f.key} style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>{f.label}</label>
                    <input
                      value={editFields[f.key] || ''}
                      onChange={e => setEditFields({ ...editFields, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      style={{ fontSize: '0.85rem' }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn btn-outline" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="btn btn-success" onClick={handleSaveVerification} disabled={verifying} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {verifying ? 'Recalculating...' : <><Check size={16} /> Save & Recalculate Compliance Score</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Optical Evidence Crop Preview Modal */}
      {previewCrop && (
        <div className="modal-overlay" onClick={() => setPreviewCrop(null)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, textTransform: 'capitalize' }}>
                Evidence Crop: {previewCrop.name.replace(/_/g, ' ')}
              </h3>
              <button className="btn btn-sm btn-outline" onClick={() => setPreviewCrop(null)}><X size={14} /></button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '1.25rem' }}>
              <img
                src={previewCrop.url}
                alt="Evidence Crop"
                style={{ maxWidth: '100%', maxHeight: 350, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--gray-300)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                High-resolution optical region cropped automatically by PRAMAN Vision Pipeline.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setPreviewCrop(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
