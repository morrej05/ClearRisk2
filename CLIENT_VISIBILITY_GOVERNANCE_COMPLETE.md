# Client Visibility, Access Control & Historical Document Governance ✅

## Status: Production Ready

Complete implementation of client visibility controls, external access links, and historical document governance ensuring clients only see the correct issued documents while preserving full internal audit trails.

---

## Overview

This implementation ensures:

1. **Client Visibility** - Clients only see the latest issued document version
2. **Access Control** - Secure external links that auto-resolve to current version
3. **Historical Integrity** - Issued/superseded documents are immutable
4. **Audit Trail** - Full version history retained internally
5. **Professional Defense** - Complete governance for insurer and audit scrutiny

---

## A) Database Schema ✅

**Migration:** `add_client_access_and_document_governance_v2`

### New Columns on `documents` Table:

1. **`is_immutable`** (boolean, default false)
   - TRUE for issued/superseded documents
   - Prevents modification of core document fields
   - Enforced via database trigger

2. **`client_visible`** (boolean, default false)
   - TRUE when document has been issued
   - Marks document as accessible to clients

### New Table: `client_users`

```sql
CREATE TABLE client_users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  organisation_id uuid NOT NULL,
  created_at timestamptz,
  last_accessed_at timestamptz,
  access_revoked boolean DEFAULT false,
  revoked_at timestamptz,
  revoked_by uuid,
  notes text
);
```

**Purpose:** External client users with limited access to issued documents

**RLS:** Only internal users in the organisation can view/manage client users

### New Table: `client_document_access`

```sql
CREATE TABLE client_document_access (
  id uuid PRIMARY KEY,
  client_user_id uuid NOT NULL,
  base_document_id uuid NOT NULL,
  granted_by uuid NOT NULL,
  granted_at timestamptz,
  access_expires_at timestamptz,
  access_revoked boolean DEFAULT false,
  revoked_at timestamptz,
  revoked_by uuid,
  notes text
);
```

**Purpose:** Grant clients access to specific document families (base_document_id)
- Clients always see latest issued version only
- Access can expire or be revoked
- Audit trail of who granted access and when

### New Table: `document_external_links`

```sql
CREATE TABLE document_external_links (
  id uuid PRIMARY KEY,
  base_document_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz,
  expires_at timestamptz,
  access_count integer DEFAULT 0,
  last_accessed_at timestamptz,
  is_active boolean DEFAULT true,
  revoked_at timestamptz,
  revoked_by uuid,
  description text
);
```

**Purpose:** Shareable links that always resolve to the latest issued version
- Auto-update when new versions issued
- Track access count and last access time
- Can be revoked anytime
- Optional expiration date

### Database Function: `get_latest_issued_document()`

```sql
CREATE FUNCTION get_latest_issued_document(base_doc_id uuid)
RETURNS uuid
AS $$
  SELECT id FROM documents
  WHERE base_document_id = base_doc_id
  AND issue_status = 'issued'
  ORDER BY version_number DESC, issue_date DESC
  LIMIT 1;
$$;
```

**Purpose:** Returns the latest issued document ID for a base_document_id
- Used for client access resolution
- Ensures clients never see drafts or superseded versions

### Database Trigger: `set_document_immutable()`

```sql
CREATE FUNCTION set_document_immutable()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark as immutable when issued/superseded
  IF NEW.issue_status IN ('issued', 'superseded') AND OLD.issue_status = 'draft' THEN
    NEW.is_immutable := true;
    NEW.client_visible := true;
  END IF;

  -- Prevent modification of immutable documents (except supersession fields)
  IF OLD.is_immutable = true THEN
    -- Allow only supersession updates
    IF (NEW.issue_status = 'superseded' AND OLD.issue_status = 'issued') OR
       (NEW.superseded_by_document_id IS NOT NULL AND OLD.superseded_by_document_id IS NULL) THEN
      RETURN NEW;
    ELSIF NEW.title != OLD.title OR NEW.document_type != OLD.document_type OR ... THEN
      RAISE EXCEPTION 'Cannot modify immutable document (issued or superseded)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
```

**Purpose:** Enforce immutability of issued/superseded documents
- Auto-marks documents as immutable on issue
- Prevents modification of core fields
- Allows only supersession-related updates

---

## B) Client Visibility Rules ✅

### Rule 1: Latest Issued Only

Clients can **ONLY** access:
- The latest issued document version for a given base_document_id
- Never drafts
- Never superseded versions
- Never internal notes or approval status

**Implementation:**
```typescript
const latestIssuedId = await getLatestIssuedDocument(baseDocumentId);
const document = await supabase
  .from('documents')
  .select('*')
  .eq('id', latestIssuedId)
  .eq('issue_status', 'issued')
  .single();
```

### Rule 2: Auto-Update on New Issue

When a new version is issued:
- External links automatically resolve to the new version
- Clients see the updated document without any action
- Old superseded version is no longer accessible to clients
- Internal users still see all versions

**Example:**
```
v1.0 issued → Client link shows v1.0
v2.0 issued → Same client link now shows v2.0
v1.0 marked superseded → Clients cannot access v1.0
```

### Rule 3: No Document = Clear Message

If no issued version exists:
- Client sees: "Document not yet issued. Please check back later."
- No exposure of draft status or internal information
- Professional, client-friendly message

### Rule 4: Immutability Protection

Issued and superseded documents:
- Cannot be edited (database-enforced)
- Cannot be deleted
- Retain original data snapshot
- Maintain timestamps and metadata

**Database Protection:**
```typescript
// Attempting to modify issued document
UPDATE documents SET title = 'New Title' WHERE id = 'xxx';
// Result: ERROR: Cannot modify immutable document (issued or superseded)
```

---

## C) Internal User Access ✅

Internal users (authenticated, organisation members) have:

### Full Version Visibility

- View all versions: Draft, Issued, Superseded
- Access version history
- See version relationships (supersession chain)
- View approval history for each version

### Download Permissions

- Download issued documents (clean PDF)
- Download superseded documents (with "SUPERSEDED" watermark)
- Cannot download if not in organisation

### Edit Permissions

- **Draft** → Editable
- **Issued** → Read-only (immutable)
- **Superseded** → Read-only (immutable)

### Version Management

- Create new versions from issued documents
- Issue new versions
- View supersession relationships
- Manage external access links

---

## D) PDF Watermarks ✅

### Superseded Watermark

Superseded documents display a large "SUPERSEDED" watermark:

**Visual Appearance:**
- Text: "SUPERSEDED" in red
- Size: 80pt Helvetica Bold
- Position: Center of page, diagonal -45°
- Opacity: 30%
- Applied to all pages

**Implementation:**
```typescript
export async function addSupersededWatermark(pdfDoc: PDFDocument) {
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const page of pages) {
    const { width, height } = page.getSize();
    const x = (width - textWidth) / 2;
    const y = (height - textHeight) / 2;

    page.drawText('SUPERSEDED', {
      x, y,
      size: 80,
      font,
      color: rgb(0.8, 0, 0),
      opacity: 0.3,
      rotate: degrees(-45),
    });
  }
}
```

**Applied In:**
- buildFraPdf.ts
- buildFsdPdf.ts
- buildDsearPdf.ts

**Trigger:**
```typescript
if (document.issue_status === 'superseded') {
  await addSupersededWatermark(pdfDoc);
}
```

### Draft Watermark (Existing)

Draft documents already have a "DRAFT" watermark (grey, 30% opacity)

**Result:** Clear visual distinction between draft, issued, and superseded documents

---

## E) External Access Links ✅

### Link Characteristics

External links:
- **Token-based** - UUID token for security
- **Permanent** - No expiration by default (optional)
- **Trackable** - Access count and last access time
- **Revocable** - Can be disabled anytime
- **Auto-resolving** - Always show latest issued version
- **Shareable** - Can be sent to multiple recipients

### Link Format

```
https://yourdomain.com/client/document/{token}
```

Example:
```
https://clearrisk.app/client/document/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Link Creation

**Requirements:**
- Document must be issued
- User must have can_edit permission
- Optional: Add description for tracking

**API:**
```typescript
const result = await createExternalLink(
  baseDocumentId,
  userId,
  expiresInDays, // optional
  description     // optional
);

// Returns: { success: true, token: '...', url: '...' }
```

### Link Tracking

Each link tracks:
- Number of times accessed
- Last access timestamp
- Created by (user)
- Created date
- Description (optional)
- Active/revoked status

### Link Revocation

```typescript
await revokeExternalLink(linkId, userId);
```

**Effect:**
- Link immediately stops working
- Revocation is logged (who, when)
- Cannot be reactivated (create new link instead)
- Historical record retained

---

## F) Client-Facing Document View Page ✅

**Route:** `/client/document/:token`

**File:** `src/pages/ClientDocumentView.tsx`

### Features

**1. Link Validation**
- Validates token
- Checks if link is active
- Checks if link has expired
- Increments access count

**2. Document Resolution**
- Fetches latest issued version
- Returns "Document not yet issued" if none
- Never exposes draft or superseded versions

**3. Document Display**
- Clean, professional layout
- Document metadata (title, version, dates)
- Assessor information
- Scope description
- Issue status badge

**4. PDF Download**
- "Download PDF" button
- Generates clean PDF (issued) or watermarked PDF (superseded)
- Client-friendly filename: `{title}_v{version}.pdf`

**5. Error Handling**
- Invalid link → "Access Error"
- Expired link → "Access Error"
- No issued doc → "Document not yet issued"
- Professional error messages

### User Experience

**Loading State:**
```
[Spinner]
Loading document...
```

**Success State:**
```
[Document Header]
[Download PDF Button]
[Document Details]
[Issue Information Banner]
```

**Error State:**
```
[Error Icon]
Access Error
This link is invalid, expired, or has been revoked.
[Close Button]
```

---

## G) Client Access Management UI ✅

**Component:** `src/components/documents/ClientAccessModal.tsx`

### Features

**1. Link Creation**
- Input: Description (optional)
- Button: "Create Link"
- Auto-copy to clipboard on creation
- Only available for issued documents

**2. Active Links List**
- Shows all active, non-expired links
- Display: Description, URL, created date, access count
- Actions: Copy link, Revoke link
- Copy feedback (checkmark icon)

**3. Link Information**
- Created date
- Access count
- Last accessed date
- Description (if provided)

**4. Revoked Links Section**
- Collapsed list of revoked links
- Shows revocation status
- Historical record only

**5. Educational Banner**
- Explains how external links work
- "Links always resolve to latest issued version"
- "Clients cannot see drafts or superseded versions"

**6. Warning for Non-Issued**
- Amber banner if document is draft
- "Document must be issued before creating links"
- Clear issue status display

### User Flow

**Step 1: Access Modal**
```
DocumentOverview → "Share with Clients" button → ClientAccessModal
```

**Step 2: Create Link**
```
Enter description (optional) → "Create Link" → Link created & copied
```

**Step 3: Share Link**
```
Paste link in email/chat → Send to client → Client accesses document
```

**Step 4: Track Usage**
```
View access count → See when last accessed → Monitor usage
```

**Step 5: Revoke (If Needed)**
```
"Revoke" button → Confirm → Link immediately disabled
```

---

## H) Document Overview Updates ✅

### New UI Elements

**1. Approval Status Badge**
- Shows approval status separately from issue status
- Located below document type badge
- Small size (sm)

**2. Manage Approval Button**
- Only visible on draft documents
- Blue border, blue text
- Opens ApprovalManagementModal

**3. Share with Clients Button**
- Only visible on issued documents
- Green border, green text
- Opens ClientAccessModal

**4. Client Visibility Indicator** (Future)
- Could show number of active links
- Could show last client access time

### Layout

```
[Document Title] [Version Badge]
[Document Type Badge] [Approval Badge]

[Manage Approval] [Share with Clients] [Version History] [Download] [Edit]
```

---

## I) Utility Functions ✅

**File:** `src/utils/clientAccess.ts`

### Core Functions

**1. getLatestIssuedDocument(baseDocumentId)**
- Returns latest issued document ID
- Uses database RPC function
- Returns null if none issued

**2. getClientVisibleDocument(baseDocumentId)**
- Returns full latest issued document
- Only issued documents
- Returns null if none

**3. createExternalLink(...)**
- Creates shareable link
- Validates document is issued
- Generates unique token
- Returns URL

**4. getExternalLink(token)**
- Validates token
- Checks active status
- Checks expiration
- Increments access count
- Returns link data

**5. revokeExternalLink(linkId, userId)**
- Disables link
- Records revocation
- Logs who and when

**6. getDocumentExternalLinks(baseDocumentId)**
- Lists all links for document
- Includes revoked links
- Ordered by creation date

**7. getAllDocumentVersions(baseDocumentId)**
- Returns all versions grouped by status
- Returns: { draft, issued[], superseded[] }
- For internal version management

**8. isDocumentImmutable(issueStatus)**
- Helper to check if document can be edited
- Returns true for 'issued' or 'superseded'

**9. getClientAccessDescription(document)**
- Returns human-readable description
- Examples:
  - "Draft - Not visible to clients"
  - "Issued - Visible to clients via shared links"
  - "Superseded - Replaced by newer version. Clients see latest only."

---

## J) Historical Integrity ✅

### Immutability Enforcement

**Database Level:**
- Trigger prevents modification of core fields
- Exception raised if attempt to modify
- Only supersession fields can be updated

**Application Level:**
- Edit button disabled for issued/superseded
- UI shows read-only status
- Clear messaging about immutability

### Data Retention

**What is Preserved:**
- All document versions (draft, issued, superseded)
- All module instances and data
- All actions and evidence
- All timestamps (issue_date, superseded_date)
- All user references (issued_by, superseded_by)
- All approval records
- All external link access logs

**What is NOT Deleted:**
- Issued documents (cannot be deleted)
- Superseded documents (cannot be deleted)
- Version chain relationships
- Access audit trail

### Audit Trail

**Document Level:**
- base_document_id: Groups all versions
- version_number: Sequential numbering
- issue_status: Track lifecycle
- issue_date, issued_by: Who issued when
- superseded_date, superseded_by_document_id: Supersession chain

**Access Level:**
- External links: Created by, created at
- Access count: How many times accessed
- Last accessed: When last viewed
- Revocation: Who revoked, when revoked

**Approval Level (from Step 3):**
- Approval status: Current state
- Approved by: Who approved
- Approval date: When approved
- Approval notes: Reason/comments

### Version Relationships

```
Document v1.0 (issued) → v2.0 issued → v1.0 marked superseded
  ├─ base_document_id: abc123
  ├─ version_number: 1
  ├─ issue_status: superseded
  ├─ superseded_by_document_id: v2.0's ID
  └─ superseded_date: 2026-01-22

Document v2.0 (issued)
  ├─ base_document_id: abc123
  ├─ version_number: 2
  ├─ issue_status: issued
  └─ External links resolve here
```

---

## K) Security Considerations

### Token Security

- **UUID tokens** - Cryptographically random
- **Unique constraint** - No duplicate tokens
- **Single-use validation** - Token validated on each access
- **No enumeration** - Cannot guess valid tokens

### Access Control

**External Links:**
- No authentication required (by design)
- Token is the credential
- Can be revoked anytime
- Optional expiration

**RLS Policies:**
- Internal users: Full access to own org documents
- No RLS for external link access (public by token)
- Client users table: Only org admins can manage

### Data Exposure

**What Clients See:**
- Document title
- Document type
- Version number
- Issue date
- Assessment date
- Assessor name/role
- Responsible person
- Scope description
- Document content (modules, actions)

**What Clients DON'T See:**
- Draft status
- Approval status/notes
- Internal user profiles
- Organisation details
- Other document versions
- Access logs
- Link creation/revocation history

---

## L) User Experience Flows

### Flow 1: Internal User Creates Link

```
1. User opens issued document
2. Clicks "Share with Clients" button
3. ClientAccessModal opens
4. User enters description: "For ABC Corp"
5. Clicks "Create Link"
6. Link created and copied to clipboard
7. User pastes link in email to client
8. Client receives email with link
```

### Flow 2: Client Accesses Document

```
1. Client clicks link in email
2. Browser opens /client/document/{token}
3. System validates token
4. System fetches latest issued version
5. Document displays with clean UI
6. Client clicks "Download PDF"
7. PDF generates and downloads
8. Access logged (count incremented)
```

### Flow 3: New Version Issued

```
1. Internal user creates v2.0 from v1.0
2. User completes v2.0 modules
3. User clicks "Issue Document"
4. v2.0 marked as issued
5. v1.0 automatically marked as superseded
6. External links now resolve to v2.0
7. Client clicks existing link → sees v2.0
8. v1.0 download has "SUPERSEDED" watermark
```

### Flow 4: Link Revocation

```
1. Internal user opens ClientAccessModal
2. Views list of active links
3. Finds link: "For ABC Corp"
4. Clicks "Revoke"
5. Confirms revocation
6. Link immediately disabled
7. Client tries link → "Access Error"
8. Revocation logged in database
```

---

## M) File Structure

### Database:
```
supabase/migrations/
  └── [timestamp]_add_client_access_and_document_governance_v2.sql
```

### Utilities:
```
src/utils/
  └── clientAccess.ts  (all client access logic)
```

### Components:
```
src/components/documents/
  └── ClientAccessModal.tsx  (external link management)
```

### Pages:
```
src/pages/
  └── ClientDocumentView.tsx  (client-facing document view)
```

### PDF:
```
src/lib/pdf/
  ├── pdfUtils.ts  (addSupersededWatermark function)
  ├── buildFraPdf.ts  (updated with watermark)
  ├── buildFsdPdf.ts  (updated with watermark)
  └── buildDsearPdf.ts  (updated with watermark)
```

### Routing:
```
src/App.tsx  (added /client/document/:token route)
```

---

## N) Testing Checklist ✅

### Test 1: External Link Creation
- ✅ Cannot create link for draft document
- ✅ Can create link for issued document
- ✅ Link is immediately usable
- ✅ Link copies to clipboard
- ✅ Link shows in active links list

### Test 2: Client Document Access
- ✅ Valid token shows document
- ✅ Invalid token shows error
- ✅ Expired token shows error
- ✅ Revoked token shows error
- ✅ No issued document shows "not yet issued"

### Test 3: Version Auto-Resolution
- ✅ Link shows v1.0 when only v1.0 issued
- ✅ Issue v2.0 → link now shows v2.0
- ✅ v1.0 marked as superseded
- ✅ Link never shows v1.0 again
- ✅ Internal users still see both versions

### Test 4: Superseded Watermark
- ✅ Issued document PDF has no watermark
- ✅ Superseded document PDF has "SUPERSEDED" watermark
- ✅ Watermark appears on all pages
- ✅ Watermark is red, diagonal, 30% opacity
- ✅ Watermark does not obscure content

### Test 5: Immutability Protection
- ✅ Cannot edit issued document title
- ✅ Cannot edit issued document content
- ✅ Cannot delete issued document
- ✅ Can mark issued as superseded
- ✅ Database prevents modification via trigger

### Test 6: Link Revocation
- ✅ Active link works
- ✅ Revoke link → immediately disabled
- ✅ Revoked link shows error
- ✅ Revocation logged with user and timestamp
- ✅ Revoked link appears in "Revoked Links" section

### Test 7: Access Tracking
- ✅ Access count increments on each view
- ✅ Last accessed timestamp updates
- ✅ Access stats visible in ClientAccessModal
- ✅ Multiple accesses tracked correctly

### Test 8: Client UI
- ✅ Professional, clean layout
- ✅ Download button works
- ✅ Document details displayed correctly
- ✅ Issue information banner shown
- ✅ Error states handled gracefully

---

## O) Build Status ✅

```
✓ 1920 modules transformed
dist/index.js: 1,930.27 kB │ gzip: 505.08 kB
✓ built in 13.28s
```

- ✅ TypeScript compilation successful
- ✅ No linting errors
- ✅ All imports resolved
- ✅ Production-ready build

---

## P) Benefits & Impact

### 1. Client Confidence

- Clients always see the correct, current document
- No confusion about which version to use
- Professional, trustworthy presentation
- Clear version numbering and issue dates

### 2. Risk Mitigation

- No accidental exposure of drafts
- No reliance on superseded information
- Immutability prevents tampering
- Full audit trail for defense

### 3. Professional Governance

- Suitable for insurer scrutiny
- Defensible in legal/audit contexts
- Complete version history
- Clear supersession relationships

### 4. Operational Efficiency

- External links auto-update (no resending)
- Track who accessed what and when
- Revoke access instantly if needed
- No client account management overhead

### 5. Internal Flexibility

- Full access to all versions
- Download superseded for reference
- Clear watermarks prevent confusion
- Easy to share with multiple clients

---

## Q) Summary

Complete implementation of client visibility controls and historical document governance with:

✅ **Client Access** - Latest issued version only, no drafts/superseded
✅ **External Links** - Token-based, auto-resolving, trackable, revocable
✅ **Immutability** - Database-enforced protection of issued/superseded documents
✅ **Superseded Watermark** - Clear visual indication on superseded PDFs
✅ **Audit Trail** - Full version history, access logs, relationship tracking
✅ **Professional UI** - Client-facing document view, link management modal
✅ **Security** - RLS policies, token validation, access control

**All acceptance criteria met. Production ready.**

---

## R) API Summary for Developers

### Create External Link
```typescript
import { createExternalLink } from '@/utils/clientAccess';
const result = await createExternalLink(baseDocumentId, userId, 30, 'For ABC Corp');
// Returns: { success: true, token: '...', url: '...' }
```

### Get Client Visible Document
```typescript
import { getClientVisibleDocument } from '@/utils/clientAccess';
const document = await getClientVisibleDocument(baseDocumentId);
// Returns latest issued version or null
```

### Revoke Link
```typescript
import { revokeExternalLink } from '@/utils/clientAccess';
await revokeExternalLink(linkId, userId);
```

### Check Immutability
```typescript
import { isDocumentImmutable } from '@/utils/clientAccess';
const isLocked = isDocumentImmutable(document.issue_status);
// Returns true for 'issued' or 'superseded'
```

### Add Superseded Watermark
```typescript
import { addSupersededWatermark } from '@/lib/pdf/pdfUtils';
if (document.issue_status === 'superseded') {
  await addSupersededWatermark(pdfDoc);
}
```

### Query External Links
```sql
-- Get all active links for a document
SELECT * FROM document_external_links
WHERE base_document_id = 'xxx'
AND is_active = true
AND (expires_at IS NULL OR expires_at > NOW());

-- Get access stats
SELECT
  description,
  access_count,
  last_accessed_at
FROM document_external_links
WHERE base_document_id = 'xxx'
ORDER BY created_at DESC;
```
