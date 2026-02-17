# Jurisdiction Explicit Legal Regimes Implementation - COMPLETE

**Date:** 2026-02-17
**Status:** ✅ FULLY IMPLEMENTED AND VERIFIED

---

## Objective Achieved

Replaced generic "United Kingdom" jurisdiction with explicit legal regimes and made Section 4 legislation dynamic based on selected jurisdiction.

---

## Changes Summary

### 1. Central Jurisdiction Mapping Object ✅

**New File Created:** `/src/lib/jurisdictions.ts`

**Purpose:** Single source of truth for all jurisdiction configurations

**Key Features:**
- Explicit type definition: `'england_wales' | 'scotland' | 'northern_ireland' | 'ireland'`
- Complete configuration for each jurisdiction including:
  - Label and full name
  - Primary legislation list
  - Enforcing authority
  - Regulatory framework text
  - Responsible person duties
  - Technical references
- Legacy value normalization ('UK' → 'england_wales', 'IE' → 'ireland')
- Helper functions: `getJurisdictionConfig()`, `getJurisdictionLabel()`, `getAvailableJurisdictions()`

**Configuration Structure:**
```typescript
export const JURISDICTION_CONFIG: Record<Jurisdiction, JurisdictionConfig> = {
  england_wales: {
    code: 'england_wales',
    label: 'England & Wales',
    fullName: 'England and Wales',
    primaryLegislation: [
      'Regulatory Reform (Fire Safety) Order 2005 (FSO)',
      'Health and Safety at Work etc. Act 1974',
      'Building Regulations 2010 (Approved Document B)',
      'Housing Act 2004',
    ],
    enforcingAuthority: 'Fire and Rescue Authority',
    regulatoryFrameworkText: '...',
    responsiblePersonDuties: [...],
    references: [...],
  },
  scotland: { ... },
  northern_ireland: { ... },
  ireland: { ... },
};
```

---

### 2. Jurisdiction Selector UI Update ✅

**File Modified:** `/src/components/JurisdictionSelector.tsx`

**Changes:**
- Removed "United Kingdom" option
- Added four explicit jurisdictions:
  - England & Wales
  - Scotland
  - Northern Ireland
  - Republic of Ireland
- Updated types to use new `Jurisdiction` type
- Uses `normalizeJurisdiction()` to handle legacy values
- Dynamic options from `getAvailableJurisdictions()`

**Before:**
```tsx
<option value="UK">United Kingdom</option>
<option value="IE">Ireland</option>
```

**After:**
```tsx
{availableJurisdictions.map(j => (
  <option key={j.value} value={j.value}>
    {j.label}
  </option>
))}
// Renders:
// - England & Wales
// - Scotland
// - Northern Ireland
// - Republic of Ireland
```

---

### 3. Create Document Modal Update ✅

**File Modified:** `/src/components/documents/CreateDocumentModal.tsx`

**Changes:**
- Default jurisdiction changed from `'UK'` to `'england_wales'`
- Jurisdiction selector options updated to show all four jurisdictions
- No "United Kingdom" option visible

**Jurisdiction Dropdown:**
```tsx
<select value={formData.jurisdiction} ...>
  <option value="england_wales">England & Wales</option>
  <option value="scotland">Scotland</option>
  <option value="northern_ireland">Northern Ireland</option>
  <option value="ireland">Republic of Ireland</option>
</select>
```

---

### 4. Display Names Utility Update ✅

**File Modified:** `/src/utils/displayNames.ts`

**Changes:**
- Now imports from central `jurisdictions.ts`
- Uses `normalizeJurisdictionCore()` for all jurisdiction logic
- Updated DSEAR logic to check for 'ireland' instead of 'IE'

---

### 5. Document Creation Utility Update ✅

**File Modified:** `/src/utils/documentCreation.ts`

**Changes:**
- Default jurisdiction changed from `'UK'` to `'england_wales'`

**Before:**
```typescript
jurisdiction = 'UK',
```

**After:**
```typescript
jurisdiction = 'england_wales',
```

---

### 6. PDF Section 4 - Dynamic Legislation ✅

**File Modified:** `/src/lib/pdf/buildFraPdf.ts`

**Function Enhanced:** `drawRegulatoryFramework()`

**Changes:**
- Removed hardcoded RRFSO 2005 references
- Now pulls legislation dynamically from jurisdiction config
- Displays "Primary Legislation" section with bullet points
- Uses jurisdiction-specific regulatory framework text

**Before (Hardcoded):**
```typescript
const frameworkText = fraRegulatoryFrameworkText(jurisdiction);
// Always referenced RRFSO 2005 for 'UK'
```

**After (Dynamic):**
```typescript
const jurisdictionConfig = getJurisdictionConfig(document.jurisdiction);

// Draw primary legislation section
page.drawText('Primary Legislation', ...);
for (const legislation of jurisdictionConfig.primaryLegislation) {
  page.drawText(`• ${sanitizePdfText(legislation)}`, ...);
}

// Draw regulatory framework text
const paragraphs = jurisdictionConfig.regulatoryFrameworkText.split('\n\n');
...
```

**PDF Output Now Shows:**

**England & Wales:**
- Regulatory Reform (Fire Safety) Order 2005 (FSO)
- Health and Safety at Work etc. Act 1974
- Building Regulations 2010 (Approved Document B)
- Housing Act 2004

**Scotland:**
- Fire (Scotland) Act 2005
- Fire Safety (Scotland) Regulations 2006
- Building (Scotland) Regulations 2004
- Health and Safety at Work etc. Act 1974

**Northern Ireland:**
- Fire and Rescue Services (Northern Ireland) Order 2006
- Fire Safety Regulations (Northern Ireland) 2010
- Building Regulations (Northern Ireland) 2012
- Health and Safety at Work (Northern Ireland) Order 1978

**Republic of Ireland:**
- Fire Services Acts 1981 & 2003
- Building Control Acts 1990 & 2007
- Safety, Health and Welfare at Work Act 2005
- Building Control Regulations 1997-2018

---

### 7. PDF Responsible Person Duties - Dynamic ✅

**Function Enhanced:** `drawResponsiblePersonDuties()`

**Changes:**
- Removed hardcoded text
- Now pulls duties from jurisdiction config
- Displays as bullet point list

**Before:**
```typescript
const dutiesText = fraResponsiblePersonDutiesText(jurisdiction);
// Hardcoded text parsing
```

**After:**
```typescript
const jurisdictionConfig = getJurisdictionConfig(document.jurisdiction);

for (const duty of jurisdictionConfig.responsiblePersonDuties) {
  const dutyLines = wrapText(`• ${duty}`, CONTENT_WIDTH - 10, 11, font);
  ...
}
```

---

### 8. PDF Cover Page - Dynamic Label ✅

**Function Enhanced:** `drawCleanAuditPage1()`

**Changes:**
- Uses `getJurisdictionLabel()` instead of hardcoded mapping
- Cover page now shows correct jurisdiction label

**Before:**
```typescript
const jurisdictionDisplay = jurisdiction === 'england_wales' ? 'England & Wales' :
  jurisdiction === 'scotland' ? 'Scotland' :
  jurisdiction === 'northern_ireland' ? 'Northern Ireland' :
  jurisdiction === 'republic_of_ireland' ? 'Republic of Ireland' : 'England & Wales';
```

**After:**
```typescript
const jurisdictionDisplay = getJurisdictionLabel(document.jurisdiction);
```

---

### 9. Database Migration ✅

**Migration Applied:** `update_jurisdiction_to_explicit_legal_regimes`

**Changes:**
1. **Removed old check constraint** that only allowed 'UK' and 'IE'
2. **Migrated existing data:**
   - All 'UK' values → 'england_wales'
   - All 'IE' values → 'ireland'
   - NULL values → 'england_wales' (default)
3. **Added new check constraint** allowing:
   - 'england_wales'
   - 'scotland'
   - 'northern_ireland'
   - 'ireland'

**Migration SQL:**
```sql
-- Drop old constraint
ALTER TABLE documents
DROP CONSTRAINT IF EXISTS documents_jurisdiction_check;

-- Migrate data
UPDATE documents
SET jurisdiction = 'england_wales'
WHERE jurisdiction = 'UK' OR jurisdiction IS NULL;

UPDATE documents
SET jurisdiction = 'ireland'
WHERE jurisdiction = 'IE';

-- Add new constraint
ALTER TABLE documents
ADD CONSTRAINT documents_jurisdiction_check
CHECK (jurisdiction IN ('england_wales', 'scotland', 'northern_ireland', 'ireland'));
```

---

## Files Modified

| File | Changes | Status |
|------|---------|--------|
| `/src/lib/jurisdictions.ts` | NEW FILE - Central config | ✅ |
| `/src/components/JurisdictionSelector.tsx` | Updated to 4 jurisdictions | ✅ |
| `/src/components/documents/CreateDocumentModal.tsx` | Updated dropdown & default | ✅ |
| `/src/utils/displayNames.ts` | Uses central config | ✅ |
| `/src/utils/documentCreation.ts` | Default to 'england_wales' | ✅ |
| `/src/lib/pdf/buildFraPdf.ts` | Dynamic Section 4 & duties | ✅ |
| Database migration | Data migrated, constraint updated | ✅ |

---

## Verification Checklist

### UI Verification
- [x] Jurisdiction selector shows 4 options (no "United Kingdom")
- [x] England & Wales
- [x] Scotland
- [x] Northern Ireland
- [x] Republic of Ireland
- [x] Default selection is "England & Wales"

### PDF Cover Page Verification
- [x] Cover shows correct jurisdiction label
- [x] "England & Wales" (not "United Kingdom")
- [x] "Scotland" displays correctly
- [x] "Northern Ireland" displays correctly
- [x] "Republic of Ireland" displays correctly

### PDF Section 4 (Regulatory Framework) Verification
- [x] "Primary Legislation" heading visible
- [x] Legislation list shows jurisdiction-specific laws
- [x] England & Wales shows RRFSO 2005
- [x] Scotland shows Fire (Scotland) Act 2005
- [x] Northern Ireland shows Fire Safety Regulations (NI) 2010
- [x] Ireland shows Fire Services Acts 1981 & 2003
- [x] NO hardcoded RRFSO references for non-England jurisdictions

### PDF Responsible Person Duties Verification
- [x] Duties shown as bullet points
- [x] England & Wales references "Article 9 of the FSO"
- [x] Scotland references "Fire (Scotland) Act 2005"
- [x] Northern Ireland references "Fire Safety Regulations (NI) 2010"
- [x] Ireland references "Safety, Health and Welfare at Work Act 2005"

### Database Verification
- [x] Check constraint updated
- [x] Existing documents migrated
- [x] Can create new documents with all 4 jurisdictions
- [x] Cannot insert invalid jurisdiction values

---

## Legacy Value Handling

The system automatically normalizes legacy values:

| Legacy Input | Normalized To |
|--------------|---------------|
| `'UK'` | `'england_wales'` |
| `'IE'` | `'ireland'` |
| `'United Kingdom'` | `'england_wales'` |
| `'Ireland'` | `'ireland'` |
| `'Scotland'` | `'scotland'` |
| `'Northern Ireland'` | `'northern_ireland'` |
| `null` | `'england_wales'` (default) |

This ensures backward compatibility with any existing code or data.

---

## Technical Architecture

### Centralized Configuration
All jurisdiction data is now managed in a single location (`/src/lib/jurisdictions.ts`), preventing:
- Hardcoded legislation references scattered across files
- Inconsistent jurisdiction handling
- Duplication of regulatory text

### Dynamic PDF Generation
PDF content is now generated dynamically from the jurisdiction config, meaning:
- Section 4 legislation list is jurisdiction-specific
- Responsible person duties reference correct legislation
- No manual updates needed when legislation changes
- Easy to add new jurisdictions in future

### Type Safety
TypeScript enforces correct jurisdiction values throughout the codebase:
```typescript
type Jurisdiction = 'england_wales' | 'scotland' | 'northern_ireland' | 'ireland';
```

---

## Jurisdiction-Specific Content

### England & Wales
**Primary Legislation:**
- Regulatory Reform (Fire Safety) Order 2005 (FSO)
- Health and Safety at Work etc. Act 1974
- Building Regulations 2010 (Approved Document B)
- Housing Act 2004

**Key Reference:** Article 9 of the FSO
**Enforcing Authority:** Fire and Rescue Authority

---

### Scotland
**Primary Legislation:**
- Fire (Scotland) Act 2005
- Fire Safety (Scotland) Regulations 2006
- Building (Scotland) Regulations 2004
- Health and Safety at Work etc. Act 1974

**Key Reference:** Fire (Scotland) Act 2005
**Enforcing Authority:** Scottish Fire and Rescue Service

---

### Northern Ireland
**Primary Legislation:**
- Fire and Rescue Services (Northern Ireland) Order 2006
- Fire Safety Regulations (Northern Ireland) 2010
- Building Regulations (Northern Ireland) 2012
- Health and Safety at Work (Northern Ireland) Order 1978

**Key Reference:** Fire Safety Regulations (NI) 2010
**Enforcing Authority:** Northern Ireland Fire & Rescue Service

---

### Republic of Ireland
**Primary Legislation:**
- Fire Services Acts 1981 & 2003
- Building Control Acts 1990 & 2007
- Safety, Health and Welfare at Work Act 2005
- Building Control Regulations 1997-2018

**Key Reference:** Safety, Health and Welfare at Work Act 2005
**Enforcing Authority:** Building Control Authority / Fire Authority

---

## Build Status

```bash
✓ 1931 modules transformed
✓ built in 20.99s
```

**TypeScript Errors:** 0
**Build Status:** ✅ SUCCESS

---

## Breaking Changes

**None** - All changes are backward compatible through the normalization function.

Existing documents with 'UK' or 'IE' values:
- Are automatically migrated in the database
- Are normalized at runtime by the app
- Display correct jurisdiction-specific content in PDFs

---

## Future Enhancements

Potential future additions (not in scope for this task):
- Wales-specific legislation (if diverges from England & Wales)
- Additional jurisdictions (e.g., Crown Dependencies, Overseas Territories)
- Jurisdiction-specific report templates
- Jurisdiction-specific risk scoring models

---

## Summary

**All requirements met:**

1. ✅ Removed "United Kingdom" from jurisdiction selector
2. ✅ Added explicit legal regimes:
   - England & Wales
   - Scotland
   - Northern Ireland
   - Republic of Ireland
3. ✅ Created central jurisdiction mapping object
4. ✅ Made PDF Section 4 legislation dynamic
5. ✅ Removed ALL hardcoded RRFSO references
6. ✅ Cover page shows correct jurisdiction
7. ✅ Section 4 references correct legislation per jurisdiction
8. ✅ No "United Kingdom" wording remains anywhere

**The system now properly reflects the distinct legal regimes within the UK and Ireland, with jurisdiction-specific legislation, duties, and references throughout the application and PDF outputs.**

---

**Implementation Date:** 2026-02-17
**Build Status:** ✅ SUCCESS
**Database Migration:** ✅ APPLIED
**Breaking Changes:** None (backward compatible)
**Ready for:** Production deployment
