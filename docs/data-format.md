# Data Format Reference

All data files are plain text pushed by the SolarLog 500 datalogger via FTP.
They contain JavaScript assignment statements that are executed directly by the
browser when the file is loaded as a `<script>`. No JSON, XML, or binary formats
are used anywhere.

**Encoding**: UTF-8 compatible (original files are ISO-8859-1; all field values
are ASCII digits, dots, colons, pipes, and semicolons — no encoding-sensitive
characters appear in the data itself).

---

## base_vars.js — Plant Configuration

Pushed on configuration change. Contains the complete static description of the
plant and all connected inverters.

### Key scalar variables

```js
var AnlagenKWP = 6200; // total plant rated power in Wp (peak watts)
var AnzahlWR = 2; // number of inverters
var SollYearKWP = 900; // target specific yield in kWh/kWp/year
var Intervall = 300; // logging interval in seconds (5 min)
var Lang = 'DE'; // UI language: DE | EN | FR | IT | ES | NL | DK
var isTemp = false; // true if temperature sensor is connected
var Verguetung = 5180; // feed-in tariff in 0.1 ct/kWh  (= 51.80 ct/kWh)

var HPTitel = 'Photovoltaikanlage Allwang';
var HPBetreiber = 'Hubert Allwang';
var HPStandort = '92266 Ensdorf-Wolfsbach';
var HPModul = 'Sanyo HIP 205/210 NHE1';
var HPWR = 'SMA SB 4200 TL und SMA SB 2100TL';
var HPLeistung = '6,2 kWp';
var HPInbetrieb = '15.03.2006'; // commissioning date DD.MM.YYYY
var HPAusricht = 'Dachneigung 45°, 195 ° SSW';

var SLDatum = '29.07.26'; // date of last SolarLog update  DD.MM.YY
var SLUhrzeit = '15:20:09'; // time of last update           HH:MM:SS
```

### WRInfo[] — per-inverter metadata

One entry per inverter (0-indexed). Each entry is an Array with positional
fields plus named sub-arrays at specific indices:

```js
WRInfo[n] = new Array(
  [0]  serialType,          // e.g. "WR42MS05" — SolarLog internal type code
  [1]  serialNumber,        // e.g. "1100082120"
  [2]  ratedPowerWp,        // e.g. 4100  (Wp)
  [3]  phaseCount,          // 1 = single-phase
  [4]  modelName,           // e.g. "SB 4200 TL"
  [5]  stringCount,         // number of DC strings on this inverter
  [6]  stringNames[],       // Array of string label strings  e.g. ["Orange","Grün"]
  [7]  stringFlags[],       // Array of per-string flags
  [8]  maxAcPowerW,         // e.g. 4200
  [9]  stringRatedWp[],     // Array of per-string rated Wp   e.g. [2050, 2050]
  [10] unknown1,
  [11] unknown2,
  [12] unknown3,
  [13] unknown4,            // e.g. 972 (may relate to grid voltage nominal)
  [14] unknown5,
  ...
  [16] protocolVersion      // SMA protocol version (2 = SMA v2)
)
```

**This plant has:**

- WRInfo[0]: SB 4200 TL, 4100 Wp, 2 strings ("Orange", "Grün"), 2050 Wp each
- WRInfo[1]: SB 2100 TL, 2100 Wp, 1 string, 2100 Wp

The `stringCount` field (index 5) determines how many semicolon-separated DC
fields appear in the minute data for that inverter (see `min{YYMMDD}.js` below).

---

## min_cur.js — Current Real-Time Reading

Pushed every 5 minutes. Contains the most recent sensor snapshot.

```js
var Datum = '29.07.26'; // date of reading  DD.MM.YY
var Uhrzeit = '18:30:04'; // time of reading  HH:MM:SS

var Pac = 1653; // total AC power across all inverters, in W

var curStatusCode = new Array(AnzahlWR);
curStatusCode[0] = 7; // WR1 status code (7 = MPP tracking = normal operation)
curStatusCode[1] = 7; // WR2 status code

var curFehlerCode = new Array(AnzahlWR);
curFehlerCode[0] = 0; // WR1 error code (0 = no error)
curFehlerCode[1] = 0; // WR2 error code

var PacArr = [[1053], [600]]; // per-inverter AC power in W
// PacArr[inverterIndex][0] = AC watts

var PdcArr = [
  [608, 550, 0],
  [631, 0, 0],
];
// per-inverter, per-string DC power in W
// PdcArr[inverterIndex][stringIndex] = DC watts
// unused string slots are 0

var aPdc = new Array(1239, 550, 0);
// flattened DC power array across all strings
```

**Status codes (known values):**

| Code | Meaning                          |
| ---- | -------------------------------- |
| 0    | Off / no communication           |
| 3    | Starting up                      |
| 5    | Feed-in (below MPP threshold)    |
| 7    | MPP tracking (normal production) |
| 455  | Error / fault                    |

---

## min{YYMMDD}.js — Historical 5-Minute Interval Data

One file per calendar day. Filename encodes date as `YYMMDD` (e.g.,
`min260729.js` = 2026-07-29).

Each line appends one record to the global array `m[]`:

```js
m[mi++] = 'DD.MM.YY HH:MM:SS|<WR1-block>|<WR2-block>|...|<WRn-block>';
```

Records are stored in **reverse chronological order** (newest first).

### Per-inverter block format (current — epoch 3, 2013-01-04 to present)

Each inverter block is a semicolon-separated list:

**WR1 (2 strings, SB 4200 TL):** `PAC;PDC_str1;PDC_str2;daily_yield_Wh;UDC_str1;UDC_str2`
**WR2 (1 string, SB 2100 TL):** `PAC;PDC_str1;daily_yield_Wh;UDC_str1`

| Field               | Unit | Description                                                                  |
| ------------------- | ---- | ---------------------------------------------------------------------------- |
| PAC                 | W    | AC output power of this inverter                                             |
| PDC_str1 … PDC_strN | W    | DC input power per string                                                    |
| daily_yield_Wh      | Wh   | Cumulative daily energy yield counter for this inverter (resets at midnight) |
| UDC_str1 … UDC_strN | V    | DC string voltage per string                                                 |

### Concrete example

```
m[mi++]="01.07.25 13:00:00|3053;1592;1593;9293;347;338|1572;1693;4866;348"
```

| Part            | Value               | Meaning                                      |
| --------------- | ------------------- | -------------------------------------------- |
| Timestamp       | `01.07.25 13:00:00` | 2025-07-01 at 13:00                          |
| WR1 PAC         | 3053 W              | AC output of SB 4200 TL                      |
| WR1 PDC_str1    | 1592 W              | DC power from string "Orange"                |
| WR1 PDC_str2    | 1593 W              | DC power from string "Grün"                  |
| WR1 daily_yield | 9293 Wh             | Running daily yield of WR1 at this timestamp |
| WR1 UDC_str1    | 347 V               | DC voltage of string "Orange"                |
| WR1 UDC_str2    | 338 V               | DC voltage of string "Grün"                  |
| WR2 PAC         | 1572 W              | AC output of SB 2100 TL                      |
| WR2 PDC_str1    | 1693 W              | DC power from WR2's single string            |
| WR2 daily_yield | 4866 Wh             | Running daily yield of WR2 at this timestamp |
| WR2 UDC_str1    | 348 V               | DC voltage of WR2's string                   |

> **Historical format variants:** The block layout and inverter order changed
> twice between 2006 and 2013. See
> [data-format-daily.md](data-format-daily.md) for a full breakdown of all
> three epochs.

---

## days.js — Today's Daily Totals

Pushed every 5 minutes. Contains one record per inverter for today.

```js
da[dx++] = 'DD.MM.YY|WR1_yield_Wh;WR1_peak_W|WR2_yield_Wh;WR2_peak_W';
```

Example:

```js
da[dx++] = '29.07.26|9748;3209|5070;1645';
```

| Field     | Value      | Meaning                         |
| --------- | ---------- | ------------------------------- |
| Date      | `29.07.26` | 2026-07-29                      |
| WR1 yield | 9748 Wh    | Total AC energy from WR1 today  |
| WR1 peak  | 3209 W     | Maximum AC power from WR1 today |
| WR2 yield | 5070 Wh    | Total AC energy from WR2 today  |
| WR2 peak  | 1645 W     | Maximum AC power from WR2 today |

Total today: 9748 + 5070 = **14,818 Wh ≈ 14.8 kWh**

---

## days_hist.js / days_hist_06.js … days_hist_09.js — Historical Daily Totals

Same format as `days.js`, but covering completed past days. The early years
(2006–2009) are split into separate files (`days_hist_06.js`, etc.) due to
file size. More recent years are combined into `days_hist.js`.

All four `days_hist_0?.js` files plus `days_hist.js` are loaded sequentially
for mode 4 (year-over-year comparison) so the complete history is available.

---

## months.js — Monthly Energy Totals

```js
mo[mx++] = '01.MM.YY|WR1_yield_Wh|WR2_yield_Wh';
```

Records are stored in **reverse chronological order** (newest first).
The date is always the 1st of the month.

Example:

```js
mo[mx++] = '01.07.26|532224|263424';
```

| Field     | Value      | Meaning                                 |
| --------- | ---------- | --------------------------------------- |
| Month     | `01.07.26` | July 2026 (partial — in-progress month) |
| WR1 yield | 532,224 Wh | WR1 energy for this month (532.2 kWh)   |
| WR2 yield | 263,424 Wh | WR2 energy for this month (263.4 kWh)   |
| Total     | —          | 795,648 Wh ≈ **795.6 kWh**              |

---

## years.js — Yearly Energy Totals

```js
ye[yx++] = '01.01.YY|WR1_yield_Wh|WR2_yield_Wh';
```

Records are stored in **reverse chronological order** (newest first).
The date is always January 1st of the year.

Example:

```js
ye[yx++] = '01.01.25|4340494|2304982';
```

| Field     | Value        | Meaning                         |
| --------- | ------------ | ------------------------------- |
| Year      | `01.01.25`   | Calendar year 2025              |
| WR1 yield | 4,340,494 Wh | WR1 annual energy (4,340.5 kWh) |
| WR2 yield | 2,304,982 Wh | WR2 annual energy (2,305.0 kWh) |
| Total     | —            | 6,645,476 Wh ≈ **6,645 kWh**    |

**Full year history (2006–2026, both inverters combined):**

| Year | WR1 Wh    | WR2 Wh    | Total kWh                                       |
| ---- | --------- | --------- | ----------------------------------------------- |
| 2026 | 2,910,255 | 1,493,488 | 4,404 (partial)                                 |
| 2025 | 4,340,494 | 2,304,982 | 6,645                                           |
| 2024 | 3,909,707 | 2,076,400 | 5,986                                           |
| 2023 | 4,180,844 | 2,207,790 | 6,389                                           |
| 2022 | 4,450,725 | 2,332,538 | 6,783                                           |
| 2021 | 4,194,673 | 2,211,880 | 6,407                                           |
| 2020 | 4,269,791 | 2,248,203 | 6,518                                           |
| 2019 | 4,516,307 | 2,365,499 | 6,882                                           |
| 2018 | 4,619,535 | 2,415,591 | 7,035                                           |
| 2017 | 4,229,829 | 2,225,211 | 6,455                                           |
| 2016 | 4,053,421 | 2,139,028 | 6,192                                           |
| 2015 | 4,267,261 | 2,252,013 | 6,519                                           |
| 2014 | 4,074,741 | 2,155,704 | 6,230                                           |
| 2013 | 3,752,564 | 1,988,328 | 5,741                                           |
| 2012 | 4,355,736 | 2,284,957 | 6,641                                           |
| 2011 | 4,515,673 | 2,371,720 | 6,887                                           |
| 2010 | 3,703,507 | 1,971,885 | 5,675                                           |
| 2009 | 3,361,472 | 1,737,049 | 5,098                                           |
| 2008 | 4,406,812 | 2,157,474 | 6,564                                           |
| 2007 | 4,641,930 | 2,275,030 | 6,917                                           |
| 2006 | 4,126,343 | 2,117,828 | 6,244 (partial — plant commissioned 2006-03-15) |

---

## daysall.js — All-Days Cumulative Data

Used exclusively by mode 4 (year-over-year line comparison). Format is the same
as `days_hist*.js` — one record per day with per-inverter yield and peak.
This file aggregates the complete history into a single array load for the
comparison chart.

---

## Data Encoding Summary

| Separator       | Meaning                                               |
| --------------- | ----------------------------------------------------- |
| `\|` (pipe)     | Separates inverter blocks within a record             |
| `;` (semicolon) | Separates fields within an inverter block             |
| `.` (dot)       | Decimal point in date fields (DD.MM.YY or DD.MM.YYYY) |
| `:` (colon)     | Time separator in timestamp field                     |

All energy values are in **Wh** (watt-hours) — divide by 1000 for kWh.
All power values are in **W** (watts).
All voltage values are in **V** (volts).
Dates use **DD.MM.YY** (2-digit year) in all data files.
