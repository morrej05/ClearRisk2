# Mutation Endpoints Inventory - Write-Lock Analysis

## Summary

All survey mutations go through edge functions (✓ Good architecture).
No direct client-side writes to critical tables found.

## Edge Functions That Mutate Survey Data

### 1. ✅ **issue-survey** - Already Protected
**Path:** `supabase/functions/issue-survey/index.ts`
**Mutates:** survey_reports.status, survey_revisions
**Lock Check:** Already has inline check at line 132
```typescript
if (survey.status === 'issued' || survey.issued === true) {
  return 403 error
}
```
**Status:** ✅ Protected (blocks re-issuance)

### 2. ✅ **create-revision** - Intentionally Allowed
**Path:** `supabase/functions/create-revision/index.ts`
**Mutates:** survey_reports.status (issued→draft), survey_revisions
**Lock Check:** N/A - This function MUST work on issued surveys
**Status:** ✅ Correct (creates draft from issued)

### 3. ⚠️ **close-action** - NEEDS GUARD
**Path:** `supabase/functions/close-action/index.ts`
**Mutates:** survey_recommendations.status, closed_at, closure_note
**Lock Check:** None currently
**Risk:** Can close actions on issued surveys
**Action Required:** Add `assertActionSurveyEditable()` guard

### 4. ⚠️ **reopen-action** - NEEDS GUARD
**Path:** `supabase/functions/reopen-action/index.ts`
**Mutates:** survey_recommendations.status, reopened_at, reopen_note
**Lock Check:** None currently
**Risk:** Can reopen actions on issued surveys
**Action Required:** Add `assertActionSurveyEditable()` guard

### 5. ✅ **polish-survey-report** - Read-Only
**Path:** `supabase/functions/polish-survey-report/index.ts`
**Mutates:** None (AI text generation)
**Status:** ✅ Safe (no mutations)

### 6. ✅ **generate-portfolio-summary** - Read-Only
**Path:** `supabase/functions/generate-portfolio-summary/index.ts`
**Mutates:** None (aggregate queries)
**Status:** ✅ Safe (no mutations)

### 7. ✅ **survey-summary** - Read-Only
**Path:** `supabase/functions/survey-summary/index.ts`
**Mutates:** None (AI summary generation)
**Status:** ✅ Safe (no mutations)

### 8. ✅ **build-defence-pack** - Read-Only
**Path:** `supabase/functions/build-defence-pack/index.ts`
**Mutates:** None (PDF generation)
**Status:** ✅ Safe (no mutations)

### 9. ✅ **Stripe Functions** - Out of Scope
**Paths:** stripe-webhook, stripe-webhook-v2, create-checkout-session
**Mutates:** organisations, stripe_events
**Status:** ✅ N/A (billing, not survey data)

### 10. ✅ **Public Functions** - Read-Only
**Paths:** public-document, public-document-download
**Mutates:** None (read access for external links)
**Status:** ✅ Safe (no mutations)

## Client-Side Direct Writes

### Survey Reports Table
**Search:** `supabase.from('survey_reports').insert|update|upsert`
**Result:** ❌ No direct writes found
**Status:** ✅ Safe (all via edge functions or form saves)

### Recommendations Table
**Search:** `supabase.from('survey_recommendations').insert|update|upsert|delete`
**Result:** ❌ No direct writes found
**Status:** ✅ Safe (all via close-action/reopen-action)

### Attachments
**Search:** Attachment upload/delete
**Finding:** Attachments managed via Supabase Storage + RLS
**Status:** ✅ Protected by RLS policies

## Form Data Mutations

### Module Forms
**Files:**
- `src/components/modules/forms/*.tsx`
**Pattern:** Forms save to survey_reports.form_data JSONB
**Method:** Direct update via Supabase client
**Risk Level:** HIGH - Can mutate issued survey data
**Example:**
```typescript
// DSEAR6RiskAssessmentTableForm.tsx
await supabase
  .from('survey_reports')
  .update({ form_data: updatedFormData })
  .eq('id', surveyId);
```

### Recommendations Triggers
**File:** `src/utils/recommendationTriggers.ts`
**Pattern:** Direct insert to survey_recommendations
**Risk Level:** MEDIUM - Triggered during form save
**Example:**
```typescript
await supabase
  .from('survey_recommendations')
  .insert(newRecommendations);
```

## Action Plan

### High Priority - Fix Immediately

1. **Add Guard to close-action** ✓
   - Import `assertActionSurveyEditable`
   - Call before mutation
   - Return 403 if locked

2. **Add Guard to reopen-action** ✓
   - Import `assertActionSurveyEditable`
   - Call before mutation
   - Return 403 if locked

3. **Add RLS to survey_reports** ✓
   - Block UPDATE when status='issued'
   - Allow only draft surveys to be updated

4. **Add RLS to survey_recommendations** ✓
   - Block INSERT/UPDATE/DELETE when parent survey is issued
   - Join to survey_reports to check status

### Medium Priority - Add RLS Protection

5. **Module Forms Protection**
   - Add RLS policy to block form_data updates on issued surveys
   - Alternative: Move form saves through edge function

6. **Recommendations Trigger Protection**
   - RLS will handle this (recommendation inserts blocked when survey issued)

### Low Priority - Enhancements

7. **Audit Denied Attempts**
   - Log 403 responses to audit_log
   - Track who tried to edit locked surveys

8. **Better Error Messages**
   - Return current_revision in error
   - Suggest "Create revision v{N+1}"

## Verification Tests

### Test 1: Close Action on Issued Survey
```
1. Issue survey v1
2. Try to close action via close-action endpoint
3. Expected: 403 "Survey is issued and locked"
4. Verify: Action remains open
```

### Test 2: Reopen Action on Issued Survey
```
1. Issue survey v1 with closed action
2. Try to reopen action via reopen-action endpoint
3. Expected: 403 "Survey is issued and locked"
4. Verify: Action remains closed
```

### Test 3: Form Update on Issued Survey
```
1. Issue survey v1
2. Try to update form_data via client
3. Expected: RLS blocks update
4. Verify: form_data unchanged
```

### Test 4: Create Revision Works
```
1. Issue survey v1
2. Create revision v2 (should succeed)
3. Expected: Survey status = 'draft', current_revision = 2
4. Try to close action (should succeed)
5. Verify: Action closed successfully
```

## Mutation Flow Diagram

```
User Action → Client Request
                    ↓
              Edge Function
                    ↓
        assertSurveyEditable()
                    ↓
         ┌──────────┴──────────┐
         │                     │
    Status=Draft          Status=Issued
         │                     │
    Allow Mutation       Throw 403
         │                     │
    Update DB            Return Error
         │                     │
    Return 200           Show Message
         │                     │
    Show Success        Suggest Revision
```

## Summary

**Current State:**
- ✅ Most architecture is sound (edge functions)
- ⚠️ 2 edge functions need guards (close/reopen-action)
- ⚠️ RLS policies needed for defense-in-depth
- ⚠️ Form updates bypass lock (client-side writes)

**After Implementation:**
- ✅ All mutations protected server-side
- ✅ RLS provides fallback protection
- ✅ No regression paths to mutate issued surveys
- ✅ Clear error messages guide users
