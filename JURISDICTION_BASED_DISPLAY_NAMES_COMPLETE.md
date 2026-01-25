# Jurisdiction-Based Display Names - Complete

Successfully implemented jurisdiction-based display names for DSEAR/Explosive Atmospheres assessments. The system now shows "DSEAR Risk Assessment" for UK jurisdiction and "Explosive Atmospheres Risk Assessment" for Ireland (IE) jurisdiction.

## Implementation Summary

### Database Changes ✓
**Migration: add_jurisdiction_to_documents**
- Added `jurisdiction` column to `documents` table
- Type: TEXT NOT NULL
- Default: 'UK'
- Allowed values: 'UK', 'IE'
- Check constraint ensures only valid jurisdictions

### Display Name Resolver ✓
**New File: src/utils/displayNames.ts**

Created central display name resolver with:
- `type Jurisdiction = 'UK' | 'IE'`
- `getAssessmentDisplayName(assessmentType, jurisdiction)` - Full display name
- `getAssessmentShortName(assessmentType, jurisdiction)` - Short display name
- `normalizeJurisdiction(jurisdiction)` - Helper to normalize jurisdiction values

**Logic:**
```typescript
For 'DSEAR' or 'dsear':
  - UK → "DSEAR Risk Assessment"
  - IE → "Explosive Atmospheres Risk Assessment"

For other types:
  - FRA → "Fire Risk Assessment"
  - FSD → "Fire Strategy Document"
  - etc.
```

### UI Updates ✓

**1. src/pages/AssessmentsList.tsx**
- Import getAssessmentDisplayName
- Updated getTypeLabel to accept jurisdiction parameter
- Pass assessment.jurisdiction to display function
- Assessment type labels now jurisdiction-aware

**2. src/pages/NewAssessment.tsx**
- Import getAssessmentDisplayName
- Updated jurisdiction selector:
  - UK-EN → "United Kingdom"
  - IE → "Ireland"
- DSEAR option label now dynamic based on selected jurisdiction
- Save jurisdiction when creating document
- Map 'UK-EN' → 'UK', 'IE' → 'IE' for database storage

**3. src/pages/AssessmentEditor.tsx**
- Import getAssessmentDisplayName
- Updated getTypeLabel to use resolver with jurisdiction
- Assessment subtitle now jurisdiction-aware

**4. src/utils/documentCreation.ts**
- Added optional `jurisdiction` parameter to createDocument
- Defaults to 'UK' if not specified
- Saves jurisdiction to documents table

**5. src/pages/documents/DocumentOverview.tsx**
- Added jurisdiction field to Document interface
- Ready for jurisdiction display/editing (to be added if needed)

### Report Title Updates ✓

**src/lib/pdf/buildDsearPdf.ts**
- Import getAssessmentDisplayName
- Added jurisdiction to Document interface
- Updated cover page title generation:
  - Was: Hard-coded "DSEAR / Explosion Risk Assessment"
  - Now: Dynamic `getAssessmentDisplayName('DSEAR', document.jurisdiction)`
- Report title on PDF now changes based on jurisdiction:
  - UK documents: "DSEAR Risk Assessment"
  - IE documents: "Explosive Atmospheres Risk Assessment"

### What Changed vs What Didn't

**CHANGED (Display Only):**
- UI labels throughout the app
- Form dropdown labels
- PDF report titles
- Assessment list displays
- Document workspace titles
- All user-facing text

**NOT CHANGED (Internal Logic):**
- database document_type column still stores 'DSEAR'
- Assessment type enum values unchanged
- Module keys (DSEAR_1, DSEAR_2, etc.) unchanged
- Function names (buildDsearPdf) unchanged
- Routing paths unchanged
- Validation logic unchanged
- API payloads unchanged
- Query filters unchanged

### User Experience

**UK Jurisdiction (Default):**
1. User creates new assessment
2. Selects "United Kingdom" from jurisdiction dropdown
3. Assessment type shows "DSEAR Risk Assessment"
4. Document is created with jurisdiction='UK'
5. Throughout UI: displays "DSEAR Risk Assessment"
6. PDF report title: "DSEAR Risk Assessment"

**Ireland Jurisdiction:**
1. User creates new assessment
2. Selects "Ireland" from jurisdiction dropdown
3. Assessment type shows "Explosive Atmospheres Risk Assessment"
4. Document is created with jurisdiction='IE'
5. Throughout UI: displays "Explosive Atmospheres Risk Assessment"
6. PDF report title: "Explosive Atmospheres Risk Assessment"

### Backward Compatibility ✓

**Existing Documents:**
- All existing documents default to jurisdiction='UK' via database DEFAULT
- Will display as "DSEAR Risk Assessment"
- No data migration needed
- No breaking changes

**New Documents:**
- Default to jurisdiction='UK' if not specified
- Can be set to 'IE' via jurisdiction selector
- Display name adjusts automatically

### Build Status ✓

**Build Result:** SUCCESS
- No TypeScript errors
- No compilation issues
- All imports resolved
- All type checks passed

### Technical Details

**Jurisdiction Normalization:**
The resolver handles various jurisdiction formats:
- 'UK', 'UK-EN', 'UNITED KINGDOM' → 'UK'
- 'IE', 'IRELAND' → 'IE'
- null/undefined → 'UK' (default)

**Short Names Available:**
For space-constrained UI:
- UK: "DSEAR"
- IE: "Explosive Atmospheres"

### Files Modified

1. **supabase/migrations/[timestamp]_add_jurisdiction_to_documents.sql** - NEW
2. **src/utils/displayNames.ts** - NEW
3. **src/pages/AssessmentsList.tsx** - Updated to use resolver
4. **src/pages/NewAssessment.tsx** - Jurisdiction selector + dynamic labels
5. **src/pages/AssessmentEditor.tsx** - Jurisdiction-aware display
6. **src/utils/documentCreation.ts** - Accept jurisdiction parameter
7. **src/pages/documents/DocumentOverview.tsx** - Added jurisdiction to interface
8. **src/lib/pdf/buildDsearPdf.ts** - Dynamic report title

### Next Steps (Task 3/4)

The jurisdiction-based display names are complete. Next tasks:

**Task 3:** Update report intro/body text to be neutral
- Remove UK-specific references from body text
- Make methodology sections jurisdiction-neutral

**Task 4:** Move UK legal references to UK overlay
- Keep "DSEAR 2002" only in UK reports
- IE reports use neutral terminology throughout

## Summary

✅ Database jurisdiction field added to documents table
✅ Central display name resolver created
✅ All UI labels updated to use jurisdiction-aware names
✅ PDF report titles updated to use jurisdiction-aware names
✅ Jurisdiction selector added to new assessment form
✅ Build successful
✅ Backward compatible (existing docs default to UK)
✅ No internal logic changes

Users can now select UK or Ireland jurisdiction when creating assessments, and the entire system (UI + reports) will use the appropriate terminology:
- UK → "DSEAR Risk Assessment"
- Ireland → "Explosive Atmospheres Risk Assessment"

The internal system continues to use 'DSEAR' as the document_type for all queries, routing, and logic.
