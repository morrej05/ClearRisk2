# PDF Locking Issue Fix - Complete

## Problem
When attempting to issue a document, users received the error:
```
Cannot issue document without a locked PDF. The PDF must be generated and locked before the document can be issued.
```

Even though PDF bytes were being generated successfully, the `documents.locked_pdf_path` field remained null in the database.

## Root Cause
A database trigger `cleanup_pdf_fields_on_draft` was clearing all PDF-related fields (including `locked_pdf_path`) whenever a draft document was updated.

The issue flow was:
1. Document has `issue_status = 'draft'`
2. Generate PDF and call `generateAndLockPdf()`
3. `lockPdfToDocument()` updates the documents table with `locked_pdf_path`
4. **Trigger fires** and sees `issue_status = 'draft'` → Sets `locked_pdf_path = NULL`
5. `issueDocument()` checks for `locked_pdf_path` → Finds NULL → Fails

## Solution Implemented

### 1. Fixed Database Trigger (Migration)
Created migration: `fix_pdf_locking_trigger_for_draft_issue.sql`

Updated the trigger to only clear PDF fields when:
- **INSERT**: Creating a new draft document
- **UPDATE with status transition**: Changing from issued/superseded → draft

The trigger now **preserves** PDF fields when updating an existing draft document (which is what happens during the issue flow).

### 2. Added Verification in IssueDocumentModal.tsx
After `generateAndLockPdf()` succeeds, we now:
1. Re-fetch the document from the database
2. Verify `locked_pdf_path` is actually set
3. Throw a clear error if not: "Locked PDF path was not saved; cannot issue. Please try again."

This provides immediate feedback if the database update fails for any reason.

### 3. Enhanced Logging in pdfLocking.ts
Added comprehensive console logging throughout `generateAndLockPdf()`:
- `[PDF Lock] Starting PDF upload...`
- `[PDF Lock] Upload succeeded...`
- `[PDF Lock] Locking PDF to document...`
- `[PDF Lock] Successfully locked PDF...`

This helps diagnose issues in production and development.

## Files Modified

1. **New Migration**: `supabase/migrations/fix_pdf_locking_trigger_for_draft_issue.sql`
   - Fixed trigger logic to allow PDF locking during issue flow

2. **src/components/documents/IssueDocumentModal.tsx**
   - Added verification step after PDF generation
   - Re-fetches document to confirm locked_pdf_path is set

3. **src/utils/pdfLocking.ts**
   - Added detailed logging for PDF upload and locking operations
   - Enhanced error reporting

## Testing Checklist

✅ Document can be issued successfully
✅ `documents.locked_pdf_path` is populated after issue
✅ Locked PDF can be downloaded from DocumentOverview
✅ Error messages are clear if PDF generation fails
✅ Console logs show detailed PDF locking progress
✅ Build passes without errors

## Expected Flow Now

1. User clicks "Issue Document"
2. System validates document is ready for issue
3. System generates PDF bytes (FRA/FSD/DSEAR/Combined)
4. System uploads PDF to storage bucket → Returns path
5. System updates `documents` table with locked_pdf_path, checksum, etc.
6. **Trigger allows update** because document was already draft (not transitioning TO draft)
7. System verifies locked_pdf_path is set
8. System updates issue_status to 'issued'
9. Success! Document is now issued with locked PDF

## Benefits

- ✅ Defensible PDFs: Once issued, PDF cannot change
- ✅ Audit trail: Checksum verification for integrity
- ✅ Professional compliance: Re-exports return identical PDF
- ✅ Clear error messages: Users know exactly what went wrong
- ✅ Diagnostic logging: Easy to troubleshoot issues
