# Info Gap Quick Actions Cleanup Complete

**Status**: ✅ Complete
**Date**: 2026-02-21

## Overview

Removed duplicate/old info-gap rendering implementation from `drawInfoGapQuickActions` function, leaving only the clean, single-cursor implementation.

---

## Changes Applied

### 1. Added Debug Marker ✅

**File**: `src/lib/pdf/fra/fraCoreDraw.ts` (line 361)

**Added at function entry**:
```typescript
export function drawInfoGapQuickActions(input: {
  // ... params
}): { page: PDFPage; yPosition: number } {
  console.log('[PDF] drawInfoGapQuickActions CLEAN VERSION');
  // ... rest of function
```

---

### 2. Removed Duplicate Rendering Block ✅

**File**: `src/lib/pdf/fra/fraCoreDraw.ts` (lines 597-678 deleted)

**Before**: Function had TWO complete rendering implementations
- First implementation (lines 462-596): Clean single-cursor box rendering
- **DELETED**: Second implementation (lines 597-678): Old multi-cursor rendering with `boxCursorY`

**After**: Function has ONE rendering implementation
- Clean single-cursor implementation ending at line 598
- Single final return statement

---

### 3. Fixed Unrelated Bug ✅

**File**: `src/lib/pdf/fra/fraCoreDraw.ts` (line 806)

Found and fixed orphaned `boxCursorY` reference in `drawModuleContent` function:

**Before**:
```typescript
    boxCursorY -= 10;  // Wrong variable!
  }
```

**After**:
```typescript
    yPosition -= 10;   // Correct variable
  }
```

---

## Function Structure Verification

### Return Statements in `drawInfoGapQuickActions`

✅ **4 total returns** (all valid):

1. **Line ~365**: Early return for missing page (safety guard)
   ```typescript
   if (!page) return { page: input.page as any, yPosition };
   ```

2. **Line ~371**: Early return for cross-section guard
   ```typescript
   if (expectedModuleKeys && !expectedModuleKeys.includes(...)) {
     return { page, yPosition };
   }
   ```

3. **Line ~384**: Early return if no info gap detected
   ```typescript
   if (!detection.hasInfoGap) {
     return { page, yPosition };
   }
   ```

4. **Line ~436**: Early return for suppression rule (compact reference)
   ```typescript
   if (hasAssuranceGapKeyPoint && allReasonsAreUnknowns) {
     // Render compact "i" icon + text
     return { page, yPosition };
   }
   ```

5. **Line 598**: Final main return after full box rendering ✅
   ```typescript
   yPosition = boxBottomY - 12;
   return { page, yPosition };
   }  // ← Function closes here
   ```

---

## Deleted Code Summary

### Removed Lines 597-678 (82 lines deleted)

**Removed duplicate code included**:
- Duplicate priority badge rendering using old `yPosition` logic
- Duplicate action text rendering with page break checks
- Duplicate reason rendering with incorrect `boxCursorY` variable
- Duplicate "Tip" text rendering
- Second `return { page, yPosition };` statement

**Key identifiers removed**:
- References to `quickAction.action` (old field name)
- References to `quickAction.reason` (old field name)
- References to `boxCursorY` (incorrect variable)
- Old-style incremental yPosition manipulation

---

## Clean Implementation Details

### Single Rendering Block (lines 462-596)

**Structure**:
```typescript
// 1. Page break check with accurate box height
if (yPosition < MARGIN + boxHeight + 30) { newPage(); }

// 2. Single box cursor initialization
yPosition -= 12;
const boxTopY = yPosition;
const boxBottomY = boxTopY - boxHeight;

// 3. Draw container rectangle (ONE)
page.drawRectangle({ ... });

// 4. Inner cursor for box content
let boxY = boxTopY - 12;

// 5. Title row (ONE)
page.drawText('i', ...);
page.drawText('Assessment notes (incomplete information)', ...);

// 6. Reasons loop (ONE)
for (const reason of detection.reasons) {
  // Bullet + wrapped text
}

// 7. Quick actions loop (ONE)
if (detection.quickActions.length > 0) {
  for (const quickAction of detection.quickActions) {
    // Priority badge + title + why
  }
}

// 8. Final cursor positioning (ONE)
yPosition = boxBottomY - 12;

// 9. Single return (ONE)
return { page, yPosition };
```

---

## Verification

### No More boxCursorY References
✅ Verified: `grep boxCursorY` returns no matches in `fraCoreDraw.ts`

### Single Return Path
✅ Verified: Only ONE return statement at end of function body

### Build Status
✅ **Build Successful**
- ✓ 1945 modules transformed
- ✓ Built in 20.51s
- Output: 2.3 MB JavaScript, 66.3 KB CSS

---

## Before vs After Comparison

### Before Cleanup
```
drawInfoGapQuickActions() {
  // ... guards and early returns

  // CLEAN IMPLEMENTATION (lines 462-596)
  yPosition -= 12;
  const boxTopY = yPosition;
  // ... single-cursor rendering ...
  yPosition = boxBottomY - 12;
  return { page, yPosition };  // ← FIRST RETURN

  // OLD DUPLICATE (lines 597-678) ❌
  const priorityColor = ...;
  page.drawRectangle(...);
  // ... uses boxCursorY (wrong!)
  // ... uses quickAction.action (old field)
  yPosition -= 15;
  return { page, yPosition };  // ← SECOND RETURN ❌
}
```

### After Cleanup
```
drawInfoGapQuickActions() {
  console.log('[PDF] drawInfoGapQuickActions CLEAN VERSION');

  // ... guards and early returns

  // CLEAN IMPLEMENTATION (lines 462-596)
  yPosition -= 12;
  const boxTopY = yPosition;
  // ... single-cursor rendering ...
  yPosition = boxBottomY - 12;
  return { page, yPosition };  // ← ONLY RETURN ✅
}
```

---

## Runtime Verification

### To Verify Clean Version is Running

1. Generate a draft FRA PDF with an info gap
2. Open browser DevTools Console
3. Look for: `[PDF] drawInfoGapQuickActions CLEAN VERSION`

**Expected**: Message appears once per info gap box rendered

### To Verify No Duplicates

Check that info-gap boxes:
1. ✅ Appear only once per section (no duplicates)
2. ✅ Use clean "Assessment notes (incomplete information)" heading
3. ✅ Show priority badges with `P1`/`P2` labels
4. ✅ Display "Why:" prefixed reasons (not "Reason:")
5. ✅ No rendering errors or overlapping content

---

## Code Quality Improvements

### Removed Technical Debt
- ❌ Duplicate rendering logic (82 lines)
- ❌ Dead code after first return
- ❌ Inconsistent variable naming (`boxCursorY` vs `yPosition`)
- ❌ Old field names (`action`/`reason` vs `title`/`why`)

### Achieved Clean State
- ✅ Single rendering implementation
- ✅ Consistent variable usage (`yPosition`, `boxY`)
- ✅ Clear single-cursor flow
- ✅ Accurate height calculations
- ✅ One return path (plus early exits)

---

## Summary

✅ **Removed duplicate rendering block** (82 lines deleted)
✅ **Added debug marker** for runtime verification
✅ **Fixed orphaned `boxCursorY` bug** in separate function
✅ **Verified single return path** at end of function
✅ **Build successful** with no errors
✅ **Function now has ONE clean implementation** using single-cursor pattern

The `drawInfoGapQuickActions` function is now clean, maintainable, and uses only the modern single-cursor rendering approach.
