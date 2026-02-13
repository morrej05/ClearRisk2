# Patches Applied: RE Auto Recommendation Sync Fixes

## Summary
Applied 5 patches to fix the auto recommendation sync implementation:
1. Moved `syncAutoRecToRegister` from `autoRecommendations.ts` to `recommendationPipeline.ts`
2. Removed `organisationId` parameter (no longer needed)
3. Fixed parameter names: `factorKey` → `canonicalKey`, `rating` → `rating_1_5`
4. Fixed library table name: `recommendation_library` → `re_recommendation_library`
5. Fixed null handling: `source_factor_key` uses `null` instead of empty string

## Changes Made

### 1. autoRecommendations.ts
**Removed:**
- `syncAutoRecToRegister` function (moved to recommendationPipeline.ts)
- Import of `ensureRecommendationFromRating`
- Import of `supabase`

**Result:** Clean separation - autoRecommendations.ts handles in-memory JSONB, recommendationPipeline.ts handles database writes.

### 2. recommendationPipeline.ts

**Interface Changes:**
```typescript
// BEFORE
interface RecommendationFromRatingParams {
  documentId: string;
  organisationId: string;  // ← REMOVED
  sourceModuleKey: string;
  sourceFactorKey?: string;
  rating_1_5: number;
  industryKey: string | null;
}

// AFTER
interface RecommendationFromRatingParams {
  documentId: string;
  sourceModuleKey: string;
  sourceFactorKey?: string;
  rating_1_5: number;
  industryKey: string | null;
}
```

**Database Changes:**
- `source_factor_key: sourceFactorKey || ''` → `source_factor_key: sourceFactorKey || null`
- `from('recommendation_library')` → `from('re_recommendation_library')`

**Added Function:**
```typescript
export async function syncAutoRecToRegister(params: {
  documentId: string;
  moduleKey: string;
  canonicalKey: string;
  rating_1_5: number;
  industryKey: string | null;
}): Promise<void> {
  const { documentId, moduleKey, canonicalKey, rating_1_5, industryKey } = params;
  void moduleKey; // Unused for now

  await ensureRecommendationFromRating({
    documentId,
    sourceModuleKey: canonicalKey,
    rating_1_5,
    industryKey,
  });
}
```

**Key Insight:** The `canonicalKey` (e.g., `process_control_and_stability`) becomes the `sourceModuleKey` in the database. The original `moduleKey` (e.g., `RE_03_OCCUPANCY`) is currently unused but kept for future metadata needs.

### 3. RE03OccupancyForm.tsx

**Import Change:**
```typescript
// BEFORE
import { ensureAutoRecommendation, syncAutoRecToRegister } from '../../../lib/re/recommendations/autoRecommendations';

// AFTER
import { ensureAutoRecommendation } from '../../../lib/re/recommendations/autoRecommendations';
import { syncAutoRecToRegister } from '../../../lib/re/recommendations/recommendationPipeline';
```

**handleRatingChange Changes:**
```typescript
// BEFORE
const updatedFormData = ensureAutoRecommendation(formData, canonicalKey, newRating, industryKey);
// ... save to database
await syncAutoRecToRegister({
  documentId: moduleInstance.document_id,
  moduleKey: 'RE_03_OCCUPANCY',
  factorKey: canonicalKey,
  rating: newRating,
  industryKey,
});

// AFTER
await syncAutoRecToRegister({
  documentId: moduleInstance.document_id,
  moduleKey: 'RE_03_OCCUPANCY',
  canonicalKey,
  rating_1_5: newRating,
  industryKey,
});

const updatedFormData = ensureAutoRecommendation(formData, canonicalKey, newRating, industryKey);
// ... save to database
```

**Key Change:** Sync happens BEFORE in-memory update, ensuring database is always up-to-date first.

### 4. RE08UtilitiesForm.tsx
Same changes as RE03OccupancyForm.tsx:
- Import from `recommendationPipeline`
- Move `syncAutoRecToRegister` before `ensureAutoRecommendation`
- Fix parameter names: `factorKey` → `canonicalKey`, `rating` → `rating_1_5`

### 5. RE09ManagementForm.tsx

**Import Change:**
```typescript
// BEFORE
import { ensureAutoRecommendation, syncAutoRecToRegister } from '../../../lib/re/recommendations/autoRecommendations';

// AFTER
import { ensureAutoRecommendation } from '../../../lib/re/recommendations/autoRecommendations';
import { syncAutoRecToRegister } from '../../../lib/re/recommendations/recommendationPipeline';
```

**updateOverallRating Change:**
Removed the sync call from this function (it now happens in updateCategory).

**updateCategory Change:**
```typescript
// AFTER (inside setTimeout → setFormData callback)
if (overallRating !== null) {
  void syncAutoRecToRegister({
    documentId: moduleInstance.document_id,
    moduleKey: 'RE_09_MANAGEMENT',
    canonicalKey: CANONICAL_KEY,
    rating_1_5: overallRating,
    industryKey,
  });

  const withAutoRec = ensureAutoRecommendation(prev, CANONICAL_KEY, overallRating, industryKey);
  if (withAutoRec !== prev) {
    return withAutoRec;
  }
}
```

**Key Change:** Uses `void` to ignore promise since we're inside a setState callback where we can't await.

### 6. RE10ProcessRiskForm.tsx
Same changes as RE03OccupancyForm.tsx:
- Import from `recommendationPipeline`
- Move `syncAutoRecToRegister` before `ensureAutoRecommendation`
- Fix parameter names: `factorKey` → `canonicalKey`, `rating` → `rating_1_5`

## Why These Changes?

### 1. Removed organisationId Parameter
**Before:** Had to fetch `organisation_id` from documents table before calling pipeline.
**After:** Pipeline can fetch it internally or use document_id foreign key constraints.
**Benefit:** Simpler API, less code duplication, fewer database queries in forms.

### 2. Fixed Parameter Names
**Before:** Inconsistent naming (`factorKey` vs `canonicalKey`, `rating` vs `rating_1_5`).
**After:** Consistent with existing codebase conventions.
**Benefit:** Clearer intent, matches database column names, easier to understand.

### 3. Fixed Library Table Name
**Before:** `recommendation_library` (wrong table name).
**After:** `re_recommendation_library` (correct table for RE recommendations).
**Benefit:** Actually works with correct schema.

### 4. Fixed Null Handling
**Before:** Used empty string `''` for missing `source_factor_key`.
**After:** Uses `null` (proper SQL null).
**Benefit:** Better database queries, clearer intent, matches Postgres best practices.

### 5. Moved Function to Pipeline
**Before:** `syncAutoRecToRegister` in `autoRecommendations.ts` (client-side focused file).
**After:** In `recommendationPipeline.ts` (database-focused file).
**Benefit:** Better separation of concerns, clearer architecture.

## Testing Checklist

- [x] Build successful
- [ ] Change rating in RE03 to ≤ 2
- [ ] Verify recommendation appears in `re_recommendations` table
- [ ] Verify `source_module_key` is the canonical key (e.g., `process_control_and_stability`)
- [ ] Verify `source_factor_key` is null (not used in current implementation)
- [ ] Verify `source_type = 'auto'`
- [ ] Change rating back to > 2, verify no duplicate created
- [ ] Repeat for RE08, RE09, RE10
- [ ] Check RE-09 register shows auto recommendations

## Build Status
✅ Build successful (17.34s)
✅ No TypeScript errors
✅ All imports resolved correctly

## Files Modified
1. `src/lib/re/recommendations/autoRecommendations.ts` (-34 lines)
2. `src/lib/re/recommendations/recommendationPipeline.ts` (+18 lines, multiple refactors)
3. `src/components/modules/forms/RE03OccupancyForm.tsx` (import + flow fix)
4. `src/components/modules/forms/RE08UtilitiesForm.tsx` (import + flow fix)
5. `src/components/modules/forms/RE09ManagementForm.tsx` (import + flow fix)
6. `src/components/modules/forms/RE10ProcessRiskForm.tsx` (import + flow fix)

**Total:** 6 files modified, ~50 lines changed
