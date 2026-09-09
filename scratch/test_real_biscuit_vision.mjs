import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3001/api';

async function testRealBiscuitAnalysis() {
  console.log('=== REAL BISCUIT PACKAGING VISION AI TEST ===\n');

  // 1. Login
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'inspector@praman.gov.in', password: 'Inspector@123' })
  });
  const { token } = await loginRes.json();
  const authHeaders = { 'Authorization': `Bearer ${token}` };

  // 2. Create an inspection for Parle Hide & Seek
  console.log('Creating inspection for Parle Hide & Seek Chocolate Chip Biscuits...');
  const createRes = await fetch(`${BASE_URL}/inspections`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: 'Metro Cash & Carry India Pvt Ltd',
      business_address: 'Sector 54, Industrial Area',
      district: 'Indore',
      state: 'Madhya Pradesh',
      inspection_date: new Date().toISOString().split('T')[0],
      inspection_type: 'retail',
      product_name: 'Hide & Seek Chocolate Chip Biscuits',
      brand: 'Parle',
      category: 'biscuits',
      manufacturer: 'Parle Products Pvt. Ltd.'
    })
  });
  const createData = await createRes.json();
  const inspId = createData.id;
  console.log(`✓ Inspection created with ID: #${inspId} (${createData.inspection_number})\n`);

  // 3. Attach the real biscuit package images from uploads/0/
  console.log('Attaching real biscuit packaging images (Front & Back panels)...');
  const frontImgPath = path.join(process.cwd(), 'uploads/0/1788883235813-808269.jpeg');
  const backImgPath = path.join(process.cwd(), 'uploads/0/1788883235817-335753.jpeg');
  const sideImgPath = path.join(process.cwd(), 'uploads/0/1788883235822-199659.jpeg');

  const form = new FormData();
  if (fs.existsSync(frontImgPath)) {
    form.append('images', new Blob([fs.readFileSync(frontImgPath)], { type: 'image/jpeg' }), 'front_panel.jpeg');
  }
  if (fs.existsSync(backImgPath)) {
    form.append('images', new Blob([fs.readFileSync(backImgPath)], { type: 'image/jpeg' }), 'back_panel.jpeg');
  }
  if (fs.existsSync(sideImgPath)) {
    form.append('images', new Blob([fs.readFileSync(sideImgPath)], { type: 'image/jpeg' }), 'side_panel.jpeg');
  }
  form.append('image_type', 'front');

  const uploadRes = await fetch(`${BASE_URL}/inspections/${inspId}/images`, {
    method: 'POST',
    headers: { ...authHeaders },
    body: form
  });
  const uploadData = await uploadRes.json();
  console.log(`✓ Uploaded ${uploadData.images?.length || 0} real packaging photo(s).\n`);

  // 4. Run Vision AI analysis
  console.log('Triggering Vision AI Analysis via POST /api/inspections/:id/analyze...');
  const analyzeRes = await fetch(`${BASE_URL}/inspections/${inspId}/analyze`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ demo_mode: false })
  });
  const analyzeData = await analyzeRes.json();

  if (analyzeData.needs_config) {
    console.log('\n[NOTICE] Gemini API Key needs configuration in .env:');
    console.log(analyzeData.message);
    console.log('To run against live Google Gemini Vision models, set your key in .env:');
    console.log('  GEMINI_API_KEY=AIza...');
    return;
  }

  console.log('\n✓ AI Vision Analysis Result:');
  console.log(`  Model / Method: ${analyzeData.ocr?.method}`);
  console.log(`  Overall Confidence: ${analyzeData.ocr?.confidence}%`);
  console.log(`  Compliance Score: ${analyzeData.compliance?.score}/100`);
  console.log(`  Compliance Status: ${analyzeData.compliance?.status}`);
  console.log('\n  Extracted Declarations:');
  analyzeData.declarations?.forEach(d => {
    console.log(`   - [${d.status.toUpperCase()}] ${d.field_name}: "${d.extracted_value}" (${d.confidence}%)`);
    if (d.evidence) console.log(`     Evidence: "${d.evidence}" (Source: ${d.source_image || 'photo'})`);
  });
}

testRealBiscuitAnalysis().catch(console.error);
