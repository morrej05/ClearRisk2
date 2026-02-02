# RE-03 Dynamic HRG Keys Implementation Complete

## Summary

RE-03 Occupancy module now dynamically renders rating panels based on the HRG (Hazard Risk Grading) configuration for the selected industry. All hard-coded canonical keys have been removed in favor of runtime lookup from the HRG Master Map.

## Changes Implemented

### 1. Removed Hard-Coded Constants

**Deleted:**
- `CANONICAL_KEY = 'process_control_and_stability'`
- `SPECIAL_HAZARDS_CANONICAL_KEYS = ['flammable_liquids_and_fire_risk', 'high_energy_materials_control', 'high_energy_process_equipment']`

**Reason:** These hard-coded keys don't match all industries. For example, `hospital_sprinklered` has 5 specific risk factors and doesn't use high energy keys.

### 2. Added Helper Function

**New Function:**
```typescript
function getIndustrySpecialHazardKeys(industryKey: string | null): string[] {
  if (!industryKey || !HRG_MASTER_MAP.industries[industryKey]) {
    return [];
  }

  const industry = HRG_MASTER_MAP.industries[industryKey];
  return Object.keys(industry.modules);
}
```

**Purpose:** Dynamically retrieves all canonical risk factor keys configured in HRG for the selected industry.

**Returns:**
- Empty array if no industry is selected
- All module keys from `HRG_MASTER_MAP.industries[industryKey].modules`

### 3. Updated Rating Panel Rendering

**Before:**
- Single rating panel at top using hard-coded `CANONICAL_KEY`
- Section with 3 hard-coded special hazard panels

**After:**
- All rating panels rendered dynamically based on `industrySpecialHazardKeys`
- Number of panels varies by industry
- Panels only render when `industrySpecialHazardKeys.length > 0`

**Logic:**
```typescript
const industrySpecialHazardKeys = getIndustrySpecialHazardKeys(industryKey);

// Later in render:
{industrySpecialHazardKeys.length > 0 && (
  <div className="mb-6 space-y-6">
    {industrySpecialHazardKeys.map((canonicalKey) => {
      const rating = getRating(riskEngData, canonicalKey);
      const hrgConfig = getHrgConfig(industryKey, canonicalKey);
      return (
        <ReRatingPanel
          key={canonicalKey}
          canonicalKey={canonicalKey}
          industryKey={industryKey}
          rating={rating}
          onChangeRating={(newRating) => handleRatingChange(canonicalKey, newRating)}
          helpText={hrgConfig.helpText}
          weight={hrgConfig.weight}
        />
      );
    })}
  </div>
)}
```

### 4. No Industry Selected Message

**Added:**
When no industry is selected (`!industryKey`), displays an amber alert:

```
⚠️ No Industry Selected
Industry-specific risk factor rating panels will appear once you select
an industry classification in RE-01 Document Control.
```

**Behavior:**
- Prevents rendering empty panels
- Clear user guidance on next steps
- Consistent with existing amber alerts in the form

### 5. Updated Section Title

**Changed:** "Special Hazards & High-Risk Processes - Rating Panels"
**To:** "Industry-Specific Risk Factors - Rating Panels"

**Reason:** More accurately describes that these are industry-specific, not generic hazards.

## Industry-Specific Behavior Examples

### Hospital (Sprinklered)
**Industry Key:** `hospital_sprinklered`
**Rating Panels Rendered (5):**
1. emergency_response_and_bcp
2. electrical_and_utilities_reliability
3. natural_hazard_exposure_and_controls
4. process_control_and_stability
5. flammable_liquids_and_fire_risk

**Not Rendered:**
- high_energy_materials_control
- high_energy_process_equipment
- Any other keys not in hospital configuration

### Chemical Batch Processing
**Industry Key:** `chemical_batch_processing`
**Rating Panels Rendered (10):**
1. process_control_and_stability
2. safety_and_control_systems
3. natural_hazard_exposure_and_controls
4. electrical_and_utilities_reliability
5. process_safety_management
6. flammable_liquids_and_fire_risk
7. critical_equipment_reliability
8. high_energy_materials_control
9. high_energy_process_equipment
10. emergency_response_and_bcp

### No Industry Selected
**Industry Key:** `null` or `undefined`
**Rating Panels Rendered:** 0 (none)
**Message Displayed:** "No Industry Selected" amber alert

## Safety & Error Prevention

### Already Safe (from v1 implementation):
- ✅ All Supabase queries use `.maybeSingle()` instead of `.single()`
- ✅ Optional chaining (`?.`) for all nested data access
- ✅ Nullish coalescing (`??`) for safe defaults
- ✅ `Array.isArray()` validation before array operations

### Additional Safety:
- ✅ Empty array returned when industry not found
- ✅ No panels render when array is empty
- ✅ Each panel still gets valid `hrgConfig` from `getHrgConfig()`
- ✅ No "configuration not available" messages (keys only exist if configured)

## Data Structure

**No Changes to Data Persistence:**
- Still uses `module_instances.data.occupancy`
- Rating values still stored in `RISK_ENGINEERING` module
- No schema migrations required

## Section Order (Unchanged)

1. ✅ Process Overview (large textarea)
2. ✅ Industry-Specific Special Hazards & High-Risk Processes (free text + add recommendation)
3. ✅ **Industry-Specific Risk Factors - Rating Panels** ⬅️ CHANGED: Now dynamic
4. ✅ Generic Special Hazards (dropdown-driven hazard selection)
5. ✅ Outcome Panel
6. ✅ Module Actions ("Add Recommendation")

## Testing Checklist

### Core Functionality
- [ ] RE-03 loads without crashing when no industry selected
- [ ] "No Industry Selected" message displays when `industryKey` is null
- [ ] Rating panels appear after selecting industry in RE-01
- [ ] Number of rating panels matches HRG configuration for selected industry

### Industry-Specific Tests
- [ ] Hospital (sprinklered): Shows exactly 5 rating panels
- [ ] Chemical batch processing: Shows exactly 10 rating panels
- [ ] No high energy panels appear for hospital
- [ ] High energy panels appear for chemical processing

### Data Persistence
- [ ] Rating changes save to RISK_ENGINEERING module
- [ ] Ratings persist after page reload
- [ ] Switching industries updates panel list immediately

### Error Prevention
- [ ] No 406/PGRST116 errors on new documents
- [ ] No crashes when RISK_ENGINEERING module missing
- [ ] No "configuration not available" messages
- [ ] Empty array handled gracefully (no errors)

## Build Status

✅ Build passes successfully (no TypeScript errors)

## Implementation Files Modified

1. `src/components/modules/forms/RE03OccupancyForm.tsx`
   - Added `HRG_MASTER_MAP` import
   - Added `getIndustrySpecialHazardKeys()` helper function
   - Removed hard-coded `CANONICAL_KEY` and `SPECIAL_HAZARDS_CANONICAL_KEYS`
   - Updated rating panel rendering logic
   - Added "No Industry Selected" message
   - Updated section title

## Backward Compatibility

✅ **Fully Backward Compatible**
- Existing data unaffected
- Works with all industry configurations
- No breaking changes to API or schema
- Ratings from old hard-coded keys remain accessible

## Next Steps

### Testing Priority
1. Test with `hospital_sprinklered` industry to verify only 5 panels appear
2. Test with `chemical_batch_processing` to verify all 10 panels appear
3. Verify no crashes when industry changes
4. Confirm help text is industry-specific for each panel

### Future Enhancements (Optional)
- Display industry name at top of rating section
- Show total number of risk factors for selected industry
- Add link to change industry from RE-03 page
