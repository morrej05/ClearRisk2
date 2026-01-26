# FRA PDF RenderMode Critical Fix - Complete ✅

## Critical Bug Found and Fixed

### The Bug

When issuing a document, the PDF was generated BEFORE the document status was updated to 'issued'. This caused a fatal logic error in buildFraPdf and buildCombinedPdf:

```typescript
// BROKEN LOGIC (caused the bug)
const isDraft = document.status !== 'issued';  // Always true during issue flow!
const isIssuedMode = renderMode === 'issued' && !isDraft;  // Always false!

// During the issue flow:
// 1. Document status is still 'draft'
// 2. renderMode parameter is set to 'issued'
// 3. isDraft = true (document.status is 'draft')
// 4. isIssuedMode = 'issued' && !true = false
// 5. PDF uses LEGACY format instead of issued format ❌
```

### The Root Cause

**Issue Flow Order:**
1. Fetch document (status = 'draft')
2. **Generate PDF with renderMode='issued'** ← PDF generated here
3. Lock PDF in storage
4. Update document status to 'issued' ← Status updated AFTER PDF

The check `document.status !== 'issued'` failed because the status field hadn't been updated yet when the PDF was being generated.

### The Fix

Trust the `renderMode` parameter explicitly - it's passed specifically to control the PDF format:

```typescript
// FIXED LOGIC ✅
const isIssuedMode = renderMode === 'issued';  // True when caller wants issued format
const isDraft = !isIssuedMode;  // Inverse for compatibility

// During the issue flow:
// 1. renderMode is explicitly set to 'issued' by IssueDocumentModal
// 2. isIssuedMode = true
// 3. PDF uses ISSUED format with Doc Control page 2 ✅
```

## Files Modified

### 1. src/lib/pdf/buildFraPdf.ts ✅
**Line 141-142:**
```typescript
// Before (BROKEN)
const isDraft = document.status !== 'issued';
const isIssuedMode = renderMode === 'issued' && !isDraft;

// After (FIXED)
const isIssuedMode = renderMode === 'issued';
const isDraft = !isIssuedMode;
```

### 2. src/lib/pdf/buildCombinedPdf.ts ✅
**Line 145-146:**
```typescript
// Before (BROKEN)
const isDraft = document.status !== 'issued';
const isIssuedMode = renderMode === 'issued' && !isDraft;

// After (FIXED)
const isIssuedMode = renderMode === 'issued';
const isDraft = !isIssuedMode;
```

## Why This Fix Works

### RenderMode Parameter Contract

The `renderMode` parameter is explicitly passed by callers to indicate the desired PDF format:

**IssueDocumentModal.tsx (line 182):**
```typescript
const buildOptions = {
  document,
  moduleInstances: modules || [],
  actions: actions || [],
  actionRatings: [],
  organisation: org,
  renderMode: 'issued' as const,  // Explicit: "Generate issued format"
};
```

**DocumentOverview.tsx:**
```typescript
const pdfOptions = {
  // ...
  renderMode: (document.issue_status === 'issued' || document.issue_status === 'superseded')
    ? 'issued' as const
    : 'preview' as const,
};
```

The `renderMode` parameter is the **single source of truth** for PDF format selection. Checking document.status created a timing dependency that broke during the issue flow.

## Impact of the Fix

### Before Fix ❌
- **Issue Flow:** PDF generated with legacy format (wrong)
  - Page 2 = "REGULATORY FRAMEWORK"
  - Action Register instead of Recommendations
  - No logo cover page
  - No Document Control table

- **Download Issued PDF:** PDF generated with issued format (correct)
  - But only after document was fully issued
  - Locked PDF in storage had wrong format

### After Fix ✅
- **Issue Flow:** PDF generated with issued format (correct)
  - Page 1 = Professional cover with logo
  - Page 2 = "DOCUMENT CONTROL & REVISION HISTORY"
  - Recommendations section with R-XX numbers
  - Locked PDF saved with correct format

- **Download Issued PDF:** PDF generated with issued format (correct)
  - Consistent with locked PDF
  - All issued documents use professional format

## Technical Details

### PDF Generation Flow

```
IssueDocumentModal.handleIssue():
├─ Fetch document (status='draft')
├─ Assign recommendation reference numbers
├─ Load modules, actions, organisation
├─ Generate PDF:
│  ├─ buildOptions.renderMode = 'issued'
│  ├─ Call buildFraPdf(buildOptions)
│  │  ├─ isIssuedMode = renderMode === 'issued' ✅
│  │  ├─ Call addIssuedReportPages() ✅
│  │  ├─ Generate cover + doc control pages ✅
│  │  └─ Use drawRecommendationsSection() ✅
│  └─ Return pdfBytes (correct format)
├─ Lock PDF in storage bucket
├─ Save locked_pdf_path to database
└─ Update document status to 'issued'
```

### Download Flow

```
DocumentOverview.handleDownloadPDF():
├─ Fetch document (status='issued')
├─ Determine renderMode from issue_status
│  └─ renderMode = 'issued' (because issue_status='issued')
├─ Load modules, actions, organisation
├─ Generate PDF:
│  ├─ buildOptions.renderMode = 'issued'
│  ├─ Call buildFraPdf(buildOptions)
│  │  ├─ isIssuedMode = renderMode === 'issued' ✅
│  │  └─ Generate issued format ✅
│  └─ Return pdfBytes
└─ Download blob
```

Both flows now produce the same issued format PDF because they both rely solely on the `renderMode` parameter.

## Build Status

✅ **Build Successful**
- Bundle: 1,694.41 KB (446.66 KB gzipped)
- No TypeScript errors
- No compilation warnings

## Testing Instructions

### Critical Path Test

1. **Create FRA Document**
   - Go to Documents → Create New → Fire Risk Assessment
   - Fill in required module (A1 Document Control)
   - Add 2-3 recommendations
   - Save

2. **Issue Document**
   - Click "Issue Document" button
   - Validate (should pass)
   - Confirm issue
   - Wait for "Complete!" message

3. **Verify Locked PDF Format**
   - Download the PDF
   - Open in PDF viewer
   - **Verify Page 1:** Professional cover with logo (org or EziRisk)
   - **Verify Page 2 Header:** "DOCUMENT CONTROL & REVISION HISTORY" ← CRITICAL
   - **Verify Page 2 Content:** Metadata table + revision history table
   - **Verify Recommendations Section:** R-01, R-02, R-03 format (NOT "Action Register")
   - **Verify No Draft Watermark**

4. **Compare Locked vs Download**
   - The locked PDF (generated during issue) should match
   - The downloaded PDF (generated on download) should match
   - Both should show Document Control page 2

### Expected Results ✅

**Page 2 Header:**
```
DOCUMENT CONTROL & REVISION HISTORY
```

**NOT:**
```
REGULATORY FRAMEWORK
```

**Recommendations Section:**
```
RECOMMENDATIONS

R-01: [Recommendation text]
Priority: P1
Status: OPEN
First raised in: Version 1.0

R-02: [Recommendation text]
Priority: P2
Status: OPEN
First raised in: Version 1.0
```

**NOT:**
```
ACTION REGISTER
[Legacy table format]
```

## What Was Broken Before

### Symptom Reported by User
- "FRA PDFs are still using legacy pages"
- "Page 2 = REGULATORY FRAMEWORK (not Document Control)"
- "ACTION REGISTER instead of Recommendations"
- "No logo on cover"

### Why Symptoms Occurred
The `isIssuedMode` check was `false` during issue flow because:
1. `document.status` was 'draft' at PDF generation time
2. Check `document.status !== 'issued'` returned `true`
3. `isIssuedMode = renderMode === 'issued' && !true = false`
4. Fell through to legacy PDF generation path
5. Generated "REGULATORY FRAMEWORK" page 2
6. Generated "ACTION REGISTER" instead of Recommendations

## Key Insight

**The renderMode parameter exists specifically to decouple PDF format selection from document status timing.**

When a caller passes `renderMode: 'issued'`, they're saying "Generate the issued format PDF now, regardless of current document status." This is essential because:

1. During issue flow, we need issued format BEFORE status is updated
2. During download flow, we need format to match issue_status
3. During preview flow, we might want to preview issued format for draft documents

The parameter provides explicit control, and we should trust it without additional validation.

## Verification Command

```bash
# Verify the fix is in place
grep -A 2 "const isIssuedMode" src/lib/pdf/buildFraPdf.ts src/lib/pdf/buildCombinedPdf.ts

# Should output:
# src/lib/pdf/buildFraPdf.ts:
# const isIssuedMode = renderMode === 'issued';
# const isDraft = !isIssuedMode;
#
# src/lib/pdf/buildCombinedPdf.ts:
# const isIssuedMode = renderMode === 'issued';
# const isDraft = !isIssuedMode;
```

## Conclusion

The critical bug has been fixed by trusting the `renderMode` parameter exclusively. All FRA and Combined PDFs now correctly use the issued format (with Document Control page 2 and structured Recommendations section) when `renderMode='issued'` is passed, regardless of the current document status.

This ensures that:
- ✅ Issue flow generates correct locked PDF
- ✅ Download flow generates matching PDF
- ✅ Document Control page 2 appears in all issued PDFs
- ✅ Recommendations section uses R-XX format
- ✅ Professional cover page with logo
- ✅ No legacy Action Register in issued PDFs

The fix is minimal, surgical, and addresses the root cause without side effects.
