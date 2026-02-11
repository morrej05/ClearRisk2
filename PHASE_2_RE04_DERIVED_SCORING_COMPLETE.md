# Phase 2: RE-04 Fire Protection Derived Scoring — COMPLETE

## Status: ✅ Successfully Implemented

Pure, deterministic, null-safe scoring functions implemented and integrated. All Phase 2 deliverables complete. Backward compatibility maintained.

---

## Files Changed

### 1. `src/lib/modules/re04FireProtectionScoring.ts` (NEW)
Pure scoring module with three main functions:
- `computeBuildingFireProtectionScore()` - Building-level score (1-5)
- `computeSiteFireProtectionScore()` - Site-level score (1-5) with water cap
- `computeAllDerivedScores()` - Convenience function for batch computation

### 2. `src/pages/re/FireProtectionPage.tsx` (MODIFIED)
- Imported scoring functions from new module
- Added `derivedBuildingScore` computation (lines 216-231)
- Added `derivedSiteScore` computation (lines 142-174)
- Modified `saveBuildingSprinkler` to persist building derived scores (lines 240-244)
- Modified `saveSiteWater` to persist site derived scores (lines 183-188)

---

## Scoring Algorithm Implementation

### Building-Level Score (1-5)

**Function**: `computeBuildingFireProtectionScore(buildingFp)`

**Inputs**:
- Suppression rating (sprinklers or water_mist)
- Detection/alarm rating (optional)

**Weighting**:
```typescript
if (both suppression and detection present):
  raw = 0.7 * suppression + 0.3 * detection
else if (only suppression present):
  raw = suppression
else if (only detection present):
  raw = detection
else:
  return null  // Insufficient data
```

**Output**:
- Round to nearest integer: `Math.round(raw)`
- Clamp to 1-5 range
- Return `null` if no data available

**Null Safety**:
- Handles missing `buildingFp` → returns `null`
- Handles missing suppression → checks water_mist fallback
- Handles missing detection → suppression-only scoring
- Handles both missing → returns `null`

---

### Site-Level Score (1-5)

**Function**: `computeSiteFireProtectionScore(buildings, siteData, buildingsMeta)`

**Step 1: Aggregate Building Scores**
- Compute score for each building using building-level function
- Skip buildings with `null` scores (insufficient data)
- If zero buildings have scores → return `null`

**Step 2: Floor Area Weighting**
```typescript
// Prefer floor_area_sqm, fallback to footprint_m2
weight = building.floor_area_sqm || building.footprint_m2 || 1

// Calculate weighted average
totalWeight = sum(all weights)
weightedSum = sum(score_i * weight_i)
siteRaw = weightedSum / totalWeight
```

**Step 3: Round to Integer**
```typescript
siteScorePreCap = clamp(1, 5, Math.round(siteRaw))
```

**Step 4: Apply Water Supply Reliability Cap**
```typescript
if (water_supply_reliability === 'reliable'):
  // No cap
  siteScore = siteScorePreCap
else if (water_supply_reliability === 'unknown'):
  // Cap at 4
  siteScore = min(siteScorePreCap, 4)
else if (water_supply_reliability === 'unreliable'):
  // Cap at 3
  siteScore = min(siteScorePreCap, 3)
```

**Null Safety**:
- Handles missing buildings map → returns `null`
- Handles missing building metadata → uses weight = 1 (equal weighting)
- Handles missing floor area → fallback to footprint or 1
- Handles missing water reliability → defaults to 'unknown' (cap at 4)

---

## Integration Points

### FireProtectionPage Component

**Building Score Computation** (Lines 216-231):
- Triggered on `selectedSprinkler` or `selectedSprinklerScore` change
- Memoized using `useMemo` to avoid unnecessary recomputation
- Maps database sprinkler rating to scoring function input format
- Currently suppression-only (detection not in database schema)

**Site Score Computation** (Lines 142-174):
- Triggered on `buildingSprinklers`, `siteWaterData.water_reliability`, or `buildings` change
- Memoized using `useMemo` for performance
- Aggregates all building sprinklers into scoring format
- Maps water reliability from database format to scoring format
- Provides building metadata (floor area) for area weighting

**Persistence** (Automatic):
- Building derived score saved in `BuildingSprinklerData.derived.building_fire_protection_score`
- Site derived score saved in `SiteWaterData.derived.site_fire_protection_score`
- Both triggered by debounced auto-save (1 second delay)
- Scores recomputed on every relevant data change

---

## Data Flow

```
User Input
    ↓
State Update (selectedSprinklerData, siteWaterData)
    ↓
useMemo Recompute (derivedBuildingScore, derivedSiteScore)
    ↓
Debounced Save (1 second)
    ↓
Persist to Database (derived fields in JSONB data column)
```

---

## Backward Compatibility

### ✅ Null Safety
- All scoring functions handle missing/undefined inputs gracefully
- Return `null` instead of throwing errors
- Never assume data exists without checking

### ✅ Optional Derived Fields
- Derived scores stored in optional `derived` object
- Existing records without `derived` fields load without errors
- New records automatically compute and store derived scores

### ✅ No Breaking Changes
- No existing fields renamed or removed
- No changes to existing data structures
- Additive-only changes to data model

### ✅ Deterministic Output
- Same inputs always produce same outputs
- No random values or timestamps in scores
- Pure functions with no side effects

---

## Testing Verification

### Build Status
```bash
npm run build
✓ 1907 modules transformed
✓ built in 17.39s
```

### Manual Test Cases (Recommended)

**Test 1: Building Score - Both Inputs Present**
- Suppression rating: 4
- Detection rating: 3
- Expected: `0.7*4 + 0.3*3 = 2.8 + 0.9 = 3.7 → round(3.7) = 4`

**Test 2: Building Score - Suppression Only**
- Suppression rating: 5
- Detection rating: (missing)
- Expected: `5`

**Test 3: Building Score - Detection Only**
- Suppression rating: (missing)
- Detection rating: 2
- Expected: `2`

**Test 4: Building Score - Neither Present**
- Suppression rating: (missing)
- Detection rating: (missing)
- Expected: `null`

**Test 5: Site Score - Reliable Water Supply**
- Building scores: [4, 5, 3] (equal weights)
- Water reliability: 'reliable'
- Expected: `(4+5+3)/3 = 4.0 → round(4) = 4` (no cap)

**Test 6: Site Score - Unknown Water Supply**
- Building scores: [5, 5] (equal weights)
- Water reliability: 'unknown'
- Expected: `(5+5)/2 = 5.0 → round(5) = 5 → min(5, 4) = 4` (capped at 4)

**Test 7: Site Score - Unreliable Water Supply**
- Building scores: [4, 5, 4] (equal weights)
- Water reliability: 'unreliable'
- Expected: `(4+5+4)/3 = 4.33 → round(4) = 4 → min(4, 3) = 3` (capped at 3)

**Test 8: Site Score - Floor Area Weighting**
- Building A: score=5, area=1000m²
- Building B: score=2, area=500m²
- Water reliability: 'reliable'
- Expected: `(5*1000 + 2*500)/(1000+500) = (5000+1000)/1500 = 4.0 → round(4) = 4`

**Test 9: Backward Compatibility - Old Record Load**
- Load existing record without `derived` fields
- Expected: No errors, derived scores computed and added on next save

**Test 10: Null Safety - Empty Buildings**
- Buildings: []
- Expected: Site score = `null` (no data to aggregate)

---

## Current Limitations (By Design - Phase 2)

### Detection Data Not in Database
The current database schema (`re_building_sprinklers` table) does not include detection/alarm data. The scoring currently assumes suppression-only:

```typescript
// Current implementation
buildingData = {
  suppression: { sprinklers: { rating: ... } },
  // detection_alarm: MISSING - would need separate table
}
```

**Impact**: Building scores are based solely on sprinkler ratings (100% weight), not the intended 70/30 split.

**Future Enhancement**: Add `re_building_detection` table to store detection data, then update scoring integration to include detection ratings.

### Equal Weighting Fallback
When floor area metadata is unavailable:
- Falls back to equal weighting (weight = 1 for all buildings)
- This is safe but less accurate than area weighting

**Mitigation**: Ensure RE-02 Construction module is completed before RE-06 Fire Protection to populate floor area data.

---

## What Phase 2 Does NOT Include (As Required)

❌ No UI changes or score displays
❌ No module outcome section
❌ No recommendations generation
❌ No workflow/approval changes
❌ No changes to RE-02 or other modules
❌ No layout modifications
❌ No navigation changes

---

## Next Steps (For Future Phases)

**Phase 3** could include:
- UI display of derived scores (badges, charts)
- Module outcome summary section
- Detection data capture (new database table)

**Phase 4** could include:
- Recommendation generation based on scores
- Score thresholds and alerts
- Historical score tracking

**Phase 5** could include:
- Cross-module score aggregation
- Portfolio-level roll-ups
- Scoring reports and analytics

---

## Summary

Phase 2 successfully implements:
- ✅ Pure, deterministic scoring functions
- ✅ Building-level fire protection scores (1-5)
- ✅ Site-level fire protection scores (1-5) with water supply capping
- ✅ Floor area weighted aggregation
- ✅ Automatic recomputation on data changes
- ✅ Debounced persistence to database
- ✅ Full null safety and backward compatibility
- ✅ Zero breaking changes

The derived scores are now automatically computed and stored in the database's `derived` JSONB fields, ready for use in future phases for UI display and recommendations.
