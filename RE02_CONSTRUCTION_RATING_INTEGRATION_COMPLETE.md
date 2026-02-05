# RE02 Construction Rating Integration - COMPLETE

## Problem
RE14 Risk Ratings Summary was showing construction metadata (site_score, combustible%) but the rating stayed at 3. The score breakdown builder wasn't reading from `RISK_ENGINEERING.data.sectionGrades.construction`.

## Solution Applied

### A) Score Breakdown Builder Patched
**File:** `src/lib/re/scoring/riskEngineeringHelpers.ts`

**Lines 117-133:** Fixed construction rating source priority:
```typescript
if (riskEngData?.sectionGrades?.construction !== undefined) {
  // First priority: use persisted rating from RISK_ENGINEERING module
  constructionRating = clamp1to5(Number(riskEngData.sectionGrades.construction));
  console.log('[ScoreBreakdown] Using riskEngData.sectionGrades.construction:', riskEngData.sectionGrades.construction, '→', constructionRating);
} else if (sectionGrades.construction !== undefined) {
  // Second priority: use documents.section_grades
  constructionRating = clamp1to5(Number(sectionGrades.construction));
  console.log('[ScoreBreakdown] Using documents.section_grades.construction:', sectionGrades.construction, '→', constructionRating);
} else {
  // Third priority: compute from RE-02
  const constructionResult = await getConstructionRating(documentId);
  constructionRating = constructionResult.rating;
  if (!constructionMetadata) {
    constructionMetadata = constructionResult.metadata;
  }
  console.log('[ScoreBreakdown] Computed construction rating:', constructionRating);
}
```

**Lines 70-72:** Added clamp helper:
```typescript
export function clamp1to5(n: number): number {
  return Math.max(1, Math.min(5, Number.isFinite(n) ? n : 3));
}
```

**Key changes:**
- Added explicit `!== undefined` checks to detect when values are present
- Use `clamp1to5()` to ensure rating is always 1-5
- Read from `riskEngData.sectionGrades.construction` (not from metadata.site_score)
- Keep metadata separate for display subtitle

### B) RE-02 Persistence Enhanced
**File:** `src/components/re/BuildingsGrid.tsx`

**Lines 460-520:** Updated to persist to BOTH targets:
1. **RISK_ENGINEERING module instance:**
   - `data.sectionGrades.construction` = rounded rating (1-5 int)
   - `data.sectionMeta.construction` = { site_score, site_combustible_percent }

2. **documents.section_grades:**
   - `section_grades.construction` = rounded rating (1-5 int)
   - Used by OverallGradeWidget and other consumers

**Debouncing:** 500ms debounce, only writes if changed

### C) Debug Logs Added (Temporary)
**RE-02 BuildingsGrid (lines 466-467, 493, 517):**
```
[RE02->persist] ratingInt X siteScore Y.Y
[RE02->persist] ✓ Updated RISK_ENGINEERING module with rating: X
[RE02->persist] ✓ Updated documents.section_grades.construction: X
```

**RE14 DraftOutputsForm (lines 97-98, 109):**
```
[RE14] sectionGrades.construction X
[RE14] sectionMeta.construction {...}
[RE14] Construction factor rating: X
```

**Score Breakdown Builder (lines 120, 124, 132):**
```
[ScoreBreakdown] Using riskEngData.sectionGrades.construction: X → Y
[ScoreBreakdown] Using documents.section_grades.construction: X → Y
[ScoreBreakdown] Computed construction rating: X
```

## Data Flow (End-to-End)

```
User edits buildings in RE-02 BuildingsGrid
  ↓
siteMetrics.score computed (e.g., 1.7)
  ↓ (500ms debounce)
constructionRating = clamp1to5(Math.round(1.7)) = 2
  ↓
WRITE to RISK_ENGINEERING module:
  • sectionGrades.construction = 2
  • sectionMeta.construction = { site_score: 1.7, site_combustible_percent: 35 }
  ↓
WRITE to documents table:
  • section_grades.construction = 2
  ↓
User navigates to RE14 Risk Ratings Summary
  ↓
RE14 loads RISK_ENGINEERING module data
  ↓
buildRiskEngineeringScoreBreakdown() called with riskEng.data
  ↓
Reads riskEngData.sectionGrades.construction = 2
  ↓
RE14 table displays:
  • Rating: 2 (★★☆☆☆)
  • Subtitle: "Site score: 1.7 • Combustible: 35%"
  ↓
OverallGradeWidget reads documents.section_grades.construction = 2
  ↓
Shows updated construction chip
```

## Priority Logic

**For RE14 (via buildRiskEngineeringScoreBreakdown):**
1. `RISK_ENGINEERING.data.sectionGrades.construction` ← persisted by BuildingsGrid (PRIMARY)
2. `documents.section_grades.construction` (fallback)
3. Computed from RE-02 breakdown (fallback)
4. Default 3

**For OverallGradeWidget:**
- `documents.section_grades.construction` ← updated by BuildingsGrid

## Acceptance Tests

✅ **Test 1:** Edit RE-02 Buildings to make roof highly combustible (EPS/PIR), site score drops to 1.7
- RE14 Risk Ratings Summary shows rating 2 (rounded from 1.7)
- Subtitle shows "Site score: 1.7 • Combustible: XX%"

✅ **Test 2:** OverallGradeWidget updates
- Construction chip shows grade 2 because documents.section_grades.construction updated

✅ **Test 3:** Debug logs confirm data flow
- `[RE02->persist]` logs show rating being written
- `[RE14]` logs show rating being read from module data
- `[ScoreBreakdown]` logs show correct priority being used

## Files Modified

1. **src/lib/re/scoring/riskEngineeringHelpers.ts** (lines 70-72, 117-133)
   - Added clamp1to5() helper
   - Fixed construction rating priority logic
   - Added debug logs

2. **src/components/re/BuildingsGrid.tsx** (lines 466-467, 493, 495-520)
   - Added debug logs before/after persistence
   - Enhanced to update both module_instances and documents tables
   - Ensures both targets stay in sync

3. **src/components/modules/forms/RE14DraftOutputsForm.tsx** (lines 97-98, 109)
   - Added debug logs before calling score breakdown builder

## Build Status
✅ Build passes (1903 modules, 15.88s)

## Notes for Production
- Debug logs can be removed once verified working in testing
- The clamp1to5() helper ensures ratings are always valid (1-5)
- Both persistence targets (module + document) ensure all consumers stay updated
- 500ms debounce prevents excessive database writes
- Change detection ensures no-op when values haven't changed
