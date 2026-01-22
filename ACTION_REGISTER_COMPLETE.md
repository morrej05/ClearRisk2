# Action Register Implementation - Complete ✅

**Phase:** Outputs & Professional Defence — Step 2
**Date:** 2026-01-22

## Overview

Comprehensive Action Register system implemented with organization-wide and document-level views, advanced filtering, sorting, and CSV export capabilities. Fully compatible with versioned documents and action carry-forward logic.

## Implementation Details

### 1. Database Layer ✓

**Enhanced View:** `action_register_site_level`
- **New Fields Added:**
  - `document_type` (FRA, FSD, DSEAR)
  - `base_document_id` (document family tracking)
  - `version_number` (document version)
  - `issue_status` (draft, issued, superseded)
  - `module_key` (source module identifier)
  - `module_outcome` (module-specific data)

**Explicit FK Embeds:**
- All joins use explicit foreign key references
- No ambiguous embeds that could cause query failures
- Joins: documents, user_profiles, module_instances

**Aggregated View:** `action_register_org_level`
- Organization-wide statistics (counts by status, priority, overdue)
- Average closure days
- Efficient aggregation for dashboard metrics

### 2. Organization-Wide Register ✓

**Route:** `/dashboard/actions`

**Data Query:**
```typescript
getActionRegisterOrgLevel(organisationId)
- Filters: organisation_id = current org
- Excludes: deleted_at is null
- Default: Shows all actions (open, in_progress, closed)
- Sorting: tracking_status → priority_band → created_at
```

**Features:**
- Stats cards showing total, overdue, in-progress, closed counts
- Real-time filtering with visual feedback
- Efficient client-side filtering and sorting
- Graceful empty states

### 3. Filters & Sorting ✓

**Filter Types:**

1. **Status Filter** (multi-select)
   - Open
   - In Progress
   - Deferred
   - Closed

2. **Priority Filter** (multi-select)
   - P1 (Critical)
   - P2 (High)
   - P3 (Medium)
   - P4 (Low)

3. **Tracking Status Filter** (multi-select)
   - Overdue (target_date < today AND status != closed)
   - Due Soon (within 7 days)
   - On Track
   - Closed

4. **Document Type Filter** (multi-select, dynamic)
   - FRA, FSD, DSEAR (auto-populated from data)

5. **Module Filter** (multi-select, dynamic)
   - All module keys present in actions
   - Scrollable list with tooltips showing full module names

**Sorting Logic:**
```
Primary: priority_band (P1 → P4)
Secondary: tracking_status (overdue first)
Tertiary: created_at (descending)
```

### 4. Grouping & Version Display ✓

**Table Columns:**
- **Document**: Title, type, version number, issue status badge, module key
- **Action**: Full recommended action text (truncated with ellipsis)
- **Priority**: Color-coded badge (P1-P4)
- **Status**: Current status (open, in_progress, deferred, closed)
- **Tracking**: Status badge with color coding
- **Target Date**: Formatted date or "No date"
- **Owner**: Assigned user name or "Unassigned"

**Visual Indicators:**
- Issue Status Badges:
  - Issued: Green
  - Draft: Blue
  - Superseded: Gray
- Priority Colors:
  - P1: Red
  - P2: Amber
  - P3: Blue
  - P4: Neutral
- Tracking Status:
  - Overdue: Red
  - Due Soon: Amber
  - On Track: Blue
  - Closed: Green

### 5. Document-Level View ✓

**Access Points:**
- DocumentOverview page: "View Register" button in Open Actions card
- Direct link: `/dashboard/actions?document={documentId}`

**Features:**
- Automatically filters to show only actions for specified document
- Shows document title in page header
- "View All Actions" button to return to org-wide view
- Custom CSV filename includes document title
- All filters still available for further refinement

**URL Pattern:**
```
/dashboard/actions?document=<document-id>
```

### 6. CSV Export ✓

**Export Button:**
- Available on both org-wide and document-level views
- Respects all active filters
- Applies current sorting order

**CSV Columns (17 total):**
1. Priority
2. Status
3. Recommended Action
4. Owner
5. Target Date
6. Module Key
7. Document Title
8. Document Type
9. Version Number
10. Issue Status
11. Issue Date
12. Tracking Status
13. Timescale
14. Source
15. Age (Days)
16. Created Date
17. Closed Date

**Filename Format:**
- Org-wide: `action_register_YYYY-MM-DD.csv`
- Document-level: `actions_<DocumentTitle>_YYYY-MM-DD.csv`

**CSV Formatting:**
- All fields properly quoted
- Double-quote escaping for quotes within fields
- UTF-8 encoding
- Excel-compatible

### 7. Robustness & UX ✓

**Error Handling:**
- Query failures show clear error banner with details
- Failed queries logged to console
- Never blocks page render

**Empty States:**
- Friendly message when no actions exist
- Context-aware guidance:
  - With filters: "Try adjusting your filters"
  - Without filters: "Actions will appear here as documents are issued"
- Icon + message + suggested action

**Loading States:**
- Full-page spinner during initial load
- No flickering or layout shifts
- Smooth transitions

**Performance:**
- Database views for efficient querying
- Client-side filtering for instant response
- Memoized filter computations
- Efficient re-renders

### 8. Version Compatibility ✓

**Carried-Forward Actions:**
- `origin_action_id` tracks source action
- `carried_from_document_id` shows document history
- Actions maintain lineage across versions

**Version Display:**
- Shows current document version number
- Issue status indicates document state
- Full version history accessible via parent document

**Multi-Version Scenarios:**
- Register can show actions from multiple document versions
- Filtering by document includes all versions of that base document
- Clear visual indicators prevent confusion

## Data Flow

```
User Opens Register
    ↓
Query: action_register_site_level view
    ├─ Filter by organisation_id
    ├─ Exclude deleted actions
    └─ Join documents, users, modules
    ↓
Apply Client-Side Filters
    ├─ Status
    ├─ Priority
    ├─ Tracking Status
    ├─ Document Type
    ├─ Module Key
    └─ Document ID (if specified)
    ↓
Sort Results
    ├─ By tracking status (overdue first)
    ├─ Then by priority (P1 → P4)
    └─ Then by created date
    ↓
Display in Table
    ↓
User Exports CSV
    ↓
Generate CSV with current filters/sorting
    ↓
Download with appropriate filename
```

## Key Features Summary

1. **Dual-Level Access**: Org-wide and document-specific views
2. **Comprehensive Filtering**: 5 filter types with visual feedback
3. **Smart Sorting**: Multi-level sort prioritizing overdue actions
4. **Rich Metadata**: Document versions, modules, tracking status
5. **Professional Export**: 17-column CSV with proper formatting
6. **Version Aware**: Compatible with versioned documents
7. **Robust UX**: Empty states, loading states, error handling
8. **Performance**: Efficient queries with database views
9. **Accessibility**: Clear labels, visual indicators, responsive layout

## Routes

| Route | Purpose | Access |
|-------|---------|--------|
| `/dashboard/actions` | Org-wide action register | All authenticated users |
| `/dashboard/actions?document={id}` | Document-filtered register | All authenticated users |

## UI Components

| Component | Purpose |
|-----------|---------|
| `ActionRegisterPage` | Main register page with filters and table |
| Stats Cards | Visual summary of action counts |
| Filter Panel | Multi-select filters with clear button |
| Action Table | Sortable, clickable rows with rich metadata |
| Export Button | CSV download with current view |

## Database Views

| View | Purpose |
|------|---------|
| `action_register_site_level` | Detailed action list with all metadata |
| `action_register_org_level` | Aggregated statistics by organisation |

## Utility Functions

| Function | Purpose |
|----------|---------|
| `getActionRegisterOrgLevel()` | Fetch org-wide actions |
| `getActionRegisterSiteLevel()` | Fetch document-level actions |
| `filterActionRegister()` | Apply client-side filters |
| `exportActionRegisterToCSV()` | Generate CSV content |
| `downloadActionRegisterCSV()` | Trigger browser download |
| `getUniqueModuleKeys()` | Extract unique module keys |
| `getUniqueDocumentTypes()` | Extract unique document types |
| `getModuleKeyLabel()` | Human-readable module names |

## Testing Checklist

✅ **Org-Wide Register**
- Shows all actions across all documents
- Filters work correctly
- Sorting is consistent
- CSV export includes all visible actions

✅ **Document-Level Register**
- Filters to single document correctly
- Shows document title in header
- "View All Actions" button works
- CSV includes document name in filename

✅ **Filters**
- Each filter type works independently
- Multiple filters combine correctly (AND logic)
- Clear button resets all filters
- Filter count badge shows accurate count

✅ **Sorting**
- Overdue actions appear first
- Then sorted by priority (P1 → P4)
- Then by creation date
- Nulls handled gracefully

✅ **CSV Export**
- All 17 columns present
- Quotes properly escaped
- Respects filters and sorting
- Filename format correct

✅ **Version Handling**
- Shows version number for each action
- Issue status displayed correctly
- Carried-forward actions identifiable
- No confusion between versions

✅ **Empty States**
- Friendly message when no actions
- Different messages for filtered vs. empty org
- No errors or console warnings

✅ **Error Handling**
- Failed queries show error banner
- Page doesn't crash
- User can retry or navigate away

## Next Steps

With Action Register complete, the system now provides:
- ✅ Comprehensive action tracking
- ✅ Multi-level filtering and sorting
- ✅ Professional CSV exports
- ✅ Document-level and org-wide views
- ✅ Version-aware display
- ✅ Robust error handling

**Ready for:** Production use with live action management
