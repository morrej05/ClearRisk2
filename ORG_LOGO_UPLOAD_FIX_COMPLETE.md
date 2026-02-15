# Organisation Logo Upload Fix - Complete

## Problem

Organisation admins could not upload branding logos. The upload would fail silently or with unclear error messages, preventing organisations from customising their PDF reports with their own logos.

### Root Cause

**Storage RLS Policy Bug:**
The storage policies for the `org-assets` bucket incorrectly referenced `user_profiles.name` instead of the storage object's `name` field (path). This caused all upload attempts to fail RLS checks because:
- `user_profiles.name` doesn't exist (should be checking user's full_name if anything)
- The policy was supposed to extract organisation_id from the storage object path: `org-logos/<org_id>/logo.png`
- Instead it was trying to extract from a non-existent user field

**Insufficient Error Logging:**
- Frontend and edge function didn't surface detailed Supabase errors
- Made it difficult to diagnose the RLS policy issue

---

## Solution

### 1. Fixed Storage RLS Policies

**Before (Broken):**
```sql
CREATE POLICY "Org admins can upload org assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'org-assets'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (
        (user_profiles.role = 'admin' AND split_part(user_profiles.name, '/', 2) = user_profiles.organisation_id::text)
        --                                              ^^^^^^^^^^^^^^^^^ WRONG!
        OR user_profiles.is_platform_admin = true
      )
    )
  );
```

**After (Fixed):**
```sql
CREATE POLICY "Org admins can upload org assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'org-assets'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (
        (user_profiles.role = 'admin' AND split_part(storage.objects.name, '/', 2) = user_profiles.organisation_id::text)
        --                                              ^^^^^^^^^^^^^^^^^^^ CORRECT!
        OR user_profiles.is_platform_admin = true
      )
    )
  );
```

**Key Fix:**
- Changed `split_part(user_profiles.name, '/', 2)` → `split_part(storage.objects.name, '/', 2)`
- Now correctly extracts organisation_id from storage path: `org-logos/<org_id>/logo.png`
- Applied fix to all four policies: SELECT, INSERT, UPDATE, DELETE

---

### 2. Enhanced Error Logging

#### Frontend (OrganisationBranding.tsx)

**Added Detailed Console Logging:**
```typescript
console.log('[Logo Upload] Starting upload:', {
  fileName: file.name,
  fileType: file.type,
  fileSize: file.size,
  organisationId,
});

console.log('[Logo Upload] Response:', {
  status: response.status,
  ok: response.ok,
  result,
});
```

**Improved Error Messages:**
```typescript
if (!response.ok) {
  const errorMessage = result.error || `Upload failed (${response.status})`;
  console.error('[Logo Upload] Upload failed:', errorMessage);
  throw new Error(errorMessage);
}
```

**User-Facing Error Display:**
- Exact error message now shown in UI toast/banner
- No more generic "Upload failed" messages
- HTTP status codes included when available

---

#### Edge Function (upload-org-logo/index.ts)

**Added Detailed Storage Error Logging:**
```typescript
const { data: uploadData, error: uploadError } = await supabaseClient.storage
  .from("org-assets")
  .upload(filePath, fileBuffer, {
    contentType: file.type,
    upsert: true,
  });

if (uploadError) {
  console.error("[Logo Upload] Storage upload error:", {
    message: uploadError.message,
    statusCode: uploadError.statusCode,
    error: uploadError,
  });
  throw new Error(`Upload failed: ${uploadError.message}`);
}
```

**Added Database Update Error Logging:**
```typescript
const { data: updateData, error: updateError } = await supabaseClient
  .from("organisations")
  .update({
    branding_logo_path: filePath,
    branding_updated_at: new Date().toISOString(),
  })
  .eq("id", orgId);

if (updateError) {
  console.error("[Logo Upload] Organisation update error:", {
    message: updateError.message,
    code: updateError.code,
    details: updateError.details,
    error: updateError,
  });
  throw new Error(`Failed to update organisation: ${updateError.message}`);
}
```

---

## Files Modified

### 1. Database Migration
**`supabase/migrations/fix_org_assets_storage_policies.sql`** (NEW)
- Dropped existing buggy storage policies
- Created fixed policies with correct `storage.objects.name` reference
- Applied to all four operations: SELECT, INSERT, UPDATE, DELETE

### 2. Frontend Component
**`src/components/OrganisationBranding.tsx`**
- Added detailed console logging for upload process
- Enhanced error message display to users
- Surfaced HTTP status codes and exact error messages
- Logging at key points: start, API call, response, error

### 3. Edge Function
**`supabase/functions/upload-org-logo/index.ts`**
- Added comprehensive logging for storage upload
- Added comprehensive logging for database update
- Log upload parameters (bucket, path, contentType, size)
- Log Supabase error details (message, statusCode, code, details)

---

## Storage Structure

### Bucket Configuration
```
Bucket: org-assets
Public: false (private)
Path Pattern: org-logos/<organisation_id>/logo.{png|jpg|svg}
```

### Upload Parameters
```typescript
{
  bucket: "org-assets",
  path: "org-logos/<org_id>/logo.png",
  contentType: file.type,  // e.g., "image/png"
  upsert: true,            // Overwrite existing
}
```

### Path Extraction Logic
```sql
-- Extract organisation_id from path
split_part(storage.objects.name, '/', 2)

-- Example:
-- Path: "org-logos/123e4567-e89b-12d3-a456-426614174000/logo.png"
-- Extracted: "123e4567-e89b-12d3-a456-426614174000"
```

---

## Security Model

### RLS Policies (org-assets bucket)

#### 1. Read Access (SELECT)
**Who Can Read:**
- Authenticated users in the same organisation (path matches their org_id)
- Platform admins (can read all)

**Check:**
```sql
bucket_id = 'org-assets'
AND (
  split_part(storage.objects.name, '/', 2) = user_profiles.organisation_id::text
  OR user_profiles.is_platform_admin = true
)
```

#### 2. Upload Access (INSERT)
**Who Can Upload:**
- Organisation admins (role = 'admin') for their own org
- Platform admins (can upload to any org)

**Check:**
```sql
bucket_id = 'org-assets'
AND (
  (user_profiles.role = 'admin' AND split_part(storage.objects.name, '/', 2) = user_profiles.organisation_id::text)
  OR user_profiles.is_platform_admin = true
)
```

#### 3. Update Access (UPDATE)
**Who Can Update:**
- Organisation admins for their own org's assets
- Platform admins

**Same logic as INSERT**

#### 4. Delete Access (DELETE)
**Who Can Delete:**
- Organisation admins for their own org's assets
- Platform admins

**Same logic as INSERT**

---

## Testing Guide

### Prerequisites
1. User must have `role = 'admin'` in `user_profiles`
2. User must have an `organisation_id` set
3. Organisation record must exist in `organisations` table

### Upload Test Steps

#### 1. Prepare Test Image
```
- File type: PNG, JPG, or SVG
- File size: < 1MB
- Recommended: 1000×300px with transparent background
```

#### 2. Navigate to Admin Settings
```
1. Log in as organisation admin
2. Navigate to Admin → Organisation Branding
3. Should see "No logo uploaded" message
```

#### 3. Upload Logo
```
1. Click "Choose File" button
2. Select test image
3. Wait for upload (watch console for logs)
4. Should see "Logo uploaded successfully" message
5. Logo preview should appear
```

#### 4. Verify Console Logs
```javascript
// Should see in browser console:
[Logo Upload] Starting upload: {
  fileName: "logo.png",
  fileType: "image/png",
  fileSize: 12345,
  organisationId: "..."
}
[Logo Upload] Calling edge function...
[Logo Upload] Response: {
  status: 200,
  ok: true,
  result: { success: true, path: "org-logos/.../logo.png" }
}
[Logo Upload] Upload successful: { success: true, ... }
```

#### 5. Verify Database
```sql
-- Check organisations table updated
SELECT id, name, branding_logo_path, branding_updated_at
FROM organisations
WHERE id = '<your-org-id>';

-- Should show:
-- branding_logo_path: "org-logos/<org-id>/logo.png"
-- branding_updated_at: recent timestamp
```

#### 6. Verify Storage
```sql
-- Check file exists in storage
SELECT name, bucket_id, created_at
FROM storage.objects
WHERE bucket_id = 'org-assets'
AND name LIKE 'org-logos/<your-org-id>%';

-- Should return the uploaded file
```

#### 7. Generate PDF with Logo
```
1. Navigate to any document
2. Go to Preview tab
3. Generate PDF (draft or issued)
4. Open PDF
5. Cover page should show uploaded logo
```

---

## Error Scenarios

### Scenario 1: User Not Admin
**Expected Behavior:**
```
Error: "Only organisation admins can upload logos"
HTTP 400
```

**Log Output:**
```
[Logo Upload] Permission check failed
```

### Scenario 2: Invalid File Type
**Expected Behavior:**
```
Error: "Invalid file type. Only PNG, JPG, and SVG are allowed."
Caught before upload attempt
```

**Log Output:**
```
[Logo Upload] Starting upload: { ... }
// Upload not attempted
```

### Scenario 3: File Too Large
**Expected Behavior:**
```
Error: "File too large. Maximum size is 1MB."
Caught before upload attempt
```

### Scenario 4: RLS Policy Failure (Now Fixed)
**Old Behavior:**
```
Error: "Upload failed: new row violates row-level security policy"
HTTP 400
```

**New Behavior:**
```
Success: Logo uploads successfully
```

### Scenario 5: Network Error
**Expected Behavior:**
```
Error: "Failed to fetch" or timeout error
Detailed error shown to user
```

**Log Output:**
```
[Logo Upload] Error: Failed to fetch
[Logo Upload] Detailed error: ...
```

---

## Verification Checklist

### ✅ Storage Policies
- [x] Bucket `org-assets` exists
- [x] Bucket is private (public: false)
- [x] SELECT policy allows org members to read
- [x] INSERT policy allows org admins to upload
- [x] UPDATE policy allows org admins to update
- [x] DELETE policy allows org admins to delete
- [x] All policies correctly reference `storage.objects.name`

### ✅ Edge Function
- [x] Deployed successfully
- [x] Validates user authentication
- [x] Validates user is org admin
- [x] Validates file type (PNG, JPG, SVG)
- [x] Validates file size (< 1MB)
- [x] Constructs correct storage path
- [x] Uploads with upsert: true
- [x] Updates organisations table
- [x] Logs detailed errors
- [x] Returns success response

### ✅ Frontend Component
- [x] Shows current logo if exists
- [x] Shows "No logo uploaded" if not
- [x] File picker accepts correct types
- [x] Validates file type client-side
- [x] Validates file size client-side
- [x] Shows loading state during upload
- [x] Logs detailed upload progress
- [x] Displays exact error messages
- [x] Shows success message on complete
- [x] Refreshes logo preview after upload
- [x] Delete functionality works

### ✅ PDF Integration
- [x] Draft PDFs show uploaded logo
- [x] Issued PDFs show uploaded logo
- [x] FRA PDFs work
- [x] FSD PDFs work
- [x] DSEAR PDFs work
- [x] RE PDFs work
- [x] Combined PDFs work
- [x] Falls back to "EziRisk" if no logo

---

## Build Status

✅ **Build Successful:**
```bash
npm run build
✓ 1914 modules transformed
✓ built in 24.51s
```

✅ **No TypeScript Errors**
✅ **No ESLint Warnings**
✅ **Edge Function Deployed**
✅ **Migration Applied**

---

## Related Files

### Core Files Modified
1. `src/components/OrganisationBranding.tsx` - Frontend UI component
2. `supabase/functions/upload-org-logo/index.ts` - Upload edge function
3. `supabase/migrations/fix_org_assets_storage_policies.sql` - Storage policy fix

### Related Files (Not Modified)
- `src/lib/pdf/logoResolver.ts` - Logo fetching for PDFs
- `src/lib/pdf/issuedPdfPages.ts` - PDF cover page with logo
- `supabase/functions/delete-org-logo/index.ts` - Delete edge function
- `supabase/migrations/20260126110606_create_org_assets_storage_bucket_v3.sql` - Original (buggy) policies

---

## Summary

### What Was Fixed
✅ Storage RLS policies now correctly reference `storage.objects.name`
✅ Upload path organisation_id extraction works correctly
✅ Frontend logs detailed upload progress and errors
✅ Edge function logs detailed Supabase errors
✅ Error messages surfaced to users with specifics
✅ HTTP status codes included in error messages

### How It Works Now
1. Admin clicks "Choose File" and selects logo
2. Frontend validates file type and size
3. Frontend sends file to edge function via FormData
4. Edge function validates user is org admin
5. Edge function uploads to: `org-assets/org-logos/<org_id>/logo.png`
6. Storage RLS checks: `split_part(storage.objects.name, '/', 2) = user's org_id`
7. Upload succeeds, edge function updates organisations table
8. Frontend shows success message and refreshed logo
9. PDFs generated with uploaded logo on cover page

### Result
🎉 **Organisation admins can now upload branding logos**
🎉 **RLS policies correctly validate organisation ownership**
🎉 **Detailed error logging enables debugging**
🎉 **PDFs display custom organisation logos**
🎉 **Graceful fallback to "EziRisk" if no logo**

---

## Next Steps (Optional Enhancements)

### Future Improvements
1. **Logo Validation:**
   - Check image dimensions
   - Warn if aspect ratio not ~3:1
   - Suggest optimal dimensions

2. **Logo Preview:**
   - Show preview before upload
   - Allow crop/resize in UI
   - Preview on PDF mockup

3. **Storage Cleanup:**
   - Delete old logo when uploading new one
   - Implement logo version history
   - Compress images automatically

4. **Admin Features:**
   - Platform admin can manage all org logos
   - Bulk logo operations
   - Logo approval workflow

5. **Performance:**
   - Cache logo URLs
   - Lazy load logo previews
   - Optimize PDF logo embedding

---

## Troubleshooting

### Upload Still Fails

**Check User Role:**
```sql
SELECT id, role, organisation_id, is_platform_admin
FROM user_profiles
WHERE id = auth.uid();
```
Must have: `role = 'admin'` OR `is_platform_admin = true`

**Check Storage Policies:**
```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
AND policyname LIKE '%org%asset%';
```
Should see 4 policies: SELECT, INSERT, UPDATE, DELETE

**Check Bucket:**
```sql
SELECT id, name, public
FROM storage.buckets
WHERE id = 'org-assets';
```
Should exist with `public = false`

**Check Console Logs:**
- Browser console should show detailed upload logs
- Edge function logs visible in Supabase dashboard
- Look for specific error messages

### Logo Not Showing in PDF

**Check organisations.branding_logo_path:**
```sql
SELECT id, name, branding_logo_path
FROM organisations
WHERE id = '<org-id>';
```
Should have valid path: `org-logos/<org-id>/logo.png`

**Check Storage Object Exists:**
```sql
SELECT name, bucket_id, created_at
FROM storage.objects
WHERE name = 'org-logos/<org-id>/logo.png';
```
Should return the file

**Check PDF Generator Logs:**
- Look for `[PDF Logo]` prefixed console logs
- Verify `ENABLE_PDF_IMAGE_LOGOS` is not disabled
- Check for logo fetch timeout or errors

---

## Related Documentation

- `RE_DRAFT_PDF_LOGO_FIX_COMPLETE.md` - RE PDF logo implementation
- `PDF_LOGO_EMBEDDING_COMPLETE.md` - Original logo system
- `WEB_APP_LOGO_INTEGRATION_COMPLETE.md` - Logo display in UI
- `docs/LOGO_WIRING.md` - Logo system architecture
