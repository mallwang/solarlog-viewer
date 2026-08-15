# Feature Specification: Documentation Overhaul

**Feature Branch**: `021-documentation-overhaul`

**Created**: 2026-08-15

**Status**: Draft

**Input**: User description: "I would like to overhaul the documentation, both the READMEs and user guides. The goal is to use a similar approach like https://github.com/mallwang/klaro, both for the english and german README and for the both docs/user-guide.md files."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Scan the README to understand and run the project (Priority: P1)

A new visitor (contributor, reviewer, or the project owner returning after time away) opens the
repository and needs to understand, within seconds, what the application does and how to get it
running locally — without wading through paragraphs of implementation narrative to find the
setup commands.

**Why this priority**: The README is the first (and often only) document a visitor reads. If it
doesn't answer "what is this and how do I run it" quickly, everything else in the docs overhaul
is moot.

**Independent Test**: Can be fully tested by handing a reader the restructured `README.md` and
timing how quickly they can state (a) what the app does and (b) the exact commands to run it
locally, without scrolling past the getting-started section.

**Acceptance Scenarios**:

1. **Given** the restructured `README.md`, **When** a reader reads only the opening description
   and features list, **Then** they can describe the application's purpose without needing to
   read any feature's implementation details.
2. **Given** the restructured `README.md`, **When** a reader looks for how to run the project
   locally, **Then** they find a copy-pasteable set of commands in a clearly labeled section near
   the top, not buried after long feature narratives.
3. **Given** the restructured `README.md`, **When** a reader wants the full walkthrough of using
   the deployed dashboard, **Then** the README points them to `docs/user-guide.md` rather than
   repeating that content inline.

---

### User Story 2 - Find a specific dashboard feature in the user guide (Priority: P2)

Someone already using the deployed SolarLog dashboard (the plant owner or a household member) has
a question about a specific view or feature — e.g. "how do the event filters work?" or "what does
the UDC line on the day chart mean?" — and wants to jump straight to the relevant section instead
of reading the whole guide top to bottom.

**Why this priority**: The user guide is only useful if its structure lets a reader locate an
answer quickly; this is the guide's core job, independent of the README overhaul.

**Independent Test**: Can be fully tested by giving a reader a feature name and asking them to
find its explanation using only the table of contents, without full-text search.

**Acceptance Scenarios**:

1. **Given** `docs/user-guide.md`, **When** a reader opens the document, **Then** a numbered table
   of contents near the top lists every top-level section with a working link to that section.
2. **Given** a table of contents entry, **When** a reader clicks it, **Then** they land on the
   matching section heading.
3. **Given** a guide section that describes a set of options, fields, or filters (e.g. sort
   columns, field constraints, filter types), **When** a reader views that section, **Then** the
   information is presented as a table rather than a paragraph of prose.

---

### User Story 3 - Get the equivalent experience in German (Priority: P3)

A German-speaking reader opens `README.de.md` or `docs/user-guide.de.md` and expects the same
structure, sections, and level of detail as the English versions — no section present in one
language and missing in the other.

**Why this priority**: The project already maintains parallel EN/DE documentation; the overhaul
must not introduce a content gap between the two languages, but this depends on the EN structure
(User Stories 1–2) being finalized first.

**Independent Test**: Can be fully tested by listing the top-level section headings of each
English document next to its German counterpart and confirming they match in count, order, and
topic.

**Acceptance Scenarios**:

1. **Given** the restructured `README.md` and `README.de.md`, **When** their top-level section
   headings are listed side by side, **Then** the lists match in count, order, and topic.
2. **Given** the restructured `docs/user-guide.md` and `docs/user-guide.de.md`, **When** their
   numbered sections are listed side by side, **Then** the lists match in count, order, and topic.
3. **Given** either document, **When** a reader is at the top of the page, **Then** a small
   language-toggle link lets them switch to the other language's equivalent document.

### Edge Cases

- What happens to implementation-level detail (specific file names, function names, config
  constant names) currently embedded in README feature paragraphs? It must not disappear — it
  relocates to the developer-facing docs (e.g. `docs/architecture.md`, the relevant `specs/`
  entry) that the shortened README section links to.
- What happens to the developer-facing script documentation (validation/aggregation scripts)
  currently mixed into `docs/user-guide.md`? It targets developers running scripts, not the
  end user viewing the dashboard, so it relocates out of the user guide into a developer-facing
  document instead of being dropped.
- How is a reader who followed an old anchor link (e.g. a bookmark to a README subsection)
  affected? Anchor stability isn't guaranteed across the restructuring; the priority is a
  coherent new structure, not preserving every old anchor.
- What happens if a feature currently documented has no natural home in the new structure? It
  still must be discoverable somewhere in the restructured set (README overview mention,
  user-guide section, or linked architecture doc) — nothing gets silently dropped.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `README.md` MUST open with a concise description of what the application does
  (one to two short paragraphs) followed by a scannable features list, free of the deep
  implementation narrative currently woven into feature descriptions.
- **FR-002**: `README.md` MUST include a getting-started/dev-server section with copy-pasteable
  setup commands, positioned before the deeper feature/architecture content.
- **FR-003**: `README.md` MUST link to `docs/user-guide.md` as the destination for the full
  end-user walkthrough of the deployed dashboard, rather than duplicating that walkthrough inline.
- **FR-004**: `README.md` MUST NOT contain implementation-level detail (specific file names,
  function names, or config constant names) inside its feature descriptions; that detail MUST
  remain available in the existing developer docs (`docs/architecture.md`, relevant `specs/`
  entries) that the README links out to.
- **FR-005**: `README.de.md` MUST mirror `README.md` section-for-section (same headings, same
  order), and both files MUST carry a language-toggle link pair at the top (e.g. "English ·
  Deutsch" and "Deutsch · English").
- **FR-006**: `docs/user-guide.md` MUST open with a numbered table of contents, one entry per
  top-level section, each entry linking to that section's heading.
- **FR-007**: `docs/user-guide.md` MUST be scoped to end-user tasks — using the deployed
  dashboard's views and features. Developer-facing script/validation documentation currently
  present in the file MUST be relocated to a developer-facing document rather than remaining in
  the user guide.
- **FR-008**: `docs/user-guide.de.md` MUST mirror `docs/user-guide.md`'s section numbering, order,
  and count, and MUST carry the same language-toggle link pair described in FR-005.
- **FR-009**: Any user-guide section describing a set of options, fields, or filter/sort choices
  MUST present that information as a markdown table rather than prose.
- **FR-010**: Every internal anchor link within the four restructured documents MUST resolve to
  an existing heading in that document — no dead internal links.
- **FR-011**: Existing external links and attributions currently in `README.md` (live application
  link, license link, icon attribution, DeepWiki badge) MUST be preserved in the restructured
  version.
- **FR-012**: Every feature currently documented in the existing README or user guide MUST remain
  discoverable somewhere in the restructured document set — either summarized in the README,
  detailed in the user guide, or linked out to a developer doc — with none silently dropped.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A first-time reader can state what the application does and the exact commands to
  run it locally after reading only the opening description and getting-started section of
  `README.md` — no scrolling past it required.
- **SC-002**: A reader can locate any topic covered by `docs/user-guide.md` within one click from
  its table of contents.
- **SC-003**: `README.md`/`README.de.md` and `docs/user-guide.md`/`docs/user-guide.de.md` each
  have matching top-level section counts, order, and topics between their English and German
  versions (zero mismatches).
- **SC-004**: Zero internal anchor links across the four restructured documents point at a
  missing heading.
- **SC-005**: One hundred percent of features mentioned in the pre-overhaul README and user guide
  are still discoverable somewhere in the restructured document set.

## Assumptions

- The intended end-user persona for `docs/user-guide.md` is whoever views the deployed SolarLog
  dashboard (the plant owner and household), not developers running maintenance scripts.
- Developer-facing content currently mixed into the user guide (validation/aggregation script
  usage) moves to a developer-facing doc rather than being deleted; where exactly it lands is an
  implementation detail for the planning phase, not this specification.
- No new screenshots or visual assets are introduced — consistent with the reference project's
  screenshot-free style, favoring concise prose and tables.
- The referenced project (`github.com/mallwang/klaro`) is used purely as a structural/style
  reference — a concise feature-first README with a table of tech stack, and a numbered,
  table-of-contents-led user guide with tables for structured data — not as a source of branding
  or content to copy verbatim.
- This is a one-time structural overhaul; keeping the English and German documents in sync going
  forward remains a manual process, not something this feature automates.
- Anchor links from outside the repository (e.g. bookmarks to old README subsections) are not
  guaranteed to keep working after the restructuring.
