# Action Source Field End-to-End in FRA PDF - COMPLETE

## Problem
The `source` field on actions (which identifies whether an action is 'system', 'manual', 'library', or 'ai') was not being consistently included in the FRA PDF generation pipeline. This prevented the `deriveSystemActionTitle` helper from properly detecting system actions and applying concise title shortening.

## Solution
Ensured the `source` field is included end-to-end through the entire FRA PDF generation flow:

1. **Draft actions queries** now explicitly select `source`
2. **Action preprocessing** preserves `source` via spread operator
3. **actionsForPdf mapping** explicitly includes `source`
4. **Diagnostic traces** added to verify `source` is present

## Changes Made

### 1. DocumentPreviewPage.tsx - Draft Actions Queries

#### First query (initial load) - Line 173
```typescript
// Before:
.select(`
  id,
  recommended_action,
  priority_band,
  status,
  owner_user_id,
  target_date,
  module_instance_id,
  created_at
`)

// After:
.select(`
  id,
  source,
  recommended_action,
  priority_band,
  status,
  owner_user_id,
  target_date,
  module_instance_id,
  created_at
`)
```

#### Second query (after reference assignment) - Line 307
```typescript
// Before:
.select(`
  id,
  recommended_action,
  priority_band,
  status,
  owner_user_id,
  target_date,
  module_instance_id,
  reference_number,
  created_at
`)

// After:
.select(`
  id,
  source,
  recommended_action,
  priority_band,
  status,
  owner_user_id,
  target_date,
  module_instance_id,
  reference_number,
  created_at
`)
```

**Note:** Issued document queries already use `select('*')` which includes `source` automatically.

### 2. buildFraPdf.ts - Action Preprocessing

#### actionsWithRefs mapping (Line 317)
```typescript
const actionsWithRefs = sortedActions.map((action) => {
  const sectionId = moduleToSectionMap.get(action.module_instance_id);
  const sectionRef = sectionId ? `Section ${getDisplaySectionNumber(sectionId)}` : null;

  return {
    ...action, // ✅ Preserves all fields including source
    reference_number: action.reference_number,
    section_reference: sectionRef,
    owner_display_name: getDisplayableOwner(action.owner_display_name),
  };
});
```

**The spread operator `...action` ensures `source` is preserved from the input.**

#### actionsForPdf mapping (Line 500)
```typescript
const actionsForPdf: ActionForPdf[] = actionsWithRefs.map(a => ({
  id: a.id,
  reference_number: a.reference_number,
  recommended_action: a.recommended_action,
  priority_band: a.priority_band,
  status: a.status,
  section_reference: a.section_reference,
  module_instance_id: a.module_instance_id,
  source: a.source, // ✅ Explicitly included (already present from earlier)
  first_raised_in_version: null,
  closed_at: null,
  superseded_by_action_id: null,
  superseded_at: null,
}));
```

### 3. Diagnostic Traces Added

#### Before Action Plan Snapshot (Line 507)
```typescript
console.log('[PDF] actions sample (before snapshot)', (actionsForPdf || []).slice(0,3).map(a => ({
  id: a.id,
  source: a.source,
  ref: a.reference_number,
  text: (a.recommended_action||'').slice(0,60),
})));
```

#### Before Action Register (Line 968)
```typescript
console.log('[PDF] actions sample (before register)', (actions || []).slice(0,3).map(a => ({
  id: a.id,
  source: a.source,
  ref: a.reference_number,
  text: (a.recommended_action||'').slice(0,60),
})));
```

## Data Flow

```
┌─────────────────────────────────────┐
│ DocumentPreviewPage.tsx             │
│ Draft actions query: source ✅      │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ buildFraPdf.ts                      │
│ actionsWithRefs: ...action ✅       │
│ (spread preserves source)           │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ actionsForPdf mapping               │
│ source: a.source ✅                 │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ Console trace                       │
│ Shows source='system' ✅            │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ drawActionPlanSnapshot              │
│ deriveSystemActionTitle ✅          │
│ (checks source='system')            │
└─────────────────────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ drawActionRegister                  │
│ deriveSystemActionTitle ✅          │
│ (checks source='system')            │
└─────────────────────────────────────┘
```

## Issued Documents

**No changes needed** for issued documents because:

1. Issued documents use snapshots from `action_snapshots` table
2. Snapshots are created via `select('*')` which includes all fields
3. The snapshot query already captures `source` when the action is frozen

## Verification

### Expected Console Output

When generating a draft FRA PDF with system-generated actions:

```
[PDF] actions sample (before snapshot) [
  {
    id: 'uuid-123',
    source: 'system',
    ref: 'FRA-2026-001',
    text: 'Install fire extinguishers on all floors to ensure compli...'
  },
  {
    id: 'uuid-456',
    source: 'manual',
    ref: 'FRA-2026-002',
    text: 'Conduct quarterly fire drills'
  }
]

[PDF] actions sample (before register) [
  // Same data structure
]
```

### Expected PDF Behavior

**System actions (source='system'):**
- Before: "Install fire extinguishers on all floors to ensure compliance with BS 5306-8"
- After: "Install fire extinguishers on all floors"

**Manual actions (source='manual'):**
- Before: "Conduct quarterly fire drills"
- After: "Conduct quarterly fire drills" (unchanged)

## Benefits

1. **Consistent shortening** - System actions shortened in both Snapshot and Register
2. **Preserves user intent** - Manual actions remain unchanged
3. **Diagnostic visibility** - Console traces confirm source field is present
4. **End-to-end traceability** - Source field tracked from DB to PDF rendering

## Related Changes

- `ACTION_SNAPSHOT_SYSTEM_TITLE_SHORTENING_COMPLETE.md` - The shortening logic
- `ADD_ACTION_SOURCE_CLASSIFICATION_FIX_COMPLETE.md` - How source is stamped on creation

## Status

✅ DocumentPreviewPage draft queries updated
✅ buildFraPdf actionsWithRefs preserves source
✅ actionsForPdf mapping includes source
✅ Diagnostic traces added
✅ Build successful
✅ Ready for testing
✅ Console logs will show source='system' for auto actions
✅ Shortening helper will now work correctly
