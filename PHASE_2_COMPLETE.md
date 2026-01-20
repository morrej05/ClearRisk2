# Phase 2 Implementation Complete

## Overview

Phase 2 of the modular FRA system has been successfully implemented. The system now has:
- A common dashboard with 4 tiles for accessing different modules
- Fire Safety dashboard for FRA/FSD documents
- Explosion Safety dashboard for DSEAR documents
- Actions register for cross-document action tracking
- Document creation flow with automatic module skeleton generation
- Document overview page showing modules and metadata

## What You Can Do Now

### 1. Access Common Dashboard
**Route:** `/common-dashboard`

View 4 tiles:
- **Risk Engineering** → `/dashboard` (existing surveys)
- **Fire Safety** → `/dashboard/fire`
- **Explosion Safety** → `/dashboard/explosion` (Pro only)
- **Actions Register** → `/dashboard/actions`

### 2. Fire Safety Dashboard
**Route:** `/dashboard/fire`

- View all FRA and FSD documents in a table
- Create new FRA or FSD documents
- Click any document to view details
- Delete draft documents

### 3. Explosion Safety Dashboard
**Route:** `/dashboard/explosion`

- Pro/Enterprise users: View all DSEAR documents
- Core users: See upgrade prompt
- Create new DSEAR documents (Pro only)
- Click any document to view details

### 4. Actions Dashboard
**Route:** `/dashboard/actions`

- View all actions across all documents
- Filter by:
  - Status (open, in progress, complete, deferred, not applicable)
  - Priority (P1-P4)
  - Document type (FRA, FSD, DSEAR)
- See risk ratings (likelihood × impact)
- Click action to navigate to parent document

### 5. Create Document
**Modal Component:** `CreateDocumentModal`

**Fields:**
- Document Type (FRA/FSD/DSEAR)
- Title (required)
- Assessment Date (defaults to today)
- Assessor Name & Role
- Responsible Person
- Standards & References (multi-select):
  - BS 9999:2017
  - BS 9991:2015
  - Approved Document B
  - BS 5588 (legacy)
  - BS 7974 (fire engineering)
  - PD 7974
  - NFPA 101
  - Other
- Scope Description
- Limitations & Assumptions

**Auto-Created Module Skeletons:**

**FRA Modules:**
1. A1_DOC_CONTROL
2. A2_BUILDING_PROFILE
3. A3_PERSONS_AT_RISK
4. A4_MANAGEMENT_CONTROLS
5. A5_EMERGENCY_ARRANGEMENTS
6. A7_REVIEW_ASSURANCE
7. FRA_1_HAZARDS
8. FRA_2_ESCAPE_ASIS
9. FRA_3_PROTECTION_ASIS
10. FRA_5_EXTERNAL_FIRE_SPREAD
11. FRA_4_SIGNIFICANT_FINDINGS

**FSD Modules:**
1. A1_DOC_CONTROL
2. A2_BUILDING_PROFILE
3. FSD_1_REG_BASIS
4. FSD_2_EVAC_STRATEGY
5. FSD_3_ESCAPE_DESIGN
6. FSD_4_PASSIVE_PROTECTION
7. FSD_5_ACTIVE_SYSTEMS
8. FSD_6_FRS_ACCESS
9. FSD_7_DRAWINGS
10. FSD_8_SMOKE_CONTROL
11. FSD_9_CONSTRUCTION_PHASE

**DSEAR Modules:**
1. A1_DOC_CONTROL
2. A2_BUILDING_PROFILE
3. DSEAR_1_SUBSTANCES_REGISTER
4. DSEAR_2_PROCESS_RELEASES
5. DSEAR_3_HAC_ZONING
6. DSEAR_4_IGNITION_CONTROL
7. DSEAR_5_MITIGATION
8. DSEAR_6_RISK_TABLE
9. DSEAR_10_HIERARCHY_SUBSTITUTION
10. DSEAR_11_EXPLOSION_EMERGENCY_RESPONSE

### 6. Document Overview Page
**Route:** `/documents/:id`

**Shows:**
- Document header with:
  - Title
  - Type badge (FRA/FSD/DSEAR)
  - Status badge (draft/issued/superseded)
  - Version number
- Metadata:
  - Assessment date
  - Assessor name & role
  - Last updated
  - Scope description
  - Standards selected
- Module progress bar (completion percentage)
- Complete list of modules with:
  - Module name (human-readable)
  - Completion status (checkmark or empty circle)
  - Outcome badge (compliant, minor deficiency, material deficiency, info gap, N/A, pending)
  - Completion date

**Disabled Buttons (Coming in Phase 3):**
- "Open Workspace" → Will open module editor
- "Export PDF" → Will generate PDF report

## Files Created

### Pages
1. `/src/pages/CommonDashboard.tsx` - Main dashboard with 4 tiles
2. `/src/pages/dashboard/FireSafetyDashboard.tsx` - FRA/FSD documents list
3. `/src/pages/dashboard/ExplosionDashboard.tsx` - DSEAR documents list
4. `/src/pages/dashboard/ActionsDashboard.tsx` - Cross-document actions register
5. `/src/pages/documents/DocumentOverview.tsx` - Document detail page with modules list

### Components
6. `/src/components/documents/CreateDocumentModal.tsx` - Document creation modal with auto-module generation

### Routes Added (in App.tsx)
- `/common-dashboard` → CommonDashboard
- `/dashboard/fire` → FireSafetyDashboard
- `/dashboard/explosion` → ExplosionDashboard
- `/dashboard/actions` → ActionsDashboard
- `/documents/:id` → DocumentOverview

## Database Interaction

### Organisation Structure
- Column name: `organisation_id` (not organization_id)
- Available via: `useAuth().organisation.id`
- All queries properly filter by organisation for multi-tenant security

### Tables Used
1. **documents** - Core document records
2. **module_instances** - Module execution records (auto-created on document creation)
3. **actions** - Action items from modules
4. **action_ratings** - Risk ratings for actions

### Module Instance Auto-Creation
When a document is created:
1. Document row inserted into `documents` table
2. Module skeleton rows immediately inserted into `module_instances` table
3. Each module_instance has:
   - `module_key` (e.g., "A1_DOC_CONTROL")
   - `module_scope` = "document"
   - `outcome` = null (pending)
   - `data` = {} (empty JSONB)
   - `assessor_notes` = ""

## Plan Gating

### Core Plan Users
- Access: Risk Engineering, Fire Safety, Actions
- Locked: Explosion Safety (upgrade prompt shown)

### Pro/Enterprise Users
- Access: All 4 tiles
- Explosion Safety fully functional

## User Experience Flow

### Creating a Document
1. Go to `/common-dashboard`
2. Click "Fire Safety" tile
3. Click "Create Document" button
4. Fill in document details
5. Click "Create Document"
6. Automatically redirected to `/documents/:id`
7. See document overview with all modules listed as "Pending"

### Viewing Documents
1. From Fire/Explosion dashboard
2. Click any document row
3. View document overview page
4. See modules list (workspace coming in Phase 3)

### Viewing Actions
1. Go to `/common-dashboard`
2. Click "Actions Register" tile
3. Filter by status/priority/type
4. Click any action to navigate to parent document

## Next Phase: Phase 3

**Goal:** Build Document Workspace + Module Renderer

**Priority Tasks:**
1. Create DocumentWorkspace.tsx with sidebar and main panel
2. Build ModuleRenderer.tsx to switch between modules
3. Implement Module A1 (Document Control) as first working example
4. Add "Save" functionality to persist module.data
5. Update outcome and completion status
6. Add "Add Action" button in modules

**What Phase 3 Will Enable:**
- Click "Open Workspace" button (currently disabled)
- Edit modules and save data
- Mark modules as complete with outcomes
- Create actions from within modules
- See module form data persist and reload

## Testing Checklist

### Core Functionality
- [x] Common dashboard loads with 4 tiles
- [x] Fire Safety dashboard shows FRA/FSD documents
- [x] Explosion Safety dashboard shows DSEAR documents (Pro users)
- [x] Explosion Safety shows upgrade prompt (Core users)
- [x] Actions dashboard shows all actions with filters
- [x] Create Document modal opens and submits
- [x] Document creation auto-generates module_instances
- [x] Document overview page loads and shows modules
- [x] Navigation works between all pages
- [x] Organisation-level RLS filtering works

### Edge Cases
- [x] Empty states show properly (no documents, no actions)
- [x] Draft documents can be deleted
- [x] Issued documents cannot be deleted
- [x] Modal closes on cancel/create
- [x] Filters work correctly on actions dashboard
- [x] Module progress bar calculates correctly

### Plan Gating
- [x] Core users see upgrade prompt for Explosion Safety
- [x] Pro users have full access to all features
- [x] Upgrade button navigates to /upgrade

## Known Limitations (By Design)

1. **Module Workspace Not Yet Built**
   - "Open Workspace" button disabled
   - Clicking modules shows placeholder alert
   - Coming in Phase 3

2. **No PDF Export**
   - "Export PDF" button disabled
   - Coming in Phase 4

3. **No Action Creation from Modules**
   - Actions dashboard shows actions but can't create new ones yet
   - Coming in Phase 3 when module workspace is built

4. **No Module Editing**
   - Modules show as pending, can't edit data yet
   - Coming in Phase 3

## Architecture Highlights

### Module Name Mapping
Human-readable names defined in `MODULE_NAMES` constant:
```typescript
const MODULE_NAMES: Record<string, string> = {
  A1_DOC_CONTROL: 'A1 - Document Control & Governance',
  A2_BUILDING_PROFILE: 'A2 - Building Profile',
  // ... etc
};
```

### Module Skeleton System
Modules defined in `MODULE_SKELETONS` constant in CreateDocumentModal:
```typescript
const MODULE_SKELETONS = {
  FRA: ['A1_DOC_CONTROL', 'A2_BUILDING_PROFILE', ...],
  FSD: ['A1_DOC_CONTROL', 'A2_BUILDING_PROFILE', ...],
  DSEAR: ['A1_DOC_CONTROL', 'A2_BUILDING_PROFILE', ...],
};
```

### Outcome Types
- `compliant` - Green badge
- `minor_def` - Amber badge
- `material_def` - Red badge
- `info_gap` - Blue badge
- `na` - Grey badge
- `null` - "Pending" grey badge

### Status Types
- `draft` - Can be edited and deleted
- `issued` - Read-only, cannot be deleted
- `superseded` - Replaced by newer version

### Priority Bands
- P1 - Critical (red badge)
- P2 - High (orange badge)
- P3 - Medium (amber badge)
- P4 - Low (blue badge)

## Build Status

✅ **Build Successful**
- All TypeScript compiles cleanly
- No errors or warnings
- Bundle size: 995 KB (243 KB gzipped)

---

**Status:** Phase 2 Complete
**Next:** Phase 3 - Document Workspace & Module Renderer
**Last Updated:** 2026-01-20
