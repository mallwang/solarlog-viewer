import { t } from '../i18n.js';
import { formatDate } from '../format.js';
import { emptyStateBody } from './empty-state.js';

function inverterRow(inverter) {
  return `<li class="plant-details__inverter flex items-center justify-between gap-sm">
    <span>${inverter.model}</span>
    <span class="text-text-muted">${inverter.stringCount} ${t('welcome.plantDetails.inverterStrings')}</span>
  </li>`;
}

function detailRow(labelKey, value) {
  return `<div class="plant-details__row flex items-center justify-between gap-sm">
    <span class="text-text-muted">${t(labelKey)}</span>
    <span>${value}</span>
  </div>`;
}

/**
 * Renders the welcome page's plant-details panel (FR-011/FR-012) from `PlantMetadata` (see
 * `data/plant.js`'s `parseBaseVars`): title/location/operator/capacity/commissioned date plus the
 * per-inverter list (model, string count). Renders the shared empty state (FR-013) when `plant`
 * is `null` - e.g. `base_vars.js` failed to fetch/parse - instead of throwing, so a failure here
 * never blanks the carousel or chart regions (SC-004).
 * @param {{ title: string, location: string, operator: string, capacityKwp: number,
 *   commissionedDate: string, inverters: { index: number, model: string, stringCount: number }[] }
 *   | null} plant - PlantMetadata (see `data/plant.js`'s `parseBaseVars`).
 * @returns {string} HTML markup.
 */
export function plantDetailsMarkup(plant) {
  if (!plant) return emptyStateBody('welcome.plantDetailsUnavailable');

  const commissioned = plant.commissionedDate ? formatDate(new Date(plant.commissionedDate)) : '—';
  const inverters = plant.inverters ?? [];

  return `<div class="plant-details">
    <h3 class="plant-details__title text-base font-semibold mb-sm">${plant.title || t('welcome.plantDetails.title')}</h3>
    <div class="plant-details__rows flex flex-col gap-xs mb-sm">
      ${detailRow('welcome.plantDetails.location', plant.location || '—')}
      ${detailRow('welcome.plantDetails.operator', plant.operator || '—')}
      ${detailRow('welcome.plantDetails.capacity', `${plant.capacityKwp} kWp`)}
      ${detailRow('welcome.plantDetails.commissioned', commissioned)}
    </div>
    ${
      inverters.length > 0
        ? `<h4 class="plant-details__inverters-title text-sm font-semibold mb-xs">${t('welcome.plantDetails.invertersTitle')}</h4>
    <ul class="plant-details__inverters flex flex-col gap-xs list-none p-0 m-0">
      ${inverters.map(inverterRow).join('')}
    </ul>`
        : ''
    }
  </div>`;
}
