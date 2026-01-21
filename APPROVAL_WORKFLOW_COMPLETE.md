# Approval vs Issue Status - Clean Separation ✅

## Status: Production Ready

Complete separation of internal approval from formal document issue, ensuring clear governance and no confusion between these distinct states.

---

## Overview

This implementation provides clear separation between:

- **Approval** - Internal quality control, peer review, or management sign-off
- **Issue** - Formal release of the document to clients

Key principles:
- **Approval NEVER implies issue**
- Approval is internal-only, not client-visible
- Issue is a deliberate, explicit action with validation gates
- Rejection blocks issue until resolved
- Approval workflow is optional and configurable per organisation

---

## A) Database Schema ✅

**Migration:** `add_approval_workflow_separation_v2`

### New Columns on `documents` table:

1. **`approval_status`** (text, NOT NULL, DEFAULT 'not_required')
   - Values: `'not_required'` | `'pending'` | `'approved'` | `'rejected'`
   - Internal state only (not client-visible)
   - Separate from `issue_status`
   - Check constraint enforces valid values

2. **`approved_by`** (uuid, nullable, FK to auth.users)
   - User who approved the document
   - NOT the same as `issued_by`
   - NULL for non-approved documents

3. **`approval_date`** (date, nullable)
   - Date of internal approval
   - NOT the same as `issue_date`
   - NULL for non-approved documents

4. **`approval_notes`** (text, nullable)
   - Approval comments or rejection reason
   - Internal only
   - Required for rejections

### New Table: `organisation_settings`

```sql
CREATE TABLE organisation_settings (
  id uuid PRIMARY KEY,
  organisation_id uuid NOT NULL UNIQUE,
  approval_required boolean DEFAULT false,
  created_at timestamptz,
  updated_at timestamptz
);
```

**Purpose:**
- Store per-organisation configuration
- `approval_required` - Whether approval workflow is mandatory before issue
- Disabled by default (false)
- Can be enabled by org admins

**RLS Policies:**
- Users can view their own organisation's settings
- Only org admins and platform admins can update settings

### Indexes:

- `idx_documents_approval_status` - Filter by approval status
- `idx_documents_approved_by` - Query by approver
- `idx_organisation_settings_org_id` - Fast org settings lookup

### Data Migration:

Existing records automatically:
- Set to `approval_status = 'not_required'`
- All organisations default to `approval_required = false`
- No impact on existing workflows

---

## B) Approval States

### 1. Not Required (Default)

**Characteristics:**
- Default state for all documents
- Used when approval workflow is disabled
- Can still transition to pending if user requests approval
- Does NOT block issue

**Use Case:**
- Small organisations or single-user teams
- When approval is optional
- When approval workflow is disabled

### 2. Pending

**Characteristics:**
- Document awaiting approval
- Can still be edited (it's a draft)
- If org has `approval_required = true`, blocks issue
- Shows amber badge "Pending Approval"

**Use Case:**
- Document submitted for quality review
- Awaiting management sign-off
- Peer review in progress

### 3. Approved

**Characteristics:**
- Document internally approved
- Can still be edited (it's a draft)
- Approval can be cleared if needed
- Shows green badge "Approved"
- Allows issue if all other validations pass

**Use Case:**
- Quality review passed
- Management has signed off
- Ready for formal issue

### 4. Rejected

**Characteristics:**
- Document rejected by reviewer
- **BLOCKS ISSUE** regardless of org settings
- Rejection reason stored in `approval_notes`
- Shows red badge "Rejected"
- Must be addressed before requesting approval again

**Use Case:**
- Quality issues identified
- Does not meet standards
- Requires rework before issue

---

## C) Approval Workflow Rules

### Rule 1: Approval is Internal Only

- Approval status is NOT shown to clients
- Only visible to internal users
- Separate from issue status completely
- Does not appear on issued documents

### Rule 2: Draft Editability

- Draft documents can be edited regardless of approval state
- Approval does not lock the document
- Only `issue_status = 'issued'` or `'superseded'` locks document
- User can edit even after approval (but may need re-approval)

### Rule 3: Issue Blocking

Documents CANNOT be issued if:

1. **Rejection Block (Always):**
   ```typescript
   if (approval_status === 'rejected') {
     return BLOCKED;
   }
   ```

2. **Approval Required Block (Conditional):**
   ```typescript
   if (org.approval_required === true && approval_status !== 'approved') {
     return BLOCKED;
   }
   ```

3. **Validation Block (Always):**
   - Missing modules
   - Empty module data
   - Other validation failures

### Rule 4: Approval Persistence

- Approval history persists across versions
- When creating new version, approval status is NOT copied (starts as 'not_required')
- Each version has independent approval lifecycle
- Superseded documents retain their approval record

---

## D) Issue Validation with Approval Check ✅

### Updated Validation Function

```typescript
async function validateDocumentForIssue(documentId: string, organisationId: string) {
  const errors: string[] = [];

  // 1. Check issue_status
  if (document.issue_status !== 'draft') {
    errors.push('Only draft documents can be issued');
  }

  // 2. Check approval (NEW)
  const approvalCheck = await canIssueDocument(documentId, organisationId);
  if (!approvalCheck.canIssue) {
    errors.push(approvalCheck.reason);
    // Examples:
    // - "Cannot issue a rejected document. Please address the rejection reasons first."
    // - "Document must be approved before it can be issued. Current approval status: pending"
  }

  // 3. Check modules
  if (!modules || modules.length === 0) {
    errors.push('Document must have at least one module');
  }

  // 4. Check module data
  for (const module of modules) {
    if (!module.payload || Object.keys(module.payload).length === 0) {
      errors.push(`Module ${module.module_key} has no data`);
    }
  }

  return { valid: errors.length === 0, errors };
}
```

### Approval Check Logic

```typescript
async function canIssueDocument(documentId: string, organisationId: string) {
  const document = await getDocument(documentId);

  // Hard block: Rejected documents
  if (document.approval_status === 'rejected') {
    return {
      canIssue: false,
      reason: 'Cannot issue a rejected document. Please address the rejection reasons first.'
    };
  }

  // Conditional block: Approval required but not approved
  const orgSettings = await getOrganisationSettings(organisationId);
  if (orgSettings.approval_required && document.approval_status !== 'approved') {
    return {
      canIssue: false,
      reason: `Document must be approved before it can be issued. Current approval status: ${document.approval_status}`
    };
  }

  return { canIssue: true };
}
```

---

## E) UI Components ✅

### 1. ApprovalStatusBadge

**Purpose:** Display approval status consistently

**Props:**
```typescript
{
  status: 'not_required' | 'pending' | 'approved' | 'rejected';
  showIcon?: boolean;  // Default: true
  size?: 'sm' | 'md' | 'lg';  // Default: 'md'
}
```

**Visual Design:**
- **Not Required:** Neutral badge with minus icon
- **Pending:** Amber badge with clock icon
- **Approved:** Green badge with checkmark icon
- **Rejected:** Red badge with X icon

**Location:** Document overview header

### 2. ApprovalManagementModal

**Purpose:** Manage document approval workflow

**Features:**
- View current approval status and notes
- Request approval (any user on draft)
- Approve document (org admins only)
- Reject document with required reason (org admins only)
- Clear approval status (org admins only)
- Shows if approval is required in organisation

**Access Control:**
- **Any user on draft:** Can request approval
- **Org admins / platform admins:** Can approve, reject, clear

**Props:**
```typescript
{
  documentId: string;
  documentTitle: string;
  currentApprovalStatus: ApprovalStatus;
  approvalNotes: string | null;
  approvedBy: string | null;
  approvalDate: string | null;
  userId: string;
  organisationId: string;
  userRole: string;
  onClose: () => void;
  onSuccess: () => void;
}
```

### 3. Updated IssueDocumentModal

**Changes:**
- Now accepts `organisationId` parameter
- Validation includes approval check
- Displays approval-related errors clearly

**Error Messages:**
- "Cannot issue a rejected document. Please address the rejection reasons first."
- "Document must be approved before it can be issued. Current approval status: pending"

### 4. Updated DocumentOverview

**New UI Elements:**

1. **Approval Badge** (below document type)
   ```tsx
   <div className="flex items-center gap-2">
     <span className="text-xs text-neutral-500">Approval:</span>
     <ApprovalStatusBadge status={document.approval_status} size="sm" />
   </div>
   ```

2. **Manage Approval Button** (only on drafts)
   ```tsx
   {document.issue_status === 'draft' && (
     <button onClick={() => setShowApprovalModal(true)}>
       Manage Approval
     </button>
   )}
   ```

**Clear Separation:**
- Version status banner shows issue status (Draft/Issued/Superseded)
- Approval badge shows approval status (separate)
- Both visible but clearly distinct
- No ambiguity between the two

---

## F) Utility Functions ✅

### File: `src/utils/approvalWorkflow.ts`

**Key Functions:**

1. **`getOrganisationSettings(organisationId)`**
   - Fetch org settings from database
   - Returns: `OrganisationSettings | null`

2. **`isApprovalRequired(organisationId)`**
   - Check if approval workflow is mandatory
   - Returns: `boolean`

3. **`requestApproval(documentId, requestedBy, notes?)`**
   - Set status to 'pending'
   - Store optional notes
   - Returns: `{ success: boolean, error?: string }`

4. **`approveDocument(documentId, approvedBy, notes?)`**
   - Set status to 'approved'
   - Store approver and date
   - Optional approval notes
   - Returns: `{ success: boolean, error?: string }`

5. **`rejectDocument(documentId, rejectedBy, reason)`**
   - Set status to 'rejected'
   - Reason is REQUIRED
   - Clears approved_by and approval_date
   - Returns: `{ success: boolean, error?: string }`

6. **`clearApprovalStatus(documentId)`**
   - Reset to 'not_required'
   - Clear all approval fields
   - Returns: `{ success: boolean, error?: string }`

7. **`canIssueDocument(documentId, organisationId)`**
   - Check if document can be issued
   - Validates rejection and approval requirements
   - Returns: `{ canIssue: boolean, reason?: string }`

8. **`getApprovalStatusDisplay(status)`**
   - Get badge styling for status
   - Returns: `{ label, color, bgColor, borderColor }`

---

## G) Configuration & Defaults

### Organisation-Level Control

**Default State:**
- `approval_required = false` (approval workflow disabled)
- Documents default to `approval_status = 'not_required'`
- Issue button available once validation passes

**Enabling Approval Workflow:**

Org admins can enable approval requirement:
```sql
UPDATE organisation_settings
SET approval_required = true
WHERE organisation_id = 'xxx';
```

**Effect:**
- All draft documents must be approved before issue
- "Pending" or "Not Required" status blocks issue
- "Approved" status allows issue
- "Rejected" status always blocks issue

### Future Enhancement: UI for Settings

Currently done via database. Future: Add settings page for org admins to toggle `approval_required`.

---

## H) Workflow Examples

### Example 1: Approval Not Required (Default)

```
1. User creates document (draft)
   - approval_status = 'not_required'
   - issue_status = 'draft'

2. User completes modules
   - approval_status = 'not_required' (unchanged)

3. User clicks "Issue Document"
   - Validation passes (approval not required)
   - issue_status → 'issued'
   - Document issued successfully
```

### Example 2: Optional Approval (Not Required, But Used)

```
1. User creates document (draft)
   - approval_status = 'not_required'
   - org.approval_required = false

2. User clicks "Manage Approval" → "Request Approval"
   - approval_status → 'pending'
   - Still can be edited

3. Manager clicks "Manage Approval" → "Approve"
   - approval_status → 'approved'
   - approved_by = manager_id
   - approval_date = today

4. User clicks "Issue Document"
   - Validation passes
   - issue_status → 'issued'
```

### Example 3: Mandatory Approval (Required by Org)

```
1. User creates document (draft)
   - approval_status = 'not_required'
   - org.approval_required = true

2. User completes modules

3. User clicks "Issue Document"
   - Validation FAILS: "Document must be approved before it can be issued. Current approval status: not_required"
   - Issue blocked

4. User clicks "Manage Approval" → "Request Approval"
   - approval_status → 'pending'

5. User clicks "Issue Document"
   - Validation FAILS: "Document must be approved before it can be issued. Current approval status: pending"
   - Issue still blocked

6. Manager approves document
   - approval_status → 'approved'

7. User clicks "Issue Document"
   - Validation passes
   - issue_status → 'issued'
```

### Example 4: Rejection Workflow

```
1. User creates document (draft)
   - approval_status = 'not_required'

2. User requests approval
   - approval_status → 'pending'

3. Manager rejects with reason: "Missing hazard analysis in section 3"
   - approval_status → 'rejected'
   - approval_notes = "Missing hazard analysis in section 3"

4. User tries to issue
   - Validation FAILS: "Cannot issue a rejected document. Please address the rejection reasons first."
   - Hard blocked regardless of org settings

5. User fixes issues, requests approval again
   - approval_status → 'pending'

6. Manager approves
   - approval_status → 'approved'

7. User issues document
   - issue_status → 'issued'
```

---

## I) Audit Trail

### What is Tracked:

1. **Approval Actions:**
   - Who approved (approved_by)
   - When approved (approval_date)
   - Approval notes

2. **Rejection Actions:**
   - Who rejected (stored as audit event, not in approved_by)
   - Rejection reason (approval_notes)

3. **Issue Actions:**
   - Who issued (issued_by)
   - When issued (issue_date)
   - Separate from approval

### Future Enhancement: Approval History Table

For full audit trail:
```sql
CREATE TABLE approval_history (
  id uuid PRIMARY KEY,
  document_id uuid REFERENCES documents(id),
  action text, -- 'requested', 'approved', 'rejected', 'cleared'
  performed_by uuid REFERENCES auth.users(id),
  performed_at timestamptz,
  notes text
);
```

This would track every approval action with full history.

---

## J) UI/UX Improvements

### Clear Visual Separation

**Issue Status:**
- Large banner at top (Draft / Issued / Superseded)
- Green, amber, or neutral background
- Clear messaging about editability

**Approval Status:**
- Small badge below document type
- Label: "Approval:"
- Separate button: "Manage Approval"

**No Confusion:**
- Different colors
- Different locations
- Different terminology
- Clear purpose for each

### Error Messaging

Issue validation errors are clear and actionable:

❌ **Bad:**
"Cannot issue document"

✅ **Good:**
"Cannot issue a rejected document. Please address the rejection reasons first."

✅ **Good:**
"Document must be approved before it can be issued. Current approval status: pending"

---

## K) File Structure

### Database:
```
supabase/migrations/
  └── [timestamp]_add_approval_workflow_separation_v2.sql
```

### Utilities:
```
src/utils/
  ├── approvalWorkflow.ts  (all approval logic)
  └── documentVersioning.ts  (updated with approval checks)
```

### Components:
```
src/components/documents/
  ├── ApprovalStatusBadge.tsx  (badge display)
  ├── ApprovalManagementModal.tsx  (approval actions)
  ├── IssueDocumentModal.tsx  (updated with approval validation)
  └── ... (other existing components)
```

### Pages (Updated):
```
src/pages/documents/
  └── DocumentOverview.tsx  (added approval UI)
```

---

## L) Testing Checklist ✅

### Test 1: Default Behavior (Approval Not Required)
- ✅ New document has `approval_status = 'not_required'`
- ✅ Organisation has `approval_required = false`
- ✅ Can issue without approval
- ✅ Validation passes with no approval errors

### Test 2: Optional Approval Usage
- ✅ User can request approval on draft
- ✅ Status changes to 'pending'
- ✅ Org admin can approve
- ✅ Approval badge updates
- ✅ Can issue after approval

### Test 3: Mandatory Approval (Org Setting)
- ✅ Set `approval_required = true` on organisation
- ✅ Attempt to issue without approval
- ✅ Validation blocks with clear error
- ✅ Request and approve document
- ✅ Can now issue successfully

### Test 4: Rejection Workflow
- ✅ Manager can reject with reason
- ✅ Rejection reason stored in `approval_notes`
- ✅ Attempt to issue rejected document
- ✅ Hard blocked regardless of org settings
- ✅ Clear error: "Cannot issue a rejected document..."

### Test 5: Access Control
- ✅ Any user can request approval on draft
- ✅ Only org admins can approve
- ✅ Only org admins can reject
- ✅ Only org admins can clear status
- ✅ Non-admins see limited options

### Test 6: UI Separation
- ✅ Issue status and approval status clearly separated
- ✅ Different badges, colors, locations
- ✅ No confusion between the two concepts
- ✅ Both visible but distinct

### Test 7: Approval Persistence
- ✅ Approved document retains approval when issued
- ✅ Superseded document retains approval record
- ✅ New version starts with 'not_required' status

---

## M) Build Status ✅

```
✓ 1918 modules transformed
dist/index.js: 1,922.88 kB │ gzip: 503.40 kB
✓ built in 17.25s
```

- ✅ TypeScript compilation successful
- ✅ No linting errors
- ✅ All imports resolved
- ✅ Production-ready build

---

## N) Benefits & Impact

### 1. Clear Governance

- Separate internal approval from client-facing issue
- No confusion between quality control and formal release
- Audit trail for both processes

### 2. Flexibility

- Optional approval workflow (disabled by default)
- Can be enabled per organisation
- Suits both small teams and large enterprises

### 3. Risk Mitigation

- Hard rejection block prevents premature issue
- Mandatory approval option for high-stakes documents
- Clear validation gates

### 4. Professional Workflow

- Peer review process
- Management sign-off capability
- Quality control before client delivery

### 5. User Experience

- Clear visual separation
- Actionable error messages
- Simple approval management interface

---

## O) Future Enhancements

### 1. Organisation Settings UI

Add settings page for org admins:
- Toggle `approval_required`
- Configure default approvers
- Set approval notification preferences

### 2. Approval History Table

Full audit trail:
- Every approval action tracked
- Complete history across versions
- Exportable for compliance

### 3. Approval Notifications

- Email/in-app notifications when approval requested
- Notify requester when approved/rejected
- Reminder notifications for pending approvals

### 4. Multi-Level Approval

- Require multiple approvers
- Sequential approval chain
- Role-based approval requirements

### 5. Approval Templates

- Pre-defined approval checklists
- Document type-specific requirements
- Automated validation checks

### 6. Approval Delegation

- Assign alternate approvers
- Out-of-office delegation
- Approval routing rules

---

## P) Summary

Complete separation of approval and issue status with:

✅ **Clear Distinction** - Approval (internal) vs Issue (client-facing)
✅ **Optional Workflow** - Disabled by default, enable per org
✅ **Hard Gates** - Rejected documents cannot be issued
✅ **Flexible Control** - Can require approval or make it optional
✅ **Clear UI** - Visual separation prevents confusion
✅ **Access Control** - Role-based approval permissions
✅ **Audit Trail** - Track who approved when and why
✅ **Professional** - Suitable for insurer and audit scrutiny

**All acceptance criteria met. Production ready.**

---

## Q) API Summary for Developers

### Check if Approval is Required
```typescript
import { isApprovalRequired } from '@/utils/approvalWorkflow';
const required = await isApprovalRequired(organisationId);
```

### Request Approval
```typescript
import { requestApproval } from '@/utils/approvalWorkflow';
const result = await requestApproval(documentId, userId, 'Please review section 3');
```

### Approve Document
```typescript
import { approveDocument } from '@/utils/approvalWorkflow';
const result = await approveDocument(documentId, userId, 'All checks passed');
```

### Reject Document
```typescript
import { rejectDocument } from '@/utils/approvalWorkflow';
const result = await rejectDocument(documentId, userId, 'Missing hazard analysis');
```

### Check if Can Issue
```typescript
import { canIssueDocument } from '@/utils/approvalWorkflow';
const { canIssue, reason } = await canIssueDocument(documentId, organisationId);
if (!canIssue) {
  console.log(reason);
}
```

### Query Documents by Approval Status
```sql
-- Get all pending approvals
SELECT * FROM documents
WHERE approval_status = 'pending'
AND issue_status = 'draft';

-- Get approved documents
SELECT * FROM documents
WHERE approval_status = 'approved';

-- Get rejected documents needing attention
SELECT * FROM documents
WHERE approval_status = 'rejected'
AND issue_status = 'draft';
```
