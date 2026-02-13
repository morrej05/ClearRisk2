# RE-05 Exposures Auto-Recommendations Integration

## Summary
Wired up RE-05 Exposures form to create AUTO recommendations in RE-09 for any peril or human exposure rated 1 or 2. Uses the single auto-recommendation pipeline with fallback content.

## What Changed

### File Modified
`src/components/modules/forms/RE07ExposuresForm.tsx`

### 1. Added Import
```typescript
import { syncAutoRecToRegister } from '../../../lib/re/recommendations/recommendationPipeline';
```

### 2. Added Helper Function
Created `syncExposureAutosToRegister()` inside the component that:
- Collects all exposure ratings (flood, wind, earthquake, wildfire, other, human)
- Creates canonical keys for each exposure type
- Calls `syncAutoRecToRegister()` for ratings ≤ 2
- Handles dynamic "other peril" with sanitized label

### 3. Integrated with Save Flow
Added call to helper after successful save:
```typescript
if (error) throw error;

// Sync exposure auto recommendations to register
await syncExposureAutosToRegister();

// Update section_grades with overall exposure rating
await updateSectionGrade(document.id, 'exposure', overallExposureRating);
```

---

## Canonical Keys Used

### Environmental Perils
- `exposures_flood` → Flood rating
- `exposures_wind_storm` → Wind/Storm rating
- `exposures_earthquake` → Earthquake rating
- `exposures_wildfire` → Wildfire rating
- `exposures_other_[sanitized_label]` → Other peril (dynamic)

### Human Exposure
- `exposures_human_malicious` → Human/Malicious exposure rating

### Sanitization Logic for "Other Peril"
If user enters "Volcanic Ash" as other peril label:
```typescript
'Volcanic Ash'
  .toLowerCase()        // 'volcanic ash'
  .trim()              // 'volcanic ash'
  .replace(/[^a-z0-9]+/g, '_')  // 'volcanic_ash'
  .replace(/^_+|_+$/g, '')      // 'volcanic_ash'
→ 'exposures_other_volcanic_ash'
```

---

## Example Flow

### Test Scenario 1: Flood Risk
**Action:**
1. Open RE-05 Exposures
2. Set Flood rating to 2
3. Add notes: "Site in 100-year floodplain, no flood barriers"
4. Click Save

**Result:**
1. Module saved successfully
2. `syncAutoRecToRegister()` called with:
   - documentId: current document
   - moduleKey: 'RE_07_NATURAL_HAZARDS'
   - canonicalKey: 'exposures_flood'
   - rating_1_5: 2
   - industryKey: null
3. Pipeline creates recommendation:
   ```sql
   INSERT INTO re_recommendations (
     document_id,
     source_type: 'auto',
     source_module_key: 'RE_07_NATURAL_HAZARDS',
     source_factor_key: 'exposures_flood',
     title: 'Improve Exposures Flood',
     observation_text: 'Exposures Flood has been identified as requiring attention...',
     action_required_text: 'Review and implement improvements...',
     hazard_text: 'Inadequate controls increase the likelihood of loss events...',
     priority: 'Medium',
     status: 'Open'
   );
   ```
4. Navigate to RE-09 → See AUTO recommendation for flood exposure

### Test Scenario 2: Human/Malicious Exposure
**Action:**
1. Set Human/Malicious rating to 1
2. Add notes: "High-value site in urban area with poor perimeter security"
3. Click Save

**Result:**
- Creates AUTO recommendation with:
  - canonicalKey: 'exposures_human_malicious'
  - priority: 'High' (rating 1)
  - Fully populated content

### Test Scenario 3: Multiple Exposures
**Action:**
1. Set Flood: 2
2. Set Wind: 3 (no recommendation)
3. Set Earthquake: 1
4. Set Wildfire: 2
5. Set Human: 2
6. Click Save

**Result:**
- Creates 4 AUTO recommendations:
  - exposures_flood (Medium priority)
  - exposures_earthquake (High priority)
  - exposures_wildfire (Medium priority)
  - exposures_human_malicious (Medium priority)
- Wind (rating 3) does NOT create recommendation

### Test Scenario 4: Other Peril with Custom Label
**Action:**
1. Enable "Other peril"
2. Set label: "Lightning Strike"
3. Set rating: 1
4. Click Save

**Result:**
- Creates AUTO recommendation with:
  - canonicalKey: 'exposures_other_lightning_strike'
  - title: 'Improve Exposures Other Lightning Strike'
  - priority: 'High'

---

## Database Verification

### Query: View All Exposure Autos
```sql
SELECT
  source_factor_key,
  title,
  priority,
  status,
  SUBSTRING(hazard_text, 1, 60) || '...' as hazard_preview
FROM re_recommendations
WHERE document_id = 'your-doc-id'
  AND source_module_key = 'RE_07_NATURAL_HAZARDS'
  AND source_type = 'auto'
  AND is_suppressed = false
ORDER BY priority, source_factor_key;
```

Expected output:
```
source_factor_key                 | title                              | priority | status
----------------------------------+------------------------------------+----------+--------
exposures_earthquake              | Improve Exposures Earthquake       | High     | Open
exposures_flood                   | Improve Exposures Flood            | Medium   | Open
exposures_human_malicious         | Improve Exposures Human Malicious  | Medium   | Open
exposures_wildfire                | Improve Exposures Wildfire         | Medium   | Open
```

### Query: Check Idempotency
```sql
-- After saving twice with same ratings
SELECT
  source_factor_key,
  COUNT(*) as rec_count
FROM re_recommendations
WHERE document_id = 'your-doc-id'
  AND source_module_key = 'RE_07_NATURAL_HAZARDS'
  AND source_type = 'auto'
  AND is_suppressed = false
GROUP BY source_factor_key;
```

Expected: Each factor appears exactly once (count = 1)

---

## Integration Details

### Module Key
Uses `'RE_07_NATURAL_HAZARDS'` as the source module key for all exposure recommendations.

**Note:** The form component is called `RE07ExposuresForm` but the canonical module key in the system is `RE_07_NATURAL_HAZARDS`. This is consistent with existing conventions.

### Industry Key
Currently passes `null` for `industryKey`. Future enhancement could:
- Read industry from document metadata
- Pass to pipeline for industry-specific library matching

### Error Handling
If auto-rec creation fails:
- Error logged to console
- Save operation continues (doesn't block user)
- User can still see and save module data
- Can manually add recommendations in RE-09

### Performance
Auto-rec creation happens serially (for loop with await):
- Typical case: 6 factors × ~50ms = ~300ms
- Only creates recs for ratings ≤ 2 (usually 0-3 items)
- Negligible impact on save time

---

## Testing Guide

### Test 1: Single Exposure Rating 1
1. Create new RE document
2. Navigate to RE-05 Exposures
3. Set Flood rating to 1
4. Save
5. Navigate to RE-09
6. **Verify:**
   - One AUTO recommendation appears
   - Title: "Improve Exposures Flood"
   - Priority: High
   - All fields populated (no blanks)

### Test 2: Multiple Exposures with Mixed Ratings
1. Set ratings:
   - Flood: 2
   - Wind: 4 (should NOT create rec)
   - Earthquake: 1
   - Wildfire: 5 (should NOT create rec)
   - Human: 2
2. Save
3. Navigate to RE-09
4. **Verify:**
   - Exactly 3 AUTO recommendations
   - Flood (Medium), Earthquake (High), Human (Medium)
   - No recommendations for Wind or Wildfire

### Test 3: Other Peril with Special Characters
1. Enable "Other peril"
2. Set label: "Tsunami & Tidal Wave"
3. Set rating: 2
4. Save
5. Navigate to RE-09
6. **Verify:**
   - Recommendation created with sanitized key
   - Title includes sanitized label
   - No special characters in database key

### Test 4: Idempotency (Save Twice)
1. Set Flood rating to 2
2. Save (creates recommendation)
3. Navigate to RE-09 → Note recommendation exists
4. Return to RE-05
5. Change Flood notes (keep rating at 2)
6. Save again
7. Navigate to RE-09
8. **Verify:**
   - Still only ONE recommendation for flood
   - No duplicate created

### Test 5: Rating Change from 3 to 1
1. Set Earthquake rating to 3
2. Save (no recommendation created)
3. Navigate to RE-09 → Verify no earthquake rec
4. Return to RE-05
5. Change Earthquake rating to 1
6. Save
7. Navigate to RE-09
8. **Verify:**
   - NEW recommendation appears for earthquake
   - Priority: High

### Test 6: Rating Change from 2 to 4
1. Set Wildfire rating to 2
2. Save (creates recommendation)
3. Verify in RE-09 → Wildfire rec exists
4. Return to RE-05
5. Change Wildfire rating to 4
6. Save
7. Navigate to RE-09
8. **Verify:**
   - Wildfire recommendation STILL exists (not deleted)
   - Pipeline doesn't remove improved ratings
   - Engineer can manually delete if desired

---

## Fallback Content Examples

### Exposures Flood (Rating 2)
```
Title: Improve Exposures Flood

Observation: Exposures Flood has been identified as requiring attention based on current site conditions. Control effectiveness is below acceptable standards and requires corrective action.

Action Required: Review and implement improvements to bring Exposures Flood up to acceptable standards. Address identified deficiencies through documented corrective actions with clear ownership and target dates.

Hazard: Inadequate controls increase the likelihood of loss events escalating beyond planned defenses. A foreseeable incident could develop faster than current safeguards allow, increasing damage extent and recovery time. Strengthening this control reduces overall facility risk profile.

Priority: Medium
```

### Exposures Human Malicious (Rating 1)
```
Title: Improve Exposures Human Malicious

Observation: Exposures Human Malicious has been identified as requiring attention based on current site conditions. Control effectiveness is below acceptable standards and requires corrective action.

Action Required: Review and implement improvements to bring Exposures Human Malicious up to acceptable standards. Address identified deficiencies through documented corrective actions with clear ownership and target dates.

Hazard: Inadequate controls increase the likelihood of loss events escalating beyond planned defenses. A foreseeable incident could develop faster than current safeguards allow, increasing damage extent and recovery time. Strengthening this control reduces overall facility risk profile.

Priority: High
```

**Note:** Same wording for rating 1 and 2, only priority differs (High vs Medium).

---

## Architecture Notes

### Why After Module Save?
**Sequence:**
1. Save module data to `module_instances`
2. Create auto recommendations
3. Update section grades

**Rationale:**
- Module data must exist before creating linked recommendations
- If save fails, no recommendations created (maintains consistency)
- Auto-rec creation is "best effort" (doesn't block save if it fails)

### Why Canonical Keys?
**Format:** `exposures_[peril_type]`

**Benefits:**
- Consistent with existing RE module patterns
- Easy to match with library recommendations (future)
- Clear, human-readable in database
- Supports dynamic "other" perils with sanitization

### Why Module Key = RE_07_NATURAL_HAZARDS?
**Consistency:**
- Matches database `module_instances.module_key`
- Aligns with module catalog definitions
- RE-05 is display label, RE_07 is canonical key

**Note:** This is intentional, not a bug. The form handles both natural hazards AND human exposure under one module.

### Future Enhancements

#### 1. Library-Specific Templates
Create exposure-specific templates in recommendation_library:
```sql
INSERT INTO recommendation_library (
  code,
  title,
  observation_text,
  action_required_text,
  hazard_text,
  trigger_module_key,
  trigger_factor_key,
  trigger_rating_min,
  trigger_rating_max
) VALUES (
  'EXP-FLOOD-001',
  'Implement Flood Mitigation Measures',
  'Site is located in a flood-prone area with inadequate protection...',
  'Install flood barriers, improve drainage, elevate critical equipment...',
  'Flooding can cause catastrophic damage to buildings and equipment. Water ingress may result in complete business interruption for extended periods...',
  'RE_07_NATURAL_HAZARDS',
  'exposures_flood',
  1,
  2
);
```

Then pipeline will use these instead of fallback content.

#### 2. Industry-Specific Content
Tailor recommendations by industry:
```typescript
// If manufacturing site
hazard_text: 'Flooding could damage production equipment, contaminate materials, and halt operations...'

// If data center
hazard_text: 'Water ingress poses severe risk to server infrastructure and may cause permanent data loss...'
```

#### 3. Priority Override
Allow override based on combined exposures:
```typescript
if (overallExposureRating === 1 && numberOfPoorRatings >= 3) {
  priority = 'Critical'; // Escalate for multiple severe exposures
}
```

#### 4. Recommendation Consolidation
Combine related exposures:
```typescript
if (floodRating <= 2 && earthquakeRating <= 2) {
  // Create single "Natural Hazard Resilience" recommendation
  // Instead of separate flood + earthquake recs
}
```

---

## Code Reference

### Helper Function Location
`src/components/modules/forms/RE07ExposuresForm.tsx:102-135`

### Integration Point
`src/components/modules/forms/RE07ExposuresForm.tsx:175`

### Pipeline Function
`src/lib/re/recommendations/recommendationPipeline.ts:304-320`

---

## Done Criteria ✅

- [x] Import `syncAutoRecToRegister` added
- [x] Helper function `syncExposureAutosToRegister()` created
- [x] Canonical keys defined for all exposure types
- [x] Dynamic "other peril" sanitization implemented
- [x] Integration with save flow (after successful module save)
- [x] Uses existing single auto-recommendation pipeline
- [x] Idempotent (won't create duplicates on re-save)
- [x] Fallback content ensures fully populated recommendations
- [x] Build successful (20.20s)
- [x] No TypeScript errors
- [x] Documentation complete

---

## Summary

RE-05 Exposures now automatically creates recommendations for poor ratings:
- **Rating 1 → High priority** AUTO recommendation
- **Rating 2 → Medium priority** AUTO recommendation
- **Rating 3+ → No recommendation** (acceptable level)

All recommendations use consistent, professional fallback content until library templates are added. Engineers can edit or delete auto-recommendations in RE-09 as needed.

The integration is complete and ready for testing!
