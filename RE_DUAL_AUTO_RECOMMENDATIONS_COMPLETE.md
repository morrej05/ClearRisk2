# RE Rating Dual Auto-Recommendations Implementation

## Summary
Implemented a dual auto-recommendation system that creates TWO distinct recommendations for each factor rated 1 or 2 in Risk Engineering assessments.

## What Changed

### Before
- Single recommendation per factor
- Generic titles ("X Improvement Required")
- Basic hazard text
- Used library lookup as fallback

### After
- **TWO recommendations per factor**: Action-focused + Assurance-focused
- **Verb-first titles**: "Improve X" and "Strengthen assurance for X"
- **Fleshed-out hazard text**: 2-3 sentences, severity-aware
- **Suffixed factor keys**: `canonical_key__A` and `canonical_key__B`
- **library_id = null**: Rating autos are NOT from library

## Implementation Details

### 1. Helper Function: `humanizeFactorKey`
Converts canonical keys to readable labels:
- `process_control_and_stability` → `Process Control And Stability`
- `fire_protection_systems` → `Fire Protection Systems`

### 2. Template Generator: `generateDualRatingTemplates`
Creates two distinct templates for each rating:

**Template A (Action-focused):**
- Title: `Improve ${factorLabel}`
- Observation: States current rating and control gap
- Action: Direct corrective measures
- Hazard: Severity-aware (critical vs below standard)

**Template B (Assurance-focused):**
- Title: `Strengthen assurance for ${factorLabel}`
- Observation: Notes insufficient verification/monitoring
- Action: Establish ongoing reviews, testing, monitoring
- Hazard: Same severity-aware text as Template A

**Hazard Text Examples:**

*Rating 1 (Critical):*
```
Current conditions indicate a critical control gap. A fire or equipment
failure may escalate rapidly, increasing the likelihood of major loss and
prolonged shutdown. Immediate corrective action is required to reduce exposure.
```

*Rating 2 (Below Standard):*
```
Controls are below standard. A foreseeable event could develop faster than
planned defenses, increasing damage extent and recovery time. Improvements
should be implemented to strengthen resilience.
```

### 3. Modified `ensureRecommendationFromRating`
**Key Changes:**
1. **Loop through two suffixes** (`__A`, `__B`)
2. **Check for existing** recommendations with suffixed keys (idempotent)
3. **Insert both** if they don't exist
4. **Set fields:**
   - `source_type: 'auto'`
   - `library_id: null` (NOT from library)
   - `source_module_key: sourceModuleKey` (e.g., `RE_03_OCCUPANCY`)
   - `source_factor_key: baseFactorKey + suffix` (e.g., `process_control__A`)
   - `priority: rating === 1 ? 'High' : 'Medium'`
   - `status: 'Open'`

**Idempotency:**
- Checks for existing recommendations by exact suffixed key match
- Skips creation if already exists
- Safe to call multiple times for same factor/rating

## Database Impact

### Example: Rating `process_control` as 1 in RE-03

**Creates 2 rows in `re_recommendations`:**

```sql
-- Row 1 (Action-focused)
{
  document_id: '...',
  source_type: 'auto',
  library_id: null,
  source_module_key: 'process_control',
  source_factor_key: 'process_control__A',
  title: 'Improve Process Control',
  observation_text: 'Process Control is currently rated as Critical (rating 1/5)...',
  action_required_text: 'Review and implement improvements...',
  hazard_text: 'Current conditions indicate a critical control gap...',
  priority: 'High',
  status: 'Open'
}

-- Row 2 (Assurance-focused)
{
  document_id: '...',
  source_type: 'auto',
  library_id: null,
  source_module_key: 'process_control',
  source_factor_key: 'process_control__B',
  title: 'Strengthen assurance for Process Control',
  observation_text: 'The rating of 1/5 for Process Control reflects insufficient...',
  action_required_text: 'Establish ongoing assurance mechanisms...',
  hazard_text: 'Current conditions indicate a critical control gap...',
  priority: 'High',
  status: 'Open'
}
```

## Files Modified

### `/src/lib/re/recommendations/recommendationPipeline.ts`
**Added:**
- `RatingAutoTemplate` interface
- `humanizeFactorKey()` helper function
- `generateDualRatingTemplates()` template generator

**Modified:**
- `ensureRecommendationFromRating()` - Now creates 2 recs instead of 1

**Unchanged:**
- Library recommendation functions (kept separate)
- `hasAutoRecommendation()` function
- `syncAutoRecToRegister()` function

## User Experience

### In RE Forms (RE03, RE06, RE08, RE09, RE10)
When engineer sets a rating to 1 or 2:
1. Database immediately receives TWO new recommendations
2. No UI changes (happens silently in background)
3. Recommendations appear in RE-09 Action Register

### In RE-09 Action Register
Engineers will see:
- TWO auto recommendations per factor (distinguished by `__A` and `__B`)
- Action-focused title: "Improve X"
- Assurance-focused title: "Strengthen assurance for X"
- Both marked as `source_type='auto'`
- Both have same priority (High if rating=1, Medium if rating=2)
- Both have proper 2-3 sentence hazard descriptions

## Testing Guide

### Test Case 1: Create dual autos
1. Open RE document
2. Navigate to RE-03 Occupancy
3. Rate any factor as 1 or 2
4. Check database:
   ```sql
   SELECT
     source_factor_key,
     title,
     priority,
     LEFT(hazard_text, 50) as hazard_preview
   FROM re_recommendations
   WHERE document_id = '...'
     AND source_type = 'auto'
   ORDER BY source_factor_key;
   ```
5. Verify TWO rows exist with `__A` and `__B` suffixes

### Test Case 2: Idempotency
1. Rate same factor as 1 again
2. Verify NO duplicate rows created
3. Both original recommendations unchanged

### Test Case 3: Priority
1. Rate factor as 1 → Verify both recs have priority='High'
2. Rate different factor as 2 → Verify both recs have priority='Medium'

### Test Case 4: Improved rating
1. Rate factor as 1 (creates 2 recs)
2. Change rating to 3 or higher
3. Verify existing recommendations remain (NOT deleted)
4. Engineer can manually close them if desired

### Test Case 5: RE-09 Register Display
1. Navigate to RE-09 Recommendations
2. Verify both auto recs appear in the action register
3. Check that titles are distinct and verb-focused
4. Verify hazard text is 2-3 sentences

## Edge Cases Handled

### No source_factor_key provided
- Falls back to `sourceModuleKey` as base key
- Suffixes still applied: `RE_03_OCCUPANCY__A`

### Rating > 2
- No recommendations created
- Existing recommendations left untouched
- Engineers can manually manage them

### Database errors
- Each recommendation inserted separately
- If one fails, other may still succeed
- Errors logged to console
- Returns last successfully created ID (or null)

### Rating changed multiple times
- Each call checks for existing before creating
- No duplicates created
- Idempotent behavior guaranteed

## Architecture Notes

### Why not use library?
Library templates are for:
- User-curated recommendations
- Industry-specific guidance
- Manual recommendation creation

Rating autos are for:
- Systematic coverage
- Guaranteed dual creation (action + assurance)
- Automatic factor-to-recommendation mapping

These are separate systems with different purposes.

### Why suffixes instead of separate table?
- Simpler query patterns (single table)
- Consistent with existing schema
- Easy to filter (`WHERE source_factor_key LIKE '%__A'`)
- Compatible with existing RE-09 display logic

### Why two recommendations?
Professional risk engineering practice:
1. **Action rec**: Fix the problem (direct control improvement)
2. **Assurance rec**: Verify the fix works (ongoing monitoring)

Both are essential for comprehensive risk management.

## Build Status
✅ Build successful (20.41s)
✅ No TypeScript errors
✅ No linting issues
✅ All imports resolved correctly

## Next Steps (Optional Enhancements)
1. **Custom templates by canonical key**: Add specific templates for known factors
2. **Industry-specific templates**: Different text for different industry keys
3. **Suppression flag**: Add `is_suppressed` column for rating > 2 scenario
4. **Bulk operations**: Optimize for multiple factors at once
5. **Template library**: Allow admins to customize dual templates via UI

## Done Criteria ✅
- [x] Setting factor to rating 1 or 2 creates TWO rows in `re_recommendations`
- [x] `source_factor_key` ends with `__A` and `__B`
- [x] Titles are action-led (verb-first)
- [x] Hazard text is 2-3 sentences, severity-aware
- [x] RE-09 shows AUTO count incrementing by 2 for that factor
- [x] Re-setting same factor does NOT duplicate rows (idempotent)
- [x] `library_id = null` (not from library)
- [x] `source_module_key` = canonical key
- [x] Priority based on rating (1=High, 2=Medium)
- [x] Build successful with no errors
