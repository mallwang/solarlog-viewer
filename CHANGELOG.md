# Changelog

## [1.3.0](https://github.com/mallwang/solarlog-viewer/compare/v1.2.0...v1.3.0) (2026-08-22)

### Features

- **info-panel:** source live production wattage from live status endpoint ([#64](https://github.com/mallwang/solarlog-viewer/issues/64)) ([fa84173](https://github.com/mallwang/solarlog-viewer/commit/fa8417382ea23a0a612b6e068038a9a8d3decb0d))
- **nav:** move user guide link to standalone header icon ([#63](https://github.com/mallwang/solarlog-viewer/issues/63)) ([dd6c462](https://github.com/mallwang/solarlog-viewer/commit/dd6c462b973ff0a734a8d80458a2a5b5f7ec8037))
- render weather/forecast as compact icon-over-value indicators ([#62](https://github.com/mallwang/solarlog-viewer/issues/62)) ([a1003a5](https://github.com/mallwang/solarlog-viewer/commit/a1003a5a1fa77210c6bffb3002b8c200546abac2))

## [1.2.0](https://github.com/mallwang/solarlog-viewer/compare/v1.1.0...v1.2.0) (2026-08-18)

### Features

- **info-panel:** add weather icons, nighttime "clear" state, and tomorrow's forecast ([#59](https://github.com/mallwang/solarlog-viewer/issues/59)) ([06f7438](https://github.com/mallwang/solarlog-viewer/commit/06f7438c8fd975b03bc3d731a89ed7c6bf48e467))
- **statistics:** exclude backfilled days from records and streaks ([#57](https://github.com/mallwang/solarlog-viewer/issues/57)) ([d76d7d3](https://github.com/mallwang/solarlog-viewer/commit/d76d7d3f8490a9851653f9095cbffeeab09ca2ac))

### Bug Fixes

- **statistics:** distinguish real vs. estimated backfilled-day totals in record picks ([#58](https://github.com/mallwang/solarlog-viewer/issues/58)) ([0d383bb](https://github.com/mallwang/solarlog-viewer/commit/0d383bbc0d9145d6c8d92c0dc8a72f4d58a9c759))

## [1.1.0](https://github.com/mallwang/solarlog-viewer/compare/v1.0.0...v1.1.0) (2026-08-16)

### Features

- **statistics:** add Statistics page with streaks, trends, and heatmaps ([#56](https://github.com/mallwang/solarlog-viewer/issues/56)) ([aaff34b](https://github.com/mallwang/solarlog-viewer/commit/aaff34bcbc889e546d38338fd97c24be82f40ce4))

## 1.0.0 (2026-08-16)

### Features

- **002-data-validation-aggregation:** add feature spec and daily SolarLog data ([b274c86](https://github.com/mallwang/solarlog-viewer/commit/b274c861516a8972d29c8eed50c68e2d0b46b021))
- **002-data-validation-aggregation:** add implementation plan and design artifacts ([75448fc](https://github.com/mallwang/solarlog-viewer/commit/75448fc6f0cdaf7c93f7bdbf4e7a8c03efb4c994))
- **002-data-validation-aggregation:** add task list for validation & aggregation scripts ([3b6ab22](https://github.com/mallwang/solarlog-viewer/commit/3b6ab223196bbd6a6f7945116bd144adf90de3fa))
- **002-data-validation-aggregation:** extend backfill-min-day to support all three min-file epochs ([cbf29bd](https://github.com/mallwang/solarlog-viewer/commit/cbf29bd3628532f752156c64a603a22909c65531))
- **002-data-validation-aggregation:** extend gap-detect with --source days_hist, install date, and fix corrupted days_hist entries ([3114294](https://github.com/mallwang/solarlog-viewer/commit/3114294837df89f3e0dc3e5666d77f43186d37c6))
- **002-data-validation-aggregation:** implement validation & aggregation scripts ([d22661d](https://github.com/mallwang/solarlog-viewer/commit/d22661d91d78cfabca3a41fcd2661db15448aac4))
- add single-page dashboard, restructure into web/ ([#12](https://github.com/mallwang/solarlog-viewer/issues/12)) ([eab8fd9](https://github.com/mallwang/solarlog-viewer/commit/eab8fd948f02a63776fbe3bc8d657c15b8c82899))
- **backfill-min-day:** add backfill script and historical SolarLog data files ([e35c5c6](https://github.com/mallwang/solarlog-viewer/commit/e35c5c66c21a69195148ccf23d48cfd41bdbc204))
- **build:** add cache-busting production build step ([#42](https://github.com/mallwang/solarlog-viewer/issues/42)) ([1397c58](https://github.com/mallwang/solarlog-viewer/commit/1397c5853f2e45383b3e781d13e0fd8acc5c7f49))
- **chart-data-table:** add sticky, locale-formatted data table toggle under charts ([#29](https://github.com/mallwang/solarlog-viewer/issues/29)) ([8a414f9](https://github.com/mallwang/solarlog-viewer/commit/8a414f9d3ac202110409753f0c98403dcdc993c2))
- **charts:** add datetime x-axis, axis titles, and stale-reading timestamp ([#23](https://github.com/mallwang/solarlog-viewer/issues/23)) ([85d4c1e](https://github.com/mallwang/solarlog-viewer/commit/85d4c1e3e5d043b21a460e0bde8ec6c1ac18337f))
- **charts:** add per-inverter breakdown toggle and UDC/Wirkungsgrad legend persistence ([#24](https://github.com/mallwang/solarlog-viewer/issues/24)) ([fab5491](https://github.com/mallwang/solarlog-viewer/commit/fab54915577e0fa9fbf1bc6f7a15d1b68fd83ead))
- **dashboard:** add dynamic weather-driven sky background ([#15](https://github.com/mallwang/solarlog-viewer/issues/15)) ([63eb4e5](https://github.com/mallwang/solarlog-viewer/commit/63eb4e5035353cbc48eb7b718cf2f4f881e011e2))
- **dashboard:** add Tailwind UI, ApexCharts, drill-down nav, and Soll/Ist yield stats ([#13](https://github.com/mallwang/solarlog-viewer/issues/13)) ([b2285e1](https://github.com/mallwang/solarlog-viewer/commit/b2285e116a1260159cdf36f2741e36406c998dc2))
- **dashboard:** show CO2 avoidance figures using yearly UBA emission factors ([#14](https://github.com/mallwang/solarlog-viewer/issues/14)) ([a3a4cf1](https://github.com/mallwang/solarlog-viewer/commit/a3a4cf1f20fa5337d345434b783ba2ad8c38685a))
- **data:** cache hist/data aggregate fetches across navigation ([#39](https://github.com/mallwang/solarlog-viewer/issues/39)) ([d55f180](https://github.com/mallwang/solarlog-viewer/commit/d55f180d9163c483adf36b08b1905293d9b4e25c))
- **day-chart:** show inverter efficiency (PAC/PDC) in info panel and day chart ([#22](https://github.com/mallwang/solarlog-viewer/issues/22)) ([f1a6e23](https://github.com/mallwang/solarlog-viewer/commit/f1a6e23ca35de2c06a9289c494575f7fbae8270f))
- **dev-server:** proxy /data requests to live SolarLog device ([#33](https://github.com/mallwang/solarlog-viewer/issues/33)) ([fd44230](https://github.com/mallwang/solarlog-viewer/commit/fd44230ab226390f14a3cfc707dfd186afe01dc4))
- **events:** add filterable, sortable events page ([#35](https://github.com/mallwang/solarlog-viewer/issues/35)) ([19cc968](https://github.com/mallwang/solarlog-viewer/commit/19cc9686b6c19ad99603d5d6a72eff08d2031fd1))
- **ftp-sync:** add FTP diff/sync script for SolarLog web data ([#27](https://github.com/mallwang/solarlog-viewer/issues/27)) ([99f6077](https://github.com/mallwang/solarlog-viewer/commit/99f6077c7f8c1ecd9f5b831959e09c8ccd531c91))
- **ftp-sync:** add replace action for stale cache-busted builds ([#50](https://github.com/mallwang/solarlog-viewer/issues/50)) ([a6ccaf5](https://github.com/mallwang/solarlog-viewer/commit/a6ccaf5b60d82437912cda1dbc2f4c709705095d))
- **global-info-panel:** merge production/weather panel into nav, disable dashboard route ([#19](https://github.com/mallwang/solarlog-viewer/issues/19)) ([f6a9294](https://github.com/mallwang/solarlog-viewer/commit/f6a92940238cbd801d99f06f4d948cc732ceba38))
- **navigation:** add zoom-out parent-period links to day/month/year views ([#16](https://github.com/mallwang/solarlog-viewer/issues/16)) ([5f182bc](https://github.com/mallwang/solarlog-viewer/commit/5f182bcbb15d656081fcea642019eb917f8784a4))
- **release:** add guided release-it workflow and skill ([#55](https://github.com/mallwang/solarlog-viewer/issues/55)) ([61ea909](https://github.com/mallwang/solarlog-viewer/commit/61ea9090fcc2b8911af6577147a595e19d575a08))
- **sky:** add configurable weather-driven background with off/fixed modes ([#36](https://github.com/mallwang/solarlog-viewer/issues/36)) ([fc7f46a](https://github.com/mallwang/solarlog-viewer/commit/fc7f46aaa249a4bc1d03ea40f08d04f6d3cc9b47))
- **sky:** add day/night sky background with starfield and falling star ([#38](https://github.com/mallwang/solarlog-viewer/issues/38)) ([31b0ede](https://github.com/mallwang/solarlog-viewer/commit/31b0ede16d2ce1cdc6c7d757cb0176b539b66db9))
- **sky:** add realistic animated sprite flying objects (birds, butterflies, dragonflies, geese) ([#20](https://github.com/mallwang/solarlog-viewer/issues/20)) ([a052e3f](https://github.com/mallwang/solarlog-viewer/commit/a052e3fac8b4eb4a6706378cc374c413a2d90976))
- **spec-kit:** add git extension with branch, commit, initialize, and remote skills ([#3](https://github.com/mallwang/solarlog-viewer/issues/3)) ([f4a87ce](https://github.com/mallwang/solarlog-viewer/commit/f4a87cebb416262125bb7d29cf29387218c3f7d3))
- **stats-panel:** add explanatory info tooltips and fix panel layout wrapping ([#44](https://github.com/mallwang/solarlog-viewer/issues/44)) ([793ded7](https://github.com/mallwang/solarlog-viewer/commit/793ded7c59fd0ce7b36be1b26ed1e5b0757ee631))
- **sync:** sync SolarLog archive into a local SQLite cache ([#4](https://github.com/mallwang/solarlog-viewer/issues/4)) ([42b9ede](https://github.com/mallwang/solarlog-viewer/commit/42b9ede62098ab4638cc847b09e03382377dca3b))
- **transparency-mode:** add global transparency toggle for sky background ([#18](https://github.com/mallwang/solarlog-viewer/issues/18)) ([43e8c62](https://github.com/mallwang/solarlog-viewer/commit/43e8c62bc7541c6f7c5143bba4006e8196e510b1))
- **ui:** replace favicon with new application icon ([#45](https://github.com/mallwang/solarlog-viewer/issues/45)) ([e6f93bb](https://github.com/mallwang/solarlog-viewer/commit/e6f93bbe5018f61032f6db6181a1040e355b5cb7))
- **ux-review:** store UX mockup HTML locally alongside design.md ([#40](https://github.com/mallwang/solarlog-viewer/issues/40)) ([927e72e](https://github.com/mallwang/solarlog-viewer/commit/927e72ef1ae4527eaed57ee2acb7b82269a46cb0))
- **validate:** add min-file consistency validation script ([#8](https://github.com/mallwang/solarlog-viewer/issues/8)) ([3730372](https://github.com/mallwang/solarlog-viewer/commit/3730372319c3d421c526c1ab0c06a06047afa42d))
- **welcome-page:** add plant dashboard as the default landing view ([#32](https://github.com/mallwang/solarlog-viewer/issues/32)) ([948f39c](https://github.com/mallwang/solarlog-viewer/commit/948f39c5ad6ece369a405c2ace71f732405763d1))

### Bug Fixes

- **background:** keep body gradient static while scrolling ([#41](https://github.com/mallwang/solarlog-viewer/issues/41)) ([afedea9](https://github.com/mallwang/solarlog-viewer/commit/afedea9e891015c0b1c3448f857f09d019004c47))
- **chart-data-table:** use local time for day-chart data table labels ([#30](https://github.com/mallwang/solarlog-viewer/issues/30)) ([6f8850c](https://github.com/mallwang/solarlog-viewer/commit/6f8850c22559bdda49c817274f1a1e78b0d4fed4))
- **data:** backfill missing daily minute files and fix epoch-1 boundary ([#5](https://github.com/mallwang/solarlog-viewer/issues/5)) ([4e543a9](https://github.com/mallwang/solarlog-viewer/commit/4e543a9fc7b1d6d84b0eb9b7a72ff50398b4b40b))
- **data:** regenerate days_hist.js from min files and repair 6 gappy min files ([#9](https://github.com/mallwang/solarlog-viewer/issues/9)) ([7784115](https://github.com/mallwang/solarlog-viewer/commit/77841155d4286c236dddaa76336a4823cf1c705e))
- **data:** regenerate months and years totals from corrected min files ([#10](https://github.com/mallwang/solarlog-viewer/issues/10)) ([1f720e2](https://github.com/mallwang/solarlog-viewer/commit/1f720e2447273d1eb3545816c35f0a41b95258ad))
- **day-chart:** align per-inverter feed-in y-axis scales ([#25](https://github.com/mallwang/solarlog-viewer/issues/25)) ([31951b9](https://github.com/mallwang/solarlog-viewer/commit/31951b96f64275892fe51fdb02ac8d3482e9edce))
- **day-chart:** correct UDC scale, add fixed axis ranges, and show UDC min/max band ([#26](https://github.com/mallwang/solarlog-viewer/issues/26)) ([10e9d74](https://github.com/mallwang/solarlog-viewer/commit/10e9d74b6daf1424bb450b8e97c8b8c54e794f69))
- **day-view:** show real current day at midnight instead of stale data ([#54](https://github.com/mallwang/solarlog-viewer/issues/54)) ([60b6e2c](https://github.com/mallwang/solarlog-viewer/commit/60b6e2cf70d9cd995ea1ca993275acd3f1820062))
- **e2e:** absorb live-proxy network jitter with retries and longer timeout ([#49](https://github.com/mallwang/solarlog-viewer/issues/49)) ([1ee9793](https://github.com/mallwang/solarlog-viewer/commit/1ee9793fc6c5415d812e2cd19b4eb2aa268028d0))
- **e2e:** fix 27 pre-existing Playwright e2e failures from view redesign ([#46](https://github.com/mallwang/solarlog-viewer/issues/46)) ([#48](https://github.com/mallwang/solarlog-viewer/issues/48)) ([638d8b5](https://github.com/mallwang/solarlog-viewer/commit/638d8b5cf2ea7dd36d4f89d1dc3891702e6a9c2a))
- **events:** keep events table opaque, excluded from transparency mode ([#37](https://github.com/mallwang/solarlog-viewer/issues/37)) ([b9fddec](https://github.com/mallwang/solarlog-viewer/commit/b9fddec8c60bbf71d184c5a0518deb1ccda30996))
- **favicon:** rename favicon.ico to favicon-v2.ico to bust browser cache ([#21](https://github.com/mallwang/solarlog-viewer/issues/21)) ([1fed221](https://github.com/mallwang/solarlog-viewer/commit/1fed221edd0426ff4633eecfcd9d10508648e07c))
- **ftp-sync:** force index.html reupload alongside cache-busted replaces ([#52](https://github.com/mallwang/solarlog-viewer/issues/52)) ([8539196](https://github.com/mallwang/solarlog-viewer/commit/85391964bb33fe9cdf9024c0aa85e405fda1bd3a))
- **migration:** migrate 2006-2013 minute data to Epoch 3 block layout ([#6](https://github.com/mallwang/solarlog-viewer/issues/6)) ([ec51061](https://github.com/mallwang/solarlog-viewer/commit/ec5106182b0de80a4f682ff95863769e53bdb192))
- **nav:** rework mobile burger menu and shorten period-nav labels ([#17](https://github.com/mallwang/solarlog-viewer/issues/17)) ([5f68a37](https://github.com/mallwang/solarlog-viewer/commit/5f68a37c7616d8b298fe63494ac88242c8a35314))
- **sky:** raise transparency-mode panel opacity floor at night ([#51](https://github.com/mallwang/solarlog-viewer/issues/51)) ([6c70214](https://github.com/mallwang/solarlog-viewer/commit/6c702149454f933e77b887eba22c65d45881bc38))
- **yield:** recover skipped months.js rollovers in current-month totals ([#31](https://github.com/mallwang/solarlog-viewer/issues/31)) ([236886e](https://github.com/mallwang/solarlog-viewer/commit/236886e02df50928a0b12ef41951d708165ed3af))
