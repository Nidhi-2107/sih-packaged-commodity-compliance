/**
 * Compliance Engine — Accuracy-First Legal Metrology Rule Evaluator
 * 
 * Evaluates extracted packaged commodity declarations against official rules
 * stored in the database (Legal Metrology Packaged Commodities Rules, 2011).
 * 
 * Status Categories:
 * - 'compliant' (✓ Compliant)
 * - 'requires_manual_verification' (⚠ Requires Manual Verification — OCR Uncertainty)
 * - 'potential_non_compliance' (✕ Potential Non-Compliance)
 * - 'not_detected' (? Not Detected)
 * 
 * Never treats OCR uncertainty as a confirmed violation.
 * Gives precedence to Inspector-verified values.
 */

import { queryAll } from '../db/database.js';

export function evaluateCompliance(declarations, category = 'packaged_food') {
  // Load active rules for this category from database
  const rules = queryAll(
    'SELECT * FROM rules WHERE active = 1 AND (category = ? OR category = ?)',
    ['packaged_food', category || 'packaged_food']
  );

  if (rules.length === 0) {
    return {
      score: 0,
      status: 'requires_review',
      checklist: [],
      violations: [],
      summary: 'No active Legal Metrology compliance rules found for this category.',
      total_rules: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    };
  }

  const checklist = [];
  const violations = [];
  let totalWeight = 0;
  let earnedWeight = 0;

  for (const rule of rules) {
    const weight = getWeight(rule.severity);
    if (rule.required) {
      totalWeight += weight;
    }

    // Match declaration from list (with aliases for food-specific rules)
    let declaration = null;
    if (rule.field_name === 'best_before') {
      declaration = declarations.find(d => 
        (d.field_name === 'best_before' || d.field_name === 'expiry_date' || d.field_name === 'use_by_date') &&
        (d.is_verified || (d.extracted_value && d.status === 'detected'))
      ) || declarations.find(d => 
        d.field_name === 'best_before' || d.field_name === 'expiry_date' || d.field_name === 'use_by_date'
      );
    } else if (rule.field_name === 'date_of_manufacture') {
      declaration = declarations.find(d => 
        (d.field_name === 'date_of_manufacture' || d.field_name === 'packing_date' || d.field_name === 'manufacturing_date') &&
        (d.is_verified || (d.extracted_value && d.status === 'detected'))
      ) || declarations.find(d => 
        d.field_name === 'date_of_manufacture' || d.field_name === 'packing_date' || d.field_name === 'manufacturing_date'
      );
    } else {
      declaration = declarations.find(d => d.field_name === rule.field_name && !d.is_informational);
    }

    let checkResult = {
      rule_id: rule.id,
      rule_code: rule.rule_code,
      rule_name: rule.name,
      requirement: rule.name,
      field_name: rule.field_name,
      description: rule.description,
      legal_reference: rule.legal_reference,
      required: !!rule.required,
      required_expected: rule.required 
        ? 'Mandatory declaration under Legal Metrology (Packaged Commodities) Rules, 2011'
        : 'Conditional declaration under Legal Metrology Rules, 2011',
      severity: rule.severity,
      status: 'compliant',
      status_label: 'COMPLIANT',
      status_badge: '✓ COMPLIANT',
      detected_value: '',
      extracted_value: '',
      verified_value: null,
      is_verified: 0,
      confidence: 0,
      crop_path: null,
      evidence: '',
      explanation: '',
      message: ''
    };

    if (!declaration) {
      // Not evaluated or missing
      checkResult.status = rule.required ? 'potential_non_compliance' : 'not_detected';
      checkResult.status_label = rule.required ? 'POTENTIAL NON-COMPLIANCE' : 'NOT DETECTED / NOT VISIBLE';
      checkResult.status_badge = rule.required ? '✕ POTENTIAL NON-COMPLIANCE' : '— NOT DETECTED / NOT VISIBLE';
      checkResult.message = `${rule.name} was not detected across uploaded images.`;
      checkResult.explanation = checkResult.message;
      if (rule.required) {
        violations.push({
          rule_id: rule.id,
          rule_name: rule.name,
          legal_reference: rule.legal_reference,
          issue: `Mandatory declaration '${rule.name}' not found in OCR extraction.`,
          evidence: 'No matching text pattern found in package images.',
          description: `${rule.name}: ${rule.description || 'Mandatory declaration missing'}`,
          severity: rule.severity,
          confidence: 0,
          field_name: rule.field_name,
          action: 'Verify physically on packaging panel'
        });
      }
    } else {
      checkResult.detected_value = declaration.extracted_value || '';
      checkResult.extracted_value = declaration.extracted_value || '';
      checkResult.verified_value = declaration.verified_value || null;
      checkResult.is_verified = declaration.is_verified ? 1 : 0;
      checkResult.confidence = declaration.confidence || 0;
      checkResult.crop_path = declaration.crop_path || null;
      checkResult.evidence = declaration.evidence || '';

      // 1. Inspector-verified declaration (Overrules AI)
      if (declaration.is_verified && declaration.verified_value) {
        checkResult.status = 'compliant';
        checkResult.status_label = 'COMPLIANT';
        checkResult.status_badge = '✓ COMPLIANT';
        checkResult.confidence = 100;
        checkResult.detected_value = declaration.verified_value;
        checkResult.extracted_value = declaration.verified_value;
        checkResult.message = `${rule.name} confirmed and verified by Inspecting Officer.`;
        checkResult.explanation = checkResult.message;
        if (rule.required) {
          earnedWeight += weight;
        }
      } 
      // 2. Confirmed AI Detection
      else if (declaration.status === 'detected' && declaration.confidence >= 50 && declaration.extracted_value) {
        checkResult.status = 'compliant';
        checkResult.status_label = 'COMPLIANT';
        checkResult.status_badge = '✓ COMPLIANT';
        checkResult.message = `${rule.name} clearly detected and verified on packaging.`;
        checkResult.explanation = checkResult.message;
        if (rule.required) {
          earnedWeight += weight;
        }
      } 
      // 3. Uncertain or Illegible text (Never a confirmed legal violation!)
      else if (declaration.status === 'uncertain' || declaration.status === 'illegible' || (declaration.status === 'detected' && declaration.confidence < 50)) {
        checkResult.status = 'requires_manual_verification';
        checkResult.status_label = 'REQUIRES MANUAL REVIEW';
        checkResult.status_badge = '⚠ REQUIRES MANUAL REVIEW';
        const reason = declaration.status === 'illegible' ? 'text is illegible/curved' : 'optical confidence is low';
        checkResult.message = `${rule.name} is present on packaging but ${reason} (${Math.round(declaration.confidence)}%). Manual verification required.`;
        checkResult.explanation = checkResult.message;
        if (rule.required) {
          earnedWeight += weight * 0.6; // 60% partial credit, never penalize product unfairly
        }
        violations.push({
          rule_id: rule.id,
          declaration_id: declaration.id,
          rule_name: rule.name,
          legal_reference: rule.legal_reference,
          issue: `Declaration '${rule.name}' detected with low clarity (${Math.round(declaration.confidence)}%).`,
          evidence: declaration.evidence || (declaration.extracted_value ? `Observed text: "${declaration.extracted_value}"` : 'Packaging text unclear/curved.'),
          description: `${rule.name}: Optical reading uncertain. Manual officer verification required.`,
          severity: 'minor',
          confidence: declaration.confidence,
          field_name: rule.field_name,
          action: 'Manual Verification Required'
        });
      } 
      // 4. Relevant packaging panel not visible
      else if (declaration.status === 'not_visible') {
        checkResult.status = 'not_visible';
        checkResult.status_label = 'NOT DETECTED / NOT VISIBLE';
        checkResult.status_badge = '— NOT DETECTED / NOT VISIBLE';
        checkResult.message = `${rule.name} panel was not visible in the provided image(s). Attach additional packaging photos if needed.`;
        checkResult.explanation = checkResult.message;
        if (rule.required) {
          earnedWeight += weight * 0.4;
        }
        violations.push({
          rule_id: rule.id,
          declaration_id: declaration.id,
          rule_name: rule.name,
          legal_reference: rule.legal_reference,
          issue: `${rule.name} not visible in the provided images.`,
          evidence: declaration.evidence || 'Relevant package panel not provided.',
          description: `${rule.name}: Panel not shown. Upload side/back image for inspection.`,
          severity: 'minor',
          confidence: 50,
          field_name: rule.field_name,
          action: 'Upload Additional Package Image'
        });
      } 
      // 5. Searched provided packaging and not detected
      else {
        checkResult.status = rule.required ? 'potential_non_compliance' : 'not_detected';
        checkResult.status_label = rule.required ? 'POTENTIAL NON-COMPLIANCE' : 'NOT DETECTED / NOT VISIBLE';
        checkResult.status_badge = rule.required ? '✕ POTENTIAL NON-COMPLIANCE' : '— NOT DETECTED / NOT VISIBLE';
        checkResult.message = `${rule.name} could not be detected across provided package images.`;
        checkResult.explanation = checkResult.message;
        if (rule.required) {
          violations.push({
            rule_id: rule.id,
            declaration_id: declaration.id,
            rule_name: rule.name,
            legal_reference: rule.legal_reference,
            issue: `Required declaration '${rule.name}' not detected on packaging panels.`,
            evidence: declaration.evidence || 'Searched uploaded images; declaration text not found.',
            description: `${rule.name} could not be detected. Potential non-compliance with Legal Metrology rules.`,
            severity: rule.severity,
            confidence: Math.max(70, 100 - (declaration.confidence || 0)),
            field_name: rule.field_name,
            action: 'Verify physically on packaging'
          });
        }
      }
    }

    checklist.push(checkResult);
  }

  // Calculate compliance score (0 - 100)
  const score = totalWeight > 0 ? Math.min(100, Math.round((earnedWeight / totalWeight) * 100)) : 0;

  // Overall status classification
  let status;
  const criticalViolations = violations.filter(v => v.severity === 'critical');
  if (score >= 90 && criticalViolations.length === 0) {
    status = 'compliant';
  } else if (score >= 60 || violations.some(v => v.action === 'Officer Verification Required')) {
    status = 'requires_review';
  } else {
    status = 'potential_non_compliance';
  }

  const passed = checklist.filter(c => c.status === 'compliant').length;
  const warnings = checklist.filter(c => c.status === 'requires_manual_verification').length;
  const failed = checklist.filter(c => c.status === 'potential_non_compliance').length;
  const notDetected = checklist.filter(c => c.status === 'not_detected').length;

  return {
    score,
    status,
    checklist,
    violations,
    summary: generateSummary(score, status, passed, warnings, failed, notDetected),
    total_rules: rules.length,
    passed,
    warnings,
    failed,
    not_detected: notDetected,
    disclaimer: 'AI-Assisted Legal Metrology Screening. Indicative finding only — final legal verification rests with authorized enforcement officer.'
  };
}

function getWeight(severity) {
  switch (severity) {
    case 'critical': return 25;
    case 'major': return 15;
    case 'minor': return 10;
    case 'informational': return 0;
    default: return 10;
  }
}

function generateSummary(score, status, passed, warnings, failed, notDetected) {
  if (status === 'compliant') {
    return `All mandatory declarations were verified. Compliance score: ${score}/100. Product appears compliant with Legal Metrology Rules, 2011.`;
  } else if (status === 'requires_review') {
    return `${passed} declarations verified compliant, ${warnings} field(s) require manual officer verification, ${failed} missing. Compliance score: ${score}/100. Officer review required.`;
  } else {
    return `${failed} mandatory declaration(s) could not be detected. Compliance score: ${score}/100. Potential non-compliance flagged for enforcement review.`;
  }
}

export default { evaluateCompliance };
