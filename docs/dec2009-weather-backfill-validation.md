# December 2009 validation of the weather/snow-informed backfill model

## Purpose

[`dec2012-weather-backfill-model.md`](dec2012-weather-backfill-model.md) derives
December 2012 daily estimates from a snow-derated PVGIS model, calibrated on
only 7 real days (01.–07.12.2012) and normalized to a technician meter
reading. Before applying it to the 24 missing Dec 2012 days, this doc tests
the same method against **December 2009**, a month where all 31 days have
real `days_hist.js` minute-level data, to see how well it would have
predicted days it wasn't calibrated on.

## Ground truth

Sum of `days_hist.js`, 01.–31.12.2009 (field1 + field2): **105,263 Wh**.
Cross-check against `months.js` (`01.12.09|65822|39472` = 105,294 Wh): matches
within rounding (29 Wh, 0.03%). Unlike Dec 2012, Dec 2009 has no manual-fill
contamination — this is a clean, fully independent validation set.

## Method (identical to the Dec 2012 doc)

1. Pulled Open-Meteo ERA5 snow depth / fresh snowfall and PVGIS v5.2
   seriescalc hourly modeled output for Dec 2009, same site params (49.37°N
   11.92°E, 6.2 kWp, 45° tilt, 15° PVGIS azimuth).
2. Calibrated snow-regime ratios (real/model) on 01.–07.12.2009 only, using
   the same 3-bucket rule as the Dec 2012 doc (settled: depth ≥0.14m & no
   fresh fall; fresh: any depth with fresh fall >0; bare: depth ≤0.05m).
3. Applied bucket ratios to the remaining 24 days (08.–31.12.2009) —
   pretending they were unknown — to get a raw estimate.
4. Normalized the 24-day raw estimate to the *true* remainder (91,500 Wh,
   known here but analogous to the technician reading in the Dec 2012 case)
   to isolate distribution-shape error from total error.
5. Compared normalized per-day estimates against actual `days_hist.js`
   values.

Snow depth in Dec 2009 never exceeded 0.06 m — essentially a snow-free month
— so the calibration week had **no "settled snow" example**, and (mirroring
the Dec 2012 doc's own gap) the "settled" bucket had to fall back to the
"bare" ratio. Calibration buckets and ratios:

| Bucket | Calib. days | Ratios | Mean |
|---|---|---|---|
| settled | none | — | falls back to bare = 0.556 |
| fresh | 1 (04.12, real/model 0.43) | 0.43 | 0.435 |
| bare | 6 (01,02,03,05,06,07.12) | 0.42, 0.68, 0.39, 0.67, 0.67, 0.50 | **0.556** |

## Results

Raw (unnormalized) 24-day remainder estimate: **77,564 Wh** vs actual
**91,500 Wh** — total off by **−15.2%**. In the same ballpark, similar
magnitude to the kind of error the Dec 2012 total estimate could carry if
normalized against a wrong technician reading, though here it's the shape
prediction alone that's off since the total is forced correct in step 4.

Per-day, even after normalizing to the true total (the best case — Dec 2012
doesn't get this benefit at the daily level, only the monthly level), error
is large:

- **MAPE across the 24 predicted days: 72.7%**
- Worst misses: 19.12 (+341%), 20.12 (+210%), 21.12 (+517%) — three
  consecutive real days where actual production collapsed (251–1809 Wh)
  despite a decent PVGIS model and only light fresh snowfall, i.e. some
  other unmodeled factor (dense fog/haze, rime, local shading) suppressed
  output that snow depth/fresh-fall doesn't explain.
- Best days: 15.12, 17.12, 30.12 — within ±7%.

## Implication for the Dec 2012 model

**The "bare panels" ratio should not be 1.00.** The Dec 2012 doc's largest
unvalidated assumption was extrapolating a ratio of 1.00 for snow-free days
(24.–31.12.2012, ~74,900 of the 112,100 Wh remainder) from a single data
point (01.12's ratio of 1.03). Dec 2009 — an actual snow-free week with real
data — gives a calibrated bare-panel ratio of **0.556**, roughly half.
Applying 1.00 instead of ~0.55 would inflate the 24.–31.12.2012 estimates by
roughly 2x, which is a large chunk of the total remainder. **Recommendation:
re-derive the Dec 2012 "bare panels" bucket using 0.55–0.60 (this
month's calibrated value) instead of 1.00**, pending any Dec-2012-specific
signal that would justify a higher figure.

**Daily-level estimates should be treated as low-confidence.** Even with a
full month of real data and best-case normalization, individual-day error
routinely exceeds 100% (up to 500%+ on 3 of 24 days). The monthly *total*
(when anchored to an external reading, as Dec 2012 is) is far more trustworthy
than any single derived day. Anyone consuming the Dec 2012 backfilled daily
values (e.g. for day-level charts) should be aware individual days carry
wide, unquantified error bars, even though the anchored monthly sum is
reasonably sound.

## Data sources

Same as the Dec 2012 doc, re-fetched for 2009:

```
https://archive-api.open-meteo.com/v1/archive?latitude=49.37&longitude=11.92&start_date=2009-12-01&end_date=2009-12-31&daily=snowfall_sum,snow_depth_max,sunshine_duration,cloud_cover_mean,shortwave_radiation_sum&timezone=Europe%2FBerlin

curl -s "https://re.jrc.ec.europa.eu/api/v5_2/seriescalc?lat=49.37&lon=11.92&startyear=2009&endyear=2009&pvcalculation=1&peakpower=6.2&loss=14&angle=45&aspect=15&outputformat=json" -o pvgis_2009.json
```

## Open questions

- The 19.–21.12.2009 collapse (real/model ratio as low as 0.08 on the 21st)
  is unexplained by snow alone — worth checking `cloud_cover_mean` /
  `sunshine_duration` for those days, or whether this is a recurring
  fog/inversion pattern at this site in this specific week each year.
- Should re-run this same validation against a second snow-affected month
  (Dec 2009 barely has settled snow, so the "settled" bucket ratio of 0.11
  from Dec 2012 is still uncalibrated against any independent month).
