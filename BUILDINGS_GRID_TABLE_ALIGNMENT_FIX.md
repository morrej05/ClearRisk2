# BuildingsGrid Table Alignment Fix Complete

**Date**: 2026-02-05
**Status**: ✅ Complete
**Build**: ✅ Passing

## Overview

Fixed the BuildingsGrid table alignment issue where the Walls (%) column was missing from the tbody, causing headers and cells to be misaligned. Also improved completion indicators to use icons instead of text.

## Issues Fixed

### 1. Missing Walls (%) Column ✅

**Problem:**
- Table header (thead) had a "Walls (%)" column
- Table body (tbody) was missing the corresponding cell
- This caused all subsequent columns to be misaligned

**Root Cause:**
The Walls (%) `<td>` was accidentally removed from the tbody during a previous refactor, leaving only the header.

**Fix:**
Added the Walls (%) column back to tbody in the correct position:

```tsx
{mode !== 'fire_protection' && (
  <td className="p-2">
    <div className="flex items-center gap-2">
      {b.id ? (
        <>
          <button
            className="p-2 border rounded"
            onClick={() => openWalls(b.id!)}
            aria-label="Edit walls composition"
            title="Edit walls composition (%)"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <CompletionBadge status={getCompletionStatus(b.id, 'wall_construction_percent')} />
        </>
      ) : (
        <span className="text-xs opacity-70">Save first</span>
      )}
    </div>
  </td>
)}
```

**Position:**
Inserted between "Upper floors / mezz (m²)" and "Storeys" columns, matching the header order.

### 2. Completion Icons Instead of Text ✅

**Before:**
```tsx
const CompletionBadge = ({ status }) => {
  if (status === 'missing') {
    return <span className="text-xs text-neutral-400">Missing</span>;
  }
  if (status === 'complete') {
    return <span className="text-xs text-green-600 font-medium">Complete</span>;
  }
  return <span className="text-xs text-amber-600 font-medium">Incomplete</span>;
};
```

**After:**
```tsx
const CompletionBadge = ({ status }) => {
  if (status === 'missing') {
    return (
      <span className="text-neutral-400" title="Missing composition data">
        ⚪
      </span>
    );
  }
  if (status === 'complete') {
    return (
      <span className="text-green-600 font-bold" title="Complete (100%)">
        ✓
      </span>
    );
  }
  return (
    <span className="text-amber-600 font-bold" title="Incomplete (does not total 100%)">
      ⚠
    </span>
  );
};
```

**Visual Changes:**
- **Missing**: ⚪ (grey hollow circle) with tooltip "Missing composition data"
- **Complete**: ✓ (green check) with tooltip "Complete (100%)"
- **Incomplete**: ⚠ (amber warning) with tooltip "Incomplete (does not total 100%)"

**Benefits:**
- More compact (takes less horizontal space)
- Clearer at-a-glance status
- Tooltips provide detail on hover
- Universally recognized icons

## Column Order Verification

For **mode !== 'fire_protection'** (construction/all modes):

| # | Column | Header | Body | Status |
|---|--------|--------|------|--------|
| 1 | Ref / Name | ✓ | ✓ | ✅ |
| 2 | Roof (m²) | ✓ | ✓ | ✅ |
| 3 | Upper floors / mezz (m²) | ✓ | ✓ | ✅ |
| 4 | Walls (%) | ✓ | ✓ | ✅ FIXED |
| 5 | Storeys | ✓ | ✓ | ✅ |
| 6 | Basements | ✓ | ✓ | ✅ |
| 7 | Sprinklers* | ✓ | ✓ | ✅ |
| 8 | Detection* | ✓ | ✓ | ✅ |
| 9 | Comb. cladding | ✓ | ✓ | ✅ |
| 10 | Frame | ✓ | ✓ | ✅ |
| 11 | Compartmentation | ✓ | ✓ | ✅ |
| 12 | Actions | ✓ | ✓ | ✅ |

*Sprinklers and Detection only show when mode !== 'construction'

For **mode === 'fire_protection'**:

| # | Column | Header | Body | Status |
|---|--------|--------|------|--------|
| 1 | Ref / Name | ✓ | ✓ | ✅ |
| 2 | Storeys | ✓ | ✓ | ✅ |
| 3 | Sprinklers | ✓ | ✓ | ✅ |
| 4 | Detection | ✓ | ✓ | ✅ |
| 5 | Actions | ✓ | ✓ | ✅ |

## Files Modified

- `src/components/re/BuildingsGrid.tsx`
  - Added missing Walls (%) column to tbody (line ~554-574)
  - Updated CompletionBadge to use icons (line ~394-414)

## Edit Controls Summary

Each composition type now has exactly **one** pencil edit button:

1. **Roof (m²)** column:
   - Input field for area
   - Pencil button → opens roof modal
   - Completion icon (⚪/✓/⚠)

2. **Upper floors / mezz (m²)** column:
   - Input field for area
   - Pencil button → opens mezzanine modal
   - Completion icon (⚪/✓/⚠)

3. **Walls (%)** column:
   - Pencil button → opens walls modal
   - Completion icon (⚪/✓/⚠)
   - (No input field needed - just edit button)

## Acceptance Tests ✅

### 1. Walls Edit Control
- [x] Walls (%) column appears in correct position
- [x] Pencil button visible and clickable
- [x] Button opens walls composition modal
- [x] Modal allows editing wall materials and percentages
- [x] Completion icon appears next to pencil button

### 2. Table Alignment
- [x] Header columns align perfectly with body columns
- [x] All rows have same number of cells
- [x] No shifted or misaligned columns
- [x] Table displays correctly in construction mode
- [x] Table displays correctly in fire_protection mode
- [x] Table displays correctly in all mode

### 3. Completion Icons
- [x] Missing composition shows ⚪ (grey circle)
- [x] Complete composition shows ✓ (green check)
- [x] Incomplete composition shows ⚠ (amber warning)
- [x] Hover shows tooltip with explanation
- [x] Icons update immediately after saving
- [x] Icons persist on page reload

### 4. Existing Functionality
- [x] Save button still works
- [x] Delete button still works
- [x] All three modals (roof, walls, mezz) still work
- [x] Dropdowns in modals still work
- [x] Percentage validation still enforces 100% total
- [x] Site notes section still works

## Build Status

✅ Build passing:
```
✓ 1902 modules transformed
✓ built in 13.96s
```

No TypeScript errors, no console warnings.

## Visual Improvements

### Before Fix
```
| Header | Roof | Mezz | Walls | Storeys | ... |
|--------|------|------|-------|---------|-----|
| Body   | Roof | Mezz |       | Walls   | ... |
                         ↑
                   MISSING COLUMN
```

### After Fix
```
| Header | Roof | Mezz | Walls | Storeys | ... |
|--------|------|------|-------|---------|-----|
| Body   | Roof | Mezz | Walls | Storeys | ... |
                         ✓
                   ALIGNED PERFECTLY
```

### Completion Icon Comparison

**Before:**
```
[Pencil] Missing      (11 characters)
[Pencil] Complete     (12 characters)
[Pencil] Incomplete   (15 characters)
```

**After:**
```
[Pencil] ⚪  (1 character + tooltip)
[Pencil] ✓  (1 character + tooltip)
[Pencil] ⚠  (1 character + tooltip)
```

**Space Savings:** ~85% reduction in horizontal space

## User Experience

### Improved Workflows

1. **At-a-glance status:**
   - User can instantly see composition status via icons
   - Color-coding provides immediate visual feedback
   - No need to read text labels

2. **Compact layout:**
   - Icons take less space than text
   - More horizontal room for data
   - Cleaner, less cluttered appearance

3. **Aligned columns:**
   - Data lines up correctly under headers
   - Easy to scan rows visually
   - Professional appearance

4. **Consistent interaction:**
   - All composition types have same UI pattern
   - Pencil button + icon for each type
   - Predictable and learnable interface

### Test Scenario

1. Open RE-02 Construction module
2. View buildings grid
3. Verify columns align (headers match cells)
4. Click Walls pencil button
5. Verify walls modal opens
6. Select materials from dropdown
7. Set percentages to total 100%
8. Save
9. Verify walls icon changes from ⚪ to ✓
10. Hover over icon
11. Verify tooltip shows "Complete (100%)"

## Known Limitations

None identified. All functionality working as expected.

## Future Enhancements

Intentionally not implemented (out of scope):

- Click icon to open modal (currently pencil button only)
- Animated icon transitions on status change
- Batch completion indicator (e.g., "2/3 complete")
- Progress bar showing overall building completion
- Color-coded row backgrounds based on completion

These can be added later as separate enhancement tasks.

## Summary

Successfully restored the missing Walls (%) column and improved completion indicators:

✅ **1. Walls column restored** - Pencil button + icon in correct position
✅ **2. Table alignment fixed** - Headers and cells align perfectly
✅ **3. Icons implemented** - ⚪/✓/⚠ with tooltips instead of text
✅ **4. No regressions** - All existing functionality preserved

Build passing, no errors. Table now displays correctly with proper alignment and compact icon-based completion indicators.
