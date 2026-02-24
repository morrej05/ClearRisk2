# Action Plan Snapshot: System Actions Displayed First (COMPLETE)

## Overview

Modified the Action Plan Snapshot section to sort system-generated actions first within each priority group. This ensures that system actions with shortened titles are visible in the top-5 snapshot list.

## Implementation

### File Changed
- `src/lib/pdf/pdfUtils.ts` (line 1081-1090)

### Change Details

**Location:** Inside `drawActionPlanSnapshot()` → `drawPriorityGroup()` helper

**Before:**
```typescript
const displayActions = priorityActions.slice(0, 5);
```

**After:**
```typescript
// Sort system actions first within each priority group
const sortedActions = [...priorityActions].sort((a, b) => {
  const aSys = (a.source === 'system') ? 0 : 1;
  const bSys = (b.source === 'system') ? 0 : 1;
  if (aSys !== bSys) return aSys - bSys;

  // Stable secondary sort (by ref if present, else by created_at)
  return String(a.reference_number || '').localeCompare(String(b.reference_number || ''));
});

const displayActions = sortedActions.slice(0, 5);
```

## Sorting Logic

### Primary Sort: Source Type
- **System actions** (`source === 'system'`) → 0 (first)
- **Manual actions** (`source !== 'system'`) → 1 (second)

### Secondary Sort: Reference Number
- Alphabetical sort by reference number
- Ensures stable, predictable ordering
- Falls back to empty string if reference_number is null

## Impact

### Before This Change
```
Priority P1 Actions (8)
  FRA-2026-001: Manual action...
  FRA-2026-002: Manual action...
  FRA-2026-003: Manual action...
  FRA-2026-004: Manual action...
  FRA-2026-005: Manual action...
  (system action FRA-2026-006 not shown - beyond 5-item limit)
```

### After This Change
```
Priority P1 Actions (8)
  FRA-2026-006: Fire alarm panel inspection and testing [system - shortened!]
  FRA-2026-007: Emergency lighting functional testing [system - shortened!]
  FRA-2026-001: Manual action...
  FRA-2026-002: Manual action...
  FRA-2026-003: Manual action...
```

## Benefits

1. ✅ **System actions are visible** - Appear in top-5 snapshot when present
2. ✅ **Shortened titles displayed** - System action title shortening is now visible
3. ✅ **Consistent ordering** - System actions always appear first per priority
4. ✅ **Stable secondary sort** - Reference numbers provide deterministic ordering
5. ✅ **Non-breaking change** - Only affects display order, not data structure

## Testing Checklist

### Test Scenario 1: Mixed Actions in P1
- Document with 6 P1 actions: 2 system + 4 manual
- **Expected:** Snapshot shows 2 system actions first, then 3 manual actions
- **Verify:** System action titles are shortened (e.g., "Fire alarm inspection and testing")

### Test Scenario 2: All Manual Actions
- Document with 8 P1 actions: 0 system + 8 manual
- **Expected:** First 5 manual actions displayed alphabetically by reference
- **Verify:** No change in behavior (works as before)

### Test Scenario 3: All System Actions
- Document with 3 P1 actions: 3 system + 0 manual
- **Expected:** All 3 system actions displayed
- **Verify:** All have shortened titles

### Test Scenario 4: Multiple Priority Bands
- Document with system actions in P1, P2, P3
- **Expected:** System actions appear first in each priority group
- **Verify:** Sorting is applied independently per priority band

## Console Verification

When viewing the PDF preview, check logs:

```
[PDF] first 10 action sources: [
  { ref: 'FRA-2026-001', source: 'system' },   ← Will appear in snapshot
  { ref: 'FRA-2026-002', source: 'system' },   ← Will appear in snapshot
  { ref: 'FRA-2026-003', source: 'manual' },
  { ref: 'FRA-2026-004', source: 'manual' },
  { ref: 'FRA-2026-005', source: 'manual' },
  ...
]
```

In the PDF Action Plan Snapshot:
- First 2 items should be system actions (with shortened titles)
- Remaining 3 items should be manual actions

## Related Documentation

- `ACTION_SNAPSHOT_SYSTEM_TITLE_SHORTENING_COMPLETE.md` - Title shortening for system actions
- `ACTION_SOURCE_END_TO_END_COMPLETE.md` - Source field propagation
- `FRA_PDF_PREVIEW_DOCUMENT_ID_AND_SOURCE_LOGGING_COMPLETE.md` - Logging chain

## Status

✅ Sorting logic implemented in `drawActionPlanSnapshot`
✅ System actions prioritized within each priority group
✅ Secondary sort by reference number for stability
✅ Build successful
✅ Ready to test

## Implementation Date

February 24, 2026
