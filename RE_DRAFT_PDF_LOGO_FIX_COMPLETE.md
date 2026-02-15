# RE Draft PDF Logo Embedding Fix - Complete

## Problem

RE Survey and RE Loss Prevention draft PDFs rendered plain cover pages without organisation logos or professional formatting. The draft mode used custom cover page logic that bypassed the shared logo embedding pipeline.

## Solution

Modified RE PDF builders to use `addIssuedReportPages()` for both draft and issued modes, enabling consistent logo embedding and professional formatting across all document states.

---

## Changes Made

### 1. Fixed `src/lib/pdf/buildReSurveyPdf.ts`

**Before (Draft Mode):**
```typescript
if (isIssuedMode) {
  // Call addIssuedReportPages with logo...
} else {
  // Custom plain cover page (no logo)
  const { page } = addNewPage(pdfDoc, isDraft, totalPages);
  page.drawText('Risk Engineering Survey Report', {...});
  // ... manual text drawing
}
```

**After (Unified):**
```typescript
// Use addIssuedReportPages for both draft and issued modes
const { coverPage, docControlPage } = await addIssuedReportPages({
  pdfDoc,
  document: {
    id: document.id,
    title: document.title,
    document_type: 'RE',
    version_number: (document as any).version_number || document.version || 1,
    issue_date: (document as any).issue_date || new Date().toISOString(),
    issue_status: isIssuedMode ? 'issued' : 'draft', // Dynamic status
    assessor_name: document.assessor_name,
    base_document_id: (document as any).base_document_id,
  },
  organisation: {
    id: organisation.id,
    name: organisation.name,
    branding_logo_path: organisation.branding_logo_path, // Logo path passed
  },
  client: {
    name: document.responsible_person,
    site: document.scope_description,
  },
  fonts: { bold: fontBold, regular: font },
});
totalPages.push(coverPage, docControlPage);
```

**Key Changes:**
- Removed custom draft cover page logic
- Always call `addIssuedReportPages()` regardless of mode
- Pass `issue_status: 'draft'` for draft mode
- Ensure `branding_logo_path` is included in organisation object

---

### 2. Fixed `src/lib/pdf/buildReLpPdf.ts`

**Applied identical changes:**
- Removed custom draft mode cover page
- Unified draft and issued modes to use `addIssuedReportPages()`
- Pass dynamic `issue_status` based on `isIssuedMode`
- Include organisation logo path

---

### 3. Enhanced `src/lib/pdf/pdfUtils.ts`

**Added RE Document Type Label:**
```typescript
function getDocumentTypeLabel(type: string): string {
  switch (type) {
    case 'fire_risk_assessment':
      return 'Fire Risk Assessment';
    case 'fire_safety_design':
      return 'Fire Safety Design Review';
    case 'explosion_risk_assessment':
      return 'Explosion Risk Assessment';
    case 'combined':
      return 'Combined Assessment';
    case 'RE':
      return 'Risk Engineering Survey'; // NEW
    default:
      return type;
  }
}
```

**Purpose:** Displays "Risk Engineering Survey" on cover page instead of raw "RE"

---

## How It Works

### Logo Embedding Flow (Draft & Issued)

```
1. buildReSurveyPdf/buildReLpPdf called
   ↓
2. Calls addIssuedReportPages()
   ↓
3. addIssuedReportPages checks:
   ├─ ENABLE_PDF_IMAGE_LOGOS (default: true)
   └─ organisation.branding_logo_path exists?
   ↓
4. If yes:
   ├─ resolveOrganisationLogo()
   │  ├─ Create signed URL from org-assets
   │  └─ Fetch logo bytes with timeout
   ├─ fetchAndEmbedLogo()
   │  └─ Embed PNG/JPEG in PDF
   └─ Pass logoData to drawCoverPage()
   ↓
5. drawCoverPage() renders:
   ├─ Logo image (or "EziRisk" fallback)
   ├─ Document title
   ├─ Document type: "Risk Engineering Survey"
   ├─ Client/site info
   ├─ Version number
   └─ Status: "DRAFT" (red) or "INFORMATION" (black)
   ↓
6. PDF generation continues with content pages
```

### Draft vs Issued Behavior

**Draft Mode (`issue_status: 'draft'`):**
- Shows organisation logo in header (or fallback "EziRisk")
- Displays "DRAFT" in red at bottom right
- Issue date shows "DRAFT" instead of actual date
- Full professional formatting

**Issued Mode (`issue_status: 'issued'`):**
- Shows organisation logo in header (or fallback "EziRisk")
- Displays "INFORMATION" in black at bottom right
- Issue date shows actual formatted date
- Full professional formatting

**Key Point:** Both modes use identical logo embedding logic!

---

## Verification Points

### ✅ Logo Enabled (Default)
1. Organisation has `branding_logo_path` set
2. Generate RE Survey draft PDF
3. Cover page shows organisation logo in header
4. "DRAFT" status visible in red at bottom right

### ✅ Logo Fallback
1. Organisation has no `branding_logo_path`
2. Generate RE Survey draft PDF
3. Cover page shows "EziRisk" text fallback
4. PDF generates successfully

### ✅ Logo Fetch Timeout
1. Logo file inaccessible or slow network
2. Generate RE Survey draft PDF
3. After 3-second timeout → fallback to "EziRisk"
4. PDF generates successfully

### ✅ RE Loss Prevention
1. Switch to "Loss Prevention Report" tab
2. Generate draft PDF
3. Cover page shows organisation logo
4. "DRAFT" status visible

### ✅ Styling Match
1. RE draft PDF styling matches FRA draft PDF styling
2. Same header layout and logo positioning
3. Same status indicator format
4. Professional appearance

---

## Files Modified

### Core Changes
1. **`src/lib/pdf/buildReSurveyPdf.ts`**
   - Removed custom draft cover page logic (lines 117-168)
   - Unified draft and issued modes to use `addIssuedReportPages()`
   - Pass dynamic `issue_status`

2. **`src/lib/pdf/buildReLpPdf.ts`**
   - Removed custom draft cover page logic (lines 116-165)
   - Unified draft and issued modes to use `addIssuedReportPages()`
   - Pass dynamic `issue_status`

3. **`src/lib/pdf/pdfUtils.ts`**
   - Added "RE" case to `getDocumentTypeLabel()` (line 530-531)
   - Returns "Risk Engineering Survey"

### Previously Modified (Part of Original Implementation)
- `src/lib/pdf/issuedPdfPages.ts` - Already has logo resolver integration
- `src/lib/pdf/logoResolver.ts` - Shared logo fetching logic
- `src/pages/documents/DocumentPreviewPage.tsx` - RE PDF generation wiring

---

## Technical Details

### Why This Approach?

**Problem with Old Approach:**
- Draft mode used custom `page.drawText()` calls
- No logo embedding integration
- Inconsistent styling with other document types
- Duplicated cover page logic

**Benefits of New Approach:**
- Single code path for draft and issued modes
- Automatic logo embedding via shared pipeline
- Consistent styling across all document types
- Reduced code duplication
- Easier to maintain

### `addIssuedReportPages` Handles Both Modes

The function detects draft vs issued based on `issue_status`:
- **Logo loading:** Same for both modes
- **Cover page layout:** Same for both modes
- **Status display:** Dynamic based on `issue_status`
- **Watermarks:** Applied by `drawCoverPage()` based on status

### Document Control Page

Both draft and issued modes receive a document control page:
- Shows revision history (if available)
- Shows distribution list
- Professional appearance
- No functional difference between modes

---

## Environment Configuration

### Logo Embedding Status

**Default Setting:**
```typescript
// In issuedPdfPages.ts
const ENABLE_PDF_IMAGE_LOGOS = (import.meta.env.VITE_PDF_IMAGE_LOGOS ?? 'true') === 'true';
```

**Environment Variable:**
```env
# Default: enabled
VITE_PDF_IMAGE_LOGOS=true

# To disable for debugging:
VITE_PDF_IMAGE_LOGOS=false
```

**Current Status:** ✅ Enabled by default

---

## Error Handling

### Logo Loading Failures

**All failures are non-fatal:**

1. **No branding_logo_path:**
   - Skip logo loading
   - Use "EziRisk" text fallback

2. **Signed URL creation fails:**
   - Log warning
   - Use "EziRisk" text fallback

3. **Logo fetch timeout (3s):**
   - Log warning
   - Use "EziRisk" text fallback

4. **Logo embed fails:**
   - Log warning
   - Use "EziRisk" text fallback

**Result:** PDF always generates successfully with professional appearance

---

## Testing Checklist

### Manual Testing Steps

1. **Create RE Document:**
   ```
   Navigate to Documents → New Assessment → Select "RE" type
   Fill in required fields
   Save document
   ```

2. **Generate Draft Survey PDF:**
   ```
   Document Workspace → Preview
   Select "Survey Report" tab
   Choose modules to include
   Click "Generate PDF"
   ```

3. **Verify Logo:**
   ```
   ✓ Organisation logo appears in header
   ✓ Or "EziRisk" text if no logo configured
   ✓ "DRAFT" status in red at bottom right
   ✓ Document type: "Risk Engineering Survey"
   ```

4. **Generate Draft LP PDF:**
   ```
   Document Workspace → Preview
   Select "Loss Prevention Report" tab
   Click "Generate PDF"
   ```

5. **Verify Logo:**
   ```
   ✓ Organisation logo appears in header
   ✓ Or "EziRisk" text if no logo configured
   ✓ "DRAFT" status in red at bottom right
   ✓ Document type: "Risk Engineering Survey"
   ```

6. **Test Logo Fallback:**
   ```
   Remove organisation branding_logo_path
   Generate PDF
   ✓ "EziRisk" text appears
   ✓ PDF generates successfully
   ```

7. **Compare Styling:**
   ```
   Generate FRA draft PDF
   Generate RE draft PDF
   ✓ Header layouts match
   ✓ Logo positioning identical
   ✓ Status indicators consistent
   ```

---

## Build Status

✅ **Build Successful:**
```
npm run build
✓ 1914 modules transformed
✓ built in 16.40s
```

✅ **No TypeScript Errors**
✅ **No ESLint Warnings**
✅ **All Imports Resolved**
✅ **RE PDF Builders Compile Correctly**

---

## Comparison: Before vs After

### Before (Broken)

**RE Draft PDF:**
```
┌────────────────────────────┐
│ Risk Engineering Survey    │ ← Plain text
│ Report                     │
│                            │
│ [Document Title]           │
│                            │
│ Version 1.0 - DRAFT        │
│ Organisation: Example      │
│ Assessor: John Doe         │
└────────────────────────────┘
```
- No logo
- Basic text layout
- Inconsistent with other PDFs
- Unprofessional appearance

### After (Fixed)

**RE Draft PDF:**
```
┌────────────────────────────┐
│ [Organisation Logo]        │ ← Professional logo
│                            │
│    [Document Title]        │ ← Centered
│                            │
│  Risk Engineering Survey   │ ← Document type
│                            │
│  Client: Example Client    │
│  Site: Factory A           │
│                            │
│                 DRAFT  ← Red status
│            Version 1.0     │
└────────────────────────────┘
```
- Organisation logo (or "EziRisk" fallback)
- Professional layout
- Consistent with FRA/FSD/DSEAR PDFs
- Clear draft indicator

---

## Summary

### What Was Fixed
✅ RE Survey draft PDFs now show organisation logo
✅ RE LP draft PDFs now show organisation logo
✅ Draft mode uses shared logo embedding pipeline
✅ Styling matches FRA/FSD/DSEAR issued PDFs
✅ "Risk Engineering Survey" document type label added
✅ Code duplication eliminated

### How It Works
- Both draft and issued modes call `addIssuedReportPages()`
- `addIssuedReportPages()` checks `ENABLE_PDF_IMAGE_LOGOS` (default: true)
- If logo path exists → resolves logo → embeds in PDF
- If logo unavailable → falls back to "EziRisk" text
- `drawCoverPage()` handles draft vs issued status display
- PDF always generates successfully

### Result
🎉 **RE draft PDFs have professional cover pages with logos**
🎉 **Consistent styling across all document types**
🎉 **Single code path reduces maintenance**
🎉 **Graceful fallback ensures reliability**

---

## Related Documentation

- `PDF_LOGO_EMBEDDING_COMPLETE.md` - Original logo implementation
- `src/lib/pdf/logoResolver.ts` - Shared logo fetching logic
- `src/lib/pdf/issuedPdfPages.ts` - Cover page generation
- `src/lib/pdf/pdfUtils.ts` - PDF utilities and helpers
