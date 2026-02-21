# Section 6 Spacing Optimization Complete

**Status**: ✅ Complete
**Date**: 2026-02-21

## Overview

Optimized Section 6 (Means of Escape) spacing to keep Outcome + Key Details on the first page and only push the info-gap box to a new page when truly necessary.

---

## Changes Applied

### 1. Info-Gap Page Break Threshold Reduced ✅

**File**: `src/lib/pdf/fra/fraCoreDraw.ts` (line 455-456)

**Before**:
```typescript
// Check if we need a new page
if (yPosition < MARGIN + boxHeight + 50) {
```

**After**:
```typescript
// Check if we need a new page (reduced threshold from 50 to 30 for tighter packing)
if (yPosition < MARGIN + boxHeight + 30) {
```

**Impact**: Reduces buffer by 20px, allowing info-gap box to fit on the same page more often.

---

### 2. Debug Marker Added ✅

**File**: `src/lib/pdf/fra/fraCoreDraw.ts` (line 785-788)

**Added**:
```typescript
// Debug marker for Section 6 (FRA_2_ESCAPE_ASIS)
if (module.module_key === 'FRA_2_ESCAPE_ASIS') {
  console.log('[PDF] S6 spacing patch applied');
}
```

**Purpose**: Confirms correct code path is being executed when rendering Section 6.

---

## Already Optimized (No Changes Needed)

### Assessor Summary Gap
- **Current**: `AFTER_BOX_GAP = 22` (line 697)
- **Status**: ✅ Already increased from 14 to 22
- **No change needed**

### Outcome Badge Gap
- **Current**: `yPosition -= 24;` (line 820)
- **Status**: ✅ Already increased from 18 to 24
- **No change needed**

### Key Details Spacing
- **Heading gap**: `yPosition -= 8;` (line 305) - Already compact
- **Label gap**: `yPosition -= 10;` (line 322) - Already compact
- **Value line gap**: `yPosition -= 10;` (line 337) - Already compact
- **Item gap**: `yPosition -= 2;` (line 339) - Already compact
- **Status**: ✅ Already optimized
- **No changes needed**

---

## Summary of Changes

| Component | Previous | Current | Change | Status |
|-----------|----------|---------|--------|--------|
| Assessor Summary gap | 14 | 22 | +8px | ✅ Already done |
| Outcome gap | 18 | 24 | +6px | ✅ Already done |
| Key Details heading | Various | 8-10px | Compact | ✅ Already done |
| Info-gap page break threshold | +50 | +30 | -20px | ✅ **NEW** |
| Debug marker | None | Added | - | ✅ **NEW** |

---

## Effect on Section 6 Layout

### Before Optimization
```
┌─────────────────────────────────────┐
│ Assessor Summary                    │
│   (+14px gap)                       │
│ Outcome: [badge]                    │
│   (+18px gap)                       │
│ Key Details:                        │
│   • Item 1  (+18/14/5)              │
│   • Item 2                          │
│                                     │
│ [Info-gap checks with +50px buffer]│
│ → Often jumps to new page          │
└─────────────────────────────────────┘
```

### After Optimization
```
┌─────────────────────────────────────┐
│ Assessor Summary                    │
│   (+22px gap) ← Increased           │
│ Outcome: [badge]                    │
│   (+24px gap) ← Increased           │
│ Key Details:                        │
│   • Item 1  (+8/10/2) ← Tighter     │
│   • Item 2                          │
│                                     │
│ [Info-gap checks with +30px buffer]│
│ → Stays on page more often ✅       │
└─────────────────────────────────────┘
```

---

## Runtime Verification

### To Verify Section 6 Rendering

1. Generate a draft FRA PDF with Section 6 (Means of Escape)
2. Open browser DevTools Console
3. Look for: `[PDF] S6 spacing patch applied`

**Expected**: Message appears when Section 6 is rendered

### To Verify Layout

Check that Section 6:
1. ✅ Has comfortable gap after Assessor Summary (22px)
2. ✅ Has comfortable gap after Outcome badge (24px)
3. ✅ Key Details are compact but readable
4. ✅ Info-gap box stays on same page (if space allows within 30px threshold)

---

## Build Status

✅ **Build Successful**
- ✓ 1945 modules transformed
- ✓ Built in 22.20s
- Output: 2.3 MB JavaScript, 66 KB CSS

---

## Technical Notes

### Why These Changes Work

1. **Increased gaps where needed**: Assessor Summary and Outcome get more breathing room (already applied)
2. **Compacted Key Details**: Vertical spacing reduced to reclaim space (already applied)
3. **Reduced info-gap threshold**: Changed from +50px to +30px buffer, allowing box to fit on page more often (new)

### Page Break Logic

The info-gap box calculates its required height dynamically:
```typescript
const boxHeight = headingHeight + (totalReasonLines * lineHeight) +
                  quickActionsHeight + paddingTop + paddingBottom;
```

Then checks if there's room:
```typescript
if (yPosition < MARGIN + boxHeight + 30) {  // Reduced from +50
  // Create new page
}
```

This means:
- Box only jumps to new page if less than `boxHeight + 30px` remains
- Previously required `boxHeight + 50px`, causing premature page breaks
- 20px reduction allows more content to stay together

---

## Testing Recommendations

1. Generate PDFs for documents with Section 6 (Means of Escape)
2. Verify spacing looks professional and readable
3. Check that info-gap boxes stay on the same page when possible
4. Confirm no overlapping or cutoff content

---

## Summary

✅ Reduced info-gap page break threshold from +50px to +30px
✅ Added debug marker for Section 6 rendering verification
✅ Confirmed existing optimizations (gaps already increased, Key Details already compact)
✅ Build successful with no errors
✅ Layout will now keep Outcome + Key Details together more effectively
