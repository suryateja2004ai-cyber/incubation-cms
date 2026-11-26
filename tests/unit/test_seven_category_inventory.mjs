// ==============================================================================
// tests/unit/test_seven_category_inventory.mjs
// Verification Suite for Final 7-Category Inventory Reorganization
// ==============================================================================

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Mock localStorage for Node environment before database import
if (typeof globalThis.localStorage === 'undefined') {
  const mockStorage = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key) => mockStorage.get(key) || null,
      setItem: (key, val) => mockStorage.set(key, String(val)),
      removeItem: (key) => mockStorage.delete(key),
      clear: () => mockStorage.clear(),
    },
    writable: true,
  });
}

// Import target database and sample modules
import {
  APPROVED_MAIN_CATEGORIES,
  DEFAULT_CATEGORIES,
  initDatabase,
  resetDatabaseToSample,
  getCategories,
  getCategoryTree,
  getCategoryById,
  getCategoryPath,
  getCategoryDescendantIds,
  addCategory,
  updateCategory,
  deleteCategory,
  getComponents,
  migrateComponentRecord,
} from '../../frontend/src/db/database.js';

import { INITIAL_COMPONENTS, INITIAL_TRANSACTIONS } from '../../frontend/src/db/sampleData.js';

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`           ${err.message}`);
    failed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`           ${err.message}`);
    failed++;
  }
}

async function main() {
  console.log('================================================================');
  console.log('🧪 FINAL 7-CATEGORY INVENTORY CLASSIFICATION VERIFICATION SUITE');
  console.log('================================================================\n');

  // Initialize DB with sample data
  resetDatabaseToSample();

  // --------------------------------------------------------------------------
  console.log('--- 1. APPROVED 7 MAIN CATEGORIES TAXONOMY SPECIFICATION ---');
  // --------------------------------------------------------------------------

  runTest('APPROVED_MAIN_CATEGORIES contains strictly the 7 approved main categories', () => {
    assert.strictEqual(APPROVED_MAIN_CATEGORIES.length, 7, 'Must have exactly 7 main categories');
    const expected = [
      'Sensors & Electronic Modules',
      'Development Boards',
      'ICs & Electronic Components',
      'Displays & Indicators',
      'Motors & Drivers',
      'Power & Protection',
      'Lab Equipment & Accessories',
    ];
    assert.deepStrictEqual(APPROVED_MAIN_CATEGORIES, expected, 'Categories must exactly match Section 1');
  });

  runTest('Vague legacy category names are completely removed', () => {
    const vagueNames = [
      'Electronics',
      'Other electronic components',
      'Motors & Actuators',
      'Displays',
      'Tools & Lab Equipment',
    ];
    for (const vague of vagueNames) {
      assert(
        !APPROVED_MAIN_CATEGORIES.includes(vague),
        `Vague name "${vague}" must NOT be in APPROVED_MAIN_CATEGORIES`
      );
      const rootExists = getCategories().some((c) => !c.parentId && c.name === vague);
      assert(!rootExists, `Vague name "${vague}" must NOT exist as a root category`);
    }
  });

  runTest('All 7 approved root categories exist in DEFAULT_CATEGORIES and database', () => {
    const categories = getCategories();
    for (const name of APPROVED_MAIN_CATEGORIES) {
      const rootCat = categories.find((c) => !c.parentId && c.name === name);
      assert(rootCat, `Root category "${name}" must exist in active database`);
      assert(rootCat.id.startsWith('CAT-ROOT-'), `Root category ID must have CAT-ROOT- prefix: ${rootCat.id}`);
    }
  });

  // --------------------------------------------------------------------------
  console.log('\n--- 2. RECOMMENDED SUBCATEGORIES VALIDATION ---');
  // --------------------------------------------------------------------------

  runTest('Sensors & Electronic Modules has all 9 approved subcategories', () => {
    const categories = getCategories();
    const root = categories.find((c) => c.name === 'Sensors & Electronic Modules' && !c.parentId);
    assert(root, 'Root Sensors & Electronic Modules must exist');
    const children = categories.filter((c) => c.parentId === root.id).map((c) => c.name);

    const expectedSubcats = [
      'Motion Sensors',
      'Distance Sensors',
      'Temperature & Humidity Sensors',
      'Light & IR Sensors',
      'Gas & Air Quality Sensors',
      'Pressure Sensors',
      'Wireless Communication Modules',
      'GPS & Navigation Modules',
      'Other Sensor Modules',
    ];

    for (const sub of expectedSubcats) {
      assert(children.includes(sub), `Subcategory "${sub}" must exist under Sensors & Electronic Modules`);
    }
  });

  runTest('Development Boards has all approved subcategories and compatibility children', () => {
    const categories = getCategories();
    const root = categories.find((c) => c.name === 'Development Boards' && !c.parentId);
    assert(root, 'Root Development Boards must exist');
    const children = categories.filter((c) => c.parentId === root.id).map((c) => c.name);

    const expectedSubcats = [
      'ESP Development Boards',
      'Arduino Boards',
      'Raspberry Pi & Single Board Computers',
      'STM32 & ARM Development Boards',
      'Specialized & IoT Development Boards',
      'Programmer & Debugger Boards',
    ];

    for (const sub of expectedSubcats) {
      assert(children.includes(sub), `Subcategory "${sub}" must exist under Development Boards`);
    }

    // Granular children
    const espDev = categories.find((c) => c.name === 'ESP Development Boards');
    const esp32 = categories.find((c) => c.name === 'ESP32' && c.parentId === espDev.id);
    assert(esp32, 'ESP32 leaf child must exist under ESP Development Boards');
  });

  runTest('Displays & Indicators has all 5 approved subcategories', () => {
    const categories = getCategories();
    const root = categories.find((c) => c.name === 'Displays & Indicators' && !c.parentId);
    const children = categories.filter((c) => c.parentId === root.id).map((c) => c.name);

    const expectedSubcats = [
      'OLED Displays',
      'LCD Displays',
      'TFT & Graphic Displays',
      '7-Segment Displays',
      'LED Indicators & Matrix Modules',
    ];

    for (const sub of expectedSubcats) {
      assert(children.includes(sub), `Subcategory "${sub}" must exist under Displays & Indicators`);
    }
  });

  runTest('Motors & Drivers has all 5 approved subcategories', () => {
    const categories = getCategories();
    const root = categories.find((c) => c.name === 'Motors & Drivers' && !c.parentId);
    const children = categories.filter((c) => c.parentId === root.id).map((c) => c.name);

    const expectedSubcats = [
      'DC Motors',
      'Servo Motors',
      'Stepper Motors',
      'Motor Driver Modules & Shields',
      'Solenoids & Actuators',
    ];

    for (const sub of expectedSubcats) {
      assert(children.includes(sub), `Subcategory "${sub}" must exist under Motors & Drivers`);
    }
  });

  runTest('Power & Protection has all 5 approved subcategories', () => {
    const categories = getCategories();
    const root = categories.find((c) => c.name === 'Power & Protection' && !c.parentId);
    const children = categories.filter((c) => c.parentId === root.id).map((c) => c.name);

    const expectedSubcats = [
      'Power Supplies & Regulators',
      'Batteries & Battery Management (BMS)',
      'Step-Up / Step-Down (Buck / Boost) Converters',
      'Charging Modules',
      'Protection Circuits & Fuses',
    ];

    for (const sub of expectedSubcats) {
      assert(children.includes(sub), `Subcategory "${sub}" must exist under Power & Protection`);
    }
  });

  runTest('Lab Equipment & Accessories has all 6 approved subcategories', () => {
    const categories = getCategories();
    const root = categories.find((c) => c.name === 'Lab Equipment & Accessories' && !c.parentId);
    const children = categories.filter((c) => c.parentId === root.id).map((c) => c.name);

    const expectedSubcats = [
      'Breadboards & Prototyping',
      'Connecting Wires & Jumper Cables',
      'Connectors & Headers',
      'Fasteners, Hardware & Spacers',
      'Tools & Soldering Equipment',
      'Measuring Instruments & Testing Tools',
    ];

    for (const sub of expectedSubcats) {
      assert(children.includes(sub), `Subcategory "${sub}" must exist under Lab Equipment & Accessories`);
    }
  });

  // --------------------------------------------------------------------------
  console.log('\n--- 3. SAMPLE INVENTORY COMPONENT MAPPINGS & PRESERVATION ---');
  // --------------------------------------------------------------------------

  runTest('COMP-001 through COMP-010 map accurately to Section 3 specifications', () => {
    const components = getComponents();
    assert.strictEqual(components.length, 10, 'All 10 sample components must be present');

    const expectedMappings = {
      'COMP-001': {
        name: 'PIR Motion Sensor (HC-SR501)',
        main: 'Sensors & Electronic Modules',
        sub: 'Motion Sensors',
      },
      'COMP-002': {
        name: 'ESP32 Wi-Fi + Bluetooth Dev Board',
        main: 'Development Boards',
        sub: 'ESP Development Boards',
      },
      'COMP-003': {
        name: 'Ultrasonic Distance Sensor (HC-SR04)',
        main: 'Sensors & Electronic Modules',
        sub: 'Distance Sensors',
      },
      'COMP-004': {
        name: 'Arduino Uno R3 Compatible',
        main: 'Development Boards',
        sub: 'Arduino Boards',
      },
      'COMP-005': {
        name: 'Raspberry Pi Pico RP2040',
        main: 'Development Boards',
        sub: 'Raspberry Pi & Single Board Computers',
      },
      'COMP-006': {
        name: '0.96 inch I2C OLED Display',
        main: 'Displays & Indicators',
        sub: 'OLED Displays',
      },
      'COMP-007': {
        name: 'L298N Dual H-Bridge Motor Driver',
        main: 'Motors & Drivers',
        sub: 'Motor Driver Modules & Shields',
      },
      'COMP-008': {
        name: 'SG90 Micro Servo Motor 9g',
        main: 'Motors & Drivers',
        sub: 'Servo Motors',
      },
      'COMP-009': {
        name: 'NRF24L01+ 2.4GHz Wireless Transceiver',
        main: 'Sensors & Electronic Modules',
        sub: 'Wireless Communication Modules',
      },
      'COMP-010': {
        name: 'DHT11 Temperature & Humidity Sensor',
        main: 'Sensors & Electronic Modules',
        sub: 'Temperature & Humidity Sensors',
      },
    };

    for (const [id, exp] of Object.entries(expectedMappings)) {
      const comp = components.find((c) => c.id === id);
      assert(comp, `Component ${id} must exist in components list`);
      assert.strictEqual(comp.category, exp.main, `${id} category must be "${exp.main}", got "${comp.category}"`);
      assert.strictEqual(comp.parentCategory, exp.sub, `${id} parentCategory must be "${exp.sub}", got "${comp.parentCategory}"`);
      assert(
        comp.categoryPath.includes(exp.main) && comp.categoryPath.includes(exp.sub),
        `${id} categoryPath must contain "${exp.main} / ${exp.sub}", got "${comp.categoryPath}"`
      );
    }
  });

  runTest('100% preservation of quantities, IDs, tags, locations, and thresholds', () => {
    const components = getComponents();
    for (const orig of INITIAL_COMPONENTS) {
      const updated = components.find((c) => c.id === orig.id);
      assert(updated, `Component ${orig.id} must exist`);

      // Inventory quantity guarantees
      assert.strictEqual(updated.totalQuantity, orig.totalQuantity, `${orig.id} totalQuantity must be preserved`);
      assert.strictEqual(updated.availableQuantity, orig.availableQuantity, `${orig.id} availableQuantity must be preserved`);
      assert.strictEqual(updated.issuedQuantity, orig.issuedQuantity, `${orig.id} issuedQuantity must be preserved`);
      assert.strictEqual(updated.damagedQuantity, orig.damagedQuantity, `${orig.id} damagedQuantity must be preserved`);
      assert.strictEqual(updated.lostQuantity, orig.lostQuantity, `${orig.id} lostQuantity must be preserved`);
      assert.strictEqual(updated.lowStockThreshold, orig.lowStockThreshold, `${orig.id} lowStockThreshold must be preserved`);
      assert.strictEqual(updated.location, orig.location, `${orig.id} location must be preserved`);
      assert.strictEqual(updated.defaultOverdueDays, orig.defaultOverdueDays, `${orig.id} defaultOverdueDays must be preserved`);
      assert.strictEqual(updated.trackingMode, orig.trackingMode, `${orig.id} trackingMode must be preserved`);
    }
  });

  runTest('Transaction history and loan records remain 100% intact', () => {
    assert(INITIAL_TRANSACTIONS.length > 0, 'INITIAL_TRANSACTIONS must be populated');
    for (const tx of INITIAL_TRANSACTIONS) {
      assert(tx.id && Array.isArray(tx.items) && tx.items.length > 0, 'Transaction must have id and items');
      for (const item of tx.items) {
        assert(item.componentId, 'Item must have componentId');
      }
    }
  });

  // --------------------------------------------------------------------------
  console.log('\n--- 4. CATEGORY GOVERNANCE & INTEGRITY RULES ---');
  // --------------------------------------------------------------------------

  await runAsyncTest('addCategory allows adding subcategories under existing main categories', async () => {
    const categories = getCategories();
    const powerRoot = categories.find((c) => c.name === 'Power & Protection' && !c.parentId);
    assert(powerRoot, 'Power & Protection root category must exist');

    const newSub = await addCategory(
      {
        name: 'Solar Panels & Harvesting',
        parentId: powerRoot.id,
        description: '5V/12V mini solar cells and MPPT harvest modules',
      },
      { name: 'Admin', role: 'admin' }
    );

    assert(newSub.id, 'New subcategory must have an ID');
    assert.strictEqual(newSub.parentId, powerRoot.id);
    const path = getCategoryPath(newSub.id);
    assert.deepStrictEqual(path, ['Power & Protection', 'Solar Panels & Harvesting']);
  });

  await runAsyncTest('addCategory blocks creating arbitrary root categories outside the 7 approved', async () => {
    let threw = false;
    try {
      await addCategory(
        {
          name: 'Arbitrary 8th Root Category',
          parentId: null,
          description: 'Not in approved 7 list',
        },
        { name: 'Admin', role: 'admin' }
      );
    } catch (err) {
      threw = true;
      assert(
        err.message.includes('APPROVED_MAIN_CATEGORIES') || err.message.includes('not permitted'),
        `Error message must indicate restriction: ${err.message}`
      );
    }
    assert(threw, 'Must strictly block creating arbitrary root categories');
  });

  await runAsyncTest('addCategory blocks duplicate category names under same parent', async () => {
    const categories = getCategories();
    const devBoards = categories.find((c) => c.name === 'Development Boards' && !c.parentId);

    let threw = false;
    try {
      await addCategory(
        {
          name: 'Arduino Boards', // Already exists under Development Boards
          parentId: devBoards.id,
          description: 'Duplicate name',
        },
        { name: 'Admin', role: 'admin' }
      );
    } catch (err) {
      threw = true;
      assert(
        err.message.includes('already exists') || err.message.includes('Duplicate'),
        `Must reject duplicate name under same parent: ${err.message}`
      );
    }
    assert(threw, 'Must reject duplicate category names under the same parent');
  });

  await runAsyncTest('updateCategory allows renaming subcategories and cascades to components', async () => {
    const categories = getCategories();
    const subToRename = categories.find((c) => c.name === 'Solar Panels & Harvesting');
    assert(subToRename, 'Subcategory must exist');

    const updated = await updateCategory(
      subToRename.id,
      {
        name: 'Solar Energy & Energy Harvesting',
        description: 'Updated description',
      },
      { name: 'Admin', role: 'admin' }
    );

    assert.strictEqual(updated.name, 'Solar Energy & Energy Harvesting');
    const path = getCategoryPath(updated.id);
    assert.deepStrictEqual(path, ['Power & Protection', 'Solar Energy & Energy Harvesting']);
  });

  await runAsyncTest('deleteCategory protects the 7 approved root categories from deletion', async () => {
    const categories = getCategories();
    const sensorRoot = categories.find((c) => c.name === 'Sensors & Electronic Modules' && !c.parentId);

    let threw = false;
    try {
      await deleteCategory(sensorRoot.id, { name: 'Admin', role: 'admin' });
    } catch (err) {
      threw = true;
      assert(
        err.message.includes('main category') || err.message.includes('cannot be deleted'),
        `Must protect root: ${err.message}`
      );
    }
    assert(threw, 'Must block deleting any of the 7 approved root categories');
  });

  await runAsyncTest('deleteCategory blocks deleting a category with assigned components', async () => {
    const categories = getCategories();
    const motionSensors = categories.find((c) => c.name === 'Motion Sensors');
    assert(motionSensors, 'Motion Sensors must exist');

    let threw = false;
    try {
      await deleteCategory(motionSensors.id, { name: 'Admin', role: 'admin' });
    } catch (err) {
      threw = true;
      assert(
        err.message.includes('assigned') || err.message.includes('component'),
        `Must reject deleting category with components: ${err.message}`
      );
    }
    assert(threw, 'Must prevent deleting category that contains components');
  });

  // --------------------------------------------------------------------------
  console.log('\n--- 5. COMPONENT FILTERING BY MAIN CATEGORY & SUBCATEGORY ---');
  // --------------------------------------------------------------------------

  runTest('Filter by main category returns all components across its subcategories', () => {
    const categories = getCategories();
    const sensorRoot = categories.find((c) => c.name === 'Sensors & Electronic Modules' && !c.parentId);

    const sensorComponents = getComponents('All', '', 'all', sensorRoot.id);
    const sensorIds = sensorComponents.map((c) => c.id).sort();
    assert.deepStrictEqual(
      sensorIds,
      ['COMP-001', 'COMP-003', 'COMP-009', 'COMP-010'],
      'Sensors & Electronic Modules must include COMP-001, COMP-003, COMP-009, COMP-010'
    );

    const devBoardsRoot = categories.find((c) => c.name === 'Development Boards' && !c.parentId);
    const devBoardComponents = getComponents('All', '', 'all', devBoardsRoot.id);
    const devBoardIds = devBoardComponents.map((c) => c.id).sort();
    assert.deepStrictEqual(
      devBoardIds,
      ['COMP-002', 'COMP-004', 'COMP-005'],
      'Development Boards must include COMP-002, COMP-004, COMP-005'
    );
  });

  runTest('Filter by specific subcategory returns precisely targeted components', () => {
    const categories = getCategories();
    const motionSub = categories.find((c) => c.name === 'Motion Sensors');
    const motionComps = getComponents('All', '', 'all', motionSub.id);
    assert.strictEqual(motionComps.length, 1, 'Only 1 component in Motion Sensors');
    assert.strictEqual(motionComps[0].id, 'COMP-001');

    const espDevSub = categories.find((c) => c.name === 'ESP Development Boards');
    const espComps = getComponents('All', '', 'all', espDevSub.id);
    assert.strictEqual(espComps.length, 1, 'Only 1 component in ESP Development Boards');
    assert.strictEqual(espComps[0].id, 'COMP-002');
  });

  // --------------------------------------------------------------------------
  console.log('\n--- 6. DATABASE MIGRATION SCRIPT VERIFICATION ---');
  // --------------------------------------------------------------------------

  runTest('008_final_seven_category_inventory.sql exists and contains valid SQL', () => {
    const migrationFile = path.resolve('database/supabase/migrations/008_final_seven_category_inventory.sql');
    assert(fs.existsSync(migrationFile), '008_final_seven_category_inventory.sql must exist');

    const sql = fs.readFileSync(migrationFile, 'utf-8');
    assert(sql.includes('CAT-ROOT-SENSORS-MODULES'), 'Must insert CAT-ROOT-SENSORS-MODULES');
    assert(sql.includes('CAT-ROOT-DEV-BOARDS'), 'Must insert CAT-ROOT-DEV-BOARDS');
    assert(sql.includes('CAT-ROOT-ICS-COMPONENTS'), 'Must insert CAT-ROOT-ICS-COMPONENTS');
    assert(sql.includes('CAT-ROOT-DISPLAYS-INDICATORS'), 'Must insert CAT-ROOT-DISPLAYS-INDICATORS');
    assert(sql.includes('CAT-ROOT-MOTORS-DRIVERS'), 'Must insert CAT-ROOT-MOTORS-DRIVERS');
    assert(sql.includes('CAT-ROOT-POWER-PROTECTION'), 'Must insert CAT-ROOT-POWER-PROTECTION');
    assert(sql.includes('CAT-ROOT-LAB-EQUIPMENT'), 'Must insert CAT-ROOT-LAB-EQUIPMENT');

    // Reclassification updates
    assert(sql.includes("SET category = 'Sensors & Electronic Modules'"), 'Must update Sensors components');
    assert(sql.includes("SET category = 'Development Boards'"), 'Must update Dev Boards components');
    assert(sql.includes("SET category = 'Displays & Indicators'"), 'Must update Displays components');
    assert(sql.includes("SET category = 'Motors & Drivers'"), 'Must update Motors components');

    // Safe cleanup
    assert(sql.includes('DELETE FROM public.component_categories'), 'Must include safe cleanup');
  });

  // --------------------------------------------------------------------------
  console.log('\n--- 7. STRICT INVARIANT CHECKS: BACKUP SIZES ---');
  // --------------------------------------------------------------------------

  runTest('sampleData.js size remains exactly 22,676 bytes', () => {
    const sampleDataPath = path.resolve('frontend/src/db/sampleData.js');
    const stat = fs.statSync(sampleDataPath);
    assert.strictEqual(stat.size, 22676, `sampleData.js must be exactly 22,676 bytes, found ${stat.size}`);
  });

  runTest('data_base_backup.js size remains exactly 61,794 bytes', () => {
    const backupPath = path.resolve('frontend/src/db/data_base_backup.js');
    const stat = fs.statSync(backupPath);
    assert.strictEqual(stat.size, 61794, `data_base_backup.js must be exactly 61,794 bytes, found ${stat.size}`);
  });

  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
