# Survey Formal Approval Workflow - Complete Implementation

Successfully implemented a formal, enforceable approval workflow (draft → in_review → approved → issued) with clear responsibilities, state transitions, and audit trails for survey documents.

## Implementation Summary

### Database Schema ✓
- Extended survey status enum (draft, in_review, approved, issued)
- Added approval metadata (approved_at, approved_by, approval_note)
- Created status transition validation function
- Added indexes for performance

### Edge Functions Deployed ✓
1. **submit-for-review** - Submit survey for approval
2. **return-to-draft** - Admin returns survey to draft (clears approval)
3. **approve-survey** - Admin approves survey
4. **issue-survey** - Updated with approval gate (requires approved status)
5. **create-revision** - Updated to reset approval on revision creation

### UI Components ✓
- **ApprovalWorkflowBanner** - Complete workflow UI with status badges and controls
- **Updated lock logic** - Status-based editing restrictions
- **Role-based visibility** - Admin-only approval controls

### Audit Trail ✓
- New event types: submitted_for_review, returned_to_draft, approved
- Complete history of all approval actions
- Actor names and timestamps tracked

## Workflow States

```
draft → in_review → approved → issued
  ↓         ↓          ↓
  ←─────────┴──────────┘
```

### Permissions by Status

| Status | Surveyor | Admin |
|--------|----------|-------|
| draft | Edit | Edit |
| in_review | Read-only | Edit |
| approved | Read-only | Edit |
| issued | Read-only | Read-only |

## Key Features

✅ **Enforced approval gate** - Surveys must be approved before issuing
✅ **Clear workflow** - Visual status badges guide users through process
✅ **Role-based access** - Org admins control approval process
✅ **Audit compliance** - Complete trail of all approval actions
✅ **Revision handling** - Approval resets on new revision (no auto-skip)

## Files Modified

**Database:**
- `add_approval_workflow_to_surveys.sql` - Migration

**Edge Functions:**
- `submit-for-review/index.ts` - New
- `return-to-draft/index.ts` - New
- `approve-survey/index.ts` - New
- `issue-survey/index.ts` - Updated with approval gate
- `create-revision/index.ts` - Updated to clear approval

**Frontend:**
- `ApprovalWorkflowBanner.tsx` - New component
- `lockState.ts` - Extended for status-based locking
- `ReportPreviewPage.tsx` - Integrated workflow banner
- `IssuedLockBanner.tsx` - Updated to only handle issued surveys

## Build Status

✅ **Build successful** - No TypeScript errors
✅ **All functions deployed** - 5 edge functions operational
✅ **Migration applied** - Database schema updated
✅ **UI integrated** - Workflow banner operational

The approval workflow ensures quality control, clear responsibilities, and audit compliance for all surveys before issuance.
