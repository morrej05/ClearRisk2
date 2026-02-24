# FRA PDF - Canonical References and Unified Sorting Complete

## Summary

Removed phantom reference generation and unified action sorting in FRA PDF to use canonical database references consistently throughout the document.

## Changes Made

### Part 1: buildFraPdf.ts - Canonical Sorting & No Fallback Refs

**File**: `src/lib/pdf/buildFraPdf.ts` (Lines 257-329)

**Before**:
```typescript
const sortedActions = [...actions].sort((a, b) => {
  const priorityMap: Record<string, number> = { P1: 1, P2: 2, P3: 3, P4: 4 };
  const aPriority = priorityMap[a.priority_band] || 99;
  const bPriority = priorityMap[b.priority_band] || 99;
  if (aPriority !== bPriority) return aPriority - bPriority;

  const aDate = new Date(a.created_at).getTime();
  const bDate = new Date(b.created_at).getTime();
  if (aDate !== bDate) return aDate - bDate;

  return (a.recommended_action || '').localeCompare(b.recommended_action || '');
});

const actionsWithRefs = sortedActions.map((action, index) => {
  const displayRef = action.reference_number || `R-${String(index + 1).padStart(2, '0')}`;
  return {
    ...action,
    reference_number: displayRef, // INJECTED FALLBACK
    section_reference: sectionRef,
    owner_display_name: getDisplayableOwner(action.owner_display_name),
  };
});
```

**After**:
```typescript
// CANONICAL ACTION SORTING FOR FRA PDF
function priorityRank(p?: string): number {
  const v = (p || '').toUpperCase().trim();
  if (v === 'P1') return 1;
  if (v === 'P2') return 2;
  if (v === 'P3') return 3;
  if (v === 'P4') return 4;
  return 99;
}

function dateValue(d?: string | null): number {
  if (!d) return Number.POSITIVE_INFINITY;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

function sortActionsCanonical(a: any, b: any): number {
  const pr = priorityRank(a.priority_band) - priorityRank(b.priority_band);
  if (pr !== 0) return pr;

  const td = dateValue(a.target_date) - dateValue(b.target_date);
  if (td !== 0) return td;

  const ca = new Date(a.created_at).getTime();
  const cb = new Date(b.created_at).getTime();
  return ca - cb;
}

const sortedActions = [...actions].sort(sortActionsCanonical);

const actionsWithRefs = sortedActions.map((action) => {
  return {
    ...action,
    reference_number: action.reference_number, // NO FALLBACK INJECTION
    section_reference: sectionRef,
    owner_display_name: getDisplayableOwner(action.owner_display_name),
  };
});
```

**Key Changes**:
1. ✅ Added canonical sorting helpers (`priorityRank`, `dateValue`, `sortActionsCanonical`)
2. ✅ Canonical sort order: priority_band ASC → target_date ASC (nulls last) → created_at ASC
3. ✅ Removed fallback reference generation (`displayRef` injection)
4. ✅ Actions keep original `reference_number` from database (null if unissued)

### Part 2: fraCoreDraw.ts - No Re-sorting, No displayRefMap

**File**: `src/lib/pdf/fra/fraCoreDraw.ts` (Lines 1528-1568)

**Before**:
```typescript
const sortedActions = [...actions].sort((a, b) => {
  const aComplete = a.status === 'complete';
  const bComplete = b.status === 'complete';
  if (aComplete !== bComplete) return aComplete ? 1 : -1;

  const priorityOrder = ['P1', 'P2', 'P3', 'P4'];
  const aPriority = priorityOrder.indexOf(a.priority_band || 'P4');
  const bPriority = priorityOrder.indexOf(b.priority_band || 'P4');
  if (aPriority !== bPriority) return aPriority - bPriority;

  if (a.target_date && b.target_date) {
    const dateCompare = new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
    if (dateCompare !== 0) return dateCompare;
  }
  if (a.target_date && !b.target_date) return -1;
  if (!a.target_date && b.target_date) return 1;

  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
});

const displayRefMap = new Map<string, string>();
sortedActions.forEach((a, i) => {
  displayRefMap.set(a.id, `R-${String(i + 1).padStart(2, '0')}`);
});

for (const action of sortedActions) {
  const ref = action.reference_number || displayRefMap.get(action.id);
}
```

**After**:
```typescript
// NO RE-SORTING: Actions are already sorted by buildFraPdf.ts using canonical order
// Render actions in the order provided (preserves consistent order throughout PDF)

if (actions.length === 0) {
  page.drawText('No actions have been created for this assessment.', {
    x: MARGIN,
    y: yPosition,
    size: 11,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
  return { page, yPosition: yPosition - 20 };
}

// NO FALLBACK REFERENCE GENERATION
// Use canonical DB reference_number or display "—" if unissued

for (const action of actions) {
  const ref = action.reference_number ?? '—';
}
```

**Key Changes**:
1. ✅ Removed all action re-sorting logic (was causing order inconsistency)
2. ✅ Deleted `displayRefMap` fallback reference generation
3. ✅ Actions rendered in order provided by buildFraPdf.ts (canonical order)
4. ✅ Reference display: `action.reference_number ?? '—'` (shows dash if unissued)

## Canonical Sort Order

**Single source of truth for FRA PDF action ordering**:

```
1. priority_band ASC (P1 → P2 → P3 → P4)
2. target_date ASC (nulls last)
3. created_at ASC (oldest first)
```

**Applied to**:
- Action Plan Snapshot (early in PDF)
- Action Register (later in PDF)
- Any other action rendering in FRA PDF

**Result**: Actions appear in the same order everywhere in the FRA PDF.

## Reference Display Logic

**Before** (Phantom refs):
```typescript
// Generated fake refs for unissued actions
const displayRef = action.reference_number || `R-01`, `R-02`, etc.
// Problem: Users see "R-01" but action isn't issued yet
```

**After** (Canonical DB refs only):
```typescript
// Use database value only
const ref = action.reference_number ?? '—';
// Unissued actions show "—" instead of fake R-xx
```

**Display Examples**:
- Issued action: `R-03 P2` (shows actual DB reference)
- Unissued action: `— P2` (dash indicates not issued)
- Closed action: `R-01 P1` (retains issued reference)

## Verification

**Build Status**: ✅ Successful (20.84s, 1946 modules)

**Expected Behavior**:
1. ✅ FRA PDF never invents R-xx references
2. ✅ Unissued actions display "—" for reference
3. ✅ Issued actions display canonical DB reference (R-01, R-02, etc.)
4. ✅ Action Plan Snapshot and Action Register show identical order
5. ✅ No scoring, priority, or outcome logic changed
6. ✅ Actions sorted consistently: priority → target_date → created_at

## Testing Checklist

### Draft Mode (Unissued Actions)
- [ ] Action Plan Snapshot shows "—" for reference
- [ ] Action Register shows "—" for reference
- [ ] Action order identical in both sections
- [ ] Priority bands display correctly (P1/P2/P3/P4)

### Issued Mode (Assigned References)
- [ ] Action Plan Snapshot shows R-01, R-02, etc.
- [ ] Action Register shows same R-01, R-02, etc.
- [ ] Action order identical in both sections
- [ ] References match database values exactly

### Cross-Version Consistency
- [ ] Superseded actions retain original references
- [ ] Carried-forward actions keep first_raised_in_version
- [ ] New actions show "—" until issued
- [ ] No phantom R-xx refs in draft PDFs

## Files Modified

1. `src/lib/pdf/buildFraPdf.ts` - Added canonical sorting, removed fallback refs
2. `src/lib/pdf/fra/fraCoreDraw.ts` - Removed re-sorting and displayRefMap

## No Changes To

- Action creation logic
- Issue-time reference assignment
- Priority calculation
- Scoring engines
- Database schema
- Action lifecycle (open/close/reopen)

---

**Result**: FRA PDF now uses ONE canonical sort order and displays authentic database references only. Unissued actions show "—" instead of phantom R-xx references.
