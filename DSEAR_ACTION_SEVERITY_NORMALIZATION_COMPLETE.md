# DSEAR Action Severity/Priority Normalization - COMPLETE

## Overview

Fixed DSEAR action severity and priority computation by normalizing module keys to handle aliases and legacy naming conventions, ensuring the criticality engine can properly detect triggers. Also fixed DocumentOverview to pass real module data instead of empty objects, and added carried-forward action clarity in UI.

## Problem Statement

### Issue 1: Module Key Mismatches
- DSEAR modules had multiple naming variations (aliases, legacy names)
- Engine looked for canonical keys like `DSEAR_3_HAC` but might receive `DSEAR_3_HAZARDOUS_AREA_CLASSIFICATION`
- Triggers failed to fire because modules weren't found
- Action severity/priority computed incorrectly or defaulted to low

### Issue 2: Empty Data in Overview
- `DocumentOverview.tsx` passed `data: {}` into `computeExplosionSummary`
- Summary labels showed flags but had no data to analyze
- Meaningless summary results

### Issue 3: Carried-Forward Actions Unclear
- Users couldn't distinguish carried-forward actions from new actions
- No visual indicator for actions with `carried_from_document_id` or `origin_action_id`

## Solution

### PART 1: Module Key Normalization

**File:** `src/lib/dsear/criticalityEngine.ts`

#### Added Normalization Functions

```typescript
/**
 * Normalize DSEAR module keys to canonical forms.
 * Handles various aliases and legacy naming conventions.
 */
function normalizeDsearModuleKey(key: string): string {
  const k = String(key || '').trim();

  const map: Record<string, string> = {
    // Substances
    'DSEAR_1_DANGEROUS_SUBSTANCES': 'DSEAR_1_SUBSTANCES',
    'DSEAR_1_SUBSTANCES_REGISTER': 'DSEAR_1_SUBSTANCES',

    // HAC / zoning
    'DSEAR_3_HAZARDOUS_AREA_CLASSIFICATION': 'DSEAR_3_HAC',
    'DSEAR_3_HAC_ZONING': 'DSEAR_3_HAC',

    // Mitigation / explosion protection
    'DSEAR_5_MITIGATION': 'DSEAR_5_EXPLOSION_PROTECTION',

    // Risk table
    'DSEAR_6_RISK_TABLE': 'DSEAR_6_RISK_ASSESSMENT',

    // Hierarchy of control
    'DSEAR_10_HIERARCHY_OF_CONTROL': 'DSEAR_10_HIERARCHY_CONTROL',
    'DSEAR_10_HIERARCHY_SUBSTITUTION': 'DSEAR_10_HIERARCHY_CONTROL',
  };

  return map[k] || k;
}

/**
 * Normalize an array of module instances to use canonical module keys.
 */
function normalizeDsearModules(modules: ModuleInstance[]): ModuleInstance[] {
  return modules.map(m => ({
    ...m,
    module_key: normalizeDsearModuleKey(m.module_key)
  }));
}
```

**Key Mappings:**
- `DSEAR_1_DANGEROUS_SUBSTANCES` → `DSEAR_1_SUBSTANCES`
- `DSEAR_1_SUBSTANCES_REGISTER` → `DSEAR_1_SUBSTANCES`
- `DSEAR_3_HAZARDOUS_AREA_CLASSIFICATION` → `DSEAR_3_HAC`
- `DSEAR_3_HAC_ZONING` → `DSEAR_3_HAC`
- `DSEAR_5_MITIGATION` → `DSEAR_5_EXPLOSION_PROTECTION`
- `DSEAR_6_RISK_TABLE` → `DSEAR_6_RISK_ASSESSMENT`
- `DSEAR_10_HIERARCHY_OF_CONTROL` → `DSEAR_10_HIERARCHY_CONTROL`
- `DSEAR_10_HIERARCHY_SUBSTITUTION` → `DSEAR_10_HIERARCHY_CONTROL`

#### Updated `computeExplosionSummary`

**Before:**
```typescript
export function computeExplosionSummary(context: {
  modules: ModuleInstance[];
}): ExplosionSummary {
  const { modules } = context;
  const flags: ExplosionFlag[] = [];

  const dsear1 = modules.find((m) => m.module_key === 'DSEAR_1_SUBSTANCES');
  const dsear2 = modules.find((m) => m.module_key === 'DSEAR_2_PROCESS_RELEASES');
  // ...
```

**After:**
```typescript
export function computeExplosionSummary(context: {
  modules: ModuleInstance[];
}): ExplosionSummary {
  // Normalize module keys to handle aliases and legacy naming
  const normalized = normalizeDsearModules(context.modules);
  const flags: ExplosionFlag[] = [];

  const dsear1 = normalized.find((m) => m.module_key === 'DSEAR_1_SUBSTANCES');
  const dsear2 = normalized.find((m) => m.module_key === 'DSEAR_2_PROCESS_RELEASES');
  // ...
```

**Changes:**
- Call `normalizeDsearModules()` at the start
- Use `normalized` array for all lookups
- Pass `normalized` to helper functions

#### Updated `deriveExplosionSeverity`

**Before:**
```typescript
export function deriveExplosionSeverity(context: {
  modules: ModuleInstance[];
}): ExplosionSeverityResult {
  const { modules } = context;
  const flags: ExplosionFlag[] = [];
  // ...
```

**After:**
```typescript
export function deriveExplosionSeverity(context: {
  modules: ModuleInstance[];
}): ExplosionSeverityResult {
  // Normalize module keys to handle aliases and legacy naming
  const normalized = normalizeDsearModules(context.modules);
  const flags: ExplosionFlag[] = [];
  // ...
```

**Impact:**
- Triggers now fire correctly regardless of module key variation
- Severity/priority computed accurately
- No changes to trigger logic or mappings (critical→P1, high→P2, moderate→P3, low→P4)

### PART 2: Fix DocumentOverview DSEAR Summary

**File:** `src/pages/documents/DocumentOverview.tsx`

**Before (Line 167-174):**
```typescript
if (isDsearDocument) {
  try {
    const modulesForEngine = modules.map(m => ({
      module_key: m.module_key,
      outcome: m.outcome,
      assessor_notes: '',
      data: {},  // ❌ Empty data!
    }));

    const summary = computeExplosionSummary({ modules: modulesForEngine });
```

**After:**
```typescript
if (isDsearDocument) {
  try {
    const modulesForEngine = modules.map(m => ({
      module_key: m.module_key,
      outcome: m.outcome,
      assessor_notes: m.assessor_notes || '',
      data: m.data || {},  // ✅ Real data!
    }));

    const summary = computeExplosionSummary({ modules: modulesForEngine });
```

**Changes:**
- Pass `m.data` instead of empty object
- Pass `m.assessor_notes` instead of empty string
- Engine now sees actual saved module data
- Summary reflects real conditions

**Example:**
```typescript
// Before: Engine sees this
{
  module_key: 'DSEAR_3_HAC',
  outcome: 'material_def',
  data: {}  // No zones, no drawings_reference
}

// After: Engine sees this
{
  module_key: 'DSEAR_3_HAC',
  outcome: 'material_def',
  data: {
    zones: [{ zone_type: '1', location: 'Tank farm' }],
    drawings_reference: ''  // Actual empty value
  }
}
```

**Result:**
- Trigger `EX-CR-01` (zones without drawings) now fires correctly
- Summary shows meaningful flags based on real data

### PART 3: Carried-Forward Action Clarity

Added visual "Carried forward" badges to action lists.

#### Action Register Page

**File:** `src/pages/dashboard/ActionRegisterPage.tsx` (Lines 431-435)

**Added:**
```typescript
{(action.carried_from_document_id || action.origin_action_id) && (
  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
    Carried forward
  </span>
)}
```

**Placement:** Next to issue status badge in document title row

#### Module Actions Panel

**File:** `src/components/modules/ModuleActions.tsx` (Lines 423-427)

**Added:**
```typescript
{(action.carried_from_document_id || action.origin_action_id) && (
  <span className="inline-flex px-1.5 py-0.5 mt-1 text-xs font-medium rounded bg-purple-100 text-purple-700">
    Carried forward
  </span>
)}
```

**Placement:** Below action text in action column

**Visual Design:**
- Purple badge: `bg-purple-100 text-purple-700`
- Clear label: "Carried forward"
- Appears only when action has carry-forward metadata
- Consistent styling across both locations

## Technical Details

### Normalization Strategy

**Design Principles:**
1. **One-way mapping:** Aliases → Canonical
2. **Additive:** Returns original key if no mapping exists
3. **Defensive:** Handles null/undefined/empty strings
4. **Transparent:** No side effects on original data

**Performance:**
- O(n) mapping for n modules
- Simple object lookup per key
- No database queries
- Minimal memory overhead

**Extensibility:**
- Easy to add new aliases to map
- No changes to trigger logic required
- Works for all DSEAR functions using modules

### Data Flow

**Before Normalization:**
```
User Input → Database → modules (various keys) → Engine → ❌ Module not found → Default to low
```

**After Normalization:**
```
User Input → Database → modules (various keys) → normalizeDsearModules() → canonical keys → Engine → ✅ Triggers fire → Correct severity/priority
```

### Carried-Forward Detection

**Logic:**
```typescript
action.carried_from_document_id || action.origin_action_id
```

**Cases:**
- `carried_from_document_id`: Action copied from previous version
- `origin_action_id`: Action derived from another action
- Both null: New action, no badge shown

## No Schema Changes

**Confirmed:**
- No database migrations required
- No new columns added
- No RLS policy changes
- Purely application-layer fixes

## No FRA Impact

**Verified:**
- FRA uses separate severity engine (`src/lib/modules/fra/severityEngine.ts`)
- FRA modules not affected by DSEAR normalization
- Different trigger systems
- No shared code paths

## Testing Validation

### Test 1: Module Key Normalization
**Input:** Action created in `DSEAR_3_HAZARDOUS_AREA_CLASSIFICATION` module
**Expected:** Engine normalizes to `DSEAR_3_HAC` and finds module
**Verification:** Triggers fire correctly, severity computed accurately

### Test 2: Trigger Firing
**Scenario:** Zone 1 present, ATEX required='unknown'
**Expected:** Trigger `EX-CR-02` fires (critical level)
**Result:** Action gets `priority_band = 'P1'`

### Test 3: DocumentOverview Summary
**Input:** DSEAR document with saved zone data
**Expected:** Summary shows flags based on real data
**Verification:** Flags reflect actual conditions, not empty defaults

### Test 4: Carried-Forward Badge
**Input:** Action with `origin_action_id` set
**Expected:** Purple "Carried forward" badge appears
**Location:** Both action register and module actions panel

### Test 5: FRA Unaffected
**Input:** Create FRA action in fire hazards module
**Expected:** FRA severity engine works unchanged
**Verification:** No DSEAR normalization applied to FRA

## Files Modified

### src/lib/dsear/criticalityEngine.ts
**Lines 33-71:** Added `normalizeDsearModuleKey()` and `normalizeDsearModules()`
**Lines 76-90:** Updated `computeExplosionSummary()` to use normalized modules
**Lines 426-439:** Updated `deriveExplosionSeverity()` to use normalized modules

### src/pages/documents/DocumentOverview.tsx
**Lines 169-174:** Fixed to pass real `data` and `assessor_notes` to `computeExplosionSummary()`

### src/pages/dashboard/ActionRegisterPage.tsx
**Lines 431-435:** Added "Carried forward" badge in action register table

### src/components/modules/ModuleActions.tsx
**Lines 423-427:** Added "Carried forward" badge in module actions table

## Benefits

### 1. Correctness
- Triggers fire reliably regardless of module key variation
- Severity/priority accurately reflects actual conditions
- Summary shows meaningful data-driven flags

### 2. Consistency
- Single normalization function for all DSEAR operations
- Canonical keys used throughout engine
- AddActionModal and overview use same logic

### 3. Maintainability
- Easy to add new aliases without changing trigger logic
- Clear separation: normalization → engine → output
- No duplicate trigger definitions needed

### 4. User Experience
- Actions get correct priority bands
- Carried-forward actions clearly marked
- No confusion about action origins

### 5. Backward Compatibility
- Handles legacy module keys automatically
- No migration required
- Works with existing data

## Edge Cases Handled

### Empty/Null Module Keys
```typescript
normalizeDsearModuleKey(null)      // → ''
normalizeDsearModuleKey(undefined) // → ''
normalizeDsearModuleKey('')        // → ''
```

### Unknown Module Keys
```typescript
normalizeDsearModuleKey('CUSTOM_MODULE') // → 'CUSTOM_MODULE' (passthrough)
```

### Empty Module Data
```typescript
data: m.data || {}  // Fallback to empty object if null/undefined
```

### No Carried-Forward Metadata
```typescript
{(action.carried_from_document_id || action.origin_action_id) && (
  // Badge only shown if at least one field is truthy
)}
```

## Verification Points

✅ **Module Key Normalization:**
- All alias variations map to canonical keys
- Engine finds modules correctly
- Triggers fire as expected

✅ **Data Integrity:**
- Real module data passed to summary
- No empty objects fabricated
- Flags reflect actual conditions

✅ **UI Clarity:**
- Carried-forward badge visible in both locations
- Purple color distinguishes from status badges
- Only shown when metadata present

✅ **No Regressions:**
- FRA severity engine unaffected
- No schema changes required
- Build successful

✅ **Trigger Mappings Preserved:**
- critical → P1
- high → P2
- moderate → P3
- low → P4

## Implementation Date

February 25, 2026

---

**Scope:** DSEAR action severity/priority normalization + overview data fix + UI clarity
**Impact:** Accurate action prioritization, meaningful summaries, clear action origins
**Risk:** Minimal (application layer only, no schema changes)
**Benefit:** Correct severity computation, better user experience
