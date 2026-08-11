/**
 * Computes inverter efficiency (PAC ÷ PDC, as a percentage) for a single reading's per-inverter
 * map. Sums `pacW` across all inverters and every element of every inverter's `pdcW` array before
 * dividing, per FR-001. Returns `null` (never `0`/`NaN`/`Infinity`) when the summed PDC is zero,
 * missing, or either sum is non-finite, per FR-003/FR-005. The result is uncapped — a value above
 * 100 (PAC > PDC) is returned as-is, per FR-008. No rounding is applied here; that happens at
 * display time.
 * @param {Record<string|number, { pacW: number, pdcW?: number[] }>} perInverter
 * @returns {number | null}
 */
export function efficiencyPercent(perInverter) {
  let sumPac = 0;
  let sumPdc = 0;
  for (const inverter of Object.values(perInverter ?? {})) {
    sumPac += inverter.pacW;
    for (const pdc of inverter.pdcW ?? []) sumPdc += pdc;
  }
  if (!(sumPdc > 0) || !Number.isFinite(sumPac) || !Number.isFinite(sumPdc)) return null;
  return (sumPac / sumPdc) * 100;
}
