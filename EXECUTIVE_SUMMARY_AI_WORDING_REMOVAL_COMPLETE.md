# Executive Summary AI Wording Removal - Complete

## Overview
Removed "AI" wording from user-facing error messages in the executive summary generation backend while maintaining all existing logic, database fields, and entitlements checks.

## Changes Made

### File: src/lib/ai/generateExecutiveSummary.ts

#### Entitlement Error Message (line 52)

**Before:**
```typescript
if (!canGenerateAiSummary(organisation)) {
  return {
    success: false,
    error: 'AI executive summaries are available on the Professional plan. Upgrade to access this feature.',
  };
}
```

**After:**
```typescript
if (!canGenerateAiSummary(organisation)) {
  return {
    success: false,
    error: 'Executive summaries are available on the Professional plan. Upgrade to access this feature.',
  };
}
```

## What Changed
- **User-facing error message:** Removed "AI" prefix from entitlement error
- **Before:** "AI executive summaries are available on the Professional plan..."
- **After:** "Executive summaries are available on the Professional plan..."

## What Remained Unchanged
✅ Database field name: Still writes to `executive_summary_ai`
✅ Function name: Still calls `canGenerateAiSummary(organisation)`
✅ All business logic: Identical functionality
✅ Entitlements checking: No changes to plan enforcement
✅ File location: Remains in `src/lib/ai/` directory

## Impact

### Backend
- Error responses returned to frontend no longer mention "AI"
- Users see cleaner, more neutral messaging about feature availability

### Frontend
- When a user on a lower tier attempts to generate an executive summary, they'll see:
  - **Old:** "AI executive summaries are available on the Professional plan..."
  - **New:** "Executive summaries are available on the Professional plan..."

## Verification

✅ Build completed successfully (no TypeScript errors)
✅ No lint issues
✅ Grep confirmed no remaining "AI" in user-facing strings
✅ All logic unchanged (function still checks `canGenerateAiSummary`)
✅ Database operations unchanged (still writes to `executive_summary_ai`)

## Technical Notes

- This is purely a copy/text change - no functional modifications
- The internal function name `canGenerateAiSummary` remains unchanged (not user-facing)
- The database column `executive_summary_ai` remains unchanged (can be renamed in future if needed)
- File still located in `src/lib/ai/` directory (internal structure, not user-facing)

## Next Steps (Optional - Not in Scope)

If desired in future, these internal references could also be renamed for consistency:
- Rename `canGenerateAiSummary` → `canGenerateExecutiveSummary`
- Rename database column `executive_summary_ai` → `executive_summary`
- Move file from `src/lib/ai/` to `src/lib/summaries/`

However, these are internal implementation details and don't affect user experience.

## Summary

Successfully removed "AI" branding from user-facing error messages in executive summary generation. Users will now see neutral "Executive summaries" messaging instead of "AI executive summaries" when encountering plan-based feature restrictions. All backend logic, database schema, and entitlements remain functionally identical.
