# RE Auto Recommendations → re_recommendations Table Sync

## Goal
When an RE form rating changes and triggers auto recommendations, also write those recommendations to the `re_recommendations` table so the RE-09 register shows AUTO counts and rows.

## Problem
Previously, auto recommendations were only stored in the module instance's JSONB `data` field. The RE-09 Recommendations UI couldn't see these AUTO recommendations because it queries the `re_recommendations` table, not the JSONB data.

## Solution
Added a thin sync helper that writes auto recommendations to both:
1. **Module instance data** (existing behavior via `ensureAutoRecommendation`)
2. **re_recommendations table** (new behavior via `syncAutoRecToRegister`)

### Architecture

```
User changes rating in RE form
  ↓
handleRatingChange() called
  ↓
1. Update RISK_ENGINEERING module (ratings)
2. ensureAutoRecommendation() (in-memory JSONB)
3. syncAutoRecToRegister() (database table) ← NEW
  ↓
RE-09 register now shows AUTO recommendations
```

## Implementation

### 1. Added Sync Helper (`autoRecommendations.ts`)

**Location:** `src/lib/re/recommendations/autoRecommendations.ts`

**New function:**
```typescript
export async function syncAutoRecToRegister(args: {
  documentId: string;
  moduleKey: string;
  factorKey: string;
  rating: any;
  industryKey?: string | null;
}) {
  try {
    // Fetch organisationId from document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('organisation_id')
      .eq('id', args.documentId)
      .maybeSingle();

    if (docError || !doc) {
      console.error('[syncAutoRecToRegister] Failed to fetch document:', docError);
      return;
    }

    // Call existing pipeline to write to re_recommendations
    await ensureRecommendationFromRating({
      documentId: args.documentId,
      organisationId: doc.organisation_id,
      sourceModuleKey: args.moduleKey,
      sourceFactorKey: args.factorKey,
      rating_1_5: args.rating,
      industryKey: args.industryKey ?? null,
    });
  } catch (err) {
    console.error('[syncAutoRecToRegister] Error:', err);
  }
}
```

**Key design decisions:**
- Fetches `organisation_id` from documents table (required by pipeline)
- Calls existing `ensureRecommendationFromRating` function (no logic duplication)
- Gracefully handles errors (doesn't break rating change flow)
- Idempotent (safe to call multiple times)

### 2. Updated Forms to Call Sync Helper

#### RE03 Occupancy Form
**File:** `src/components/modules/forms/RE03OccupancyForm.tsx`

**Changes:**
```typescript
// Import added
import { ensureAutoRecommendation, syncAutoRecToRegister } from '...';

// In handleRatingChange, after ensureAutoRecommendation:
await syncAutoRecToRegister({
  documentId: moduleInstance.document_id,
  moduleKey: 'RE_03_OCCUPANCY',
  factorKey: canonicalKey,
  rating: newRating,
  industryKey,
});
```

#### RE08 Utilities Form
**File:** `src/components/modules/forms/RE08UtilitiesForm.tsx`

**Changes:**
```typescript
// Same pattern as RE03
await syncAutoRecToRegister({
  documentId: moduleInstance.document_id,
  moduleKey: 'RE_08_UTILITIES',
  factorKey: canonicalKey,
  rating: newRating,
  industryKey,
});
```

#### RE09 Management Form
**File:** `src/components/modules/forms/RE09ManagementForm.tsx`

**Changes:**
```typescript
// In updateOverallRating function
await syncAutoRecToRegister({
  documentId: moduleInstance.document_id,
  moduleKey: 'RE_09_MANAGEMENT',
  factorKey: CANONICAL_KEY,
  rating: overallRating,
  industryKey,
});
```

**Note:** RE09 uses a different pattern (overall rating from categories), so sync is in `updateOverallRating` instead of `handleRatingChange`.

#### RE10 Process Risk Form
**File:** `src/components/modules/forms/RE10ProcessRiskForm.tsx`

**Changes:**
```typescript
// Same pattern as RE03
await syncAutoRecToRegister({
  documentId: moduleInstance.document_id,
  moduleKey: 'RE_10_PROCESS_RISK',
  factorKey: canonicalKey,
  rating: newRating,
  industryKey,
});
```

## Database Integration

The sync helper uses the existing `ensureRecommendationFromRating` pipeline which:

1. **Checks rating threshold:** Only creates recommendations for ratings ≤ 2
2. **Idempotent:** Checks for existing auto recommendation before creating
3. **Library matching:** Looks up recommendation templates from `recommendation_library`
4. **Fallback:** Creates basic recommendation if no library template found
5. **Proper fields:** Sets `source_type='auto'`, `source_module_key`, `source_factor_key`

### re_recommendations Table Schema

```sql
CREATE TABLE re_recommendations (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL,
  organisation_id UUID NOT NULL,
  source_type TEXT, -- 'auto' | 'manual'
  source_module_key TEXT, -- e.g. 'RE_03_OCCUPANCY'
  source_factor_key TEXT, -- e.g. 'process_control_and_stability'
  library_id UUID, -- Optional reference to template
  title TEXT,
  observation_text TEXT,
  action_required_text TEXT,
  hazard_text TEXT,
  priority TEXT, -- 'High' | 'Medium' | 'Low'
  status TEXT, -- 'Open' | 'Complete' | etc.
  photos JSONB,
  ...
);
```

## Benefits

### 1. Unified Recommendation View
RE-09 register now shows both AUTO and MANUAL recommendations from same table.

### 2. Better Visibility
Users can see which factors triggered auto recommendations without diving into JSONB data.

### 3. Action Tracking
AUTO recommendations can be tracked, assigned, and managed like manual ones.

### 4. No Duplication
Uses existing pipeline logic, doesn't duplicate recommendation creation code.

### 5. Backward Compatible
Doesn't break existing in-memory recommendation behavior, just adds database persistence.

## Testing Checklist

- [ ] Change rating in RE03 Occupancy to ≤ 2
- [ ] Verify auto recommendation appears in RE-09 register
- [ ] Change rating back to > 2
- [ ] Verify recommendation doesn't duplicate
- [ ] Repeat for RE08 Utilities
- [ ] Repeat for RE09 Management (category ratings)
- [ ] Repeat for RE10 Process Risk
- [ ] Verify `source_type='auto'` in database
- [ ] Verify `source_module_key` and `source_factor_key` are correct
- [ ] Check error handling (network failure, missing document)
- [ ] Verify no performance impact on rating changes

## Files Modified

**1 file added functionality:**
- `src/lib/re/recommendations/autoRecommendations.ts` (+34 lines)

**4 forms updated:**
- `src/components/modules/forms/RE03OccupancyForm.tsx`
- `src/components/modules/forms/RE08UtilitiesForm.tsx`
- `src/components/modules/forms/RE09ManagementForm.tsx`
- `src/components/modules/forms/RE10ProcessRiskForm.tsx`

**Total additions:** ~50 lines
**Build status:** ✅ Successful

## User Impact

### Before
```
User changes rating to "Poor" in RE03
  → Auto recommendation created in JSONB
  → RE-09 register shows: "0 AUTO recommendations"
```

### After
```
User changes rating to "Poor" in RE03
  → Auto recommendation created in JSONB
  → Auto recommendation written to re_recommendations table
  → RE-09 register shows: "1 AUTO recommendation"
  → Click to see details, assign owner, track status
```

## Future Enhancements

1. **Bulk sync:** Add function to sync all existing JSONB recommendations to table
2. **Sync on load:** Ensure recommendations are synced when opening RE-09
3. **Status updates:** Allow users to mark AUTO recommendations as complete
4. **Filtering:** Add filter in RE-09 to show only AUTO or only MANUAL
5. **Source navigation:** Link from recommendation back to source module/factor

## Notes

- Sync is **asynchronous** and doesn't block the UI
- Errors are **logged** but don't prevent rating changes
- Function is **idempotent** (safe to call multiple times)
- Uses existing **pipeline logic** (no new recommendation rules)
- **No changes** to recommendation library UI
- **No changes** to RE-09 recommendations UI beyond what's required to see autos
