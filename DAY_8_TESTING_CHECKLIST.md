# DAY 8: Full Workflow Stress Test - Manual Testing Checklist

## Pre-flight Code Review: ✅ PASSED

All required functionality exists and is properly implemented:

### ✅ Core Workflows Verified
- Issue survey endpoint with approval gate
- Create revision endpoint
- Approval workflow (submit-for-review, approve-survey, return-to-draft)
- Delete document endpoint with issued protection
- Close/reopen action with write-lock enforcement

### ✅ Combined Survey Support Verified
- `enabled_modules` field in documents table
- Issue validation checks all enabled modules
- IssueReadinessPanel displays blockers per module
- PDF generation supports combined reports

### ✅ Irish Overlay Verified
- `jurisdiction` field in documents table
- `getExplosiveAtmospheresReferences(jurisdiction)` returns UK or IE references
- PDF builders use jurisdiction parameter
- Display names switch based on jurisdiction

### ✅ Write-Lock Enforcement Verified
- Edge functions use `assertSurveyEditable` or `assertActionSurveyEditable`
- Returns 403 Forbidden when document is issued
- Guards check `issue_status === 'issued'`

---

## Testing Prerequisites

### Test Account Setup
- [ ] Admin user account created
- [ ] Test organization configured
- [ ] Subscription active (or dev mode enabled)

### Browser Setup
- [ ] Open browser console for error monitoring
- [ ] Open network tab to watch API calls
- [ ] Prepare to take screenshots if issues found

### Document Preparation
- [ ] Create a folder to save test PDFs
- [ ] Prepare a simple naming convention: `RUN{#}_v{#}_YYYYMMDD.pdf`
- [ ] Have a notepad ready for survey IDs

---

## RUN 1 — FRA (UK) 🇬🇧

### Test Details
- **Document Type:** FRA only
- **Jurisdiction:** UK
- **Goal:** Verify full lifecycle + immutability

### Test Steps

#### 1.1 Create Document
- [ ] Navigate to "New Assessment"
- [ ] Select: Fire Risk Assessment (FRA)
- [ ] Set Jurisdiction: **UK**
- [ ] Enter site name: `TEST FRA UK RUN1`
- [ ] Click Create
- [ ] **Record survey_id:** `_____________________`

#### 1.2 Complete Required Fields
- [ ] Fill A1: Document Control
  - [ ] Set assessor name
  - [ ] Set assessment date
- [ ] Fill A2: Building Profile
  - [ ] Enter address
  - [ ] Complete required fields
- [ ] Fill A3: Persons at Risk
  - [ ] Document occupancy
- [ ] Fill A4: Management Controls
  - [ ] Complete management section
- [ ] Fill A5: Emergency Arrangements
  - [ ] Document emergency plan
- [ ] Fill FRA1: Fire Hazards
  - [ ] Identify hazards
- [ ] Fill FRA2: Means of Escape
  - [ ] Document escape routes
- [ ] Fill FRA3: Fire Protection
  - [ ] Document protection measures
- [ ] Fill FRA4: Significant Findings
  - [ ] Add at least 1 recommendation OR check "No significant findings"
- [ ] Fill FRA5: External Fire Spread
  - [ ] Complete assessment

**Checkpoint:** Issue Readiness Panel should show all modules complete

#### 1.3 Approval Workflow
- [ ] Click "Submit for Review"
- [ ] Verify status changes to "In Review"
- [ ] Verify banner appears: "Document is pending approval"
- [ ] Click "Approve"
- [ ] Verify status changes to "Approved"
- [ ] Verify "Issue" button now enabled

#### 1.4 Issue v1
- [ ] Click "Issue" button
- [ ] Confirm issuance in modal
- [ ] Wait for processing
- [ ] Verify status changes to "Issued"
- [ ] Verify version banner shows "v1"
- [ ] Verify yellow lock banner appears
- [ ] **Note issue date/time:** `_____________________`

#### 1.5 Download v1 Outputs
- [ ] Download PDF from overview page
- [ ] Save as: `RUN1_v1_FRA_UK.pdf`
- [ ] Open PDF and verify:
  - [ ] Title page shows "Fire Risk Assessment"
  - [ ] References section includes UK legislation (RRO 2005)
  - [ ] All content populated correctly
- [ ] Click "Compliance Pack" button
- [ ] Download compliance pack
- [ ] Save as: `RUN1_v1_PACK_FRA_UK.zip`
- [ ] Extract and verify:
  - [ ] PDF included
  - [ ] Evidence files included (if any)
  - [ ] Files are correct

#### 1.6 Create Revision v2
- [ ] Click "Create New Version" button
- [ ] Enter change log: "Test revision for RUN1"
- [ ] Confirm creation
- [ ] Verify version banner shows "v2 (Draft)"
- [ ] Verify v1 still visible in version picker
- [ ] **Record v2 survey_id:** `_____________________`

#### 1.7 Modify v2
- [ ] Go to FRA1: Fire Hazards
- [ ] Add new text: "**V2 TEST CHANGE**" to hazard description
- [ ] Save changes
- [ ] Verify auto-save worked

#### 1.8 Issue v2
- [ ] Submit v2 for review → Approve → Issue
- [ ] Wait for processing
- [ ] Verify v2 now shows as "Issued"
- [ ] Download PDF: `RUN1_v2_FRA_UK.pdf`
- [ ] Open PDF and verify:
  - [ ] Contains "**V2 TEST CHANGE**" text
  - [ ] Version shows v2

#### 1.9 Verify v1 Immutability
- [ ] Use version picker to select v1
- [ ] Download v1 PDF again: `RUN1_v1_VERIFY_FRA_UK.pdf`
- [ ] Compare with original v1 PDF:
  - [ ] **CRITICAL:** Files must be identical (no "V2 TEST CHANGE")
  - [ ] v1 must remain unchanged
- [ ] Download v1 compliance pack again
- [ ] Verify pack contents unchanged

#### 1.10 Test Write-Lock on v2 (Issued)
**Attempt to edit issued v2:**

- [ ] Try to edit FRA1 module content
  - **Expected:** UI blocks with message OR server returns 403
  - **Result:** ✅ PASS / ❌ FAIL - `_____________________`

- [ ] Try to close an action
  - **Expected:** Server returns 403 Forbidden
  - **Result:** ✅ PASS / ❌ FAIL - `_____________________`

- [ ] Try to reopen a closed action
  - **Expected:** Server returns 403 Forbidden
  - **Result:** ✅ PASS / ❌ FAIL - `_____________________`

- [ ] Try to upload attachment (if feature exists)
  - **Expected:** Upload blocked
  - **Result:** ✅ PASS / ❌ FAIL - `_____________________`

#### RUN 1 Result
- [ ] ✅ **PASS** - All checks passed
- [ ] ❌ **FAIL** - Issues found (describe below)

**Issues/Notes:**
```
[If failed, describe what went wrong and include error messages]
```

---

## RUN 2 — FSD (UK) 🇬🇧

### Test Details
- **Document Type:** FSD only
- **Jurisdiction:** UK
- **Goal:** Verify FSD lifecycle works identically to FRA

### Test Steps
Repeat all steps from RUN 1, but:
- Select "Fire Strategy (FSD)" instead of FRA
- Complete FSD-specific modules (FSD1-FSD6, FSD8-FSD9)
- Save PDFs as: `RUN2_v1_FSD_UK.pdf`, `RUN2_v2_FSD_UK.pdf`, etc.

### RUN 2 Checklist (Abbreviated)

- [ ] Create FSD document, jurisdiction UK
- [ ] **survey_id:** `_____________________`
- [ ] Complete all FSD required modules
- [ ] Submit → Approve → Issue v1
- [ ] Download v1 PDF and pack
- [ ] Create revision v2
- [ ] **v2 survey_id:** `_____________________`
- [ ] Make change in FSD module
- [ ] Issue v2
- [ ] Download v2 PDF
- [ ] Verify v1 unchanged (re-download and compare)
- [ ] Test write-lock on issued v2

#### RUN 2 Result
- [ ] ✅ **PASS**
- [ ] ❌ **FAIL**

**Issues/Notes:**
```
[If failed, describe what went wrong]
```

---

## RUN 3 — COMBINED FRA + FSD (UK) 🇬🇧

### Test Details
- **Document Type:** Combined (FRA + FSD)
- **Jurisdiction:** UK
- **Goal:** Verify combined gating requires BOTH modules complete

### Test Steps

#### 3.1 Create Combined Document
- [ ] Navigate to "New Assessment"
- [ ] Create new document
- [ ] After creation, edit to enable both modules:
  - [ ] Check documentation on how to enable combined mode
  - [ ] May need to set `enabled_modules: ['FRA', 'FSD']` via database
- [ ] **survey_id:** `_____________________`

#### 3.2 Test Gating: FRA Complete, FSD Incomplete
- [ ] Complete ALL FRA modules (A1-A5, FRA1-FRA5)
- [ ] Leave ALL FSD modules incomplete
- [ ] Try to submit for review
- [ ] **Expected:** Blocked with error listing FSD incomplete modules
- [ ] **Result:** ✅ PASS / ❌ FAIL - `_____________________`

#### 3.3 Test Gating: FSD Complete, FRA Incomplete
- [ ] Mark FRA modules as incomplete (or start fresh)
- [ ] Complete ALL FSD modules (FSD1-FSD9)
- [ ] Leave FRA modules incomplete
- [ ] Try to submit for review
- [ ] **Expected:** Blocked with error listing FRA incomplete modules
- [ ] **Result:** ✅ PASS / ❌ FAIL - `_____________________`

#### 3.4 Complete BOTH and Issue v1
- [ ] Complete ALL FRA modules
- [ ] Complete ALL FSD modules
- [ ] Issue Readiness Panel should show:
  - [ ] "[FRA] Fire Hazards" complete
  - [ ] "[FRA] Means of Escape" complete
  - [ ] "[FSD] Regulatory Basis" complete
  - [ ] "[FSD] Evacuation Strategy" complete
  - [ ] etc. (all modules listed with prefixes)
- [ ] Submit → Approve → Issue v1
- [ ] Download COMBINED PDF: `RUN3_v1_COMBINED_UK.pdf`
- [ ] Open PDF and verify:
  - [ ] Contains BOTH FRA and FSD sections
  - [ ] Table of contents includes both
  - [ ] All content present

#### 3.5 Test Compliance Pack Default
- [ ] Download compliance pack
- [ ] Save as: `RUN3_v1_PACK_COMBINED_UK.zip`
- [ ] Extract and open default PDF
- [ ] Verify: Default PDF should be the COMBINED PDF (not FRA-only or FSD-only)
- [ ] **Result:** ✅ PASS / ❌ FAIL - `_____________________`

#### 3.6 Create v2 with FRA-Only Change
- [ ] Create revision v2
- [ ] **v2 survey_id:** `_____________________`
- [ ] Go to FRA section
- [ ] Add change: "**FRA V2 CHANGE**"
- [ ] Leave FSD section unchanged
- [ ] Submit → Approve → Issue v2
- [ ] Download v2 PDF: `RUN3_v2_COMBINED_UK.pdf`
- [ ] Verify:
  - [ ] FRA section shows "**FRA V2 CHANGE**"
  - [ ] FSD section unchanged

#### 3.7 Verify v1 Immutability
- [ ] Select v1 from version picker
- [ ] Download v1 PDF again: `RUN3_v1_VERIFY_COMBINED_UK.pdf`
- [ ] Compare with original:
  - [ ] **CRITICAL:** No "FRA V2 CHANGE" text in v1
  - [ ] v1 completely unchanged

#### RUN 3 Result
- [ ] ✅ **PASS**
- [ ] ❌ **FAIL**

**Issues/Notes:**
```
[If failed, describe what went wrong]
```

---

## RUN 4 — COMBINED FRA + FSD (IE) 🇮🇪

### Test Details
- **Document Type:** Combined (FRA + FSD)
- **Jurisdiction:** Ireland
- **Goal:** Verify Irish overlay removes UK references

### Test Steps

#### 4.1 Create Combined IE Document
- [ ] Create new combined FRA+FSD document
- [ ] Set Jurisdiction: **IE (Ireland)**
- [ ] **survey_id:** `_____________________`

#### 4.2 Complete and Issue v1
- [ ] Complete ALL FRA modules
- [ ] Complete ALL FSD modules
- [ ] Submit → Approve → Issue v1
- [ ] Download PDF: `RUN4_v1_COMBINED_IE.pdf`

#### 4.3 Verify Irish Overlay
Open the PDF and check:

**Title/Headers:**
- [ ] Report title appropriate for IE context
- [ ] No "England and Wales" mentioned

**References Section (CRITICAL):**
- [ ] **NO** "Regulatory Reform (Fire Safety) Order 2005" (UK-only)
- [ ] **NO** "Building Regulations 2010" (UK-only)
- [ ] **NO** "Approved Document B" (UK-only)
- [ ] **YES** includes Irish legislation (Fire Services Act, Building Regulations (Ireland), etc.)

**FRA Intro Text:**
- [ ] Check responsible person duties section
- [ ] Should reference Irish legislation, not RRO 2005

**FSD Content:**
- [ ] Standards should reference IS EN (Irish Standards)
- [ ] No UK-specific building regulations

- [ ] **Result:** ✅ PASS / ❌ FAIL - `_____________________`

#### 4.4 Verify Compliance Pack
- [ ] Download compliance pack: `RUN4_v1_PACK_COMBINED_IE.zip`
- [ ] Open default PDF
- [ ] Verify no UK references in pack PDF either
- [ ] **Result:** ✅ PASS / ❌ FAIL - `_____________________`

#### 4.5 Create v2 and Re-verify
- [ ] Create revision v2
- [ ] Make minor change
- [ ] Issue v2
- [ ] Download v2 PDF: `RUN4_v2_COMBINED_IE.pdf`
- [ ] Verify v2 still has IE overlay (no UK refs)
- [ ] Verify v1 unchanged when re-downloaded

#### RUN 4 Result
- [ ] ✅ **PASS**
- [ ] ❌ **FAIL**

**Issues/Notes:**
```
[If failed, list which UK references appeared incorrectly]
```

---

## RUN 5 — EXPLOSIVE ATMOSPHERES (UK) 🇬🇧

### Test Details
- **Document Type:** DSEAR (internally) / "DSEAR Risk Assessment" (display)
- **Jurisdiction:** UK
- **Goal:** Verify display name + UK references

### Test Steps

#### 5.1 Create DSEAR Document
- [ ] Navigate to "New Assessment"
- [ ] Select: Risk Engineering → Explosive Atmospheres
- [ ] Set Jurisdiction: **UK**
- [ ] **survey_id:** `_____________________`

#### 5.2 Verify Display Name
- [ ] Check page title/header
- [ ] **Expected:** "DSEAR Risk Assessment" (UK display name)
- [ ] **Result:** ✅ PASS / ❌ FAIL - `_____________________`

#### 5.3 Complete and Issue v1
- [ ] Complete all DSEAR modules (DSEAR1-DSEAR11)
- [ ] Add dangerous substance(s)
- [ ] Add zoned area(s)
- [ ] Add action(s) OR confirm controls adequate
- [ ] Submit → Approve → Issue v1
- [ ] Download PDF: `RUN5_v1_DSEAR_UK.pdf`

#### 5.4 Verify Report Content
Open PDF and check:

**Intro Section:**
- [ ] Intro text is neutral (no UK-specific legal refs in intro paragraph)
- [ ] **Result:** ✅ PASS / ❌ FAIL - `_____________________`

**References Section:**
- [ ] **YES** includes "DSEAR 2002" (UK legislation)
- [ ] **YES** includes "Health and Safety at Work etc. Act 1974"
- [ ] **YES** includes UK ATEX regulations
- [ ] **Result:** ✅ PASS / ❌ FAIL - `_____________________`

#### 5.5 Create v2 and Verify Immutability
- [ ] Create revision v2
- [ ] Make change
- [ ] Issue v2
- [ ] Verify v1 unchanged

#### RUN 5 Result
- [ ] ✅ **PASS**
- [ ] ❌ **FAIL**

**Issues/Notes:**
```
[If failed, describe issues]
```

---

## RUN 6 — EXPLOSIVE ATMOSPHERES (IE) 🇮🇪

### Test Details
- **Document Type:** DSEAR (internally) / "Explosive Atmospheres Risk Assessment" (display)
- **Jurisdiction:** Ireland
- **Goal:** Verify IE display name + NO UK references

### Test Steps

#### 6.1 Create DSEAR IE Document
- [ ] Create new Explosive Atmospheres assessment
- [ ] Set Jurisdiction: **IE (Ireland)**
- [ ] **survey_id:** `_____________________`

#### 6.2 Verify Display Name
- [ ] Check page title/header
- [ ] **Expected:** "Explosive Atmospheres Risk Assessment" (IE display name, NO "DSEAR")
- [ ] **Result:** ✅ PASS / ❌ FAIL - `_____________________`

#### 6.3 Complete and Issue v1
- [ ] Complete all modules
- [ ] Submit → Approve → Issue v1
- [ ] Download PDF: `RUN6_v1_EXATM_IE.pdf`

#### 6.4 Verify Irish Overlay (CRITICAL)
Open PDF and check:

**Title:**
- [ ] Report title: "Explosive Atmospheres Risk Assessment" (NOT "DSEAR")

**References Section:**
- [ ] **NO** "DSEAR 2002" (UK-only legislation)
- [ ] **NO** "Health and Safety at Work etc. Act 1974" (UK-only)
- [ ] **YES** includes "Safety, Health and Welfare at Work Act 2005" (Irish)
- [ ] **YES** includes Irish COMAH regulations
- [ ] **YES** includes Irish ATEX regulations (S.I. No. 276/2016)
- [ ] Standards should reference IS EN (not BS EN)
- [ ] **Result:** ✅ PASS / ❌ FAIL - `_____________________`

**Throughout Document:**
- [ ] Scan entire PDF for any mention of "DSEAR"
- [ ] Scan for "Health and Safety at Work etc. Act 1974"
- [ ] **Expected:** ZERO UK-only references anywhere
- [ ] **Result:** ✅ PASS / ❌ FAIL - `_____________________`

#### 6.5 Create v2 and Verify
- [ ] Create revision v2
- [ ] Issue v2
- [ ] Verify v2 maintains IE overlay
- [ ] Verify v1 unchanged

#### RUN 6 Result
- [ ] ✅ **PASS**
- [ ] ❌ **FAIL**

**Issues/Notes:**
```
[If failed, list which UK references appeared]
```

---

## RUN 7 — DELETE RULES (NON-ISSUED ONLY) 🗑️

### Test Details
- **Goal:** Verify delete works for drafts, blocked for issued

### Test Steps

#### 7.1 Delete Draft Document
- [ ] Create new FRA document (any jurisdiction)
- [ ] **survey_id:** `_____________________`
- [ ] Fill in minimal fields (stay in Draft)
- [ ] Find document in assessments list
- [ ] Open dropdown menu (⋮)
- [ ] Verify "Delete" option visible
- [ ] Click Delete
- [ ] Verify modal appears
- [ ] Type "DELETE" in confirmation box
- [ ] Confirm deletion
- [ ] **Expected:** Document disappears from list
- [ ] Refresh page
- [ ] **Expected:** Document still gone
- [ ] Try to navigate to document URL directly
- [ ] **Expected:** "Document not found" message
- [ ] **Result:** ✅ PASS / ❌ FAIL - `_____________________`

#### 7.2 Delete Approved (Not Issued) Document
- [ ] Create new FRA document
- [ ] **survey_id:** `_____________________`
- [ ] Complete required fields
- [ ] Submit → Approve (DO NOT ISSUE)
- [ ] Go back to assessments list
- [ ] Open dropdown menu
- [ ] Verify "Delete" option visible
- [ ] Delete document
- [ ] **Expected:** Document disappears
- [ ] **Result:** ✅ PASS / ❌ FAIL - `_____________________`

#### 7.3 Cannot Delete Issued Document (UI)
- [ ] Use any issued document from previous runs (e.g., RUN1 v1)
- [ ] Go to assessments list
- [ ] Find the issued document
- [ ] Open dropdown menu (⋮)
- [ ] **Expected:** "Delete" option NOT visible
- [ ] **Result:** ✅ PASS / ❌ FAIL - `_____________________`

#### 7.4 Cannot Delete Issued Document (API)
**This requires browser console:**

- [ ] Open browser console (F12)
- [ ] Get document_id of an issued document
- [ ] Run this fetch call:
```javascript
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-document`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ document_id: 'ISSUED_DOC_ID_HERE' })
  }
);
const data = await response.json();
console.log(response.status, data);
```

- [ ] **Expected:** Response status: 403 Forbidden
- [ ] **Expected:** Error message: "Issued documents cannot be deleted"
- [ ] **Result:** ✅ PASS / ❌ FAIL - `_____________________`

#### RUN 7 Result
- [ ] ✅ **PASS**
- [ ] ❌ **FAIL**

**Issues/Notes:**
```
[If failed, describe what went wrong]
```

---

## GLOBAL TEST SUMMARY

### Results Overview

| Run | Test | Status | Notes |
|-----|------|--------|-------|
| 1 | FRA (UK) | ⬜ PASS / ⬜ FAIL | |
| 2 | FSD (UK) | ⬜ PASS / ⬜ FAIL | |
| 3 | Combined FRA+FSD (UK) | ⬜ PASS / ⬜ FAIL | |
| 4 | Combined FRA+FSD (IE) | ⬜ PASS / ⬜ FAIL | |
| 5 | Explosive Atmospheres (UK) | ⬜ PASS / ⬜ FAIL | |
| 6 | Explosive Atmospheres (IE) | ⬜ PASS / ⬜ FAIL | |
| 7 | Delete Rules | ⬜ PASS / ⬜ FAIL | |

### Critical Issues Found

**Priority 1 (Blockers):**
```
[List any critical failures that prevent launch]
```

**Priority 2 (Important):**
```
[List issues that should be fixed but aren't blockers]
```

**Priority 3 (Minor):**
```
[List cosmetic or minor issues]
```

### Survey IDs for Reference

Record all survey IDs here for future reference/debugging:

```
RUN1 v1: _____________________
RUN1 v2: _____________________
RUN2 v1: _____________________
RUN2 v2: _____________________
RUN3 v1: _____________________
RUN3 v2: _____________________
RUN4 v1: _____________________
RUN4 v2: _____________________
RUN5 v1: _____________________
RUN5 v2: _____________________
RUN6 v1: _____________________
RUN6 v2: _____________________
RUN7 Draft: _____________________
RUN7 Approved: _____________________
```

### Testing Environment

- **Date Tested:** `_____________________`
- **Tester Name:** `_____________________`
- **Browser:** `_____________________`
- **Environment:** `Production / Staging / Local`
- **Database:** `_____________________`

---

## PASS/FAIL CRITERIA

### ✅ GLOBAL PASS Criteria

All of the following MUST be true:

- [x] All 7 runs completed without blocking errors
- [x] Issue requires "approved" status (cannot issue from draft/in_review)
- [x] Issued v1 outputs remain unchanged after v2 issued (immutability verified)
- [x] Compliance packs match issued revision PDFs
- [x] IE jurisdiction NEVER shows UK-only legal references
- [x] Issued documents blocked from edits (write-lock enforced, 403 from API)
- [x] Delete works for draft/approved, blocked for issued (UI and API)
- [x] Combined surveys require ALL enabled modules complete before issue
- [x] Version picker correctly switches between issued revisions
- [x] Audit log records all lifecycle events

### ❌ FAIL Conditions

Any of these indicates a critical failure:

- [ ] Can issue directly from Draft (skipping approval)
- [ ] Issued v1 PDF changes after v2 issued (immutability broken)
- [ ] UK references appear in IE jurisdiction reports
- [ ] Can edit/close/reopen on issued documents (write-lock bypass)
- [ ] Can delete issued documents (delete protection bypass)
- [ ] Combined survey allows issue with only FRA or only FSD complete
- [ ] Compliance pack contains wrong revision PDF
- [ ] Version picker shows wrong content

---

## Next Steps After Testing

### If ALL PASS ✅
Proceed to DAY 9: Lock/regression sweep + final hardening

### If ANY FAIL ❌
1. Record the exact failure scenario with screenshots
2. Copy error messages from browser console
3. Note the survey_id where failure occurred
4. Report to development team for immediate fix
5. Re-run failed test after fix applied
6. Do not proceed to DAY 9 until all tests pass

---

## Notes for Developer

### Code Locations for Common Issues

**Issue workflow:**
- `supabase/functions/issue-survey/index.ts`
- `supabase/functions/submit-for-review/index.ts`
- `supabase/functions/approve-survey/index.ts`

**Revision creation:**
- `supabase/functions/create-revision/index.ts`

**Write-lock enforcement:**
- `supabase/functions/_shared/surveyGuards.ts`
- `supabase/functions/close-action/index.ts`
- `supabase/functions/reopen-action/index.ts`

**Irish overlay:**
- `src/lib/reportText/references.ts`
- `src/lib/pdf/buildDsearPdf.ts`
- `src/lib/pdf/buildFraPdf.ts`
- `src/lib/pdf/buildFsdPdf.ts`

**Delete functionality:**
- `supabase/functions/delete-document/index.ts`
- `src/pages/ezirisk/AssessmentsPage.tsx`
- `src/components/DeleteDocumentModal.tsx`

**Combined survey gating:**
- `src/components/issue/IssueReadinessPanel.tsx`
- `src/utils/issueValidation.ts`

---

## END OF CHECKLIST

**Remember:** The goal is to verify that all critical workflows work correctly before launch. Take your time, be thorough, and document everything you find.

Good luck! 🚀
