# min{YYMMDD}.js — Format Evolution

Historical 5-minute interval files span 2006 to the present and contain
**three distinct block formats** depending on the recording period. The
differences reflect two SolarLog reconfigurations:

- **2007-03-28**: UDC voltage columns added to the 2-string inverter block
- **2013-01-04**: Inverter block order swapped to match the current `WRInfo[]`
  assignment (SB 4200 TL became WR1, SB 2100 TL became WR2)

All files share the same outer record structure:

```js
m[mi++] = 'DD.MM.YY HH:MM:SS|<block-1>|<block-2>';
```

Records are stored in **reverse chronological order** (newest first).

---

## Epoch overview

| Period                  | Files                           | Block 1            | Block 2                    | Fields |
| ----------------------- | ------------------------------- | ------------------ | -------------------------- | ------ |
| 2006-11-03 … 2007-03-27 | `min061103.js` … `min070327.js` | SB 2100 TL (1 str) | SB 4200 TL (2 str, no UDC) | 4 \| 4 |
| 2007-03-28 … 2012-12-04 | `min070328.js` … `min121204.js` | SB 2100 TL (1 str) | SB 4200 TL (2 str)         | 4 \| 6 |
| 2013-01-04 … present    | `min130104.js` … `min_cur.js`   | SB 4200 TL (2 str) | SB 2100 TL (1 str)         | 6 \| 4 |

---

## Epoch 1 — 2006-11-03 to 2007-03-27 (4 | 4 fields)

Block order: **block 1 = SB 2100 TL, block 2 = SB 4200 TL.**

Block 2 (2-string inverter) does not yet include UDC voltage columns.

### Block 1 — SB 2100 TL, 1 string

```
PAC ; PDC_str1 ; daily_yield_Wh ; UDC_str1
```

| Field          | Unit | Description                                        |
| -------------- | ---- | -------------------------------------------------- |
| PAC            | W    | AC output power (rated max: 2100 W)                |
| PDC_str1       | W    | DC input power from the single string              |
| daily_yield_Wh | Wh   | Cumulative daily energy yield (resets at midnight) |
| UDC_str1       | V    | DC string voltage                                  |

### Block 2 — SB 4200 TL, 2 strings (no UDC)

```
PAC ; PDC_str1 ; PDC_str2 ; daily_yield_Wh
```

| Field          | Unit | Description                                        |
| -------------- | ---- | -------------------------------------------------- |
| PAC            | W    | AC output power (rated max: 4200 W)                |
| PDC_str1       | W    | DC power from string "Orange"                      |
| PDC_str2       | W    | DC power from string "Grün"                        |
| daily_yield_Wh | Wh   | Cumulative daily energy yield (resets at midnight) |

### Concrete example

```
m[mi++]="03.11.06 15:00:00|1314;1399;6653;406|2529;1346;1339;13059"
```

| Part             | Value               | Meaning                              |
| ---------------- | ------------------- | ------------------------------------ |
| Timestamp        | `03.11.06 15:00:00` | 2006-11-03 at 15:00                  |
| Block 1 PAC      | 1314 W              | SB 2100 TL AC output                 |
| Block 1 PDC_str1 | 1399 W              | DC power from single string          |
| Block 1 yield    | 6653 Wh             | Cumulative daily yield of SB 2100 TL |
| Block 1 UDC_str1 | 406 V               | DC string voltage                    |
| Block 2 PAC      | 2529 W              | SB 4200 TL AC output                 |
| Block 2 PDC_str1 | 1346 W              | DC power from string "Orange"        |
| Block 2 PDC_str2 | 1339 W              | DC power from string "Grün"          |
| Block 2 yield    | 13059 Wh            | Cumulative daily yield of SB 4200 TL |

---

## Epoch 2 — 2007-03-28 to 2012-12-04 (4 | 6 fields)

Block order unchanged: **block 1 = SB 2100 TL, block 2 = SB 4200 TL.**

UDC voltage columns were added to block 2.

### Block 1 — SB 2100 TL, 1 string

Identical to epoch 1.

```
PAC ; PDC_str1 ; daily_yield_Wh ; UDC_str1
```

| Field          | Unit | Description                                        |
| -------------- | ---- | -------------------------------------------------- |
| PAC            | W    | AC output power (rated max: 2100 W)                |
| PDC_str1       | W    | DC input power from the single string              |
| daily_yield_Wh | Wh   | Cumulative daily energy yield (resets at midnight) |
| UDC_str1       | V    | DC string voltage                                  |

### Block 2 — SB 4200 TL, 2 strings

```
PAC ; PDC_str1 ; PDC_str2 ; daily_yield_Wh ; UDC_str1 ; UDC_str2
```

| Field          | Unit | Description                                        |
| -------------- | ---- | -------------------------------------------------- |
| PAC            | W    | AC output power (rated max: 4200 W)                |
| PDC_str1       | W    | DC power from string "Orange"                      |
| PDC_str2       | W    | DC power from string "Grün"                        |
| daily_yield_Wh | Wh   | Cumulative daily energy yield (resets at midnight) |
| UDC_str1       | V    | DC voltage of string "Orange"                      |
| UDC_str2       | V    | DC voltage of string "Grün"                        |

### Concrete example

```
m[mi++]="13.04.09 13:00:00|1692;1829;4828;358|3295;1732;1731;9868;352;351"
```

| Part             | Value               | Meaning                              |
| ---------------- | ------------------- | ------------------------------------ |
| Timestamp        | `13.04.09 13:00:00` | 2009-04-13 at 13:00                  |
| Block 1 PAC      | 1692 W              | SB 2100 TL AC output                 |
| Block 1 PDC_str1 | 1829 W              | DC power from single string          |
| Block 1 yield    | 4828 Wh             | Cumulative daily yield of SB 2100 TL |
| Block 1 UDC_str1 | 358 V               | DC string voltage                    |
| Block 2 PAC      | 3295 W              | SB 4200 TL AC output                 |
| Block 2 PDC_str1 | 1732 W              | DC power from string "Orange"        |
| Block 2 PDC_str2 | 1731 W              | DC power from string "Grün"          |
| Block 2 yield    | 9868 Wh             | Cumulative daily yield of SB 4200 TL |
| Block 2 UDC_str1 | 352 V               | DC voltage of string "Orange"        |
| Block 2 UDC_str2 | 351 V               | DC voltage of string "Grün"          |

---

## Epoch 3 — 2013-01-04 to present (6 | 4 fields)

Block order **swapped** to match current `WRInfo[]` configuration.
**Block 1 = SB 4200 TL (WRInfo[0]), block 2 = SB 2100 TL (WRInfo[1]).**

This is the format described in [data-format.md](data-format.md) and the
one assumed by `getWRToken()` in `functions.js`.

### Block 1 — SB 4200 TL, 2 strings

```
PAC ; PDC_str1 ; PDC_str2 ; daily_yield_Wh ; UDC_str1 ; UDC_str2
```

| Field          | Unit | Description                                        |
| -------------- | ---- | -------------------------------------------------- |
| PAC            | W    | AC output power (rated max: 4200 W)                |
| PDC_str1       | W    | DC power from string "Orange"                      |
| PDC_str2       | W    | DC power from string "Grün"                        |
| daily_yield_Wh | Wh   | Cumulative daily energy yield (resets at midnight) |
| UDC_str1       | V    | DC voltage of string "Orange"                      |
| UDC_str2       | V    | DC voltage of string "Grün"                        |

### Block 2 — SB 2100 TL, 1 string

```
PAC ; PDC_str1 ; daily_yield_Wh ; UDC_str1
```

| Field          | Unit | Description                                        |
| -------------- | ---- | -------------------------------------------------- |
| PAC            | W    | AC output power (rated max: 2100 W)                |
| PDC_str1       | W    | DC input power from the single string              |
| daily_yield_Wh | Wh   | Cumulative daily energy yield (resets at midnight) |
| UDC_str1       | V    | DC string voltage                                  |

### Concrete example

```
m[mi++]="01.07.25 13:00:00|3053;1592;1593;9293;347;338|1572;1693;4866;348"
```

| Part             | Value               | Meaning                              |
| ---------------- | ------------------- | ------------------------------------ |
| Timestamp        | `01.07.25 13:00:00` | 2025-07-01 at 13:00                  |
| Block 1 PAC      | 3053 W              | SB 4200 TL AC output                 |
| Block 1 PDC_str1 | 1592 W              | DC power from string "Orange"        |
| Block 1 PDC_str2 | 1593 W              | DC power from string "Grün"          |
| Block 1 yield    | 9293 Wh             | Cumulative daily yield of SB 4200 TL |
| Block 1 UDC_str1 | 347 V               | DC voltage of string "Orange"        |
| Block 1 UDC_str2 | 338 V               | DC voltage of string "Grün"          |
| Block 2 PAC      | 1572 W              | SB 2100 TL AC output                 |
| Block 2 PDC_str1 | 1693 W              | DC power from single string          |
| Block 2 yield    | 4866 Wh             | Cumulative daily yield of SB 2100 TL |
| Block 2 UDC_str1 | 348 V               | DC string voltage                    |
