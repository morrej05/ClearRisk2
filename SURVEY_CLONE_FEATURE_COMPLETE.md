# Survey Clone Feature - Complete Implementation

Successfully implemented survey cloning functionality that allows users to create a brand-new draft survey from an existing one, perfect for template re-use and productivity workflows.

## Implementation Summary

### Edge Function ✓
**POST /clone-survey**
- Creates new survey with fresh UUID and Draft v1 status
- Optionally copies answers from source survey
- Optionally copies open actions only
- Preserves site/property metadata
- Never copies approval, audit history, or issued revisions

### UI Components ✓
- **CloneSurveyModal** - Modal with copy options and clear information
- **Dashboard** - Clone button in survey list actions
- **ReportPreviewPage** - Clone button in survey header

### Clone Rules (Hard Rules)

**Must Do:**
- Create NEW survey_id (never reuse)
- Start at status='draft', current_revision=1
- Have NO audit history
- Have NO issued revisions  
- Have NO approval metadata

**May Copy (Configurable):**
- survey_type (FRA/FSD/DSEAR)
- site/property metadata
- scope defaults
- answers (checkbox: default ON)
- open actions only (checkbox: default OFF)

**Must NOT Copy:**
- revisions
- audit_log rows
- approval state (approved_at, approved_by, approval_note)
- issued PDFs
- issue_date, issued_by

## Key Features

✅ **Clean separation** - Clone is new survey, not a revision
✅ **Configurable copy** - Choose what to copy (answers, actions)
✅ **Productivity boost** - Reuse templates quickly
✅ **Permission-based** - Requires canCreateSurveys permission
✅ **Audit trail** - Source survey logs clone event
✅ **Module support** - Copies module instances when copying answers

## User Workflow

### From Dashboard
1. Click Copy icon in survey list row actions
2. Modal opens with copy options
3. Select "Copy answers" (default: ON)
4. Select "Copy open actions" (default: OFF)
5. Click "Clone Survey"
6. Redirected to new draft survey

### From Survey Header
1. Click "Clone Survey" button in header
2. Same modal and flow as above
3. Navigate to new cloned survey

## Technical Details

### Edge Function Logic
1. Authenticate user
2. Load source survey and verify access
3. Permission check (canCreateSurveys)
4. Create new survey row with fresh state
5. Copy module instances (if copy_answers=true)
6. Copy open actions (if copy_actions=true)
7. Write audit log to source survey
8. Return new_survey_id

### Security
- User must have VIEW access to source survey
- User must have CREATE permission in organization
- Same org restriction enforced
- Service role key used for privileged operations

### Data Copying

**Site Metadata (Always):**
- site_name
- site_address
- site_postcode
- latitude/longitude
- scope_type
- engineered_solutions_used

**Answers (Optional):**
- form_data JSON copied
- module_instances rows copied with new document_id
- completed_at reset to NULL

**Actions (Optional):**
- Only OPEN actions copied
- status reset to 'open'
- source set to 'cloned'
- owner_id set to current user
- revision_number set to 1

## UI Elements

### CloneSurveyModal
**Header:**
- Copy icon in blue background
- Title: "Clone Survey"
- Subtitle: "Create a new draft from this survey"

**Content:**
- Source survey name displayed
- Checkbox: "Copy answers" (detailed description)
- Checkbox: "Copy open actions" (detailed description)
- Info panel: "What will NOT be copied" (clear list)
- Note about Draft v1 creation

**Actions:**
- Cancel button
- "Clone Survey" button (blue, with loading state)

### Dashboard Integration
- Copy icon button in action buttons row
- Blue color to differentiate from other actions
- Title: "Clone Survey"
- Requires canCreateSurveys permission

### ReportPreviewPage Integration
- "Clone Survey" button in header toolbar
- Positioned before "Export PDF"
- Blue styling
- Available on all surveys (draft and issued)

## Files Created/Modified

**Created:**
- `supabase/functions/clone-survey/index.ts` - Edge function
- `src/components/CloneSurveyModal.tsx` - Modal component
- `SURVEY_CLONE_FEATURE_COMPLETE.md` - Documentation

**Modified:**
- `src/pages/Dashboard.tsx` - Added clone button and modal
- `src/pages/ReportPreviewPage.tsx` - Added clone button and modal

**Deployed:**
- `clone-survey` - Edge function ✅

## Build Status

✅ **Build successful** - No TypeScript errors
✅ **Edge function deployed** - clone-survey operational
✅ **UI integrated** - Clone buttons in dashboard and header
✅ **Modal functional** - Configuration options working

## Use Cases

**Template Re-use:**
- Create a standard FRA template
- Clone it for each new site
- Pre-filled with common answers
- Faster survey creation

**Site Refresh:**
- Clone issued survey for annual review
- Start with previous answers
- Update only what changed
- Independent revision history

**Training:**
- Create sample surveys
- Clone for practice
- No impact on original
- Safe experimentation

**Portfolio Management:**
- Clone similar buildings
- Maintain consistent approach
- Reduce data entry
- Improve efficiency

## Benefits

**For Users:**
- Significant time savings
- Reduced data entry errors
- Template-based workflows
- Better consistency

**For System:**
- Clean separation from revisions
- No risk to original data
- Proper audit trail
- Scalable approach

**For Organizations:**
- Standardization support
- Efficiency improvements
- Knowledge capture
- Best practice reuse

The clone survey feature provides a fast, safe way to create new surveys based on existing ones without the complexity of versioning or the risk of data corruption.
