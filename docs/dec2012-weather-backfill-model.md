# December 2012 weather/snow-informed backfill model

## Purpose

`TASK_backfill_empty_min_files.md` flags 19 December 2012 min-files
(`min121208.js`–`min121225.js`, `min121231.js`) whose `days_hist.js` daily
totals are `0;0|0;0` — no known daily split exists to scale a donor curve
against, only a whole-month reading of **126 kWh** (technician meter read,
supersedes the internal `months.js` value of 113.898 kWh — see
[Reconciliation](#reconciliation)).

**Scope correction (per user, post-dating the first draft of this doc):**
26.–30.12.2012 (`13225;6773` Wh/day in `days_hist.js`) was manually added by
distributing the leftover of 113,890 Wh minus the 01.–07.12 sum evenly across
those 5 days — it is **not** real measured data and must be treated as
missing (0), same as the other 19 days. The actual missing-day pool is
therefore **24 days** (08.–31.12), not 19, and the only trustworthy ground
truth for December 2012 is 01.–07.12. See the updated
[Reconciliation](#reconciliation) and [Worked example](#worked-example-08122012)
below.

This doc records the data sources, method, and intermediate numbers used to
derive a per-day production estimate for that gap, so the approach can be
re-run, extended to the remaining 23 days, or challenged/fine-tuned later
without redoing the data collection.

## Site parameters used (from `base_vars.js`)

| Param | Value | Source |
|---|---|---|
| Location | Ensdorf-Wolfsbach, 92266 (Bavaria, DE) | `HPStandort` |
| Coordinates | 49.37° N, 11.92° E | geocoded from postal address (web search, not in repo) |
| Peak power | 6.2 kWp | `AnlagenKWP` / `HPLeistung` |
| Roof tilt | 45° | `HPAusricht` |
| Roof azimuth | 195° (SSW, compass) → 15° in PVGIS convention (0=S, +=W) | `HPAusricht` |
| Inverters | SB 4200TL + SB 2100TL | `WRInfo` |
| Install date | 15.03.2006 | `HPInbetrieb` |

## Data sources

1. **Open-Meteo Historical Weather API** (ERA5 reanalysis) — cloud cover,
   shortwave radiation, snowfall, snow depth. Free, no key required.
   ```
   https://archive-api.open-meteo.com/v1/archive?latitude=49.37&longitude=11.92&start_date=2012-12-01&end_date=2012-12-31&daily=sunshine_duration,cloud_cover_mean,shortwave_radiation_sum&timezone=Europe%2FBerlin

   https://archive-api.open-meteo.com/v1/archive?latitude=49.37&longitude=11.92&start_date=2012-12-01&end_date=2012-12-31&daily=snowfall_sum,snow_depth_max&timezone=Europe%2FBerlin
   ```
2. **PVGIS v5.2 seriescalc** (EU JRC, SARAH2 satellite irradiance +
   PV system model) — hourly modeled panel-plane output for the *actual*
   system spec (tilt/azimuth/peak power), not just horizontal irradiance.
   Free, no key required. Returns full-year hourly data (~830 KB JSON) —
   fetch with `curl`/Bash, not WebFetch (WebFetch's summarizer truncates
   large JSON before reaching December).
   ```
   curl -s "https://re.jrc.ec.europa.eu/api/v5_2/seriescalc?lat=49.37&lon=11.92&startyear=2012&endyear=2012&pvcalculation=1&peakpower=6.2&loss=14&angle=45&aspect=15&outputformat=json" -o pvgis_2012.json
   ```
   Daily Wh totals extracted via:
   ```js
   const data = JSON.parse(fs.readFileSync("pvgis_2012.json"));
   const dec = data.outputs.hourly.filter(h => h.time.startsWith("201212"));
   const byDay = {};
   for (const h of dec) {
     const day = h.time.slice(6, 8);
     byDay[day] = (byDay[day] || 0) + h.P; // 1h steps, so W == Wh
   }
   ```
3. **`days_hist.js`** (repo, ground truth for days with real readings) —
   identity convention: field 1 = SB4200 Wh, field 2 = SB2100 Wh (see
   `TASK_backfill_empty_min_files.md` for why this matters).
4. **`months.js`** (repo) — monthly aggregate, used only for cross-checking,
   not trusted as primary (see below).

## Reconciliation: which "total" to trust

| Source | Dec 2012 total | Status |
|---|---|---|
| `months.js` (`74348;39550`) | 113,898 Wh | Contaminated — includes the manual 26.–30.12 fill, not independent |
| Sum of `days_hist.js`, 01.–07.12 only | 13,900 Wh | **Trusted** — real minute-level data |
| Sum of `days_hist.js`, 26.–30.12 (`13225;6773`×5) | 99,990 Wh | **Not trusted — manually fabricated flat fill, treat as missing** |
| User-provided technician meter reading | **126,000 Wh** | **Trusted** — whole-month ground truth |

`months.js` (113,898 Wh) ≈ 01.–07.12 (13,900 Wh) + the manual 26.–30.12 fill
(99,990 Wh) = 113,890 Wh. This confirms `months.js` itself was derived from
(or back-filled to match) the same manual 26.–30.12 distribution, so it
carries no independent evidentiary weight — it should not be used to
sanity-check the remainder calculation.

**Corrected remainder to distribute:** 126,000 − 13,900 (only 01.–07.12
trusted) = **112,100 Wh**, spread across all **24 missing days** (08.–31.12,
including the previously-assumed-real 26.–30.12).

## Method

1. Pull ERA5 daily radiation/cloud cover for all of December 2012.
2. **Validation step**: correlate against the one week of trustworthy real
   data (01.–07.12, real minute files, non-zero `days_hist.js`). Result:
   correlation between raw horizontal shortwave radiation and real Wh is
   weak/negative (r ≈ −0.28, n=7) — raw irradiance alone does not explain
   this week's output.
3. Pull PVGIS hourly modeled output for the *actual tilted system* (not
   horizontal irradiance) for the same days. Correlation with real Wh is
   **more strongly negative** (see table below) — ruling out "wrong
   irradiance proxy" as the explanation.
4. Pull ERA5 snow depth / snowfall. Overlay against the model/real ratio:
   production collapses (ratio 0.04–0.18) specifically on days where snow
   has *settled* (depth plateaued, no fresh fall that day: 06.–07.12),
   while days with fresh snowfall or bare panels track the model much more
   closely (ratio 0.53–1.5). This is the working hypothesis that explains
   the negative correlation in step 3.
5. Derate the PVGIS model output for a target day by the average real/model
   ratio of the nearest real day(s) in the **same snow regime** (settled
   snow vs. fresh/no snow), rather than applying a single fixed factor
   across the whole month.

## Reference table: 01.–08.12.2012

| Date | Snow depth (m) | Fresh snowfall (cm) | PVGIS model (Wh) | Real (Wh, `days_hist.js`) | Real/Model ratio |
|---|---|---|---|---|---|
| 01 | 0.11 | 0.00 | 2445 | 2525 | 1.03 |
| 02 | 0.12 | 1.33 | 4997 | 2897 | 0.58 |
| 03 | 0.14 | 2.31 | 3868 | 2037 | 0.53 |
| 04 | 0.18 | 5.88 | 1841 | 1280 | 0.70 |
| 05 | 0.21 | 3.71 | 2713 | 4058 | 1.50 |
| 06 | 0.21 | 0.56 | 4612 | 819 | 0.18 |
| 07 | 0.21 | 0.00 | 7178 | 284 | 0.04 |
| 08 | 0.21 | 0.00 | 7719 | *(target)* | *(est. 0.11, avg of 06/07)* |

Full PVGIS daily totals for all of December (Wh, un-derated model output,
useful for the whole 24-day missing pool):

```
01 2445  02 4997  03 3868  04 1841  05 2713  06 4612  07 7178
08 7719  09 3279  10 1426  11 2887  12 6316  13 11975 14 4179
15 2103  16 7591  17 2947  18 2745  19 4371  20 10997 21 2396
22 3182  23 964   24 12576 25 11838 26 6529  27 4096  28 4866
29 21060 30 9025  31 16125
```

Full snow data for December (depth m / fresh fall cm):

```
01 0.11/0.00  02 0.12/1.33  03 0.14/2.31  04 0.18/5.88  05 0.21/3.71
06 0.21/0.56  07 0.21/0.00  08 0.21/0.00  09 0.24/2.66  10 0.26/3.15
11 0.27/0.56  12 0.27/0.00  13 0.27/0.00  14 0.27/0.28  15 0.26/0.00
16 0.24/0.00  17 0.21/0.91  18 0.19/0.00  19 0.16/0.00  20 0.14/0.00
21 0.18/5.04  22 0.18/0.00  23 0.15/0.00  24 0.05/0.00  25 0.02/0.00
26 0.01/0.00  27 0.00/0.00  28 0.00/0.00  29 0.00/0.00  30 0.00/0.00
31 0.00/0.00
```

## Worked example: 08.12.2012

Two-step method: (1) derate each missing day's PVGIS model by a snow-regime
ratio calibrated from 01.–07.12, (2) normalize the 24 derated day-weights so
they sum to the trusted 112,100 Wh remainder — this uses the snow model only
to shape the *distribution*, while the *total* still comes from the
technician reading, not from the (unreliable) absolute derating factors.

Derating buckets (calibrated from the only 7 trusted days):
- **Settled snow** (depth ≥ 0.14 m, 0 fresh fall that day — matches 06./07.12
  conditions): ratio = mean(0.18, 0.04) = **0.11**
- **Fresh snowfall that day** (any depth, fresh fall > 0 — matches
  02.–05.12): ratio = mean(0.58, 0.53, 0.70, 1.50) = **0.87**
- **Bare/near-bare panels** (depth ≤ 0.05 m — no calibration day available;
  extrapolated from 01.12's ratio of 1.03 as the closest analog): ratio =
  **1.00** (flagged as an assumption, see [Open questions](#open-questions-for-further-investigation--fine-tuning))

For 08.12: PVGIS model 7719 Wh, snow depth 0.21 m, 0 fresh fall → settled-snow
bucket, ratio 0.11 → derated weight 849 Wh.

Summed derated weight across all 24 missing days (08.–31.12) = 107,380 Wh.
Normalization scale = 112,100 / 107,380 = **1.044**.

- **08.12 estimate: 849 × 1.044 ≈ 886 Wh**, split by the 01.–07.12 inverter
  ratio (SB4200 : SB2100 ≈ 59.1 : 40.9) → ≈ 524 Wh SB4200 / 362 Wh SB2100.

### Estimates for all 24 missing days (normalized, Wh)

```
08  886   09 2978   10 1295   11 2622   12  725   13 1375   14 3796
15  242   16  871   17 2677   18  315   19  502   20 1263   21 2176
22  365   23  111   24 13129  25 12359  26 6816   27 4276   28 5080
29 21987  30 9422   31 16835
```
(sum ≈ 112,105 Wh, matching the 112,100 Wh remainder within rounding)

These replace the earlier (pre-correction) 19-day/12,110 Wh figures. Note
how the shape changed once 26.–30.12 was moved from "known" into the
snow-free tail of the missing pool: those 5 days now carry large individual
estimates (5,080–21,987 Wh) because their bare-panel ratio (1.00) combined
with high PVGIS irradiance late in the month, not because of any daily
reading.

## Open questions for further investigation / fine-tuning

- Only 7 real days (01.–07.12) are available to calibrate the snow-derating
  factor — a 2-bucket average (settled vs. fresh/no snow) is a coarse model.
  More granular buckets (e.g. derate as a function of days-since-last-fresh-
  snowfall) would need more calibration points, possibly from other
  years/months with similar snow patterns in this dataset.
- Day 05 breaks the "fresh snow ⇒ high ratio" pattern (ratio 1.50, the
  highest of the week) — not yet explained; could be measurement noise,
  partial melt during the day, or wind-clearing.
- **The "bare panels" ratio (1.00, used for 24.–31.12) has zero calibration
  data** — none of the 7 trusted days had snow depth below 0.11 m. It's
  extrapolated from 01.12's 1.03 ratio (the lowest-snow trusted day) as the
  closest available analog. This is the single biggest unvalidated
  assumption in the model, and it drives the largest absolute estimates
  (24.–31.12 account for ~74,900 of the 112,100 Wh remainder). Worth
  checking against another snow-free December elsewhere in the archive
  (same site, different year) if one exists with real data, purely to test
  whether ratio ≈ 1.0 is reasonable for this system.
- Now resolved: the 26.–30.12 flat-total was confirmed by the user to be a
  manual fill, not real data (see [Purpose](#purpose) scope correction) —
  folded into the 24-day missing pool above rather than left as an open
  question.
- Not yet checked: whether other zero-aggregate clusters in the task doc
  (Jan 2010, Feb 2010 etc.) show a similar snow-suppression signature —
  worth testing before assuming this method generalizes beyond Dec 2012.
