# FRA Actions Consistency + Significant Findings Save + PDF Action Linkage - COMPLETE

## Overview

Implemented a global actions invalidation bus to ensure real-time synchronization of action lists across all views, fixed FRA4 Significant Findings form data merging to prevent overwrites, and corrected FRA PDF Section 13 to use properly filtered actions matching the rest of the PDF.

## Changes Made

### Part 1: Global Actions Invalidation Bus

**Created:** `src/lib/actions/actionsInvalidation.ts`

A lightweight pub/sub system for triggering action list refreshes across the application:

```typescript
export type ActionsListener = () => void;

let version = 0;
const listeners = new Set<ActionsListener>();

export function bumpActionsVersion() {
  version += 1;
  for (const cb of Array.from(listeners)) cb();
}

export function getActionsVersion() {
  return version;
}

export function subscribeActionsVersion(cb: ActionsListener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
```

**Purpose:**
- No Redux/Zustand overhead
- Zero dependencies
- Instant propagation (synchronous callbacks)
- Subscribers re-fetch when version changes

### Part 2: Wired Invalidation into All Action Mutations

**Files Modified:**

1. **src/components/actions/AddActionModal.tsx**
   - Added `bumpActionsVersion()` after successful action insert (line 311)
   - Ensures new actions appear immediately in all views

2. **src/components/actions/ActionDetailModal.tsx**
   - Added `bumpActionsVersion()` after:
     - Action delete (line 146)
     - Status change (line 184)
     - Action close (line 219)
   - Ensures action updates propagate immediately

3. **src/components/modules/ModuleActions.tsx**
   - Added `bumpActionsVersion()` after action delete (line 232)
   - Ensures module footer list updates immediately

**Result:**
Any action mutation (create/update/close/delete) now triggers a global refresh across:
- DocumentWorkspace "Outstanding Actions" panel
- ModuleActions footer list
- Action Register page

### Part 3: Subscribed Fetchers to Version Changes

**A) DocumentWorkspace "Outstanding Actions"**

**File:** `src/pages/documents/DocumentWorkspace.tsx`

Added version-based refetch trigger:

```typescript
const [actionsVersion, setActionsVersion] = useState(getActionsVersion());

useEffect(() => {
  const unsubscribe = subscribeActionsVersion(() => setActionsVersion(getActionsVersion()));
  return unsubscribe;
}, []);

useEffect(() => {
  if (id && selectedModuleId) {
    fetchActions();
  }
}, [id, selectedModuleId, actionScope, actionsVersion]);
```

**Result:**
- Outstanding actions panel refetches immediately when any action changes
- No manual refresh needed
- Works across all tabs/modules

**B) Module Footer List**

**File:** `src/components/modules/ModuleActions.tsx`

Same pattern as DocumentWorkspace:

```typescript
const [actionsVersion, setActionsVersion] = useState(getActionsVersion());

useEffect(() => {
  const unsubscribe = subscribeActionsVersion(() => setActionsVersion(getActionsVersion()));
  return unsubscribe;
}, []);

useEffect(() => {
  // ... validation checks ...
  fetchActions();
  fetchDocumentStatus();
  fetchModuleKey();
}, [moduleInstanceId, documentId, actionsVersion]);
```

**Result:**
- Module footer action list updates immediately after any mutation
- Consistent with outstanding actions panel
- No stale data

**C) Action Register Page**

**File:** `src/pages/dashboard/ActionRegisterPage.tsx`

Added subscription for org-level action register:

```typescript
const [actionsVersion, setActionsVersion] = useState(getActionsVersion());

useEffect(() => {
  const unsubscribe = subscribeActionsVersion(() => setActionsVersion(getActionsVersion()));
  return unsubscribe;
}, []);

useEffect(() => {
  if (organisation?.id) {
    fetchData();
  }
}, [organisation?.id, actionsVersion]);
```

**Result:**
- Action Register refreshes when version changes
- Org-level view stays synchronized
- No drift between document and org views

### Part 4: Fixed FRA4SignificantFindingsForm Data Merge

**File:** `src/components/modules/forms/FRA4SignificantFindingsForm.tsx`

**Problem:**
Save operation was overwriting `moduleInstance.data` with only the new fields (computed, override, commentary), erasing any other data keys.

**Before:**
```typescript
const payload = sanitizeModuleInstancePayload({
  data: {
    computed: computedSummary,
    override: { ... },
    commentary: { ... },
  },
  outcome,
  assessor_notes: assessorNotes,
  updated_at: new Date().toISOString(),
}, moduleInstance.module_key);
```

**After:**
```typescript
const mergedData = {
  ...(moduleInstance.data || {}),  // Preserve existing data
  computed: computedSummary,
  override: { ... },
  commentary: { ... },
};

const payload = sanitizeModuleInstancePayload({
  data: mergedData,
  outcome,
  assessor_notes: assessorNotes,
  updated_at: new Date().toISOString(),
}, moduleInstance.module_key);
```

**Result:**
- Existing data keys preserved across saves
- No accidental data loss
- Section assessment persists correctly
- Safe for incremental form updates

### Part 5: Fixed FRA PDF Section 13 Action Filtering

**File:** `src/lib/pdf/buildFraPdf.ts`

**Problem:**
Section 13 (Significant Findings) was receiving the raw `actions` array, causing it to show ALL open/in_progress actions across the document, not just those mapped to FRA sections.

**Before (line 818):**
```typescript
yPosition = drawCleanAuditSection13({
  page: cursor.page,
  fra4Module,
  actions,  // Raw actions array - WRONG
  moduleInstances,
  // ...
});
```

**After (line 818):**
```typescript
yPosition = drawCleanAuditSection13({
  page: cursor.page,
  fra4Module,
  actions: actionsWithRefs,  // Filtered actions with references - CORRECT
  moduleInstances,
  // ...
});
```

**Why This Matters:**

`actionsWithRefs` is properly built (lines 312-322) with:
1. Section mapping via `moduleToSectionMap`
2. Canonical reference numbers from DB
3. Display section numbers
4. Owner display names

This ensures Section 13 uses the same filtered/mapped actions as:
- Action Register
- Section action counts
- Action snapshot tables
- All other PDF sections

**Result:**
- Section 13 now shows only FRA-related actions
- Counts match UI summary
- References match Action Register
- No divergence between PDF sections

## Testing Scenarios

### Test 1: Action Creation Propagation
1. Open document workspace
2. Create an action in any module
3. **Expected:**
   - Action appears immediately in module footer list
   - Action appears immediately in outstanding actions panel
   - Action appears in Action Register (after refresh/navigation)

### Test 2: Action Status Change Propagation
1. Open an action
2. Change status from "open" to "in_progress"
3. **Expected:**
   - Status updates immediately in all views
   - Outstanding actions count updates
   - Module footer reflects new status

### Test 3: Action Close/Delete Propagation
1. Close or delete an action
2. **Expected:**
   - Action disappears from outstanding actions
   - Module footer updates
   - Action Register reflects change
   - No manual refresh needed

### Test 4: FRA4 Save Data Preservation
1. Open FRA4 Significant Findings module
2. Fill executive commentary
3. Save
4. Navigate away and back
5. **Expected:**
   - Commentary persists
   - No data loss
   - Other module data keys intact

### Test 5: FRA PDF Section 13 Consistency
1. Generate FRA PDF with multiple module types (FRA + FSD/DSEAR)
2. Check Section 13 actions table
3. **Expected:**
   - Only FRA-related actions shown
   - References match Action Register
   - Counts match UI summary
   - No FSD/DSEAR actions in FRA Section 13

## Files Modified

1. **src/lib/actions/actionsInvalidation.ts** (NEW)
   - Global invalidation bus implementation

2. **src/components/actions/AddActionModal.tsx**
   - Line 13: Import `bumpActionsVersion`
   - Line 311: Bump after insert

3. **src/components/actions/ActionDetailModal.tsx**
   - Line 8: Import `bumpActionsVersion`
   - Lines 146, 184, 219: Bump after mutations

4. **src/components/modules/ModuleActions.tsx**
   - Line 8: Import invalidation functions
   - Line 59: Add `actionsVersion` state
   - Lines 75-78: Subscribe on mount
   - Line 94: Add `actionsVersion` to deps
   - Line 232: Bump after delete

5. **src/pages/documents/DocumentWorkspace.tsx**
   - Line 18: Import invalidation functions
   - Line 204: Add `actionsVersion` state
   - Lines 223-226: Subscribe on mount
   - Line 232: Add `actionsVersion` to deps

6. **src/pages/dashboard/ActionRegisterPage.tsx**
   - Line 29: Import invalidation functions
   - Line 43: Add `actionsVersion` state
   - Lines 55-58: Subscribe on mount
   - Line 64: Add `actionsVersion` to deps

7. **src/components/modules/forms/FRA4SignificantFindingsForm.tsx**
   - Lines 162-174: Merge existing data before save

8. **src/lib/pdf/buildFraPdf.ts**
   - Line 818: Pass `actionsWithRefs` instead of `actions`

## Architecture Benefits

### Invalidation Bus Benefits

1. **Simplicity:**
   - 20 lines of code
   - No external dependencies
   - Easy to understand and debug

2. **Performance:**
   - Synchronous callbacks (no Promise overhead)
   - Minimal memory footprint (Set of callbacks)
   - Only refetches when needed

3. **Flexibility:**
   - Any component can subscribe
   - Any mutation can trigger
   - No tight coupling

4. **Maintainability:**
   - Single source of truth (version number)
   - Clear ownership (one bus for all actions)
   - Easy to add new subscribers

### Data Merge Benefits

1. **Safety:**
   - No accidental data loss
   - Preserves all existing keys
   - Fail-safe default (`|| {}`)

2. **Incremental Updates:**
   - Forms can save partial data
   - Multiple saves don't conflict
   - Future-proof for new fields

### PDF Filter Benefits

1. **Consistency:**
   - Section 13 matches other sections
   - References align across document
   - Counts match UI

2. **Correctness:**
   - Only relevant actions shown
   - No cross-document pollution
   - Proper module filtering

## Status

✅ **Invalidation Bus:** Created and wired into all mutation points
✅ **Mutation Bumps:** Added to create/update/close/delete operations
✅ **Workspace Subscription:** Outstanding actions refetch on version change
✅ **Module Footer Subscription:** Action list refetches on version change
✅ **Action Register Subscription:** Org-level view refetches on version change
✅ **FRA4 Merge Fix:** Data preserved across saves
✅ **PDF Section 13 Fix:** Uses filtered actionsWithRefs
✅ **Build:** Successful (no TypeScript errors)

## Implementation Date

February 25, 2026

---

**Scope:** Actions consistency, data merge safety, PDF action filtering
**Impact:** Real-time action list synchronization across all views
**Risk:** Low (additive changes, backward compatible)
**Benefit:** Eliminates stale data, prevents overwrites, ensures PDF consistency
