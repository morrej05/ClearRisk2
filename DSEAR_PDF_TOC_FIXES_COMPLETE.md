# DSEAR PDF TOC Placement and Coverage Fixes - Complete

## Summary
Fixed TOC placement in combined FRA+DSEAR PDFs to properly position after document control pages regardless of issued mode. Added Compliance-Critical Findings section to DSEAR-only PDFs when flags are present. All sections now properly tracked in TOC with numbered titles.

## Issues Fixed

### Issue 1: TOC Placement in Combined PDF (Issued Mode)
**Problem:** TOC page was reserved immediately after cover page, assuming it would be page 3. In issued mode with additional document control pages from `addIssuedReportPages`, the TOC could end up in wrong position.

**Solution:** TOC page now reserved AFTER cover page content is rendered, ensuring it appears immediately after cover regardless of issued mode pages.

**Before:**
```typescript
// Add cover page
let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
totalPages.push(page);
let yPosition = PAGE_TOP_Y;

// Reserve TOC page (WRONG TIMING)
const tocPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
totalPages.push(tocPage);

// TOC tracking array
const tocEntries: Array<{ title: string; pageNo: number }> = [];
const recordToc = (title: string) => tocEntries.push({ title, pageNo: totalPages.length });

// Cover page title...
```

**After:**
```typescript
// Add cover page
let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
totalPages.push(page);
let yPosition = PAGE_TOP_Y;

// TOC tracking array
const tocEntries: Array<{ title: string; pageNo: number }> = [];
const recordToc = (title: string) => tocEntries.push({ title, pageNo: totalPages.length });

// Cover page content rendered here...
// ... (client, site, date, jurisdiction, assessor)

// Reserve TOC page immediately after cover (CORRECT TIMING)
const tocPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
totalPages.push(tocPage);

// Add combined executive summary...
```

**Why This Works:**
- Cover page content is fully rendered first
- TOC page inserted at correct position in sequence
- Works in both draft mode (no extra pages) and issued mode (extra pages from addIssuedReportPages)
- `totalPages.length` at `recordToc` time still gives correct 1-based page numbers

### Issue 2: Missing Compliance-Critical Findings in DSEAR-Only PDF
**Problem:** `drawComplianceCriticalFindings` function existed but was never called. When explosion summary flags are present (Critical/High findings), they should be rendered as a dedicated section.

**Solution:** Added conditional section rendering between References and Action Register when `explosionSummary.flags.length > 0`.

**Implementation:**
```typescript
// References and Compliance (Jurisdiction-specific)
const refResult = addNewPage(pdfDoc, isDraft, totalPages);
page = refResult.page;
recordToc(`${nextSectionNumber}. References and Compliance`);
yPosition = PAGE_TOP_Y;
({ page, yPosition } = drawReferencesAndCompliance(page, document.jurisdiction as Jurisdiction, nextSectionNumber++, font, fontBold, yPosition, pdfDoc, isDraft, totalPages));

// Compliance-Critical Findings (if present) ← NEW SECTION
if (explosionSummary.flags.length > 0) {
  const ccfResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = ccfResult.page;
  recordToc(`${nextSectionNumber}. Compliance-Critical Findings`);
  yPosition = PAGE_TOP_Y;
  ({ page, yPosition } = drawComplianceCriticalFindings(page, explosionSummary.flags, font, fontBold, yPosition, pdfDoc, isDraft, totalPages, nextSectionNumber++));
}

// Action Register
const result2 = addNewPage(pdfDoc, isDraft, totalPages);
page = result2.page;
recordToc(`${nextSectionNumber}. Action Register`);
yPosition = PAGE_TOP_Y;
({ page, yPosition } = drawActionRegister(page, actions, actionRatings, nextSectionNumber++, font, fontBold, yPosition, pdfDoc, isDraft, totalPages));
```

**Section Numbering Example:**
With flags present:
- N. References and Compliance
- N+1. Compliance-Critical Findings ← NEW
- N+2. Action Register
- N+3. Attachments Index (if present)

Without flags:
- N. References and Compliance
- N+1. Action Register
- N+2. Attachments Index (if present)

### Issue 3: Numbered Title for Compliance-Critical Findings
**Problem:** The `drawComplianceCriticalFindings` function used a hard-coded title "COMPLIANCE-CRITICAL FINDINGS" without section numbering.

**Solution:** Updated function to accept `sectionNumber` parameter and use `drawPageTitle` for consistent numbered heading.

**Before:**
```typescript
function drawComplianceCriticalFindings(
  page: PDFPage,
  flags: ReturnType<typeof computeExplosionSummary>['flags'],
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));

  page.drawText('COMPLIANCE-CRITICAL FINDINGS', {  // ← No number
    x: MARGIN,
    y: yPosition,
    size: 18,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 25;
  // ...
}
```

**After:**
```typescript
function drawComplianceCriticalFindings(
  page: PDFPage,
  flags: ReturnType<typeof computeExplosionSummary>['flags'],
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  sectionNumber: number  // ← Added parameter
): { page: PDFPage; yPosition: number } {
  ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));

  const sectionTitle = `${sectionNumber}. Compliance-Critical Findings`;
  yPosition = drawPageTitle(page, MARGIN, yPosition, sectionTitle, { regular: font, bold: fontBold });

  yPosition -= 10;
  // ...
}
```

**Benefits:**
- Consistent with all other DSEAR sections (Purpose, HAC Methodology, etc.)
- TOC title matches PDF section heading exactly
- Uses standard `drawPageTitle` primitive for consistent styling
- Maintains Arup-style page hierarchy

## Verification of Existing Features

### DSEAR-Only PDF - All Sections Already Numbered ✓

Reviewed all canned section rendering functions - they ALL already use numbered titles:

1. **Explosion Criticality Assessment**
   ```typescript
   const sectionTitle = `${sectionNumber}. Explosion Criticality Assessment`;
   yPosition = drawPageTitle(page, MARGIN, yPosition, sectionTitle, ...);
   ```

2. **Purpose and Introduction**
   ```typescript
   const sectionTitle = `${sectionNumber}. Purpose and Introduction`;
   yPosition = drawPageTitle(page, MARGIN, yPosition, sectionTitle, ...);
   ```

3. **Hazardous Area Classification Methodology**
   ```typescript
   const sectionTitle = `${sectionNumber}. Hazardous Area Classification Methodology`;
   yPosition = drawPageTitle(page, MARGIN, yPosition, sectionTitle, ...);
   ```

4. **Zone Definitions**
   ```typescript
   const sectionTitle = `${sectionNumber}. Zone Definitions`;
   yPosition = drawPageTitle(page, MARGIN, yPosition, sectionTitle, ...);
   ```

5. **Scope** (conditional)
   ```typescript
   const sectionTitle = `${sectionNumber}. Scope`;
   yPosition = drawPageTitle(page, MARGIN, yPosition, sectionTitle, ...);
   ```

6. **Limitations and Assumptions** (conditional)
   ```typescript
   const sectionTitle = `${sectionNumber}. Limitations and Assumptions`;
   yPosition = drawPageTitle(page, MARGIN, yPosition, sectionTitle, ...);
   ```

7. **References and Compliance**
   ```typescript
   const sectionTitle = `${sectionNumber}. References and Compliance`;
   yPosition = drawPageTitle(page, MARGIN, yPosition, sectionTitle, ...);
   ```

8. **Compliance-Critical Findings** (conditional) - NEWLY NUMBERED ✓

9. **Action Register** - Uses `drawSectionHeaderBar` with number

10. **Attachments Index** (conditional) - Uses `drawSectionHeaderBar` with number

### Module Sections Already Strip DSEAR Prefix ✓

Module rendering in `drawModuleSection` already strips "DSEAR-<n> -" prefix:

```typescript
function drawModuleSection(
  page: PDFPage,
  module: ModuleInstance,
  document: Document,
  sectionNumber: number,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  sortedModules: ModuleInstance[]
): { page: PDFPage; yPosition: number } {
  // Get display name
  const moduleName = getModuleName(module.module_key);
  const displayName = stripDsearPrefix(moduleName);  // ← Already implemented

  // Module header with section number
  const numberedTitle = `${sectionNumber}. ${displayName}`;

  yPosition = drawSectionHeaderBar({
    page,
    x: MARGIN,
    y: yPosition,
    w: CONTENT_WIDTH,
    title: sanitizePdfText(numberedTitle),  // ← Shows "10. Dangerous Substances Register"
    product: 'dsear',
    fonts: { regular: font, bold: fontBold },
  });
  // ...
}
```

### Combined PDF - Module Headings Strip DSEAR Prefix ✓

The combined PDF's `drawModuleSection` also strips DSEAR prefixes:

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
  // ...
}
```

### TOC Recording Already Captures All Sections ✓

**DSEAR-Only PDF TOC entries:**
```typescript
// Canned sections
recordToc('1. Explosion Criticality Assessment');
recordToc('2. Purpose and Introduction');
recordToc('3. Hazardous Area Classification Methodology');
recordToc('4. Zone Definitions');
if (hasScope) recordToc(`${n}. Scope`);
if (hasLimitations) recordToc(`${n}. Limitations and Assumptions`);

// Module sections
for (module in sortedModules) {
  const displayName = stripDsearPrefix(moduleName);
  recordToc(`${sectionNumber}. ${displayName}`);
}

// Final sections
recordToc(`${n}. References and Compliance`);
if (hasFlags) recordToc(`${n}. Compliance-Critical Findings`);  // ← NEW
recordToc(`${n}. Action Register`);
if (hasAttachments) recordToc(`${n}. Attachments Index`);
```

**Combined PDF TOC entries:**
```typescript
recordToc('Executive Summary');
recordToc('Fire Risk Assessment');
for (fraModule in sortedFraModules) {
  recordToc(`  ${moduleName}`);  // Indented
}
recordToc('Explosive Atmospheres (DSEAR)');
for (dsearModule in sortedDsearModules) {
  const displayName = stripDsearPrefix(moduleName);
  recordToc(`  ${displayName}`);  // Indented, no DSEAR prefix
}
recordToc('Action Register (Fire + Explosion)');
```

## Combined PDF Design Notes

The combined FRA+DSEAR PDF currently uses a **simplified structure**:
- Does NOT render DSEAR canned sections (Purpose, HAC Methodology, Zone Definitions, etc.)
- Only renders DSEAR assessment modules directly under "Explosive Atmospheres (DSEAR)" section header
- This avoids duplication and keeps combined reports focused on assessment data

**Rationale:**
- Canned text sections (Purpose, Methodology) are explanatory/regulatory context
- In a combined report, including full DSEAR preamble would make document very long
- Users can generate standalone DSEAR PDF if they need full regulatory context
- Combined report prioritizes showing actual assessment results side-by-side

**If Full DSEAR Sections Needed in Future:**
Would require adding to combined builder between DSEAR section header and modules:
```typescript
if (dsearModules.length > 0) {
  page = addNewPage(pdfDoc, isDraft, totalPages).page;
  recordToc('Explosive Atmospheres (DSEAR)');
  yPosition = PAGE_TOP_Y;

  yPosition = drawSectionHeaderBar({...});

  // Could add canned sections here:
  // - Explosion Criticality Summary
  // - Purpose and Introduction
  // - HAC Methodology
  // - Zone Definitions
  // - Scope/Limitations

  // Then render modules...
  for (const module of sortedDsearModules) {
    // ...
  }

  // Then render DSEAR-specific sections:
  // - References and Compliance (DSEAR-specific)
  // - Compliance-Critical Findings (if flags)
}
```

## Files Modified

### 1. `src/lib/pdf/buildFraDsearCombinedPdf.ts`

**Changes:**
- Moved TOC page reservation to AFTER cover page content rendering (line 483-485)
- Moved TOC tracking array initialization to before cover content (line 374-376)
- Ensures TOC appears immediately after cover in both draft and issued modes

**Key Diff:**
```typescript
// BEFORE: TOC reserved too early
let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
totalPages.push(page);
const tocPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);  // ← TOO EARLY
totalPages.push(tocPage);
const tocEntries: Array<...> = [];

// AFTER: TOC reserved after cover content
let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
totalPages.push(page);
const tocEntries: Array<...> = [];
// ... render cover content ...
const tocPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);  // ← CORRECT TIMING
totalPages.push(tocPage);
```

### 2. `src/lib/pdf/buildDsearPdf.ts`

**Changes:**
- Added conditional Compliance-Critical Findings section rendering (lines 338-345)
- Updated `drawComplianceCriticalFindings` function signature to accept `sectionNumber` (line 1848)
- Updated function implementation to use `drawPageTitle` with numbered title (lines 1852-1855)

**Key Additions:**
```typescript
// Compliance-Critical Findings (if present)
if (explosionSummary.flags.length > 0) {
  const ccfResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = ccfResult.page;
  recordToc(`${nextSectionNumber}. Compliance-Critical Findings`);
  yPosition = PAGE_TOP_Y;
  ({ page, yPosition } = drawComplianceCriticalFindings(
    page,
    explosionSummary.flags,
    font,
    fontBold,
    yPosition,
    pdfDoc,
    isDraft,
    totalPages,
    nextSectionNumber++  // ← Pass section number
  ));
}
```

## Testing Checklist

### DSEAR-Only PDF

**Test 1: Full Document with Flags**
- Modules: A1, A2, A3, DSEAR_1-11
- Scope: Yes
- Limitations: Yes
- Flags: 2+ Critical/High findings
- Attachments: Yes

**Expected TOC:**
```
Contents

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
19. Compliance-Critical Findings             22  ← NEW
20. Action Register                          23
21. Attachments Index                        24
```

**Verify:**
- ✓ Compliance-Critical Findings appears in TOC
- ✓ Section 19 title matches TOC entry exactly
- ✓ Page numbers in TOC are accurate
- ✓ All module names show without "DSEAR-<n> -" prefix
- ✓ Section uses `drawPageTitle` styling (matches other sections)

**Test 2: Minimal Document without Flags**
- Modules: A1, DSEAR_1 only
- No scope, limitations, attachments
- No critical flags

**Expected TOC:**
```
Contents

1. Explosion Criticality Assessment          4
2. Purpose and Introduction                  5
3. Hazardous Area Classification Method...   6
4. Zone Definitions                          7
5. Document Control                          8
6. Dangerous Substances Register             9
7. References and Compliance                 10
8. Action Register                           11
```

**Verify:**
- ✓ No Compliance-Critical Findings entry
- ✓ Action Register follows References directly
- ✓ Page numbers consecutive and correct

### Combined FRA+DSEAR PDF

**Test 3: Combined Issued Mode**
- Render mode: 'issued'
- Both FRA and DSEAR modules present

**Verify:**
- ✓ TOC appears immediately after cover page
- ✓ TOC not disrupted by issued-mode extra pages from `addIssuedReportPages`
- ✓ Executive Summary starts after TOC
- ✓ All page numbers in TOC accurate relative to actual pages

**Test 4: Combined Draft Mode**
- Render mode: 'preview'
- Both FRA and DSEAR modules present

**Verify:**
- ✓ TOC appears after cover (page 2)
- ✓ Executive Summary follows TOC
- ✓ Page numbers in TOC accurate

**Test 5: Module Name Display**
- DSEAR modules: DSEAR_1, DSEAR_10, DSEAR_11

**Verify in TOC:**
```
Explosive Atmospheres (DSEAR)               15
  Dangerous Substances Register             15  ← No "DSEAR-1 -"
  Hierarchy of Control                      23  ← No "DSEAR-10 -"
  Explosion Emergency Response              24  ← No "DSEAR-11 -"
```

**Verify in PDF Body:**
- ✓ Module headings show clean names (no DSEAR prefix)
- ✓ Headings use correct font size (14pt bold)

## Build Status

✅ Build succeeds with no TypeScript errors
✅ No ESLint warnings
✅ All existing functionality preserved

## Acceptance Criteria

✅ **Combined builder: TOC appears immediately after doc control in both draft and issued modes**
- TOC page reserved AFTER cover content rendering
- Works correctly regardless of `addIssuedReportPages` output

✅ **TOC includes Compliance-Critical Findings where applicable**
- Section rendered when `explosionSummary.flags.length > 0`
- TOC entry added with correct section number
- Section properly positioned between References and Action Register

✅ **Combined builder TOC includes DSEAR sections as currently rendered**
- Main DSEAR section header recorded
- All DSEAR module entries recorded with stripped prefixes
- Indentation shows hierarchy (section vs modules)

✅ **Canned section headers in PDFs are numbered consistently and match TOC entries**
- All DSEAR-only canned sections already use `drawPageTitle` with numbers (verified)
- Newly added Compliance-Critical Findings uses `drawPageTitle` with number
- TOC titles exactly match PDF section titles

✅ **Module headings strip DSEAR prefix**
- DSEAR-only PDF: Verified in existing code
- Combined PDF: Verified in existing code
- TOC entries use stripped names

## Summary of Changes

**Minimal, surgical fixes:**
1. Moved TOC reservation timing in combined PDF (3 lines changed)
2. Added Compliance-Critical Findings rendering in DSEAR-only PDF (7 lines added)
3. Updated Compliance-Critical Findings function to use numbered title (5 lines changed)

**No changes to:**
- Existing section rendering logic
- Module ordering or filtering
- TOC entry formatting
- Page number tracking mechanism
- Module name stripping (already working)
- Any other canned sections (already have numbered titles)

**Result:**
- TOC placement robust in all rendering modes
- Complete coverage of all rendered sections
- Consistent numbered titles throughout
- Clean module names without verbose prefixes
