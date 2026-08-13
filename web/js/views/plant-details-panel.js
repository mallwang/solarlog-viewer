import { t } from '../i18n.js';
import { formatDate } from '../format.js';
import { emptyStateBody } from './empty-state.js';

function inverterRow(inverter) {
  return `<li class="plant-details__inverter flex items-center justify-between gap-sm">
    <span>${inverter.model}${inverter.type ? ` <span class="text-text-muted">(${inverter.type})</span>` : ''}</span>
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
 * `data/plant.js`'s `parseBaseVars`): title/location/operator/capacity/commissioned date/module
 * type/orientation, laid out two-up on wider screens to avoid a tall single column of mostly
 * empty horizontal space, plus an equipment row below split the same way - inverters (type,
 * model, string count) on the left, the SolarLog monitoring device (name, firmware, firmware
 * date) on the right. Renders the shared empty state (FR-013) when `plant` is `null` - e.g.
 * `base_vars.js` failed to fetch/parse - instead of throwing, so a failure here never blanks the
 * carousel or chart regions (SC-004).
 * @param {{ title: string, location: string, operator: string, capacityKwp: number,
 *   commissionedDate: string, moduleType: string, orientation: string, deviceName: string,
 *   firmware: string, firmwareDate: string,
 *   inverters: { index: number, type: string, model: string, stringCount: number }[] }
 *   | null} plant - PlantMetadata (see `data/plant.js`'s `parseBaseVars`).
 * @returns {string} HTML markup.
 */
export function plantDetailsMarkup(plant) {
  if (!plant) return emptyStateBody('welcome.plantDetailsUnavailable');

  const commissioned = plant.commissionedDate ? formatDate(new Date(plant.commissionedDate)) : '—';
  const inverters = plant.inverters ?? [];

  const invertersBlock =
    inverters.length > 0
      ? `<div>
      <h4 class="plant-details__inverters-title text-sm font-semibold mb-xs">${t('welcome.plantDetails.invertersTitle')}</h4>
      <ul class="plant-details__inverters flex flex-col gap-xs list-none p-0 m-0">
        ${inverters.map(inverterRow).join('')}
      </ul>
    </div>`
      : '';

  const monitoringBlock = `<div>
    <h4 class="plant-details__monitoring-title text-sm font-semibold mb-xs">${t('welcome.plantDetails.monitoringTitle')}</h4>
    <div class="plant-details__monitoring flex flex-col gap-xs">
      ${detailRow('welcome.plantDetails.deviceName', plant.deviceName || '—')}
      ${detailRow('welcome.plantDetails.firmware', plant.firmware || '—')}
      ${detailRow('welcome.plantDetails.firmwareDate', plant.firmwareDate || '—')}
    </div>
  </div>`;

  return `<div class="plant-details">
    <h3 class="plant-details__title text-base font-semibold mb-sm">${plant.title || t('welcome.plantDetails.title')}</h3>
    <div class="plant-details__rows grid grid-cols-1 sm:grid-cols-2 gap-x-md gap-y-xs mb-md">
      ${detailRow('welcome.plantDetails.location', plant.location || '—')}
      ${detailRow('welcome.plantDetails.operator', plant.operator || '—')}
      ${detailRow('welcome.plantDetails.capacity', `${plant.capacityKwp} kWp`)}
      ${detailRow('welcome.plantDetails.commissioned', commissioned)}
      ${detailRow('welcome.plantDetails.moduleType', plant.moduleType || '—')}
      ${detailRow('welcome.plantDetails.orientation', plant.orientation || '—')}
    </div>
    <div class="plant-details__equipment grid grid-cols-1 sm:grid-cols-2 gap-md">
      ${invertersBlock}
      ${monitoringBlock}
    </div>
  </div>`;
}
