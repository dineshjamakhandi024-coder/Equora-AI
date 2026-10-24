/**
 * Resource Allocation Service
 * 
 * Recommends fair and deterministic resource allocation under a limited budget.
 * Distributes available units to underserved service coverage areas with unmet need.
 */

/**
 * Calculates deterministic resource allocation for a given set of records and budget.
 *
 * @param {Array<Object>} records - Service coverage records joined with region names
 * @param {number} budgetUnits - Total budget units to allocate (non-negative integer)
 * @returns {Object} Allocation results with summary and regional allocations
 */
export function calculateResourceAllocation(records = [], budgetUnits) {
  // Validate budgetUnits: must be a non-negative integer
  if (
    typeof budgetUnits !== 'number' ||
    !Number.isInteger(budgetUnits) ||
    budgetUnits < 0
  ) {
    const error = new Error("'budget_units' is required and must be a non-negative integer (0 or greater).");
    error.statusCode = 400;
    throw error;
  }

  // Identify eligible records: only records with unmet need (people_unserved > 0)
  const eligibleRecords = (records || [])
    .map((record) => {
      const inNeed = Number(record.people_in_need) || 0;
      const served = Number(record.people_served) || 0;
      const unserved = Math.max(0, inNeed - served);
      const coverageRate = inNeed > 0 ? Number(((served / inNeed) * 100).toFixed(2)) : 0;

      return {
        id: record.id,
        region_id: record.region_id,
        region_name: record.region_name || 'Unknown Region',
        service_type: record.service_type,
        people_in_need: inNeed,
        people_served: served,
        people_unserved: unserved,
        coverage_rate_percentage: coverageRate,
        current_available_units: Number(record.available_units) || 0,
        allocated_units: 0
      };
    })
    .filter((record) => record.people_unserved > 0);

  // If budgetUnits is 0 or no eligible records exist with unmet need
  if (budgetUnits === 0 || eligibleRecords.length === 0) {
    return {
      summary: {
        budget_units: budgetUnits,
        total_allocated_units: 0,
        remaining_budget_units: budgetUnits,
        eligible_records_count: eligibleRecords.length
      },
      allocations: eligibleRecords.map((r) => ({
        service_coverage_id: r.id,
        region_id: r.region_id,
        region_name: r.region_name,
        service_type: r.service_type,
        people_unserved: r.people_unserved,
        coverage_rate_percentage: r.coverage_rate_percentage,
        allocated_units: 0
      }))
    };
  }

  // Calculate total unmet need across all eligible records
  const totalUnmetNeed = eligibleRecords.reduce((sum, r) => sum + r.people_unserved, 0);

  // Deterministic proportional distribution using Largest Remainder (Hare-Niemeyer):
  // 1. Calculate ideal float quota for each record: (unserved / totalUnmet) * budgetUnits
  // 2. Assign the integer floor part to each record
  // 3. Track remainders (fractional parts)
  // 4. Distribute leftover units one-by-one to records with largest remainders
  // 5. Break ties deterministically by record.id ascending
  let initialAllocated = 0;
  const quotas = eligibleRecords.map((record) => {
    const rawQuota = (record.people_unserved / totalUnmetNeed) * budgetUnits;
    const floorUnits = Math.floor(rawQuota);
    initialAllocated += floorUnits;

    return {
      record,
      floorUnits,
      remainder: rawQuota - floorUnits
    };
  });

  // Distribute remaining units
  let remainingUnits = budgetUnits - initialAllocated;

  // Sort by remainder descending, tie-break by record ID ascending for 100% determinism
  quotas.sort((a, b) => {
    if (b.remainder !== a.remainder) {
      return b.remainder - a.remainder;
    }
    return a.record.id - b.record.id;
  });

  for (let i = 0; i < quotas.length && remainingUnits > 0; i++) {
    quotas[i].floorUnits += 1;
    remainingUnits -= 1;
  }

  // Format final allocations and sort by service_coverage_id for consistent ordering
  let totalAllocatedUnits = 0;
  const allocations = quotas
    .map((q) => {
      totalAllocatedUnits += q.floorUnits;
      return {
        service_coverage_id: q.record.id,
        region_id: q.record.region_id,
        region_name: q.record.region_name,
        service_type: q.record.service_type,
        people_unserved: q.record.people_unserved,
        coverage_rate_percentage: q.record.coverage_rate_percentage,
        allocated_units: q.floorUnits
      };
    })
    .sort((a, b) => a.service_coverage_id - b.service_coverage_id);

  return {
    summary: {
      budget_units: budgetUnits,
      total_allocated_units: totalAllocatedUnits,
      remaining_budget_units: budgetUnits - totalAllocatedUnits,
      eligible_records_count: eligibleRecords.length
    },
    allocations
  };
}

/**
 * Fetches all service coverage records from the database and runs the allocation algorithm.
 * 
 * @param {import('better-sqlite3').Database} db
 * @param {number} budgetUnits
 * @returns {Object}
 */
export function getResourceAllocation(db, budgetUnits) {
  const query = `
    SELECT 
      sc.id,
      sc.region_id,
      r.name AS region_name,
      sc.service_type,
      sc.people_in_need,
      sc.people_served,
      sc.available_units
    FROM service_coverage sc
    LEFT JOIN regions r ON sc.region_id = r.id
    ORDER BY sc.id ASC
  `;

  const records = db.prepare(query).all();
  return calculateResourceAllocation(records, budgetUnits);
}

export default {
  calculateResourceAllocation,
  getResourceAllocation
};
