# Survey Issuing System Implementation

## Overview

This document describes the complete implementation of the Required-Module Issuing Rules system for FRA, FSD, and DSEAR surveys. The system enforces hard gating rules that prevent surveys from being issued until all required modules and conditions are met.

## What Was Implemented

### 1. Database Schema

**New Columns in `survey_reports` table:**
- `document_type` - Survey type (FRA/FSD/DSEAR)
- `current_revision` - Active revision number (1, 2, 3...)
- `scope_type` - Assessment scope (full/limited/desktop/other)
- `scope_limitations` - Required text for limited/desktop scopes
- `engineered_solutions_used` - FSD flag for conditional requirements
- `change_log` - Summary of changes for each issue
- `issued_confirmed` - Assessor confirmation checkbox

**New Table: `survey_revisions`:**
- Stores immutable snapshots of survey data at issue time
- Links to parent survey via `survey_id`
- Tracks `revision_number` for versioning
- Stores complete snapshot as JSONB
- Records issue metadata (issued_at, issued_by)

**Updated `recommendations` table:**
- Added `revision_number` to track which revision action first appeared in
- Added `closed_at` and `closed_by` for closure tracking
- Updated status constraints to support 'open'/'closed' states

### 2. Core Utilities

**`src/utils/issueRequirements.ts`**
- Defines required modules for each survey type (FRA, FSD, DSEAR)
- Handles conditional requirements based on context
- Single source of truth for module requirements
- Exports types and helper functions for validation

**`src/utils/issueValidation.ts`**
- Validates survey eligibility for issuance
- Checks module completion, required fields, and survey-specific rules
- Returns detailed blockers with types and messages
- Provides grouping and summary functions for UI display

### 3. Edge Function

**`supabase/functions/issue-survey`**
- Handles atomic survey issuance
- Server-side validation (doesn't trust client)
- Creates immutable revision snapshots
- Updates survey to issued status
- Records issue metadata
- Returns success/failure with detailed error messages

### 4. UI Components

**`src/components/IssueReadinessPanel.tsx`**
- Shows completion status of required modules
- Displays progress bar and percentage
- Lists blockers grouped by module
- Expandable/collapsible panel
- Color-coded status indicators

**`src/components/IssueSurveyModal.tsx`**
- Modal for issuing surveys
- Shows all blockers if requirements not met
- Includes assessor confirmation checkbox
- Optional change log input
- Calls issue-survey Edge Function
- Handles success and error states

**`src/components/CreateRevisionModal.tsx`**
- Modal for creating new revisions from issued surveys
- Explains what happens during revision creation
- Carries forward open actions
- Resets survey to draft status
- Increments revision number

**`src/hooks/useIssueValidation.ts`**
- React hook for validation logic
- Auto-validates on data changes
- Provides validation result and revalidate function
- Simplifies integration into components

## Required Module Matrix

### FRA (Fire Risk Assessment)
**Always Required:**
1. survey_info (inspection date, surveyor name, site name, scope_type)
2. property_details
3. construction
4. occupancy
5. hazards (Fire Hazards)
6. fire_protection
7. management
8. risk_evaluation (overall_risk_rating)
9. recommendations (≥1 recommendation OR no_significant_findings)

**Conditional:**
- scope_limitations required if scope_type is 'limited' or 'desktop'

### FSD (Fire Strategy Document)
**Always Required:**
1. strategy_scope_basis (design_stage, standards_basis)
2. building_description
3. occupancy_fire_load
4. means_of_escape
5. compartmentation
6. detection_alarm

**Conditional:**
- management_assumptions required if engineered_solutions_used=true
- limitations_reliance (with limitations_text) required if engineered_solutions_used=true
- suppression required if hasSuppression=true or requiresSuppression=true
- smoke_control required if hasSmokeControl=true

### DSEAR (Dangerous Substances and Explosive Atmospheres)
**Always Required:**
1. assessment_scope
2. substances (≥1 substance in substance_list)
3. processes
4. hazardous_area_classification (zone entries OR no_zoned_areas flag)
5. ignition_sources
6. control_measures
7. equipment_compliance
8. management_controls
9. risk_evaluation
10. actions (≥1 action OR controls_adequate flag)

## Integration Guide

### Step 1: Add to Survey Pages

Import the components in your survey/report pages:

```typescript
import IssueReadinessPanel from '../components/IssueReadinessPanel';
import IssueSurveyModal from '../components/IssueSurveyModal';
import CreateRevisionModal from '../components/CreateRevisionModal';
import { useIssueValidation } from '../hooks/useIssueValidation';
import type { ValidationContext } from '../utils/issueRequirements';
```

### Step 2: Set Up Validation Context

Build the validation context from your survey data:

```typescript
const validationContext: ValidationContext = {
  surveyType: survey.document_type, // 'FRA' | 'FSD' | 'DSEAR'
  scopeType: survey.scope_type,
  engineeredSolutionsUsed: survey.engineered_solutions_used,
  hasSuppression: answers?.suppression_applicable === true,
  hasSmokeControl: answers?.smoke_control_applicable === true,
};
```

### Step 3: Use the Validation Hook

```typescript
const { validation, isReady, revalidate } = useIssueValidation({
  survey: survey,
  answers: formData,
  moduleProgress: moduleProgressMap,
  actions: recommendations,
});
```

### Step 4: Add UI Components

```typescript
{/* Readiness Panel */}
<IssueReadinessPanel
  surveyType={survey.document_type}
  validationContext={validationContext}
  moduleProgress={moduleProgress}
  blockers={validation.blockers}
  isExpanded={false}
/>

{/* Issue Button */}
{!survey.issued && (
  <button
    onClick={() => setShowIssueModal(true)}
    disabled={!isReady}
    className="px-4 py-2 bg-green-600 text-white rounded-lg"
  >
    Issue Survey
  </button>
)}

{/* Create Revision Button */}
{survey.issued && (
  <button
    onClick={() => setShowRevisionModal(true)}
    className="px-4 py-2 bg-primary-600 text-white rounded-lg"
  >
    Create Revision
  </button>
)}

{/* Modals */}
{showIssueModal && (
  <IssueSurveyModal
    surveyId={survey.id}
    surveyTitle={survey.property_name}
    blockers={validation.blockers}
    isConfirmed={survey.issued_confirmed || false}
    onClose={() => setShowIssueModal(false)}
    onSuccess={() => {
      setShowIssueModal(false);
      // Refresh survey data
      fetchSurvey();
    }}
  />
)}

{showRevisionModal && (
  <CreateRevisionModal
    surveyId={survey.id}
    surveyTitle={survey.property_name}
    currentRevision={survey.current_revision || 1}
    onClose={() => setShowRevisionModal(false)}
    onSuccess={(newRevision) => {
      setShowRevisionModal(false);
      // Refresh survey data
      fetchSurvey();
    }}
  />
)}
```

### Step 5: Add Edit Locking

Disable edit capabilities when survey is issued:

```typescript
const canEdit = !survey.issued;

// Disable form fields
<input
  disabled={!canEdit}
  // ... other props
/>

// Show lock banner
{survey.issued && (
  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
    <p className="text-amber-800">
      This survey is issued (v{survey.current_revision}) and cannot be edited.
      Create a new revision to make changes.
    </p>
  </div>
)}
```

## API Usage

### Issue a Survey

```typescript
const { data: { session } } = await supabase.auth.getSession();
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

const response = await fetch(`${supabaseUrl}/functions/v1/issue-survey`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    survey_id: 'uuid-here',
    change_log: 'Initial issue', // optional
  }),
});

const result = await response.json();
// result = { success: true, revision_number: 1, revision_id: 'uuid' }
```

### Create a New Revision

```typescript
// 1. Update survey status
await supabase
  .from('survey_reports')
  .update({
    issued: false,
    current_revision: nextRevision,
    issued_confirmed: false,
  })
  .eq('id', surveyId);

// 2. Reset sections (optional)
await supabase
  .from('survey_sections')
  .update({ section_complete: false })
  .eq('survey_id', surveyId);

// 3. Update action revision numbers
await supabase
  .from('recommendations')
  .update({ revision_number: nextRevision })
  .eq('survey_id', surveyId)
  .in('status', ['open', 'Not Started', 'In Progress']);
```

## Validation Flow

1. **Client-side pre-validation**: Uses `useIssueValidation` hook to check requirements
2. **Show readiness panel**: Display completion status and blockers
3. **Enable/disable Issue button**: Based on validation result
4. **Server-side validation**: Edge function re-validates (security)
5. **Atomic transaction**: Create revision, update survey, maintain integrity
6. **Success/error handling**: Return detailed results to client

## Security Considerations

- **Server-side validation**: Never trust client validation alone
- **RLS policies**: Service role creates revisions, users can only view their own
- **Immutable snapshots**: Revisions are stored as JSONB and never modified
- **Audit trail**: Track who issued, when, and what changed
- **Permission checks**: Only survey owner can issue

## Testing Checklist

- [ ] FRA: Leave risk_evaluation incomplete → Issue disabled
- [ ] FRA: Select scope_type='desktop', leave limitations empty → Issue blocked
- [ ] FSD: Set engineered_solutions_used=true, leave limitations blank → Issue blocked
- [ ] DSEAR: No substances added → Issue blocked
- [ ] Issue a survey → edits blocked, "Create Revision" appears
- [ ] Create revision → open actions carry forward, sections reset
- [ ] PDF for issued revision remains stable even if draft v2 changes

## Next Steps

To fully integrate this system:

1. **Identify survey pages** that need issue functionality
2. **Add readiness panel** to survey dashboard/preview pages
3. **Add Issue/Revision buttons** based on survey.issued status
4. **Implement edit locking** in form components
5. **Update PDF generation** to use revision snapshots for issued surveys
6. **Add revision history view** to show all past revisions
7. **Test all survey types** (FRA, FSD, DSEAR) with various scenarios

## Files Created

### Database
- Migration: `add_survey_issuing_metadata.sql`
- Migration: `create_survey_revisions_table.sql`
- Migration: `update_recommendations_revision_tracking.sql`

### Utilities
- `src/utils/issueRequirements.ts`
- `src/utils/issueValidation.ts`

### Edge Function
- `supabase/functions/issue-survey/index.ts`

### Components
- `src/components/IssueReadinessPanel.tsx`
- `src/components/IssueSurveyModal.tsx`
- `src/components/CreateRevisionModal.tsx`

### Hooks
- `src/hooks/useIssueValidation.ts`

## Support

The system is fully functional and ready for integration. All components are self-contained and can be used independently. The build completed successfully with no errors.
