# Quickstart: Validating the Documentation Overhaul

This feature has no runtime to start — validation is reading/inspecting the five Markdown files
against the acceptance scenarios and success criteria in [spec.md](spec.md). Run these checks
after the restructuring in `tasks.md` is implemented, before considering the feature done.

## Prerequisites

None beyond a shell — no `npm install`, no dev server. Run from the repo root.

## Check 1 — README scan test (SC-001, User Story 1)

Manually simulate a first-time reader: open `README.md`, read only the title through the
getting-started section (stop before the first feature call-out), and confirm you can state:

1. What the application does, in one sentence.
2. The exact commands to run it locally, without having scrolled past that section.

Repeat for `README.de.md` in German.

## Check 2 — User guide TOC test (SC-002, User Story 2)

Open `docs/user-guide.md`. Pick any section below the TOC at random and confirm:

1. It has a numbered TOC entry.
2. Clicking that entry's link lands on the matching heading.

Repeat for `docs/user-guide.de.md`.

## Check 3 — EN/DE structural parity (SC-003)

```bash
grep -oP '^#{1,2}\s+\K.*' README.md
grep -oP '^#{1,2}\s+\K.*' README.de.md
```

Compare the two lists by position — same count, same order, same topic per line (translated
prose is fine; a missing/extra/reordered section is not). Repeat for
`docs/user-guide.md`/`docs/user-guide.de.md`.

Expected: zero mismatches, matching the target section lists in [data-model.md](data-model.md).

## Check 4 — No dead internal anchors (SC-004)

For each of the four restructured files, extract in-document anchor references and heading slugs,
then confirm every reference has a matching slug:

```bash
for f in README.md README.de.md docs/user-guide.md docs/user-guide.de.md; do
  echo "== $f =="
  # anchors referenced
  grep -oP '\]\(#\K[a-z0-9-]+' "$f" | sort -u > /tmp/refs.txt
  # headings present, slugified (lowercase, spaces->hyphens, strip non-alnum/hyphen)
  grep -oP '^#{1,6}\s+\K.*' "$f" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9 -]//g; s/ +/-/g' \
    | sort -u > /tmp/slugs.txt
  comm -23 /tmp/refs.txt /tmp/slugs.txt
done
```

Expected: no output from any `comm -23` line (every referenced anchor has a matching heading
slug).

## Check 5 — No dropped content (SC-005)

```bash
grep -oP '^##\s+\K.*' README.md.orig 2>/dev/null || true   # pre-overhaul heading list, from git history
git show HEAD:README.md | grep -oP '^##\s+\K.*'
git show HEAD:docs/user-guide.md | grep -oP '^##\s+\K.*'
```

For each pre-overhaul feature/topic listed, confirm it appears in at least one of the new
`README.md` features list, a `README.md` heading, a `docs/user-guide.md` heading, or a
`docs/developer-guide.md` heading. Cross-reference against the "Cross-document consistency rules"
table in [data-model.md](data-model.md).

## Check 6 — External links preserved (FR-011)

```bash
grep -n 'deepwiki.com\|wolfsbach.synology.me\|LICENSE.md\|icon-icons.com' README.md README.de.md
```

Expected: all four still present (DeepWiki badge, live-app link, license link, icon attribution).

## Done when

- [ ] Checks 1–6 all pass for the restructured English and German docs.
- [ ] `docs/developer-guide.md` exists and covers the five relocated script steps + agentic-skill
      shortcuts (see [data-model.md](data-model.md)).
- [ ] No application code (`web/`, `scripts/`) was touched by this feature.
