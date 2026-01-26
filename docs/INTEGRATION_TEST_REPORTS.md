# Integration Test Runbook: Issued Report PDFs End-to-End

This document provides step-by-step manual testing procedures for the complete Issued Report PDF system integration, covering all locked spec requirements from cover page through immutability enforcement.

## Prerequisites

- EziRisk application running locally or in test environment
- Database with at least one organisation configured
- User account with admin permissions
- Test document or ability to create one

---

## Test Suite 1: Organisation Branding & Logo Fallback

### Test 1.1: Upload Organisation Logo

**Steps:**
1. Navigate to Admin → Organisation tab
2. Click "Choose File" under Upload Logo section
3. Select a valid PNG file (< 1MB, ~1000×300px recommended)
4. Verify logo preview appears immediately
5. Create a new draft document and add some content
6. Issue the document (see Test 2.1)
7. Download the issued PDF
8. **Expected:** PDF cover page displays your uploaded logo at top-left
9. **Expected:** Logo is scaled appropriately (max 120mm × 30mm)

**Pass Criteria:**
- Logo uploads successfully
- Preview shows correct image
- PDF includes custom logo
- Logo dimensions are correct and properly scaled

### Test 1.2: EziRisk Fallback Logo

**Steps:**
1. Navigate to Admin → Organisation tab
2. If a logo exists, click the trash icon to remove it
3. Confirm removal
4. Create a new draft document or use existing
5. Issue the document
6. Download the issued PDF
7. **Expected:** PDF cover page displays "EziRisk" text/logo as fallback
8. **Expected:** PDF generation does not fail or error

**Pass Criteria:**
- Logo removal succeeds
- PDF generates without errors
- Fallback logo appears on cover
- All other PDF sections render correctly

### Test 1.3: Logo Load Failure Resilience

**Steps:**
1. Upload an organisation logo successfully
2. Manually corrupt the branding_logo_path in the database (optional test)
   ```sql
   UPDATE organisations
   SET branding_logo_path = 'invalid/path.png'
   WHERE id = '<your-org-id>';
   ```
3. Issue a document
4. Download PDF
5. **Expected:** PDF generates with EziRisk fallback logo
6. **Expected:** No error blocks PDF generation
7. **Expected:** Console shows warning but continues

**Pass Criteria:**
- PDF generation succeeds despite bad logo path
- Fallback logo is used
- User can complete issue workflow

---

## Test Suite 2: Document Issue Workflow

### Test 2.1: Issue Document v1.0 (First Version)

**Steps:**
1. Create a new Fire Risk Assessment document
2. Fill in required modules (A1 Document Control minimum)
3. Add at least 3 recommendations/actions via module forms
4. Click "Issue Document" button in header
5. **Expected:** Validation modal opens
6. Click "Validate Document" button
7. **Expected:** Validation passes (green success message)
8. **Expected:** Modal shows:
   - "You are about to issue **Version 1.0** of this document"
   - Amber warning box with lock icon: "Once issued, this version cannot be edited"
   - List of what happens when you issue
9. Click "Issue Document" button
10. **Expected:** Progress indicators show:
    - Fetching document data
    - Assigning recommendation reference numbers
    - Loading modules and actions
    - Generating PDF
    - Uploading and locking PDF
    - Updating document status
    - Complete!
11. **Expected:** Modal closes and page refreshes
12. **Expected:** Document header now shows "Issued" badge (green)
13. Click download PDF
14. Open PDF and verify:
    - **Page 1:** Professional cover page with logo, title, version "1.0", today's date
    - **Page 2:** Document Control & Revision History
      - Document control table with all metadata
      - Revision history shows v1.0 with "Initial issue"
    - **Recommendations section:** (after main content)
      - Each recommendation has reference number (R-01, R-02, R-03...)
      - Shows priority, status, "First raised: Version 1.0"
      - Sorted: Open → In Progress → Closed → Superseded, then by priority

**Pass Criteria:**
- Issue workflow completes without errors
- Reference numbers assigned (R-01, R-02, etc.)
- Status badge shows "Issued"
- PDF matches all locked spec requirements
- No draft watermark on issued PDF

### Test 2.2: Immutability Enforcement After Issue

**Steps:**
1. After issuing document in Test 2.1
2. Navigate to any module in the workspace
3. **Expected:** EditLockBanner appears: "This document is issued and cannot be edited"
4. **Expected:** All form fields are disabled/read-only
5. Try to change any field value (should be blocked in UI)
6. Try to add a new action (should be blocked)
7. Try to edit an existing action status (should be blocked)
8. Open browser developer tools → Network tab
9. Attempt to manually call a document update API endpoint
10. **Expected:** Server returns error: "Document is issued and cannot be modified"

**Pass Criteria:**
- UI prevents all edits on issued documents
- Forms are disabled
- API enforces immutability
- Clear user feedback about why editing is blocked

### Test 2.3: Idempotency (Double-Click Protection)

**Steps:**
1. Create a new draft document
2. Fill in required fields
3. Click "Issue Document"
4. In the confirmation modal, click "Issue Document" button
5. **Immediately** click it again (double-click simulation)
6. **Expected:** Button becomes disabled after first click
7. **Expected:** Only one issue operation occurs
8. Check database: `SELECT * FROM documents WHERE id = '<doc-id>'`
9. **Expected:** Only one issued_at timestamp
10. Check storage bucket: Only one locked PDF file

**Pass Criteria:**
- Button disables after first click
- No duplicate issue operations
- Single PDF in storage
- No database conflicts or errors

---

## Test Suite 3: Document Versioning

### Test 3.1: Create New Version (v2 from v1)

**Steps:**
1. Start with issued v1.0 from Test 2.1
2. Click "Create New Version" button (should appear for issued documents)
3. **Expected:** System creates v2.0 draft
4. **Expected:** Navigates to new v2 document workspace
5. **Expected:** Document header shows "Draft" badge
6. **Expected:** All content copied forward from v1
7. Navigate to recommendations/actions
8. **Expected:** All actions copied with same reference numbers (R-01, R-02, R-03)
9. **Expected:** Status values preserved from v1
10. Check v1 document status
11. **Expected:** v1 remains "Issued" (not superseded yet)

**Pass Criteria:**
- v2 draft created successfully
- Content carries forward correctly
- Reference numbers preserved
- v1 status unchanged until v2 is issued

### Test 3.2: Issue v2 and Verify Revision History

**Steps:**
1. In v2 draft from Test 3.1
2. Make one visible change (e.g., add a note to a module)
3. Add or modify one recommendation
4. Issue v2 document (follow Test 2.1 steps)
5. Download v2 PDF
6. Open PDF and check:
   - **Page 1:** Version shows "2.0"
   - **Page 2 Document Control:**
     - "Supersedes: Version 1.0"
     - Revision history table shows:
       - v2.0 with today's date and change summary
       - v1.0 with original date
   - **Recommendations section:**
     - Recommendations with existing reference numbers show "First raised: Version 1.0"
     - New recommendations show "First raised: Version 2.0"
7. Navigate back to v1 document
8. **Expected:** v1 document header shows "Superseded" badge (orange)
9. Download v1 PDF
10. **Expected:** v1 PDF shows "SUPERSEDED" diagonal watermark across all pages

**Pass Criteria:**
- v2 issues successfully
- Revision history accurate
- Reference numbers consistent across versions
- First raised version tracked correctly
- v1 marked as superseded
- Superseded watermark applied

### Test 3.3: Change Summary Generation

**Steps:**
1. After issuing v2 in Test 3.2
2. Query change summaries table:
   ```sql
   SELECT * FROM change_summaries
   WHERE base_document_id = '<base-doc-id>'
   ORDER BY version_number;
   ```
3. **Expected:** Rows for v1 and v2
4. **Expected:** v2 change_summary contains description of what changed
5. Download v2 PDF
6. Check page 2 revision history table
7. **Expected:** Change summary text appears in "Change Summary" column for v2

**Pass Criteria:**
- Change summaries stored correctly
- Summaries reflect actual changes
- Summaries display in PDF revision history

---

## Test Suite 4: Recommendation Lifecycle

### Test 4.1: Close Recommendation

**Steps:**
1. Create and issue a document with recommendations
2. Create v2 draft
3. Navigate to action register or recommendation panel
4. Mark one recommendation as "Closed"
5. Add closure date and notes
6. Issue v2
7. Download v2 PDF
8. Check recommendations section
9. **Expected:** Closed recommendation shows:
   - Status: "closed"
   - "Closed: [date]" text
   - Still listed (not removed)
   - Appears after open/in_progress items (sorting)

**Pass Criteria:**
- Closure workflow works
- Closed date recorded
- Closed recommendation renders correctly in PDF
- Sorting order correct

### Test 4.2: Supersede Recommendation

**Steps:**
1. Create and issue document with recommendations
2. Create v2 draft
3. Add a new recommendation that replaces an old one
4. Mark old recommendation status as "Superseded"
5. Set superseded_by_action_id to point to new recommendation
6. Issue v2
7. Download v2 PDF
8. Check recommendations section
9. **Expected:** Superseded recommendation shows:
   - Status: "superseded"
   - "Superseded by newer recommendation" text
   - Listed after closed items (sorting)
10. **Expected:** New replacement recommendation shows normally

**Pass Criteria:**
- Supersession tracking works
- Superseded text displays
- Sorting places superseded items last
- Both old and new recommendations visible in PDF

---

## Test Suite 5: Regression & Edge Cases

### Test 5.1: No Recommendations (Empty State)

**Steps:**
1. Create document with NO recommendations
2. Issue document
3. Download PDF
4. Check recommendations section
5. **Expected:** Section displays: "No recommendations were identified at the time of inspection."

**Pass Criteria:**
- Empty state renders
- PDF generates successfully
- No errors in console

### Test 5.2: Large Document (50+ Actions)

**Steps:**
1. Create document with 50+ recommendations
2. Issue document
3. **Expected:** PDF generation completes (may take longer)
4. Download and open PDF
5. **Expected:** All recommendations listed across multiple pages
6. **Expected:** Page breaks work correctly (no cut-off text)

**Pass Criteria:**
- Large PDFs generate without timeout
- Pagination works correctly
- All data rendered

### Test 5.3: Special Characters in Content

**Steps:**
1. Create document with special characters in:
   - Title: "Test & Company™ Site © 2026"
   - Recommendations: "Ensure €5000 budget • Fix 90° angles"
2. Issue document
3. Download PDF
4. **Expected:** Special characters handled gracefully:
   - Converted to safe equivalents (€ → EUR, ™ → (TM), etc.)
   - OR rendered correctly if PDF lib supports
   - No broken/missing text

**Pass Criteria:**
- Special characters don't break PDF generation
- Text is readable (even if converted)

### Test 5.4: Attempt to Edit Issued Document via API

**Steps:**
1. Issue a document (get document ID)
2. Use API client (Postman/curl) or browser console:
   ```javascript
   await supabase
     .from('documents')
     .update({ title: 'Hacked Title' })
     .eq('id', '<issued-doc-id>');
   ```
3. **Expected:** Update fails
4. **Expected:** RLS policy blocks the update
5. **Expected:** Document title unchanged in UI and DB
6. Try updating module_instances:
   ```javascript
   await supabase
     .from('module_instances')
     .update({ outcome: 'hacked' })
     .eq('document_id', '<issued-doc-id>');
   ```
7. **Expected:** Update blocked by immutability guard

**Pass Criteria:**
- All direct database updates blocked for issued documents
- RLS policies enforce immutability
- No data corruption possible

### Test 5.5: Create New Version from Superseded Document

**Steps:**
1. Have v1 (superseded) and v2 (issued) documents
2. Navigate to v1 (superseded)
3. **Expected:** No "Create New Version" button visible
4. **Expected:** Only "Download PDF" and view options available
5. Navigate to v2 (issued)
6. **Expected:** "Create New Version" button IS visible
7. Click and create v3
8. **Expected:** v3 created from latest (v2), not from v1

**Pass Criteria:**
- Can only create new versions from latest issued
- Cannot create versions from superseded documents
- Version chain maintains integrity

---

## Test Suite 6: Cross-Document Type Testing

### Test 6.1: Fire Risk Assessment (FRA)

**Steps:**
1. Create FRA document
2. Issue document
3. Download PDF
4. **Expected:** Cover page says "Fire Risk Assessment"
5. **Expected:** Contains FRA-specific regulatory text sections
6. **Expected:** Cover + doc control + FRA content + recommendations

**Pass Criteria:**
- FRA-specific content renders
- New PDF structure applied

### Test 6.2: Combined FRA + FSD

**Steps:**
1. Create combined document with FRA and FSD modules enabled
2. Fill in modules from both types
3. Issue document
4. Download PDF
5. **Expected:** Cover page says "Combined Assessment" or similar
6. **Expected:** Contains Part 1: FRA and Part 2: FSD sections
7. **Expected:** Recommendations section includes actions from both parts

**Pass Criteria:**
- Combined document type works
- Both module sets included
- Single recommendations section

---

## Final Checklist

Before marking integration complete, verify:

- [ ] Org logo upload/download/fallback working
- [ ] Issue workflow validates → assigns reference numbers → generates PDF → locks document
- [ ] Immutability enforced in UI and API
- [ ] Idempotency prevents duplicate issues
- [ ] Version creation copies content and reference numbers
- [ ] Revision history tracks all versions
- [ ] Change summaries generated and displayed
- [ ] Recommendation lifecycle (close/supersede) tracked and rendered
- [ ] Sorting and layout match locked spec
- [ ] No draft watermark on issued PDFs
- [ ] Superseded watermark applied correctly
- [ ] Empty states handled
- [ ] Large documents work
- [ ] Special characters safe
- [ ] API guards prevent unauthorized edits
- [ ] All document types supported (FRA, FSD, Combined, DSEAR)

---

## Reporting Issues

When reporting test failures, include:

1. Test number (e.g., Test 2.1)
2. Expected behavior
3. Actual behavior
4. Screenshots (especially of PDF issues)
5. Browser console errors
6. Database state queries if relevant

---

## Success Criteria

All tests in Suites 1-6 must pass for the integration to be considered complete and ready for Day 9 lock & regression sweep.
