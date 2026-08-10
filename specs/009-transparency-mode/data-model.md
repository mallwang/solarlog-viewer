# Phase 1 Data Model: Transparency Mode

This feature introduces one client-side preference entity. It has no relationship to, and does not alter, the SolarLog data model (`base_vars.js`, `min*.js`, `days.js`, `months.js`, `years.js`, etc.) — see Constitution Principle I.

## Entity: Transparency Mode Setting

| Field | Type | Description | Validation |
|---|---|---|---|
| `enabled` | boolean | Whether transparency mode is currently on. | Must be `true` or `false`; any other stored value is treated as `false` (default off). |

### Storage representation

- **Location**: Browser `localStorage`, key `solarlog-transparency`.
- **Serialized form**: the string `"true"` or `"false"` (mirrors the simplicity of `web/js/i18n.js`'s `solarlog-lang` key, which stores a raw string rather than JSON).
- **Default**: absent key ⇒ `enabled = false` (today's fully opaque behavior — no change for users who never touch the setting).

### Derived presentation values

These are not stored — they are computed/applied purely via CSS custom properties keyed off the `enabled` state, per `research.md`:

| Token (in `web/css/tokens.css`) | Applies to | Value when `enabled = true` | Value when `enabled = false` |
|---|---|---|---|
| `--transparency-nav-opacity` | Header nav (`app-nav`) and period nav (`period-nav`) backgrounds | `0` (fully transparent) | `1` (current opaque background) |
| `--transparency-panel-opacity` | Chart-container cards and `stats-panel` | `0.4` (40% opacity) | `1` (current opaque background) |

### State transitions

```
[off] --(user toggles control ON)--> [on]
[on]  --(user toggles control OFF)--> [off]
```

- Both transitions are synchronous, client-side only, and take effect immediately (FR-007) without a page reload.
- Both transitions immediately persist the new `enabled` value to `localStorage` (FR-006).
- No transition affects any other stored preference (e.g. `solarlog-lang`) or any SolarLog data file.

### Relationships

- **None to SolarLog data entities.** This setting only affects the CSS presentation layer of the existing dashboard/nav/chart components; it does not read, derive from, or write to any `.js` data file, and it does not affect `days_hist`/`months`/`years` aggregates, CO₂ figures, or Soll/Ist stats — those continue to compute and render identically, just under altered opacity.
- **Independent of** the existing language preference (`solarlog-lang`) and the sky-location cache (`sky-geocode:*`) — each is its own `localStorage` key, no shared state.
