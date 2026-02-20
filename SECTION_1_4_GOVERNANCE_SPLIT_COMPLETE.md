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
- ✅ Wraps long text properly
- ✅ Uses consistent fact list layout (label: value)
- ✅ Includes introductory paragraph about regulatory framework
- ✅ Uses ensureCursor for safety

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

## Status
✅ Section 4 wiring fixed (moduleKeys set)
✅ Force-render protection added
✅ Section 1 slimmed to identification facts only
✅ Section 4 custom renderer implemented (governance only)
✅ De-duplication complete
✅ Safety guards added (ensureCursor)
✅ Text wrapping for long fields
✅ Diagnostic logging in place
✅ Build successful
