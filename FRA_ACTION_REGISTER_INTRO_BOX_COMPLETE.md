# FRA PDF – Action Register Intro Box Implementation Complete

## Summary
Implemented a professional intro box at the top of the Action Register page (Section 13) with deterministic height measurement and pagination preflight to ensure the intro box never splits across pages and the first action starts consistently.

## Changes Made

### 1. Added Primitives to `src/lib/pdf/pdfPrimitives.ts`

**New Constants (private to module):**
- `ACTION_REGISTER_INTRO_TITLE = "Action Register"`
- `ACTION_REGISTER_INTRO_BODY` = Full body text about actions arising from FRA
- `AR_INTRO_PADDING = 12`
- `AR_INTRO_TITLE_GAP = 6`
- `AR_INTRO_TITLE_SIZE = 12`
- `AR_INTRO_BODY_SIZE = 10.5`
- `AR_INTRO_BOX_COLOR = rgb(0.94, 0.94, 0.94)` (light grey)

**New Exported Functions:**

#### `measureActionRegisterIntroBoxHeight()`
- Takes width and fonts as input
- Wraps body text using existing `wrapText()` utility
- Calculates line heights using `PDF_THEME.typography.lineHeight()`
- Returns exact height, body lines, and line heights
- **Critical:** Measurement logic exactly matches rendering logic

#### `drawActionRegisterIntroBox()`
- Draws light grey background rectangle
- Uses top-down cursor that matches measurement exactly
- Draws title (bold, 12pt) and body (regular, 10.5pt)
- Returns bottom Y position and total height
- No double-counting of line heights

### 2. Updated `src/lib/pdf/fra/fraCoreDraw.ts`

**Added Imports:**
```typescript
import {
  // ... existing imports
  drawActionRegisterIntroBox,
  measureActionRegisterIntroBoxHeight,
} from '../pdfPrimitives';
```

**Updated Function Signature:**
```typescript
export async function drawActionRegister(
  // ... existing parameters
  options?: { showIntroBox?: boolean }
): Promise<{ page: PDFPage; yPosition: number }>
```

**Implementation Logic:**

1. **Feature Flag:** Default ON, only disabled when `options.showIntroBox === false`

2. **Preflight Check:**
   - Measures intro box height deterministically
   - Calculates required space: `intro.height + INTRO_BOX_GAP_AFTER + MIN_FIRST_ACTION_HEIGHT`
   - If won't fit on current page, adds new page before drawing intro
   - Prevents intro box from ever splitting across pages

3. **Drawing:**
   - Draws intro box at current cursor position
   - Sets cursor to `drawn.y - INTRO_BOX_GAP_AFTER` (12px gap)
   - Ensures consistent spacing before first action

4. **Fallback:** When disabled, preserves old behavior (`yPosition -= 12`)

## Layout Correctness

### Deterministic Height Measurement
- Measurement and rendering use identical logic
- Both use `PDF_THEME.typography.lineHeight()` for consistency
- No magic numbers or estimation

### Pagination Preflight
- Checks if `intro + gap + MIN_FIRST_ACTION_HEIGHT` fits
- Page-breaks BEFORE drawing if insufficient space
- Guarantees intro box never splits

### Consistent Spacing
- Fixed 12px gap after intro box
- No double spacing before first action
- Cursor management is precise and deterministic

## Copy Text (Exact Match)

**Title:** "Action Register"

**Body:** "The following actions arise from the findings of this Fire Risk Assessment. Each action has been prioritised based on potential life safety impact and overall risk. Recommended timescales should be considered alongside operational constraints and statutory obligations."

## Visual Design

- **Background:** Light grey `rgb(0.94, 0.94, 0.94)`
- **Padding:** 12px all sides
- **Title:** Bold, 12pt, dark text color
- **Body:** Regular, 10.5pt, dark text color
- **Title-to-body gap:** 6px
- **Box-to-action gap:** 12px (fixed)

## Feature Flag Behavior

### Default (Intro Box ON)
```typescript
await drawActionRegister(cursor, actions, ..., undefined);
// or explicitly:
await drawActionRegister(cursor, actions, ..., { showIntroBox: true });
```

### Disabled (Old Behavior)
```typescript
await drawActionRegister(cursor, actions, ..., { showIntroBox: false });
// Preserves old yPosition -= 12 spacing
```

## Testing Scenarios

### Scenario 1: Short Action List
- Intro box appears once under page title
- First action starts 12px below intro box
- All content fits on first page

### Scenario 2: Long Action List
- Intro box appears once on first page
- Actions continue across multiple pages
- No duplicate intro boxes

### Scenario 3: Action Register Starts Near Bottom
- Prior content fills page close to bottom margin
- Preflight detects insufficient space
- New page added BEFORE drawing intro
- Intro box + first action both start on fresh page
- No split or orphaned content

### Scenario 4: Intro Disabled
- Old behavior restored
- Simple 12px spacing
- No intro box drawn

## Implementation Notes

### Minimal Changes
- Only two files modified: `pdfPrimitives.ts` and `fraCoreDraw.ts`
- No refactoring of unrelated code
- No new lint rules or configuration changes

### Consistent with Codebase
- Uses existing `wrapText()` utility
- Follows existing `PDF_THEME` patterns
- Matches cursor management style
- Uses existing `addNewPage()` signature

### Type Safety
- TypeScript types maintained
- Optional parameter with clear default behavior
- Return types preserved

## Files Modified

1. **src/lib/pdf/pdfPrimitives.ts** (+119 lines)
   - Added intro box constants
   - Added `measureActionRegisterIntroBoxHeight()` function
   - Added `drawActionRegisterIntroBox()` function

2. **src/lib/pdf/fra/fraCoreDraw.ts** (+40 lines, -1 line)
   - Added imports for new primitives
   - Updated `drawActionRegister()` signature with options parameter
   - Replaced simple spacing with conditional intro box + preflight logic

## Build Status

✅ Build successful
✅ TypeScript compilation passed
✅ No lint errors
✅ No breaking changes

## Next Steps

The implementation is complete and ready for testing. Generate FRA PDFs with various action list sizes to verify:
- Intro box renders correctly
- Pagination preflight works
- First action spacing is consistent
- Feature flag behaves as expected
