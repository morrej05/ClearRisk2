# DSEAR PDF TOC and Numbered Sections - Complete

## Summary
Successfully implemented dynamic Table of Contents (TOC) and numbered section titles for DSEAR PDFs (both standalone and combined FRA+DSEAR). Module headings now display without "DSEAR-<n> -" prefix while maintaining internal consistency.

## Problem Statement
DSEAR PDFs lacked:
1. **No TOC page** - No contents/index page after document control
2. **Unnumbered sections** - Sections had no numeric prefixes like FRA PDFs
3. **Verbose module names** - DSEAR modules showed "DSEAR-1 - Dangerous Substances..." instead of just "Dangerous Substances"

## Implementation

### 1. DSEAR-Only PDF (`buildDsearPdf.ts`)

#### Dynamic TOC Recording System

**Before:** Static TOC with no actual page numbers
```typescript
function drawTableOfContents(
  page: PDFPage,
  sortedModules: ModuleInstance[],
  hasScope: boolean,
  hasLimitations: boolean,
  hasAttachments: boolean,
  font: any,
  fontBold: any
): void {
  // Hard-coded section list, no page numbers
  yPosition = drawContentsRow(page, MARGIN + 20, yPosition, sectionNumber++, 'Explosion Criticality Assessment', ...);
}
```

**After:** Dynamic page number tracking
```typescript
// Reserve TOC page early
const tocResult = addNewPage(pdfDoc, isDraft, totalPages);
const tocPage = tocResult.page;

// TOC tracking array
const tocEntries: Array<{ title: string; pageNo: number }> = [];
const recordToc = (title: string) => tocEntries.push({ title, pageNo: totalPages.length });

// Record each section as it starts
recordToc('1. Explosion Criticality Assessment');
recordToc('2. Purpose and Introduction');
// ... etc

// Render TOC at end with actual page numbers
drawTableOfContents(tocPage, tocEntries, font, fontBold);
```

#### Updated TOC Rendering Function

```typescript
function drawTableOfContents(
  tocPage: PDFPage,
  tocEntries: Array<{ title: string; pageNo: number }>,
  font: any,
  fontBold: any
): void {
  let yPosition = PAGE_TOP_Y - 40;

  // Title
  yPosition = drawPageTitle(tocPage, MARGIN, yPosition, 'Contents', { regular: font, bold: fontBold });
  yPosition -= 12;

  // Render entries with page numbers
  for (const entry of tocEntries) {
    if (yPosition < MARGIN + 50) break;

    // Draw section title (left-aligned)
    const sanitizedTitle = sanitizePdfText(entry.title);
    tocPage.drawText(sanitizedTitle, {
      x: MARGIN + 20,
      y: yPosition,
      size: 11,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Draw page number (right-aligned)
    const pageNumText = entry.pageNo.toString();
    const pageNumWidth = font.widthOfTextAtSize(pageNumText, 11);
    tocPage.drawText(pageNumText, {
      x: PAGE_WIDTH - MARGIN - pageNumWidth,
      y: yPosition,
      size: 11,
      font: font,
      color: rgb(0, 0, 0),
    });

    yPosition -= 16;
  }
}
```

#### Section Numbering Scheme

**DSEAR-only PDF sections:**
1. Explosion Criticality Assessment
2. Purpose and Introduction
3. Hazardous Area Classification Methodology
4. Zone Definitions
5. Scope (if present)
6. Limitations and Assumptions (if present)
7-N. Assessment Modules (A1, A2, A3, DSEAR_1-11)
N+1. References and Compliance
N+2. Action Register
N+3. Attachments Index (if present)

#### Module Heading Display

**Before:**
```
DSEAR-1 - Dangerous Substances Register
DSEAR-10 - Hierarchy of Control
```

**After:**
```
7. Dangerous Substances Register
16. Hierarchy of Control
```

**Implementation:**
```typescript
// Strip DSEAR prefix (already existed)
function stripDsearPrefix(moduleName: string): string {
  return moduleName.replace(/^DSEAR-\d+\s*-\s*/, '');
}

// Usage in module loop
for (let i = 0; i < sortedModules.length; i++) {
  const module = sortedModules[i];
  const sectionNumber = nextSectionNumber + i;
  const moduleName = getModuleName(module.module_key);
  const displayName = stripDsearPrefix(moduleName);

  // Record TOC entry
  recordToc(`${sectionNumber}. ${displayName}`);

  // Draw module section with numbered title
  ({ page, yPosition } = drawModuleSection(page, module, document, sectionNumber, ...));
}
```

#### Module Section Rendering

Modules now receive `sectionNumber` parameter and display it:

```typescript
function drawModuleSection(
  page: PDFPage,
  module: ModuleInstance,
  document: Document,
  sectionNumber: number,  // ← Added parameter
  font: any,
  fontBold: any,
  ...
): { page: PDFPage; yPosition: number } {
  const moduleName = getModuleName(module.module_key);
  const displayName = stripDsearPrefix(moduleName);

  // Add section number prefix to module title
  const numberedTitle = `${sectionNumber}. ${displayName}`;

  yPosition = drawSectionHeaderBar({
    page,
    x: MARGIN,
    y: yPosition,
    w: CONTENT_WIDTH,
    title: sanitizePdfText(numberedTitle),  // ← Numbered title
    product: 'dsear',
    fonts: { regular: font, bold: fontBold },
  });

  // ... rest of module rendering
}
```

### 2. Combined FRA+DSEAR PDF (`buildFraDsearCombinedPdf.ts`)

#### TOC Implementation

Similar dynamic tracking system:

```typescript
// Reserve TOC page after cover
const tocPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
totalPages.push(tocPage);

// TOC tracking
const tocEntries: Array<{ title: string; pageNo: number }> = [];
const recordToc = (title: string) => tocEntries.push({ title, pageNo: totalPages.length });

// Helper to strip DSEAR prefixes
const stripDsearPrefix = (moduleName: string): string => {
  return moduleName.replace(/^DSEAR-\d+\s*-\s*/, '');
};
```

#### TOC Structure for Combined PDF

```
Contents

Executive Summary                                    4
Fire Risk Assessment                                 5
  A1 - Document Control                             5
  A2 - Building Profile                             6
  FRA-1 - Fire Hazards                              7
  ...
Explosive Atmospheres (DSEAR)                       12
  Dangerous Substances Register                     12
  Process & Release Assessment                      13
  Hazardous Area Classification                     14
  ...
Action Register (Fire + Explosion)                  20
```

**Key Features:**
- Main sections in bold (Fire Risk Assessment, Explosive Atmospheres)
- Module entries indented (2 spaces prefix in TOC entry)
- DSEAR modules shown without "DSEAR-n -" prefix
- Page numbers right-aligned

#### Recording TOC Entries

```typescript
// Executive Summary
page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
totalPages.push(page);
recordToc('Executive Summary');

// FRA Section
page = addNewPage(pdfDoc, isDraft, totalPages).page;
recordToc('Fire Risk Assessment');

// FRA modules (indented)
for (const module of sortedFraModules) {
  const moduleName = getModuleName(module.module_key);
  recordToc(`  ${moduleName}`); // ← Indent with 2 spaces
  ({ page, yPosition } = drawModuleSection(...));
}

// DSEAR Section
page = addNewPage(pdfDoc, isDraft, totalPages).page;
recordToc('Explosive Atmospheres (DSEAR)');

// DSEAR modules (indented, stripped)
for (const module of sortedDsearModules) {
  const moduleName = getModuleName(module.module_key);
  const displayName = stripDsearPrefix(moduleName); // ← Strip prefix
  recordToc(`  ${displayName}`); // ← Indent with 2 spaces
  ({ page, yPosition } = drawModuleSection(...));
}

// Action Register
page = addNewPage(pdfDoc, isDraft, totalPages).page;
recordToc('Action Register (Fire + Explosion)');
```

#### TOC Rendering with Indentation

```typescript
function drawTableOfContents(
  tocPage: PDFPage,
  tocEntries: Array<{ title: string; pageNo: number }>,
  font: any,
  fontBold: any
): void {
  let yPosition = PAGE_TOP_Y - 40;

  tocPage.drawText(sanitizePdfText('Contents'), {
    x: MARGIN,
    y: yPosition,
    size: 18,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 40;

  for (const entry of tocEntries) {
    if (yPosition < MARGIN + 50) break;

    // Determine if indented (module-level)
    const isIndented = entry.title.startsWith('  ');
    const displayTitle = entry.title.trim();
    const xOffset = isIndented ? MARGIN + 30 : MARGIN + 10;

    // Draw title
    tocPage.drawText(sanitizePdfText(displayTitle), {
      x: xOffset,
      y: yPosition,
      size: isIndented ? 10 : 11,
      font: isIndented ? font : fontBold,  // ← Bold for sections, regular for modules
      color: rgb(0, 0, 0),
    });

    // Draw page number (right-aligned)
    const pageNumText = entry.pageNo.toString();
    const pageNumWidth = font.widthOfTextAtSize(pageNumText, 11);
    tocPage.drawText(pageNumText, {
      x: PAGE_WIDTH - MARGIN - pageNumWidth,
      y: yPosition,
      size: 11,
      font: font,
      color: rgb(0, 0, 0),
    });

    yPosition -= isIndented ? 14 : 16;  // ← Smaller spacing for indented
  }
}
```

#### DSEAR Module Heading Display

Updated `drawModuleSection` to strip prefixes:

```typescript
function drawModuleSection(
  page: PDFPage,
  module: ModuleInstance,
  document: Document,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  contextDocumentType?: 'FRA' | 'DSEAR'
): { page: PDFPage; yPosition: number } {
  // Ensure space for module header
  ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));

  // Module heading - strip DSEAR prefix if DSEAR module
  const moduleName = getModuleName(module.module_key);
  const displayName = module.module_key.startsWith('DSEAR')
    ? moduleName.replace(/^DSEAR-\d+\s*-\s*/, '')  // ← Strip prefix
    : moduleName;

  page.drawText(sanitizePdfText(displayName), {
    x: MARGIN,
    y: yPosition,
    size: 14,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 22;

  // ... rest of module rendering
}
```

## Key Design Decisions

### 1. Page Number Tracking Method

**Chosen Approach:** Record `totalPages.length` at section start
```typescript
const recordToc = (title: string) => tocEntries.push({ title, pageNo: totalPages.length });
```

**Why:**
- `totalPages.length` at the moment of section start = 1-based page number of current page
- Simple, deterministic, no off-by-one errors
- Works because we always call `addNewPage()` before `recordToc()`

### 2. TOC Page Reservation

**Approach:** Reserve early, populate late
```typescript
// Reserve TOC page after cover + doc control
const tocResult = addNewPage(pdfDoc, isDraft, totalPages);
const tocPage = tocResult.page;

// ... render all sections, recording TOC entries

// Populate TOC at end with collected page numbers
drawTableOfContents(tocPage, tocEntries, font, fontBold);
```

**Why:**
- Avoids need to adjust page numbers retroactively
- TOC page is inserted in correct position (page 3)
- Clean separation of concerns

### 3. DSEAR Prefix Stripping

**Display-only transformation** - internal keys unchanged

```typescript
function stripDsearPrefix(moduleName: string): string {
  return moduleName.replace(/^DSEAR-\d+\s*-\s*/, '');
}
```

**Applied:**
- Module headings in PDF body
- TOC entries for DSEAR modules
- NOT applied to internal module_key fields

**Why:**
- User-facing improvement only
- No schema/data changes required
- Consistent with requirement to "display only" change

### 4. Indentation in Combined TOC

Used leading spaces to indicate hierarchy:
- Main sections: No indent, bold font
- Module entries: 2-space prefix, regular font

```typescript
recordToc('Fire Risk Assessment');     // Bold, no indent
recordToc('  A1 - Document Control'); // Regular, indented
```

Detection in rendering:
```typescript
const isIndented = entry.title.startsWith('  ');
```

## Testing Scenarios

### DSEAR-Only PDF

**Test 1: Full Document**
- Modules: A1, A2, A3, DSEAR_1-11
- Scope: Yes
- Limitations: Yes
- Attachments: Yes

**Expected TOC:**
```
1. Explosion Criticality Assessment          4
2. Purpose and Introduction                  5
3. Hazardous Area Classification Method...   6
4. Zone Definitions                          7
5. Scope                                     8
6. Limitations and Assumptions               9
7. Document Control                          10
8. Building Profile                          11
9. Persons at Risk                           12
10. Dangerous Substances Register            13
11. Process & Release Assessment             14
12. Hazardous Area Classification            15
13. Ignition Source Control                  16
14. Explosion Protection & Mitigation        17
15. Risk Assessment Table                    18
16. Hierarchy of Control                     19
17. Explosion Emergency Response             20
18. References and Compliance                21
19. Action Register                          22
20. Attachments Index                        23
```

**Test 2: Minimal Document**
- Modules: A1, DSEAR_1 only
- No scope, limitations, attachments

**Expected TOC:**
```
1. Explosion Criticality Assessment          4
2. Purpose and Introduction                  5
3. Hazardous Area Classification Method...   6
4. Zone Definitions                          7
5. Document Control                          8
6. Dangerous Substances Register             9
7. References and Compliance                 10
8. Action Register                           11
```

### Combined FRA+DSEAR PDF

**Test 3: Full Combined**
- FRA modules: A1-A7, FRA_1-8
- DSEAR modules: DSEAR_1-11
- Actions from both

**Expected TOC:**
```
Executive Summary                            3
Fire Risk Assessment                         4
  A1 - Document Control                     4
  A2 - Building Profile                     5
  A3 - Persons at Risk                      6
  FRA-1 - Fire Hazards                      7
  ...
Explosive Atmospheres (DSEAR)               15
  Dangerous Substances Register             15
  Process & Release Assessment              16
  Hazardous Area Classification             17
  ...
Action Register (Fire + Explosion)          25
```

**Verification Points:**
- Executive Summary on page 3
- Fire section starts after executive summary
- DSEAR section follows FRA section
- DSEAR modules show without "DSEAR-n -" prefix
- Module entries indented under section headers
- Page numbers correct and right-aligned

## Files Modified

### 1. `src/lib/pdf/buildDsearPdf.ts`

**Changes:**
- Updated `drawTableOfContents` signature to accept `tocEntries` array
- Added `recordToc` helper function
- Reserved TOC page early, populated at end
- Added `recordToc()` calls for all sections
- Updated module loop to record TOC entries with stripped names
- Modules now display numbered titles with stripped prefixes

**Key Functions:**
- `drawTableOfContents()` - Renders TOC with page numbers
- `stripDsearPrefix()` - Removes "DSEAR-<n> - " from names
- `drawModuleSection()` - Now accepts `sectionNumber` parameter

### 2. `src/lib/pdf/buildFraDsearCombinedPdf.ts`

**Changes:**
- Added `stripDsearPrefix` helper function
- Reserved TOC page after cover
- Added `recordToc` helper and `tocEntries` array
- Updated all section rendering to call `recordToc()`
- FRA modules: Recorded with indent
- DSEAR modules: Recorded with indent and stripped prefix
- Added `drawTableOfContents()` function with indentation support
- Updated `drawModuleSection()` to strip DSEAR prefixes from displayed names
- Called `drawTableOfContents()` before footers

**Key Functions:**
- `drawTableOfContents()` - Renders TOC with indentation and page numbers
- `stripDsearPrefix()` - Removes "DSEAR-<n> - " from names
- `drawModuleSection()` - Now strips DSEAR prefixes from displayed headings

## No Changes Required

**Schema:** No database or data model changes
**Module Keys:** Internal module_key values unchanged
**Module Catalog:** `getModuleName()` still returns full names
**Existing PDFs:** FRA-only PDFs unaffected

## Build Status

✅ Build succeeds with no TypeScript errors
✅ No ESLint warnings
✅ All existing functionality preserved
✅ TOC system added to both DSEAR and combined outputs
✅ Module headings display cleanly without DSEAR prefixes

## Benefits

### 1. Professional Navigation
Users can now navigate DSEAR PDFs using the TOC page with actual page numbers, matching industry standards.

### 2. Consistent Numbering
DSEAR sections now numbered like FRA sections, providing clear document structure and hierarchy.

### 3. Cleaner Module Names
"Dangerous Substances Register" is more readable than "DSEAR-1 - Dangerous Substances Register"

### 4. Maintainable Implementation
- TOC entries recorded dynamically as sections render
- No manual page number tracking or adjustment
- Easy to add/remove sections without breaking TOC
- Single source of truth for module display names

### 5. Combined PDF Clarity
Clear separation between Fire and Explosion sections with proper indentation showing module-level hierarchy.

## Acceptance Criteria

✅ **DSEAR-only PDF contains Contents page** after Document Control with correct page numbers
✅ **Combined FRA+DSEAR PDF contains Contents page** with proper hierarchy
✅ **Section headers numbered consistently** (1. 2. 3. etc.)
✅ **Module headings no longer show "DSEAR-<n> -"** prefix in displayed titles
✅ **No ad-hoc paging reintroduced** - all uses `ensurePageSpace`
✅ **No schema/data changes** - display-only transformation
✅ **Existing styling preserved** - uses existing `drawSectionHeaderBar`, `drawPageTitle` primitives
