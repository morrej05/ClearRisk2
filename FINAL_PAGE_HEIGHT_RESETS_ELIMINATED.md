# Final PAGE_HEIGHT-Based Y Resets Eliminated

## Overview
Eliminated the last two PAGE_HEIGHT-based y resets that were overriding addNewPage cursor returns.

## Changes Made

### 1. drawKeyPointsBlock.ensureSpace (keyPoints/drawKeyPointsBlock.ts)

**Location:** Line 46

**Before:**
```typescript
function ensureSpace(...): { page: PDFPage; yPosition: number } {
  if (currentY - requiredHeight < MARGIN + 50) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    return { page: result.page, yPosition: PAGE_HEIGHT - MARGIN };
  }
  return { page: currentPage, yPosition: currentY };
}
```

**After:**
```typescript
function ensureSpace(...): { page: PDFPage; yPosition: number } {
  if (currentY - requiredHeight < MARGIN + 50) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    return { page: result.page, yPosition: PAGE_TOP_Y };
  }
  return { page: currentPage, yPosition: currentY };
}
```

**Changes:**
- Added `PAGE_TOP_Y` to imports
- Replaced `PAGE_HEIGHT - MARGIN` with `PAGE_TOP_Y`

### 2. drawActionPlanSnapshot (pdfUtils.ts)

**Location:** Lines 1074-1078

**Before:**
```typescript
const context = {
  page: addNewPage(pdfDoc, isDraft, totalPages).page,
  yPosition: PAGE_HEIGHT - MARGIN - 20,
};
```

**After:**
```typescript
const result = addNewPage(pdfDoc, isDraft, totalPages);
const context = {
  page: result.page,
  yPosition: result.yPosition,
};
```

**Changes:**
- Now uses the `yPosition` returned by `addNewPage` (which is `PAGE_TOP_Y`)
- Removed hardcoded `PAGE_HEIGHT - MARGIN - 20` calculation
- If extra padding is needed, it should be applied explicitly after: `context.yPosition -= 12`

## Verification Results

### No PAGE_HEIGHT Resets After addNewPage
✅ **pdfUtils.ts** - No PAGE_HEIGHT resets after addNewPage calls
✅ **drawKeyPointsBlock.ts** - Now uses PAGE_TOP_Y
✅ **All PDF build files** - Using PAGE_TOP_Y consistently

### Remaining PAGE_HEIGHT References (Intentional)
The following PAGE_HEIGHT usages are NOT post-addNewPage resets and are intentional:

1. **buildFsdPdf.ts:263** - `yPosition = PAGE_HEIGHT - 150`
   - Cover page intentional vertical centering
   - NOT after an addNewPage call

2. **buildFsdPdf.ts:1330** - `yPosition = PAGE_HEIGHT - MARGIN - 60`
   - Conditional adjustment when content continues on same page
   - NOT after an addNewPage call
   - Used for "Project-Specific Limitations" section positioning

### Build Status
```bash
npm run build
✓ built in 19.88s
✓ 1949 modules transformed
```

## Impact

### Consistency
- All addNewPage calls now have their yPosition respected
- No manual overrides undermining the cursor system
- Predictable page start behavior across all sections

### Maintainability
- Single source of truth (PAGE_TOP_Y) used everywhere
- No hidden recalculations after page creation
- Clear contract: addNewPage returns correct yPosition

### Correctness
- Key Points blocks now start at correct position
- Action Plan Snapshot aligns with other sections
- No -20 offset discrepancies

## Technical Details

### addNewPage Return Contract
```typescript
export function addNewPage(...): { page: PDFPage; yPosition: number } {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  // ... debug overlays ...
  totalPages.push(page);
  return { page, yPosition: PAGE_TOP_Y };  // Guaranteed consistent start
}
```

### Correct Usage Pattern
```typescript
// ✅ CORRECT - Use returned yPosition
const result = addNewPage(pdfDoc, isDraft, totalPages);
let yPosition = result.yPosition;  // Already PAGE_TOP_Y

// Apply explicit spacing if needed
yPosition -= 12;  // Clear, intentional adjustment

// ❌ INCORRECT - Manual override (eliminated)
const result = addNewPage(pdfDoc, isDraft, totalPages);
let yPosition = PAGE_HEIGHT - MARGIN - 20;  // Undermines contract
```

### Verification Commands

#### Check for PAGE_HEIGHT resets after addNewPage
```bash
grep -A3 "addNewPage" src/lib/pdf/**/*.ts | grep "yPosition.*PAGE_HEIGHT"
# Result: No matches (all eliminated)
```

#### Check remaining PAGE_HEIGHT usages
```bash
grep -rn "yPosition.*PAGE_HEIGHT" src/lib/pdf --include="*.ts"
# Result: Only intentional positioning (cover pages, conditional adjustments)
```

#### Verify PAGE_TOP_Y usage
```bash
grep -A3 "addNewPage" src/lib/pdf/**/*.ts | grep -E "(PAGE_TOP_Y|result.yPosition)"
# Result: All post-addNewPage usage is PAGE_TOP_Y or result.yPosition
```

## Summary

Successfully eliminated the final two PAGE_HEIGHT-based y resets that were overriding addNewPage cursor:

1. **drawKeyPointsBlock.ensureSpace** - Now returns `PAGE_TOP_Y` after creating new page
2. **drawActionPlanSnapshot** - Now uses `result.yPosition` from addNewPage

All addNewPage call sites now respect the returned yPosition. No manual PAGE_HEIGHT-based recalculations occur after page creation. The only remaining PAGE_HEIGHT references are intentional positioning logic not related to addNewPage calls.

**Result:** Complete consistency in page start positioning across all PDF generation code.
