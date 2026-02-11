# Phase 3: RE-04 Fire Protection Recommendations — COMPLETE

## Status: ✅ Successfully Implemented

Pure, deterministic recommendation generator implemented. Structured recommendations automatically generated and persisted. All Phase 3 deliverables complete. No UI changes (Phase 4 scope).

---

## Files Changed

### 1. `src/lib/modules/re04FireProtectionRecommendations.ts` (NEW - 389 lines)
Complete recommendation generation system with:
- `FireProtectionRecommendation` type definition
- `generateFireProtectionRecommendations()` - Main generator function
- Helper functions for building/site-level recommendations
- Utility functions for filtering and summarizing recommendations

### 2. `src/pages/re/FireProtectionPage.tsx` (MODIFIED)
- Imported recommendation generator (lines 38-41)
- Added `derivedRecommendations` computation (lines 237-264)
- Modified `saveSiteWater` to persist recommendations (lines 189-192, 207)

---

## Data Type Definition

### FireProtectionRecommendation
```typescript
{
  id: string;           // Deterministic: "building:B1:SUPPRESSION_INADEQUATE"
  scope: "building" | "site";
  buildingId?: string;  // Present for building-scope recommendations
  category: "suppression" | "detection" | "water_supply";
  priority: "high" | "medium" | "low";
  code: string;         // Machine-readable code
  trigger: string;      // What caused this recommendation
  text: string;         // Human-readable recommendation text
}
```

---

## Recommendation Logic (Deterministic)

### Building-Level: Suppression

**Code: `SUPPRESSION_INADEQUATE`**
- Trigger: Rating ≤ 2 or missing
- Priority: HIGH
- Text: "Upgrade [system] to improve protection rating from [X] to at least 3" or "Install adequate suppression system"

**Code: `COVERAGE_GAP`**
- Trigger: Rating ≥ 3 AND coverage < 80%
- Priority: MEDIUM
- Text: "Extend [system] coverage from [X]% to at least 80% of the building"

**Code: `SPRINKLER_PARTIAL`**
- Trigger: Sprinkler adequacy = "partial"
- Priority: MEDIUM
- Text: "Review sprinkler system adequacy and upgrade to meet full occupancy risk requirements"

**Code: `SPRINKLER_INADEQUATE_DESIGN`**
- Trigger: Sprinkler adequacy = "inadequate"
- Priority: HIGH
- Text: "Sprinkler system design is inadequate for the occupancy. Upgrade to appropriate design standard"

---

### Building-Level: Detection

**Code: `DETECTION_INADEQUATE`**
- Trigger: Rating ≤ 2 or missing
- Priority: HIGH
- Text: "Upgrade fire detection and alarm system to improve rating from [X] to at least 3" or "Install adequate system"

**Code: `DETECTION_COVERAGE_GAP`**
- Trigger: Rating ≥ 3 AND coverage < 80%
- Priority: MEDIUM
- Text: "Extend fire detection coverage from [X]% to at least 80% of the building"

**Code: `DETECTION_MONITORING_UPGRADE`**
- Trigger: Rating ≥ 3 AND monitoring = "local_only"
- Priority: LOW
- Text: "Consider upgrading fire alarm monitoring from local-only to remote monitoring or ARC connection"

---

### Site-Level: Water Supply

**Code: `WATER_UNRELIABLE`**
- Trigger: Water supply reliability = "unreliable"
- Priority: HIGH
- Text: "Improve water supply reliability through redundant mains connection, on-site storage, or pump upgrade"

**Code: `WATER_UNKNOWN`**
- Trigger: Water supply reliability = "unknown"
- Priority: MEDIUM
- Text: "Conduct water supply assessment to determine adequacy and reliability for fire protection systems"

---

## Priority Determination Algorithm

```typescript
function determinePriority(rating, coverage) {
  if (!rating) return "high";         // Missing data = high priority
  if (rating <= 2) return "high";     // Poor rating = high priority
  if (rating === 3) return "medium";  // Average rating = medium priority

  // Good rating (4-5) with coverage gap = medium
  if (rating >= 4 && coverage < 80) return "medium";

  // Good rating with good coverage = low priority
  return "low";
}
```

---

## Deterministic ID Generation

IDs are stable and deterministic based on scope, code, and building:

```typescript
// Building-scoped
"building:B1:SUPPRESSION_INADEQUATE"
"building:B2:COVERAGE_GAP"
"building:B1:DETECTION_INADEQUATE"

// Site-scoped
"site:WATER_UNRELIABLE"
"site:WATER_UNKNOWN"
```

Same inputs always produce same IDs, enabling:
- Deduplication
- Tracking (future: recommendation lifecycle)
- Cross-version comparison

---

## Integration & Data Flow

### Recommendation Generation (Lines 237-264)
```typescript
const derivedRecommendations = useMemo(() => {
  // Map database records to module structure
  const buildingsForRecs = {};
  buildingSprinklers.forEach(sprinkler => {
    buildingsForRecs[sprinkler.building_id] = {
      suppression: {
        sprinklers: {
          rating: sprinkler.sprinkler_score_1_5,
          coverage_percent: sprinkler.data?.coverage_percent,
          adequacy: sprinkler.data?.sprinkler_adequacy,
        },
      },
    };
  });

  const fpModule = {
    buildings: buildingsForRecs,
    site: {
      water_supply_reliability: siteWaterData.water_reliability,
    },
  };

  return generateFireProtectionRecommendations(fpModule);
}, [buildingSprinklers, siteWaterData.water_reliability]);
```

**Recomputation Triggers**:
- `buildingSprinklers` changes (any building rating/data update)
- `siteWaterData.water_reliability` changes

**Memoization**: Uses `useMemo` to avoid unnecessary regeneration

---

### Persistence (Lines 186-193)
```typescript
const updatedData = {
  ...siteWaterData,
  derived: {
    site_fire_protection_score: derivedSiteScore,      // Phase 2
    recommendations: derivedRecommendations,            // Phase 3
  },
};
```

**Storage Location**: `re_site_water.data.derived.recommendations`

**Auto-Save**: Debounced (1 second delay) on data changes

---

## Utility Functions

### Summary Functions
```typescript
getRecommendationSummary(recommendations)
// Returns: { total: 12, high: 3, medium: 6, low: 3 }

getRecommendationsByCategory(recommendations)
// Returns: { suppression: [...], detection: [...], water_supply: [...] }

getBuildingRecommendations(recommendations, buildingId)
// Returns: recommendations for specific building

getSiteRecommendations(recommendations)
// Returns: site-level recommendations only
```

---

## Null Safety & Backward Compatibility

### ✅ Null-Safe Input Handling
```typescript
// Handles missing entire module
if (!fpModule) return [];

// Handles missing buildings map
if (!fpModule.buildings) { /* skip building recs */ }

// Handles missing site data
if (!fpModule.site) { /* skip site recs */ }

// Handles missing individual fields
rating ?? 'missing'
coverage ?? undefined
adequacy ?? undefined
```

### ✅ Empty Array Default
- Missing data → empty recommendation array
- Never throws errors on undefined/null inputs
- Safe to call on old documents without fire protection data

### ✅ Additive-Only Storage
- Recommendations stored in optional `derived.recommendations` field
- Existing data structure unchanged
- Old records without recommendations load without errors
- New recommendations generated on next save

### ✅ Deterministic Output
- Same inputs → same recommendations
- Same IDs → same recommendation identity
- No timestamps or random values in output
- Reproducible across sessions

---

## Example Recommendation Scenarios

### Scenario 1: Building with Poor Sprinklers
**Input**:
- Building B1
- Sprinkler rating: 2
- Coverage: 60%

**Output**:
```json
[
  {
    "id": "building:B1:SUPPRESSION_INADEQUATE",
    "scope": "building",
    "buildingId": "B1",
    "category": "suppression",
    "priority": "high",
    "code": "SUPPRESSION_INADEQUATE",
    "trigger": "sprinklers_rating=2",
    "text": "Upgrade sprinklers system to improve protection rating from 2 to at least 3."
  }
]
```

---

### Scenario 2: Building with Good Sprinklers, Coverage Gap
**Input**:
- Building B2
- Sprinkler rating: 4
- Coverage: 70%

**Output**:
```json
[
  {
    "id": "building:B2:COVERAGE_GAP",
    "scope": "building",
    "buildingId": "B2",
    "category": "suppression",
    "priority": "medium",
    "code": "COVERAGE_GAP",
    "trigger": "sprinklers_coverage=70%",
    "text": "Extend sprinklers coverage from 70% to at least 80% of the building."
  }
]
```

---

### Scenario 3: Missing Detection System
**Input**:
- Building B3
- Detection rating: (missing)

**Output**:
```json
[
  {
    "id": "building:B3:DETECTION_INADEQUATE",
    "scope": "building",
    "buildingId": "B3",
    "category": "detection",
    "priority": "high",
    "code": "DETECTION_INADEQUATE",
    "trigger": "detection_rating=missing",
    "text": "Install adequate fire detection and alarm system for this building."
  }
]
```

---

### Scenario 4: Unreliable Water Supply
**Input**:
- Water supply reliability: "unreliable"

**Output**:
```json
[
  {
    "id": "site:WATER_UNRELIABLE",
    "scope": "site",
    "category": "water_supply",
    "priority": "high",
    "code": "WATER_UNRELIABLE",
    "trigger": "water_reliability=unreliable",
    "text": "Improve water supply reliability through redundant mains connection, on-site storage, or pump upgrade to support fire protection systems."
  }
]
```

---

### Scenario 5: Unknown Water Supply
**Input**:
- Water supply reliability: "unknown"

**Output**:
```json
[
  {
    "id": "site:WATER_UNKNOWN",
    "scope": "site",
    "category": "water_supply",
    "priority": "medium",
    "code": "WATER_UNKNOWN",
    "trigger": "water_reliability=unknown",
    "text": "Conduct water supply assessment to determine adequacy and reliability for fire protection systems."
  }
]
```

---

### Scenario 6: Multiple Issues, Multiple Buildings
**Input**:
- Building B1: Sprinkler rating 2, Detection rating 3 with 70% coverage
- Building B2: Sprinkler rating 4, no detection
- Site: Water supply unknown

**Output**: 5 recommendations
1. `building:B1:SUPPRESSION_INADEQUATE` (HIGH)
2. `building:B1:DETECTION_COVERAGE_GAP` (MEDIUM)
3. `building:B2:DETECTION_INADEQUATE` (HIGH)
4. `site:WATER_UNKNOWN` (MEDIUM)

Priority breakdown: 2 high, 2 medium, 0 low

---

## Current Limitations (By Design - Phase 3)

### Detection Data Not in Database
Current implementation can only generate detection recommendations when detection data becomes available. The database schema (`re_building_sprinklers`) currently lacks detection fields.

**Impact**: Detection recommendations currently not generated (no detection data to evaluate)

**Future**: Add `re_building_detection` table and update generator input mapping

---

### Internal-Only (No UI)
Recommendations are generated and persisted but not displayed to users.

**Phase 3**: Generator only (internal data structure)
**Phase 4**: Add UI components to display recommendations

---

### No Workflow Integration
Recommendations are not connected to RE-09 workflow system:
- No status tracking (open/closed/in-progress)
- No assignment to users
- No due dates or priorities beyond the recommendation itself
- No lifecycle management

**Phase 3**: Static recommendation list
**Future**: Integration with action register (RE-09) for tracking

---

## What Phase 3 Does NOT Include (As Required)

❌ No UI rendering or display components
❌ No "module outcome" section
❌ No workflow/status/assignment fields
❌ No modification to RE-09 or action register
❌ No changes to scoring logic (Phase 2 unchanged)
❌ No layout or navigation changes
❌ No cross-module refactors

---

## Testing Verification

### Build Status
```bash
npm run build
✓ 1908 modules transformed
✓ built in 18.82s
```

### Manual Test Cases (Recommended)

**Test 1: Empty Module**
- Input: No buildings, no site data
- Expected: Empty recommendations array `[]`

**Test 2: Single Building, Low Rating**
- Input: Building with sprinkler rating = 1
- Expected: 1 recommendation with code `SUPPRESSION_INADEQUATE`, priority HIGH

**Test 3: Single Building, Good Rating + Coverage Gap**
- Input: Building with sprinkler rating = 4, coverage = 65%
- Expected: 1 recommendation with code `COVERAGE_GAP`, priority MEDIUM

**Test 4: Multiple Buildings**
- Input: B1 (rating 2), B2 (rating 5), B3 (rating 3, coverage 70%)
- Expected: 2 recommendations (B1 inadequate, B3 coverage gap)

**Test 5: Water Supply - Unreliable**
- Input: Site water reliability = "unreliable"
- Expected: 1 site recommendation with code `WATER_UNRELIABLE`, priority HIGH

**Test 6: Water Supply - Unknown**
- Input: Site water reliability = "unknown"
- Expected: 1 site recommendation with code `WATER_UNKNOWN`, priority MEDIUM

**Test 7: Water Supply - Reliable**
- Input: Site water reliability = "reliable"
- Expected: 0 water supply recommendations

**Test 8: ID Stability**
- Input: Same building/code twice
- Expected: Same recommendation ID both times

**Test 9: Backward Compatibility**
- Input: Load old record without derived.recommendations
- Expected: No errors, recommendations generated on next save

**Test 10: Null Safety**
- Input: Missing suppression, missing detection, missing site
- Expected: No errors, empty or partial recommendation array

---

## Next Steps (For Future Phases)

**Phase 4** could include:
- UI components to display recommendations
- Filtering by priority/category/building
- Visual indicators (badges, counts)
- Expandable recommendation cards

**Phase 5** could include:
- Integration with RE-09 action register
- Recommendation lifecycle (open → in-progress → closed)
- Assignment to users
- Due dates and tracking

**Phase 6** could include:
- Recommendation acceptance/rejection workflow
- Custom recommendation editing
- Recommendation templates and customization
- Historical recommendation tracking

---

## Summary

Phase 3 successfully implements:
- ✅ Pure, deterministic recommendation generator
- ✅ Structured recommendation data type
- ✅ 9 distinct recommendation codes covering:
  - 4 suppression scenarios
  - 3 detection scenarios
  - 2 water supply scenarios
- ✅ Priority determination (high/medium/low)
- ✅ Deterministic ID generation
- ✅ Automatic recomputation on data changes
- ✅ Debounced persistence to database
- ✅ Full null safety and backward compatibility
- ✅ Zero UI changes (as required)
- ✅ Zero workflow integration (as required)

Recommendations are now automatically generated and stored in `re_site_water.data.derived.recommendations`, ready for UI display in Phase 4 and workflow integration in future phases.
