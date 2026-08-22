# Contract: Live Status Endpoint

This is an external interface the browser _consumes_ (not one this app exposes) — documented here
per plan.md's "define interface contracts" step because this feature's whole purpose is a new
network dependency the navbar panel relies on. There is no server in this project that could
define/version this endpoint; it's owned by the SolarLog live-status device/script.

## Request

```
GET https://wolfsbach.synology.me/live/index.php
```

- No query parameters, no request body, no auth headers (per spec Assumptions).
- Fetched directly by absolute URL from the browser — not proxied through the dev server (see
  research.md §1).

## Response (success shape)

```json
{
  "watt": 600,
  "timestamp": "2026-08-22T09:21:05",
  "sources": {
    "solarlog": {
      "watt": 600,
      "ok": true,
      "error": null,
      "inverters": [
        { "index": 0, "ac_w": 430, "dc_w": [678, 677], "status": 7, "error": 0 },
        { "index": 1, "ac_w": 170, "dc_w": [186], "status": 7, "error": 0 }
      ]
    }
  }
}
```

| Field                          | Type             | Consumed by this feature?                                             |
| ------------------------------ | ---------------- | --------------------------------------------------------------------- |
| `watt`                         | `number`         | Yes — the displayed aggregate wattage.                                |
| `timestamp`                    | `string`         | Yes — drives the "as of" display (FR-007).                            |
| `sources.solarlog.ok`          | `boolean`        | Yes — must be `true` for the reading to count as successful (FR-004). |
| `sources.solarlog.watt`        | `number`         | No — the top-level `watt` is used, not this per-source echo.          |
| `sources.solarlog.error`       | `string \| null` | No — not surfaced to the UI (data-model.md).                          |
| `sources.solarlog.inverters[]` | `array`          | No — explicitly out of scope (spec Edge Cases).                       |

If a future revision adds more `sources.*` entries alongside `solarlog`, this feature does not
need to change: it reads only `sources.solarlog.ok` as its health flag, per FR-004's "or
equivalent per-source health flag if multiple sources exist" wording (a multi-source aggregate
health rule is out of scope unless a future feature asks for it).

## Classification rules this feature applies (FR-004)

A response counts as a **successful reading** only when _all_ of the following hold:

1. The `fetch()` call resolves without throwing (no network error).
2. `response.ok` is `true` (2xx status).
3. The body parses as JSON.
4. `watt` is present at the top level and `Number.isFinite(watt)`.
5. `sources.solarlog.ok === true`.

Any other outcome — thrown fetch, non-2xx, unparseable JSON, missing/non-numeric `watt`, or
`sources.solarlog.ok` not strictly `true` — is a **failed reading**: `{ available: false }`, no
further detail surfaced (data-model.md).

## Versioning / compatibility notes

This project doesn't control the endpoint, so there's no version negotiation. If the endpoint's
shape changes incompatibly in the future (e.g. `watt` renamed, `sources` restructured), that's a
breaking change to this contract requiring a follow-up feature/spec update — not something this
plan can anticipate further.
