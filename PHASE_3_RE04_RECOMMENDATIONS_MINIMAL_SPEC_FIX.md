# Phase 3 RE-04 Recommendations — Minimal Spec Fix

## Status: ✅ Fixed and Aligned to Minimal Spec

All Phase 3 implementation now matches minimal spec requirements:
- Only triggers on real data (no missing/undefined triggers)
- Removed arbitrary thresholds (80% coverage)
- Removed extra recommendation types
- Removed database persistence
- Updated text to neutral wording

---

## Files Changed

### 1. `src/lib/modules/re04FireProtectionRecommendations.ts` (REWRITTEN - 336 lines)

**Changes Made**:
- ✅ Only generates recommendations from real data triggers
- ✅ NO recommendations for missing/undefined ratings
- ✅ Uses `provided_pct` and `required_pct` for coverage gaps (not arbitrary 80%)
- ✅ Priority determination: rating 1 = high, rating 2 = medium
- ✅ Coverage gap priority: gap >= 30% = high, else medium
- ✅ Removed monitoring upgrade recommendations
- ✅ Removed sprinkler adequacy recommendations
- ✅ Changed text from "raise rating to at least 3" to "achieve adequate protection"
- ✅ Deterministic ID generation maintained
- ✅ De-duplication logic prevents duplicate codes per building

**Removed Lines**:
- Lines with arbitrary 80% threshold checks
- Lines generating recommendations for undefined/missing ratings
- Lines referencing sprinkler adequacy field
- Lines referencing monitoring upgrades
- Text mentioning "raise rating to at least 3"

**Added Lines**:
- Strict `!== undefined` checks before rating comparisons (lines 85, 125, 183)
- Both `provided_pct` and `required_pct` existence checks (lines 102-104, 143-146)
- De-duplication logic using Set (lines 82, 107, 127, 149)
- Neutral wording: "achieve adequate protection" (lines 96, 137, 192)
- Coverage text showing actual gap: "X% to Y% (Z% gap)" (lines 119, 161)

---

### 2. `src/pages/re/FireProtectionPage.tsx` (MODIFIED)

**Changes Made**:
- ✅ Removed recommendations from database persistence
- ✅ Kept recommendations as in-memory computation only
- ✅ Updated mapping to use `provided_pct` and `required_pct` (not `coverage_percent`)
- ✅ Removed default rating value (was `|| 3`, now undefined if not present)
- ✅ Removed `sprinkler_adequacy` from mapping

**Modified Lines**:
- Line 186-187: Comment updated to clarify Phase 3 is in-memory only
- Line 190-192: Removed `recommendations: derivedRecommendations` from derived data
- Line 207: Removed `derivedRecommendations` from dependency array
- Line 238: Comment clarifies in-memory only
- Line 247: Changed from `sprinkler.sprinkler_score_1_5 || 3` to just `sprinkler.sprinkler_score_1_5`
- Line 248-249: Changed from `coverage_percent` and `adequacy` to `provided_pct` and `required_pct`
- Line 260: Removed `|| 'unknown'` fallback

**Removed Lines**:
- Database persistence of recommendations in `saveSiteWater` callback

---

## Recommendation Triggers (Minimal Spec)

### Building-Level: Suppression

**SPRINKLER_INADEQUATE** (Code)
- Trigger: `sprinklers.rating !== undefined AND sprinklers.rating <= 2`
- Priority: `rating === 1` → HIGH, `rating === 2` → MEDIUM
- Text: "Upgrade sprinkler system to achieve adequate protection (currently rated X)."

**COVERAGE_GAP** (Code)
- Trigger: `sprinklers.provided_pct !== undefined AND sprinklers.required_pct !== undefined AND provided_pct < required_pct`
- Priority: `gap >= 30` → HIGH, else MEDIUM
- Text: "Extend sprinkler coverage from X% to Y% to meet requirements (Z% gap)."

**WATER_MIST_INADEQUATE** (Code)
- Trigger: `water_mist.rating !== undefined AND water_mist.rating <= 2 AND no SPRINKLER_INADEQUATE already`
- Priority: `rating === 1` → HIGH, `rating === 2` → MEDIUM
- Text: "Upgrade water mist system to achieve adequate protection (currently rated X)."

**COVERAGE_GAP** (Code - water mist variant)
- Trigger: `water_mist.provided_pct !== undefined AND water_mist.required_pct !== undefined AND provided_pct < required_pct AND no sprinkler COVERAGE_GAP already`
- Priority: `gap >= 30` → HIGH, else MEDIUM
- Text: "Extend water mist coverage from X% to Y% to meet requirements (Z% gap)."

---

### Building-Level: Detection

**DETECTION_INADEQUATE** (Code)
- Trigger: `detection.rating !== undefined AND detection.rating <= 2`
- Priority: `rating === 1` → HIGH, `rating === 2` → MEDIUM
- Text: "Upgrade fire detection and alarm system to achieve adequate protection (currently rated X)."

---

### Site-Level: Water Supply

**WATER_UNRELIABLE** (Code)
- Trigger: `water_supply_reliability === 'unreliable'`
- Priority: HIGH
- Text: "Improve water supply reliability through redundant mains connection, on-site storage, or pump upgrade to support fire protection systems."

**WATER_UNKNOWN** (Code)
- Trigger: `water_supply_reliability === 'unknown'`
- Priority: LOW (changed from MEDIUM in original)
- Text: "Conduct water supply assessment to determine adequacy and reliability for fire protection systems."

---

## What Was Removed (Not in Minimal Spec)

### ❌ Missing Data Triggers
- NO recommendation generated when rating is missing/undefined
- NO recommendation generated when coverage fields are missing
- NO recommendation generated for "unknown" rating scenarios

### ❌ Arbitrary Thresholds
- NO 80% coverage threshold
- Only uses actual `required_pct` vs `provided_pct` comparison

### ❌ Extra Recommendation Types
- NO `SPRINKLER_PARTIAL` (adequacy = partial)
- NO `SPRINKLER_INADEQUATE_DESIGN` (adequacy = inadequate)
- NO `DETECTION_COVERAGE_GAP` (coverage < 80%)
- NO `DETECTION_MONITORING_UPGRADE` (local-only monitoring)

### ❌ Database Persistence
- NO recommendations saved to `re_site_water.data.derived.recommendations`
- NO debounced auto-save of recommendations
- Recommendations computed in-memory only via `useMemo`

### ❌ Prescriptive Text
- NO "raise rating to at least 3" language
- Changed to neutral "achieve adequate protection"

---

## De-Duplication Logic

Uses `Set<string>` to track generated codes per building:

```typescript
const generatedCodes = new Set<string>();

// Sprinkler inadequate
if (sprinklers?.rating <= 2) {
  generatedCodes.add('SPRINKLER_INADEQUATE');
  // ... generate recommendation
}

// Water mist inadequate (only if sprinkler inadequate not already generated)
if (waterMist?.rating <= 2) {
  if (!generatedCodes.has('SPRINKLER_INADEQUATE')) {
    generatedCodes.add('WATER_MIST_INADEQUATE');
    // ... generate recommendation
  }
}

// Coverage gap (only if not already generated)
if (sprinklers?.provided_pct < sprinklers?.required_pct) {
  if (!generatedCodes.has('COVERAGE_GAP')) {
    generatedCodes.add('COVERAGE_GAP');
    // ... generate recommendation
  }
}
```

Ensures only ONE recommendation per code per building, preventing:
- Both SPRINKLER_INADEQUATE and WATER_MIST_INADEQUATE
- Both sprinkler COVERAGE_GAP and water mist COVERAGE_GAP

---

## Deterministic IDs (Maintained)

IDs remain stable and deterministic:

**Building-scoped**:
```
building:B1:SPRINKLER_INADEQUATE
building:B1:COVERAGE_GAP
building:B2:DETECTION_INADEQUATE
```

**Site-scoped**:
```
site:WATER_UNRELIABLE
site:WATER_UNKNOWN
```

Same format as before, enabling future tracking and deduplication.

---

## Data Mapping Changes

### Before (Original Phase 3)
```typescript
buildingsForRecs[sprinkler.building_id] = {
  suppression: {
    sprinklers: {
      rating: sprinkler.sprinkler_score_1_5 || 3,  // ❌ Default 3
      coverage_percent: sprinkler.data?.coverage_percent,  // ❌ Wrong field
      adequacy: sprinkler.data?.sprinkler_adequacy,  // ❌ Not needed
    },
  },
};

site: {
  water_supply_reliability: siteWaterData.water_reliability?.toLowerCase() || 'unknown'  // ❌ Default unknown
}
```

### After (Minimal Spec)
```typescript
buildingsForRecs[sprinkler.building_id] = {
  suppression: {
    sprinklers: {
      rating: sprinkler.sprinkler_score_1_5,  // ✅ No default, can be undefined
      provided_pct: sprinkler.data?.provided_pct,  // ✅ Actual field
      required_pct: sprinkler.data?.required_pct,  // ✅ Actual field
    },
  },
};

site: {
  water_supply_reliability: siteWaterData.water_reliability?.toLowerCase()  // ✅ No default, can be undefined
}
```

---

## Example Scenarios (Minimal Spec)

### Scenario 1: Rating = 2, No Coverage Data
**Input**:
- Building B1
- Sprinkler rating: 2
- No provided_pct or required_pct

**Output**:
```json
[
  {
    "id": "building:B1:SPRINKLER_INADEQUATE",
    "priority": "medium",
    "code": "SPRINKLER_INADEQUATE",
    "trigger": "sprinklers_rating=2",
    "text": "Upgrade sprinkler system to achieve adequate protection (currently rated 2)."
  }
]
```

---

### Scenario 2: Rating = 5, Coverage Gap 20%
**Input**:
- Building B2
- Sprinkler rating: 5
- Provided: 70%, Required: 90%

**Output**:
```json
[
  {
    "id": "building:B2:COVERAGE_GAP",
    "priority": "medium",
    "code": "COVERAGE_GAP",
    "trigger": "sprinklers_provided=70%_required=90%",
    "text": "Extend sprinkler coverage from 70% to 90% to meet requirements (20% gap)."
  }
]
```

---

### Scenario 3: Rating = 2, Coverage Gap 35%
**Input**:
- Building B3
- Sprinkler rating: 2
- Provided: 55%, Required: 90%

**Output**:
```json
[
  {
    "id": "building:B3:SPRINKLER_INADEQUATE",
    "priority": "medium",
    "code": "SPRINKLER_INADEQUATE",
    "trigger": "sprinklers_rating=2",
    "text": "Upgrade sprinkler system to achieve adequate protection (currently rated 2)."
  },
  {
    "id": "building:B3:COVERAGE_GAP",
    "priority": "high",
    "code": "COVERAGE_GAP",
    "trigger": "sprinklers_provided=55%_required=90%",
    "text": "Extend sprinkler coverage from 55% to 90% to meet requirements (35% gap)."
  }
]
```

---

### Scenario 4: No Rating Data
**Input**:
- Building B4
- Sprinkler rating: undefined

**Output**:
```json
[]
```
**No recommendations generated** (minimal spec: no missing data triggers)

---

### Scenario 5: Water Supply Unknown
**Input**:
- Site water reliability: "unknown"

**Output**:
```json
[
  {
    "id": "site:WATER_UNKNOWN",
    "priority": "low",
    "code": "WATER_UNKNOWN",
    "trigger": "water_reliability=unknown",
    "text": "Conduct water supply assessment to determine adequacy and reliability for fire protection systems."
  }
]
```

---

### Scenario 6: Water Supply Unreliable
**Input**:
- Site water reliability: "unreliable"

**Output**:
```json
[
  {
    "id": "site:WATER_UNRELIABLE",
    "priority": "high",
    "code": "WATER_UNRELIABLE",
    "trigger": "water_reliability=unreliable",
    "text": "Improve water supply reliability through redundant mains connection, on-site storage, or pump upgrade to support fire protection systems."
  }
]
```

---

## Build Verification

```bash
npm run build
✓ 1908 modules transformed
✓ built in 19.59s
```

Build passes successfully with all changes.

---

## Summary of Minimal Spec Alignment

### ✅ Fixed
- Only triggers on real data (no undefined/missing triggers)
- Uses actual `provided_pct` vs `required_pct` (no arbitrary 80%)
- Priority based on rating (1=high, 2=medium) and gap size (>=30%=high)
- Removed extra recommendation types (adequacy, monitoring, missing data)
- Removed database persistence (in-memory only)
- Neutral wording ("achieve adequate protection")
- De-duplication prevents multiple codes per building
- Deterministic IDs maintained

### ✅ Kept
- In-memory computation via `useMemo`
- Automatic recomputation on data changes
- Null-safe input handling
- Backward compatibility
- Utility functions for filtering/summarizing
- No UI changes (Phase 4 scope)
- No workflow integration (future scope)

### ✅ Removed
- Database persistence of recommendations
- Arbitrary 80% coverage threshold
- Missing data triggers
- Sprinkler adequacy recommendations
- Detection monitoring upgrade recommendations
- Prescriptive "raise to 3" language

---

## Current Phase 3 Scope

**Generates recommendations for**:
- Sprinkler rating <= 2
- Sprinkler coverage gap (provided < required)
- Water mist rating <= 2 (if no sprinkler inadequate)
- Water mist coverage gap (if no sprinkler coverage gap)
- Detection rating <= 2
- Water supply unreliable or unknown

**Does NOT generate recommendations for**:
- Missing/undefined ratings
- Arbitrary coverage thresholds
- Sprinkler adequacy issues
- Detection monitoring issues
- Any other edge cases

**Data Flow**:
- Computed: In-memory via `useMemo` hook
- Stored: Nowhere (not persisted to database)
- Displayed: Nowhere (no UI in Phase 3)
- Workflow: None (future integration)

Phase 3 now minimal, safe, and aligned to spec. Ready for Phase 4 UI integration.
