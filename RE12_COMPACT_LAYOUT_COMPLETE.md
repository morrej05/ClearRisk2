# RE-12 Compact Layout — Complete

**Status:** ✅ Complete
**Date:** 2026-02-04
**Task:** Compact spreadsheet-style layout for RE-12 Loss & Values

---

## Summary

RE-12 has been redesigned with a compact, spreadsheet-like layout to reduce vertical scrolling and speed up data entry. The module now uses side-by-side grids, table-style inputs, and minimal spacing optimized for keyboard-based numeric entry.

---

## 1. RE-12.1 Sums Insured — Side-by-Side Compact Layout

### Layout Structure
**Before:** Single-column stacked inputs (very tall, lots of scrolling)
**After:** Two-column grid layout (Property Damage left, Business Interruption right)

### Property Damage (Left Column)
- Compact rows with label on left, 140px numeric input on right
- Text size reduced to `text-xs` (12px)
- Row spacing reduced to `space-y-1.5` (6px)
- Input padding reduced to `py-1` (4px)
- Total PD displayed in compact summary row

**Fields:**
- Buildings & Improvements
- Plant & Machinery + Contents
- Stock & WIP
- Computers
- Other (editable label + value)
- **Total PD** (auto-calculated, read-only)

### Business Interruption (Right Column)
- Same compact row structure as Property Damage
- 140px numeric inputs aligned right
- Calculated values (Monthly BI, Daily BI) in lighter background
- Total BI displayed in compact summary row

**Fields:**
- Gross Profit (Annual)
- AICOW
- Loss of Rent
- Other (editable label + value)
- Indemnity Period (months)
- Operating days per year
- Monthly BI value (auto, read-only)
- Daily BI value (auto, read-only)
- **Total BI** (auto-calculated, read-only)

### Total Sums Insured
Full-width blue highlighted row showing combined PD + BI total

### Grid Specifications
```css
grid-cols-1 lg:grid-cols-2  /* Single column mobile, 2-col desktop */
gap-6                        /* 24px gap between columns */
grid-cols-[1fr,140px]       /* Label takes remaining space, input 140px */
space-y-1.5                  /* 6px vertical spacing */
text-xs                      /* 12px font size */
py-1                         /* 4px vertical padding */
```

---

## 2. RE-12.2 WLE — Compact Table Layout

### Narrative Fields (Top)
- Scenario Summary: Single-line text input (full width)
- Scenario Description: 2-row textarea (full width, reduced from 4 rows)
- Placed ABOVE numeric tables (not interspersed)

### Property Damage Loss Table
- True HTML table with compact styling
- Column structure:
  - Category (left-aligned)
  - % Loss (20px input, right-aligned)
  - Sub-total (32px, read-only, right-aligned)
  - Sum Insured (32px, read-only, right-aligned)
- Row height: `py-1` (8px total)
- Input size: `px-1 py-0.5` (minimal padding)
- Font size: `text-xs` (12px)
- Total row with light background

**5 data rows + 1 total row = 6 rows total**

### Business Interruption Loss — Compact 2-Column Grid
- Outage duration (months) | % of Gross Profit
- Side-by-side inputs (100px each)
- BI Total displayed in compact summary row
- Percentage of Total BI auto-calculated

### WLE Total Summary
Blue highlighted panel with:
- WLE PD + BI Total (bold)
- % of Total PD + BI (smaller text)

---

## 3. RE-12.3 NLE — Identical Compact Structure

### Layout
Exact same structure as WLE:
- Narrative fields at top (2 fields)
- Property Damage Loss table (5 rows + 1 total)
- Business Interruption compact grid (2 inputs + 1 summary)
- NLE Total summary (green highlighted panel)

**Difference from WLE:** Green color scheme instead of blue

---

## 4. Summary Comparison Table — Compact

### Before
Three-row comparison with lots of vertical space

### After
Compact HTML table with 3 columns:
- Metric (left-aligned)
- Value (right-aligned, bold)
- % of Sums Insured (right-aligned)

**3 rows:**
1. WLE
2. NLE
3. NLE as % of WLE (blue background)

Table header with border, minimal row padding (`py-2`), font size `text-xs`

---

## 5. Vertical Space Savings

### Before (Estimated Heights)
- RE-12.1: ~1200px
- WLE: ~800px
- NLE: ~800px
- Summary: ~200px
**Total: ~3000px**

### After (Estimated Heights)
- RE-12.1: ~450px (side-by-side saves ~750px)
- WLE: ~500px (table layout saves ~300px)
- NLE: ~500px (table layout saves ~300px)
- Summary: ~120px (table saves ~80px)
**Total: ~1570px**

**Overall savings: ~48% reduction in vertical scrolling**

---

## 6. Typography & Spacing Scale

### Text Sizes
- Section headings: `text-base` (16px)
- Subsection headings: `text-sm` (14px)
- Table headers: `text-xs font-semibold` (12px bold)
- Labels & inputs: `text-xs` (12px)
- Read-only calculations: `text-xs` (12px)

### Spacing
- Section gaps: `space-y-4` (16px)
- Inner element gaps: `space-y-1.5` to `space-y-3` (6px-12px)
- Row padding: `py-1` to `py-2` (4px-8px)
- Input padding: `px-2 py-1` (8px horizontal, 4px vertical)
- Container padding: `p-4` (16px)

### Input Widths
- Numeric inputs (sums): 140px
- Percentage inputs: 100px or 80px (table cells)
- Text inputs: `w-full`

---

## 7. Responsive Behavior

### Desktop (lg: 1024px+)
- RE-12.1: Two-column grid (Property Damage | Business Interruption)
- WLE/NLE: Full-width tables with 4 columns
- BI section: Two-column grid

### Mobile (<1024px)
- RE-12.1: Single column (stacks Property Damage above Business Interruption)
- WLE/NLE: Tables remain full-width (may scroll horizontally)
- BI section: Stacks to single column

**Grid class:** `grid-cols-1 lg:grid-cols-2`

---

## 8. Color Coding

### Background Colors
- Property Damage / BI totals: `bg-slate-50` (light gray)
- Sums Insured total: `bg-blue-50` (light blue)
- WLE total: `bg-blue-50` (light blue)
- NLE total: `bg-green-50` (light green)
- Summary comparison: `bg-blue-50` for NLE % of WLE row

### Border Colors
- Standard: `border-slate-200` to `border-slate-300`
- Totals: `border-slate-200` or `border-blue-200` / `border-green-200`

---

## 9. Keyboard Entry Optimization

### Features
- Numeric inputs right-aligned (like spreadsheets)
- Tab order follows visual layout (left-to-right, top-to-bottom)
- Compact row spacing minimizes mouse movement
- Clear visual hierarchy with borders and backgrounds

### Input Attributes
```html
<input
  type="number"
  className="px-2 py-1 border border-slate-300 rounded text-xs text-right"
  placeholder="0"
  min="0"
  max="100"  /* for percentages */
/>
```

---

## 10. Technical Implementation

### File Modified
**File:** `src/components/modules/forms/RE12LossValuesForm.tsx`
**Lines:** 1,210 lines (complete rewrite from previous version)

### Key Layout Techniques
1. **CSS Grid with fixed columns:** `grid-cols-[1fr,140px]`
2. **Tailwind responsive utilities:** `grid-cols-1 lg:grid-cols-2`
3. **HTML tables for tabular data:** `<table>` with `border-collapse`
4. **Minimal spacing:** `space-y-1.5`, `py-1`, `gap-2`
5. **Right-aligned numeric inputs:** `text-right` class

### Data Structure
No changes to data structure — all calculations and storage remain identical to previous version.

---

## 11. Benefits

### For Engineers
1. **Faster data entry:** Less scrolling, more visible context
2. **Spreadsheet-like feel:** Familiar layout for numeric data
3. **Quick visual comparison:** Side-by-side columns, compact tables
4. **Clear totals:** Highlighted summary rows at each section

### For Reviewers
1. **Quick overview:** All sums insured visible on one screen
2. **Easy comparison:** WLE vs NLE side-by-side logic
3. **Clear calculations:** Read-only totals clearly distinguished
4. **Professional appearance:** Clean, modern, business-like

---

## 12. Build Status

✅ Built successfully
✅ No TypeScript errors
✅ No linting issues
✅ Production-ready

---

**End of Document**
