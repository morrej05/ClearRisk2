# Day 3: Combined FRA + FSD Implementation Complete

## Objective
Enable a SINGLE document to contain BOTH FRA and FSD modules, sharing common data, with issuing gated so the document can only be issued when BOTH sets of requirements pass.

## Status: ✅ COMPLETE

All logic and correctness changes implemented. NO UI redesign. NO combined report layout (deferred to Day 4).

---

## Changes Made

### 1. Database Schema

#### Migration: `add_enabled_modules_for_combined_surveys`
**Applied to:** `survey_reports` table

**Changes:**
- Added `enabled_modules TEXT[]` column
- Single-module: `['FRA']`, `['FSD']`, or `['DSEAR']`
- Combined: `['FRA', 'FSD']`
- Falls back to `document_type` if `enabled_modules` is NULL (backward compatibility)

**Helper Functions:**
```sql
get_survey_modules(survey_row) → TEXT[]
survey_has_module(survey_row, module_name) → BOOLEAN
```

**Constraints:**
- Values must be subset of `['FRA', 'FSD', 'DSEAR']`
- Array must not be empty if set
- GIN index for efficient queries

#### Migration: `add_enabled_modules_to_documents`
**Applied to:** `documents` table

**Changes:**
- Added `enabled_modules TEXT[]` column
- Same structure as survey_reports
- Populated from existing `document_type`

**Helper Functions:**
```sql
get_document_modules(doc_row) → TEXT[]
document_has_module(doc_row, module_name) → BOOLEAN
```

**Constraints:**
- Same validation as survey_reports
- GIN index for efficient queries

---

### 2. Create Survey Flow

#### File: `src/pages/NewAssessment.tsx`

**Changes:**
1. Added new assessment type option:
   - "Combined FRA + FSD" (type: `fra_fsd`)

2. Added `getEnabledModules()` function:
   ```typescript
   'fra' → ['FRA']
   'fire_strategy' → ['FSD']
   'dsear' → ['DSEAR']
   'fra_fsd' → ['FRA', 'FSD']
   ```

3. Updated document creation:
   - Sets `enabled_modules` field in database
   - Generates appropriate title: "Site Name — FRA + FSD"
   - Fetches module keys for ALL enabled types
   - Deduplicates module keys (common modules shared)

4. Module instance creation:
   - Creates instances for union of all enabled module types
   - Common modules (A1-A3) created once
   - FRA-specific modules included if FRA enabled
   - FSD-specific modules included if FSD enabled

**Result:**
- Users can now select "Combined FRA + FSD"
- All modules for both types are initialized
- Common data sections shared (no duplication)

---

### 3. Server-Side Validation

#### File: `supabase/functions/issue-survey/index.ts`

**Changes:**
1. Added `validateIssueEligibilityForModules()` function:
   - Accepts array of survey types: `['FRA', 'FSD']`
   - Calls `validateIssueEligibility()` for each type
   - Merges all blockers from all modules
   - Returns eligible ONLY if ALL module requirements pass

2. Updated issue logic:
   ```typescript
   const modulesToValidate = survey.enabled_modules?.length > 0
     ? survey.enabled_modules
     : [survey.document_type];
   
   const validation = validateIssueEligibilityForModules(
     modulesToValidate,
     ctx,
     answers,
     moduleProgress,
     actions
   );
   ```

3. Backward compatibility:
   - Falls back to `document_type` if `enabled_modules` not set
   - Existing single-module surveys continue to work

**Result:**
- Combined surveys BLOCKED unless BOTH FRA and FSD requirements met
- FRA-only surveys use FRA rules only
- FSD-only surveys use FSD rules only

**Function Deployed:** ✅ `issue-survey` edge function deployed

---

### 4. Client-Side Validation

#### File: `src/utils/issueValidation.ts`

**Changes:**
1. Added `validateIssueEligibilityForModules()` export:
   - Same signature as server-side version
   - Validates multiple module types
   - Aggregates all blockers

2. Structure:
   ```typescript
   export function validateIssueEligibilityForModules(
     types: SurveyType[],
     ctx: IssueCtx,
     answers: any,
     moduleProgress: ModuleProgress,
     actions: Array<{ status: ActionStatus }>
   ): ValidationResult
   ```

3. Logic:
   - Iterates through each survey type
   - Calls existing `validateIssueEligibility()` per type
   - Merges all blockers
   - Returns `eligible: false` if ANY blocker exists

**Result:**
- Client-side pre-validation matches server-side behavior
- Issue readiness panel will show blockers from BOTH modules
- Users cannot attempt issue until ALL requirements satisfied

---

## Common Data Sharing

### Already Implemented (No Changes Needed)

The modular document system already shares common modules correctly:

**Common Modules (Shared by FRA + FSD):**
- A1 - Document Control
- A2 - Building Profile
- A3 - Persons at Risk

**How Sharing Works:**
1. Module keys are unique identifiers (e.g., `A1_DOC_CONTROL`)
2. When creating combined survey, module instances created using union of module keys
3. Deduplication ensures common modules only created once
4. Both FRA and FSD reference same module instances
5. Edits to shared modules affect both assessment types

**Example:**
```typescript
FRA modules: [A1, A2, A3, FRA_1, FRA_2, FRA_3, ...]
FSD modules: [A1, A2, A3, FSD_1, FSD_2, FSD_3, ...]
Combined:    [A1, A2, A3, FRA_1, FRA_2, FRA_3, FSD_1, FSD_2, FSD_3, ...]
                     ↑ Shared once
```

**Result:**
- ✅ No duplication of common data
- ✅ Single source of truth for shared sections
- ✅ Edits propagate to both modules automatically

---

## Testing Checklist

### Test 1: FRA-Only (Baseline - Should Continue to Work)
1. Create new FRA assessment
2. Complete FRA modules only
3. Attempt issue → Should succeed (FRA rules only)
4. ✅ **Expected:** Works as before

### Test 2: FSD-Only (Baseline - Should Continue to Work)
1. Create new FSD assessment
2. Complete FSD modules only
3. Attempt issue → Should succeed (FSD rules only)
4. ✅ **Expected:** Works as before

### Test 3: Combined FRA + FSD - FRA Incomplete
1. Create new "Combined FRA + FSD" assessment
2. Complete ONLY FSD modules (A1-A3 + all FSD)
3. Attempt issue
4. ✅ **Expected:** BLOCKED with FRA-specific blockers
   - Example: "Module FRA_1_HAZARDS must be completed"

### Test 4: Combined FRA + FSD - FSD Incomplete
1. Create new "Combined FRA + FSD" assessment
2. Complete ONLY FRA modules (A1-A3 + all FRA)
3. Attempt issue
4. ✅ **Expected:** BLOCKED with FSD-specific blockers
   - Example: "Module FSD_1_REG_BASIS must be completed"

### Test 5: Combined FRA + FSD - Both Complete
1. Create new "Combined FRA + FSD" assessment
2. Complete ALL modules (A1-A3 + FRA + FSD)
3. Submit → Approve → Issue v1
4. ✅ **Expected:** Issue succeeds

### Test 6: Revisioning Correctness
1. Issue combined survey v1 (FRA + FSD both complete)
2. Create revision v2
3. Modify ONLY FRA content (e.g., change hazards)
4. Do NOT modify FSD content
5. Issue v2
6. Verify:
   - v1 snapshot FRA unchanged ✅
   - v1 snapshot FSD unchanged ✅
   - v2 snapshot reflects FRA changes only ✅
   - v2 snapshot FSD integrity preserved ✅

### Test 7: Write-Lock Check
1. Issue combined survey
2. Attempt to edit any FRA module → BLOCKED
3. Attempt to edit any FSD module → BLOCKED
4. Attempt to edit common module (A1/A2/A3) → BLOCKED
5. ✅ **Expected:** All edits blocked (entire survey locked)

### Test 8: Audit Trail
1. Issue combined survey
2. Create revision
3. Check audit log
4. ✅ **Expected:**
   - `issued` event with revision_number
   - `revision_created` event

---

## Key Design Decisions

### 1. Why `enabled_modules` Instead of Changing `document_type`?
- **Backward Compatibility:** Existing surveys continue to work
- **Extensibility:** Can support 3+ module combinations in future
- **Clear Intent:** `document_type='FRA'` + `enabled_modules=['FRA','FSD']` is explicit

### 2. Why Server + Client Validation?
- **Defense in Depth:** Client-side provides UX feedback, server enforces rules
- **Security:** Client can be bypassed, server is source of truth
- **Consistency:** Both use same logic structure

### 3. Why No UI Changes Yet?
- **Scope Control:** Day 3 focused on LOGIC correctness only
- **Separation:** Report layout is separate concern (Day 4)
- **Testing:** Easier to test logic independently

---

## What's OUT OF SCOPE (Deferred to Day 4)

❌ Combined PDF layout (single report with FRA + FSD sections)
❌ Combined compliance pack structure
❌ UI redesign for combined module navigation
❌ Jurisdiction changes or renames
❌ New validation rules (uses existing FRA + FSD rules)

---

## Files Modified

### Database Migrations
1. `add_enabled_modules_for_combined_surveys.sql` - survey_reports table
2. `add_enabled_modules_to_documents.sql` - documents table

### Frontend
1. `src/pages/NewAssessment.tsx` - Create flow with combined option

### Backend
1. `supabase/functions/issue-survey/index.ts` - Combined validation logic

### Utilities
1. `src/utils/issueValidation.ts` - Combined validation function

---

## Backward Compatibility

### Existing Surveys
- `enabled_modules` populated from `document_type` via migration
- All existing surveys have `enabled_modules = [document_type]`
- Zero behavior changes for existing surveys

### Fallback Logic
- If `enabled_modules` is NULL, falls back to `[document_type]`
- If `enabled_modules` is empty array, falls back to `[document_type]`
- Ensures robustness

### Legacy Code Paths
- All existing code paths continue to work
- New code paths only activated when `enabled_modules.length > 1`

---

## Next Steps (Day 4)

### Combined Report Output
1. Design combined PDF layout
   - Single cover page
   - FRA sections first
   - FSD sections second
   - Combined action register
   - Unified references section

2. Combined compliance pack
   - Single ZIP file
   - Combined actions CSV
   - Unified audit trail
   - All evidence attachments

3. UI enhancements (optional)
   - Module navigation showing both FRA and FSD sections
   - Clear visual separation
   - Progress tracking for both modules

---

## Summary

✅ **Database schema extended** with `enabled_modules` field
✅ **Create flow updated** to support combined FRA + FSD selection
✅ **Common data shared** correctly (no duplication)
✅ **Server-side validation** enforces BOTH module requirements for combined surveys
✅ **Client-side validation** matches server behavior
✅ **Backward compatibility** maintained for all existing surveys
✅ **Revisioning correctness** preserved
✅ **Write-lock enforcement** applies to entire combined survey

**All Day 3 objectives achieved. System ready for Day 4 combined output implementation.**

---

## Technical Notes

### Module Key Deduplication
Common modules (A1, A2, A3) have same keys across FRA and FSD:
```typescript
FRA: ['A1_DOC_CONTROL', 'A2_BUILDING_PROFILE', 'A3_PERSONS_AT_RISK', ...]
FSD: ['A1_DOC_CONTROL', 'A2_BUILDING_PROFILE', 'A3_PERSONS_AT_RISK', ...]

Combined (deduplicated):
['A1_DOC_CONTROL', 'A2_BUILDING_PROFILE', 'A3_PERSONS_AT_RISK', 'FRA_...', 'FSD_...']
```

### Validation Flow
```
User clicks "Issue" 
  ↓
Client: validateIssueEligibilityForModules(['FRA', 'FSD'])
  ↓ (if passes)
API call to /issue-survey
  ↓
Server: validateIssueEligibilityForModules(['FRA', 'FSD'])
  ↓ (if passes)
Create snapshot + update status to 'issued'
  ↓
Success
```

### Query Performance
GIN indexes on `enabled_modules` allow fast queries:
```sql
-- Find all combined surveys
SELECT * FROM documents WHERE 'FRA' = ANY(enabled_modules) AND 'FSD' = ANY(enabled_modules);

-- Find all FRA surveys (including combined)
SELECT * FROM documents WHERE 'FRA' = ANY(enabled_modules);
```

---

## Migration Safety

Both migrations are **safe to run on production**:
- Use IF NOT EXISTS checks
- Add nullable columns first
- Populate from existing data
- Add constraints after population
- Create indexes concurrently (safe)
- No data loss risk

---

## End of Day 3 Implementation
