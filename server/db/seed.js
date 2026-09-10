import {
  initDb,
  getDb,
  saveDb,
  closeDb
} from './database.js';

import bcryptjs from 'bcryptjs';

const { hashSync } = bcryptjs;

/**
 * Seed the database with demo data.
 *
 * IMPORTANT:
 * - Safe to run multiple times.
 * - Does NOT remove existing data.
 * - Does NOT remove UNIQUE constraints.
 * - Uses INSERT OR IGNORE for seeded records where appropriate.
 * - Detects an existing demo installation before inserting the full dataset.
 */
export async function seedDatabase() {
  await initDb();

  const db = getDb();

  // ============================================================
  // CREATE SCHEMA
  // ============================================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('inspector', 'admin')),
      employee_id TEXT UNIQUE,
      department TEXT DEFAULT 'Legal Metrology',
      district TEXT,
      state TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      district TEXT,
      state TEXT,
      contact TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      brand TEXT,
      category TEXT,
      manufacturer TEXT,
      batch_number TEXT,
      sku TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_number TEXT UNIQUE NOT NULL,
      inspector_id INTEGER NOT NULL,
      business_id INTEGER,
      product_id INTEGER,
      inspection_date TEXT NOT NULL,
      inspection_type TEXT DEFAULT 'retail',
      district TEXT,
      state TEXT,
      latitude REAL,
      longitude REAL,
      compliance_score REAL,
      status TEXT DEFAULT 'in_progress'
        CHECK(status IN (
          'in_progress',
          'compliant',
          'requires_review',
          'potential_non_compliance'
        )),
      remarks TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (inspector_id) REFERENCES users(id),
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS inspection_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      image_type TEXT DEFAULT 'front',
      original_name TEXT,
      uploaded_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (inspection_id) REFERENCES inspections(id)
    );

    CREATE TABLE IF NOT EXISTS ocr_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id INTEGER NOT NULL,
      image_id INTEGER,
      raw_text TEXT,
      ocr_confidence REAL,
      ocr_method TEXT DEFAULT 'tesseract',
      processing_time_ms INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (inspection_id) REFERENCES inspections(id),
      FOREIGN KEY (image_id) REFERENCES inspection_images(id)
    );

    CREATE TABLE IF NOT EXISTS declarations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      extracted_value TEXT,
      confidence REAL,
      status TEXT DEFAULT 'detected'
        CHECK(status IN ('detected', 'missing', 'uncertain')),
      source_image_id INTEGER,
      is_informational INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (inspection_id) REFERENCES inspections(id)
    );

    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      legal_reference TEXT,
      category TEXT DEFAULT 'packaged_food',
      field_name TEXT NOT NULL,
      required INTEGER DEFAULT 1,
      severity TEXT DEFAULT 'major'
        CHECK(severity IN (
          'critical',
          'major',
          'minor',
          'informational'
        )),
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS violations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id INTEGER NOT NULL,
      rule_id INTEGER,
      declaration_id INTEGER,
      description TEXT,
      severity TEXT DEFAULT 'major',
      confidence REAL,
      status TEXT DEFAULT 'pending'
        CHECK(status IN (
          'pending',
          'confirmed',
          'dismissed',
          'manual_review'
        )),
      evidence_image_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (inspection_id) REFERENCES inspections(id),
      FOREIGN KEY (rule_id) REFERENCES rules(id)
    );

    CREATE TABLE IF NOT EXISTS officer_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      violation_id INTEGER NOT NULL,
      officer_id INTEGER NOT NULL,
      decision TEXT NOT NULL
        CHECK(decision IN (
          'confirmed',
          'dismissed',
          'manual_review'
        )),
      remarks TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (violation_id) REFERENCES violations(id),
      FOREIGN KEY (officer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id INTEGER NOT NULL,
      report_data TEXT,
      generated_at TEXT DEFAULT (datetime('now')),
      generated_by INTEGER,
      FOREIGN KEY (inspection_id) REFERENCES inspections(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      ip_address TEXT,
      timestamp TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_inspections_inspector
      ON inspections(inspector_id);

    CREATE INDEX IF NOT EXISTS idx_inspections_status
      ON inspections(status);

    CREATE INDEX IF NOT EXISTS idx_inspections_date
      ON inspections(inspection_date);

    CREATE INDEX IF NOT EXISTS idx_violations_inspection
      ON violations(inspection_id);

    CREATE INDEX IF NOT EXISTS idx_violations_status
      ON violations(status);

    CREATE INDEX IF NOT EXISTS idx_declarations_inspection
      ON declarations(inspection_id);

    CREATE INDEX IF NOT EXISTS idx_audit_logs_user
      ON audit_logs(user_id);

    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp
      ON audit_logs(timestamp);
  `);

  console.log('Schema created.');

  // ============================================================
  // CHECK WHETHER DEMO DATABASE IS ALREADY SEEDED
  // ============================================================

  let alreadySeeded = false;

  try {
    const result = db.exec(`
      SELECT COUNT(*) AS count
      FROM users
      WHERE email = 'admin@praman.gov.in'
    `);

    if (
      result.length > 0 &&
      result[0].values.length > 0 &&
      Number(result[0].values[0][0]) > 0
    ) {
      alreadySeeded = true;
    }
  } catch (error) {
    console.warn(
      'Could not check existing seed state:',
      error.message
    );
  }

  if (alreadySeeded) {
    console.log(
      'Demo database already seeded. Skipping demo data insertion.'
    );

    // Still make sure required rules exist.
    // This protects against a database that was partially seeded
    // before a previous deployment failed.
    const requiredRules = [
      [
        'LMPC-001',
        'Name of Commodity',
        'The package must bear the name or description of the commodity contained in it.',
        'Legal Metrology (Packaged Commodities) Rules, 2011',
        'packaged_food',
        'product_name',
        1,
        'critical'
      ],
      [
        'LMPC-002',
        'Net Quantity',
        'Every package must declare the net quantity of the commodity in standard units of weight, measure or number.',
        'Legal Metrology (Packaged Commodities) Rules, 2011',
        'packaged_food',
        'net_quantity',
        1,
        'critical'
      ],
      [
        'LMPC-003',
        'Maximum Retail Price (MRP)',
        'The retail sale price of the package must be declared as the Maximum Retail Price inclusive of all taxes.',
        'Legal Metrology (Packaged Commodities) Rules, 2011',
        'packaged_food',
        'mrp',
        1,
        'critical'
      ],
      [
        'LMPC-004',
        'Manufacturer/Packer/Importer Name',
        'The name of the manufacturer or packer or importer must be declared on the package.',
        'Legal Metrology (Packaged Commodities) Rules, 2011',
        'packaged_food',
        'manufacturer_name',
        1,
        'critical'
      ],
      [
        'LMPC-005',
        'Manufacturer/Packer/Importer Address',
        'The complete address of the manufacturer or packer or importer must be declared on the package.',
        'Legal Metrology (Packaged Commodities) Rules, 2011',
        'packaged_food',
        'manufacturer_address',
        1,
        'major'
      ],
      [
        'LMPC-006',
        'Month and Year of Manufacture/Packing/Import',
        'The month and year in which the commodity is manufactured or packed or imported must be mentioned on the package.',
        'Legal Metrology (Packaged Commodities) Rules, 2011',
        'packaged_food',
        'date_of_manufacture',
        1,
        'major'
      ],
      [
        'LMPC-007',
        'Consumer Care Information',
        'The name, address, telephone number and e-mail address of the person or office who can be contacted in case of consumer complaint must be declared.',
        'Legal Metrology (Packaged Commodities) Rules, 2011',
        'packaged_food',
        'consumer_care',
        1,
        'major'
      ],
      [
        'LMPC-008',
        'Common or Generic Name',
        'Where the commodity has a common or generic name, such name must be mentioned on the package.',
        'Legal Metrology (Packaged Commodities) Rules, 2011',
        'packaged_food',
        'generic_name',
        1,
        'minor'
      ],
      [
        'LMPC-009',
        'Country of Origin (Imported Goods)',
        'If the commodity is imported, the country of origin must be mentioned on the package.',
        'Legal Metrology (Packaged Commodities) Rules, 2011',
        'packaged_food',
        'country_of_origin',
        0,
        'minor'
      ],
      [
        'LMPC-010',
        'Best Before or Expiry Date',
        'For human food packages, the best before date/period or use-by/expiry date must be declared on the package.',
        'Legal Metrology (Packaged Commodities) Rules, 2011 - Rule 6(1)(d)',
        'packaged_food',
        'best_before',
        1,
        'major'
      ]
    ];

    for (const rule of requiredRules) {
      db.run(
        `
        INSERT OR IGNORE INTO rules
        (
          rule_code,
          name,
          description,
          legal_reference,
          category,
          field_name,
          required,
          severity,
          active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `,
        rule
      );
    }

    saveDb();

    console.log('Required rules verified.');

    return;
  }

  // ============================================================
  // PASSWORD HASHING
  // ============================================================

  const hash = (password) => hashSync(password, 10);

  // ============================================================
  // USERS
  // ============================================================

  const users = [
    [
      'Admin Officer',
      'admin@praman.gov.in',
      hash('Admin@123'),
      'admin',
      'LM-ADM-001',
      'Legal Metrology HQ',
      'Bhopal',
      'Madhya Pradesh'
    ],
    [
      'Raj Sharma',
      'inspector@praman.gov.in',
      hash('Inspector@123'),
      'inspector',
      'LM-1042',
      'Legal Metrology',
      'Indore',
      'Madhya Pradesh'
    ],
    [
      'Priya Patel',
      'priya.patel@praman.gov.in',
      hash('Inspector@123'),
      'inspector',
      'LM-1043',
      'Legal Metrology',
      'Bhopal',
      'Madhya Pradesh'
    ],
    [
      'Amit Verma',
      'amit.verma@praman.gov.in',
      hash('Inspector@123'),
      'inspector',
      'LM-1044',
      'Legal Metrology',
      'Ujjain',
      'Madhya Pradesh'
    ],
    [
      'Sunita Devi',
      'sunita.devi@praman.gov.in',
      hash('Inspector@123'),
      'inspector',
      'LM-1045',
      'Legal Metrology',
      'Jabalpur',
      'Madhya Pradesh'
    ],
    [
      'Vikram Singh',
      'vikram.singh@praman.gov.in',
      hash('Inspector@123'),
      'inspector',
      'LM-1046',
      'Legal Metrology',
      'Gwalior',
      'Madhya Pradesh'
    ],
    [
      'Neha Gupta',
      'neha.gupta@praman.gov.in',
      hash('Inspector@123'),
      'inspector',
      'LM-1047',
      'Legal Metrology',
      'Indore',
      'Madhya Pradesh'
    ],
    [
      'Rohit Joshi',
      'rohit.joshi@praman.gov.in',
      hash('Inspector@123'),
      'inspector',
      'LM-1048',
      'Legal Metrology',
      'Bhopal',
      'Madhya Pradesh'
    ],
    [
      'Kavita Mishra',
      'kavita.mishra@praman.gov.in',
      hash('Inspector@123'),
      'inspector',
      'LM-1049',
      'Legal Metrology',
      'Ujjain',
      'Madhya Pradesh'
    ],
    [
      'Deepak Kumar',
      'deepak.kumar@praman.gov.in',
      hash('Inspector@123'),
      'inspector',
      'LM-1050',
      'Legal Metrology',
      'Jabalpur',
      'Madhya Pradesh'
    ],
    [
      'Anita Yadav',
      'anita.yadav@praman.gov.in',
      hash('Inspector@123'),
      'inspector',
      'LM-1051',
      'Legal Metrology',
      'Gwalior',
      'Madhya Pradesh'
    ]
  ];

  for (const u of users) {
    db.run(
      `
      INSERT OR IGNORE INTO users
      (
        name,
        email,
        password_hash,
        role,
        employee_id,
        department,
        district,
        state,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [...u, 'active']
    );
  }

  console.log('Users seeded.');

  // ============================================================
  // COMPLIANCE RULES
  // ============================================================

  const rules = [
    [
      'LMPC-001',
      'Name of Commodity',
      'The package must bear the name or description of the commodity contained in it.',
      'Legal Metrology (Packaged Commodities) Rules, 2011',
      'packaged_food',
      'product_name',
      1,
      'critical'
    ],
    [
      'LMPC-002',
      'Net Quantity',
      'Every package must declare the net quantity of the commodity in standard units of weight, measure or number.',
      'Legal Metrology (Packaged Commodities) Rules, 2011',
      'packaged_food',
      'net_quantity',
      1,
      'critical'
    ],
    [
      'LMPC-003',
      'Maximum Retail Price (MRP)',
      'The retail sale price of the package must be declared as the Maximum Retail Price inclusive of all taxes.',
      'Legal Metrology (Packaged Commodities) Rules, 2011',
      'packaged_food',
      'mrp',
      1,
      'critical'
    ],
    [
      'LMPC-004',
      'Manufacturer/Packer/Importer Name',
      'The name of the manufacturer or packer or importer must be declared on the package.',
      'Legal Metrology (Packaged Commodities) Rules, 2011',
      'packaged_food',
      'manufacturer_name',
      1,
      'critical'
    ],
    [
      'LMPC-005',
      'Manufacturer/Packer/Importer Address',
      'The complete address of the manufacturer or packer or importer must be declared on the package.',
      'Legal Metrology (Packaged Commodities) Rules, 2011',
      'packaged_food',
      'manufacturer_address',
      1,
      'major'
    ],
    [
      'LMPC-006',
      'Month and Year of Manufacture/Packing/Import',
      'The month and year in which the commodity is manufactured or packed or imported must be mentioned on the package.',
      'Legal Metrology (Packaged Commodities) Rules, 2011',
      'packaged_food',
      'date_of_manufacture',
      1,
      'major'
    ],
    [
      'LMPC-007',
      'Consumer Care Information',
      'The name, address, telephone number and e-mail address of the person or office who can be contacted in case of consumer complaint must be declared.',
      'Legal Metrology (Packaged Commodities) Rules, 2011',
      'packaged_food',
      'consumer_care',
      1,
      'major'
    ],
    [
      'LMPC-008',
      'Common or Generic Name',
      'Where the commodity has a common or generic name, such name must be mentioned on the package.',
      'Legal Metrology (Packaged Commodities) Rules, 2011',
      'packaged_food',
      'generic_name',
      1,
      'minor'
    ],
    [
      'LMPC-009',
      'Country of Origin (Imported Goods)',
      'If the commodity is imported, the country of origin must be mentioned on the package.',
      'Legal Metrology (Packaged Commodities) Rules, 2011',
      'packaged_food',
      'country_of_origin',
      0,
      'minor'
    ],
    [
      'LMPC-010',
      'Best Before or Expiry Date',
      'For human food packages, the best before date/period or use-by/expiry date must be declared on the package.',
      'Legal Metrology (Packaged Commodities) Rules, 2011 - Rule 6(1)(d)',
      'packaged_food',
      'best_before',
      1,
      'major'
    ]
  ];

  for (const r of rules) {
    db.run(
      `
      INSERT OR IGNORE INTO rules
      (
        rule_code,
        name,
        description,
        legal_reference,
        category,
        field_name,
        required,
        severity,
        active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `,
      r
    );
  }

  console.log('Rules seeded.');

  // ============================================================
  // BUSINESSES
  // ============================================================

  const businesses = [
    [
      'ABC Demo Retail Mart',
      'Shop 12, Rajwada Market, MG Road',
      'Indore',
      'Madhya Pradesh',
      '0731-2345678'
    ],
    [
      'Sharma General Store',
      '45 Nehru Nagar, Arera Colony',
      'Bhopal',
      'Madhya Pradesh',
      '0755-4567890'
    ],
    [
      'Gupta Kirana & Provisions',
      '23 Freeganj Road',
      'Ujjain',
      'Madhya Pradesh',
      '0734-2345678'
    ],
    [
      'Singh Supermarket',
      '67 Civil Lines',
      'Jabalpur',
      'Madhya Pradesh',
      '0761-3456789'
    ],
    [
      'Patel Groceries',
      '89 Lashkar Area',
      'Gwalior',
      'Madhya Pradesh',
      '0751-2345678'
    ],
    [
      'Metro Fresh Mart',
      'AB Road, Vijay Nagar',
      'Indore',
      'Madhya Pradesh',
      '0731-9876543'
    ],
    [
      'Devi Provisions',
      '12 Kolar Road',
      'Bhopal',
      'Madhya Pradesh',
      '0755-1234567'
    ],
    [
      'Krishna General Store',
      '56 Tower Chowk',
      'Ujjain',
      'Madhya Pradesh',
      '0734-9876543'
    ],
    [
      'Bajrang Kirana',
      '34 Madan Mahal Road',
      'Jabalpur',
      'Madhya Pradesh',
      '0761-1234567'
    ],
    [
      'Jai Hind Supermart',
      '78 Maharaj Bada',
      'Gwalior',
      'Madhya Pradesh',
      '0751-9876543'
    ]
  ];

  for (const b of businesses) {
    db.run(
      `
      INSERT INTO businesses
      (name, address, district, state, contact)
      VALUES (?, ?, ?, ?, ?)
      `,
      b
    );
  }

  console.log('Businesses seeded.');

  // ============================================================
  // PRODUCTS
  // ============================================================

  const products = [
    [
      'Sample Premium Rice',
      'ABC Premium',
      'rice',
      'ABC Foods Pvt Ltd',
      'BATCH-2026-06-A1'
    ],
    [
      'Premium Basmati Rice',
      'Golden Harvest',
      'rice',
      'Golden Harvest Agro Pvt Ltd',
      'GH-2026-05-R12'
    ],
    [
      'Whole Wheat Flour',
      'Aashirvaad',
      'flour',
      'ITC Limited',
      'AASH-2026-04-W45'
    ],
    [
      'Multigrain Atta',
      'Pillsbury',
      'flour',
      'General Mills India Pvt Ltd',
      'PIL-2026-03-M67'
    ],
    [
      'Cream Biscuits',
      'Parle',
      'biscuits',
      'Parle Products Pvt Ltd',
      'PAR-2026-07-C89'
    ],
    [
      'Glucose Biscuits',
      'Britannia',
      'biscuits',
      'Britannia Industries Ltd',
      'BRI-2026-06-G23'
    ],
    [
      'Masala Chips',
      'Haldiram',
      'snacks',
      'Haldiram Foods International',
      'HAL-2026-05-S34'
    ],
    [
      'Aloo Bhujia',
      'Bikaji',
      'snacks',
      'Bikaji Foods International Ltd',
      'BIK-2026-04-A56'
    ],
    [
      'Toor Dal',
      'Tata Sampann',
      'pulses',
      'Tata Consumer Products Ltd',
      'TAT-2026-06-D78'
    ],
    [
      'Moong Dal',
      'Fortune',
      'pulses',
      'Adani Wilmar Ltd',
      'FOR-2026-05-D90'
    ],
    [
      'Crystal Sugar',
      'Madhur',
      'sugar',
      'DSCL Sugar',
      'MAD-2026-07-S12'
    ],
    [
      'Organic Jaggery',
      'Organic Tattva',
      'sugar',
      'Organic Tattva Pvt Ltd',
      'ORT-2026-03-J34'
    ],
    [
      'Turmeric Powder',
      'MDH',
      'spices',
      'MDH Limited',
      'MDH-2026-06-T56'
    ],
    [
      'Garam Masala',
      'Everest',
      'spices',
      'Everest Food Products Pvt Ltd',
      'EVR-2026-05-G78'
    ],
    [
      'Red Chilli Powder',
      'Catch',
      'spices',
      'DS Group',
      'CAT-2026-04-R90'
    ],
    [
      'Mustard Oil',
      'Fortune',
      'other_packaged_food',
      'Adani Wilmar Ltd',
      'FOR-2026-06-O12'
    ],
    [
      'Refined Sunflower Oil',
      'Saffola',
      'other_packaged_food',
      'Marico Ltd',
      'SAF-2026-05-O34'
    ],
    [
      'Instant Noodles',
      'Maggi',
      'snacks',
      'Nestle India Ltd',
      'MAG-2026-07-N56'
    ],
    [
      'Pickle Mix',
      'Mothers Recipe',
      'other_packaged_food',
      'Desai Brothers Ltd',
      'MOR-2026-04-P78'
    ],
    [
      'Peanut Butter',
      'Sundrop',
      'other_packaged_food',
      'Agro Tech Foods Ltd',
      'SUN-2026-06-P90'
    ]
  ];

  for (const p of products) {
    db.run(
      `
      INSERT INTO products
      (name, brand, category, manufacturer, batch_number)
      VALUES (?, ?, ?, ?, ?)
      `,
      p
    );
  }

  console.log('Products seeded.');

  // ============================================================
  // INSPECTIONS
  // ============================================================

  const districts = [
    'Indore',
    'Bhopal',
    'Ujjain',
    'Jabalpur',
    'Gwalior'
  ];

  const types = [
    'retail',
    'manufacturing',
    'warehouse',
    'ecommerce'
  ];

  const seededRandom = (i, max) =>
    ((i * 7 + 13) % max);

  for (let i = 1; i <= 42; i++) {
    const inspectorId = (i % 10) + 2;
    const businessId = (i % 10) + 1;
    const productId = (i % 20) + 1;
    const district = districts[i % 5];

    const score =
      50 + seededRandom(i, 50);

    let status;

    if (score >= 90) {
      status = 'compliant';
    } else if (score >= 70) {
      status = 'requires_review';
    } else {
      status = 'potential_non_compliance';
    }

    const type =
      types[i % 4];

    const month =
      String((i % 8) + 1).padStart(2, '0');

    const day =
      String((i % 28) + 1).padStart(2, '0');

    const dateStr =
      `2026-${month}-${day}`;

    const remark =
      i === 1
        ? 'Demo inspection — Sample Premium Rice'
        : `Routine ${type} inspection`;

    db.run(
      `
      INSERT INTO inspections
      (
        inspection_number,
        inspector_id,
        business_id,
        product_id,
        inspection_date,
        inspection_type,
        district,
        state,
        compliance_score,
        status,
        remarks,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        `PRAMAN-2026-${String(i).padStart(4, '0')}`,
        inspectorId,
        businessId,
        productId,
        dateStr,
        type,
        district,
        'Madhya Pradesh',
        score,
        status,
        remark,
        dateStr,
        dateStr
      ]
    );
  }

  console.log('Inspections seeded.');

  // ============================================================
  // DECLARATIONS
  // ============================================================

  const productNames =
    products.map(p => p[0]);

  const manufacturers =
    products.map(p => p[3]);

  const addresses = [
    'Indore, Madhya Pradesh',
    'Mumbai, Maharashtra',
    'New Delhi',
    'Noida, Uttar Pradesh',
    'Bhopal, Madhya Pradesh'
  ];

  const months = [
    'January 2026',
    'February 2026',
    'March 2026',
    'April 2026',
    'May 2026',
    'June 2026'
  ];

  const quantities = [
    '1 kg',
    '5 kg',
    '500 g',
    '200 g',
    '250 g'
  ];

  for (let insId = 1; insId <= 42; insId++) {
    const pIdx =
      (insId - 1) % 20;

    const lmDecls = [
      [
        'product_name',
        productNames[pIdx],
        92 + seededRandom(insId, 7),
        'detected',
        0
      ],
      [
        'net_quantity',
        quantities[insId % 5],
        90 + seededRandom(insId, 9),
        'detected',
        0
      ],
      [
        'mrp',
        `₹${100 + (insId * 17) % 400}`,
        88 + seededRandom(insId, 11),
        'detected',
        0
      ],
      [
        'manufacturer_name',
        manufacturers[pIdx],
        90 + seededRandom(insId, 8),
        'detected',
        0
      ],
      [
        'manufacturer_address',
        addresses[insId % 5],
        85 + seededRandom(insId, 12),
        'detected',
        0
      ],
      [
        'date_of_manufacture',
        months[insId % 6],
        83 + seededRandom(insId, 14),
        'detected',
        0
      ],
      [
        'consumer_care',
        insId % 5 === 0
          ? ''
          : '1800-XXX-XXXX',
        insId % 5 === 0
          ? 0
          : 87 + seededRandom(insId, 10),
        insId % 5 === 0
          ? 'missing'
          : 'detected',
        0
      ],
      [
        'generic_name',
        productNames[pIdx],
        insId % 7 === 0
          ? 45 + seededRandom(insId, 20)
          : 88 + seededRandom(insId, 10),
        insId % 7 === 0
          ? 'uncertain'
          : 'detected',
        0
      ]
    ];

    const infoDecls = [
      [
        'fssai_license',
        insId % 4 === 0
          ? ''
          : `${10000000 + insId * 12345}`,
        insId % 4 === 0
          ? 0
          : 85 + seededRandom(insId, 12),
        insId % 4 === 0
          ? 'missing'
          : 'detected',
        1
      ],
      [
        'ingredients',
        insId % 3 === 0
          ? 'Partially readable'
          : 'See package label',
        insId % 3 === 0
          ? 50 + seededRandom(insId, 20)
          : 80 + seededRandom(insId, 15),
        insId % 3 === 0
          ? 'uncertain'
          : 'detected',
        1
      ]
    ];

    for (const d of [
      ...lmDecls,
      ...infoDecls
    ]) {
      db.run(
        `
        INSERT INTO declarations
        (
          inspection_id,
          field_name,
          extracted_value,
          confidence,
          status,
          is_informational
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          insId,
          ...d
        ]
      );
    }
  }

  console.log('Declarations seeded.');

  // ============================================================
  // VIOLATIONS
  // ============================================================

  let violationCount = 0;

  for (let insId = 1; insId <= 42; insId++) {
    const inspectorId =
      ((insId - 1) % 10) + 2;

    const month =
      String((insId % 8) + 1).padStart(2, '0');

    const day =
      String((insId % 28) + 1).padStart(2, '0');

    const dateStr =
      `2026-${month}-${day}`;

    if (insId % 5 === 0) {
      violationCount++;

      const vStatus =
        insId % 2 === 0
          ? 'confirmed'
          : 'pending';

      db.run(
        `
        INSERT INTO violations
        (
          inspection_id,
          rule_id,
          description,
          severity,
          confidence,
          status,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          insId,
          7,
          'Consumer care information could not be detected in the submitted package images.',
          'major',
          94,
          vStatus,
          dateStr
        ]
      );

      if (vStatus === 'confirmed') {
        db.run(
          `
          INSERT INTO officer_decisions
          (
            violation_id,
            officer_id,
            decision,
            remarks,
            created_at
          )
          VALUES (?, ?, ?, ?, ?)
          `,
          [
            violationCount,
            inspectorId,
            'confirmed',
            'Verified — consumer care details not present on label.',
            dateStr
          ]
        );
      }
    }

    if (insId % 7 === 0) {
      violationCount++;

      const vStatus =
        insId % 3 === 0
          ? 'dismissed'
          : 'pending';

      db.run(
        `
        INSERT INTO violations
        (
          inspection_id,
          rule_id,
          description,
          severity,
          confidence,
          status,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          insId,
          8,
          'Common or generic name of the commodity could not be clearly identified.',
          'minor',
          62,
          vStatus,
          dateStr
        ]
      );

      if (vStatus === 'dismissed') {
        db.run(
          `
          INSERT INTO officer_decisions
          (
            violation_id,
            officer_id,
            decision,
            remarks,
            created_at
          )
          VALUES (?, ?, ?, ?, ?)
          `,
          [
            violationCount,
            inspectorId,
            'dismissed',
            'Generic name is present but OCR was unable to read it clearly.',
            dateStr
          ]
        );
      }
    }

    if (insId % 8 === 0) {
      violationCount++;

      db.run(
        `
        INSERT INTO violations
        (
          inspection_id,
          rule_id,
          description,
          severity,
          confidence,
          status,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          insId,
          6,
          'Month and year of manufacture/packing could not be clearly detected.',
          'major',
          78,
          'pending',
          dateStr
        ]
      );
    }

    if (insId % 11 === 0) {
      violationCount++;

      db.run(
        `
        INSERT INTO violations
        (
          inspection_id,
          rule_id,
          description,
          severity,
          confidence,
          status,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          insId,
          5,
          'Complete address of the manufacturer/packer could not be fully identified.',
          'major',
          70,
          'confirmed',
          dateStr
        ]
      );

      db.run(
        `
        INSERT INTO officer_decisions
        (
          violation_id,
          officer_id,
          decision,
          remarks,
          created_at
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          violationCount,
          inspectorId,
          'confirmed',
          'Address is incomplete — only city name visible.',
          dateStr
        ]
      );
    }
  }

  console.log(
    `Violations seeded: ${violationCount}`
  );

  // ============================================================
  // OCR RESULTS
  // ============================================================

  for (let insId = 1; insId <= 42; insId++) {
    const pIdx =
      (insId - 1) % 20;

    const product =
      products[pIdx];

    const text = `${product[0].toUpperCase()}
Brand: ${product[1]}
Net Weight: ${quantities[insId % 5]}
MRP ₹${100 + (insId * 17) % 400} (Inclusive of all taxes)
Manufactured by ${product[3]}
${addresses[insId % 5]}
${insId % 5 !== 0 ? 'Customer Care: 1800-XXX-XXXX' : ''}
Batch: ${product[4]}
Best Before: 12 months from packaging
${months[insId % 6]}`;

    const confidence =
      75 + seededRandom(insId, 22);

    db.run(
      `
      INSERT INTO ocr_results
      (
        inspection_id,
        raw_text,
        ocr_confidence,
        ocr_method,
        processing_time_ms
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        insId,
        text,
        confidence,
        'demo_fallback',
        1200 + seededRandom(insId, 800)
      ]
    );
  }

  console.log('OCR results seeded.');

  // ============================================================
  // AUDIT LOGS
  // ============================================================

  for (let insId = 1; insId <= 42; insId++) {
    const inspectorId =
      ((insId - 1) % 10) + 2;

    const inspectorName =
      users[inspectorId - 1][0];

    const month =
      String((insId % 8) + 1).padStart(2, '0');

    const day =
      String((insId % 28) + 1).padStart(2, '0');

    const dateStr =
      `2026-${month}-${day}T10:${String(insId % 60).padStart(2, '0')}:00`;

    const inspNum =
      `PRAMAN-2026-${String(insId).padStart(4, '0')}`;

    db.run(
      `
      INSERT INTO audit_logs
      (
        user_id,
        user_name,
        action,
        entity_type,
        entity_id,
        details,
        timestamp
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        inspectorId,
        inspectorName,
        'inspection_created',
        'inspection',
        insId,
        `Inspection ${inspNum} created`,
        dateStr
      ]
    );

    db.run(
      `
      INSERT INTO audit_logs
      (
        user_id,
        user_name,
        action,
        entity_type,
        entity_id,
        details,
        timestamp
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        inspectorId,
        inspectorName,
        'analysis_performed',
        'inspection',
        insId,
        `OCR analysis completed for inspection ${inspNum}`,
        dateStr
      ]
    );
  }

  console.log('Audit logs seeded.');

  // ============================================================
  // SAVE DATABASE
  // ============================================================

  saveDb();

  console.log('Database seeding complete.');
}

// ============================================================
// RUN WHEN EXECUTED DIRECTLY
// ============================================================

const isMain =
  process.argv[1]?.includes('seed');

if (isMain) {
  seedDatabase()
    .then(() => {
      closeDb();
      console.log('Done.');
    })
    .catch(error => {
      console.error(
        'Seed error:',
        error
      );

      try {
        closeDb();
      } catch (_) {
        // Ignore close errors during failure handling
      }

      process.exit(1);
    });
}

export default {
  seedDatabase
};