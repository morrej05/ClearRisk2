# Action Register Card Layout Upgrade - COMPLETE

## Overview

Upgraded the Action Register card layout with a professional header row design: reference on the left, priority pill badge on the right, improved spacing throughout.

## Implementation (Presentation Only)

### File Modified
**`src/lib/pdf/pdfPrimitives.ts`** - `drawActionCard` function (lines 366-463)

### Changes Made

#### 1. Updated Constants
```typescript
const cardPadding = 14;        // Increased from 12
const headerRowH = 14;         // NEW: header row height
const gapAfterHeader = 10;     // NEW: gap between header and title
const gapBeforeMeta = 10;      // NEW: gap before meta row
```

#### 2. New Header Layout
**Before:**
```
FRA-2026-001 • P4        (single line, colored text)
```

**After:**
```
FRA-2026-001                                    [P4]
(dark text, bold)                        (pill badge)
```

**Implementation:**
- **Left:** Reference number in dark text (not stripe color), bold, 9.5pt
- **Right:** Priority pill badge with:
  - Light grey background: `rgb(0.93, 0.94, 0.95)`
  - Stripe-colored text (priority-specific)
  - 6px horizontal padding, 3px vertical padding
  - Auto-width based on text measurement

#### 3. Improved Spacing Flow
```
[cardPadding: 14px]
  ↓
[Header Row: 14px]        ← Ref left, pill right
  ↓
[Gap: 10px]
  ↓
[Description Lines]       ← Wrapped title, 11.5pt
  ↓
[Gap: 10px]
  ↓
[Meta Row: 12px]          ← Owner | Target | Status
  ↓
[cardPadding: 14px]
```

#### 4. Updated Height Calculation
```typescript
const cardH = cardPadding + headerRowH + gapAfterHeader + descH + gapBeforeMeta + metaH + cardPadding;
```

Removed old calculation:
```typescript
// OLD: cardPadding + badgeRowH + 8 + descH + 8 + metaH + cardPadding
```

### Visual Comparison

#### Before
```
┌─────────────────────────────────────────────┐
│ FRA-2026-001 • P4 (colored, inline)         │
│                                             │
│ Confirm requirement for annual fire alarm   │
│ panel inspection and testing in accordance  │
│                                             │
│ Owner: John | Target: 2026-03 | Status: Open│
└─────────────────────────────────────────────┘
```

#### After
```
┌─────────────────────────────────────────────┐
│ FRA-2026-001                          [P4]  │
│                                             │
│ Confirm requirement for annual fire alarm   │
│ panel inspection and testing in accordance  │
│                                             │
│ Owner: John | Target: 2026-03 | Status: Open│
└─────────────────────────────────────────────┘
```

### Priority Pill Colors

The pill background is neutral grey, but the text color matches priority:

- **P1 Critical:** Dark red `rgb(0.65, 0.15, 0.15)`
- **P2 High:** Orange `rgb(0.70, 0.35, 0.10)`
- **P3 Medium:** Yellow `rgb(0.75, 0.65, 0.20)`
- **P4 Low:** Blue `rgb(0.12, 0.29, 0.55)`

## Preserved Behaviors

✅ **Stripe color logic** - Unchanged, still shows on left edge
✅ **Description wrapping** - Same `wrapText` implementation
✅ **Meta row content** - Exact same text format
✅ **Return signature** - Still returns `y - cardH - 12`
✅ **Evidence rendering** - Unchanged (handled elsewhere)

## What Was NOT Changed

Per scope requirements:

- ❌ No data changes
- ❌ No sorting changes
- ❌ No filtering changes
- ❌ No reference logic changes
- ❌ No evidence logic changes
- ❌ No issued/draft branching changes
- ❌ No new helpers added
- ❌ No new function arguments
- ❌ No changes to `buildFraPdf.ts`
- ❌ No changes to `fraCoreDraw.ts`

## Benefits

### Professionalism
- Clean separation of metadata
- Pill badge is a modern UI pattern
- Better visual hierarchy

### Readability
- Reference easier to spot (not in color)
- Priority stands out in pill
- More breathing room with improved padding

### Consistency
- Matches modern card design patterns
- Aligns with consultancy-style presentation

## Testing Checklist

### Test 1: P1 Action with Long Title
- **Expected:** Red pill on right, title wraps cleanly, no overlap
- **Verify:** Height calculation accurate

### Test 2: Action Without Reference
- **Expected:** No ref text on left, pill still appears on right
- **Verify:** Layout remains clean

### Test 3: Multiple Cards in Register
- **Expected:** All cards render with consistent spacing
- **Verify:** No pagination issues

### Test 4: Priority Color Mapping
- Create actions with P1, P2, P3, P4
- **Expected:** Each pill shows correct colored text
- **Verify:** Pill background always light grey

### Test 5: Edge Case - Very Long Reference
- Reference: "FRA-EMERGENCY-2026-001-CRITICAL"
- **Expected:** Pill still appears on right (may overlap if extreme)
- **Note:** Real references follow format FRA-YYYY-NNN

## File Locations

### Modified Files
- `src/lib/pdf/pdfPrimitives.ts` (lines 368-462)
  - Updated `drawActionCard` function
  - New header layout with ref + pill
  - Improved spacing constants
  - Updated height calculation

### Unchanged Files
- `src/lib/pdf/fra/fraCoreDraw.ts` - Action Register caller (no changes needed)
- `src/lib/pdf/buildFraPdf.ts` - PDF builder (no changes needed)
- All action data/sorting/filtering logic

## Related Documentation

- `ACTION_CARD_CONSULTANCY_STYLE_COMPLETE.md` - Previous card styling
- `ACTION_CARD_GUARANTEED_REF_STYLING_COMPLETE.md` - Reference display rules
- `ACTION_REFERENCE_FORMAT_FRA_YYYY_COMPLETE.md` - Reference numbering
- `ACTION_REGISTER_COMPLETE.md` - Register implementation

## Console Verification

When viewing PDF, check card rendering:

```javascript
// Each card should render with:
[PDF] Card Header: "FRA-2026-001" on left, "P4" pill on right
[PDF] Card Height: Calculated with new spacing (cardPadding + headerRowH + gaps)
[PDF] Pill Position: x + w - cardPadding - pillW
```

## Layout Math

### Pill Positioning
```typescript
priorityTextW = fonts.bold.widthOfTextAtSize(priorityText, 9)
pillW = priorityTextW + (6 * 2)  // 6px padding each side
pillX = x + w - cardPadding - pillW
```

### Height Calculation
```typescript
descH = lines.length * 14  // lineGap
cardH = 14 + 14 + 10 + descH + 10 + 12 + 14
      = 74 + descH
      = 74 + (lines.length * 14)
```

For single-line action: `74 + 14 = 88px`
For two-line action: `74 + 28 = 102px`

## Status

✅ Constants updated (padding, gaps)
✅ Header row split (ref left, pill right)
✅ Priority pill implemented (grey background, colored text)
✅ Spacing improved (gaps between sections)
✅ Height calculation updated (matches new layout)
✅ Build successful
✅ Ready to test

## Implementation Date

February 24, 2026

---

**Scope:** Presentation/layout only
**Impact:** Action Register visual improvement
**Risk:** Low (no functional changes)
**Test Required:** PDF generation with mixed priorities
