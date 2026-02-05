# RE-02 Comprehensive Save Fix - Complete

**Date**: 2026-02-05
**Status**: ✅ Complete
**Build**: ✅ Passing

## Problem Statement

RE-02 Construction form had persistent data integrity issues:
1. **Ghost Buildings**: Deleted buildings reappeared after first save (required 2 saves to persist)
2. **Value Reversion**: Building properties reverted to old values after save
3. **Mixed Data Sources**: Form rendered from multiple sources (`rawBuildings`, `safeBuildings`, `formData`) causing inconsistency
4. **Re-hydration Bug**: After save, form re-hydrated from normalized data, losing changes
5. **Basement Values**: No validation/clamping for basement values (should be ≤ 0)

## Root Cause Analysis

### 1. State/Ref Desynchronization
```typescript
// OLD (BROKEN):
setFormData(newData);  // State updates async
// ... useEffect runs later
formDataRef.current = formData;  // Ref lags behind by one tick

handleSave() {
  const data = formDataRef.current;  // ❌ Uses stale data
}
```

### 2. Re-hydration After Save
```typescript
// OLD (BROKEN):
const { data: saved } = await supabase.update(...);
setFormData(buildingToFormState(saved));  // ❌ Re-hydrates from DB, loses in-memory changes
```

### 3. Mixed Data Sources
- Initial render: from `safeBuildings` (derived from `moduleInstance.data`)
- During edits: from `formData.buildings`
- After save: from normalized DB response
- Result: Constant round-tripping through transformation pipeline

## Solution Implemented

### 1. Single Source of Truth

**Principle**: `formData.buildings` is the ONLY canonical source after initial load.

```typescript
// ═══════════════════════════════════════════════════════════════════
// SINGLE SOURCE OF TRUTH: formData.buildings is canonical after load
// ═══════════════════════════════════════════════════════════════════
```

### 2. Synchronized State Updates

Created `applyFormUpdate()` helper that updates both state AND ref simultaneously:

```typescript
const applyFormUpdate = (updater) => {
  setFormData((prev) => {
    const next = updater(prev);
    formDataRef.current = next;  // ✓ Sync immediately, don't wait for useEffect
    return next;
  });
};
```

### 3. Immutable Building Updates

Created `updateBuilding()` helper that enforces immutable patterns:

```typescript
// NEW (CORRECT):
const updateBuilding = (buildingId, updater) => {
  applyFormUpdate((prev) => ({
    ...prev,
    buildings: prev.buildings.map((b) => {
      if (b.id !== buildingId) return b;

      const updated = updater(b);  // ✓ Immutable update function
      updated.validationWarnings = validateBuilding(updated);

      const normalized = normalizeConstructionForSave({ buildings: [updated], site_notes: '' }).buildings[0];
      const calculated = calculateConstructionMetrics(normalized);

      return { ...updated, calculated };
    }),
  }));
};
```

### 4. All Edits Use New Pattern

**Before (BROKEN)**:
```typescript
onChange={(e) => updateBuilding(bldg.id, { building_name: e.target.value })}
```

**After (CORRECT)**:
```typescript
onChange={(e) => updateBuilding(bldg.id, (b) => ({ ...b, building_name: e.target.value }))}
```

### 5. No Re-hydration After Save

```typescript
const { data: saved } = await supabase.update(...);

// ✅ DO NOT re-hydrate from saved data - formData is already correct
console.log('[RE02] 🎯 Keeping formData as-is (no re-hydration)');

onSaved();
```

### 6. Basement Value Clamping

```typescript
<input
  type="text"
  value={bldg.geometry.basements}
  onChange={(e) => {
    const numValue = parseNumericInput(e.target.value);
    // Clamp basements to max 0 (must be negative or zero)
    const clampedValue = numValue !== null ? Math.min(0, numValue).toString() : e.target.value;
    updateBuilding(bldg.id, (b) => ({ ...b, geometry: { ...b.geometry, basements: clampedValue } }));
  }}
  max={0}
  title="Basements (0 or negative)"
/>
```

## Changes Made

### Core Infrastructure (`src/components/modules/forms/RE02ConstructionForm.tsx`)

1. **Line 585-591**: Created `applyFormUpdate()` helper
   - Synchronizes both state and ref immediately
   - Prevents lag between state updates and save operations

2. **Line 594-610**: Created `updateBuilding()` helper
   - Takes buildingId and updater function (immutable pattern)
   - Automatically recalculates metrics and validation
   - Ensures all updates go through single code path

3. **Line 617-626**: Updated `addBuilding()`
   - Uses `applyFormUpdate()` instead of `setFormData()`
   - Adds debug logging

4. **Line 628-638**: Updated `removeBuilding()`
   - Uses `applyFormUpdate()` instead of `setFormData()`
   - Adds debug logging

5. **Line 740-743**: Removed re-hydration after save
   - Keeps `formData` as-is after successful save
   - Prevents round-trip through transformation pipeline

6. **Line 784-794**: Updated `updateBreakdownData()`
   - Converted to use immutable updater pattern
   - Cleaner logic flow

7. **Line 1131**: Updated site notes textarea
   - Uses `applyFormUpdate()` for consistency

### All Building Field Updates

Converted **ALL** `updateBuilding()` calls from object merge pattern to immutable updater pattern:

- **Line 890**: Building name input
- **Line 902-905**: Roof area input
- **Line 936-942**: Mezzanine area input
- **Line 962**: Floors input
- **Line 970-975**: Basements input (with clamping)
- **Line 984**: Height input
- **Line 997-1000**: Combustible cladding checkbox
- **Line 1010**: Compartmentation select
- **Line 1023**: Frame type select
- **Line 1272-1275**: Combustible cladding details textarea
- **Line 1288**: Building notes textarea

## Debug Console Output

When operations occur, you'll see:

```
[RE02] Building added, ref updated synchronously
[RE02] Building removed, ref updated synchronously
[RE02] save click { isSaving: false }
[RE02] Buildings in ref at save: 2
🏗️ RE-02 TRACE: Save Starting
📊 State buildings count: 2
📊 Normalized buildings count: 2
📊 Payload buildings count: 2
[RE02] ✅ Saved successfully
[RE02] 🎯 Keeping formData as-is (no re-hydration)
```

## Acceptance Criteria

### ✅ All Met

1. **Delete building → Save once** → Building stays deleted permanently
   - No ghost buildings after single save
   - Ref synchronized immediately on delete

2. **Add building → Save once** → Building persists correctly
   - New buildings appear after single save
   - No data loss or reversion

3. **Edit any field → Save once** → Changes persist correctly
   - Building names persist
   - Numeric fields persist
   - Checkboxes persist
   - Dropdowns persist
   - Textareas persist

4. **Basement values** → Clamped to ≤ 0
   - Input has `max={0}` attribute
   - Value clamped with `Math.min(0, value)`

5. **No value reversion** → formData never reverts
   - Single source of truth maintained
   - No re-hydration after save
   - All edits use immutable patterns

## Testing Checklist

- [x] Delete a building → Save → Refresh → Building stays deleted
- [x] Add a building → Save → Refresh → Building persists
- [x] Rename a building → Save → Refresh → Name persists
- [x] Edit roof area → Save → Refresh → Value persists
- [x] Edit mezzanine area → Save → Refresh → Value persists
- [x] Edit floors/basements/height → Save → Refresh → Values persist
- [x] Toggle combustible cladding → Save → Refresh → Checkbox persists
- [x] Change compartmentation → Save → Refresh → Selection persists
- [x] Change frame type → Save → Refresh → Selection persists
- [x] Edit building notes → Save → Refresh → Notes persist
- [x] Edit site notes → Save → Refresh → Notes persist
- [x] Add material breakdown → Save → Refresh → Breakdown persists
- [x] Enter positive basement value → Gets clamped to 0

## Technical Notes

### Why This Works

1. **Immediate Ref Sync**: `formDataRef.current` updates in same tick as state
2. **Single Source**: No mixing of `rawBuildings`, `safeBuildings`, `formData`
3. **No Re-hydration**: After save, formData unchanged (already correct)
4. **Immutable Updates**: All edits create new objects, no in-place mutation
5. **Single Code Path**: All updates go through `updateBuilding()` helper

### Performance

- No performance impact
- Still uses React's batching for re-renders
- Ref update is instant (no async delay)

### Future Improvements

If needed:
- Add optimistic updates with rollback on error
- Add debounced auto-save
- Add conflict resolution for concurrent edits

## Build Status

✅ Build passing:
```
✓ 1899 modules transformed
✓ built in 16.58s
```

No TypeScript errors, all type-safe.

## Related Files

- `src/components/modules/forms/RE02ConstructionForm.tsx` - Main form component (all changes)

## Migration Notes

No database migrations required. This is purely a client-side fix for form state management.
