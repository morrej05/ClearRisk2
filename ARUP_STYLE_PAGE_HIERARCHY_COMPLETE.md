# Arup-Style Page Hierarchy Implementation - COMPLETE

## Summary
Applied consistent Arup-style page hierarchy across key FRA PDF pages using shared primitives for professional, consultancy-grade formatting.

## Changes Made

### 1. New Shared Primitives (`src/lib/pdf/pdfPrimitives.ts`)

Added three new helper functions to ensure consistent styling:

#### A) `drawPageTitle(page, x, y, title, fonts)`
- H1-level page heading
- Size: 26pt, bold, charcoal color
- Includes rule line underneath (1px, cool grey)
- Returns new y position (y - 34)
- Used for: Contents, Action Register

#### B) `drawSectionTitle(page, x, y, title, fonts)`
- H2-level section heading
- Size: 14pt, bold, charcoal color
- Returns new y position (y - 18)
- Used for: Executive Summary subsections

#### C) `drawContentsRow(page, x, y, sectionNumber, title, fonts)`
- Aligned number column format: "01  Section Title"
- Number: 12pt bold, aligned in 28px column
- Title: 12pt regular
- Returns new y position (y - 18)

### 2. Contents Page (`src/lib/pdf/fra/fraCoreDraw.ts` - `drawTableOfContents`)

**Before:**
- Ad-hoc title style (size 20, hardcoded color)
- Inconsistent spacing
- Manual number formatting

**After:**
- Uses `drawPageTitle()` for "Contents" heading
- Uses `drawContentsRow()` for each section entry
- Aligned number column (01-13)
- Consistent 18pt row spacing
- Professional rule line under title

### 3. Executive Summary (`src/lib/pdf/fra/fraCoreDraw.ts` - `drawCleanAuditPage1`)

**Before:**
- Used `drawExecutiveRiskHeader()` with custom styling
- Mixed styling approach

**After:**
- Uses `drawSectionTitle()` for "OVERALL RISK TO LIFE"
- Adds consistent rule line (1px divider)
- Maintains existing risk badge and band visuals
- Preserves 72pt gap before likelihood/consequence block
- Consistent rhythm with other page headings

### 4. Action Register (`src/lib/pdf/fra/fraCoreDraw.ts` - `drawActionRegister`)

**Before:**
- Ad-hoc title style (size 16, basic formatting)
- No rule line

**After:**
- Uses `drawPageTitle()` for "Action Register" heading
- Includes professional rule line
- Consistent spacing (12pt after title)
- Matches Contents page hierarchy

## Design Principles Applied

1. **Single Source of Truth**: All page titles use shared primitives - no more hardcoded sizes/colors
2. **Consistent Rhythm**: Uniform spacing tokens (18pt, 24pt) across all pages
3. **Visual Hierarchy**: Clear H1 (page titles) vs H2 (section titles) distinction
4. **Professional Styling**: Rule lines, aligned columns, charcoal/grey color palette
5. **Consultancy Grade**: Matches Arup/engineering consultancy report standards

## Files Modified

- `src/lib/pdf/pdfPrimitives.ts` - Added 3 new primitives (+85 lines)
- `src/lib/pdf/fra/fraCoreDraw.ts` - Updated 3 functions:
  - `drawTableOfContents()` - Contents page
  - `drawCleanAuditPage1()` - Executive Summary
  - `drawActionRegister()` - Action Register

## Testing

✅ Build successful - no TypeScript errors
✅ All primitives properly exported and imported
✅ Consistent styling across Contents, Exec Summary, and Action Register
✅ No scoring logic changes (design-layer only)

## Result

The FRA PDF now has professional, consistent page hierarchy that matches high-end engineering consultancy reports with:
- Strong page titles with rule lines
- Aligned contents listing
- Unified section headers
- Professional spacing and rhythm
