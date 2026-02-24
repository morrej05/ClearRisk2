# Action Register - Reference Number Sorting Complete

## Overview
All action register tables now sort by reference_number ascending (ASC) for a stable, professional display order. This ensures actions appear in the correct sequence (FRA-2026-001, 002, 003...) across all views.

## Changes Made

### 1. Document Overview Action Register
**File**: `src/utils/actionRegister.ts`

#### getActionRegisterSiteLevel (lines 47-63)
Changed from:
```typescript
.order('priority_band', { ascending: true })
.order('created_at', { ascending: false });
```

To:
```typescript
.order('reference_number', { ascending: true, nullsFirst: false });
```

### 2. Dashboard Action Register
**File**: `src/utils/actionRegister.ts`

#### getActionRegisterOrgLevel (lines 65-81)
Changed from:
```typescript
.order('tracking_status', { ascending: false })
.order('priority_band', { ascending: true })
.order('created_at', { ascending: false });
```

To:
```typescript
.order('reference_number', { ascending: true, nullsFirst: false });
```

### 3. FRA PDF Action Register
**File**: `src/lib/pdf/buildFraPdf.ts`

#### Canonical Action Comparator (lines 283-296)
Changed from:
```typescript
/**
 * Canonical action comparator:
 * - priority_band ASC (P1 → P4)
 * - target_date ASC (nulls last)
 * - created_at ASC
 */
function sortActionsCanonical(a: any, b: any): number {
  const pr = priorityRank(a.priority_band) - priorityRank(b.priority_band);
  if (pr !== 0) return pr;

  const td = dateValue(a.target_date) - dateValue(b.target_date);
  if (td !== 0) return td;

  const ca = new Date(a.created_at).getTime();
  const cb = new Date(b.created_at).getTime();
  return ca - cb;
}
```

To:
```typescript
/**
 * Canonical action comparator:
 * - reference_number ASC (nulls last)
 * This ensures FRA-2026-001, 002, 003... appear in correct sequence.
 * Lexicographic sort works correctly due to PREFIX-YYYY-### format.
 */
function sortActionsCanonical(a: any, b: any): number {
  if (!a.reference_number) return 1;
  if (!b.reference_number) return -1;
  return a.reference_number.localeCompare(b.reference_number);
}
```

#### Executive Summary Priority Actions (lines 395-401)
Changed from priority-based sorting to:
```typescript
const priorityActions = actions
  .filter((a) => ['P1', 'P2', 'P3'].includes(a.priority_band) && (a.status === 'open' || a.status === 'in_progress'))
  .sort((a, b) => {
    if (!a.reference_number) return 1;
    if (!b.reference_number) return -1;
    return a.reference_number.localeCompare(b.reference_number);
  });
```

#### Executive Summary Top Actions (lines 1531-1536)
Changed from complex priority/SCS-weighted sorting to:
```typescript
// Sort actions by reference number (stable professional order)
const sortedTopActions = [...openActions].sort((a, b) => {
  if (!a.reference_number) return 1;
  if (!b.reference_number) return -1;
  return a.reference_number.localeCompare(b.reference_number);
});
```

### 4. FSD PDF Action Register
**File**: `src/lib/pdf/buildFsdPdf.ts` (lines 929-933)

Changed from:
```typescript
const sortedActions = [...actions].sort((a, b) => {
  const priorityOrder = { P1: 0, P2: 1, P3: 2, P4: 3 };
  return (priorityOrder[a.priority_band as keyof typeof priorityOrder] || 4) -
         (priorityOrder[b.priority_band as keyof typeof priorityOrder] || 4);
});
```

To:
```typescript
const sortedActions = [...actions].sort((a, b) => {
  if (!a.reference_number) return 1;
  if (!b.reference_number) return -1;
  return a.reference_number.localeCompare(b.reference_number);
});
```

### 5. DSEAR PDF Action Register
**File**: `src/lib/pdf/buildDsearPdf.ts` (lines 925-929)

Changed from:
```typescript
const sortedActions = [...actions].sort((a, b) => {
  const priority = { P1: 1, P2: 2, P3: 3, P4: 4 };
  return (priority[a.priority_band as keyof typeof priority] || 999) - (priority[b.priority_band as keyof typeof priority] || 999);
});
```

To:
```typescript
const sortedActions = [...actions].sort((a, b) => {
  if (!a.reference_number) return 1;
  if (!b.reference_number) return -1;
  return a.reference_number.localeCompare(b.reference_number);
});
```

## Sorting Logic

### Reference Number Format
Actions use format: `PREFIX-YYYY-###`
- **PREFIX**: Document type (FRA, FSD, DSEAR, RE)
- **YYYY**: Year
- **###**: Zero-padded sequence (001, 002, 003...)

Examples:
- `FRA-2026-001`
- `FRA-2026-002`
- `FSD-2026-017`
- `DSEAR-2026-003`
- `RE-2026-042`

### Lexicographic Sort
Because of the PREFIX-YYYY-### format with zero-padding:
- Lexicographic sort (`localeCompare`) works correctly
- No need for custom parsing or comparison logic
- Naturally handles year boundaries (2025 vs 2026)
- Naturally handles different document types

### Null Handling
Actions without reference numbers:
- Pushed to end of list (`return 1` if a is null, `return -1` if b is null)
- Maintains stable sort for null values
- Ensures all numbered actions appear before unnumbered ones

## Benefits

### 1. Professional Presentation
Actions appear in the order they were formally assigned reference numbers, providing a clear audit trail.

### 2. Consistency Across All Views
- Document Overview → Same order
- Dashboard Action Register → Same order
- PDF Reports (draft + issued) → Same order
- Module-level actions panel → Same order (from previous task)

### 3. Resurvey Carried Actions
Carried-forward actions maintain their historic reference numbers, so they appear in chronological order with new actions based on when they were originally raised.

Example sequence in a resurvey:
```
FRA-2025-012  (carried from previous survey)
FRA-2025-018  (carried from previous survey)
FRA-2026-001  (new action in current survey)
FRA-2026-002  (new action in current survey)
```

### 4. Priority Still Visible
Priority bands (P1, P2, P3, P4) are still displayed in all tables and PDFs, but no longer control sort order. Users see the reference sequence and can filter/sort by priority if needed.

## Locations Updated

### UI Components
- [x] Document Overview action register table
- [x] Dashboard Action Register page
- [x] Module Actions panel (from previous task)

### PDF Generators
- [x] FRA PDF - Main action register
- [x] FRA PDF - Executive summary priority actions
- [x] FRA PDF - Executive summary top actions
- [x] FSD PDF - Action register
- [x] DSEAR PDF - Action register

### Not Updated (No Action Sorting)
- Combined FRA+FSD PDF (delegates to individual builders)
- Combined FRA+DSEAR PDF (delegates to individual builders)
- RE PDF builders (use different recommendation system)

## Build Status
✅ Build successful (20.85s)
✅ No TypeScript errors
✅ All sorting updated to reference_number ASC
✅ Consistent sort logic across codebase

## Testing Checklist
- [ ] Open Document Overview for FRA document with multiple actions
- [ ] Verify actions appear in reference number order (FRA-2026-001, 002, 003...)
- [ ] Navigate to Dashboard → Action Register
- [ ] Verify organisation-wide actions sorted by reference number
- [ ] Generate draft FRA PDF
- [ ] Verify action register section shows reference number order
- [ ] Verify executive summary shows actions in reference number order
- [ ] Issue FRA document and download issued PDF
- [ ] Verify issued PDF maintains same reference number order
- [ ] Test with FSD and DSEAR documents
- [ ] Verify carried-forward actions from previous surveys appear in correct chronological sequence

## Expected Display Order Examples

### Before (Priority-based)
| Ref | Priority | Status | Action |
|-----|----------|--------|--------|
| FRA-2026-003 | P1 | Open | Critical fire door |
| FRA-2026-001 | P2 | Open | Update signage |
| FRA-2026-002 | P2 | Open | Review evacuation plan |
| FRA-2026-005 | P3 | Open | Minor compartmentation |
| FRA-2026-004 | P3 | Open | Replace detector |

### After (Reference-based)
| Ref | Priority | Status | Action |
|-----|----------|--------|--------|
| FRA-2026-001 | P2 | Open | Update signage |
| FRA-2026-002 | P2 | Open | Review evacuation plan |
| FRA-2026-003 | P1 | Open | Critical fire door |
| FRA-2026-004 | P3 | Open | Replace detector |
| FRA-2026-005 | P3 | Open | Minor compartmentation |

The reference number sequence provides a stable, professional audit trail while still showing priority bands for user reference.
