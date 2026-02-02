# Fire Protection Default Grade to 1 - Implementation Complete

## Problem Statement
Fire Protection section grade was defaulting to 3 (Adequate) on new RE documents, allowing the overall score to appear artificially better if Fire Protection was not properly assessed. This is dangerous because Fire Protection is a critical safety element that should be marked as inadequate until proven otherwise.

## Solution Implemented

### 1. Document Creation Defaults
**File:** `src/utils/documentCreation.ts`

Modified the `createDocument` function to initialize `section_grades` for RE documents with `fire_protection: 1`.

**Changes:**
```typescript
// Initialize section grades for RE documents with fire_protection defaulting to 1
const sectionGrades = documentType === 'RE' ? {
  survey_info: 3,
  property_details: 3,
  construction: 3,
  occupancy: 3,
  management: 3,
  fire_protection: 1,  // CRITICAL DEFAULT: Fire Protection starts at 1 (Inadequate)
  business_continuity: 3,
  loss_expectancy: 3,
  hazards: 3,
  natural_hazards: 3,
  recommendations: 3,
  attachments: 3
} : {};

const documentData = {
  organisation_id: organisationId,
  document_type: documentType,
  title: documentTitle,
  status: 'draft',
  version: 1,
  assessment_date: assessmentDate,
  jurisdiction,
  section_grades: sectionGrades,  // Added to insert payload
};
```

**What This Does:**
- When a new RE document is created, it immediately gets a `section_grades` JSONB object
- `fire_protection` is explicitly set to `1` (Inadequate/High risk)
- All other sections default to `3` (Adequate/tolerable)
- This data is stored in the database, not just as a UI fallback
- Non-RE documents (FRA, FSD, DSEAR) get an empty object `{}`

### 2. UI Display Without Fallback
**File:** `src/components/modules/forms/RE06FireProtectionForm.tsx`

Removed the `> 0` condition that could potentially cause issues with loading grade 1.

**Before:**
```typescript
const grade = doc?.section_grades?.fire_protection;
if (grade !== undefined && grade > 0) {
  setSectionGrade(grade);
}
```

**After:**
```typescript
const grade = doc?.section_grades?.fire_protection;
if (grade !== undefined) {
  setSectionGrade(grade);
}
```

**Why This Matters:**
- The UI now displays the exact stored value from the database
- No `|| 3` fallback in the component
- Grade 1 is loaded and displayed immediately
- If the value is undefined (shouldn't happen with new defaults), it uses the component's initial state of 3, but the stored value takes precedence

## Data Flow Verification

### New RE Document Creation:
1. User clicks "Create New RE Document"
2. `createDocument()` is called with `documentType: 'RE'`
3. Function creates `section_grades` object with `fire_protection: 1`
4. Document inserted into database: `documents.section_grades = { fire_protection: 1, ... }`
5. User opens document in workspace
6. `OverallGradeWidget` loads and displays overall grade
7. Overall grade calculation includes the default `fire_protection: 1`
8. Widget shows grade around 2.5 (avg of mostly 3s with one 1), with "High" risk band
9. User navigates to RE06 Fire Protection module
10. `RE06FireProtectionForm` loads, fetches `section_grades.fire_protection = 1`
11. SectionGrade slider displays 1 (red, "High risk / poor quality")

### Overall Grade Calculation:
With the new defaults on a fresh RE document:
- Construction: 3
- Occupancy: 3
- Management: 3
- Fire Protection: **1**  ← The critical default
- Business Continuity: 3
- Loss Expectancy: 3
- Hazards: 3
- Natural Hazards: 3
- Recommendations: 3
- Attachments: 3
- Survey Info: 3
- Property Details: 3

**Average: (11 × 3 + 1 × 1) / 12 = 34 / 12 = 2.83**
**Risk Band: "High" (2.0-2.9 range)**

This immediately signals to users that the document needs attention, specifically in Fire Protection.

## Visual Indicators

### SectionGrade Component (Fire Protection = 1):
- **Slider Position:** Far left (1/5)
- **Color:** Red (`text-red-700`)
- **Label:** "High risk / poor quality"
- **Background:** Red tinted (`bg-red-50`, `border-red-200`)

### OverallGradeWidget:
- **Grade Display:** 2.8 (red background)
- **Risk Band:** "High" (orange/red background)
- **Section Breakdown:** Shows all sections with their grades
- **Fire Protection badge:** `fire protection: 1` in red

## Key Design Decisions

### 1. Why default to 1 instead of 3?
Fire Protection is a critical safety system. Defaulting to 1 (Inadequate) ensures:
- Conservative approach to safety
- Immediate visibility of missing assessment
- Prevents false sense of security
- Forces explicit upgrade after proper assessment
- Aligns with fail-safe design principles

### 2. Why store in database instead of UI fallback?
- **Persistence:** Survives page reloads and sessions
- **Reporting:** Can be queried for analytics
- **Consistency:** Same value across all views
- **Auditability:** Track when grade was changed from default
- **Real-time updates:** OverallGradeWidget sees actual stored value

### 3. Why only Fire Protection?
Fire Protection systems (sprinklers, detection, alarms) are:
- Most expensive to retrofit
- Critical to life safety
- Often missing or inadequate in older buildings
- Require specialized assessment
- Directly impact insurance premiums
- Subject to regulatory compliance

Other sections (Construction, Management) can be reasonably observed and graded during initial walkthrough. Fire Protection requires detailed technical assessment of systems that may not be present or functional.

## Testing Verification

### Test 1: Create New RE Document
1. Navigate to New Assessment page
2. Select "Risk Engineering" document type
3. Enter title and create
4. Verify document is created successfully
5. Navigate to DocumentWorkspace
6. Check OverallGradeWidget displays grade ~2.8 with "High" band
7. Click on Fire Protection module
8. Verify SectionGrade slider shows 1 (red, leftmost position)

### Test 2: Change Fire Protection Grade
1. In Fire Protection module, move slider from 1 to 5
2. Verify OverallGradeWidget updates in real-time
3. Overall grade should increase to ~3.16
4. Risk band should change from "High" to "Medium"
5. Reload page
6. Verify grade persists at 5

### Test 3: Multiple Sections
1. Grade other sections (Construction, Management, etc.)
2. Verify each contributes to overall grade
3. Verify Fire Protection's grade of 1 pulls down the average appropriately

### Test 4: Legacy Documents
1. Open an existing RE document created before this change
2. Verify it still works (no crashes)
3. Verify section grades are loaded from existing data
4. If no section_grades exist, widget should handle gracefully

## Database State

### New RE Document in `documents` table:
```json
{
  "id": "uuid-here",
  "organisation_id": "org-uuid",
  "document_type": "RE",
  "title": "New RE Assessment",
  "status": "draft",
  "version": 1,
  "assessment_date": "2026-02-02",
  "jurisdiction": "UK",
  "section_grades": {
    "survey_info": 3,
    "property_details": 3,
    "construction": 3,
    "occupancy": 3,
    "management": 3,
    "fire_protection": 1,     ← CRITICAL DEFAULT
    "business_continuity": 3,
    "loss_expectancy": 3,
    "hazards": 3,
    "natural_hazards": 3,
    "recommendations": 3,
    "attachments": 3
  },
  "created_at": "2026-02-02T12:00:00Z",
  "updated_at": "2026-02-02T12:00:00Z"
}
```

## Files Modified
1. `src/utils/documentCreation.ts` - Added section_grades initialization for RE documents
2. `src/components/modules/forms/RE06FireProtectionForm.tsx` - Removed `> 0` condition for grade loading

## Build Status
✅ **Build successful** (16.49s)
✅ No TypeScript errors
✅ 1,895 modules transformed
✅ All imports resolved

## Impact Summary

### User Experience:
- **Before:** New RE documents looked artificially good (all 3s = overall 3.0 "Medium")
- **After:** New RE documents immediately show "High" risk band, drawing attention to Fire Protection

### Safety:
- **Before:** Easy to miss Fire Protection assessment
- **After:** Impossible to miss - red grade 1 in widget and form

### Workflow:
- **Before:** Users might skip Fire Protection thinking it's already "adequate"
- **After:** Users must explicitly upgrade from 1 to acknowledge proper assessment

### Reporting:
- **Before:** No way to distinguish unassessed from adequate Fire Protection
- **After:** Grade 1 clearly indicates "not yet assessed" or "inadequate"

## Rollout Notes

### Existing Documents:
- Not affected by this change
- Their section_grades remain as-is
- If they have no section_grades, they'll continue to work (widgets handle empty state)

### New Documents:
- All new RE documents created after this deployment will have fire_protection: 1
- Immediate effect on overall grade calculations
- No migration needed (column already exists)

### Training:
Users should be informed that:
1. New RE documents start with Fire Protection at grade 1 (red)
2. This is intentional and represents "not yet assessed" or "inadequate"
3. They must explicitly move the slider to 3, 4, or 5 after proper assessment
4. The overall property grade will reflect this conservative default
5. Grade 1 will generate automatic recommendations for improvement

## Future Enhancements

1. **Audit Trail:** Track when fire_protection grade changes from 1 to higher values
2. **Required Assessment Flag:** Prevent document issuance if fire_protection is still 1
3. **Automatic Notes:** Pre-populate assessor notes when upgrading from 1
4. **Historical Analysis:** Report on documents that had fire_protection at 1 for extended periods
5. **Other Critical Defaults:** Consider applying similar logic to Construction or Management
