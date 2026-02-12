# AGENTS.md — Project guidance for AI coding agents

This repository is a React + Vite + TypeScript app with Supabase. The user experience must remain stable (no flashing screens, no render loops, no route remount loops). Prefer minimal diffs and fixes that address root causes rather than removing features.

## Non-negotiables (stability)
- **Never** call `setState`, `setValue`, `dispatch`, or any mutation **during render**.
- Effects that write to React state or form state must be **guarded** to avoid loops:
  - Use a `useRef` "didInit" guard for one-time hydration, OR
  - Compare previous vs next (deep-equality on the specific payload) and **only write when changed**, OR
  - Trigger only on stable, low-cardinality deps (e.g., ids/count), not on freshly created arrays/objects.
- Avoid render/remount loops caused by unstable keys:
  - **No** `key={index}` for dynamic rows.
  - **No** `key={Math.random()}` / `Date.now()` / changing values.
  - Use persisted stable IDs.
- Any derived arrays/objects used in dependency arrays must be **memoized** (`useMemo`) or moved inside effects.
- Avoid passing newly created `columns`, `rows`, or callback props into table components each render if it triggers recalculation. Memoize where it materially prevents thrash.

## Forms + tables (high-risk area)
- Do not “compute rows” and then “write rows back” every render or on broad deps.
- If table data is derived from form values:
  - Prefer reading form state once (hydration) then treating it as source-of-truth.
  - If bidirectional sync is required, implement explicit reconciliation with change detection (diff) and minimal writes.
- Avoid calling `watch()`/`getValues()` inline in heavy render paths that feed state-setting effects. Prefer subscribing once or using controlled form fields.

## Supabase + data fetching
- Fetching effects must not depend on state that they update.
- Keep query dependencies stable (avoid object literals in deps).
- Ensure cleanup of subscriptions/listeners in effects.
- Avoid refetch loops triggered by derived state changes.

## Routing + mount stability
- Do not introduce route-level `key` props tied to `location` or other changing values unless intentionally forcing a remount.
- If a component is re-mounting unexpectedly, identify the parent key/change and fix there.

## TypeScript + code quality
- Preserve and improve types; do **not** introduce `any`.
- Prefer explicit types for module data shapes and table row types.
- Keep functions pure where possible; avoid hidden side effects.

## Debugging expectations (for flicker / flashing / loops)
When addressing “flashing”:
1. Add temporary diagnostics to confirm the mechanism:
   - render counter (`useRef` + `console.log`)
   - effect fire counter
   - log the specific state write that triggers the next render
2. Identify the precise loop trigger (file + function + line).
3. Implement the minimal fix.
4. Remove temporary logs before final output unless explicitly requested to keep them.

## Change management
- Prefer small, focused patches.
- Do not remove features as a “fix” unless explicitly instructed.
- If you must refactor, keep it localized and explain why.

## Deliverables for a fix
- Root cause summary (1–2 paragraphs), including exact trigger and location.
- Patch diff across touched files.
- Anti-regression note: what invariant now prevents recurrence (e.g., “effect writes only when payload changed”).

## Known recurring failure modes in this repo
- Un-guarded `useEffect` that calls `setValue(...)` or `setState(...)` based on derived arrays/objects.
- Table column/row definitions recreated every render causing internal recalculation and cascading state writes.
- Unstable row keys causing rapid remounting and repeated hydration effects.
