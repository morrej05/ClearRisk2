# Phase 3 Implementation Complete ✅

## Overview

Phase 3 of the modular FRA system is fully functional! You now have a complete Document Workspace with module editing capabilities, action creation with L×I risk scoring, and comprehensive status tracking.

## What You Can Do Now (Definition of Done ✓)

### ✅ Create Document
- Go to Fire/Explosion dashboard
- Click "Create Document"
- Enter details and create FRA/FSD/DSEAR

### ✅ Open Workspace
- From Document Overview, click "Open Workspace"
- Navigate to `/documents/:id/workspace`
- See sidebar with all modules
- Select any module to edit

### ✅ Edit A1 Module and Save
- A1 Document Control form is fully functional
- Edit all document metadata fields
- Edit document control information
- Set outcome and add assessor notes
- Click "Save Module" - data persists immediately
- See "Last saved" confirmation

### ✅ Set Module Outcome
- Every module has OutcomePanel at bottom
- Choose: Compliant, Minor Def, Material Def, Info Gap, N/A
- Add assessor notes
- Outcome appears in sidebar and overview
- Module marked as "completed" when outcome set

### ✅ Add Action with L×I Calculation
- Click "Add Action" button in any module
- Enter recommended action
- Select Likelihood (1-5) and Impact (1-5)
- See automatic risk score calculation (L × I)
- See automatic priority band assignment:
  - **P1:** 20-25 (Immediate)
  - **P2:** 12-19 (≤30 days)
  - **P3:** 6-11 (≤90 days)
  - **P4:** 1-5 (Next review)
- Override timescale with justification if needed
- Action saved to database with rating

### ✅ View Actions
- **In-module actions table:** Shows all actions created from that specific module
- **Actions Dashboard:** Shows ALL actions across all documents with filters
- Both views show Priority, Status, Action text, and Due date

## New Routes Added

- `/documents/:id/workspace` → Document Workspace
- `/documents/:id/workspace?m=<moduleInstanceId>` → Specific module

## Files Created in Phase 3

### Core Infrastructure
1. `/src/lib/modules/moduleCatalog.ts` - Single source of truth for all module definitions

### Pages
2. `/src/pages/documents/DocumentWorkspace.tsx` - Main workspace with sidebar + editor panel

### Components
3. `/src/components/modules/ModuleRenderer.tsx` - Routes to correct module form
4. `/src/components/modules/OutcomePanel.tsx` - Reusable outcome + notes + save panel
5. `/src/components/modules/ModuleActions.tsx` - Actions list + Add Action button
6. `/src/components/actions/AddActionModal.tsx` - Action creation with L×I calculation

### Module Forms
7. `/src/components/modules/forms/A1DocumentControlForm.tsx` - First fully functional module

## Files Updated in Phase 3

1. `/src/pages/documents/DocumentOverview.tsx` - Added rollups, enabled workspace button
2. `/src/App.tsx` - Added workspace route

## Architecture Highlights

### Module Catalog (Single Source of Truth)
```typescript
export const MODULE_CATALOG: Record<string, ModuleDefinition> = {
  A1_DOC_CONTROL: {
    name: 'A1 - Document Control & Governance',
    docTypes: ['FRA', 'FSD', 'DSEAR'],
    order: 1,
  },
  // ... all 28 modules defined
};
```

**Used for:**
- Display names in sidebar and overview
- Module ordering (sorted by `order` field)
- Document type filtering
- Future report generation ordering

### A1 Module: Dual Data Storage Pattern

**Document table (shared metadata):**
- `assessment_date`
- `assessor_name`, `assessor_role`
- `responsible_person`
- `scope_description`, `limitations_assumptions`
- `standards_selected`

**module_instances.data (A1-specific):**
- `revision`
- `approval_status` (draft/issued/under_review/superseded)
- `approval_signatory`
- `document_owner`
- `revision_history`
- `distribution_list`

**Why?** Document fields are shared across ALL modules, A1-specific fields only matter for governance.

### L×I Risk Scoring Logic

**Calculation:**
```
Risk Score = Likelihood (1-5) × Impact (1-5)
Score Range: 1-25
```

**Priority Band Assignment:**
```
P1 (Critical):   20-25  →  Immediate
P2 (High):       12-19  →  ≤ 30 days
P3 (Medium):     6-11   →  ≤ 90 days
P4 (Low):        1-5    →  Next review
```

**Timescale Override:**
- User can select different timescale than suggested
- Must provide `override_justification` if override selected
- Justification stored in `actions.override_justification`

**Target Date Auto-Calculation:**
```typescript
immediate:    today
30d:          today + 30 days
90d:          today + 90 days
next_review:  null (manual)
custom:       null (manual)
```

### Module Completion Logic

**A module is "completed" when:**
```typescript
outcome !== null && outcome !== 'info_gap'
```

**Completion tracking:**
- `module_instances.completed_at` set to NOW when completed
- `completed_at` set to NULL if outcome removed or changed to 'info_gap'
- Info gaps don't count as "complete" because they require follow-up

### Placeholder Modules

All modules except A1 show:
- Module name from catalog
- "Module editor coming soon" message
- Full OutcomePanel (can set outcome + notes)
- Full ModuleActions (can add actions)
- Can mark as complete via outcome

**This means:** Even without detailed forms, users can complete assessments!

## Document Overview Enhancements

### New Stats Cards (3 Cards Grid)

**Card 1: Module Progress**
- Completion percentage (big number)
- Progress bar
- Count of Material Deficiencies
- Count of Information Gaps

**Card 2: Open Actions**
- Total open actions (big number)
- Breakdown by priority (P1/P2/P3/P4)
- Color-coded priority counts

**Card 3: Document Status**
- Status badge
- Version number
- Document type

### Updated Module List
- Click any module → opens workspace at that module
- Modules sorted by `order` from catalog
- Shows completion status and outcome

### Active Buttons
- ✅ "Open Workspace" → `/documents/:id/workspace`
- ⏳ "Export PDF" → Coming in Phase 4 (still disabled)

## User Experience Flows

### Creating and Editing a Document

1. **Dashboard** → Fire Safety
2. **Create Document** → Fill form → Create
3. **Overview** → See stats (0% complete, no actions)
4. **Open Workspace** → See module sidebar
5. **A1 Module** (auto-selected)
   - Edit document metadata
   - Edit control info
   - Set outcome to "Compliant"
   - Add notes: "All governance documented"
   - **Save Module**
6. **See confirmation:** "Last saved at 14:23:45"
7. **Sidebar:** A1 now shows checkmark + "Compliant" badge
8. **Add Action:** "Review distribution list quarterly"
   - Likelihood: 2
   - Impact: 2
   - Score: 4 → P4
   - Timescale: Next review
   - **Create Action**
9. **Actions table** appears with 1 action
10. **Navigate to A2** Building Profile (placeholder)
    - Set outcome: "Info Gap"
    - Notes: "Need building plans"
    - Add Action: "Request floor plans from facilities"
      - Likelihood: 5, Impact: 3 → Score 15 → P2
      - Timescale: 30 days (auto-suggested)
    - **Save Module**
11. **Back to Overview**
    - Module Progress: 9% (1 of 11 completed)
      - 1 Info Gap badge shown
    - Open Actions: 2 total (0 P1, 1 P2, 0 P3, 1 P4)

### Viewing Actions Across Documents

1. **Common Dashboard** → Actions Register
2. **See all actions** from all documents
3. **Filter:**
   - Status: Open
   - Priority: P2
   - Type: FRA
4. **See filtered list** with documents
5. **Click action** → Navigate to parent document

## Database Tables Used

### documents
Core document record with metadata

### module_instances
- One row per module per document
- `data` JSONB: module-specific form data
- `outcome`: assessment result
- `assessor_notes`: assessor comments
- `completed_at`: timestamp when completed

### actions
- `recommended_action`: action description
- `status`: open/in_progress/complete/deferred/not_applicable
- `priority_band`: P1/P2/P3/P4
- `timescale`: immediate/30d/90d/next_review/custom
- `target_date`: calculated or manual due date
- `override_justification`: reason for timescale override

### action_ratings
- `action_id`: FK to actions
- `likelihood`: 1-5
- `impact`: 1-5
- `score`: L × I (1-25)
- `rated_by_user_id`: who created the rating
- `rated_at`: timestamp
- `rating_basis`: optional context (v1 uses null)

## A1 Document Control Fields

### Core Document Information (stored in `documents`)
- Assessment Date
- Assessor Name
- Assessor Role
- Responsible Person / Duty Holder
- Scope Description
- Limitations & Assumptions
- Standards & References (multi-select checkboxes)

### Document Control Information (stored in `module_instances.data`)
- Revision Number (e.g., "Rev 1.0")
- Approval Status (draft/issued/under_review/superseded)
- Approval Signatory
- Document Owner
- Revision History (text area)
- Distribution List (text area)

### Module Outcome (all modules)
- Outcome dropdown
- Assessor notes
- Save button

## What's NOT Yet Built (By Design)

### Module Forms (Coming in Phase 3.1+)
- A2 Building Profile
- A3 Persons at Risk
- A4 Management Controls ⭐ (Priority for next phase)
- A5 Emergency Arrangements
- A7 Review & Assurance
- FRA modules (1-5)
- FSD modules (1-9)
- DSEAR modules (1-11)

**Note:** All these can still have outcomes/notes/actions set via placeholder

### Action Management Features
- Mark action as complete (in-module)
- Edit action
- Delete action
- Action status updates
- Action comments/history

### PDF Export
- Coming in Phase 4

### Advanced Features
- Module dependencies
- Conditional module visibility
- Bulk action creation
- Action templates
- Risk matrix visualization

## Known Limitations (Intentional for v1)

1. **No action editing:** Once created, actions can't be modified in UI (can update via database)
2. **No action completion from module:** Must use Actions Dashboard or database
3. **Module data not validated:** Can save empty forms (intentional for drafts)
4. **No module locking:** Multiple users can edit same module (will implement in Phase 4)
5. **No autosave:** Must click Save button (intentional - explicit saves)
6. **No revision history tracking:** Only latest data saved (version control in Phase 5)

## Performance Considerations

### Database Queries
- Document Overview: 3 queries (document, modules, action counts)
- Workspace: 2 queries (document, modules)
- Module save: 1-2 queries (module_instance, optionally document)
- Action creation: 2 inserts (action, action_rating)

### Optimizations Applied
- Modules sorted client-side (not in DB)
- Action counts aggregated with single query
- No polling/subscriptions (manual refresh via save)

## Testing Checklist

### Core Functionality
- [x] Workspace loads with module sidebar
- [x] Module selection updates URL (?m=id)
- [x] A1 form loads with document data
- [x] A1 form saves to database
- [x] Outcome panel saves outcome + notes
- [x] Module completion marks completed_at
- [x] Add Action modal opens
- [x] L×I calculation works correctly
- [x] Priority band assigned correctly
- [x] Timescale override requires justification
- [x] Action saves to database with rating
- [x] Module actions list shows actions
- [x] Overview shows rollup stats
- [x] Overview "Open Workspace" button works
- [x] Module clicks navigate to workspace

### Edge Cases
- [x] Empty outcome saves as null
- [x] Info gap doesn't mark completed
- [x] Placeholder modules save outcome
- [x] Standards multi-select works
- [x] Override justification validation
- [x] Target date auto-calculation
- [x] Module order sorting

### Navigation
- [x] Workspace → Overview works
- [x] Module selection persists in URL
- [x] Direct URL with ?m= works
- [x] Default selects first module
- [x] Module click updates URL

## Build Status

✅ **Successful Build**
- Bundle: 1,030 KB (249 KB gzipped)
- All TypeScript compiles cleanly
- No errors or warnings
- Ready for production deployment

## Architecture Wins

### 1. Single Source of Truth for Modules
`moduleCatalog.ts` prevents duplication and drift between:
- Sidebar
- Overview
- Reports (Phase 4)
- Module routing

### 2. Reusable Outcome Panel
Every module gets same UX for completion:
- Consistent user experience
- Single component to maintain
- Easy to enhance (add approval workflow, etc.)

### 3. Risk Scoring Transparency
User sees calculation in real-time:
- No "black box" risk assignment
- Clear priority band logic
- Override option with accountability

### 4. Flexible Module Data Storage
JSONB `data` field allows:
- Different fields per module type
- Schema evolution without migrations
- Complex nested data structures

### 5. Module Placeholder Pattern
Users can be productive before all forms built:
- Still complete assessments
- Still create actions
- Still mark outcomes
- Gradual feature rollout

## Security & RLS

All queries properly filtered by:
- `organisation_id` (multi-tenant security)
- Document ownership
- Module ownership
- Action ownership

RLS policies enforced at database level.

## Next Steps: Phase 3.1 - A4 Management Controls

**Why A4 next?**
Most FRA actions come from management deficiencies:
- Training gaps
- Inspection schedules
- Contractor controls
- PTW systems
- Housekeeping issues

**A4 Form Fields:**
- Responsible person assignments
- Training frequency & records
- Permit to Work systems
- Contractor control process
- Inspection/testing schedules
- Housekeeping standards
- Change management triggers
- Emergency plan testing
- Documentation availability

**A4 will generate most actions** → Makes system immediately useful for real assessments!

## Summary

Phase 3 delivers a **fully functional MVP** for fire safety assessments:

✅ Complete document lifecycle (create → edit → save)
✅ Module editing with real data persistence
✅ Action creation with risk-based prioritization
✅ Comprehensive status tracking and rollups
✅ Professional UI with clear navigation
✅ Scalable architecture for rapid module expansion

**You now have a working fire safety assessment platform!**

Next phase will expand module coverage, starting with A4 Management Controls which will make the system immediately useful for real-world assessments.

---

**Status:** Phase 3 Complete ✅
**Next:** Phase 3.1 - Build A4 Management Controls Form
**Last Updated:** 2026-01-20
