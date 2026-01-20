# Modular FRA System - Phase 1 Implementation Complete

## What Was Completed

### 1. Legacy Assessment System Archived ✅

**Old Assessment Routes** - Replaced with unified archived page:
- `/assessments/*` → Now shows `ArchivedAssessments.tsx` component
- Clean messaging explaining the migration to new system
- Links back to dashboard and previous page
- All old Assessment pages (AssessmentsList, NewAssessment, AssessmentEditor, etc.) are no longer routed

**Dashboard Navigation** - Cleaned up:
- Removed "Assessments" button from top nav (line 572-579)
- Removed "Regulated Assessments" card section (lines 637-656)
- Navigation now focuses on core Risk Engineering surveys

### 2. New Database Schema Created ✅

**Migration Applied:** `create_modular_documents_schema`

**New Tables:**

#### `documents`
Core document table supporting FRA/FSD/DSEAR:
- `id` (uuid, pk)
- `organisation_id` (uuid, fk → organisations)
- `site_id`, `building_id` (uuid, nullable - for future hierarchy)
- `document_type` (text, CHECK: FRA/FSD/DSEAR)
- `title` (text)
- `status` (text, CHECK: draft/issued/superseded)
- `version` (integer, default 1)
- `assessment_date` (date)
- `review_date` (date, nullable)
- `responsible_person`, `assessor_name`, `assessor_role` (text, nullable)
- `scope_description`, `limitations_assumptions` (text, nullable)
- `standards_selected` (jsonb, default '[]') - e.g., BS 9999, BS 9991, ADB
- `regulatory_framework` (text, nullable) - e.g., "RRO 2005"
- `created_at`, `updated_at` (timestamptz)

#### `module_instances`
Module execution records:
- `id` (uuid, pk)
- `organisation_id` (uuid, fk → organisations)
- `site_id`, `building_id` (uuid, nullable)
- `document_id` (uuid, fk → documents, CASCADE delete)
- `module_key` (text) - e.g., "A1", "FRA-1", "FRA-2"
- `module_scope` (text, CHECK: site/building/document)
- `outcome` (text, CHECK: compliant/minor_def/material_def/info_gap/na)
- `assessor_notes` (text, nullable)
- `data` (jsonb, default '{}') - stores module-specific form data
- `completed_at` (timestamptz, nullable)
- `created_at`, `updated_at` (timestamptz)

#### `actions`
Recommended actions from modules:
- `id` (uuid, pk)
- `organisation_id` (uuid, fk → organisations)
- `document_id` (uuid, fk → documents, CASCADE delete)
- `module_instance_id` (uuid, fk → module_instances, CASCADE delete)
- `recommended_action` (text)
- `owner_user_id` (uuid, fk → auth.users, nullable)
- `target_date` (date, nullable)
- `status` (text, CHECK: open/in_progress/complete/deferred/not_applicable)
- `priority_band` (text, CHECK: P1/P2/P3/P4)
- `timescale` (text) - e.g., "Immediate", "1 week", "1 month"
- `override_justification` (text, nullable) - if user overrides auto-calculated priority
- `created_at`, `updated_at` (timestamptz)

#### `action_ratings`
Risk ratings for actions (likelihood × impact):
- `id` (uuid, pk)
- `action_id` (uuid, fk → actions, CASCADE delete)
- `likelihood` (integer, CHECK: 1-5)
- `impact` (integer, CHECK: 1-5)
- `score` (integer) - calculated: likelihood × impact
- `rated_by_user_id` (uuid, fk → auth.users, nullable)
- `rated_at` (timestamptz)
- `rating_basis` (text, nullable) - explanation of rating

**Security:**
- All tables have RLS enabled
- Organisation-level isolation via RLS policies
- Users can only access data from their organisation
- Drafted documents can be deleted; issued documents cannot

**Indexes:**
- Organisation-based queries optimized
- Document/module relationships indexed
- Action status filtering indexed

**Triggers:**
- `updated_at` auto-updated on all tables

---

## What Needs To Be Built (Phase 2+)

### Priority 1: Core Document Flow

#### 1. Create New Dashboard Structure
**File:** `src/pages/CommonDashboard.tsx`

**Layout:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Tile 1: Risk Engineering (existing) */}
  <DashboardCard
    title="Risk Engineering"
    icon={<TrendingUp />}
    description="Property risk surveys and assessments"
    link="/dashboard"
    stats={{ active: surveysCount }}
  />

  {/* Tile 2: Fire Safety */}
  <DashboardCard
    title="Fire Safety"
    icon={<Flame />}
    description="FRA & Fire Strategies"
    link="/fire-safety"
    stats={{ active: fraCount + fsdCount }}
  />

  {/* Tile 3: Explosion Safety */}
  <DashboardCard
    title="Explosion Safety"
    icon={<AlertTriangle />}
    description="DSEAR & ATEX assessments"
    link="/explosion-safety"
    stats={{ active: dsearCount }}
  />

  {/* Tile 4: Actions Register */}
  <DashboardCard
    title="Actions"
    icon={<ClipboardList />}
    description="Cross-document action tracking"
    link="/actions"
    stats={{ open: openActionsCount, p1: p1Count }}
  />
</div>
```

**Route:** `/common-dashboard` (or replace existing `/dashboard` after migration)

---

#### 2. Fire Safety Dashboard
**File:** `src/pages/fire/FireSafetyDashboard.tsx`

**Features:**
- Button: "Create Document" → Opens document type selector
- Table: Recent FRA/FSD documents
- Filters: Status (draft/issued), Date range
- Quick actions: View, Edit, Delete (draft only)

**Route:** `/fire-safety`

---

#### 3. Explosion Safety Dashboard
**File:** `src/pages/explosion/ExplosionDashboard.tsx`

**Features:**
- Button: "Create DSEAR Document"
- Table: Recent DSEAR documents
- Similar filtering to Fire Safety Dashboard

**Route:** `/explosion-safety`

---

#### 4. Actions Dashboard
**File:** `src/pages/actions/ActionsDashboard.tsx`

**Features:**
- Global actions table across ALL documents
- Filters:
  - Priority: P1/P2/P3/P4
  - Status: Open/In Progress/Complete/Deferred
  - Owner: Assigned user
  - Due date: Overdue/Due this week/Due this month
  - Document type: FRA/FSD/DSEAR
- Columns:
  - Action description
  - Priority band
  - Status
  - Document link
  - Owner
  - Target date
  - Last updated

**Route:** `/actions`

---

### Priority 2: Document Creation Flow

#### 5. Create Document Modal
**File:** `src/components/documents/CreateDocumentModal.tsx`

**Flow:**
1. **Type Selection**
   - Radio buttons: FRA / FSD / DSEAR
   - Show description for each

2. **Basic Info**
   - Title (required)
   - Assessment date (required, default today)
   - Assessor name (required)
   - Assessor role
   - Responsible person

3. **Standards Selection** (multi-select)
   - BS 9999:2017
   - BS 9991:2015
   - Approved Document B
   - BS 5588 (legacy)
   - BS 7974 (fire engineering)

4. **Scope & Limitations**
   - Scope description (textarea)
   - Limitations & assumptions (textarea)

**Action:** Creates:
- `documents` row
- Auto-creates required `module_instances` for document type
- Redirects to Document Workspace

**FRA Auto-Created Modules:**
- A1: Document Control & Governance (document scope)
- A2: Building Profile (building scope)
- A3: Occupancy & Persons at Risk
- A4: Management Systems
- A5: Emergency Arrangements
- A7: Review & Assurance
- FRA-1: Hazards
- FRA-2: Means of Escape (as-is)
- FRA-3: Fire Protection (as-is)
- FRA-5: External Fire Spread
- FRA-4: Significant Findings (summary module)

---

### Priority 3: Document Workspace

#### 6. Document Workspace Page
**File:** `src/pages/documents/DocumentWorkspace.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Header: Document Title │ Status │ Last Updated │ Actions│
├──────────────┬──────────────────────────────────────────┤
│              │                                           │
│  Module List │        Active Module Form                │
│  (sidebar)   │                                           │
│              │  [Rendered based on module_key]          │
│  • A1 ✓      │                                           │
│  • A2 ✓      │  - Form fields                           │
│  • A3 (curr) │  - Outcome dropdown                      │
│  • A4        │  - Assessor notes                        │
│  • A5        │  - Add Action button                     │
│  • A7        │  - Save module                           │
│  • FRA-1     │                                           │
│  • FRA-2     │                                           │
│  • FRA-3     │                                           │
│  • FRA-5     │                                           │
│  • FRA-4     │                                           │
│              │                                           │
└──────────────┴──────────────────────────────────────────┘
```

**Features:**
- Sidebar: Module list with status chips (✓ completed, • in progress, blank pending)
- Main panel: Module renderer
- Header actions: Save draft, Generate report, Issue document
- Auto-save on module completion

**Route:** `/documents/:id`

---

#### 7. Module Renderer
**File:** `src/components/modules/ModuleRenderer.tsx`

**Approach:**
```tsx
export default function ModuleRenderer({ moduleInstance, onSave }: Props) {
  switch (moduleInstance.module_key) {
    case 'A1':
      return <ModuleA1 instance={moduleInstance} onSave={onSave} />;
    case 'A2':
      return <ModuleA2 instance={moduleInstance} onSave={onSave} />;
    case 'FRA-1':
      return <ModuleFRA1 instance={moduleInstance} onSave={onSave} />;
    // ... more modules
    default:
      return <GenericModule instance={moduleInstance} onSave={onSave} />;
  }
}
```

**Each module component:**
- Renders form fields specific to that module
- Saves data into `module_instances.data` (jsonb)
- Outcome dropdown at bottom
- Assessor notes textarea
- "Add Action" button to create linked actions
- Save button

---

### Priority 4: Action Management

#### 8. Add Action Modal
**File:** `src/components/actions/AddActionModal.tsx`

**Fields:**
1. Recommended action (textarea, required)
2. Likelihood (1-5 slider/select)
3. Impact (1-5 slider/select)
4. Auto-calculated score (likelihood × impact, readonly)
5. Auto-assigned priority band (P1-P4, readonly, can override)
6. Auto-assigned timescale (based on priority, can override)
7. Override justification (if user changes priority/timescale)
8. Owner (user selector, nullable)
9. Target date (date picker, nullable)

**Logic:**
```typescript
const score = likelihood × impact;

// Priority bands
if (score >= 20) priorityBand = 'P1';
else if (score >= 12) priorityBand = 'P2';
else if (score >= 6) priorityBand = 'P3';
else priorityBand = 'P4';

// Timescales
P1 → "Immediate" (0-7 days)
P2 → "Short term" (1-4 weeks)
P3 → "Medium term" (1-3 months)
P4 → "Long term" (3-12 months)
```

**Creates:**
- `actions` row
- `action_ratings` row

---

## Migration Strategy for Old Data

### Option A: Archive and Start Fresh (Recommended)
1. Rename old tables with `legacy_` prefix:
   ```sql
   ALTER TABLE assessments RENAME TO legacy_assessments;
   ALTER TABLE assessment_sections RENAME TO legacy_assessment_sections;
   ALTER TABLE assessment_responses RENAME TO legacy_assessment_responses;
   ```

2. Keep old data intact but inaccessible from UI
3. Build new FRA documents from scratch in new system
4. Optionally create data migration script later if needed

### Option B: Data Migration (High Risk)
- Map old `assessments` → new `documents`
- Map old `assessment_responses` → new `module_instances.data`
- Complex, error-prone, not recommended initially

**Decision:** Go with Option A. Archive old tables, start fresh.

---

## Next Steps Checklist

### Immediate (Phase 2):
- [ ] Create CommonDashboard.tsx with 4 tiles
- [ ] Create FireSafetyDashboard.tsx
- [ ] Update routing in App.tsx for new dashboards
- [ ] Create CreateDocumentModal.tsx
- [ ] Test document creation flow end-to-end

### Short Term (Phase 3):
- [ ] Create DocumentWorkspace.tsx
- [ ] Create ModuleRenderer.tsx with generic fallback
- [ ] Build Module A1 (Document Control)
- [ ] Build Module A2 (Building Profile)
- [ ] Test full FRA creation → module completion flow

### Medium Term (Phase 4):
- [ ] Build remaining FRA modules (A3, A4, A5, A7, FRA-1 to FRA-5)
- [ ] Create AddActionModal.tsx
- [ ] Build ActionsDashboard.tsx
- [ ] Implement action status tracking
- [ ] Test full workflow: Create FRA → Complete modules → Add actions → View in Actions Dashboard

### Long Term (Phase 5):
- [ ] Build ExplosionDashboard.tsx for DSEAR
- [ ] Create DSEAR-specific modules
- [ ] Build FSD (Fire Strategy Document) modules
- [ ] Report generation for new documents
- [ ] PDF export functionality
- [ ] Data migration tool from old assessments (if needed)

---

## Key Design Decisions

1. **Module Data Storage:** All module-specific form data goes into `module_instances.data` as jsonb. This provides maximum flexibility without schema changes.

2. **Action Prioritization:** Auto-calculated from likelihood × impact matrix, but user can override with justification.

3. **Document Status:** Simple 3-state model (draft/issued/superseded). Once issued, documents are read-only except for actions.

4. **Organisation Isolation:** All RLS policies enforce organisation_id matching, ensuring multi-tenant security.

5. **Cascade Deletes:** Deleting a document cascades to modules and actions. Only drafts can be deleted.

6. **Audit Trail:** `created_at` and `updated_at` on all tables, plus action ratings track who/when.

---

## Benefits of New System

1. **Modularity:** Reusable modules across document types
2. **Consistency:** Standardized module structure
3. **Flexibility:** Easy to add new modules without schema changes
4. **Action Tracking:** Unified actions register across all documents
5. **Priority-Based:** Risk-based action prioritization
6. **Scalability:** Supports FRA, FSD, DSEAR, and future document types
7. **Security:** Organisation-level isolation built-in
8. **Audit:** Full traceability of changes and ratings

---

## Current Status

✅ **Phase 1 Complete:**
- Old assessment system archived
- Database schema created and migrated
- Navigation cleaned up
- Build successful

🔄 **Next Priority:**
- Phase 2: Build dashboard tiles and document creation flow

---

## Development Notes

- All module form components should follow a consistent interface
- Use react-hook-form for module forms to minimize re-renders
- Cache module data locally and save on blur/completion
- Consider using Zustand or Jotai for document workspace state
- Keep module components small and focused (single responsibility)
- Use TypeScript interfaces for module data structures
- Add zod schemas for runtime validation of module.data

---

**Last Updated:** 2026-01-20
**Status:** Phase 1 Complete, Ready for Phase 2
