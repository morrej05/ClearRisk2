# Section 1 & 4 Governance Split - Complete

## Overview
Implemented Option A: Section 4 now handles governance content (legislation, duty holder, scope, limitations), while Section 1 provides only slim identification facts.

## Changes Applied

### 1. Fixed Section 4 Wiring
**File:** `src/lib/pdf/fraReportStructure.ts`

- ✅ Changed Section 4 `moduleKeys` from `[]` to `["A1_DOC_CONTROL"]`
- ✅ Section 4 now correctly receives A1 module data
- ✅ Prevents Section 4 from being filtered as "empty" in pre-pass

### 2. Force Section 4 to Always Render
**File:** `src/lib/pdf/buildFraPdf.ts`

Added force-render protection in pre-pass loop:
```typescript
// FORCE: Section 4 must always render (front matter governance)
if (section.id === 4) {
  continue;
}
```

Added diagnostic logging in main rendering loop:
```typescript
// DIAGNOSTIC: Check Section 4 module key matching
if (section.id === 4) {
  console.log('[FRA] section 4 expects', section.moduleKeys, 'found', sectionModules.map(m => m.module_key));
}
```

### 3. Slimmed Section 1 Content
**File:** `src/lib/pdf/fra/fraSections.ts`

**Section 1 now renders only:**
- Brief intro: "Assessment overview for reporting and identification."
- Client name
- Site name
- Address (one line)
- Assessment date
- Assessor name
- Assessor role (if present)

**Section 1 NO LONGER renders:**
- Scope description
- Standards selected
- Responsible person / duty holder
- Limitations & assumptions

These fields remain in Section 4 via `drawModuleContent` rendering all A1_DOC_CONTROL fields.

### 4. Safety Improvements
**File:** `src/lib/pdf/fra/fraSections.ts`

Added cursor safety to Section 4 renderer:
```typescript
// CRITICAL: Ensure we start with a valid PDFPage
cursor = ensureCursor(cursor, pdfDoc, isDraft, totalPages);
```

## Data Flow

### Section 1 (Assessment Details)
- **Module:** A1_DOC_CONTROL
- **Purpose:** Quick identification facts
- **Content:** Client, Site, Address, Date, Assessor (5-6 lines)

### Section 4 (Relevant Legislation & Duty Holder)
- **Module:** A1_DOC_CONTROL (full render)
- **Purpose:** Governance, scope, regulatory framework
- **Content:** All A1 fields including scope, standards, responsible person, limitations

## Benefits

1. **No Duplication:** Governance content only in Section 4, not Section 1
2. **Section 1 Slim:** Quick overview without detailed governance
3. **Section 4 Protected:** Force-render ensures it never compacts or disappears
4. **Stable Numbering:** All sections 1-14 remain in order
5. **Diagnostic Logging:** Console output shows module key matching for Section 4

## Testing Recommendations

1. Generate FRA PDF and verify:
   - Section 1 shows only client/site/date/assessor (slim)
   - Section 4 appears and shows scope, limitations, responsible person
   - No duplication between sections 1 and 4
   - Console shows: `[FRA] section 4 expects ['A1_DOC_CONTROL'] found ['A1_DOC_CONTROL']`

2. Check edge cases:
   - A1 module with minimal data
   - A1 module with full governance fields populated
   - Draft vs issued PDFs

## De-Duplication Implementation

### Custom Section 4 Renderer
**File:** `src/lib/pdf/fra/fraSections.ts`

Replaced generic `drawModuleContent` call with custom renderer that shows **ONLY** governance fields:

1. **Responsible Person** - Duty holder for fire safety
2. **Assessment Scope** - What the assessment covers
3. **Standards Referenced** - BS 9999, PAS 79, etc.
4. **Limitations & Assumptions** - Assessment constraints

The renderer:
- ✅ Skips empty fields automatically
- ✅ Wraps long text properly with correct width calculation (CONTENT_WIDTH - 150)
- ✅ Uses consistent fact list layout (label: value)
- ✅ Consistent VALUE_X = MARGIN + 150 positioning for all values
- ✅ Includes introductory paragraph about regulatory framework
- ✅ **Divider line** after intro (matches Sections 2/3 professional style)
- ✅ Tightened spacing rhythm (12pt between facts, not 14pt)
- ✅ Uses ensureCursor for safety
- ✅ Guarded intro paragraph (optional if needed in future)

### What Section 4 NO LONGER Shows
- ❌ Client name (Section 1 only)
- ❌ Site name (Section 1 only)
- ❌ Address (Section 1 only)
- ❌ Assessment date (Section 1 only)
- ❌ Assessor name/role (Section 1 only)
- ❌ Any other A1 fields unrelated to governance

## Result

**Before:** Section 1 and Section 4 both showed all A1 fields (duplication)

**After:**
- Section 1: Quick ID facts (client, site, address, date, assessor)
- Section 4: Governance only (responsible person, scope, standards, limitations)
- Zero duplication

## Polish Improvements Applied

### Phase 1: Initial Polish
1. **Divider Line** - Added professional divider after intro paragraph
   - Thickness: 0.7pt
   - Color: rgb(0.84, 0.86, 0.89) - light gray
   - Matches Sections 2/3 style
   - 18pt spacing after divider

2. **Consistent Layout**
   - `VALUE_X = MARGIN + 150` constant for all value positioning
   - Wrap width correctly calculated: `CONTENT_WIDTH - 150`
   - All values align vertically at same x-position

3. **Tightened Spacing**
   - Reduced fact spacing from 14pt to 12pt
   - Creates tighter, more professional rhythm
   - Matches other fact blocks in PDF

4. **Defensive Guards**
   - Intro paragraph guarded with `if (introPara.trim())`
   - Future-proof if intro becomes optional
   - Empty value check prevents rendering blank lines

### Phase 2: Visual Consistency with Sections 2/3

1. **Intro Text** - More authoritative and concise
   - Before: "This section outlines the regulatory framework and duty holder responsibilities applicable to this fire risk assessment."
   - After: "This section outlines the applicable regulatory framework and identifies the duty holder responsibilities relevant to this assessment."

2. **Divider Positioning** - Exact match to Sections 2/3
   - Divider now at `yPosition` directly (not offset by -6)
   - Uses `ensureSpace(16, ...)` before divider
   - 12pt spacing after divider (was 18pt)

3. **Label Typography** - Standardized across all sections
   - Font size: 10pt (was 9pt)
   - Color: rgb(0.35, 0.35, 0.35) - darker (was 0.42)
   - Font: Bold
   - Now matches Sections 2/3 exactly

4. **Field Labels** - More natural language
   - "Standards Referenced" → "Standards & Guidance"
   - More client-friendly terminology

5. **Section Spacing** - Aligned rhythm
   - End of section: 12pt (was 8pt)
   - Consistent with Sections 2/3 vertical spacing

## Design Consistency Benefits

Section 4 now feels like a natural part of the document family:
- **Typography** matches Sections 2/3 exactly (10pt bold labels, darker gray)
- **Divider style** is pixel-perfect identical (0.7pt, same color, same positioning)
- **Spacing rhythm** is harmonized (12pt throughout)
- **Label language** is more natural and client-friendly
- **Intro text** is more authoritative and professional

This creates a cohesive, professionally designed document where all sections feel deliberately crafted as a unified system.

## Status
✅ Section 4 wiring fixed (moduleKeys set)
✅ Force-render protection added
✅ Section 1 slimmed to identification facts only
✅ Section 4 custom renderer implemented (governance only)
✅ De-duplication complete
✅ Safety guards added (ensureCursor)
✅ Text wrapping with correct width calculation
✅ Professional divider line added
✅ Tightened spacing rhythm (12pt)
✅ Consistent value positioning (VALUE_X)
✅ **Label typography standardized (10pt, darker color)**
✅ **Divider positioning exact match to Sections 2/3**
✅ **Intro text refined for authority**
✅ **Field labels more natural ("Standards & Guidance")**
✅ **Section spacing aligned (12pt throughout)**
✅ Diagnostic logging in place
✅ Build successful
