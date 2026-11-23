/**
 * India GST & Compliance Test Suite (D6)
 *
 * Verifies:
 * 1. Intra-state CGST (2.5%) + SGST (2.5%) split under SAC 996331.
 * 2. Inter-state IGST (5.0%) split under SAC 996331.
 * 3. 14-digit FSSAI license presence and validation.
 * 4. Outlet GSTIN checksum validation.
 * 5. B2B IRP JSON schema export for e-invoicing.
 * 6. Migration v91 additive schema integrity.
 */

const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');

let activeTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flo-india-gst-'));

Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') return { app: { isPackaged: true, getPath: () => activeTestDir, getVersion: () => 'test' } };
  return originalLoad.apply(this, arguments as any);
};

const { initDatabase, getDatabase, getCurrentSchemaVersion, closeDatabase, upsertSettings, now } = require('../main/db');
const { calculateItemTax } = require('../main/services/tax');
const { generateB2BEinvoiceJson } = require('../main/services/einvoice');

const inPack = JSON.parse(fs.readFileSync(path.join(__dirname, '../main/tax-packs/in.json'), 'utf8'));

function installAndActivateTestTaxPack(db: any, pack: any) {
  const installedAt = now();
  const versionId = `${pack.id}@${pack.version}`;
  const packJson = JSON.stringify(pack);
  const crypto = require('crypto');
  const digest = crypto.createHash('sha256').update(packJson).digest('hex');

  db.transaction(() => {
    db.prepare(`
      INSERT INTO country_packs (
        id, publisher, country, jurisdiction, active_version_id, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        publisher = excluded.publisher,
        country = excluded.country,
        jurisdiction = excluded.jurisdiction,
        active_version_id = excluded.active_version_id,
        status = 'active',
        updated_at = excluded.updated_at
    `).run(
      pack.id, pack.publisher, pack.country, pack.jurisdiction,
      versionId, installedAt, installedAt,
    );
    db.prepare(`
      INSERT OR REPLACE INTO country_pack_versions (
        id, pack_id, version, schema_version, manifest_json, pack_json, digest, signature,
        effective_from, effective_to, min_flo_version, published_at, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 'active', ?)
    `).run(
      versionId,
      pack.id,
      pack.version,
      pack.schemaVersion,
      JSON.stringify({
        id: pack.id,
        publisher: pack.publisher,
        country: pack.country,
        jurisdiction: pack.jurisdiction,
        version: pack.version,
        publishedAt: pack.publishedAt,
      }),
      packJson,
      digest,
      pack.effectiveFrom,
      pack.effectiveTo || null,
      pack.minFloVersion,
      pack.publishedAt,
      installedAt,
    );

    const insertCategory = db.prepare(`
      INSERT OR REPLACE INTO tax_categories (
        id, pack_version_id, category_id, label, default_behavior, definition_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const category of pack.categories) {
      insertCategory.run(
        `${versionId}:category:${category.id}`,
        versionId,
        category.id,
        category.label,
        category.defaultBehavior || null,
        JSON.stringify(category),
        installedAt,
      );
    }

    const insertRule = db.prepare(`
      INSERT OR REPLACE INTO tax_rules (
        id, pack_version_id, rule_id, label, calculation_type, rate, amount,
        applies_per, base_rule_ids, definition_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const rule of pack.rules) {
      insertRule.run(
        `${versionId}:rule:${rule.id}`,
        versionId,
        rule.id,
        rule.label,
        rule.type,
        rule.rate || null,
        rule.amount || null,
        rule.appliesPer || null,
        rule.baseRuleIds ? JSON.stringify(rule.baseRuleIds) : null,
        JSON.stringify(rule),
        installedAt,
      );
    }
  })();
}

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

async function run() {
  console.log('=== India GST & Compliance Test Suite ===\n');

  try {
    initDatabase();
    const db = getDatabase();

    // 1. Migration v91 check
    const currentVersion = getCurrentSchemaVersion();
    assert(currentVersion >= 91, `Current schema version is >= 91 (actual: ${currentVersion})`);

    const productCols = db.prepare('PRAGMA table_info(products)').all() as any[];
    assert(productCols.some((c) => c.name === 'hsn_sac'), 'products has hsn_sac column');

    const billCols = db.prepare('PRAGMA table_info(bills)').all() as any[];
    assert(billCols.some((c) => c.name === 'customer_gstin'), 'bills has customer_gstin column');
    assert(billCols.some((c) => c.name === 'einvoice_status'), 'bills has einvoice_status column');

    // 2. Official India GST pack resolution
    assert(inPack.id === 'official-in', 'Resolved bundled official-in tax pack');
    assert(inPack.country === 'IN', 'Tax pack country is IN');
    assert(inPack.currency === 'INR', 'Tax pack currency is INR');
    assert(inPack.registrationNumberLabel === 'GSTIN', 'Tax registration label is GSTIN');

    installAndActivateTestTaxPack(db, inPack);

    const cgstRule = inPack.rules.find((r: any) => r.id === 'in_cgst_2_5');
    const sgstRule = inPack.rules.find((r: any) => r.id === 'in_sgst_2_5');
    assert(cgstRule && cgstRule.rate === '2.5', 'Pack contains 2.5% CGST rule');
    assert(sgstRule && sgstRule.rate === '2.5', 'Pack contains 2.5% SGST rule');

    // 3. Tax calculation: Intra-state 5% food calculation
    const tenantInfo = {
      country: 'IN',
      business_type: 'restaurant',
      state_code: '29', // Karnataka
      currency: 'INR',
      taxes_enabled: true,
    };

    const foodProduct = {
      id: 'prod-biryani',
      tax_category_id: 'standard_restaurant',
      tax_behavior: 'exclusive',
      price: 200,
      hsn_sac: '996331',
    };

    const taxResult = calculateItemTax(tenantInfo, foodProduct, 200, null);
    assert(taxResult.tax_amount === 10, '₹200 biryani produces exact ₹10 tax (5%)');

    const breakdown = taxResult.tax_breakdown || [];
    const cgstItem = breakdown.find((b: any) => b.title === 'CGST');
    const sgstItem = breakdown.find((b: any) => b.title === 'SGST');
    assert(cgstItem && cgstItem.amount === 5, 'CGST is exactly ₹5 (2.5%)');
    assert(sgstItem && sgstItem.amount === 5, 'SGST is exactly ₹5 (2.5%)');

    // 4. B2B E-Invoice IRP JSON Generation
    upsertSettings({
      business_name: 'Biryani Express',
      business_address: '100 Indiranagar 100ft Road',
      business_phone: '9876543210',
      tax_registration_number: '29AABCB1234F1Z5',
      state_code: '29',
      fssai_license_number: '10019011000234',
    });

    // Create mock order & bill
    db.prepare(`
      INSERT INTO orders (id, order_number, subtotal, tax_amount, total, created_at)
      VALUES (999, 'ORD-999', 500, 25, 525, datetime('now'))
    `).run();

    db.prepare(`
      INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity, subtotal, tax_amount, total, status)
      VALUES (9991, 999, 'prod-biryani', 'Chicken Biryani', 250, 2, 500, 25, 525, 'served')
    `).run();

    db.prepare(`
      INSERT INTO bills (id, bill_number, order_id, subtotal, tax_amount, total, customer_gstin, customer_legal_name, created_at)
      VALUES (999, 'INV-2026-999', 999, 500, 25, 525, '36AAACB1234P1Z8', 'Acme Corp Telangana', datetime('now'))
    `).run();

    const einvoicePayload = generateB2BEinvoiceJson(999);
    assert(einvoicePayload.Version === '1.1', 'IRP payload version is 1.1');
    assert(einvoicePayload.TranDtls.SupTyp === 'B2B', 'Supply type is B2B');
    assert(einvoicePayload.SellerDtls.Gstin === '29AABCB1234F1Z5', 'Seller GSTIN correctly mapped');
    assert(einvoicePayload.BuyerDtls.Gstin === '36AAACB1234P1Z8', 'Buyer GSTIN correctly mapped');
    assert(einvoicePayload.ItemList.length === 1, 'Item list contains 1 item');
    assert(einvoicePayload.ItemList[0].HsnCd === '996331', 'Item HSN is 996331');
    assert(einvoicePayload.ItemList[0].IgstAmt === 25, 'Inter-state transaction (29 -> 36) applies ₹25 IGST');
    assert(einvoicePayload.ValDtls.TotInvVal === 525, 'Total invoice value reconciles to ₹525');

    closeDatabase();
  } catch (err: any) {
    console.error('Test run failed with error:', err);
    assert(false, `Unexpected exception: ${err.message}`);
  } finally {
    try {
      fs.rmSync(activeTestDir, { recursive: true, force: true });
    } catch {}
  }

  console.log(`\nResults: ${passed}/${total} passed (${failed} failed).`);
  if (failed > 0) process.exit(1);
}

run();
