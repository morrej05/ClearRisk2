# Issue UX (Readiness Panel + Blockers Modal) - Complete Implementation

## Overview

Added a comprehensive user experience for issuing surveys with readiness validation, blockers modal, and server-truth validation. Users can now see exactly what's required before issuing, and the system enforces requirements through server-side validation.

## What Was Implemented

### 1. Issue Readiness Panel ✓

**File:** `src/components/issue/IssueReadinessPanel.tsx`

A comprehensive panel that displays:

**Required Modules:**
- Lists all required modules for the survey type (FRA/FSD/DSEAR)
- Shows completion status with visual indicators
- Displays "Complete" (green checkmark) or "Incomplete" (gray circle + amber badge)
- Progress counter: "X / Y Complete"

**Conditional Requirements:**
Dynamic requirements based on survey context:

**FRA:**
- Scope & Limitations text (if limited/desktop scope)
- Recommendations OR "No Significant Findings" confirmation

**FSD:**
- Limitations documented (if engineered solutions used)
- Management assumptions documented (if engineered solutions used)

**DSEAR:**
- Dangerous substances identified OR "No dangerous substances" confirmed
- Zone classification OR "No zoned areas" confirmed
- Actions OR "Controls adequate" confirmed

**Readiness Status:**
- Badge: "Ready to Issue" (green) or "Not Ready" (amber)
- Summary text: Count of issues to resolve
- Permission check: Shows message if user lacks issue permission

**Props:**
```typescript
interface IssueReadinessPanelProps {
  surveyId: string;
  surveyType: SurveyType;  // 'FRA' | 'FSD' | 'DSEAR'
  ctx: IssueCtx;            // Context with scope, engineered solutions, etc.
  moduleProgress: ModuleProgress;
  answers: any;
  actions: any[];
  canIssue: boolean;        // Permission flag
}
```

### 2. Issue Blockers Modal ✓

**File:** `src/components/issue/IssueBlockersModal.tsx`

Modal that displays blockers preventing issuance:

**Features:**
- Grouped by module for clarity
- Module header with blocker count badge
- Amber alert boxes for each blocker
- Clear, actionable messages
- "General Requirements" section for non-module blockers

**Display:**
```
Cannot Issue Survey
X issues must be resolved

[3] Building Profile
  ⚠ Field X must be completed
  ⚠ Field Y is required
  ⚠ Field Z cannot be empty

[2] Management Systems
  ⚠ At least one control must be documented
  ⚠ Risk assessment must be complete

[1] General Requirements
  ⚠ Recommendations OR "No Significant Findings" confirmation required
```

**Props:**
```typescript
interface IssueBlockersModalProps {
  open: boolean;
  onClose: () => void;
  blockers: Blocker[];
  moduleLabels: Record<string, string>;  // Key → Label mapping
}
```

**Server-Truth Priority:**
- Shows server-returned blockers when available
- Falls back to client validation for UX feedback
- Always trusts server as source of truth

### 3. Issue Bar on Report Page ✓

**Location:** `src/pages/ReportPreviewPage.tsx`

Added comprehensive Issue Bar with:

**Layout:**
- Grid: 2/3 left (controls) + 1/3 right (readiness panel)
- Only visible when: `status === 'draft'` AND viewing current draft (not a revision)
- Hidden when: Survey is issued OR viewing a historical revision

**Controls Section (Left):**

1. **Confirmation Checkbox:**
   ```
   ☐ I confirm this document is complete within the stated
     scope and limitations
   ```

2. **Change Log Textarea:**
   ```
   Change Log (optional but recommended)
   [Describe what changed in this issue/revision...]
   ```

3. **Issue Button:**
   - Primary action: "Issue Survey"
   - Disabled when:
     - User lacks permission (!isOrgAdmin)
     - Confirmation not ticked
     - Client validation fails
   - Loading state: "Issuing..." with spinner

4. **Explain Button:**
   - Visible when Issue button is disabled
   - Text: "Why is this disabled?"
   - Opens blockers modal with client validation results

**Readiness Panel (Right):**
- Live display of IssueReadinessPanel component
- Real-time feedback as modules are completed
- Shows conditional requirements dynamically

### 4. Issue Handler with Server Validation ✓

**Function:** `handleIssue()` in `ReportPreviewPage.tsx`

**Flow:**

1. **Prepare Request:**
   - Get current session
   - Build payload: `{ survey_id, change_log }`

2. **Call Server:**
   ```typescript
   POST /functions/v1/issue-survey
   Authorization: Bearer {token}
   Body: { survey_id, change_log }
   ```

3. **Handle Responses:**

   **Success (200):**
   ```json
   { "ok": true, "revision_number": 1, "revision_id": "..." }
   ```
   - Show success alert: "Successfully issued as Revision X"
   - Refresh survey data
   - Reload available revisions
   - Switch to viewing the new issued revision
   - Clear form (confirmation + change log)

   **Validation Error (400):**
   ```json
   { "blockers": [
     { "type": "module_incomplete", "moduleKey": "A1", "message": "..." },
     { "type": "missing_field", "message": "..." }
   ]}
   ```
   - Store server blockers in state
   - Open blockers modal
   - User sees exactly what needs fixing

   **Other Errors:**
   - Show alert with error message
   - User can try again after fixing issues

**Key Feature: Server as Source of Truth**
- Client validation is for UX only (instant feedback)
- Server performs final validation before issuance
- Server-returned blockers override client suggestions
- Ensures data integrity and business rules

### 5. Module Label Mapping ✓

**Implementation:** Inline in `ReportPreviewPage.tsx`

**Purpose:**
Convert module keys to human-readable labels for blockers modal

**Example:**
```typescript
const modules = getRequiredModules(surveyType, ctx);
const moduleLabels = Object.fromEntries(
  modules.map(m => [m.key, m.label])
);

// Result:
{
  'A1_DOC_CONTROL': 'Document Control & Governance',
  'A2_BUILDING_PROFILE': 'Building Profile',
  'FRA_1_HAZARDS': 'Hazards & Ignition Sources',
  // ...
}
```

**Usage:**
- Passed to IssueBlockersModal
- Displays nice labels instead of keys
- Falls back to raw key if label not found

### 6. Permissions and Locked State ✓

**Permission Check:**
```typescript
const canIssue = user && isOrgAdmin(user);
```

**Rules:**
- Only organisation admins can issue surveys
- Surveyors and viewers see disabled Issue button
- Readiness panel shows permission message if blocked

**Locked State:**
- Issue Bar hidden when `status === 'issued'`
- IssuedLockBanner appears instead
- "Create Revision" button available (separate flow)
- Can still view issued revisions via revision picker

**Revision View:**
- Issue Bar hidden when viewing historical revision (`?rev=X`)
- Only shown when viewing current draft
- Prevents accidental re-issuance of old data

## User Flow Examples

### Example 1: Incomplete Survey

```
1. User opens draft survey report
2. Issue Bar appears
3. Readiness Panel shows:
   - "Not Ready" amber badge
   - "3 issues must be resolved before issuing"
   - Required Modules: 7 / 9 Complete
   - Building Profile: Incomplete (amber)
   - Management Systems: Incomplete (amber)
   - Conditional: Scope limitations required

4. User ticks confirmation checkbox
5. Issue button still disabled
6. User clicks "Why is this disabled?"
7. Blockers Modal opens:

   Cannot Issue Survey
   3 issues must be resolved

   [2] Building Profile
     ⚠ Building construction type must be specified
     ⚠ Number of floors is required

   [1] Document Control & Governance
     ⚠ Scope limitations must be specified for limited assessments

8. User closes modal
9. User goes to complete missing modules
10. Returns to report page
11. Readiness Panel now shows "Ready to Issue"
12. Issue button becomes enabled
13. User adds change log: "Initial assessment"
14. User clicks "Issue Survey"
15. Success! Survey issued as Revision 1
```

### Example 2: Server Rejection

```
1. User completes all client-side requirements
2. Readiness Panel shows "Ready to Issue"
3. User ticks confirmation
4. User clicks "Issue Survey"
5. Server validates and finds additional issue
6. Server returns 400:
   {
     "blockers": [
       {
         "type": "missing_field",
         "moduleKey": "A4",
         "message": "At least one emergency procedure must be documented"
       }
     ]
   }

7. Blockers Modal opens with SERVER blockers
8. User sees specific issue from server
9. User fixes the issue
10. User tries again
11. Success! Survey issued
```

### Example 3: Permission Denied

```
1. Surveyor (non-admin) opens report
2. Issue Bar appears
3. Readiness Panel shows:

   Issue Permission Required
   You do not have permission to issue this survey.
   Contact an administrator.

4. Issue button is disabled
5. Surveyor cannot issue
6. Admin receives notification
7. Admin reviews and issues
```

### Example 4: Issued Survey

```
1. User opens issued survey report
2. No Issue Bar visible
3. IssuedLockBanner appears:
   "This survey is issued and locked for editing"
4. Revision picker shows: "Issued v1"
5. User can view but not modify
6. User can create new revision via banner button
7. After creating revision, Issue Bar reappears for v2 draft
```

## Integration with Existing Systems

### Works With:

**Lock System:**
- Issue Bar hidden when locked
- Lock banner takes precedence
- Create Revision button in lock banner

**Revision Picker:**
- Issue Bar only for current draft
- Hidden when viewing `?rev=X`
- Auto-switches to new revision after issue

**Snapshot System:**
- Server creates snapshot on issue
- Snapshot includes all validated data
- Immutable record of issued state

**Validation Utilities:**
- Uses `issueRequirements.ts` for module rules
- Uses `issueValidation.ts` for client checks
- Server performs final validation

**Entitlements:**
- Checks `isOrgAdmin()` for permission
- Platform admins also have permission
- Viewers and surveyors blocked

## Validation Flow

### Client-Side (UX Only):

```typescript
const validation = validateIssueEligibility(
  surveyType,
  ctx,
  answers,
  moduleProgress,
  actions
);

// Returns:
{
  eligible: boolean,
  blockers: Blocker[]
}
```

**Purpose:**
- Instant feedback
- Prevent wasted server calls
- Clear user guidance

**Not Enforced:**
- User could bypass with dev tools
- Server is ultimate authority

### Server-Side (Source of Truth):

**Edge Function:** `/functions/v1/issue-survey`

1. Loads survey data
2. Validates all requirements
3. Checks business rules
4. Returns blockers OR creates revision
5. Generates snapshot
6. Updates survey status

**Enforced:**
- Cannot bypass
- Data integrity guaranteed
- Business rules respected

## UI States

### State 1: Draft Survey (Not Ready)
- ✅ Issue Bar visible
- ✅ Readiness Panel shows issues
- ❌ Issue button disabled
- ✅ "Why disabled?" button available
- ❌ Lock banner hidden

### State 2: Draft Survey (Ready)
- ✅ Issue Bar visible
- ✅ Readiness Panel shows "Ready"
- ✅ Issue button enabled (if confirmed)
- ❌ "Why disabled?" button hidden
- ❌ Lock banner hidden

### State 3: Issued Survey
- ❌ Issue Bar hidden
- ❌ Readiness Panel hidden
- ✅ Lock banner visible
- ✅ "Create Revision" button available

### State 4: Viewing Historical Revision
- ❌ Issue Bar hidden
- ❌ Readiness Panel hidden
- ✅ Revision picker shows "Issued vX"
- ✅ Blue badge: "Viewing Immutable Snapshot"

### State 5: No Permission
- ✅ Issue Bar visible
- ✅ Readiness Panel shows permission warning
- ❌ Issue button disabled
- ❌ Confirmation disabled
- ❌ Change log disabled

### State 6: Issuing (Loading)
- ✅ Issue Bar visible
- ✅ Issue button shows spinner: "Issuing..."
- ❌ All controls disabled
- ⏳ Waiting for server response

### State 7: Server Blocked
- ✅ Issue Bar visible
- ✅ Blockers Modal open
- ✅ Server blockers displayed
- ❌ Issue button re-enabled after modal close
- 🔄 User can fix and retry

## Files Created/Modified

### Created:
- `src/components/issue/IssueReadinessPanel.tsx` - Readiness status display
- `src/components/issue/IssueBlockersModal.tsx` - Blockers display modal
- `ISSUE_UX_COMPLETE.md` - This documentation

### Modified:
- `src/pages/ReportPreviewPage.tsx` - Added Issue Bar, handlers, state
  - Added imports for validation utilities
  - Added state for blockers, confirmation, change log
  - Added `handleIssue()` function
  - Added `handleExplainBlockers()` function
  - Added Issue Bar UI section
  - Added Blockers Modal integration
  - Modified visibility logic for draft vs issued

### Existing (Used):
- `src/utils/issueRequirements.ts` - Module requirements rules
- `src/utils/issueValidation.ts` - Validation logic
- `src/utils/entitlements.ts` - Permission checks
- `supabase/functions/issue-survey/index.ts` - Server validation endpoint

## Testing Scenarios

### Test 1: Complete Flow (Success)
1. Create draft FRA survey
2. Complete all required modules
3. Open report preview
4. ✅ Issue Bar appears
5. ✅ Readiness shows "Ready"
6. Tick confirmation
7. Enter change log: "Initial issue"
8. Click "Issue Survey"
9. ✅ Loading spinner appears
10. ✅ Success alert shows "Issued as Revision 1"
11. ✅ Survey status becomes "issued"
12. ✅ Issue Bar disappears
13. ✅ Lock banner appears

### Test 2: Incomplete Survey
1. Create draft survey with 2 modules incomplete
2. Open report preview
3. ✅ Readiness shows "Not Ready"
4. ✅ Shows "2 issues must be resolved"
5. ✅ Lists incomplete modules with amber badges
6. Tick confirmation
7. ✅ Issue button still disabled
8. Click "Why is this disabled?"
9. ✅ Blockers modal opens
10. ✅ Shows 2 grouped blockers
11. Close modal
12. Complete 1 module
13. ✅ Readiness updates to "1 issue must be resolved"
14. Complete 2nd module
15. ✅ Readiness shows "Ready"
16. ✅ Issue button becomes enabled

### Test 3: Conditional Requirements (FRA Limited Scope)
1. Create FRA with scope_type = "limited"
2. Complete all modules
3. Open report
4. ✅ Readiness shows conditional: "Scope limitations required"
5. ✅ Issue button disabled
6. Click "Why disabled?"
7. ✅ Modal shows: "Scope limitations must be specified for limited assessments"
8. Go to Document Control module
9. Fill in scope_limitations field
10. Return to report
11. ✅ Conditional requirement marked complete
12. ✅ Issue button becomes enabled

### Test 4: Server Validation Override
1. Complete survey (client shows ready)
2. Tick confirmation
3. Click "Issue Survey"
4. Server validates and finds issue (simulated)
5. ✅ Modal opens with SERVER blockers
6. ✅ Message shows server-specific error
7. Close modal
8. Fix server issue
9. Click "Issue Survey" again
10. ✅ Success! Issued

### Test 5: Permission Check
1. Login as Surveyor (non-admin)
2. Open draft survey report
3. ✅ Readiness panel shows permission warning
4. ✅ Issue button disabled
5. ✅ Cannot tick confirmation (or tick has no effect)
6. Logout and login as Admin
7. ✅ Readiness panel shows module status
8. ✅ Issue button becomes available

### Test 6: Viewing Historical Revision
1. Issue survey as v1
2. Create revision v2
3. Select "Issued v1" in revision picker
4. ✅ Issue Bar hidden
5. ✅ Showing snapshot data
6. Select "Draft (current)"
7. ✅ Issue Bar reappears for v2
8. Can issue v2 independently

## Key Benefits

1. **Clear Requirements:**
   - Users know exactly what's needed
   - No guessing about why disabled
   - Progress tracking built-in

2. **Server-Truth Validation:**
   - Client provides UX feedback
   - Server enforces final rules
   - No data integrity issues

3. **Contextual Requirements:**
   - Conditional rules shown only when relevant
   - Adapts to survey type and settings
   - No confusion about non-applicable requirements

4. **Grouped Blockers:**
   - Easy to understand what's wrong
   - Clear which module needs attention
   - Actionable error messages

5. **Permission-Aware:**
   - Clear messaging about access
   - Admins guided to issue process
   - Non-admins know who to contact

6. **Integrated Experience:**
   - Works seamlessly with lock system
   - Respects revision picker state
   - Maintains snapshot immutability

## Architecture Notes

### Why Client + Server Validation?

**Client Validation:**
- ✅ Instant feedback (no network delay)
- ✅ Prevents unnecessary server calls
- ✅ Improves UX with real-time updates
- ❌ Can be bypassed (not security)

**Server Validation:**
- ✅ Source of truth (cannot bypass)
- ✅ Enforces business rules
- ✅ Guarantees data integrity
- ✅ Handles complex cross-table checks
- ❌ Network latency

**Together:**
- Best UX (instant feedback)
- Best security (server enforcement)
- Clear error messages from server
- No false positives from client

### Module Label Mapping

**Why inline?**
- Needed only in one place (blockers modal)
- Built from existing `getRequiredModules()` data
- No need for separate mapping file
- DRY: Labels already defined in requirements

**Alternative considered:**
- Separate `moduleLabels.ts` file
- ❌ Would duplicate label definitions
- ❌ Risk of getting out of sync
- ✅ Current approach: Single source of truth

### Permission Model

**Issue Permission:**
- Requires `role === 'admin'`
- Platform admins included
- Surveyors cannot issue (by design)
- Viewers cannot issue (by design)

**Why admin-only?**
- Issuance is a commitment
- Represents organizational approval
- Creates immutable legal record
- Requires authority

## Future Enhancements

### Planned:

1. **Batch Issuance:**
   - Issue multiple surveys at once
   - Bulk validation
   - Progress indicator

2. **Pre-Issue Preview:**
   - Show what will be in snapshot
   - Confirm before committing
   - Review mode

3. **Issue Approval Workflow:**
   - Surveyor requests issue
   - Admin approves/rejects
   - Email notifications

4. **Audit Trail:**
   - Who issued when
   - What was checked
   - Log validation results

5. **Smart Suggestions:**
   - "You're 80% ready"
   - "Complete X module to issue"
   - AI-powered completeness check

6. **Validation Rules Editor:**
   - Admin configures requirements
   - Custom rules per organization
   - Compliance framework selection

## Build Status

✅ **Build successful** - No TypeScript errors
✅ **Components functional** - Readiness panel + blockers modal
✅ **Validation working** - Client checks + server integration
✅ **UI integrated** - Issue Bar on report page
✅ **Permissions enforced** - Admin-only issuance
✅ **Server-truth respected** - 400 responses display blockers

## Summary

The Issue UX system provides a complete, user-friendly experience for issuing surveys with:

- Clear visibility of requirements
- Real-time readiness feedback
- Contextual conditional rules
- Actionable blocker messages
- Server-enforced validation
- Permission-aware controls
- Seamless integration with existing features

Users now understand exactly what's needed to issue, and the system guarantees that all requirements are met before creating an immutable issued revision.
