# UK Legal References as UK-Only Overlay - Complete

Successfully moved UK-specific legal references (DSEAR) to a jurisdiction-specific "References and Compliance" section. UK references now only appear for UK jurisdiction documents, while Ireland documents show appropriate Irish/EU references.

## Implementation Summary

### Jurisdiction References Registry ✓
**File: src/lib/reportText/references.ts** (NEW)

Created a jurisdiction-aware references system:

**Type Definitions:**
```typescript
export type Jurisdiction = 'UK' | 'IE';

export interface ReferenceItem {
  label: string;
  detail?: string;
}
```

**Function:**
```typescript
export function getExplosiveAtmospheresReferences(jurisdiction: Jurisdiction): ReferenceItem[]
```

**UK References:**
- Dangerous Substances and Explosive Atmospheres Regulations 2002 (DSEAR)
- Health and Safety at Work etc. Act 1974
- Equipment and Protective Systems Intended for Use in Potentially Explosive Atmospheres Regulations 2016
- BS EN 60079-10-1:2015 (Gas atmospheres)
- BS EN 60079-10-2:2015 (Dust atmospheres)

**Ireland References:**
- Safety, Health and Welfare at Work Act 2005
- Chemicals Act (COMAH) Regulations 2015
- European Communities (ATEX Equipment) Regulations 2016
- IS EN 60079-10-1:2015 (Gas atmospheres)
- IS EN 60079-10-2:2015 (Dust atmospheres)

**Key Features:**
- Single source of truth for legal references
- Jurisdiction-specific content
- Detailed explanations for each reference
- Extensible for future jurisdictions

### Neutralized Text ✓
**File: src/lib/reportText/explosion/hazardousAreaClassification.ts**

**OLD (UK-specific):**
```
This methodology forms a critical part of compliance with the 
Dangerous Substances and Explosive Atmospheres Regulations 2002 
(DSEAR) and associated standards including BS EN 60079-10-1...
```

**NEW (Neutral):**
```
This methodology follows internationally recognised standards 
including EN 60079-10-1 for gases and vapours, and EN 60079-10-2 
for combustible dusts.
```

**Changes:**
- Removed "DSEAR 2002" reference
- Removed "compliance with" UK-specific wording
- Changed to "internationally recognised standards"
- Changed from "BS EN" to "EN" (European standard, not British)
- Text now suitable for all jurisdictions

### PDF Builder Integration ✓
**File: src/lib/pdf/buildDsearPdf.ts**

**1. Import Added:**
```typescript
import {
  explosiveAtmospheresPurposeText,
  hazardousAreaClassificationText,
  zoneDefinitionsText,
  getExplosiveAtmospheresReferences,  // NEW
  type Jurisdiction,                   // NEW
} from '../reportText';
```

**2. New Drawing Function:**
```typescript
function drawReferencesAndCompliance(
  page: PDFPage,
  jurisdiction: Jurisdiction,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number
```

This function:
- Renders "REFERENCES AND COMPLIANCE" section heading
- Retrieves jurisdiction-specific references
- Displays each reference as a bullet point (bold)
- Shows detailed explanations (indented, smaller font)
- Handles page breaks automatically
- Returns updated Y position

**3. Section Integration:**
```typescript
// SECTION 12: References and Compliance (Jurisdiction-specific)
const refResult = addNewPage(pdfDoc, isDraft, totalPages);
page = refResult.page;
yPosition = PAGE_HEIGHT - MARGIN;
yPosition = drawReferencesAndCompliance(
  page, 
  document.jurisdiction as Jurisdiction, 
  font, 
  fontBold, 
  yPosition, 
  pdfDoc, 
  isDraft, 
  totalPages
);
```

**4. Updated Report Structure:**
```
SECTION 1:  Cover Page
SECTION 2:  Executive Summary
SECTION 3:  Purpose and Introduction (neutral)
SECTION 4:  Hazardous Area Classification (neutral)
SECTION 5:  Zone Definitions
SECTION 6:  Scope
SECTION 7:  Limitations and Assumptions
SECTION 8+: Module Sections
SECTION 12: References and Compliance (NEW - JURISDICTION-SPECIFIC)
SECTION 13: Action Register
SECTION 13.5: Attachments Index
SECTION 14: Information Gaps Appendix
```

### Export Configuration ✓
**File: src/lib/reportText/index.ts**

Added export:
```typescript
export { 
  getExplosiveAtmospheresReferences, 
  type Jurisdiction, 
  type ReferenceItem 
} from './references';
```

### Report Behavior By Jurisdiction

**UK Jurisdiction Document:**

Cover Page:
- Title: "DSEAR Risk Assessment"

Content:
- Purpose and Introduction: Neutral (no DSEAR mention)
- Hazardous Area Classification: Neutral (references "EN 60079-10-1/2")
- All other sections: Neutral

References and Compliance Section:
- Shows "Dangerous Substances and Explosive Atmospheres Regulations 2002 (DSEAR)"
- Shows "Health and Safety at Work etc. Act 1974"
- Shows UK ATEX implementation
- Shows "BS EN 60079-10-1:2015" and "BS EN 60079-10-2:2015"
- Includes detailed explanations for each reference

**Ireland Jurisdiction Document:**

Cover Page:
- Title: "Explosive Atmospheres Risk Assessment"

Content:
- Purpose and Introduction: Neutral (identical to UK)
- Hazardous Area Classification: Neutral (identical to UK)
- All other sections: Neutral

References and Compliance Section:
- Shows "Safety, Health and Welfare at Work Act 2005"
- Shows "COMAH Regulations 2015"
- Shows Irish ATEX implementation
- Shows "IS EN 60079-10-1:2015" and "IS EN 60079-10-2:2015"
- Includes detailed explanations for each reference
- NO UK references appear anywhere

### What Changed vs What Didn't

**CHANGED:**
- Removed UK-specific references from neutral text sections
- Added new References and Compliance section
- Section shows different content based on jurisdiction
- Hazardous Area Classification text now neutral
- Added jurisdiction references registry

**NOT CHANGED:**
- Assessment type/keys unchanged (still 'DSEAR' internally)
- Module keys unchanged (still use DSEAR_ prefix internally)
- Form structure unchanged
- Issuing rules unchanged
- Database schema unchanged
- Routing unchanged
- Cover page titles (already jurisdiction-aware from Step 2)
- Module names (will be addressed in Step 5)

### Text Comparison

**Hazardous Area Classification - Before:**
```
...compliance with the Dangerous Substances and Explosive 
Atmospheres Regulations 2002 (DSEAR) and associated standards 
including BS EN 60079-10-1...
```

**Hazardous Area Classification - After:**
```
...follows internationally recognised standards including 
EN 60079-10-1 for gases and vapours, and EN 60079-10-2 
for combustible dusts.
```

**Result:** No UK-specific legal references in neutral text.

### Visual PDF Output

**UK Document - References Section:**
```
REFERENCES AND COMPLIANCE

• Dangerous Substances and Explosive Atmospheres Regulations 
  2002 (DSEAR)
  Primary UK legislation governing the control of risks from 
  fire, explosion and similar events...

• Health and Safety at Work etc. Act 1974
  Primary duty of care for employers to ensure...

• Equipment and Protective Systems Intended for Use in 
  Potentially Explosive Atmospheres Regulations 2016
  UK implementation of ATEX equipment requirements...

• BS EN 60079-10-1:2015
  Classification of areas - Explosive gas atmospheres.

• BS EN 60079-10-2:2015
  Classification of areas - Explosive dust atmospheres.
```

**Ireland Document - References Section:**
```
REFERENCES AND COMPLIANCE

• Safety, Health and Welfare at Work Act 2005
  Primary Irish legislation establishing duties for employers...

• Chemicals Act (Control of Major Accident Hazards involving 
  Dangerous Substances) Regulations 2015 (COMAH)
  Irish regulations controlling major accident hazards...

• European Communities (Equipment and Protective Systems 
  Intended for Use in Potentially Explosive Atmospheres) 
  Regulations 2016
  Irish implementation of ATEX equipment requirements...

• IS EN 60079-10-1:2015
  Classification of areas - Explosive gas atmospheres.

• IS EN 60079-10-2:2015
  Classification of areas - Explosive dust atmospheres.
```

### Build Status ✓

**Build Result:** SUCCESS
- No TypeScript errors
- No compilation issues
- All imports resolved
- PDF generation updated
- New references section integrated

### Files Modified

1. **src/lib/reportText/references.ts** - NEW FILE (Registry)
2. **src/lib/reportText/index.ts** - Added exports
3. **src/lib/reportText/explosion/hazardousAreaClassification.ts** - Neutralized text
4. **src/lib/pdf/buildDsearPdf.ts** - Added References section

### Testing Verification Points

**To Verify UK Jurisdiction:**
1. Generate PDF for UK document
2. Cover: Should show "DSEAR Risk Assessment"
3. Purpose section: Should NOT mention DSEAR
4. Hazardous Area Classification: Should NOT mention DSEAR 2002
5. References section: Should show UK legal references (DSEAR, HSW Act, etc.)
6. References section: Should show "BS EN" standards

**To Verify Ireland Jurisdiction:**
1. Generate PDF for IE document
2. Cover: Should show "Explosive Atmospheres Risk Assessment"
3. Purpose section: Should be identical to UK (neutral)
4. Hazardous Area Classification: Should be identical to UK (neutral)
5. References section: Should show Irish legal references (SHW Act, COMAH, etc.)
6. References section: Should show "IS EN" standards
7. References section: Should NOT show any UK-specific references
8. No mention of "DSEAR" anywhere in the document

### Compliance Architecture

The implementation follows a clean separation pattern:

**Neutral Content:**
- Purpose and Introduction
- Hazardous Area Classification methodology
- Zone Definitions
- All technical content

**Jurisdiction-Specific Content:**
- Cover page title (from Step 2)
- References and Compliance section (NEW)

This architecture ensures:
- Technical content is consistent and professional
- Legal references are appropriate for each jurisdiction
- Easy to add new jurisdictions in the future
- Single source of truth for legal references

### Next Steps (Step 5)

Step 5 will address UI/UX wording:
1. Ensure "DSEAR" only appears in UK-context UI elements
2. Use neutral terms in shared UI
3. Update tooltips and help text
4. Ensure menu items are jurisdiction-appropriate
5. Review button labels and messages

## Summary

✅ Created jurisdiction references registry
✅ Removed UK references from neutral text
✅ Added References and Compliance section to PDF
✅ UK documents show UK legal references
✅ Ireland documents show Irish/EU references
✅ No UK references in Ireland reports
✅ Hazardous Area Classification text neutralized
✅ Build successful
✅ No structural or logic changes

UK-specific legal references (DSEAR) are now contained in a jurisdiction-specific section that only appears when appropriate. Ireland documents contain no UK legal references and show appropriate Irish/EU regulations instead. All neutral technical content is consistent across jurisdictions.
