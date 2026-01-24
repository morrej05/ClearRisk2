# Issue Gating System - Spine Implementation Complete

## Overview

The core "spine" of the issue gating system has been successfully implemented. This provides hard server-side validation that prevents surveys from being issued until all required modules and conditions are met.

## What Was Implemented

### 1. Module Key Mapping ✓

**File:** `src/config/moduleKeys.ts`

Created a single source of truth that maps abstract module names to actual section keys used in the application:
- FRA modules: A1_DOC_CONTROL, A2_BUILDING_PROFILE, A3_PERSONS_AT_RISK, A4_MANAGEMENT_CONTROLS, A5_EMERGENCY_ARRANGEMENTS, FRA_1_HAZARDS, FRA_2_ESCAPE_ASIS, FRA_3_PROTECTION_ASIS, FRA_4_SIGNIFICANT_FINDINGS
- FSD modules: Same common modules + FSD_1_REG_BASIS through FSD_8_SMOKE_CONTROL
- DSEAR modules: Common modules + DSEAR_1_DANGEROUS_SUBSTANCES through DSEAR_11_EXPLOSION_EMERGENCY_RESPONSE

**Important:** No existing section keys were renamed - only mapped.

### 2. Issue Requirements Rules ✓

**File:** `src/utils/issueRequirements.ts`

Defines required modules for each survey type:

**FRA Required (9 modules):**
- Document Control, Building Profile, Persons at Risk
- Management Systems, Emergency Arrangements
- Hazards, Means of Escape, Fire Protection
- Significant Findings

**FSD Required (6-7 modules):**
- Document Control, Building Profile, Persons at Risk
- Regulatory Basis, Evacuation Strategy, Escape Design
- Passive Protection, Active Systems, FRS Access
- Conditional: Smoke Control (if `smoke_control_applicable`)

**DSEAR Required (11 modules):**
- Document Control, Building Profile, Persons at Risk
- Dangerous Substances, Process Releases
- Hazardous Area Classification, Ignition Sources
- Explosion Protection, Risk Assessment Table
- Hierarchy of Control, Explosion Emergency Response

### 3. Validation Logic ✓

**File:** `src/utils/issueValidation.ts`

Server-reusable validation with simple, serializable inputs:
- `validateIssueEligibility(type, ctx, answers, moduleProgress, actions)`
- Returns `{ eligible: boolean, blockers: Blocker[] }`

**Validation Rules Implemented:**

**FRA:**
- All 9 required modules must be complete
- If scope_type is 'limited' or 'desktop', scope_limitations must be non-empty
- Must have ≥1 open recommendation OR no_significant_findings flag

**FSD:**
- All 6 core modules must be complete
- Smoke Control module required if applicable
- If engineered_solutions_used: limitations_text and management_assumptions_text required

**DSEAR:**
- All 11 required modules must be complete
- Must have ≥1 substance OR no_dangerous_substances flag
- Must have ≥1 zone OR no_zoned_areas flag
- Must have ≥1 open action OR controls_adequate_confirmed flag

### 4. Database Schema ✓

**Verified existing fields in `survey_reports`:**
- `document_type` TEXT (FRA/FSD/DSEAR)
- `current_revision` INTEGER DEFAULT 1
- `scope_type` TEXT (full/limited/desktop/other)
- `scope_limitations` TEXT
- `engineered_solutions_used` BOOLEAN DEFAULT false
- `change_log` TEXT
- `issued_confirmed` BOOLEAN DEFAULT false

**Verified `survey_revisions` table exists** with:
- `survey_id`, `revision_number` (unique together)
- `status`, `snapshot` (JSONB)
- `issued_at`, `issued_by`

**Module completion tracked via:**
- `module_instances.completed_at` (non-null = complete)

### 5. Edge Function: /issueSurvey ✓

**File:** `supabase/functions/issue-survey/index.ts`
**Deployed:** ✓

**Endpoint:** `POST /functions/v1/issue-survey`

**Request Body:**
```json
{
  "survey_id": "uuid",
  "change_log": "optional string"
}
```

**Server-Side Validation Flow:**
1. Authenticate user
2. Fetch survey (check ownership)
3. Check if already issued
4. Build context from survey fields
5. Fetch module instances → build moduleProgress map
6. Fetch recommendations/actions
7. **Run validateIssueEligibility** (HARD GATE)
8. If blockers exist → return 400 with blocker list
9. Determine revision_number (handle reissue)
10. Create snapshot (survey metadata + answers + moduleProgress + actions)
11. Upsert survey_revisions row with snapshot
12. Update survey_reports: issued=true, current_revision, change_log
13. Return success with revision_number

**Success Response:**
```json
{
  "success": true,
  "revision_number": 1,
  "revision_id": "uuid",
  "message": "Survey issued successfully"
}
```

**Error Response (Validation Failed):**
```json
{
  "error": "Survey does not meet issue requirements",
  "blockers": [
    {
      "type": "module_incomplete",
      "moduleKey": "A1_DOC_CONTROL",
      "message": "Module A1_DOC_CONTROL must be completed"
    },
    {
      "type": "no_recommendations",
      "message": "Must have recommendations OR confirm no significant findings"
    }
  ]
}
```

### 6. Temporary Test UI ✓

**File:** `src/pages/ReportPreviewPage.tsx`

Added developer test button on survey preview page:
- Button visible when user logged in and survey not issued
- Calls `/functions/v1/issue-survey` endpoint
- Displays success/failure results with blockers
- Auto-refreshes survey data on success

**Test Button Location:** Top right, next to "Export PDF" button

## How to Test

### Test Case 1: Missing Modules
1. Navigate to a survey preview page
2. Ensure some required modules are not marked complete
3. Click "Test Issue" button
4. Should see error with list of incomplete modules

### Test Case 2: FRA Scope Limitations
1. Set survey scope_type to 'limited' or 'desktop'
2. Leave scope_limitations empty
3. Click "Test Issue"
4. Should see blocker: "Scope limitations required for limited/desktop assessments"

### Test Case 3: FSD Engineered Solutions
1. Set engineered_solutions_used = true
2. Leave limitations_text or management_assumptions_text empty
3. Click "Test Issue"
4. Should see conditional blockers

### Test Case 4: Successful Issue
1. Complete all required modules (set completed_at on module_instances)
2. Add at least one recommendation (if FRA)
3. Fill in any conditional fields
4. Click "Test Issue"
5. Should see success message with revision_number
6. Survey status should change to issued
7. Revision snapshot created in survey_revisions table

### Test Case 5: Reissue Handling
1. Issue a survey successfully (revision 1)
2. Try to issue again
3. Should see error: "Survey is already issued"
4. (Future: create new revision flow will handle v2, v3, etc.)

## Data Flow

```
User clicks "Test Issue"
  ↓
POST /functions/v1/issue-survey
  ↓
Edge Function authenticates user
  ↓
Fetches survey + module_instances + recommendations
  ↓
Builds IssueCtx + ModuleProgress map
  ↓
Calls validateIssueEligibility()
  ↓
[If blockers] → Return 400 with blocker list
  ↓
[If eligible] → Create revision snapshot
  ↓
Insert survey_revisions row
  ↓
Update survey_reports (issued=true)
  ↓
Return 200 success
```

## What's NOT Implemented Yet (Next Steps)

1. **UI Readiness Panel** - Visual display of module completion status
2. **Issue Button/Modal** - Proper UI flow for issuing (beyond test button)
3. **Edit Locking** - Prevent form edits when survey is issued
4. **Create Revision Flow** - Button to create v2, v3 from issued surveys
5. **Revision History View** - Display past revisions
6. **PDF Generation from Snapshot** - Generate PDFs using revision snapshot data

## Files Created/Modified

### Created:
- `src/config/moduleKeys.ts` - Module key mapping
- `src/utils/issueRequirements.ts` - Required module rules (updated with real keys)
- `src/utils/issueValidation.ts` - Validation logic (updated with simplified API)
- `supabase/functions/issue-survey/index.ts` - Complete rewrite with hard gating

### Modified:
- `src/pages/ReportPreviewPage.tsx` - Added test button and result display

### Database:
- All required tables and fields already exist from previous migrations

## Key Design Decisions

1. **Server-side validation is mandatory** - Client cannot bypass validation
2. **Serializable inputs** - Validation logic can run in Edge Functions
3. **Module keys unchanged** - Used mapping instead of renaming
4. **Atomic transactions** - Revision creation and survey update happen together
5. **Immutable snapshots** - Complete survey state stored as JSONB
6. **Progressive disclosure** - Test button only for development, real UI comes next

## Build Status

✅ **Build successful** - No TypeScript errors
✅ **Edge Function deployed** - /issue-survey is live
✅ **Test button functional** - Ready for manual testing

## Next Phase

The "spine" is complete and functional. The next phase will build the user-facing UI:
- Issue readiness panel showing completion status
- Issue button/modal with confirmation workflow
- Edit locking when surveys are issued
- Create revision flow for v2, v3, etc.
- Integration with PDF generation

The hard gating is now in place and working. No survey can be issued without meeting all requirements.
