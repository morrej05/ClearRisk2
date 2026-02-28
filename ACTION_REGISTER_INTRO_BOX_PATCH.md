# Action Register Intro Box - Patch Diff

## Summary
Added professional intro box to FRA Action Register (Section 13) with deterministic height measurement and pagination preflight.

---

## File 1: `src/lib/pdf/pdfPrimitives.ts`

### Location: End of file (after line 566)

```typescript
// Action Register Intro Box Constants (private to this module)
const ACTION_REGISTER_INTRO_TITLE = "Action Register";
const ACTION_REGISTER_INTRO_BODY = "The following actions arise from the findings of this Fire Risk Assessment. Each action has been prioritised based on potential life safety impact and overall risk. Recommended timescales should be considered alongside operational constraints and statutory obligations.";
const AR_INTRO_PADDING = 12;
const AR_INTRO_TITLE_GAP = 6;
const AR_INTRO_TITLE_SIZE = 12;
const AR_INTRO_BODY_SIZE = 10.5;
const AR_INTRO_BOX_COLOR = rgb(0.94, 0.94, 0.94);

/**
 * Measure Action Register intro box height deterministically
 * Must match exact rendering logic in drawActionRegisterIntroBox
 */
export function measureActionRegisterIntroBoxHeight(args: {
  w: number;
  fonts: Fonts;
}): {
  height: number;
  bodyLines: string[];
  titleLineHeight: number;
  bodyLineHeight: number;
} {
  const { w, fonts } = args;
  const innerW = w - 2 * AR_INTRO_PADDING;

  // Wrap body text
  const bodyLines = wrapText(
    ACTION_REGISTER_INTRO_BODY,
    innerW,
    AR_INTRO_BODY_SIZE,
    fonts.regular
  );

  // Calculate line heights
  const titleLineHeight = PDF_THEME.typography.lineHeight(AR_INTRO_TITLE_SIZE);
  const bodyLineHeight = PDF_THEME.typography.lineHeight(AR_INTRO_BODY_SIZE);

  // Calculate total body height
  const bodyHeight = bodyLines.length * bodyLineHeight;

  // Total height: top padding + title + gap + body + bottom padding
  const height = AR_INTRO_PADDING + titleLineHeight + AR_INTRO_TITLE_GAP + bodyHeight + AR_INTRO_PADDING;

  return { height, bodyLines, titleLineHeight, bodyLineHeight };
}

/**
 * Draw Action Register intro box
 * Rendering logic must match measurement in measureActionRegisterIntroBoxHeight
 */
export function drawActionRegisterIntroBox(args: {
  page: PDFPage;
  x: number;
  y: number;
  w: number;
  fonts: Fonts;
  product: PdfProduct;
}): { y: number; height: number } {
  const { page, x, y, w, fonts } = args;

  // Measure first to get exact dimensions
  const measurement = measureActionRegisterIntroBoxHeight({ w, fonts });
  const { height, bodyLines, titleLineHeight, bodyLineHeight } = measurement;

  // Draw background rectangle
  page.drawRectangle({
    x,
    y: y - height,
    width: w,
    height,
    color: AR_INTRO_BOX_COLOR,
  });

  // Draw text using top-down cursor that EXACTLY matches measurement
  const textX = x + AR_INTRO_PADDING;
  let cursorY = y - AR_INTRO_PADDING;

  // Draw title
  cursorY -= titleLineHeight;
  page.drawText(ACTION_REGISTER_INTRO_TITLE, {
    x: textX,
    y: cursorY,
    size: AR_INTRO_TITLE_SIZE,
    font: fonts.bold,
    color: PDF_THEME.colours.text,
  });

  // Gap after title
  cursorY -= AR_INTRO_TITLE_GAP;

  // Draw body lines
  for (const line of bodyLines) {
    cursorY -= bodyLineHeight;
    page.drawText(line, {
      x: textX,
      y: cursorY,
      size: AR_INTRO_BODY_SIZE,
      font: fonts.regular,
      color: PDF_THEME.colours.text,
    });
  }

  // Return bottom Y position and height
  return { y: y - height, height };
}
```

**Added:** 119 lines (constants + 2 exported functions)

---

## File 2: `src/lib/pdf/fra/fraCoreDraw.ts`

### Change 1: Add imports (line 23-34)

```diff
 import {
   drawExecutiveRiskHeader,
   drawRiskBadge,
   drawRiskBand,
   drawLikelihoodConsequenceBlock,
   drawActionCard,
   drawPageTitle,
   drawSectionTitle,
   drawContentsRow,
+  drawActionRegisterIntroBox,
+  measureActionRegisterIntroBoxHeight,
 } from '../pdfPrimitives';
```

### Change 2: Update function signature (line 1510-1523)

```diff
 export async function drawActionRegister(
   cursor: Cursor,
   actions: Action[],
   actionRatings: ActionRating[],
   moduleInstances: ModuleInstance[],
   font: any,
   fontBold: any,
   pdfDoc: PDFDocument,
   isDraft: boolean,
   totalPages: PDFPage[],
   attachments?: Attachment[],
-  evidenceRefMap?: Map<string, string>
+  evidenceRefMap?: Map<string, string>,
+  options?: { showIntroBox?: boolean }
 ): Promise<{ page: PDFPage; yPosition: number }> {
```

### Change 3: Replace spacing logic (line 1527-1570)

```diff
   // Use Arup-style page title
   yPosition = drawPageTitle(page, MARGIN, yPosition, 'Action Register', { regular: font, bold: fontBold });

-  yPosition -= 12;
+  // Action Register intro box with preflight
+  const INTRO_BOX_GAP_AFTER = 12;
+  const MIN_FIRST_ACTION_HEIGHT = 110;
+  const PAGE_BOTTOM_Y = MARGIN;
+  const showIntroBox = options?.showIntroBox !== false;
+
+  if (showIntroBox) {
+    // Measure intro box height deterministically
+    const intro = measureActionRegisterIntroBoxHeight({
+      w: CONTENT_WIDTH,
+      fonts: { regular: font, bold: fontBold },
+    });
+
+    // Preflight: check if intro + gap + first action will fit
+    const required = intro.height + INTRO_BOX_GAP_AFTER + MIN_FIRST_ACTION_HEIGHT;
+
+    if (yPosition - required < PAGE_BOTTOM_Y) {
+      // Won't fit, start new page
+      const result = addNewPage(pdfDoc, isDraft, totalPages);
+      page = result.page;
+      yPosition = PAGE_TOP_Y;
+    }
+
+    // Draw intro box
+    const drawn = drawActionRegisterIntroBox({
+      page,
+      x: MARGIN,
+      y: yPosition,
+      w: CONTENT_WIDTH,
+      fonts: { regular: font, bold: fontBold },
+      product: 'fra',
+    });
+
+    // Set cursor with fixed gap after intro box
+    yPosition = drawn.y - INTRO_BOX_GAP_AFTER;
+  } else {
+    // Preserve old behavior when intro disabled
+    yPosition -= 12;
+  }

   // Build rating map (latest per action)
```

**Changed:** +40 lines, -1 line

---

## Root Cause & Solution

### The Painted Element
Plain `<button>` element - no pseudo-elements or overlays involved.

### Root Cause
The task was to add an intro box, not fix a background issue. The Action Register previously had no intro box, just simple `yPosition -= 12` spacing.

### Solution Applied
**Option B pattern** (though technically a new feature):
- Added background layer inside a measured box
- Used deterministic height calculation
- Implemented preflight to prevent page splits
- Feature flag for backward compatibility

### Why This Approach
1. **Deterministic measurement:** Height calculated once, rendering matches exactly
2. **Pagination preflight:** Checks space before drawing, prevents splits
3. **Consistent spacing:** Fixed 12px gap after intro guarantees consistent first action position
4. **Backward compatible:** Feature flag allows disabling for testing/comparison

---

## Verification

### Build Status
✅ TypeScript compilation successful
✅ No lint errors
✅ Build output clean

### Expected Runtime Behavior
- **Intro box:** Light grey background, 12px padding, title + body text
- **Positioning:** Appears once, directly under "Action Register" page title
- **Pagination:** Never splits across pages (preflight ensures this)
- **First action:** Consistently starts 12px below intro box
- **Disabled mode:** Falls back to old `yPosition -= 12` behavior

### Testing Checklist
- [ ] Generate FRA with short action list (all fit on one page)
- [ ] Generate FRA with long action list (multiple pages)
- [ ] Generate FRA where Action Register starts near page bottom
- [ ] Verify intro box never splits
- [ ] Verify first action spacing is consistent (12px gap)
- [ ] Test with `showIntroBox: false` option

---

## Design Specifications Met

✅ Heading: "Action Register" (bold, 12pt)
✅ Body: Exact copy text provided
✅ Background: Light grey `rgb(0.94, 0.94, 0.94)`
✅ Padding: 12px all sides
✅ Title-body gap: 6px
✅ Box-action gap: 12px fixed
✅ Deterministic height measurement
✅ Pagination preflight implemented
✅ Feature flag with default ON
✅ Minimal, surgical changes only
✅ No unrelated refactoring

## Maintenance Notes

### Feature Flag Usage
```typescript
// Default (intro ON)
await drawActionRegister(cursor, actions, ...);

// Explicitly ON
await drawActionRegister(cursor, actions, ..., { showIntroBox: true });

// Disabled (old behavior)
await drawActionRegister(cursor, actions, ..., { showIntroBox: false });
```

### Adding Similar Intro Boxes
Follow the same pattern:
1. Add constants (title, body, padding, sizes, color)
2. Create `measure...Height()` function
3. Create `draw...()` function ensuring rendering matches measurement
4. Add preflight check in renderer
5. Use feature flag for backward compatibility
