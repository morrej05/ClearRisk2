# FRA+DSEAR Combined PDF Jurisdiction Label - COMPLETE

## Summary

Successfully added jurisdiction label to the Combined FRA+DSEAR PDF using the canonical jurisdiction adapter from `src/lib/jurisdictions.ts`.

---

## Changes Made

### File Modified: `src/lib/pdf/buildFraDsearCombinedPdf.ts`

#### Before:
```typescript
// Assessment date
page.drawText(sanitizePdfText(`Assessment Date: ${formatDate(document.assessment_date)}`), {
  x: MARGIN,
  y: yPosition,
  size: 11,
  font: font,
  color: rgb(0, 0, 0),
});
yPosition -= 20;

// Assessor
if (document.assessor_name) {
```

#### After:
```typescript
// Assessment date
page.drawText(sanitizePdfText(`Assessment Date: ${formatDate(document.assessment_date)}`), {
  x: MARGIN,
  y: yPosition,
  size: 11,
  font: font,
  color: rgb(0, 0, 0),
});
yPosition -= 20;

// Jurisdiction
const j = normalizeJurisdiction(document.jurisdiction);
const jurisdictionLabel = getJurisdictionLabel(j);
page.drawText(sanitizePdfText(`Jurisdiction: ${jurisdictionLabel}`), {
  x: MARGIN,
  y: yPosition,
  size: 11,
  font: font,
  color: rgb(0, 0, 0),
});
yPosition -= 20;

// Assessor
if (document.assessor_name) {
```

---

## Implementation Details

### Location in Document
The jurisdiction label is rendered on the **cover page** of the combined PDF, positioned between:
- **Above:** Assessment Date
- **Below:** Assessor Name

This placement follows the existing metadata layout pattern.

### Styling
- **Font Size:** 11pt (consistent with other metadata fields)
- **Font:** Standard font (same as Client, Site, Assessment Date, Assessor)
- **Color:** Black `rgb(0, 0, 0)` (consistent with primary metadata fields)
- **Spacing:** 20pt vertical spacing (consistent with other fields)
- **Format:** `"Jurisdiction: {label}"`

### Canonical Adapter Usage
```typescript
const j = normalizeJurisdiction(document.jurisdiction);
const jurisdictionLabel = getJurisdictionLabel(j);
```

**Normalization Behavior:**
- `undefined` → `'england_wales'` → `"England & Wales"`
- `null` → `'england_wales'` → `"England & Wales"`
- `'UK'` (legacy) → `'england_wales'` → `"England & Wales"`
- `'IE'` (legacy) → `'ireland'` → `"Republic of Ireland"`
- `'england_wales'` → `'england_wales'` → `"England & Wales"`
- `'scotland'` → `'scotland'` → `"Scotland"`
- `'northern_ireland'` → `'northern_ireland'` → `"Northern Ireland"`
- `'ireland'` → `'ireland'` → `"Republic of Ireland"`

---

## Import Usage Verification

### Imports Section (Line 5):
```typescript
import { normalizeJurisdiction, getJurisdictionLabel } from '../jurisdictions';
```

### Usage (Lines 372-373):
```typescript
const j = normalizeJurisdiction(document.jurisdiction);
const jurisdictionLabel = getJurisdictionLabel(j);
```

✅ **Status:** All imported functions are now actively used (no unused imports).

---

## Example Output

For a document with `jurisdiction: 'england_wales'`, the cover page will display:

```
Combined Fire + Explosion Report
Example Building Assessment

Client: ACME Corp
Site: Manufacturing Facility A
Address: 123 Industrial Estate, London, UK
Assessment Organisation: Fire Safety Consultants Ltd
Assessment Date: 01 March 2026
Jurisdiction: England & Wales          ← NEW
Assessor: John Smith
```

For a document with `jurisdiction: 'ireland'`:

```
Combined Fire + Explosion Report
Example Building Assessment

Client: ACME Corp
Site: Manufacturing Facility A
Address: 123 Industrial Estate, Dublin, Ireland
Assessment Organisation: Fire Safety Consultants Ltd
Assessment Date: 01 March 2026
Jurisdiction: Republic of Ireland      ← NEW
Assessor: John Smith
```

---

## Acceptance Criteria - ALL MET ✅

### 1. Jurisdiction Label Displayed
✅ **PASS:** Combined FRA+DSEAR PDF now shows "Jurisdiction: {label}" on cover page

### 2. Correct Label for All 4 Jurisdictions
✅ **PASS:** Uses `getJurisdictionLabel(normalizeJurisdiction(...))` which supports:
- England & Wales
- Scotland
- Northern Ireland
- Republic of Ireland

### 3. No Unused Imports
✅ **PASS:** Both `normalizeJurisdiction` and `getJurisdictionLabel` are actively used

### 4. Canonical Adapter Only
✅ **PASS:** Uses only `src/lib/jurisdictions.ts` (no new templates or text sources)

### 5. Consistent Styling
✅ **PASS:** Same font size (11pt), color (black), and spacing (20pt) as adjacent metadata

### 6. No Module/Scoring Changes
✅ **PASS:** Only cover page metadata modified, no changes to:
- Module schemas
- Captured answers
- Scoring logic
- Section content rendering

### 7. Build Success
```bash
$ npm run build
✓ built in 19.32s
```
✅ **PASS:** Clean TypeScript build with no errors

---

## Backward Compatibility

### Legacy Jurisdiction Values
All legacy values are automatically normalized:

| Input Value      | Normalized To    | Display Label            |
|------------------|------------------|--------------------------|
| `undefined`      | `'england_wales'`| "England & Wales"        |
| `null`           | `'england_wales'`| "England & Wales"        |
| `'UK'` (legacy)  | `'england_wales'`| "England & Wales"        |
| `'IE'` (legacy)  | `'ireland'`      | "Republic of Ireland"    |

### Database Documents
No migration required. The normalization happens at render time, so:
- Existing documents with `jurisdiction: null` → Display "England & Wales"
- Existing documents with `jurisdiction: 'UK'` → Display "England & Wales"
- Existing documents with `jurisdiction: 'IE'` → Display "Republic of Ireland"
- New documents with canonical values → Display correct label

---

## Consistency Across PDF Builders

The Combined FRA+DSEAR PDF now joins the other PDF builders in using the canonical jurisdiction adapter:

| PDF Builder                  | Jurisdiction Display | Uses Canonical Adapter |
|------------------------------|----------------------|------------------------|
| `buildFraPdf.ts`             | ✅ Yes (via fraCoreDraw) | ✅ Yes              |
| `buildCombinedPdf.ts`        | ✅ Yes (cover page)  | ✅ Yes                 |
| `buildFraDsearCombinedPdf.ts`| ✅ Yes (cover page)  | ✅ Yes (NEW)           |
| `buildDsearPdf.ts`           | (standalone DSEAR)   | ✅ Yes                 |
| `buildFsdPdf.ts`             | (FSD design)         | ✅ Yes                 |

All PDF builders now consistently use `src/lib/jurisdictions.ts` for jurisdiction handling.

---

## Testing Recommendations

### Manual Testing
1. **Create Combined FRA+DSEAR Document:**
   - Navigate to Documents → New Document → Combined FRA+DSEAR
   - Complete required modules (A1, FRA1, DSEAR1)
   - Generate PDF preview

2. **Verify Jurisdiction Label:**
   - Check cover page metadata section
   - Verify "Jurisdiction: England & Wales" appears (default)
   - Verify label appears between "Assessment Date" and "Assessor"

3. **Test Different Jurisdictions:**
   - Change document jurisdiction to "Scotland"
   - Regenerate PDF → Verify "Jurisdiction: Scotland"
   - Change to "Northern Ireland"
   - Regenerate PDF → Verify "Jurisdiction: Northern Ireland"
   - Change to "Republic of Ireland"
   - Regenerate PDF → Verify "Jurisdiction: Republic of Ireland"

4. **Test Legacy Values:**
   - Use browser console to set `jurisdiction: 'UK'` on document
   - Regenerate PDF → Verify displays "England & Wales"
   - Set `jurisdiction: 'IE'`
   - Regenerate PDF → Verify displays "Republic of Ireland"

### Integration Testing
- Generate combined PDFs for multiple organizations
- Verify jurisdiction label appears consistently
- Check PDF downloads work correctly
- Verify issued PDF includes jurisdiction label

---

## Files Modified Summary

### Files Changed (1 total):
1. ✅ `src/lib/pdf/buildFraDsearCombinedPdf.ts` - Added jurisdiction label to cover page metadata

### Lines Added: 9
```typescript
// Jurisdiction
const j = normalizeJurisdiction(document.jurisdiction);
const jurisdictionLabel = getJurisdictionLabel(j);
page.drawText(sanitizePdfText(`Jurisdiction: ${jurisdictionLabel}`), {
  x: MARGIN,
  y: yPosition,
  size: 11,
  font: font,
  color: rgb(0, 0, 0),
});
yPosition -= 20;
```

---

## Conclusion

The Combined FRA+DSEAR PDF now explicitly displays jurisdiction information using the canonical adapter from `src/lib/jurisdictions.ts`. This change:

✅ Makes jurisdiction visible to report readers
✅ Uses the single source of truth for jurisdiction handling
✅ Maintains consistent styling with other metadata fields
✅ Supports all 4 jurisdictions (England & Wales, Scotland, Northern Ireland, Republic of Ireland)
✅ Handles legacy values gracefully through automatic normalization
✅ Requires no database migration
✅ Introduces no breaking changes

The Combined FRA+DSEAR PDF is now fully aligned with the canonical 4-way jurisdiction model.
