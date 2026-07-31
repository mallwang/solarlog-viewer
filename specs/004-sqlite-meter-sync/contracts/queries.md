# Contract: Diagram-view queries (US3)

These are the read queries each diagram view is expected to issue against the synced database.
They are documentation of the expected shape/contract for any future consumer code (e.g. a CLI
report or a future opt-in server-side integration per Constitution Principle III's exception) —
this feature does not wire these into the browser viewer (out of scope, see spec Assumptions).

## Daily view (FR-012, SC-005) — Mode 0

```sql
SELECT
  timestamp,
  MAX(CASE WHEN inverter = 'sb4200' THEN pac_w END) AS sb4200_pac_w,
  MAX(CASE WHEN inverter = 'sb2100' THEN pac_w END) AS sb2100_pac_w,
  SUM(pac_w) AS total_pac_w
FROM readings
WHERE date = :date
GROUP BY timestamp
ORDER BY timestamp;
```

Input: `:date` (`YYYY-MM-DD`). Output: one row per 5-minute timestamp for that date, with both
inverters' AC power and their sum — matches acceptance scenario US3.1.

## Monthly view (FR-013, SC-006) — Mode 1

```sql
SELECT date, sb4200_yield_wh, sb2100_yield_wh, total_yield_wh
FROM daily_yield_summary
WHERE date >= :month || '-01' AND date < :next_month || '-01'
ORDER BY date;
```

Input: `:month` (`YYYY-MM`), `:next_month` (`YYYY-MM` of the following month). Output: one row
per day in the month with both inverters' yield and the combined total — matches acceptance
scenario US3.2.

## Yearly view (FR-014, SC-007) — Mode 2

```sql
SELECT month, total_yield_wh
FROM monthly_yield_summary
WHERE substr(month, 1, 4) = :year
ORDER BY month;
```

Input: `:year` (`YYYY`). Output: one row per month in the year with the combined total yield only
(not per-inverter, not per-day) — matches acceptance scenario US3.3.

## Total / all-years view (FR-015, SC-008) — Mode 3

```sql
SELECT year, total_yield_wh
FROM yearly_yield_summary
ORDER BY year;
```

Output: one row per year with cumulative combined total yield — matches acceptance scenario
US3.4.
