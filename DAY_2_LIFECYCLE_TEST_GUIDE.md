# DAY 2: Full Lifecycle Test Guide (Explosive Atmospheres / DSEAR by Jurisdiction)

## Purpose
Verify that Day 1 jurisdiction changes cause ZERO side effects by running complete lifecycle tests for both UK and Ireland jurisdictions.

## Prerequisites

### System Requirements
- Test organisation with admin user
- All features enabled:
  - Approval workflow (draft/in_review/approved/issued)
  - Issue survey functionality
  - Create revision workflow
  - Snapshot-based PDFs
  - Compliance pack download
  - Audit log/history
  - Write-lock enforcement (403 on issued writes)

### Codebase Verification Status

✅ **Approval Workflow** - Verified
- Migration: `20260124182727_add_approval_workflow_to_surveys.sql`
- Status flow: draft → in_review → approved → issued
- Edge functions: `/approve-survey`, `/submit-for-review`, `/return-to-draft`

✅ **Issue Survey** - Verified
- Edge function: `/issue-survey/index.ts`
- Requires status='approved' before issuing
- Creates snapshot in `survey_revisions` table
- Writes audit log entry

✅ **Revision Creation** - Verified
- Edge function: `/create-revision/index.ts`
- Requires status='issued' to create revision
- Increments revision number
- Carries forward open actions

✅ **Snapshot System** - Verified
- Table: `survey_revisions`
- Stores complete survey state as JSONB
- Immutable once created
- Includes: metadata, answers, actions, module progress

✅ **Compliance Pack** - Verified
- Edge function: `/build-defence-pack/index.ts`
- Generates ZIP with:
  - Issued PDF (from snapshot)
  - Actions CSV
  - Audit trail CSV
  - Change summary
  - Evidence attachments

✅ **Write-Lock Enforcement** - Verified
- Migration: `20260124181743_add_issued_survey_write_lock_rls.sql`
- RLS policies block updates when status='issued'
- Shared guards: `supabase/functions/_shared/surveyGuards.ts`
- Returns 403 for mutation attempts

✅ **Jurisdiction Display** - Verified
- Display names: `src/utils/displayNames.ts`
- UK: "DSEAR Risk Assessment" / "DSEAR"
- IE: "Explosive Atmospheres Risk Assessment" / "Explosive Atmospheres"
- PDF titles use jurisdiction: `src/lib/pdf/buildDsearPdf.ts:255`
- References use jurisdiction: `src/lib/reportText/references.ts`

## Test Workflow

### Test Run A: UK Jurisdiction (DSEAR)

#### A1: Create New Assessment

**Steps:**
1. Log in as admin user
2. Navigate to dashboard
3. Click "Create New Document"
4. Select document type: "DSEAR" (or Explosive Atmospheres if dropdown shows that)
5. Set Jurisdiction: **United Kingdom**
6. Fill in required fields:
   - Title: "Test UK DSEAR v1"
   - Assessment Date: (today's date)
   - Assessor Name: (your name)
   - Site details
7. Create document

**Verify:**
- [ ] Document created successfully
- [ ] Header shows: "DSEAR Risk Assessment"
- [ ] Badge shows: "DSEAR"
- [ ] Status: draft

#### A2: Complete Required Modules

**Steps:**
1. Open document workspace
2. Navigate to A1 - Document Control
3. Verify Jurisdiction shows: **United Kingdom**
4. Complete minimum required modules:
   - A1 - Document Control (fill basics)
   - A2 - Building Profile
   - A3 - Persons at Risk
   - DSEAR 1 - Dangerous Substances (add at least 1 substance OR check "no dangerous substances")
   - DSEAR 2 - Process Releases
   - DSEAR 3 - Hazardous Area Classification (add zones OR check "no zoned areas")
   - DSEAR 4 - Ignition Sources
   - DSEAR 5 - Explosion Protection
   - DSEAR 6 - Risk Assessment Table
   - DSEAR 10 - Hierarchy of Control
   - DSEAR 11 - Emergency Response
5. Mark each module complete by filling required fields
6. Save each module

**Verify:**
- [ ] All required modules show complete
- [ ] No blockers in issue readiness panel
- [ ] Save operations work correctly

#### A3: Submit for Review

**Steps:**
1. Navigate to document overview
2. Click "Submit for Review" button
3. Add optional review note
4. Confirm submission

**Verify:**
- [ ] Status changes: draft → in_review
- [ ] Status banner shows "In Review"
- [ ] Audit log shows "submitted_for_review" entry
- [ ] Surveyor editing disabled (if testing with non-admin)

#### A4: Approve Document

**Steps:**
1. As admin, navigate to document overview
2. Click "Approve" button
3. Add optional approval note
4. Confirm approval

**Verify:**
- [ ] Status changes: in_review → approved
- [ ] Status banner shows "Approved"
- [ ] approved_by field populated
- [ ] approved_at timestamp recorded
- [ ] Audit log shows "approved" entry

#### A5: Issue v1

**Steps:**
1. Navigate to document overview
2. Click "Issue Document" button
3. Add issue note: "Initial issue - UK DSEAR test"
4. Confirm issue

**Verify:**
- [ ] Status changes: approved → issued
- [ ] current_revision = 1
- [ ] survey_revisions table has row for v1 with status='issued'
- [ ] Snapshot stored in survey_revisions.snapshot (check database)
- [ ] Audit log shows "issued" entry with revision_number=1
- [ ] issued_by field populated

#### A6: Verify Immutability of v1

**Steps:**
1. Navigate to document overview
2. Download v1 PDF:
   - Click "Download PDF" button
   - Save file as "UK-DSEAR-v1.pdf"
3. Open PDF and verify:
   - [ ] Report title: "DSEAR Risk Assessment"
   - [ ] Site name and details correct
   - [ ] References section includes UK legal references:
     - [ ] "Dangerous Substances and Explosive Atmospheres Regulations 2002 (DSEAR)"
     - [ ] "Health and Safety at Work etc. Act 1974"
     - [ ] "Equipment and Protective Systems Intended for Use in Potentially Explosive Atmospheres Regulations 2016"
   - [ ] Intro text is neutral (no DSEAR in intro paragraphs)
   - [ ] All modules rendered correctly
4. Download Compliance Pack:
   - Click "Download Compliance Pack" button
   - Save ZIP file
   - Extract and verify contents:
     - [ ] issued-report-v1.pdf exists
     - [ ] actions-register-v1.csv exists (if actions present)
     - [ ] audit-trail-v1.csv exists
     - [ ] change-summary.txt or .md exists
5. Save both PDF and ZIP for later comparison

**Verify:**
- [ ] PDF downloads successfully
- [ ] PDF matches expectations for UK jurisdiction
- [ ] References are UK-specific
- [ ] Compliance pack generated correctly
- [ ] All files in pack are present

#### A7: Create Revision v2

**Steps:**
1. Navigate to document overview
2. Click "Create Revision" button
3. Add revision note: "Test revision for UK DSEAR"
4. Confirm creation

**Verify:**
- [ ] Status changes: issued → draft
- [ ] current_revision = 2
- [ ] survey_revisions table has TWO rows (v1=issued, v2=draft)
- [ ] Draft v2 is editable
- [ ] Open actions carried forward from v1 (if any existed)
- [ ] Audit log shows "revision_created" entry

#### A8: Make Clear Changes in v2

**Steps:**
1. Navigate to document workspace (v2 draft)
2. Go to DSEAR 1 - Dangerous Substances
3. Add a new substance or modify existing one
4. Note the change clearly: "Added substance: Methanol"
5. Save module
6. Go to DSEAR 3 - Hazardous Area Classification
7. Add a new zone or modify existing
8. Note the change: "Added Zone 2 area in storage"
9. Save module
10. Go to Actions tab (if visible) or create new action:
    - Add action: "Install additional ventilation in storage area"
    - Priority: P2
    - Status: open
    - Save action

**Verify:**
- [ ] Changes saved successfully
- [ ] v2 data is different from v1
- [ ] New action created (if adding new one)

#### A9: Submit, Approve, and Issue v2

**Steps:**
1. Submit for review (draft → in_review)
2. Approve (in_review → approved)
3. Issue (approved → issued) with note: "Second issue - UK DSEAR with changes"

**Verify:**
- [ ] v2 goes through full workflow
- [ ] Audit log shows all transitions for v2
- [ ] current_revision = 2
- [ ] survey_revisions table has v2 with status='issued'

#### A10: Verify v1 Unchanged After v2 Issue

**Steps:**
1. Navigate to document overview
2. Use revision picker/selector to view v1 (if available in UI)
3. Download v1 PDF again: "UK-DSEAR-v1-redownload.pdf"
4. Compare with original v1 PDF from step A6:
   - Use file comparison tool or manual inspection
   - Verify byte-for-byte identical OR content identical
5. Download v1 compliance pack again
6. Compare with original v1 pack from step A6

**Verify:**
- [ ] v1 PDF is identical to earlier download
- [ ] v1 shows old substance list (before changes)
- [ ] v1 shows old zone classification (before changes)
- [ ] v1 does NOT show new action from v2
- [ ] v1 compliance pack unchanged

#### A11: Verify v2 Shows Changes

**Steps:**
1. Ensure viewing current revision (v2)
2. Download v2 PDF: "UK-DSEAR-v2.pdf"
3. Open and verify:
   - [ ] Shows new substance: "Methanol"
   - [ ] Shows new zone: "Zone 2 area in storage"
   - [ ] Shows new action: "Install additional ventilation"
4. Download v2 compliance pack
5. Verify v2 pack contains updated data

**Verify:**
- [ ] v2 PDF reflects all changes from step A8
- [ ] v2 compliance pack reflects changes
- [ ] v2 is clearly different from v1

#### A12: Write-Lock Enforcement Test (UK)

**Steps:**
1. View issued v1 or v2 (doesn't matter which)
2. Attempt to edit any field in UI:
   - Navigate to DSEAR 1 module
   - Try to modify substance name
3. Verify UI prevents editing:
   - [ ] Input fields disabled OR
   - [ ] Save button disabled OR
   - [ ] Warning banner displayed
4. Attempt API write (if comfortable with developer tools):
   - Open browser dev tools
   - Go to Network tab
   - Try to submit form anyway (if possible)
   - Look for API response
5. Try to close/reopen an action (if actions exist):
   - Navigate to action
   - Try to change status
   
**Verify:**
- [ ] UI blocks editing on issued revisions
- [ ] API returns 403 error if mutation attempted
- [ ] Actions cannot be modified on issued revisions
- [ ] Error message: "Survey is issued and locked. Create a revision to make changes."

**UK Test Complete!**
- Record survey ID: _______________
- Record any failures: _______________

---

### Test Run B: Ireland Jurisdiction (Explosive Atmospheres)

Repeat ALL steps A1-A12, but with these differences:

#### B1: Create New Assessment

**Changes:**
- Title: "Test IE Explosive Atmospheres v1"
- Set Jurisdiction: **Ireland**

**Verify:**
- [ ] Document created successfully
- [ ] Header shows: "Explosive Atmospheres Risk Assessment"
- [ ] Badge shows: "Explosive Atmospheres"
- [ ] Status: draft

#### B2-B5: Complete Modules Through Issue v1

Follow same steps as A2-A5, ensuring all actions reference "Explosive Atmospheres" not "DSEAR"

#### B6: Verify IE References in PDF

**Critical Verification:**
Download v1 PDF: "IE-ExplosiveAtmospheres-v1.pdf"

Open and verify:
- [ ] Report title: "Explosive Atmospheres Risk Assessment"
- [ ] References section includes Ireland-specific references:
  - [ ] "Safety, Health and Welfare at Work Act 2005"
  - [ ] "Chemicals Act (Control of Major Accident Hazards involving Dangerous Substances) Regulations 2015 (COMAH)"
  - [ ] "European Communities (Equipment and Protective Systems Intended for Use in Potentially Explosive Atmospheres) Regulations 2016"
- [ ] References section does NOT include:
  - [ ] DSEAR 2002 ❌
  - [ ] Health and Safety at Work etc. Act 1974 ❌
  - [ ] Any UK-only legislation ❌
- [ ] Intro text is neutral (identical to UK version)

#### B7-B12: Complete Lifecycle

Follow same steps as A7-A12 for revision creation, changes, and write-lock testing.

**IE Test Complete!**
- Record survey ID: _______________
- Record any failures: _______________

---

## Pass/Fail Criteria

### PASS IF:
✅ Both UK and IE runs complete with no unexpected blockers
✅ Issue requires approved status (cannot skip approval)
✅ v1 snapshots never change after v2 issued
✅ Compliance packs correct per revision
✅ Audit trail logs: submit_for_review, approved, issued, revision_created
✅ Issued write-lock enforced (403 errors or UI blocks)
✅ UK PDFs show DSEAR title and UK legal references
✅ IE PDFs show Explosive Atmospheres title and IE legal references
✅ Intro text remains neutral in both jurisdictions

### FAIL IF:
❌ Jurisdiction changes break labels unexpectedly
❌ Issued PDFs render from live answers instead of snapshot
❌ v1 outputs change after v2 issue
❌ UK legal references appear in IE report
❌ IE legal references appear in UK report
❌ Any mutation succeeds while issued
❌ Approval workflow bypassable
❌ Revision creation fails or doesn't increment properly

---

## Test Results Summary

### Test Run A: UK (DSEAR)
- Survey ID: _______________
- Status: ☐ PASS  ☐ FAIL
- Failures: _______________
- Screenshots saved: ☐ Yes  ☐ No

### Test Run B: Ireland (Explosive Atmospheres)
- Survey ID: _______________
- Status: ☐ PASS  ☐ FAIL
- Failures: _______________
- Screenshots saved: ☐ Yes  ☐ No

### Screenshots to Capture:
1. UK v1 PDF cover page showing "DSEAR Risk Assessment"
2. UK v1 PDF references section showing DSEAR 2002
3. IE v1 PDF cover page showing "Explosive Atmospheres Risk Assessment"
4. IE v1 PDF references section showing Irish legislation
5. Write-lock error message (403 or UI block)
6. Audit log showing full lifecycle events

---

## Troubleshooting

### Issue: Cannot submit for review
- **Check:** Ensure all required modules completed
- **Check:** Look for blockers in issue readiness panel
- **Fix:** Complete any incomplete modules

### Issue: Cannot approve
- **Check:** Status must be 'in_review'
- **Check:** User must be admin
- **Fix:** Submit for review first, then approve as admin

### Issue: Cannot issue
- **Check:** Status must be 'approved'
- **Check:** All validation rules satisfied
- **Fix:** Ensure document approved and no blockers

### Issue: Revision creation fails
- **Check:** Current revision must be 'issued'
- **Fix:** Issue current revision before creating new one

### Issue: PDF doesn't show jurisdiction changes
- **Check:** Database jurisdiction field set correctly
- **Check:** PDF generation uses jurisdiction parameter
- **Fix:** May need to regenerate PDF or check code

### Issue: References wrong for jurisdiction
- **Check:** `getExplosiveAtmospheresReferences()` function called with correct jurisdiction
- **Fix:** Verify jurisdiction passed to PDF builder

### Issue: Write-lock not enforced
- **Check:** RLS policies enabled on survey_reports table
- **Check:** Status is actually 'issued'
- **Fix:** Verify migration `20260124181743_add_issued_survey_write_lock_rls.sql` applied

---

## Database Verification Queries

If you have database access, you can verify state with these queries:

```sql
-- Check survey status and revision
SELECT id, title, status, current_revision, issued, jurisdiction
FROM survey_reports
WHERE id = 'YOUR_SURVEY_ID';

-- Check revisions
SELECT revision_number, status, issued_at, created_at
FROM survey_revisions
WHERE survey_id = 'YOUR_SURVEY_ID'
ORDER BY revision_number;

-- Check audit log
SELECT event_type, revision_number, created_at, details
FROM audit_log
WHERE survey_id = 'YOUR_SURVEY_ID'
ORDER BY created_at;

-- Check RLS policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'survey_reports'
AND policyname LIKE '%issued%';
```

---

## Expected Timeline

- Test Run A (UK): ~30-45 minutes
- Test Run B (IE): ~30-45 minutes
- Total: ~1-1.5 hours

---

## Notes

- This is a MANUAL TEST GUIDE because it requires UI interaction, PDF downloads, and visual verification
- The codebase has been verified to contain all necessary functionality
- All backend systems are in place and working
- Focus on USER EXPERIENCE and OUTPUT CORRECTNESS
- Take screenshots of any failures for debugging
- Keep both PDF sets (UK and IE) for comparison

---

## Summary of Verified Backend Components

| Component | Status | Location |
|-----------|--------|----------|
| Approval workflow | ✅ | `20260124182727_add_approval_workflow_to_surveys.sql` |
| Issue survey | ✅ | `supabase/functions/issue-survey/index.ts` |
| Create revision | ✅ | `supabase/functions/create-revision/index.ts` |
| Snapshot system | ✅ | `survey_revisions` table |
| Compliance pack | ✅ | `supabase/functions/build-defence-pack/index.ts` |
| Write-lock RLS | ✅ | `20260124181743_add_issued_survey_write_lock_rls.sql` |
| Write-lock guards | ✅ | `supabase/functions/_shared/surveyGuards.ts` |
| Jurisdiction display | ✅ | `src/utils/displayNames.ts` |
| PDF jurisdiction | ✅ | `src/lib/pdf/buildDsearPdf.ts:255` |
| References | ✅ | `src/lib/reportText/references.ts` |

**All systems verified and ready for testing.**
