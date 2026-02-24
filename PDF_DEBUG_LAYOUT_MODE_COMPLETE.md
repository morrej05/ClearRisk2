# PDF Debug Layout Mode - Complete

## Overview
Added developer-only overlay system for PDF layout debugging. When enabled, shows baseline grid, margin guides, and page-break annotations to make spacing/pagination tuning fast and precise.

## Environment Flag

### Enable Debug Mode
Add to `.env.local` or environment:
```
VITE_PDF_DEBUG_LAYOUT=true
```

### Disable Debug Mode
Remove the flag or set to false:
```
VITE_PDF_DEBUG_LAYOUT=false
```

When disabled, there are **ZERO** visual changes - all debug code is gated behind the flag check.

## Implementation

### 1. pdfUtils.ts

#### Added Debug Flag (line 9)
```typescript
// PDF Debug Layout Mode - developer-only overlay for spacing/pagination tuning
export const PDF_DEBUG_LAYOUT = import.meta.env.VITE_PDF_DEBUG_LAYOUT === 'true';
```

#### Added Debug Helpers (lines 323-391)

**drawBaselineGrid(page, step = 12)**
- Draws horizontal baseline grid lines every 12pt (or custom step)
- Light blue color, low opacity (0.25)
- Helps align text and spacing to consistent baseline rhythm

**drawMarginGuides(page)**
- Draws top/bottom/left/right margin boundary lines
- Blue color (0.2, 0.6, 1.0), medium opacity (0.35)
- Shows safe content area boundaries

**drawDebugLabel(page, x, y, text, font?)**
- Draws small 6pt text label in blue
- Used for annotations like page break triggers
- High opacity (0.9) for readability

#### Updated addNewPage (lines 393-411)
```typescript
export function addNewPage(pdfDoc: PDFDocument, isDraft: boolean, totalPages: PDFPage[]): { page: PDFPage } {
  // ... existing initialization ...

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  // Draw debug overlays when flag is enabled
  if (PDF_DEBUG_LAYOUT) {
    drawBaselineGrid(page, 12);
    drawMarginGuides(page);
  }

  totalPages.push(page);
  return { page };
}
```

### 2. pdfCursor.ts

#### Updated Imports (line 2)
```typescript
import { addNewPage, PAGE_HEIGHT, MARGIN, PDF_DEBUG_LAYOUT, drawDebugLabel } from './pdfUtils';
```

#### Added Page-Break Annotations in ensureSpace (lines 80-88)
```typescript
export function ensureSpace(
  requiredHeight: number,
  cursor: Cursor,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): Cursor {
  // Check if we have enough space
  if (cursor.yPosition - requiredHeight < MARGIN + 50) {
    // Annotate page break trigger in debug mode
    if (PDF_DEBUG_LAYOUT && cursor.page) {
      drawDebugLabel(
        cursor.page,
        MARGIN,
        cursor.yPosition + 6,
        `PAGE BREAK: y=${Math.round(cursor.yPosition)} need=${Math.round(requiredHeight)}`
      );
    }

    // Not enough space - create new page
    const init = addNewPage(pdfDoc, isDraft, totalPages);
    return {
      page: init.page,
      yPosition: PAGE_TOP_Y,
    };
  }

  // Enough space - return unchanged
  return cursor;
}
```

### 3. pdfPrimitives.ts

#### Updated Imports (line 3)
```typescript
import { wrapText, PDF_DEBUG_LAYOUT } from './pdfUtils';
```

#### Added drawDebugBox Helper (lines 7-27)
```typescript
/**
 * Debug helper: Draw bounding box with label for layout debugging
 */
export function drawDebugBox(page: PDFPage, x: number, yTop: number, w: number, h: number, label: string) {
  if (!PDF_DEBUG_LAYOUT) return;
  page.drawRectangle({
    x,
    y: yTop - h,
    width: w,
    height: h,
    borderColor: rgb(0.2, 0.6, 1.0),
    borderWidth: 0.5,
    opacity: 0.25,
  });
  page.drawText(label, {
    x: x + 2,
    y: yTop + 2,
    size: 6,
    color: rgb(0.2, 0.6, 1.0),
  });
}
```

This helper can be used in PDF drawing code to visualize block boundaries:
```typescript
// Example usage (not yet implemented everywhere):
const blockHeight = 100;
drawDebugBox(page, x, yTop, width, blockHeight, 'Action Card');
```

## Visual Features

### When VITE_PDF_DEBUG_LAYOUT=true

#### Baseline Grid
- Horizontal lines every 12pt
- Color: Very light blue rgb(0.85, 0.90, 1.0)
- Opacity: 0.25 (subtle)
- Purpose: Align text and elements to consistent vertical rhythm

#### Margin Guides
- Four boundary lines (top, bottom, left, right)
- Color: Blue rgb(0.2, 0.6, 1.0)
- Opacity: 0.35 (medium)
- Purpose: Visualize safe content area

#### Page Break Annotations
- Small blue text label
- Format: `PAGE BREAK: y=123 need=45`
- Shows current Y position and required height
- Placed at exact point where page break was triggered
- Purpose: Debug pagination logic

#### Debug Boxes (available for use)
- Blue rectangular border
- 6pt label at top-left
- Purpose: Visualize block boundaries for complex layouts

### When VITE_PDF_DEBUG_LAYOUT=false (or not set)
- **NO visual changes**
- All debug code short-circuits immediately
- Zero performance impact
- Production-ready PDFs

## Design Principles

### 1. Read-Only & Safe
- Debug mode only adds visual overlays
- No changes to layout logic or scoring
- No changes to spacing, positioning, or content
- Completely non-invasive

### 2. Gated Behind Flag
```typescript
if (!PDF_DEBUG_LAYOUT) return;
```
Every debug function checks the flag first and returns immediately if disabled.

### 3. Consistent Visual Language
- **Blue color scheme**: All debug overlays use shades of blue
- **Low opacity**: Debug elements don't obscure content
- **Small text**: 6pt labels don't interfere with layout
- **Thin lines**: 0.25-0.5pt strokes

### 4. Performance Conscious
- Minimal drawing operations
- Early returns when disabled
- No complex calculations
- Flag checked at compile time (Vite env var)

## Use Cases

### 1. Spacing Alignment
Use baseline grid to ensure:
- Text lines align to 12pt rhythm
- Consistent vertical spacing between elements
- Proper line height calculations

### 2. Margin Violations
Margin guides show:
- Content staying within safe area
- Elements not overlapping margins
- Proper page boundaries

### 3. Pagination Issues
Page break annotations help debug:
- Why page breaks occur at specific points
- Required height calculations
- Y-position tracking through layout

### 4. Block Layout (Future)
Debug boxes can visualize:
- Action card boundaries
- Executive summary badge placement
- Section header blocks
- Table row heights

## Testing Workflow

### Enable Debug Mode
1. Add `VITE_PDF_DEBUG_LAYOUT=true` to `.env.local`
2. Restart dev server (`npm run dev`)
3. Generate PDF (draft or issued)
4. Open PDF in viewer

### What to Look For
- ✅ Baseline grid visible on all pages
- ✅ Margin guides showing safe area
- ✅ Page break labels at pagination points
- ✅ No overlapping content
- ✅ Consistent spacing aligned to grid

### Disable Debug Mode
1. Remove flag or set to `false`
2. Restart dev server
3. Generate same PDF
4. Verify identical to production output

### Validation Checklist
- [ ] Debug overlays appear when flag is true
- [ ] No visual changes when flag is false
- [ ] Page break annotations show correct Y positions
- [ ] Margin guides align to 50pt boundaries
- [ ] Baseline grid at 12pt intervals
- [ ] All pages have debug overlays (not just first)
- [ ] Debug elements don't interfere with content readability

## Future Enhancements (Not Implemented)

### Action Card Debug Boxes
Add to action card drawing code:
```typescript
const cardHeight = calculateCardHeight(action);
drawDebugBox(page, MARGIN, yPosition, CONTENT_WIDTH, cardHeight, 'Action');
// ... draw actual action card ...
```

### Executive Badge Visualization
Add to executive summary:
```typescript
drawDebugBox(page, badgeX, badgeY, badgeW, badgeH, 'Priority Badge');
```

### Section Header Blocks
Add to section renderers:
```typescript
drawDebugBox(page, x, y, w, headerHeight, `Section ${sectionId}`);
```

### Cursor Position Tracking
Add cursor position indicator:
```typescript
drawDebugLabel(page, PAGE_WIDTH - MARGIN - 50, cursor.yPosition,
  `Y: ${Math.round(cursor.yPosition)}`);
```

## Implementation Notes

### Why 12pt Grid?
- Standard baseline rhythm in typography
- Matches typical 10pt body text with 1.2 line height (= 12pt)
- Divisible by 2, 3, 4, 6 for flexible spacing
- Common in professional design systems

### Why Blue Color Scheme?
- Distinct from content (typically black/gray)
- Good contrast against white background
- Blue = informational (not error/warning)
- Consistent with developer tools conventions

### Why Low Opacity?
- Debug elements shouldn't obscure actual content
- Need to see both overlay AND content beneath
- 0.25-0.35 opacity allows both to be visible
- Higher opacity (0.9) only for small text labels

## Build Status
✅ Build successful (19.14s)
✅ No TypeScript errors
✅ No runtime errors when flag disabled
✅ All debug helpers properly gated

## Files Modified
1. `src/lib/pdf/pdfUtils.ts` - Added flag, grid, guides, label helpers + updated addNewPage
2. `src/lib/pdf/pdfCursor.ts` - Added page-break annotations in ensureSpace
3. `src/lib/pdf/pdfPrimitives.ts` - Added drawDebugBox helper for block visualization

## Example Debug Output

When `VITE_PDF_DEBUG_LAYOUT=true`:

```
Page 1:
  - Baseline grid (12pt intervals)
  - Margin guides (50pt from edges)

Page 2:
  - Baseline grid
  - Margin guides
  - "PAGE BREAK: y=85 need=120" (at bottom)

Page 3:
  - Baseline grid
  - Margin guides
  ...
```

All debug elements automatically appear on every page through the `addNewPage()` hook.

## Related Documentation
- See `.bolt/FRAMEWORK_ARCHITECTURE.md` for PDF system overview
- See `FRA_PDF_CURSOR_PROPAGATION_COMPLETE.md` for cursor system details
- See `PDF_THEME_AND_PRIMITIVES_COMPLETE.md` for styling system
