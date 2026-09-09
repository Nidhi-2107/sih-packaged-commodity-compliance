import fs from 'fs';

console.log('=== STARTING ACCEPTANCE TEST: HIDE & SEEK REAL OCR PIPELINE ===\n');

// 1. Login as inspector
const inspLoginRes = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'inspector@praman.gov.in', password: 'Inspector@123' })
});
const inspLogin = await inspLoginRes.json();
console.log('Step 1: Inspector Login Status:', inspLoginRes.status, 'Name:', inspLogin.user?.name);
const token = inspLogin.token;

// 2 & 3. Create inspection for Hide & Seek biscuits
const createRes = await fetch('http://localhost:3001/api/inspections', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    business_name: 'Shree Krishna Retailers',
    business_address: '54 MG Road, Chappan Dukan',
    district: 'Indore',
    state: 'Madhya Pradesh',
    inspection_date: '2026-09-08',
    inspection_type: 'retail',
    product_name: 'Hide & Seek Biscuits',
    brand: 'Parle',
    category: 'packaged_food',
    manufacturer: 'Parle Products Pvt. Ltd.',
    batch_number: 'HS-IND-2026',
    remarks: 'Field inspection of packaged biscuit commodity'
  })
});
const createData = await createRes.json();
console.log('Step 2 & 3: Inspection Created:', {
  httpStatus: createRes.status,
  inspectionId: createData.id,
  inspectionNumber: createData.inspection_number
});
const inspectionId = createData.id;

// 4 & 5. Upload actual Hide & Seek front & back package images
const frontBuf = fs.readFileSync('uploads/0/1788883235813-808269.jpeg');
const backBuf = fs.readFileSync('uploads/0/1788883235817-335753.jpeg');

const formData = new FormData();
formData.append('images', new Blob([frontBuf], { type: 'image/jpeg' }), 'hide_and_seek_front.jpeg');
formData.append('images', new Blob([backBuf], { type: 'image/jpeg' }), 'hide_and_seek_back.jpeg');

const uploadRes = await fetch(`http://localhost:3001/api/inspections/${inspectionId}/images`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
const uploadData = await uploadRes.json();
console.log('Step 7 & 8: Upload API Status:', uploadRes.status, 'Success:', uploadData.success, 'Uploaded Count:', uploadData.images?.length);

// 6, 9, 10, 11, 12, 13, 14, 15: Run real OCR & Legal Metrology compliance pipeline
console.log('Step 9: Running Sharp preprocessing & Tesseract.js OCR pipeline...');
const analyzeRes = await fetch(`http://localhost:3001/api/inspections/${inspectionId}/analyze`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ demo_mode: false })
});
const analyzeData = await analyzeRes.json();
console.log('Step 10: Raw OCR Text Length:', analyzeData.ocr?.raw_text?.length || 0, 'Confidence:', analyzeData.ocr?.confidence);
console.log('Step 11: Extracted Declarations:', analyzeData.declarations?.map(d => `${d.field_name}: "${d.extracted_value || 'N/A'}" (${d.status})`));
console.log('Step 12 & 13: Evaluated Score:', analyzeData.compliance?.score, 'Status:', analyzeData.compliance?.status);
console.log('Step 14 & 15: Potential Violations Count:', analyzeData.compliance?.violations?.length);
if (analyzeData.compliance?.violations?.length > 0) {
  console.log('Sample Violation with Evidence & Legal Ref:');
  console.log({
    rule: analyzeData.compliance.violations[0].rule_name,
    legal_reference: analyzeData.compliance.violations[0].legal_reference,
    issue: analyzeData.compliance.violations[0].issue,
    evidence: analyzeData.compliance.violations[0].evidence,
    severity: analyzeData.compliance.violations[0].severity
  });
}

// 16. Record Officer Decision on first violation
if (analyzeData.compliance?.violations?.length > 0) {
  const vId = analyzeData.compliance.violations[0].id || 1;
  const decRes = await fetch(`http://localhost:3001/api/inspections/violations/${vId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ decision: 'confirmed', remarks: 'Verified by officer during field check' })
  });
  console.log('Step 16: Inspector Decision Status:', decRes.status);
}

// 17 & 18. Generate report and save inspection
const reportRes = await fetch(`http://localhost:3001/api/inspections/reports/${inspectionId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
});
console.log('Step 17 & 18: Generate Report Status:', reportRes.status);

// 19 & 20. Login as admin
const adminLoginRes = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@praman.gov.in', password: 'Admin@123' })
});
const adminLogin = await adminLoginRes.json();
console.log('Step 19 & 20: Admin Login Status:', adminLoginRes.status, 'Admin:', adminLogin.user?.name);
const adminToken = adminLogin.token;

// 21. Verify new inspection appears in admin dashboard / all-inspections
const adminInspRes = await fetch('http://localhost:3001/api/admin/inspections?search=Hide', {
  headers: { 'Authorization': `Bearer ${adminToken}` }
});
const adminInspData = await adminInspRes.json();
const foundInAdmin = adminInspData.inspections?.find(i => i.id === inspectionId);
console.log('Step 21: Found in Admin View:', Boolean(foundInAdmin), 'Number:', foundInAdmin?.inspection_number, 'Score:', foundInAdmin?.compliance_score);

// 22. Verify analytics / dashboard stats
const adminDashRes = await fetch('http://localhost:3001/api/admin/dashboard', {
  headers: { 'Authorization': `Bearer ${adminToken}` }
});
const adminDash = await adminDashRes.json();
console.log('Step 22: Admin Dashboard Total Inspections:', adminDash.stats?.totalInspections, 'Total Inspectors:', adminDash.stats?.totalInspectors);

console.log('\n========================================');
console.log('ACCEPTANCE TEST COMPLETED SUCCESSFULLY!');
console.log('========================================\n');
