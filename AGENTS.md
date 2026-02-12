# Project agent notes

- Avoid render loops: never call setState / setValue during render.
- Effects that write to form/state must be guarded (only run on first-load or when payload truly changes).
- Derived arrays/objects used in deps must be memoized.
- Table row keys must be stable IDs (never index, never random/time).
- Prefer minimal diffs; preserve existing patterns.
- When debugging flicker: add temporary render/effect counters, then remove them.

- RE06 previously suffered from render loops caused by unguarded useEffect writing to form state.
- Table row keys must be stable IDs (never index or random).
