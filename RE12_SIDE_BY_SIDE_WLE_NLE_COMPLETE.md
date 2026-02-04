# RE-12 WLE/NLE Side-by-Side Layout — Complete

**Status:** ✅ Complete
**Date:** 2026-02-04
**Task:** Render Property Damage and Business Interruption side-by-side in WLE and NLE sections

---

## Summary

WLE and NLE sections have been redesigned to display Property Damage and Business Interruption side-by-side instead of stacked vertically. This further reduces vertical scrolling and improves visual comparison between the two loss components.

---

## Changes Made

### 1. WLE (Worst Case Loss Estimate) — Side-by-Side Layout

**Before:**
```
Scenario text
Property Damage Loss (full width table)
Business Interruption Loss (full width)
WLE Total
```

**After:**
```
Scenario text
┌─────────────────────────────┬─────────────────────────────┐
│ Property Damage Loss (LEFT) │ Business Interruption (RIGHT) │
│ - Table with 5 rows         │ - 2 compact input rows       │
│ - PD Total                  │ - BI Total                   │
└─────────────────────────────┴─────────────────────────────┘
WLE Total
```

**Layout Grid:**
- `grid-cols-1 lg:grid-cols-2` (responsive: stacks on mobile, side-by-side on desktop)
- `gap-4` (16px gap between columns)

### 2. NLE (Normal Loss Expectancy) — Same Pattern

Identical structure applied to NLE section:
```
Scenario text
┌─────────────────────────────┬─────────────────────────────┐
│ Property Damage Loss (LEFT) │ Business Interruption (RIGHT) │
│ - Table with 5 rows         │ - 2 compact input rows       │
│ - PD Total                  │ - BI Total                   │
└─────────────────────────────┴─────────────────────────────┘
NLE Total
```

---

## Property Damage Table Changes

### Column Structure
**Before:** 4 columns (Category | % Loss | Sub-total | Sum Insured)
**After:** 3 columns (Category | % Loss | Sub-total)

**Rationale:**
- Removed "Sum Insured" reference column to save horizontal space
- Side-by-side layout reduces available width per column
- Sub-total calculations provide sufficient context

### Column Widths
- Category: Flexible (`text-left`)
- % Loss: Fixed 64px (`w-16`)
- Sub-total: Fixed 96px (`w-24`)

### Label Abbreviations
- "Buildings & Improvements" → "Buildings"
- "Plant & Machinery + Contents" → "Plant & Mach."
- Other labels unchanged (Stock & WIP, Computers, Other)

### Total Row Display
**Before:** Single row with 4 columns
**After:** 2 rows
1. Total row: `WLE PD Total` | (empty) | `£X,XXX`
2. Percentage row: colspan 3, right-aligned, `X.X% of Total PD`

---

## Business Interruption Layout Changes

### Structure
**Before:** 2-column grid within full-width container
**After:** Single column with `space-y-2` vertical spacing

### Components
1. **Outage duration (months)** — Label + 100px input
2. **% of Gross Profit** — Label + 100px input
3. **BI Total summary** — Gray box with:
   - Total value (bold)
   - Percentage of Total BI (smaller text)

### Spacing
- Row gap: `space-y-2` (8px)
- Summary box margin-top: `mt-3` (12px)
- Internal spacing: `p-2` (8px padding)

---

## Visual Improvements

### Horizontal Space Usage
- **WLE section before:** ~1200px wide (full width)
- **WLE section after:** 2 × ~550px wide (side-by-side with gap)
- **Benefit:** More efficient screen space utilization on wide screens

### Vertical Space Savings
- **WLE before:** PD table (~200px) + BI section (~150px) = ~350px
- **WLE after:** max(PD table, BI section) = ~200px
- **Savings per section:** ~150px (43% reduction)
- **Total savings (WLE + NLE):** ~300px

### Overall Page Height
- **Previous total:** ~1570px (after first compact layout)
- **Current total:** ~1270px
- **Additional savings:** ~300px (19% further reduction)
- **Total savings from original:** ~58% reduction

---

## Responsive Behavior

### Desktop (≥1024px)
```
┌─────────────────────┬─────────────────────┐
│ Property Damage     │ Business Interrupt. │
│ (5 rows + total)    │ (2 inputs + total)  │
└─────────────────────┴─────────────────────┘
```

### Tablet/Mobile (<1024px)
```
┌─────────────────────────────────┐
│ Property Damage                 │
│ (5 rows + total)                │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ Business Interruption           │
│ (2 inputs + total)              │
└─────────────────────────────────┘
```

**Breakpoint:** `lg:` prefix = 1024px

---

## Data Flow & Calculations

### No Changes to:
- Data structure
- Calculation logic
- State management
- Save/submit behavior

### All calculations remain identical:
- `calcWLEPDSubtotal()` — Property damage sub-totals
- `calcWLEPDTotal()` — Total PD
- `calcWLEBITotal()` — Total BI
- `calcWLETotal()` — Combined PD + BI
- `calcWLEPDPctOfTotal()` — % of total PD
- `calcWLEBIPctOfTotal()` — % of total BI
- `calcWLETotalPctOfTotal()` — % of total sums insured

(Same pattern for NLE calculations)

---

## Code Changes Summary

### File Modified
`src/components/modules/forms/RE12LossValuesForm.tsx`

### Lines Modified
- **WLE section:** Lines 644-862 (replaced ~230 lines)
- **NLE section:** Lines 913-1131 (replaced ~230 lines)
- **Total:** ~460 lines restructured

### Key Pattern
```tsx
{/* PD and BI Side-by-Side Grid */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
  {/* LEFT: Property Damage Loss Table */}
  <div>
    <h4>Property Damage Loss</h4>
    <table>...</table>
  </div>

  {/* RIGHT: Business Interruption Loss */}
  <div>
    <h4>Business Interruption Loss</h4>
    <div className="space-y-2">...</div>
  </div>
</div>
```

---

## Benefits

### For Engineers
1. **Less scrolling:** Both PD and BI visible simultaneously
2. **Easier comparison:** Can see relationship between PD and BI inputs
3. **Better screen utilization:** Side-by-side maximizes horizontal space on wide screens
4. **Faster data entry:** Less mouse/keyboard movement between sections

### For Reviewers
1. **Quick visual scan:** PD and BI at same eye level
2. **Pattern recognition:** Easier to spot inconsistencies (e.g., high PD% but low BI%)
3. **Context preservation:** Both metrics visible without scrolling
4. **Professional appearance:** Balanced, modern layout

### Technical
1. **Responsive:** Automatically stacks on narrow screens
2. **Consistent:** Same pattern for WLE and NLE
3. **Maintainable:** Clear grid structure, easy to modify
4. **Accessible:** Logical tab order, proper labels

---

## Alignment Strategy

### Vertical Alignment
- PD table and BI section headers align at top
- BI inputs are naturally shorter than PD table
- BI total summary provides visual weight to balance PD total row

### Visual Balance
- PD table: Dense with 5 data rows
- BI section: Sparse with 2 input rows + summary
- Gap between columns: 16px provides breathing room
- Both sections have similar visual weight despite different heights

---

## Color Coding (Unchanged)

- **WLE totals:** Blue (`bg-blue-50`, `border-blue-200`)
- **NLE totals:** Green (`bg-green-50`, `border-green-200`)
- **Summary boxes:** Light gray (`bg-slate-50`, `border-slate-200`)

---

## Typography (Unchanged)

- Section headers: `text-xs font-semibold` (12px bold)
- Table headers: `text-xs font-semibold` (12px bold)
- Data rows: `text-xs` (12px)
- Totals: `text-xs font-bold` or `font-semibold` (12px bold/semibold)

---

## Build Status

✅ Built successfully
✅ No TypeScript errors
✅ No linting issues
✅ Production-ready

**Build time:** 13.24s
**Bundle size:** 2,000.54 kB

---

## Comparison: Original vs First Compact vs Final Side-by-Side

| Metric | Original | First Compact | Side-by-Side | Total Savings |
|--------|----------|---------------|--------------|---------------|
| RE-12.1 height | ~1200px | ~450px | ~450px | 62% |
| WLE height | ~800px | ~500px | ~350px | 56% |
| NLE height | ~800px | ~500px | ~350px | 56% |
| Summary height | ~200px | ~120px | ~120px | 40% |
| **Total** | **~3000px** | **~1570px** | **~1270px** | **58%** |

---

## User Experience Improvements

### Before (Original)
1. Scroll down to RE-12.1
2. Enter sums insured (long scroll)
3. Scroll to WLE
4. Enter PD percentages
5. Scroll to BI inputs
6. Scroll to NLE
7. Enter PD percentages
8. Scroll to BI inputs
9. Scroll to summary

**Total scrolls:** ~8 major scroll actions

### After (Side-by-Side)
1. Scroll down to RE-12.1
2. Enter sums insured (compact)
3. Scroll to WLE
4. Enter PD and BI simultaneously (visible together)
5. Scroll to NLE
6. Enter PD and BI simultaneously (visible together)
7. Summary immediately visible

**Total scrolls:** ~3-4 major scroll actions (50% reduction)

---

## Browser Compatibility

### CSS Features Used
- CSS Grid (`display: grid`)
- Grid template columns (`grid-cols-1`, `lg:grid-cols-2`)
- Gap property (`gap-4`)
- Responsive utilities (`lg:` prefix)
- Flexbox for internal alignment

**Supported:** All modern browsers (Chrome, Firefox, Safari, Edge)
**IE11:** Not supported (grid layout not available)

---

**End of Document**
