# Evidence & Attachment Locking Implementation - Complete ✅

**Phase:** Outputs & Professional Defence — Step 3
**Date:** 2026-01-22

## Overview

Comprehensive evidence and attachment system with version-safe locking, ensuring issued documents remain defensible and immutable. Evidence can be carried forward to new versions without file duplication.

## Implementation Details

### 1. Database Schema ✓

**Enhanced attachments Table:**

```sql
CREATE TABLE attachments (
  id uuid PRIMARY KEY,
  organisation_id uuid NOT NULL,
  document_id uuid NOT NULL (version-specific),
  base_document_id uuid NULL (document family),
  module_instance_id uuid NULL,
  action_id uuid NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size_bytes bigint NULL,
  caption text NULL,
  taken_at timestamptz NULL,
  uploaded_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL (soft delete)
);
```

**New Fields:**
- `base_document_id`: Links evidence to document family across versions
- `deleted_at`: Soft delete timestamp (null = active)

**Indexes:**
- `idx_attachments_not_deleted`: Fast queries for active evidence
- `idx_attachments_base_doc`: Efficient family-level queries

### 2. Locking Rules (RLS Enforced) ✓

**Helper Function:**
```sql
CREATE FUNCTION is_document_mutable(doc_id uuid) RETURNS boolean
  -- Returns true only if document.issue_status = 'draft'
```

**RLS Policies:**

1. **SELECT** - All users can view evidence in their organisation
   - Includes soft-deleted items for audit trail
   - Cross-org access blocked

2. **INSERT** - Only allowed on draft documents
   ```sql
   WITH CHECK (
     organisation_id IN (user's org)
     AND is_document_mutable(document_id)
   )
   ```

3. **UPDATE** - Only allowed on draft documents
   ```sql
   USING (organisation_id IN (user's org) AND is_document_mutable(document_id))
   WITH CHECK (organisation_id IN (user's org) AND is_document_mutable(document_id))
   ```

4. **DELETE** - Only allowed on draft documents
   ```sql
   USING (organisation_id IN (user's org) AND is_document_mutable(document_id))
   ```

**Result:** Database-level enforcement that issued/superseded documents cannot have evidence modified.

### 3. Storage Structure ✓

**Supabase Storage Bucket:** `evidence`

**Path Convention:**
```
evidence/{organisation_id}/{document_id}/{yyyy-mm-dd}/{uuid}.{ext}
```

**Example:**
```
evidence/abc-123/doc-456/2026-01-22/7f8e9d10-1234-5678-9abc-def012345678.jpg
```

**File Limits:**
- Max file size: 10MB
- Allowed types: image/jpeg, image/jpg, image/png, image/webp, application/pdf

**Storage Security:**
- Read: Authenticated users can read files from their organisation
- Write: Authenticated users can upload to their organisation path only
- Delete: Authenticated users can delete from their organisation path only
- Cross-org access blocked at storage policy level

### 4. Carry-Forward Evidence ✓

**Implementation:**

When creating a new version with `carryForwardEvidence = true`:

1. Query all active evidence from previous version:
   ```sql
   SELECT * FROM attachments
   WHERE document_id = previousDocumentId
     AND deleted_at IS NULL
   ```

2. Insert new rows for new version:
   ```javascript
   {
     document_id: newDocumentId,           // NEW version ID
     base_document_id: baseDocumentId,     // SAME family
     file_path: originalFilePath,          // SAME storage path
     file_name: originalFileName,          // SAME filename
     // ... other fields copied
     uploaded_by: currentUserId,           // NEW uploader
     created_at: now()                     // NEW timestamp
   }
   ```

3. **No file duplication** - files remain in original storage location
4. **New references** - database rows created for new document version
5. **Independent lifecycle** - new version can manage its evidence independently

**Checkbox in CreateNewVersionModal:**
- Default: `checked` (recommended)
- User can uncheck to start with no evidence
- Clear description of behavior

### 5. Evidence Page UI ✓

**Route:** `/documents/{id}/evidence`

**Page Features:**

1. **Header Section:**
   - Document title with version number
   - Issue status badge (draft/issued/superseded)
   - Upload button (hidden when locked)

2. **Lock Banner (when issued/superseded):**
   ```
   [🔒 Evidence Locked]
   This document is [issued/superseded] and evidence is locked.
   Evidence cannot be added, edited, or deleted.
   To add new evidence, create a new version of this document.
   ```

3. **Upload Section (draft only):**
   - Optional caption input field
   - File picker supporting multiple files
   - Accepts: images (jpg, png, webp) and PDFs
   - Upload button with loading state

4. **Evidence List:**
   - **File icon** - Image or PDF indicator
   - **File name** - Truncated with full name on hover
   - **File size** - Formatted (B, KB, MB)
   - **Upload date** - Localized date format
   - **Caption** - Italic text below filename (if present)
   - **Actions:**
     - **Download** - Always available (all statuses)
     - **Edit caption** - Draft only
     - **Delete** - Draft only (with confirmation)

5. **Empty State:**
   - Friendly icon and message
   - Context-aware text based on lock status

6. **Error Handling:**
   - Failed uploads show clear error messages
   - RLS violations caught and displayed
   - Network errors handled gracefully

**UI States:**

| Document Status | Upload | Edit | Delete | Download |
|----------------|--------|------|--------|----------|
| Draft          | ✅     | ✅   | ✅     | ✅       |
| Issued         | ❌     | ❌   | ❌     | ✅       |
| Superseded     | ❌     | ❌   | ❌     | ✅       |

### 6. Soft Delete Implementation ✓

**Delete Behavior:**

```typescript
// Soft delete - sets deleted_at timestamp
UPDATE attachments
SET deleted_at = now()
WHERE id = attachmentId;
```

**Benefits:**
- Audit trail maintained
- No accidental data loss
- Can be restored if needed
- Storage cleanup can be done separately

**File Storage:**
- Files remain in storage after soft delete
- Can be cleaned up in batch process later
- Check for references before physical deletion

### 7. Utility Functions ✓

**Created in:** `src/utils/evidenceManagement.ts`

| Function | Purpose |
|----------|---------|
| `getDocumentStatus()` | Fetch document issue_status and version |
| `isDocumentLocked()` | Check if document is issued/superseded |
| `getDocumentAttachments()` | Fetch all active evidence for document |
| `uploadAttachment()` | Upload file with locking checks |
| `deleteAttachment()` | Soft delete with locking checks |
| `updateAttachmentCaption()` | Update caption with locking checks |
| `downloadAttachment()` | Download file as blob |
| `carryForwardEvidence()` | Copy evidence refs to new version |
| `formatFileSize()` | Human-readable file size |
| `getFileIcon()` | Emoji icon for file type |

**All functions include:**
- Locking checks before mutations
- Clear error messages
- Promise-based async/await
- TypeScript type safety

### 8. Integration with Versioning ✓

**Updated:** `src/utils/documentVersioning.ts`

**createNewVersion() signature:**
```typescript
export async function createNewVersion(
  baseDocumentId: string,
  userId: string,
  organisationId: string,
  shouldCarryForwardEvidence: boolean = true
): Promise<CreateNewVersionResult>
```

**Process:**
1. Create new document (draft status)
2. Copy modules and payload
3. Carry forward open actions
4. **NEW:** Carry forward evidence (if enabled)
5. Return new document ID and version number

**Evidence Carry Forward:**
```typescript
if (shouldCarryForwardEvidence) {
  const result = await carryForwardEvidence(
    currentIssued.id,
    newDocument.id,
    baseDocumentId,
    organisationId
  );
  // Errors logged but don't block version creation
}
```

### 9. CreateNewVersionModal Updates ✓

**New State:**
```typescript
const [carryForwardEvidence, setCarryForwardEvidence] = useState(true);
```

**New UI Element:**
```jsx
<label className="flex items-start gap-3 cursor-pointer">
  <input
    type="checkbox"
    checked={carryForwardEvidence}
    onChange={(e) => setCarryForwardEvidence(e.target.checked)}
  />
  <div>
    <p className="font-medium">Carry forward evidence and attachments</p>
    <p className="text-sm text-neutral-600">
      Evidence files will be linked to the new version without duplication.
      Recommended for maintaining continuity of evidence across versions.
    </p>
  </div>
</label>
```

**Updated "What will be copied" list:**
- All module data and form content
- Open, In Progress, and Deferred actions
- Document title and metadata
- **NEW:** Evidence and attachments (if enabled below)

## Data Flow

### Upload Flow

```
User selects file(s) on draft document
    ↓
Check document status
    ↓
If locked → Show error and abort
    ↓
If draft → Upload to storage
    ↓
Generate storage path with UUID
    ↓
Upload file to Supabase Storage
    ↓
Insert attachment row in database
    ↓
RLS policy checks:
    - User in same org? ✓
    - Document is draft? ✓
    ↓
Success → Refresh evidence list
```

### Delete Flow

```
User clicks delete on evidence
    ↓
Check document status
    ↓
If locked → Show error and abort
    ↓
If draft → Confirm with user
    ↓
Soft delete: SET deleted_at = now()
    ↓
RLS policy checks:
    - User in same org? ✓
    - Document is draft? ✓
    ↓
Success → Refresh evidence list
```

### Carry Forward Flow

```
User creates new version with carry-forward enabled
    ↓
Create new document (draft, v2)
    ↓
Copy modules and actions
    ↓
Query active evidence from v1
    ↓
For each evidence:
    Insert new row with:
    - document_id = v2 ID
    - file_path = SAME as v1
    - base_document_id = SAME
    ↓
Success → v2 has all v1 evidence references
```

## Security Model

### Defense in Depth

1. **RLS Layer (Database)**
   - Enforced at PostgreSQL level
   - Cannot be bypassed by application code
   - Checks org membership
   - Checks document mutability
   - Blocks cross-org access

2. **Application Layer**
   - Pre-flight checks before operations
   - Clear error messages to users
   - Validates file types and sizes
   - Prevents UI actions on locked docs

3. **Storage Layer**
   - Organisation-based path isolation
   - Storage policies check folder permissions
   - File type restrictions
   - Size limits enforced

### Attack Vectors Mitigated

| Attack | Mitigation |
|--------|-----------|
| Upload to issued doc | RLS blocks INSERT |
| Delete from issued doc | RLS blocks DELETE |
| Edit issued evidence | RLS blocks UPDATE |
| Cross-org evidence access | RLS + Storage policies |
| File type bypass | Storage MIME restrictions |
| Oversized uploads | Storage size limits |
| SQL injection | Parameterized queries |
| Direct storage access | Storage bucket policies |

## Testing Scenarios

### ✅ Scenario 1: Upload to Draft Document
**Given:** Document is in draft status
**When:** User uploads evidence
**Then:** File uploaded to storage, row created, evidence appears in list

### ✅ Scenario 2: Upload to Issued Document (Blocked)
**Given:** Document is issued
**When:** User attempts to upload
**Then:** Upload blocked with error message, banner shows lock status

### ✅ Scenario 3: Delete from Draft
**Given:** Document is draft with evidence
**When:** User deletes evidence
**Then:** Evidence soft-deleted, removed from list

### ✅ Scenario 4: Delete from Issued (Blocked)
**Given:** Document is issued with evidence
**When:** User attempts to delete
**Then:** Delete blocked with error message

### ✅ Scenario 5: Create New Version with Carry Forward
**Given:** Issued v1 with 5 evidence files
**When:** Create v2 with carry-forward enabled
**Then:** v2 (draft) has 5 evidence references, same file paths, no duplication

### ✅ Scenario 6: Create New Version without Carry Forward
**Given:** Issued v1 with 5 evidence files
**When:** Create v2 with carry-forward disabled
**Then:** v2 (draft) has 0 evidence files

### ✅ Scenario 7: Download from Any Status
**Given:** Document has evidence (any status)
**When:** User clicks download
**Then:** File downloads successfully

### ✅ Scenario 8: Edit Caption on Draft
**Given:** Document is draft with evidence
**When:** User edits caption
**Then:** Caption updated and displayed

### ✅ Scenario 9: Edit Caption on Issued (Blocked)
**Given:** Document is issued with evidence
**When:** User attempts to edit caption
**Then:** Edit blocked with error message

### ✅ Scenario 10: Cross-Org Access (Blocked)
**Given:** Evidence belongs to Org A
**When:** User from Org B attempts to access
**Then:** Query returns empty, storage access denied

## Key Features Summary

1. **Version-Safe Locking**: Issued documents cannot have evidence modified
2. **Database Enforcement**: RLS policies prevent bypass attempts
3. **Soft Delete**: Evidence deleted via timestamp, not hard removal
4. **Carry Forward**: Evidence copied to new versions without file duplication
5. **Storage Isolation**: Files stored in org-specific paths
6. **Clear UI Indicators**: Lock banners and disabled actions
7. **Comprehensive Error Handling**: User-friendly messages
8. **Audit Trail**: All evidence changes tracked
9. **File Type Restrictions**: Only images and PDFs allowed
10. **Size Limits**: 10MB max per file

## File Structure

| File | Purpose |
|------|---------|
| `supabase/migrations/...add_version_locking_to_attachments_v2.sql` | Database schema updates |
| `src/utils/evidenceManagement.ts` | Evidence utility functions |
| `src/utils/documentVersioning.ts` | Updated with carry-forward |
| `src/pages/documents/DocumentEvidenceV2.tsx` | New Evidence page UI |
| `src/components/documents/CreateNewVersionModal.tsx` | Updated with checkbox |

## Database Functions

| Function | Security | Purpose |
|----------|----------|---------|
| `is_document_mutable(uuid)` | SECURITY DEFINER | Check if document is draft |

## Migration Applied

**Filename:** `20260122_add_version_locking_to_attachments_v2.sql`

**Changes:**
- Added `base_document_id` column
- Added `deleted_at` column
- Backfilled base_document_id from documents table
- Created helper function `is_document_mutable()`
- Updated all RLS policies with locking checks
- Created indexes for performance

## Routes

| Route | Purpose |
|-------|---------|
| `/documents/:id/evidence` | Evidence management page |

## Next Steps

With Evidence Locking complete, the system now provides:
- ✅ Version-safe evidence management
- ✅ Immutable evidence on issued documents
- ✅ Evidence carry-forward without duplication
- ✅ Database-enforced locking
- ✅ Comprehensive audit trail
- ✅ User-friendly UI with clear indicators

**Ready for:** Production use with defensible, version-locked evidence management
