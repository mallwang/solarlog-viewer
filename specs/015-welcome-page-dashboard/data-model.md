# Phase 1 Data Model: Welcome Page (Default Landing View)

No new persisted storage and no changes to any SolarLog `.js` data file (constitution Principle
I). The entities below are in-memory shapes assembled from existing sources for the duration of a
welcome-page render.

## Plant Photo

A static image file the operator has placed in `web/img/plant/` and listed in `config.js`.

| Field          | Type     | Source                           | Notes                                |
| -------------- | -------- | -------------------------------- | ------------------------------------ |
| `fileName`     | `string` | `PLANT_PHOTOS[i]` (config.js)    | e.g. `"roof-array.jpg"`              |
| `src`          | `string` | derived: `img/plant/${fileName}` | relative URL used in the `<img src>` |
| `displayOrder` | `number` | array index in `PLANT_PHOTOS`    | carousel order == config order       |

**Cardinality**: 0..N. `PLANT_PHOTOS` defaults to `[]` (FR-008 placeholder state).

**Validation**: None at runtime — a listed file that 404s degrades to a broken `<img>` for that
one slide only (not spec'd further; out of scope per Assumptions — operator maintains files
directly). No filename format is enforced beyond "resolves under `web/img/plant/`".

## Plant Details (view of `PlantMetadata`)

Reuses `parseBaseVars()`'s existing return shape (`web/js/data/plant.js`) — no new parser, no new
fields. The welcome page's plant-details panel selects this subset:

| Field              | Type                                                      | Shown as                               |
| ------------------ | --------------------------------------------------------- | -------------------------------------- |
| `title`            | `string`                                                  | plant name heading (FR-011)            |
| `location`         | `string`                                                  | location line (FR-011)                 |
| `operator`         | `string`                                                  | operator line (FR-011)                 |
| `capacityKwp`      | `number`                                                  | installed capacity, kWp (FR-011)       |
| `commissionedDate` | `string` (ISO `yyyy-mm-dd`)                               | commissioning date, localized (FR-011) |
| `inverters`        | `{ index: number, model: string, stringCount: number }[]` | per-inverter list (FR-012), any length |

**Source**: `main.js`'s `bootstrap()` already parses `data/base_vars.js` once into module-level
`plant` and passes it as `ctx.plant` to every view's `render(container, ctx)` — `welcome-view.js`
takes it from `ctx`, doesn't re-fetch.

**Failure mode** (FR-013): `plant` is `null` when `base_vars.js` failed to fetch/parse (`bootstrap`
already guards this — `plant` stays `null` and is passed through unchanged). The plant-details
panel renders `emptyStateBody('welcome.plantDetailsUnavailable')` (see `empty-state.js`) instead of
throwing; the carousel and chart regions are unaffected (SC-004).

## Today's Generation Series (view of the day chart's total series)

| Field        | Type                                    | Source                                                                       |
| ------------ | --------------------------------------- | ---------------------------------------------------------------------------- |
| `timestamps` | `number[]` (epoch ms)                   | `parseMinFile()` readings for today, same as day-view.js                     |
| `totalW`     | `number[]` (nullable entries preserved) | `sumPerInverter()` (chart-factory.js) over each reading's per-inverter power |

**Axis**: Uses `DAY_CHART_AXES.feedInW` from `config.js` unmodified (`{ max: 6000, step: 1000 }` as
of this plan) — no new axis definition, per FR-016.

**Failure mode** (FR-017): No readings for today (empty `min{yymmdd}.js` fetch, or file doesn't
exist yet) → chart region renders `emptyStateBody('welcome.chartUnavailable')` instead of an empty
ApexCharts mount.

## Relationships

```
main.js bootstrap()
  └─ plant: PlantMetadata | null ──────────────► welcome-view.js ─► plant-details-panel.js
config.js
  └─ PLANT_PHOTOS: string[] ───────────────────► welcome-view.js ─► photo-carousel.js
data/min{yymmdd}.js (today)
  └─ parseMinFile() → readings[] ──────────────► welcome-view.js ─► chart-factory.js
                                                                      renderChart(..., 'day-total', ...)
```

Each arrow is an independent data path — a failure on one (parse error, fetch 404, empty array)
does not block the other two, per SC-004 / FR-013 / FR-017.
