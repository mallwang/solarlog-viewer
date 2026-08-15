# Phase 1 Data Model: Document Structure Map

This feature has no application data entities — its "model" is the target section structure each
of the five documents (four restructured + one new) must converge on, and the mapping from old
content to new location. Both EN/DE pairs use the identical structure (topic, count, order) per
FR-005/FR-008; only prose is translated.

## README.md / README.de.md — target section list

| #   | Section (EN heading)                      | Content                                                                                                      | Source of current content                                              |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| —   | Title + badges/links                      | Title, DeepWiki badge, live-app link, icon image + attribution (all preserved verbatim per FR-011)           | Existing lines 1–13                                                    |
| —   | Language toggle                           | "English · [Deutsch](README.de.md)" / "Deutsch · [English](README.md)" pair (FR-005)                         | New                                                                    |
| —   | Opening description                       | 1–2 short paragraphs: what the app is/does, free of implementation narrative (FR-001)                        | Condensed from existing intro paragraph (lines 15–39)                  |
| —   | Features list                             | Scannable bullet list of top-level features (sky, info panel, events, tooltips, five view modes, i18n, etc.) | New — extracted as bullets from existing section headings              |
| 1   | Getting started / Dev server              | `npm install && npm start && npm run open`, proxy behavior note, near top (FR-002)                           | Existing "Dev server" section (lines 159–184), moved up                |
| 2   | Production build & deploy                 | Build/dist/cache-busting summary (kept brief; deep detail stays linked to spec)                              | Existing section (lines 186–199), trimmed                              |
| 3   | Dynamic sky background                    | 1–3 sentences, link to `docs/user-guide.md` (end-user) + `specs/007-dynamic-sky-weather/` (detail)           | Existing section (lines 41–63), stripped of file/function/config names |
| 4   | Global desktop info panel                 | Same treatment, link to `specs/010-global-info-panel/`                                                       | Existing section (lines 65–120), stripped                              |
| 5   | Ereignisse (events) page                  | Same treatment, link to `docs/user-guide.md#ereignisse-events-page`                                          | Existing section (lines 122–134), stripped                             |
| 6   | Explanatory tooltips                      | Same treatment, link to `specs/020-explanatory-tooltips/`                                                    | Existing section (lines 136–157), stripped                             |
| 7   | Frontend tests                            | `npm test` / `npm run test:scripts` / lint / format commands                                                 | Existing section (lines 201–208), unchanged                            |
| 8   | Data files                                | One-paragraph note on `.js` data file model + dev-proxy pointer                                              | Existing section (lines 210–212), unchanged                            |
| 9   | Validation & aggregation scripts          | Short pointer to `docs/developer-guide.md` (FR-007 relocation target), not the full walkthrough              | Existing section (lines 214–274), trimmed to pointer                   |
| 10  | Maintaining the CO2 emission-factor table | Kept as a short maintenance note (developer-facing but small; not moved)                                     | Existing section (lines 276–289), unchanged                            |
| 11  | License                                   | MIT + link (FR-011)                                                                                          | Existing section (lines 291–293), unchanged                            |

`README.de.md` mirrors this list exactly (11 numbered sections + title/toggle/description/features
front matter), German prose only.

## docs/user-guide.md / docs/user-guide.de.md — target section list

| #   | Section (EN heading)                 | Content                                                                                              | Source                            |
| --- | ------------------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------- |
| —   | Title + language toggle              | Retitled to reflect end-user scope (drop "Validation & Aggregation Workflow" from the title, FR-007) | Existing title (line 1), retitled |
| —   | Table of contents                    | Numbered list, one entry per section below, each a working anchor link (FR-006)                      | New                               |
| 1   | Dashboard navigation & charts        | Unchanged scope; convert any option/mode list to a table (FR-009)                                    | Existing section (lines 5–47)     |
| 2   | Ereignisse (events) page             | Convert the four filter types to a table (FR-009)                                                    | Existing section (lines 48–72)    |
| 3   | Dynamic sky background               | Unchanged (end-user framing already)                                                                 | Existing section (lines 73–86)    |
| 4   | Global desktop info panel            | Unchanged                                                                                            | Existing section (lines 87–107)   |
| 5   | Day view & welcome page auto-refresh | Unchanged                                                                                            | Existing section (lines 108–122)  |
| 6   | CO2 avoidance figures                | Unchanged                                                                                            | Existing section (lines 123–135)  |
| 7   | Explanatory tooltips                 | Unchanged                                                                                            | Existing section (lines 136–144)  |

Removed entirely (relocated to `docs/developer-guide.md` per R3): "Prerequisites", "Step 1–5",
"Agentic skills (Claude Code)", "Typical workflow" (existing lines 145–270).

`docs/user-guide.de.md` mirrors this list exactly (7 numbered sections + title/TOC front matter).

## docs/developer-guide.md — new file, target section list (English only)

| #   | Section                                             | Content                                                                                                                                                            | Source                                                        |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| —   | Title + scope note                                  | "Developer Guide: Validation & Aggregation Scripts" + who this is for                                                                                              | New                                                           |
| —   | Prerequisites                                       | Node 22+, manual `web/data`/`web/hist` repopulation caveat                                                                                                         | `docs/user-guide.md` existing "Prerequisites" (lines 145–151) |
| 1   | Step 1 — Detect gaps in archive data                | `gap-detect.js` usage, as a table of flags/examples where a set exists (FR-009 style, applied for consistency though not strictly required outside the user guide) | `docs/user-guide.md` lines 152–174                            |
| 2   | Step 2 — Validate daily totals against days_hist.js | `validate-plausibility.js` usage                                                                                                                                   | lines 175–196                                                 |
| 3   | Step 3 — Fill gaps in days_hist.js                  | `fill-days-hist.js` usage                                                                                                                                          | lines 197–227                                                 |
| 4   | Step 4 — Regenerate monthly totals                  | `fill-months.js` usage                                                                                                                                             | lines 228–238                                                 |
| 5   | Step 5 — Regenerate annual totals                   | `fill-years.js` usage                                                                                                                                              | lines 239–249                                                 |
| —   | Agentic skills (Claude Code)                        | `/backfill-days-hist`, `/backfill-months`, `/backfill-years`                                                                                                       | lines 250–263                                                 |
| —   | Typical workflow                                    | End-to-end example sequence                                                                                                                                        | lines 264–270                                                 |

## Cross-document consistency rules (enforced by quickstart.md checks)

- Heading topic lists for `README.md` vs `README.de.md` match 1:1 in count, order, and topic
  (SC-003).
- Heading topic lists for `docs/user-guide.md` vs `docs/user-guide.de.md` match 1:1 (SC-003).
- Every `](#slug)` anchor within each of the five files resolves to a heading in that same file
  (SC-004) — cross-file links (e.g. README → user-guide) are checked for target-file existence,
  not anchor validity within the target, since FR-010 scopes "internal anchor link" to
  within-document navigation.
- Every feature name present in the pre-overhaul README/user-guide heading list appears in at
  least one of: new README features list, new README section heading, new user-guide section
  heading, or new developer-guide section heading (SC-005 — completeness).
