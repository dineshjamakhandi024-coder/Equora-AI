/**
 * Inequality Analytics Service
 * 
 * Performs inequality and service-coverage calculations across regions.
 * Keeps calculation logic separate from Express route handlers for
 * clean readability, modularity, and easy testability.
 */

/**
 * Calculates inequality metrics, summary statistics, and identifies
 * underserved regions from a set of service coverage records.
 * 
 * @param {Array<Object>} records - Service coverage records joined with region names
 * @returns {Object} Analysis result containing summary, regional_results, and underserved_regions
 */
export function calculateInequalityMetrics(records = []) {
  // Requirement 7: If there are no records, return zero-valued summary and empty arrays
  if (!records || records.length === 0) {
    return {
      summary: {
        total_people_in_need: 0,
        total_people_served: 0,
        total_people_unserved: 0,
        overall_coverage_rate_percentage: 0
      },
      regional_results: [],
      underserved_regions: []
    };
  }

  let totalPeopleInNeed = 0;
  let totalPeopleServed = 0;

  // Process each regional service coverage entry
  const regionalResults = records.map((record) => {
    const peopleInNeed = Number(record.people_in_need) || 0;
    const peopleServed = Number(record.people_served) || 0;
    const peopleUnserved = Math.max(0, peopleInNeed - peopleServed);

    // Accumulate overall totals
    totalPeopleInNeed += peopleInNeed;
    totalPeopleServed += peopleServed;

    // Requirement 3: Handle zero people_in_need safely without division by zero
    let coverageRate = 0;
    if (peopleInNeed > 0) {
      coverageRate = Number(((peopleServed / peopleInNeed) * 100).toFixed(2));
    }

    return {
      id: record.id,
      region_id: record.region_id,
      region_name: record.region_name || 'Unknown Region',
      service_type: record.service_type,
      people_in_need: peopleInNeed,
      people_served: peopleServed,
      people_unserved: peopleUnserved,
      coverage_rate_percentage: coverageRate,
      available_units: Number(record.available_units) || 0
    };
  });

  const totalPeopleUnserved = Math.max(0, totalPeopleInNeed - totalPeopleServed);

  // Requirement 4: Calculate overall coverage rate using total_served / total_in_need * 100
  // Do NOT average the regional percentages. Handle zero total need safely.
  let overallCoverageRate = 0;
  if (totalPeopleInNeed > 0) {
    overallCoverageRate = Number(((totalPeopleServed / totalPeopleInNeed) * 100).toFixed(2));
  }

  // Requirement 5: Identify underserved regions where coverage is below overall coverage rate
  const underservedRegions = regionalResults
    .filter((item) => item.coverage_rate_percentage < overallCoverageRate)
    .map((item) => {
      const gap = Number((overallCoverageRate - item.coverage_rate_percentage).toFixed(2));
      return {
        region_id: item.region_id,
        region_name: item.region_name,
        service_type: item.service_type,
        coverage_rate_percentage: item.coverage_rate_percentage,
        overall_coverage_rate_percentage: overallCoverageRate,
        gap_percentage: gap,
        people_unserved: item.people_unserved,
        comparison: `Coverage of ${item.coverage_rate_percentage}% is ${gap}% below the overall average of ${overallCoverageRate}%`
      };
    });

  // Requirement 6: Consistent JSON response with summary, regional_results, and underserved_regions
  return {
    summary: {
      total_people_in_need: totalPeopleInNeed,
      total_people_served: totalPeopleServed,
      total_people_unserved: totalPeopleUnserved,
      overall_coverage_rate_percentage: overallCoverageRate
    },
    regional_results: regionalResults,
    underserved_regions: underservedRegions
  };
}

/**
 * Fetches all service coverage records joined with region names from the database
 * and computes the inequality analysis.
 * 
 * @param {import('better-sqlite3').Database} db - Active better-sqlite3 database instance
 * @returns {Object} The complete inequality analysis payload
 */
export function getInequalityAnalysis(db) {
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
  return calculateInequalityMetrics(records);
}

export default {
  calculateInequalityMetrics,
  getInequalityAnalysis
};
