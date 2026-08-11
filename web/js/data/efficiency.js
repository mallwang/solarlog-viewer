/**
 * Sums `pacW` across all inverters and every element of every inverter's `pdcW` array in a
 * single reading's per-inverter map — the raw inputs to the PAC ÷ PDC efficiency ratio, exposed
 * separately so callers (e.g. a tooltip wanting to show "PAC / PDC" alongside the percentage)
 * don't have to re-derive them.
 * @param {Record<string|number, { pacW: number, pdcW?: number[] }>} perInverter
 * @returns {{ pacW: number, pdcW: number }}
 */
export function efficiencySums(perInverter) {
  let pacW = 0;
  let pdcW = 0;
  for (const inverter of Object.values(perInverter ?? {})) {
    pacW += inverter.pacW;
    for (const pdc of inverter.pdcW ?? []) pdcW += pdc;
  }
  return { pacW, pdcW };
}

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
  const { pacW, pdcW } = efficiencySums(perInverter);
  if (pdcW <= 0 || !Number.isFinite(pacW) || !Number.isFinite(pdcW)) return null;
  return (pacW / pdcW) * 100;
}
