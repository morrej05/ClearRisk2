# DSEAR PDF Paging Bugs Fixed

## Problem
`drawModuleSection` in `src/lib/pdf/buildDsearPdf.ts` had a critical bug where it reassigned `page` after calling `addNewPage()` but only returned `yPosition`. This caused:
- Content to be drawn on wrong pages
- Page references to become stale
- Blank/orphan pages in output
- Similar issues to those previously fixed in FRA PDF hardening

## Solution Implemented

### 1. Updated drawModuleSection Signature
**Before:**
```typescript
function drawModuleSection(...): number
```

**After:**
```typescript
function drawModuleSection(...): { page: PDFPage; yPosition: number }
```

### 2. Replaced Ad-hoc Page Checks with ensurePageSpace
Replaced all manual page checks like:
- `if (yPosition < 150)` → `ensurePageSpace(25, ...)`
- `if (yPosition < 80)` → `ensurePageSpace(14, ...)`

Added preflight checks BEFORE drawing:
- Section header bar: `ensurePageSpace(60, ...)`
- "Assessor Notes:" label: `ensurePageSpace(25, ...)`
- Each notes line: `ensurePageSpace(14, ...)`
- Info-gap quick actions header: `ensurePageSpace(60, ...)`

### 3. Updated Call Site
**Before:**
```typescript
yPosition = drawModuleSection(page, module, ...);
```

**After:**
```typescript
({ page, yPosition } = drawModuleSection(page, module, ...));
```

### 4. Added ensurePageSpace Import
Added to imports from `./pdfUtils`:
```typescript
import { ..., ensurePageSpace } from './pdfUtils';
```

### 5. Changed forEach to for...of Loop
Changed `wrappedNotes.forEach(line => ...)` to `for (const line of wrappedNotes)` to allow proper page reference updates within loop scope.

## Files Modified
- `src/lib/pdf/buildDsearPdf.ts`

## Key Changes in Detail

### Import Addition (Line 30)
```typescript
import { ..., ensurePageSpace } from './pdfUtils';
```

### Call Site Update (Line 234)
```typescript
({ page, yPosition } = drawModuleSection(page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages));
```

### Function Signature Change (Line 522)
```typescript
): { page: PDFPage; yPosition: number } {
```

### Return Statement Change (Line 577)
```typescript
return { page, yPosition };
```

### Page Space Preflights
- Line 526: `({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));`
- Line 544: `({ page, yPosition } = ensurePageSpace(25, page, yPosition, pdfDoc, isDraft, totalPages));`
- Line 558: `({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));`
- Line 572: `({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));`

## Verification
✅ TypeScript compilation successful (no new errors)
✅ Production build successful (22.91s)
✅ Page breaks now propagate correctly
✅ No blank/orphan pages
✅ Pattern matches FRA PDF hardening implementation

## Notes
- `drawModuleContent` and `drawInfoGapQuickActions` were not modified as they currently return `yPosition` only and do not create pages internally within the drawing logic
- The pre-existing TypeScript warnings in the file were not addressed as they are unrelated to this paging bug fix
- `buildFraDsearCombinedPdf.ts` has its own `drawModuleSection` implementation and was not modified
