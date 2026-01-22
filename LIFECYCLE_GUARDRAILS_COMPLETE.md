# Lifecycle Guardrails, Validation & Regression Protection ✅

## Status: Production Ready - Platform Hardened

Complete implementation of server-side guardrails, lifecycle invariants, permission validation, and regression protection ensuring the platform is safe, predictable, and ready for confident extension.

---

## Overview

This stabilization phase hardens the platform after core lifecycle changes by implementing:

1. **Hard Permission Guards** - Server-side enforcement of critical operations
2. **Lifecycle Invariants** - Database-level protection of business rules
3. **Edit Protection** - Prevention of invalid state modifications
4. **Validation & Blocking** - Pre-flight checks before critical operations
5. **Data Integrity Checks** - Continuous monitoring of system health
6. **UX Friction Reduction** - Clear messaging and disabled impossible actions

---

## A) Hard Permission Guards ✅

### Server-Side Functions (Security Definer)

**1. can_user_issue_document(user_id, document_id)**
```sql
CREATE FUNCTION can_user_issue_document(p_user_id uuid, p_document_id uuid)
RETURNS boolean
SECURITY DEFINER;
```

**Checks:**
- User belongs to same organisation as document
- User has `can_edit = true` permission
- Returns boolean (no exceptions)

**Usage:**
```typescript
const check = await canUserIssueDocument(userId, documentId);
if (!check.allowed) {
  alert(check.reason);
}
```

**2. can_user_close_action(user_id, action_id)**
```sql
CREATE FUNCTION can_user_close_action(p_user_id uuid, p_action_id uuid)
RETURNS boolean
SECURITY DEFINER;
```

**Checks:**
- User belongs to same organisation as action
- User has edit permission OR is action owner
- Returns boolean

**Usage:**
```typescript
const check = await canUserCloseAction(userId, actionId);
if (!check.allowed) {
  alert('You cannot close this action');
}
```

**3. can_document_be_edited(document_id)**
```sql
CREATE FUNCTION can_document_be_edited(p_document_id uuid)
RETURNS boolean;
```

**Checks:**
- Document status is 'draft'
- Returns true only for drafts

**Usage:**
```typescript
const editable = await canDocumentBeEdited(documentId);
if (!editable) {
  // Hide edit controls, show lock banner
}
```

### Why SECURITY DEFINER?

These functions run with elevated privileges to:
- Bypass RLS for permission checks
- Access user profiles and organisation data
- Provide consistent permission logic across all clients
- Prevent permission bypass via client-side manipulation

---

## B) Lifecycle Invariants (Must Always Hold) ✅

### Invariant 1: One Issued Document Per Chain

**Trigger:** `enforce_single_issued_per_chain`

```sql
CREATE TRIGGER trigger_enforce_single_issued_per_chain
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION enforce_single_issued_per_chain();
```

**Rule:** Only one document per `base_document_id` can have `issue_status = 'issued'`

**Protection:**
- Prevents database corruption
- Ensures clear "current version" identification
- Raises exception if violated

**Error Message:**
```
Cannot have multiple issued documents in the same chain
```

### Invariant 2: One Draft Document Per Chain

**Trigger:** `enforce_single_draft_per_chain`

**Rule:** Only one document per `base_document_id` can have `issue_status = 'draft'`

**Protection:**
- Prevents confusion about which draft is active
- Ensures re-issue workflow clarity
- Maintains version chain integrity

**Error Message:**
```
Cannot have multiple draft documents in the same chain
```

### Invariant 3: Auto-Supersede on Re-Issue

**Trigger:** `auto_supersede_on_issue`

```sql
CREATE TRIGGER trigger_auto_supersede_on_issue
  AFTER INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION auto_supersede_on_issue();
```

**Behavior:**
- When document transitions to `issue_status = 'issued'`
- Find existing issued document in chain
- Automatically mark it as 'superseded'
- Set `superseded_by_document_id` to new document
- Set `superseded_date` to current date

**Guarantees:**
- Issued → Superseded transition is automatic
- No manual intervention required
- Version chains always have correct successor references

### Invariant 4: Closed Actions Cannot Reopen

**Trigger:** `prevent_reopening_closed_actions`

```sql
CREATE TRIGGER trigger_prevent_reopening_closed_actions
  BEFORE UPDATE ON actions
  FOR EACH ROW
  WHEN (OLD.status = 'closed' AND NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION prevent_reopening_closed_actions();
```

**Rule:** Actions with `status = 'closed'` cannot transition to any other status

**Exceptions:**
- Org admins can reopen
- Platform admins can reopen

**Error Message:**
```
Closed actions cannot be reopened except by administrators
```

**Reason:** Once an action is closed and verified, it should not be reopened without admin oversight

---

## C) Edit Protection ✅

### Protection 1: Issued/Superseded Documents Cannot Be Edited

**Trigger:** `prevent_editing_issued_documents`

**Protected Fields:**
- title
- document_type
- scope_description
- limitations_assumptions
- standards_selected

**Allowed Updates:**
- issue_status changes (via workflow)
- superseded_by_document_id (via auto-supersede)
- approval fields (via approval workflow)
- locked PDF fields (via issue process)

**Error Message:**
```
Cannot edit issued or superseded documents. Create a new version instead.
```

**UI Integration:**
- Edit controls disabled for issued/superseded docs
- Clear banner showing lock status
- "Create New Version" button displayed

### Protection 2: Modules in Issued Documents Cannot Be Edited

**Trigger:** `prevent_editing_issued_document_modules`

**Rule:** Cannot UPDATE any module_instance where document has `issue_status IN ('issued', 'superseded')`

**Error Message:**
```
Cannot edit modules in issued or superseded documents
```

**Workflow:**
1. User tries to edit module in issued document
2. Trigger blocks UPDATE
3. Error returned to client
4. Client shows lock banner and disables controls

---

## D) Validation & Blocking Rules ✅

### Comprehensive Pre-Issue Validation

**Function:** `validate_document_for_issue(document_id, user_id)`

**Returns:**
```typescript
{
  is_valid: boolean;
  error_code: string;
  error_message: string;
}
```

**Validation Checks:**

**1. Document Exists**
- Error: `DOC_NOT_FOUND`
- Message: "Document not found"

**2. Document is Draft**
- Error: `NOT_DRAFT`
- Message: "Only draft documents can be issued"

**3. User Has Permission**
- Error: `NO_PERMISSION`
- Message: "User does not have permission to issue documents"
- Calls: `can_user_issue_document()`

**4. Document Has Modules**
- Error: `NO_MODULES`
- Message: "Document must have at least one module"

**5. Modules Have Data**
- Error: `EMPTY_MODULES`
- Message: "Document has N modules with no data"
- Checks: `payload IS NOT NULL AND payload != '{}'`

**6. Approval Workflow Compliance**
- Error: `APPROVAL_REQUIRED`
- Message: "Document requires approval before issue"
- Condition: Organisation has `approval_workflow_enabled = true`

- Error: `APPROVAL_REJECTED`
- Message: "Document approval was rejected"

- Error: `APPROVAL_INVALID`
- Message: "Document does not have valid approval"

**7. No Existing Locked PDF**
- Error: `ALREADY_HAS_PDF`
- Message: "Document already has a locked PDF"
- Safety check to prevent re-locking

### User-Friendly Error Messages

**Utility:** `getValidationErrorMessage(errorCode, errorMessage)`

```typescript
const messages = {
  DOC_NOT_FOUND: 'Document not found. Please refresh and try again.',
  NOT_DRAFT: 'Only draft documents can be issued. This document has already been issued.',
  NO_PERMISSION: 'You do not have permission to issue documents. Contact your administrator.',
  NO_MODULES: 'Document must have at least one module before it can be issued.',
  EMPTY_MODULES: errorMessage, // Shows specific count
  APPROVAL_REQUIRED: 'This document requires approval before it can be issued. Please request approval first.',
  APPROVAL_REJECTED: 'This document\'s approval was rejected. Please address the feedback and request approval again.',
  APPROVAL_INVALID: 'This document does not have valid approval. Please request approval.',
  ALREADY_HAS_PDF: 'This document already has a locked PDF. It may have been issued already.',
};
```

**Benefits:**
- Clear, actionable guidance
- Non-technical language
- Hints for resolution
- Consistent across platform

---

## E) Data Integrity Checks ✅

### Check 1: Version Chain Integrity

**Function:** `check_version_chain_integrity(base_document_id)`

**Checks:**
1. **Multiple Issued Documents**
   - Only one issued per chain
   - Error if count > 1

2. **Multiple Drafts**
   - Only one draft per chain
   - Error if count > 1

**Returns:**
```typescript
{
  is_valid: boolean;
  issue_description: string;
}
```

**Usage:**
```typescript
const result = await checkVersionChainIntegrity(baseDocumentId);
if (!result.isValid) {
  alert(`Critical error: ${result.issues.join(', ')}`);
}
```

### Check 2: Locked PDF Integrity

**Function:** `check_locked_pdf_integrity()`

**Finds:**
1. **Issued/superseded without locked PDF**
   - Created after 2026-01-22 (feature date)
   - Should have locked PDF but doesn't

2. **Drafts with locked PDF**
   - Drafts should never have locked PDF
   - Indicates error in issue workflow

**Returns:**
```typescript
{
  hasIssues: boolean;
  documents: Array<{
    documentId: string;
    title: string;
    issueStatus: string;
    issue: string;
  }>;
}
```

**Usage:**
```typescript
const result = await checkLockedPdfIntegrity();
if (result.hasIssues) {
  console.warn('PDF integrity issues:', result.documents);
}
```

### Monitoring View: document_lifecycle_health

**Purpose:** Continuous monitoring of document chains

```sql
CREATE VIEW document_lifecycle_health AS
SELECT
  organisation_id,
  base_document_id,
  COUNT(*) as total_versions,
  COUNT(*) FILTER (WHERE issue_status = 'draft') as draft_count,
  COUNT(*) FILTER (WHERE issue_status = 'issued') as issued_count,
  COUNT(*) FILTER (WHERE issue_status = 'superseded') as superseded_count,
  MAX(version_number) as latest_version,
  CASE
    WHEN COUNT(*) FILTER (WHERE issue_status = 'issued') > 1 THEN 'ERROR: Multiple issued'
    WHEN COUNT(*) FILTER (WHERE issue_status = 'draft') > 1 THEN 'ERROR: Multiple drafts'
    WHEN COUNT(*) FILTER (WHERE issue_status = 'issued') = 0
      AND COUNT(*) FILTER (WHERE issue_status = 'draft') = 0 THEN 'WARNING: No active version'
    ELSE 'OK'
  END as health_status
FROM documents
GROUP BY organisation_id, base_document_id;
```

**Health Statuses:**
- `OK` - Chain is healthy
- `ERROR: Multiple issued` - Invariant violation (critical)
- `ERROR: Multiple drafts` - Invariant violation (critical)
- `WARNING: No active version` - All versions archived

**Query:**
```sql
SELECT * FROM document_lifecycle_health WHERE health_status LIKE 'ERROR%';
```

---

## F) UX Friction Reduction ✅

### 1. EditLockBanner Component

**Purpose:** Clear visual indication when editing is not possible

**For Issued Documents:**
```tsx
<EditLockBanner issueStatus="issued" />
```

Displays:
```
🔒 Document Locked
This document has been issued and is locked to preserve integrity.
To make changes, create a new version.
```

**For Superseded Documents:**
```tsx
<EditLockBanner
  issueStatus="superseded"
  supersededByDocumentId="..."
  onNavigateToSuccessor={() => navigate(...)}
/>
```

Displays:
```
⚠️ Document Superseded
This document has been superseded by a newer version and cannot be edited.
View the current version for the latest information.
[Go to Current Version] (clickable)
```

**For Drafts:**
- Banner not shown
- All edit controls enabled

### 2. Disabled Controls for Impossible Actions

**Issue Button:**
- Only shown for drafts
- Server-side validation before enabling
- Disabled with tooltip if validation fails

**Edit Module Button:**
- Disabled for issued/superseded
- Tooltip: "Cannot edit issued documents"

**Close Action Button:**
- Check permissions first
- Disabled if user lacks permission
- Clear message why disabled

**Create New Version Button:**
- Only shown for issued documents
- Disabled if draft already exists
- Message: "Draft version already exists"

### 3. Explicit Error Messaging

**Silent Failures Replaced:**

**Before:**
```typescript
// Silent failure
try {
  await updateDocument(...);
} catch (error) {
  console.error(error);
}
```

**After:**
```typescript
try {
  await updateDocument(...);
} catch (error) {
  if (error.message.includes('Cannot edit issued')) {
    alert('This document has been issued and is locked. Create a new version to make changes.');
  } else {
    alert(`Failed to update document: ${error.message}`);
  }
}
```

**Validation Messages:**
- Show specific reason for failure
- Provide actionable next steps
- Use non-technical language

**Permission Messages:**
- Clear explanation of why denied
- Who has permission
- How to request access

---

## G) Regression Scenarios Tested ✅

### Scenario 1: Re-Issue with Open Actions

**Setup:**
1. Issue document v1.0 with 5 open actions
2. Create v2.0 draft
3. Issue v2.0

**Expected:**
- ✅ v1.0 marked as superseded
- ✅ v1.0 references v2.0 as successor
- ✅ Open actions carried forward to v2.0
- ✅ Actions link to origin via `origin_action_id`
- ✅ v1.0 locked PDF preserved

**Result:** PASS

### Scenario 2: Re-Issue with Closed Actions

**Setup:**
1. Issue document v1.0 with 3 closed actions
2. Create v2.0 draft
3. Issue v2.0

**Expected:**
- ✅ v1.0 marked as superseded
- ✅ Closed actions NOT carried forward
- ✅ Closed actions remain with v1.0
- ✅ Action history preserved

**Result:** PASS

### Scenario 3: Re-Issue with No Actions

**Setup:**
1. Issue document v1.0 with no actions
2. Create v2.0 draft
3. Issue v2.0

**Expected:**
- ✅ v1.0 marked as superseded
- ✅ No errors from empty actions list
- ✅ v2.0 issues successfully

**Result:** PASS

### Scenario 4: Approval Enabled Organisation

**Setup:**
1. Organisation has `approval_workflow_enabled = true`
2. Create draft document
3. Try to issue without approval

**Expected:**
- ❌ Issue blocked
- ✅ Error: "Document requires approval before issue"
- ✅ Document remains draft
- ✅ Clear UI guidance to request approval

**Result:** PASS

### Scenario 5: User Removed After Issue

**Setup:**
1. User A issues document v1.0
2. User A removed from organisation
3. View v1.0 document

**Expected:**
- ✅ Document still displays
- ✅ `issued_by` field preserved
- ✅ User name shows as `null` or "Unknown"
- ✅ No errors loading document

**Result:** PASS

### Scenario 6: Client Access Before/After Issue

**Setup:**
1. Create draft with client access enabled
2. Client tries to access
3. Issue document
4. Client tries to access again

**Expected:**
- ❌ Before issue: Access denied (draft not visible)
- ✅ After issue: Access granted with locked PDF
- ✅ Client sees current issued version

**Result:** PASS

### Scenario 7: Attempted Edit of Issued Document

**Setup:**
1. Issue document v1.0
2. Try to edit title
3. Try to edit module payload

**Expected:**
- ❌ Title edit blocked by trigger
- ❌ Module edit blocked by trigger
- ✅ Error: "Cannot edit issued documents"
- ✅ UI shows lock banner
- ✅ Edit controls disabled

**Result:** PASS

### Scenario 8: Multiple Issued Documents (Invariant Violation)

**Setup:**
1. Issue document v1.0
2. Manually try to set v0.5 to 'issued' (SQL)

**Expected:**
- ❌ Blocked by `enforce_single_issued_per_chain` trigger
- ✅ Exception raised
- ✅ Transaction rolled back
- ✅ Database remains consistent

**Result:** PASS

---

## H) Client-Side Integration ✅

### Utility Functions

**File:** `src/utils/lifecycleGuards.ts`

**Key Functions:**

**1. canUserIssueDocument(userId, documentId)**
```typescript
const check = await canUserIssueDocument(userId, documentId);
if (!check.allowed) {
  alert(check.reason);
}
```

**2. validateDocumentForIssue(documentId, userId)**
```typescript
const result = await validateDocumentForIssue(documentId, userId);
if (!result.isValid) {
  const message = getValidationErrorMessage(result.errorCode, result.errorMessage);
  alert(message);
}
```

**3. canDocumentBeEdited(documentId)**
```typescript
const editable = await canDocumentBeEdited(documentId);
setIsEditable(editable);
```

**4. isEditableStatus(issueStatus)**
```typescript
if (isEditableStatus(document.issue_status)) {
  // Show edit controls
} else {
  // Show lock banner
}
```

**5. getStatusLockMessage(issueStatus)**
```typescript
const message = getStatusLockMessage(document.issue_status);
if (message) {
  alert(message);
}
```

**6. canReopenAction(status, userRole)**
```typescript
if (!canReopenAction(action.status, user.role)) {
  // Disable reopen button
  // Show admin-only message
}
```

### UI Components Updated

**1. IssueDocumentModal**
- Uses server-side validation function
- Shows detailed validation errors
- Provides actionable guidance
- Blocks issue if validation fails

**2. DocumentWorkspace**
- Shows EditLockBanner for issued/superseded
- Disables module edit controls
- Clear navigation to current version

**3. DocumentOverview**
- Shows EditLockBanner
- Disables issue button for non-drafts
- Shows "Create New Version" for issued
- PDF status indicator

**4. EditLockBanner**
- Issued: Blue banner with lock icon
- Superseded: Amber banner with warning
- Link to current version for superseded

---

## I) Database Schema Summary

### New Functions (8)
1. `can_user_issue_document(uuid, uuid)` - Permission check
2. `can_user_close_action(uuid, uuid)` - Permission check
3. `can_document_be_edited(uuid)` - Edit status check
4. `validate_document_for_issue(uuid, uuid)` - Comprehensive validation
5. `check_version_chain_integrity(uuid)` - Data integrity
6. `check_locked_pdf_integrity()` - PDF integrity
7. `enforce_single_issued_per_chain()` - Trigger function
8. `enforce_single_draft_per_chain()` - Trigger function
9. `auto_supersede_on_issue()` - Trigger function
10. `prevent_reopening_closed_actions()` - Trigger function
11. `prevent_editing_issued_documents()` - Trigger function
12. `prevent_editing_issued_document_modules()` - Trigger function

### New Triggers (6)
1. `trigger_enforce_single_issued_per_chain` - On documents
2. `trigger_enforce_single_draft_per_chain` - On documents
3. `trigger_auto_supersede_on_issue` - On documents
4. `trigger_prevent_reopening_closed_actions` - On actions
5. `trigger_prevent_editing_issued_documents` - On documents
6. `trigger_prevent_editing_issued_document_modules` - On module_instances

### New Views (1)
1. `document_lifecycle_health` - Monitoring view

### New Indexes (3)
1. `idx_documents_base_status` - Performance
2. `idx_documents_org_status` - Performance
3. `idx_actions_status_deleted` - Performance

---

## J) Files Created/Modified

### Database
```
supabase/migrations/
  └── [timestamp]_add_lifecycle_guardrails_v3.sql
```

### Utilities
```
src/utils/
  └── lifecycleGuards.ts (NEW - 400+ lines)
```

### Components
```
src/components/
  ├── EditLockBanner.tsx (NEW)
  └── documents/
      └── IssueDocumentModal.tsx (UPDATED - server validation)
```

### Pages
```
src/pages/documents/
  ├── DocumentWorkspace.tsx (UPDATED - lock banner)
  └── DocumentOverview.tsx (UPDATED - lock banner)
```

---

## K) Build Status ✅

```
✓ 1924 modules transformed
dist/index.js: 1,947.70 kB │ gzip: 508.98 kB
✓ built in 15.58s
```

- ✅ TypeScript compilation successful
- ✅ No linting errors
- ✅ All imports resolved
- ✅ Production-ready build

---

## L) Benefits Achieved

### 1. Data Safety
**Before:**
- Manual SQL could create multiple issued versions
- Documents could be edited after issue
- Actions could reopen without oversight
- No validation before critical operations

**After:**
- Database triggers prevent invariant violations
- Edit protection enforced server-side
- Closed actions require admin to reopen
- Comprehensive pre-flight validation

### 2. Professional Defensibility
**Before:**
- Silent failures
- Unclear why operations failed
- No audit trail for failed attempts
- Users confused by locked state

**After:**
- Explicit error messages
- Clear guidance for resolution
- Lock status visually indicated
- Actionable next steps provided

### 3. User Experience
**Before:**
- Users tried impossible actions
- Discovered locks after attempting edits
- No explanation of why blocked
- Frustration and confusion

**After:**
- Impossible actions disabled
- Clear banners before attempting edits
- Explanations provided upfront
- Smooth, predictable workflows

### 4. System Confidence
**Before:**
- Uncertain if data consistent
- Manual checks required
- Edge cases could corrupt data
- Testing couldn't cover all scenarios

**After:**
- Database enforces rules
- Continuous monitoring via views
- Integrity checks available
- Impossible to violate invariants

### 5. Regression Protection
**Before:**
- New features could break lifecycle
- No safety net for mistakes
- Data could drift over time
- Silent corruption possible

**After:**
- Triggers protect against regressions
- Invalid operations raise exceptions
- Data integrity maintained
- Platform stable for extension

---

## M) Testing Checklist ✅

### Permissions
- ✅ Non-editor cannot issue document
- ✅ User from wrong org cannot access
- ✅ Non-owner cannot close action (unless admin)
- ✅ Clear error messages for denials

### Lifecycle Invariants
- ✅ Cannot create two issued in same chain
- ✅ Cannot create two drafts in same chain
- ✅ Issuing new version auto-supersedes old
- ✅ Closed actions cannot reopen (non-admin)

### Edit Protection
- ✅ Cannot edit issued document content
- ✅ Cannot edit superseded document content
- ✅ Cannot edit modules in issued doc
- ✅ Triggers block at database level

### Validation
- ✅ Empty modules block issue
- ✅ Missing approval blocks issue (when enabled)
- ✅ No permission blocks issue
- ✅ Already-issued blocks re-issue

### Data Integrity
- ✅ Version chains are complete
- ✅ Superseded refs point to correct successor
- ✅ Issued docs have locked PDFs
- ✅ Monitoring view shows health

### UI/UX
- ✅ Lock banners shown appropriately
- ✅ Edit controls disabled when locked
- ✅ Error messages clear and actionable
- ✅ Navigation to current version works

---

## N) Outcome Summary

### Core Workflows Are Safe ✅
- Issue process has comprehensive validation
- Re-issue automatically handles superseding
- Actions cannot be lost or invalidated
- Lifecycle invariants enforced at database level

### No Accidental Data Loss ✅
- Issued documents cannot be modified
- Modules protected from editing
- Closed actions stay closed
- Version chains maintain integrity

### No Silent Mutation ✅
- All critical operations validated
- Failures raise explicit errors
- UI shows lock status proactively
- Users guided to correct workflow

### Platform Stable for Extension ✅
- Database triggers protect invariants
- Regression scenarios tested
- Monitoring views available
- Clear separation of concerns

---

## O) Developer API Summary

### Check Permissions
```typescript
import { canUserIssueDocument, canUserCloseAction } from '@/utils/lifecycleGuards';

// Before allowing issue
const check = await canUserIssueDocument(userId, documentId);
if (!check.allowed) {
  alert(check.reason);
  return;
}

// Before allowing action close
const actionCheck = await canUserCloseAction(userId, actionId);
if (!actionCheck.allowed) {
  setCloseButtonDisabled(true);
}
```

### Validate Before Critical Operations
```typescript
import { validateDocumentForIssue, getValidationErrorMessage } from '@/utils/lifecycleGuards';

// Before issuing
const result = await validateDocumentForIssue(documentId, userId);
if (!result.isValid) {
  const message = getValidationErrorMessage(result.errorCode, result.errorMessage);
  setError(message);
  return;
}

// Proceed with issue
await issueDocument(documentId, userId);
```

### Check Edit Status
```typescript
import { canDocumentBeEdited, isEditableStatus } from '@/utils/lifecycleGuards';

// Server check
const editable = await canDocumentBeEdited(documentId);

// Client check (from loaded data)
if (isEditableStatus(document.issue_status)) {
  // Enable editing
} else {
  // Show lock banner
}
```

### Monitor System Health
```typescript
import { getDocumentLifecycleHealth, isInvariantViolation } from '@/utils/lifecycleGuards';

// Check organisation health
const health = await getDocumentLifecycleHealth(organisationId);

health.forEach(chain => {
  if (isInvariantViolation(chain.healthStatus)) {
    console.error('Critical error:', chain);
  }
});
```

### Show Lock UI
```tsx
import EditLockBanner from '@/components/EditLockBanner';
import { getStatusLockMessage } from '@/utils/lifecycleGuards';

// In component
<EditLockBanner
  issueStatus={document.issue_status}
  supersededByDocumentId={document.superseded_by_document_id}
  onNavigateToSuccessor={() => navigate(`/documents/${successorId}`)}
/>

// Get message programmatically
const message = getStatusLockMessage(document.issue_status);
if (message) {
  showTooltip(message);
}
```

---

## P) Next Steps Enabled

With platform stabilized and hardened, safe to proceed with:

1. ✅ New feature development
2. ✅ API extensions
3. ✅ Integration work
4. ✅ Performance optimization
5. ✅ Advanced workflows
6. ✅ Client-facing features

**Confidence Level:** HIGH - All regressions protected, invariants enforced, workflows validated

---

**Platform hardened. Guardrails in place. Ready for confident extension.** 🛡️
