/**
 * Yearly CO2 emission factors for the German electricity grid mix (average/territorial method,
 * "Emissionsfaktor Strommix"), sourced from Umweltbundesamt Tabelle 2 (see research.md R1):
 *
 * Icha, P.; Lauf, T. (2026): Entwicklung der spezifischen Treibhausgas-Emissionen des deutschen
 * Strommix in den Jahren 1990-2025. Umweltbundesamt, Climate Change 16/2026, Dessau-Rosslau,
 * Maerz 2026. DOI: https://doi.org/10.60810/openumwelt-8399
 *
 * Values are converted from the source's g CO2/kWh figures to kg CO2/kWh (/ 1000). To add a
 * newly published year, add a single `year: factor` entry below - no other code needs to change
 * (FR-006).
 * @type {{ [year: number]: number }}
 */
export const CO2_FACTOR_KG_PER_KWH_BY_YEAR = {
  2006: 0.608,
  2007: 0.626,
  2008: 0.582,
  2009: 0.571,
  2010: 0.559,
  2011: 0.57,
  2012: 0.572,
  2013: 0.572,
  2014: 0.559,
  2015: 0.529,
  2016: 0.524,
  2017: 0.49,
  2018: 0.473,
  2019: 0.409,
  2020: 0.365,
  2021: 0.406,
  2022: 0.433,
  2023: 0.379,
  2024: 0.353,
  2025: 0.344,
};

/**
 * Fallback CO2 factor (kg/kWh) for any calendar year absent from
 * `CO2_FACTOR_KG_PER_KWH_BY_YEAR` (the current, in-progress year and any future year, until UBA
 * publishes a specific figure for it) - per FR-005.
 * @type {number}
 */
export const CO2_FALLBACK_FACTOR_KG_PER_KWH = 0.363;

/**
 * Looks up the CO2 emission factor (kg CO2 per kWh) for a given calendar year, falling back to
 * `CO2_FALLBACK_FACTOR_KG_PER_KWH` when no specific entry is published yet (FR-005/FR-006).
 * @param {number} year - Calendar year.
 * @returns {number} kg CO2 per kWh for that year, or the fallback constant.
 */
export function co2FactorForYear(year) {
  return CO2_FACTOR_KG_PER_KWH_BY_YEAR[year] ?? CO2_FALLBACK_FACTOR_KG_PER_KWH;
}
