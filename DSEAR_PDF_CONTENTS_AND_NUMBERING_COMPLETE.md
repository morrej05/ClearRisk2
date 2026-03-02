# DSEAR PDF Contents Page and Numbered Sections - Implementation Complete

## Summary
Successfully implemented a Table of Contents page and numbered section headings for DSEAR PDFs, matching the structure and professionalism of FRA reports. Module titles now display without the "DSEAR-" prefix for cleaner presentation.

## Changes Made

### 1. Added Contents Page
**Location:** After Document Control page, before Executive Summary

The Contents page includes:
- Section 1: Explosion Criticality Assessment
- Section 2: Purpose and Introduction
- Section 3: Hazardous Area Classification Methodology
- Section 4: Zone Definitions
- Section 5: Scope (if present)
- Section 6: Limitations and Assumptions (if present)
- Sections 7+: All module sections (stripped of "DSEAR-" prefix)
- References and Compliance
- Action Register
- Attachments Index (if present)

**Implementation:**
- Added `drawTableOfContents()` function that uses `drawPageTitle()` and `drawContentsRow()` from pdfPrimitives
- Contents page inserted after doc control in `buildDsearPdf()` main flow
- Dynamic section numbering adjusts based on presence of Scope and Limitations

### 2. Module Title Prefix Removal
**Function:** `stripDsearPrefix()`

Removes patterns like "DSEAR-1 - ", "DSEAR-10 - " from module display names:
- Before: "DSEAR-1 - Dangerous Substances"
- After: "Dangerous Substances"

**Applied to:**
- Module section headers in PDF body
- Module listings in Contents page

### 3. Numbered Section Headings
All section drawing functions updated to include section numbers:

**Updated Functions:**
- `drawExplosionCriticalitySummary()` - Section 1
- `drawPurposeAndIntroduction()` - Section 2
- `drawHazardousAreaClassification()` - Section 3
- `drawZoneDefinitions()` - Section 4
- `drawScope()` - Section 5 (conditional)
- `drawLimitations()` - Section 6 (conditional)
- `drawModuleSection()` - Sections 7+ (dynamic)
- `drawReferencesAndCompliance()` - After modules
- `drawActionRegister()` - After references
- `drawAttachmentsIndex()` - Final section (conditional)

**Implementation Pattern:**
- Each function now accepts a `sectionNumber: number` parameter
- Section titles rendered using `drawPageTitle()` with format: `"X. Section Name"`
- Dynamic numbering propagates through `buildDsearPdf()` using `nextSectionNumber` counter

### 4. Section Numbering Logic
**Dynamic Calculation:**
```typescript
let nextSectionNumber = 5; // After fixed sections 1-4

// Conditional sections increment counter only if present
if (scope_description) nextSectionNumber++; // Section 5
if (limitations_assumptions) nextSectionNumber++; // Section 6

// Modules start from nextSectionNumber and increment for each module
for (let i = 0; i < sortedModules.length; i++) {
  const sectionNumber = nextSectionNumber + i;
  // ...
}
nextSectionNumber += sortedModules.length;

// Final sections use nextSectionNumber++
```

This ensures continuous numbering regardless of which optional sections are included.

### 5. Helper Functions Added
```typescript
stripDsearPrefix(moduleName: string): string
// Removes "DSEAR-<n> - " prefix from display names

getModuleSectionNumber(moduleKey: string, sortedModules: ModuleInstance[]): number
// Calculates section number for a module (currently unused but available)
```

### 6. Module Rendering Updates
**drawModuleSection() changes:**
- Added `sectionNumber` parameter
- Added `sortedModules` parameter for context
- Module titles now display as: `"7. Dangerous Substances"` instead of `"DSEAR-1 - Dangerous Substances"`
- Uses `stripDsearPrefix()` to clean module names before display

## Visual Impact
**Before:**
- No Contents page
- Sections had no numbers
- Module headers showed "DSEAR-1 - Dangerous Substances"

**After:**
- Professional Contents page with section numbers
- All sections numbered continuously (1, 2, 3...)
- Module headers show "7. Dangerous Substances"
- Cleaner, more professional appearance matching FRA reports

## Technical Details

### Import Additions
```typescript
import { drawSectionHeaderBar, drawPageTitle, drawContentsRow } from './pdfPrimitives';
```

### Key Files Modified
- `src/lib/pdf/buildDsearPdf.ts` (main implementation)

### No Database Changes
This is purely a PDF presentation enhancement. No database schema or data changes required.

## Testing Checklist
- [x] Build succeeds without TypeScript errors
- [ ] Generate DSEAR PDF and verify Contents page appears
- [ ] Verify all section headings are numbered
- [ ] Verify module titles don't show "DSEAR-" prefix
- [ ] Verify numbering is continuous when Scope/Limitations omitted
- [ ] Verify numbering is continuous when Scope/Limitations included
- [ ] Verify Attachments Index section numbering (when attachments present)

## Consistency with FRA
The implementation follows the same patterns used in FRA PDF generation:
- Uses `drawPageTitle()` for section headers
- Uses `drawContentsRow()` for Contents entries
- Section numbering format matches FRA style
- Contents page structure mirrors FRA approach

## Future Enhancements
- Could add actual page numbers to Contents entries (would require two-pass rendering)
- Could add hyperlinks from Contents to sections (PDF internal links)
- Could add subsection numbering (e.g., 7.1, 7.2) for module sub-sections
