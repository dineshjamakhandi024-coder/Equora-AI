import { initDatabase, closeDb } from '../db/database.js';
import { calculateInequalityMetrics, getInequalityAnalysis } from './inequalityService.js';

console.log('--- EQUORA AI Analytics & Inequality Verification ---');

// ===========================================================================
// Test 1: Empty-Data Handling (Requirement 7)
// ===========================================================================
console.log('1. Testing empty-data handling...');
const emptyResult = calculateInequalityMetrics([]);

if (
  emptyResult.summary.total_people_in_need !== 0 ||
  emptyResult.summary.total_people_served !== 0 ||
  emptyResult.summary.total_people_unserved !== 0 ||
  emptyResult.summary.overall_coverage_rate_percentage !== 0 ||
  emptyResult.regional_results.length !== 0 ||
  emptyResult.underserved_regions.length !== 0
) {
  console.error('❌ Empty data test failed:', emptyResult);
  process.exit(1);
}
console.log('   ✓ Empty data returns zero totals and empty arrays.');

// ===========================================================================
// Test 2: Safe Handling of Zero Demand (Requirement 3)
// ===========================================================================
console.log('2. Testing zero demand handling (people_in_need = 0)...');
const zeroDemandResult = calculateInequalityMetrics([
  {
    id: 1,
    region_id: 10,
    region_name: 'Zero Demand Region',
    service_type: 'Emergency Shelter',
    people_in_need: 0,
    people_served: 0,
    available_units: 5
  }
]);

const zeroItem = zeroDemandResult.regional_results[0];
if (
  zeroItem.coverage_rate_percentage !== 0 ||
  zeroDemandResult.summary.overall_coverage_rate_percentage !== 0
) {
  console.error('❌ Zero demand handling failed:', zeroDemandResult);
  process.exit(1);
}
console.log('   ✓ Zero demand safely returns 0% coverage without division by zero.');

// ===========================================================================
// Test 3: Known Dataset Calculation & Underserved Identification (Req 4 & 5)
// ===========================================================================
console.log('3. Testing calculations on a known multi-region dataset...');

// Dataset setup:
// Region A: 10,000 need, 8,000 served -> 80% coverage
// Region B: 20,000 need, 10,000 served -> 50% coverage
// Total need: 30,000, Total served: 18,000
// Overall coverage = (18,000 / 30,000) * 100 = 60.00%
// (Note: The arithmetic average of 80% and 50% would be 65%, which is INCORRECT)
// Region B (50%) < 60% -> Underserved!
// Region A (80%) >= 60% -> Not underserved.
const testRecords = [
  {
    id: 1,
    region_id: 1,
    region_name: 'Alpha District',
    service_type: 'Healthcare',
    people_in_need: 10000,
    people_served: 8000,
    available_units: 50
  },
  {
    id: 2,
    region_id: 2,
    region_name: 'Beta District',
    service_type: 'Healthcare',
    people_in_need: 20000,
    people_served: 10000,
    available_units: 30
  }
];

const result = calculateInequalityMetrics(testRecords);

// Check summary
if (result.summary.total_people_in_need !== 30000) {
  throw new Error(`Expected total_people_in_need 30000, got ${result.summary.total_people_in_need}`);
}
if (result.summary.total_people_served !== 18000) {
  throw new Error(`Expected total_people_served 18000, got ${result.summary.total_people_served}`);
}
if (result.summary.total_people_unserved !== 12000) {
  throw new Error(`Expected total_people_unserved 12000, got ${result.summary.total_people_unserved}`);
}
if (result.summary.overall_coverage_rate_percentage !== 60) {
  throw new Error(`Expected overall_coverage_rate_percentage 60.00, got ${result.summary.overall_coverage_rate_percentage}`);
}
console.log('   ✓ Summary totals and overall coverage rate (60.00%) correctly calculated.');

// Check regional results
const alpha = result.regional_results.find((r) => r.region_name === 'Alpha District');
const beta = result.regional_results.find((r) => r.region_name === 'Beta District');

if (alpha.coverage_rate_percentage !== 80 || alpha.people_unserved !== 2000) {
  throw new Error(`Alpha District calculation mismatch: ${JSON.stringify(alpha)}`);
}
if (beta.coverage_rate_percentage !== 50 || beta.people_unserved !== 10000) {
  throw new Error(`Beta District calculation mismatch: ${JSON.stringify(beta)}`);
}
console.log('   ✓ Regional coverage rates and unserved counts correctly calculated.');

// Check underserved identification
if (result.underserved_regions.length !== 1) {
  throw new Error(`Expected 1 underserved region, got ${result.underserved_regions.length}`);
}
const underserved = result.underserved_regions[0];
if (underserved.region_name !== 'Beta District') {
  throw new Error(`Expected Beta District to be underserved, got ${underserved.region_name}`);
}
if (underserved.coverage_rate_percentage !== 50 || underserved.overall_coverage_rate_percentage !== 60) {
  throw new Error(`Underserved metrics mismatch: ${JSON.stringify(underserved)}`);
}
if (underserved.gap_percentage !== 10) {
  throw new Error(`Expected gap_percentage of 10%, got ${underserved.gap_percentage}`);
}
console.log('   ✓ Underserved region correctly identified (Beta District: 50% vs 60% overall, gap 10%).');

// ===========================================================================
// Test 4: Database-Integrated Isolated Test using :memory:
// ===========================================================================
console.log('4. Testing database integration using isolated :memory: database...');
const testDb = initDatabase(':memory:');

// Insert temporary test regions and service coverage records
testDb.prepare('INSERT INTO regions (name, population) VALUES (?, ?)').run('Isolated Region A', 50000);
testDb.prepare('INSERT INTO regions (name, population) VALUES (?, ?)').run('Isolated Region B', 30000);

const insertCoverage = testDb.prepare(
  'INSERT INTO service_coverage (region_id, service_type, people_in_need, people_served, available_units) VALUES (?, ?, ?, ?, ?)'
);
insertCoverage.run(1, 'Water Supply', 5000, 4500, 10); // 90%
insertCoverage.run(2, 'Water Supply', 8000, 2000, 4);  // 25%

const dbAnalysis = getInequalityAnalysis(testDb);

if (dbAnalysis.regional_results.length !== 2) {
  throw new Error(`Expected 2 records, got ${dbAnalysis.regional_results.length}`);
}
if (dbAnalysis.summary.total_people_in_need !== 13000) {
  throw new Error(`Expected total need 13000, got ${dbAnalysis.summary.total_people_in_need}`);
}
if (dbAnalysis.summary.total_people_served !== 6500) {
  throw new Error(`Expected total served 6500, got ${dbAnalysis.summary.total_people_served}`);
}
// 6500 / 13000 = 50.00%
if (dbAnalysis.summary.overall_coverage_rate_percentage !== 50) {
  throw new Error(`Expected overall coverage 50.00%, got ${dbAnalysis.summary.overall_coverage_rate_percentage}`);
}
if (dbAnalysis.underserved_regions.length !== 1 || dbAnalysis.underserved_regions[0].region_name !== 'Isolated Region B') {
  throw new Error(`Expected Isolated Region B to be underserved, got ${JSON.stringify(dbAnalysis.underserved_regions)}`);
}

closeDb();
console.log('   ✓ Database-integrated query and calculation verified in memory.');

console.log('\n--- All Analytics Verification Tests Passed Successfully! ---');
process.exit(0);
