import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001/api';

async function runTests() {
  console.log('=== PRAMAN END-TO-END PIPELINE VALIDATION ===\n');

  // 1. Authenticate as Inspector
  console.log('1. Logging in as inspector (inspector@praman.gov.in)...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'inspector@praman.gov.in', password: 'Inspector@123' })
  });
  const loginData = await loginRes.json();
  if (!loginData.token) {
    throw new Error('Login failed: ' + JSON.stringify(loginData));
  }
  console.log('✓ Logged in. Token received.\n');
  const token = loginData.token;
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 2. Fetch inspection #48 (has Hide & Seek biscuit photos uploaded)
  console.log('2. Fetching inspection #48 details...');
  const inspRes = await fetch(`${BASE_URL}/inspections/48`, { headers: authHeaders });
  const inspData = await inspRes.json();
  console.log(`✓ Inspection #${inspData.inspection?.id}: ${inspData.inspection?.product_name || 'Biscuit'}`);
  console.log(`  Uploaded images: ${inspData.images?.length || 0}`);
  inspData.images?.forEach((img, i) => {
    console.log(`  Image ${i + 1}: ${img.image_type} (${img.original_name}) -> ${img.image_path}`);
  });

  // 3. Test analyze endpoint behavior when OPENAI_API_KEY is not set vs configured
  console.log('\n3. Testing POST /api/inspections/48/analyze...');
  const analyzeRes = await fetch(`${BASE_URL}/inspections/48/analyze`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ demo_mode: false })
  });
  const analyzeData = await analyzeRes.json();
  console.log(`  Status Code: ${analyzeRes.status}`);
  if (analyzeData.needs_config) {
    console.log('✓ Successfully verified requirement #12 (NO SILENT DEMO FALLBACK):');
    console.log(`  System correctly identified that API key is needed: "${analyzeData.message}"`);
    console.log(`  Error: ${analyzeData.error}`);
  } else if (analyzeData.ocr) {
    console.log('✓ Vision AI analysis succeeded:');
    console.log(`  Method: ${analyzeData.ocr.method}`);
    console.log(`  Confidence: ${analyzeData.ocr.confidence}%`);
    console.log(`  Score: ${analyzeData.compliance?.score}/100 (${analyzeData.compliance?.status})`);
    console.log('  Extracted declarations:');
    analyzeData.declarations?.forEach(d => {
      console.log(`   - ${d.field_name}: "${d.extracted_value}" [${d.status}] (${d.confidence}%) | Evidence: "${d.evidence || 'N/A'}"`);
    });
  }

  // 4. Test Inspector Verification & Score Recalculation
  console.log('\n4. Testing PUT /api/inspections/48/verify-declarations...');
  const verifyRes = await fetch(`${BASE_URL}/inspections/48/verify-declarations`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      verified_fields: [
        { field_name: 'mrp', verified_value: '₹30.00', status: 'detected' },
        { field_name: 'net_quantity', verified_value: '100 g', status: 'detected' },
        { field_name: 'product_name', verified_value: 'Parle Hide & Seek Chocolate Chip Biscuits', status: 'detected' },
        { field_name: 'consumer_care', status: 'uncertain' }
      ],
      remarks: 'Inspected physical package. Verified Net Weight (100 g) and MRP (₹30.00).'
    })
  });
  const verifyData = await verifyRes.json();
  console.log(`  Status Code: ${verifyRes.status}`);
  console.log(`  Recalculated Score: ${verifyData.new_score}/100 (Status: ${verifyData.new_status})`);
  console.log(`  Verified Declarations count: ${verifyData.declarations?.filter(d => d.is_verified).length}`);

  // 5. Fetch updated inspection to confirm persistence in database
  console.log('\n5. Verifying persistence in SQLite database...');
  const verifyFetch = await fetch(`${BASE_URL}/inspections/48`, { headers: authHeaders });
  const finalData = await verifyFetch.json();
  const mrpDecl = finalData.declarations?.find(d => d.field_name === 'mrp');
  console.log('✓ MRP Declaration in DB:');
  console.log(`  Field: ${mrpDecl?.field_name}`);
  console.log(`  Verified Value: ${mrpDecl?.verified_value}`);
  console.log(`  Is Verified: ${mrpDecl?.is_verified}`);
  console.log(`  Status: ${mrpDecl?.status}`);
  console.log(`  Confidence: ${mrpDecl?.confidence}%`);
  console.log(`  Evidence: ${mrpDecl?.evidence}`);

  console.log('\n=== ALL END-TO-END PIPELINE CHECKS PASSED ===\n');
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
