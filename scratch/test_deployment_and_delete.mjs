import http from 'http';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3001/api';

async function request(urlPath, options = {}) {
  const url = `${BASE_URL}${urlPath}`;
  const res = await fetch(url, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('====================================================');
  console.log('PARAKH DEPLOYMENT HARDENING & DELETE INSPECTION TEST');
  console.log('====================================================\n');

  // 1. Test Inspector Login using @parakh.gov.in
  console.log('1. Testing Inspector login with @parakh.gov.in...');
  const inspLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'inspector@parakh.gov.in', password: 'Inspector@123', role: 'inspector' })
  });
  if (!inspLogin.ok || !inspLogin.data.token) {
    throw new Error(`Inspector login failed: ${JSON.stringify(inspLogin.data)}`);
  }
  const inspToken = inspLogin.data.token;
  const inspUser = inspLogin.data.user;
  console.log(`✓ Inspector logged in successfully: ${inspUser.name} (${inspUser.employee_id})`);

  // 2. Test Admin Login using @parakh.gov.in
  console.log('\n2. Testing Admin login with @parakh.gov.in...');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@parakh.gov.in', password: 'Admin@123', role: 'admin' })
  });
  if (!adminLogin.ok || !adminLogin.data.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
  }
  const adminToken = adminLogin.data.token;
  console.log(`✓ Admin logged in successfully: ${adminLogin.data.user.name}`);

  // 3. Test Legacy Login with @praman.gov.in
  console.log('\n3. Testing backwards compatibility login with @praman.gov.in...');
  const legacyLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'inspector@praman.gov.in', password: 'Inspector@123' })
  });
  if (!legacyLogin.ok || !legacyLogin.data.token) {
    throw new Error(`Legacy login failed: ${JSON.stringify(legacyLogin.data)}`);
  }
  console.log('✓ Legacy login works seamlessly!');

  // 4. Create a test inspection
  console.log('\n4. Creating a new test inspection...');
  const createRes = await request('/inspections', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${inspToken}`
    },
    body: JSON.stringify({
      business_name: 'Test Deployment Mart',
      business_address: '100 Ring Road, Indore, MP',
      district: 'Indore',
      state: 'Madhya Pradesh',
      product_name: 'Deployment Test Biscuit Pack 200g',
      brand: 'TestBrand',
      category: 'packaged_food',
      manufacturer: 'Test FMCG Ltd',
      batch_number: 'DEP-2026-T1',
      inspection_date: '2026-09-10'
    })
  });

  if (!createRes.ok || !createRes.data.id) {
    throw new Error(`Failed to create inspection: ${JSON.stringify(createRes.data)}`);
  }
  const testInspectionId = createRes.data.id;
  const testInspectionNumber = createRes.data.inspection_number;
  console.log(`✓ Created test inspection: ID ${testInspectionId} (${testInspectionNumber})`);

  if (!testInspectionNumber.startsWith('PARAKH-2026-')) {
    console.warn(`Warning: Expected inspection number to start with PARAKH-2026-, got ${testInspectionNumber}`);
  } else {
    console.log(`✓ Verified official inspection prefix is PARAKH-2026-!`);
  }

  // 5. Upload a mock image to create disk storage
  console.log('\n5. Attaching mock package image to test physical storage creation...');
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const dummyJpg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60, 0x00, 0x60, 0x00, 0x00, 0xFF, 0xD9]);
  
  let bodyBuffer = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="front_image"; filename="front_pack.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    dummyJpg,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="image_type"\r\n\r\nfront\r\n--${boundary}--\r\n`)
  ]);

  const uploadRes = await fetch(`${BASE_URL}/inspections/${testInspectionId}/images`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${inspToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: bodyBuffer
  });
  const uploadData = await uploadRes.json();
  console.log(`✓ Image upload response:`, uploadData.message || uploadData);

  const testFolder = path.join(process.cwd(), 'uploads', String(testInspectionId));
  console.log(`✓ Upload folder on disk exists:`, fs.existsSync(testFolder));

  // 6. Test RBAC permissions: Another inspector cannot delete this inspection!
  console.log('\n6. Testing RBAC: Second inspector cannot delete first inspector\'s inspection...');
  const priyaLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'priya.patel@parakh.gov.in', password: 'Inspector@123', role: 'inspector' })
  });
  const priyaToken = priyaLogin.data.token;

  const unauthDelete = await request(`/inspections/${testInspectionId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${priyaToken}` }
  });
  console.log(`✓ Unauthorized delete HTTP status: ${unauthDelete.status} (Expected: 403 Forbidden)`);
  if (unauthDelete.status !== 403) {
    throw new Error(`Expected 403 Forbidden for unauthorized deletion, got ${unauthDelete.status}`);
  }

  // 7. Authorized Inspector deletes their own inspection
  console.log('\n7. Authorized Inspector deleting their own inspection...');
  const authDelete = await request(`/inspections/${testInspectionId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${inspToken}` }
  });
  if (!authDelete.ok || !authDelete.data.success) {
    throw new Error(`Authorized delete failed: ${JSON.stringify(authDelete.data)}`);
  }
  console.log(`✓ Authorized delete succeeded: ${authDelete.data.message}`);

  // 8. Verify database removal
  console.log('\n8. Verifying database record is removed...');
  const checkInsp = await request(`/inspections/${testInspectionId}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${inspToken}` }
  });
  console.log(`✓ Fetch deleted inspection HTTP status: ${checkInsp.status} (Expected: 404 Not Found)`);
  if (checkInsp.status !== 404) {
    throw new Error(`Expected 404 for deleted inspection, got ${checkInsp.status}`);
  }

  // 9. Verify physical storage cleanup
  console.log('\n9. Verifying physical folder cleanup on disk...');
  const folderStillExists = fs.existsSync(testFolder);
  console.log(`✓ Physical folder deleted: ${!folderStillExists}`);
  if (folderStillExists) {
    throw new Error(`Physical folder ${testFolder} was not cleaned up!`);
  }

  // 10. Verify Audit Log entry
  console.log('\n10. Verifying audit log entry for DELETE_INSPECTION...');
  const auditRes = await request('/admin/audit-logs?limit=5', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const logs = auditRes.data.logs || [];
  const deleteLog = logs.find(l => l.action === 'DELETE_INSPECTION' && Number(l.entity_id) === Number(testInspectionId));
  if (!deleteLog) {
    throw new Error(`Could not find DELETE_INSPECTION entry in audit_logs! Found logs: ${JSON.stringify(logs)}`);
  }
  console.log(`✓ Audit log verified:`, {
    user: deleteLog.user_name,
    action: deleteLog.action,
    entity_id: deleteLog.entity_id,
    details: deleteLog.details,
    timestamp: deleteLog.timestamp
  });

  console.log('\n====================================================');
  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
