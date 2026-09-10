import { Router } from 'express';
import { queryAll, queryOne, runSql, getLastInsertId, saveDb } from '../db/database.js';
import { upload } from '../middleware/upload.js';
import { performOCR, performDemoAnalysis } from '../services/ocrService.js';
import { extractDeclarationsFromImage, mergeMultiImageDeclarations } from '../services/declarationExtractor.js';
import { evaluateCompliance } from '../services/complianceEngine.js';
import { performAIVisionAnalysis } from '../services/visionAIService.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// GET /api/inspections — list inspections for current user
router.get('/', (req, res) => {
  try {
    const { status, category, district, search, limit = 50, offset = 0 } = req.query;
    let sql = `
      SELECT i.*, u.name as inspector_name, u.employee_id,
             b.name as business_name, b.district as business_district,
             p.name as product_name, p.brand, p.category, p.manufacturer
      FROM inspections i
      LEFT JOIN users u ON i.inspector_id = u.id
      LEFT JOIN businesses b ON i.business_id = b.id
      LEFT JOIN products p ON i.product_id = p.id
      WHERE i.inspector_id = ?
    `;
    const params = [req.user.id];

    if (status) { sql += ' AND i.status = ?'; params.push(status); }
    if (district) { sql += ' AND i.district = ?'; params.push(district); }
    if (search) {
      sql += ' AND (i.inspection_number LIKE ? OR p.name LIKE ? OR b.name LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    sql += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const inspections = queryAll(sql, params);
    const countResult = queryOne(
      'SELECT COUNT(*) as total FROM inspections WHERE inspector_id = ?',
      [req.user.id]
    );

    res.json({ inspections, total: countResult?.total || 0 });
  } catch (error) {
    console.error('List inspections error:', error);
    res.status(500).json({ error: 'Failed to fetch inspections' });
  }
});

// POST /api/inspections — create new inspection
router.post('/', (req, res) => {
  try {
    const {
      inspection_date, business_name, business_address, district, state,
      inspection_type, remarks, product_name, brand, category,
      manufacturer, batch_number, sku, latitude, longitude,
      business_contact
    } = req.body;

    if (!inspection_date || !business_name || !product_name) {
      return res.status(400).json({ error: 'Inspection date, business name, and product name are required' });
    }

    // Create or find business
    let business = queryOne('SELECT id FROM businesses WHERE name = ? AND district = ?', [business_name, district]);
    if (!business) {
      runSql('INSERT INTO businesses (name, address, district, state, contact) VALUES (?,?,?,?,?)',
        [business_name, business_address || '', district || '', state || '', business_contact || '']);
      business = { id: getLastInsertId() };
    }

    // Create or find product
    let product = queryOne('SELECT id FROM products WHERE name = ? AND manufacturer = ?', [product_name, manufacturer || '']);
    if (!product) {
      runSql('INSERT INTO products (name, brand, category, manufacturer, batch_number, sku) VALUES (?,?,?,?,?,?)',
        [product_name, brand || '', category || 'other_packaged_food', manufacturer || '', batch_number || '', sku || '']);
      product = { id: getLastInsertId() };
    }

    // Generate inspection number
    const maxIdRes = queryOne('SELECT MAX(id) as max_id FROM inspections');
    const nextNum = (maxIdRes?.max_id || 0) + 1;
    const inspectionNumber = `PARAKH-2026-${String(nextNum).padStart(4, '0')}`;

    runSql(`INSERT INTO inspections (inspection_number, inspector_id, business_id, product_id, inspection_date, inspection_type, district, state, latitude, longitude, status, remarks) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [inspectionNumber, req.user.id, business.id, product.id, inspection_date,
       inspection_type || 'retail', district || '', state || '',
       latitude || null, longitude || null, 'in_progress', remarks || '']);

    const inspectionId = getLastInsertId();

    // Audit log
    runSql(
      'INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, timestamp) VALUES (?,?,?,?,?,?,datetime("now"))',
      [req.user.id, req.user.name, 'inspection_created', 'inspection', inspectionId, `Inspection ${inspectionNumber} created for ${product_name} at ${business_name}`]
    );

    res.status(201).json({
      id: inspectionId,
      inspection_number: inspectionNumber,
      message: 'Inspection created successfully'
    });
  } catch (error) {
    console.error('Create inspection error:', error);
    res.status(500).json({ error: 'Failed to create inspection' });
  }
});

// GET /api/inspections/:id — full inspection detail
router.get('/:id', (req, res) => {
  try {
    const inspection = queryOne(`
      SELECT i.*, u.name as inspector_name, u.employee_id,
             b.name as business_name, b.address as business_address, b.district as business_district, b.state as business_state,
             p.name as product_name, p.brand, p.category, p.manufacturer, p.batch_number
      FROM inspections i
      LEFT JOIN users u ON i.inspector_id = u.id
      LEFT JOIN businesses b ON i.business_id = b.id
      LEFT JOIN products p ON i.product_id = p.id
      WHERE i.id = ?
    `, [req.params.id]);

    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    // Get images
    const images = queryAll('SELECT * FROM inspection_images WHERE inspection_id = ?', [req.params.id]);

    // Get OCR results
    const ocrResults = queryAll('SELECT * FROM ocr_results WHERE inspection_id = ?', [req.params.id]);

    // Get declarations with legal rule references
    const declarations = queryAll(`
      SELECT d.*, r.legal_reference, r.name as rule_name, r.description as rule_description
      FROM declarations d
      LEFT JOIN rules r ON d.field_name = r.field_name
      WHERE d.inspection_id = ?
    `, [req.params.id]);

    // Get violations with rule info
    const violations = queryAll(`
      SELECT v.*, r.rule_code, r.name as rule_name, r.legal_reference, r.field_name as rule_field
      FROM violations v
      LEFT JOIN rules r ON v.rule_id = r.id
      WHERE v.inspection_id = ?
    `, [req.params.id]);

    // Get officer decisions
    const decisions = queryAll(`
      SELECT od.*, u.name as officer_name, u.employee_id as officer_employee_id
      FROM officer_decisions od
      LEFT JOIN users u ON od.officer_id = u.id
      WHERE od.violation_id IN (SELECT id FROM violations WHERE inspection_id = ?)
    `, [req.params.id]);

    // Get report
    const report = queryOne('SELECT * FROM reports WHERE inspection_id = ?', [req.params.id]);

    // Compute live compliance checklist with 8 attributes
    const compliance = evaluateCompliance(declarations, inspection.category);

    let qrBarcode = null;
    try {
      if (inspection.qr_data) {
        qrBarcode = JSON.parse(inspection.qr_data);
      }
    } catch (_) {}

    res.json({
      inspection,
      images,
      ocrResults,
      declarations,
      violations,
      decisions,
      report,
      compliance,
      qr_barcode: qrBarcode
    });
  } catch (error) {
    console.error('Get inspection error:', error);
    res.status(500).json({ error: 'Failed to fetch inspection' });
  }
});

// PUT /api/inspections/:id — update inspection
router.put('/:id', (req, res) => {
  try {
    const { status, compliance_score, remarks } = req.body;
    const updates = [];
    const params = [];

    if (status) { updates.push('status = ?'); params.push(status); }
    if (compliance_score !== undefined) { updates.push('compliance_score = ?'); params.push(compliance_score); }
    if (remarks !== undefined) { updates.push('remarks = ?'); params.push(remarks); }
    updates.push('updated_at = datetime("now")');

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    params.push(req.params.id);
    runSql(`UPDATE inspections SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ message: 'Inspection updated' });
  } catch (error) {
    console.error('Update inspection error:', error);
    res.status(500).json({ error: 'Failed to update inspection' });
  }
});

// POST /api/inspections/:id/images — upload images
router.post('/:id/images', (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      console.error('Upload middleware error:', err);
      return res.status(400).json({
        success: false,
        error: 'Image upload failed',
        details: err.message
      });
    }
    next();
  });
}, (req, res) => {
  try {
    const inspectionId = req.params.id;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No images uploaded. Please attach at least one image.' });
    }

    const uploadedImages = [];
    for (const file of req.files) {
      let imageType = req.body.image_type;
      if (!imageType || imageType === 'front') {
        const fn = file.fieldname.toLowerCase();
        if (fn.includes('back')) imageType = 'back';
        else if (fn.includes('side')) imageType = 'side';
        else imageType = 'front';
      }

      const relativePath = `/uploads/${inspectionId}/${file.filename}`;
      runSql(
        'INSERT INTO inspection_images (inspection_id, image_path, image_type, original_name) VALUES (?,?,?,?)',
        [inspectionId, relativePath, imageType, file.originalname]
      );
      const id = getLastInsertId();
      uploadedImages.push({ id, path: relativePath, type: imageType, original_name: file.originalname });
    }

    // Audit log
    runSql(
      'INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, timestamp) VALUES (?,?,?,?,?,?,datetime("now"))',
      [req.user.id, req.user.name, 'image_uploaded', 'inspection', inspectionId, `${req.files.length} image(s) uploaded`]
    );

    res.status(201).json({
      success: true,
      images: uploadedImages,
      message: `${req.files.length} image(s) uploaded successfully`
    });
  } catch (error) {
    console.error('Upload images error:', error);
    res.status(500).json({ success: false, error: 'Failed to save uploaded images', details: error.message });
  }
});

// POST /api/inspections/:id/analyze — run Vision AI and compliance analysis
router.post('/:id/analyze', async (req, res) => {
  try {
    const inspectionId = req.params.id;
    const { demo_mode } = req.body;

    const inspection = queryOne(`
      SELECT i.*, p.name as product_name, p.category
      FROM inspections i
      LEFT JOIN products p ON i.product_id = p.id
      WHERE i.id = ?
    `, [inspectionId]);

    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    const images = queryAll('SELECT * FROM inspection_images WHERE inspection_id = ?', [inspectionId]);

    let allRawText = '';
    let allCleanedText = '';
    let avgConfidence = 0;
    let ocrMethod = 'gemini_vision';
    let totalTime = 0;
    let ocrResults = [];
    let demoNotice = null;
    let declarations = [];
    let visionResult = null;

    if (demo_mode) {
      // Explicitly labelled demo analysis (retained for Demo Mode)
      const demoResult = performDemoAnalysis(inspection.product_name, inspection.category);
      allRawText = demoResult.raw_text;
      allCleanedText = demoResult.cleaned_text;
      avgConfidence = demoResult.confidence;
      ocrMethod = 'demo_fallback';
      totalTime = demoResult.processing_time_ms;
      demoNotice = demoResult.demo_notice;

      // Store OCR result
      runSql(
        'INSERT INTO ocr_results (inspection_id, raw_text, ocr_confidence, ocr_method, processing_time_ms) VALUES (?,?,?,?,?)',
        [inspectionId, allRawText, avgConfidence, ocrMethod, totalTime]
      );
      ocrResults.push({
        raw_text: allRawText,
        cleaned_text: allCleanedText,
        confidence: avgConfidence,
        method: ocrMethod,
        demo_notice: demoNotice
      });

      const demoDecls = extractDeclarationsFromImage({ raw_text: allRawText, cleaned_text: allCleanedText, confidence: avgConfidence });
      declarations = await mergeMultiImageDeclarations([{ declarations: demoDecls, imagePath: null, imageId: null }], inspectionId);
    } else {
      // Real Multimodal Vision AI Pipeline (Primary)
      if (images.length === 0) {
        return res.status(400).json({ error: 'No images uploaded for this inspection. Upload package images first.' });
      }

      console.log(`[PARAKH Vision Pipeline] Starting Vision AI analysis for inspection #${inspectionId} with ${images.length} images...`);
      const visionStartTime = Date.now();
      visionResult = await performAIVisionAnalysis(images, {
        product_name: inspection.product_name,
        category: inspection.category,
        inspection_id: inspectionId
      });

      if (!visionResult.success) {
        console.warn('[PARAKH Vision Pipeline] Vision AI returned error or unparseable output:', visionResult.error);
      }

      if (visionResult.needs_config) {
        return res.status(400).json({
          error: visionResult.error,
          needs_config: true,
          message: 'Google Gemini Vision AI analysis requires GEMINI_API_KEY in .env. Please configure GEMINI_API_KEY in your .env file to analyze real packaging photos.'
        });
      }

      if (visionResult.success && visionResult.declarations?.length > 0) {
        declarations = visionResult.declarations;
        avgConfidence = visionResult.confidence;
        ocrMethod = visionResult.method || 'gemini_vision';
        totalTime = visionResult.processing_time_ms;
        allRawText = visionResult.raw_ai_response || '';
        allCleanedText = declarations.map(d => `${d.field_name}: ${d.extracted_value} (${d.status})`).join('\n');

        // Store Vision result
        runSql(
          'INSERT INTO ocr_results (inspection_id, raw_text, ocr_confidence, ocr_method, processing_time_ms) VALUES (?,?,?,?,?)',
          [inspectionId, allRawText, avgConfidence, ocrMethod, totalTime]
        );

        ocrResults.push({
          raw_text: allRawText,
          cleaned_text: allCleanedText,
          confidence: avgConfidence,
          method: ocrMethod,
          processing_time_ms: totalTime
        });
      } else {
        // Strict Anti-Hallucination & No Silent Demo Fallback for Real Uploads (Requirement #12)
        console.warn('[PRAMAN Vision Pipeline] Vision AI returned error or unparseable output:', visionResult.error);
        const configuredFields = [
          { key: 'product_name', is_info: 0 },
          { key: 'generic_name', is_info: 0 },
          { key: 'net_quantity', is_info: 0 },
          { key: 'mrp', is_info: 0 },
          { key: 'manufacturer_name', is_info: 0 },
          { key: 'packer_name', is_info: 1 },
          { key: 'importer_name', is_info: 1 },
          { key: 'manufacturer_address', is_info: 0 },
          { key: 'manufacturing_date', is_info: 0 },
          { key: 'packing_date', is_info: 0 },
          { key: 'date_of_manufacture', is_info: 0 },
          { key: 'expiry_date', is_info: 0 },
          { key: 'use_by_date', is_info: 0 },
          { key: 'best_before', is_info: 0 },
          { key: 'shelf_life', is_info: 1 },
          { key: 'batch_number', is_info: 1 },
          { key: 'consumer_care', is_info: 0 },
          { key: 'country_of_origin', is_info: 0 },
          { key: 'fssai_license', is_info: 1 },
          { key: 'ingredients', is_info: 1 }
        ];

        declarations = configuredFields.map(f => ({
          field_name: f.key,
          extracted_value: '',
          confidence: 0,
          status: 'uncertain',
          evidence: `Unable to reliably extract this declaration. Manual verification required. (${visionResult.error || 'Vision analysis unavailable'})`,
          source_image: images[0]?.original_name || null,
          source_image_id: images[0]?.id || null,
          source_type: 'package_image',
          crop_path: null,
          is_informational: f.is_info,
          is_verified: 0,
          verified_value: null
        }));

        avgConfidence = 0;
        ocrMethod = visionResult.method || 'vision_ai_error';
        totalTime = visionResult.processing_time_ms || 0;
        allRawText = `[Vision AI Extraction Incomplete]\nReason: ${visionResult.error || 'Vision analysis unavailable'}\n\nStrict Anti-Hallucination Policy: No fake or placeholder text was generated. All mandatory Legal Metrology fields have been marked for manual officer verification.`;
        allCleanedText = allRawText;

        // Save failed attempt to ocr_results for record-keeping
        runSql(
          'INSERT INTO ocr_results (inspection_id, raw_text, ocr_confidence, ocr_method, processing_time_ms) VALUES (?,?,?,?,?)',
          [inspectionId, allRawText, 0, ocrMethod, totalTime]
        );

        ocrResults.push({
          raw_text: allRawText,
          cleaned_text: allCleanedText,
          confidence: 0,
          method: ocrMethod,
          processing_time_ms: totalTime
        });
      }
    }

    // Store structured declarations in database
    runSql('DELETE FROM declarations WHERE inspection_id = ?', [inspectionId]);
    for (const d of declarations) {
      runSql(
        'INSERT INTO declarations (inspection_id, field_name, extracted_value, confidence, status, is_informational, source_image_id, source_image, source_type, evidence, crop_path, is_verified, verified_value) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [
          inspectionId,
          d.field_name,
          d.extracted_value || '',
          d.confidence || 0,
          d.status || 'not_detected',
          d.is_informational || 0,
          d.source_image_id || null,
          d.source_image || null,
          d.source_type || 'package_image',
          d.evidence || null,
          d.crop_path || null,
          d.is_verified ? 1 : 0,
          d.verified_value || null
        ]
      );
      d.id = getLastInsertId();
    }

    // Extract separated date values to store directly on inspection
    const mfgDate = declarations.find(d => d.field_name === 'manufacturing_date')?.extracted_value || '';
    const pkdDate = declarations.find(d => d.field_name === 'packing_date')?.extracted_value || '';
    const expDate = declarations.find(d => d.field_name === 'expiry_date')?.extracted_value || '';
    const useByDate = declarations.find(d => d.field_name === 'use_by_date')?.extracted_value || '';
    const bestBefore = declarations.find(d => d.field_name === 'best_before')?.extracted_value || '';
    const shelfLife = declarations.find(d => d.field_name === 'shelf_life')?.extracted_value || '';
    const qrBarcodeData = visionResult?.qr_barcode || { code_present: false };
    const qrDataStr = JSON.stringify(qrBarcodeData);
    const barcodeStr = qrBarcodeData.code_type === 'BARCODE' ? (qrBarcodeData.raw_content || '') : '';

    // Run accuracy-first Legal Metrology compliance engine
    const compliance = evaluateCompliance(declarations, inspection.category);

    // Store violations
    runSql('DELETE FROM violations WHERE inspection_id = ? AND status = "pending"', [inspectionId]);
    for (const v of compliance.violations) {
      runSql(
        'INSERT INTO violations (inspection_id, rule_id, declaration_id, description, severity, confidence, status) VALUES (?,?,?,?,?,?,?)',
        [inspectionId, v.rule_id, v.declaration_id || null, v.description, v.severity, v.confidence, 'pending']
      );
    }

    // Update inspection record with score, status, and separated date/code columns
    runSql(
      `UPDATE inspections SET 
        compliance_score = ?, 
        status = ?, 
        qr_data = ?, 
        barcode_data = ?,
        manufacturing_date = ?,
        packing_date = ?,
        expiry_date = ?,
        use_by_date = ?,
        best_before = ?,
        shelf_life = ?,
        updated_at = datetime("now") 
       WHERE id = ?`,
      [
        compliance.score,
        compliance.status,
        qrDataStr,
        barcodeStr,
        mfgDate,
        pkdDate,
        expDate,
        useByDate,
        bestBefore,
        shelfLife,
        inspectionId
      ]
    );

    // Audit log
    runSql(
      'INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, timestamp) VALUES (?,?,?,?,?,?,datetime("now"))',
      [req.user.id, req.user.name, 'analysis_performed', 'inspection', inspectionId,
       `Vision AI analysis completed. Method: ${ocrMethod}. Score: ${compliance.score}/100. Status: ${compliance.status}`]
    );

    res.json({
      ocr: {
        results: ocrResults,
        raw_text: allRawText,
        cleaned_text: allCleanedText,
        combined_text: allCleanedText || allRawText,
        confidence: avgConfidence,
        average_confidence: avgConfidence,
        method: ocrMethod,
        processing_time_ms: totalTime,
        demo_notice: demoNotice
      },
      declarations,
      compliance,
      qr_barcode: qrBarcodeData,
      message: 'AI Vision analysis completed successfully'
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed: ' + error.message });
  }
});

// PUT /api/inspections/:id/verify-declarations — inspector edits, confirms, or marks declarations uncertain
router.put('/:id/verify-declarations', async (req, res) => {
  try {
    const inspectionId = req.params.id;
    const { verified_fields, remarks } = req.body;

    const inspection = queryOne(`
      SELECT i.*, p.name as product_name, p.category
      FROM inspections i
      LEFT JOIN products p ON i.product_id = p.id
      WHERE i.id = ?
    `, [inspectionId]);

    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    if (!verified_fields || typeof verified_fields !== 'object') {
      return res.status(400).json({ error: 'verified_fields is required' });
    }

    const updates = Array.isArray(verified_fields)
      ? verified_fields
      : Object.entries(verified_fields).map(([field_name, val]) => {
          if (typeof val === 'object' && val !== null) {
            return { field_name, ...val };
          }
          return { field_name, verified_value: val };
        });

    for (const item of updates) {
      if (!item.field_name) continue;
      const vVal = item.verified_value != null ? String(item.verified_value).trim() : null;
      const itemStatus = item.status;

      if (itemStatus === 'uncertain') {
        // Mark explicitly as uncertain
        runSql(
          'UPDATE declarations SET status = "uncertain", is_verified = 1, verified_by = ?, verified_at = datetime("now") WHERE inspection_id = ? AND field_name = ?',
          [req.user.name, inspectionId, item.field_name]
        );
      } else if (itemStatus === 'not_detected') {
        // Mark explicitly as not detected
        runSql(
          'UPDATE declarations SET status = "not_detected", is_verified = 1, verified_by = ?, verified_at = datetime("now") WHERE inspection_id = ? AND field_name = ?',
          [req.user.name, inspectionId, item.field_name]
        );
      } else if (vVal) {
        // Confirmed / edited by officer -> compliant verified
        runSql(
          'UPDATE declarations SET verified_value = ?, is_verified = 1, status = "detected", confidence = 100, source_type = "inspector_verified", verified_by = ?, verified_at = datetime("now") WHERE inspection_id = ? AND field_name = ?',
          [vVal, req.user.name, inspectionId, item.field_name]
        );
      }
    }

    // Retrieve refreshed declarations
    const updatedDeclarations = queryAll(`
      SELECT d.*, r.legal_reference, r.name as rule_name, r.description as rule_description
      FROM declarations d
      LEFT JOIN rules r ON d.field_name = r.field_name
      WHERE d.inspection_id = ?
    `, [inspectionId]);

    // Re-evaluate compliance with updated values
    const compliance = evaluateCompliance(updatedDeclarations, inspection.category);

    // Refresh pending violations
    runSql('DELETE FROM violations WHERE inspection_id = ? AND status = "pending"', [inspectionId]);
    for (const v of compliance.violations) {
      runSql(
        'INSERT INTO violations (inspection_id, rule_id, declaration_id, description, severity, confidence, status) VALUES (?,?,?,?,?,?,?)',
        [inspectionId, v.rule_id, v.declaration_id || null, v.description, v.severity, v.confidence, 'pending']
      );
    }

    // Extract separated date values to sync with inspection row
    const mfgDate = updatedDeclarations.find(d => d.field_name === 'manufacturing_date')?.verified_value || updatedDeclarations.find(d => d.field_name === 'manufacturing_date')?.extracted_value || '';
    const pkdDate = updatedDeclarations.find(d => d.field_name === 'packing_date')?.verified_value || updatedDeclarations.find(d => d.field_name === 'packing_date')?.extracted_value || '';
    const expDate = updatedDeclarations.find(d => d.field_name === 'expiry_date')?.verified_value || updatedDeclarations.find(d => d.field_name === 'expiry_date')?.extracted_value || '';
    const useByDate = updatedDeclarations.find(d => d.field_name === 'use_by_date')?.verified_value || updatedDeclarations.find(d => d.field_name === 'use_by_date')?.extracted_value || '';
    const bestBefore = updatedDeclarations.find(d => d.field_name === 'best_before')?.verified_value || updatedDeclarations.find(d => d.field_name === 'best_before')?.extracted_value || '';
    const shelfLife = updatedDeclarations.find(d => d.field_name === 'shelf_life')?.verified_value || updatedDeclarations.find(d => d.field_name === 'shelf_life')?.extracted_value || '';

    // Update inspection score, status, remarks, and date columns
    runSql(
      `UPDATE inspections SET 
        compliance_score = ?, 
        status = ?, 
        remarks = COALESCE(?, remarks),
        manufacturing_date = ?,
        packing_date = ?,
        expiry_date = ?,
        use_by_date = ?,
        best_before = ?,
        shelf_life = ?,
        updated_at = datetime("now") 
       WHERE id = ?`,
      [
        compliance.score,
        compliance.status,
        remarks || null,
        mfgDate,
        pkdDate,
        expDate,
        useByDate,
        bestBefore,
        shelfLife,
        inspectionId
      ]
    );

    // Audit log
    runSql(
      'INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, timestamp) VALUES (?,?,?,?,?,?,datetime("now"))',
      [req.user.id, req.user.name, 'declarations_verified', 'inspection', inspectionId,
       `Officer verified declarations. Remarks: ${remarks || 'Field values confirmed'}. Score: ${compliance.score}/100.`]
    );

    res.json({
      success: true,
      message: 'Declarations verified and compliance score recalculated successfully',
      declarations: updatedDeclarations,
      compliance,
      new_score: compliance.score,
      new_status: compliance.status
    });
  } catch (error) {
    console.error('Verify declarations error:', error);
    res.status(500).json({ error: 'Failed to verify declarations: ' + error.message });
  }
});

// POST /api/violations/:id/decision — officer decision on a violation
router.post('/violations/:violationId/decision', (req, res) => {
  try {
    const { decision, remarks } = req.body;
    const violationId = req.params.violationId;

    if (!decision || !['confirmed', 'dismissed', 'manual_review'].includes(decision)) {
      return res.status(400).json({ error: 'Valid decision required: confirmed, dismissed, or manual_review' });
    }

    if (decision === 'dismissed' && !remarks) {
      return res.status(400).json({ error: 'Remarks are required when dismissing a finding' });
    }

    // Update violation status
    runSql('UPDATE violations SET status = ? WHERE id = ?', [decision, violationId]);

    // Record officer decision
    runSql(
      'INSERT INTO officer_decisions (violation_id, officer_id, decision, remarks) VALUES (?,?,?,?)',
      [violationId, req.user.id, decision, remarks || '']
    );

    // Get the inspection to update status
    const violation = queryOne('SELECT inspection_id FROM violations WHERE id = ?', [violationId]);
    if (violation) {
      // Recalculate inspection status
      const pendingCount = queryOne(
        'SELECT COUNT(*) as cnt FROM violations WHERE inspection_id = ? AND status = "pending"',
        [violation.inspection_id]
      );
      const confirmedCount = queryOne(
        'SELECT COUNT(*) as cnt FROM violations WHERE inspection_id = ? AND status = "confirmed"',
        [violation.inspection_id]
      );

      let newStatus;
      if (confirmedCount?.cnt > 0) {
        newStatus = 'potential_non_compliance';
      } else if (pendingCount?.cnt > 0) {
        newStatus = 'requires_review';
      } else {
        newStatus = 'compliant';
      }

      runSql('UPDATE inspections SET status = ?, updated_at = datetime("now") WHERE id = ?',
        [newStatus, violation.inspection_id]);
    }

    // Audit log
    const actionType = decision === 'confirmed' ? 'violation_confirmed' : decision === 'dismissed' ? 'violation_dismissed' : 'violation_manual_review';
    runSql(
      'INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, timestamp) VALUES (?,?,?,?,?,?,datetime("now"))',
      [req.user.id, req.user.name, actionType, 'violation', violationId, `Violation ${violationId}: ${decision}. ${remarks || ''}`]
    );

    res.json({ message: `Violation ${decision}`, status: decision });
  } catch (error) {
    console.error('Decision error:', error);
    res.status(500).json({ error: 'Failed to record decision' });
  }
});

// POST /api/reports/:inspectionId — generate report
router.post('/reports/:inspectionId', (req, res) => {
  try {
    const inspectionId = req.params.inspectionId;

    const inspection = queryOne(`
      SELECT i.*, u.name as inspector_name, u.employee_id, u.district as inspector_district,
             b.name as business_name, b.address as business_address, b.district as business_district, b.state as business_state,
             p.name as product_name, p.brand, p.category, p.manufacturer, p.batch_number
      FROM inspections i
      LEFT JOIN users u ON i.inspector_id = u.id
      LEFT JOIN businesses b ON i.business_id = b.id
      LEFT JOIN products p ON i.product_id = p.id
      WHERE i.id = ?
    `, [inspectionId]);

    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    const images = queryAll('SELECT * FROM inspection_images WHERE inspection_id = ?', [inspectionId]);
    const declarations = queryAll(`
      SELECT d.*, r.legal_reference, r.name as rule_name, r.description as rule_description
      FROM declarations d
      LEFT JOIN rules r ON d.field_name = r.field_name
      WHERE d.inspection_id = ?
    `, [inspectionId]);

    const compliance = evaluateCompliance(declarations, inspection.category);

    const violations = queryAll(`
      SELECT v.*, r.rule_code, r.name as rule_name, r.legal_reference
      FROM violations v
      LEFT JOIN rules r ON v.rule_id = r.id
      WHERE v.inspection_id = ?
    `, [inspectionId]);

    const decisions = queryAll(`
      SELECT od.*, u.name as officer_name, u.employee_id as officer_employee_id
      FROM officer_decisions od
      LEFT JOIN users u ON od.officer_id = u.id
      WHERE od.violation_id IN (SELECT id FROM violations WHERE inspection_id = ?)
    `, [inspectionId]);

    let qrBarcode = null;
    try {
      if (inspection.qr_data) {
        qrBarcode = JSON.parse(inspection.qr_data);
      }
    } catch (_) {}

    const reportPayload = {
      header: {
        title: 'PARAKH',
        subtitle: 'AI-Assisted Packaged Commodity Compliance & Inspection System',
        authority: 'Government of India — Ministry of Consumer Affairs, Food & Public Distribution',
        department: 'Department of Consumer Affairs • Legal Metrology Division',
        statute: 'Legal Metrology Act, 2009 & Legal Metrology (Packaged Commodities) Rules, 2011'
      },
      inspection: {
        id: inspection.id,
        number: inspection.inspection_number,
        date: inspection.inspection_date,
        created_at: inspection.created_at,
        type: inspection.inspection_type,
        status: compliance.status,
        score: compliance.score,
        district: inspection.district,
        state: inspection.state,
        remarks: inspection.remarks,
        manufacturing_date: inspection.manufacturing_date,
        packing_date: inspection.packing_date,
        expiry_date: inspection.expiry_date,
        use_by_date: inspection.use_by_date,
        best_before: inspection.best_before,
        shelf_life: inspection.shelf_life
      },
      inspector: {
        name: inspection.inspector_name,
        employee_id: inspection.employee_id,
        district: inspection.inspector_district
      },
      business: {
        name: inspection.business_name,
        address: inspection.business_address,
        district: inspection.business_district,
        state: inspection.business_state
      },
      product: {
        name: inspection.product_name,
        brand: inspection.brand,
        category: inspection.category,
        manufacturer: inspection.manufacturer,
        batch_number: inspection.batch_number
      },
      evidence_images: images,
      declarations,
      qr_barcode: qrBarcode,
      checklist: compliance.checklist,
      violations,
      decisions,
      manual_review_items: compliance.checklist.filter(c => c.status === 'requires_manual_verification'),
      disclaimer: 'PARAKH is an AI-assisted inspection support system. Automated findings are indicative and require verification by an authorized Legal Metrology officer.',
      generated_at: new Date().toISOString(),
      generated_by: req.user.name
    };

    const reportData = JSON.stringify(reportPayload);

    // Check if report already exists
    const existing = queryOne('SELECT * FROM reports WHERE inspection_id = ?', [inspectionId]);

    if (existing) {
      runSql('UPDATE reports SET report_data = ?, generated_at = datetime("now"), generated_by = ? WHERE inspection_id = ?',
        [reportData, req.user.id, inspectionId]);
    } else {
      runSql('INSERT INTO reports (inspection_id, report_data, generated_by) VALUES (?,?,?)',
        [inspectionId, reportData, req.user.id]);
    }

    // Audit log
    runSql(
      'INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, timestamp) VALUES (?,?,?,?,?,?,datetime("now"))',
      [req.user.id, req.user.name, 'report_generated', 'inspection', inspectionId, `Official compliance report generated for inspection ${inspection.inspection_number}`]
    );

    res.json({
      message: 'Official compliance report generated successfully',
      inspection_id: inspectionId,
      report: reportPayload
    });
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: 'Failed to generate report: ' + error.message });
  }
});

// GET /api/inspections/:id/ocr — get OCR results
router.get('/:id/ocr', (req, res) => {
  try {
    const results = queryAll('SELECT * FROM ocr_results WHERE inspection_id = ?', [req.params.id]);
    res.json({ ocrResults: results });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch OCR results' });
  }
});

// GET /api/inspections/:id/declarations
router.get('/:id/declarations', (req, res) => {
  try {
    const declarations = queryAll('SELECT * FROM declarations WHERE inspection_id = ?', [req.params.id]);
    res.json({ declarations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch declarations' });
  }
});

// GET /api/inspections/:id/violations
router.get('/:id/violations', (req, res) => {
  try {
    const violations = queryAll(`
      SELECT v.*, r.rule_code, r.name as rule_name, r.legal_reference, r.description as rule_description
      FROM violations v
      LEFT JOIN rules r ON v.rule_id = r.id
      WHERE v.inspection_id = ?
    `, [req.params.id]);
    res.json({ violations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch violations' });
  }
});

// DELETE /api/inspections/:id — Delete inspection with RBAC authorization & cascading cleanup
router.delete('/:id', async (req, res) => {
  try {
    const inspectionId = req.params.id;
    const inspection = queryOne('SELECT * FROM inspections WHERE id = ?', [inspectionId]);

    if (!inspection) {
      return res.status(404).json({ success: false, error: 'Inspection not found' });
    }

    // RBAC Authorization:
    // Admin can delete any inspection; Inspector can only delete their own.
    const isAdmin = req.user.role === 'admin';
    const isOwner = Number(inspection.inspector_id) === Number(req.user.id);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You do not have permission to delete this inspection'
      });
    }

    // 1. Delete dependent officer decisions (linked via violations)
    runSql(`
      DELETE FROM officer_decisions 
      WHERE violation_id IN (SELECT id FROM violations WHERE inspection_id = ?)
    `, [inspectionId]);

    // 2. Delete violations
    runSql('DELETE FROM violations WHERE inspection_id = ?', [inspectionId]);

    // 3. Delete declarations
    runSql('DELETE FROM declarations WHERE inspection_id = ?', [inspectionId]);

    // 4. Delete ocr_results
    runSql('DELETE FROM ocr_results WHERE inspection_id = ?', [inspectionId]);

    // 5. Delete inspection_images
    runSql('DELETE FROM inspection_images WHERE inspection_id = ?', [inspectionId]);

    // 6. Delete reports
    runSql('DELETE FROM reports WHERE inspection_id = ?', [inspectionId]);

    // 7. Delete inspection record
    runSql('DELETE FROM inspections WHERE id = ?', [inspectionId]);

    // 8. Safe physical file cleanup
    const uploadBase = process.env.UPLOAD_DIR
      ? path.resolve(process.env.UPLOAD_DIR)
      : path.join(__dirname, '..', '..', 'uploads');

    const safeId = String(inspectionId).replace(/[^a-zA-Z0-9_-]/g, '');

    // Remove inspection images directory: uploads/:id
    try {
      const inspectionDir = path.join(uploadBase, safeId);
      if (fs.existsSync(inspectionDir)) {
        fs.rmSync(inspectionDir, { recursive: true, force: true });
      }
    } catch (fileErr) {
      console.warn(`Could not clean up image folder for inspection ${inspectionId}:`, fileErr.message);
    }

    // Remove evidence crops directory: uploads/crops/:id
    try {
      const cropsDir = path.join(uploadBase, 'crops', safeId);
      if (fs.existsSync(cropsDir)) {
        fs.rmSync(cropsDir, { recursive: true, force: true });
      }
    } catch (cropErr) {
      console.warn(`Could not clean up crop folder for inspection ${inspectionId}:`, cropErr.message);
    }

    // 9. Audit log entry: action = DELETE_INSPECTION
    runSql(
      'INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, timestamp) VALUES (?,?,?,?,?,?,datetime("now"))',
      [
        req.user.id,
        req.user.name,
        'DELETE_INSPECTION',
        'inspection',
        inspectionId,
        `Deleted inspection #${inspection.inspection_number} (${inspection.status}) by ${req.user.role} ${req.user.name}`
      ]
    );

    saveDb();

    res.json({
      success: true,
      message: `Inspection ${inspection.inspection_number} deleted successfully`,
      deleted_id: Number(inspectionId)
    });
  } catch (error) {
    console.error('Delete inspection error:', error);
    res.status(500).json({ success: false, error: 'Unable to delete inspection. Please try again.' });
  }
});

export default router;
