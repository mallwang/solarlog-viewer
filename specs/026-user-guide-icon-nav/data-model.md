# Phase 1 Data Model: User Guide Icon Next to Transparency Toggle

This feature introduces no persisted data, no new localStorage keys, and no new parsed data
structures. The only "entity" is a UI element and its derived state, captured here for
completeness per the plan template.

## User Guide Link (header icon)

A stateless, presentation-only control — not persisted anywhere, recomputed on every render.

| Field            | Type                                                                        | Source                                                                                                                 | Notes                                                                                                   |
| ---------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `href`           | string (URL)                                                                | `` `https://github.com/mallwang/solarlog-viewer/blob/main/docs/user-guide${getLanguage() === 'de' ? '.de' : ''}.md` `` | Recomputed on every click (not cached), same formula as today's `NAV_ITEMS.userGuide.href()`.           |
| `accessibleName` | string                                                                      | `` `${t('nav.userGuideView')} (${t('nav.opensNewTab')})` ``                                                            | Set as both `aria-label` and `title`; re-resolved on language switch (see research.md §2).              |
| DOM element      | `<button id="user-guide-link" class="user-guide-link transparency-toggle">` | `index.html`, static markup                                                                                            | Icon content (`documentText` SVG) injected once via `icon('documentText')`, does not change with state. |

No relationships, no validation rules beyond "must resolve to a non-empty href string" (already
guaranteed by `getLanguage()` always returning `'de'` or `'en'`), no state transitions — this is
a pure link, not a toggle. Removed entirely: the corresponding `NAV_ITEMS` array entry (`view:
'userGuide'`) and its `<li><a>` rendering inside `#app-nav-list`.
