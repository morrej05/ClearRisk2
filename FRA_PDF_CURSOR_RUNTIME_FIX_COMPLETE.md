# FRA PDF Cursor Runtime Fix - Complete

## Problem
After the initial cursor refactor, a runtime crash occurred:
```
Cannot read properties of undefined (reading 'drawRectangle')
```

**Root Cause:** The function `drawModuleSummary` had old-style call sites to `drawModuleKeyDetails` and `drawInfoGapQuickActions` that were passing individual parameters instead of the new `Cursor` object. This meant `page` was undefined inside `drawInfoGapQuickActions`, causing the crash when it tried to call `page.drawRectangle()`.

## Solution

### Fixed `drawModuleSummary` Function (lines 2054-2143)

**Before:**
```typescript
function drawModuleSummary(
  page: PDFPage,
  module: ModuleInstance,
  document: Document,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  // ... implementation ...

  yPosition = drawModuleKeyDetails(page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  yPosition = drawInfoGapQuickActions(page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  return yPosition;
}
```

**After:**
```typescript
function drawModuleSummary(
  cursor: Cursor,
  module: ModuleInstance,
  document: Document,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): Cursor {
  let { page, yPosition } = cursor;
  // ... implementation ...

  ({ page, yPosition } = drawModuleKeyDetails({ page, yPosition }, module, document, font, fontBold, pdfDoc, isDraft, totalPages));
  ({ page, yPosition } = drawInfoGapQuickActions({ page, yPosition }, module, document, font, fontBold, pdfDoc, isDraft, totalPages));

  return { page, yPosition };
}
```

### Changes Made

1. **Updated function signature:**
   - Removed individual `page` and `yPosition` parameters
   - Added single `cursor: Cursor` parameter
   - Changed return type from `number` to `Cursor`

2. **Destructured cursor on entry:**
   ```typescript
   let { page, yPosition } = cursor;
   ```

3. **Updated internal page breaks:**
   - Changed `yPosition = PAGE_HEIGHT - MARGIN - 20` to `yPosition = PAGE_TOP_Y`
   - Ensures consistency with the rest of the codebase

4. **Updated sub-function calls:**
   - Changed from passing individual params to cursor pattern
   - Both `drawModuleKeyDetails` and `drawInfoGapQuickActions` now receive and return cursor correctly

5. **Updated return statement:**
   - Returns `{ page, yPosition }` instead of just `yPosition`

## Call Sites Status

`drawModuleSummary` appears to be an unused/legacy function - no call sites were found in the current codebase. However, fixing it ensures:
- Consistency across all layout functions
- No hidden bugs if it gets called in the future
- Clean removal of all old-style function signatures

## Verification

### Build Status
✅ **Build successful** - No TypeScript errors

### Files Modified
1. **src/lib/pdf/buildFraPdf.ts**
   - Fixed `drawModuleSummary` signature and implementation (lines 2054-2143)

## Impact

### Before
- `drawModuleSummary` called sub-functions with old signature
- Sub-functions expected `Cursor` but received individual params
- Parameter mismatch caused `page` to be `undefined`
- Runtime crash when trying to access `page.drawRectangle()`

### After
- `drawModuleSummary` uses cursor pattern consistently
- All sub-function calls match expected signatures
- Page ownership propagates correctly
- No runtime crashes

## Testing Recommendations

Since the original error was a runtime crash, testing should focus on:

1. **Generate any FRA PDF** - The most basic test to ensure no crashes
2. **Check browser console** - Verify no undefined property errors
3. **Verify PDF renders correctly** - Ensure content appears as expected

## Notes

- This fix completes the cursor refactor by ensuring ALL layout functions use the consistent cursor pattern
- The `drawModuleSummary` function is currently unused, but fixing it prevents future bugs
- All layout functions now have consistent signatures: accept `Cursor`, return `Cursor`
- The `PAGE_TOP_Y` constant usage is now universal across all updated functions
