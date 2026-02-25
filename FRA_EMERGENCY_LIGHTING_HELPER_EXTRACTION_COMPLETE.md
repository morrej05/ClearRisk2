# Emergency Lighting Helper Extraction COMPLETE

## Overview

Completed final code hygiene refactor to move emergency lighting key reads from `buildFraPdf.ts` into a dedicated Section 7 helper function.

**Objective:** Zero `emergency_lighting_*` references in buildFraPdf.ts
**Result:** Helper function in Section 7 tooling provides single access point
**Behavior:** Identical - same boolean logic, same SCS/reliance calculations

## Changes Made

### 1. Added Helper Function in Section 7 Tooling

**File:** `src/lib/pdf/sectionSummaryGenerator.ts:945-953`

**Added:**
```typescript
/**
 * Helper: Derive emergency lighting system presence from Section 7 owner module
 *
 * Single source of truth for emergency lighting presence used in SCS/reliance calculations.
 * Queries FRA_3_ACTIVE_SYSTEMS (current) or FRA_3_PROTECTION_ASIS (deprecated) module.
 *
 * @param moduleInstances - Array of module instances to search
 * @returns true if emergency lighting system is present, false otherwise
 */
export function getHasEmergencyLightingSystemFromActiveSystems(moduleInstances: any[]): boolean {
  const active = moduleInstances.find(m =>
    m.module_key === 'FRA_3_ACTIVE_SYSTEMS' || m.module_key === 'FRA_3_PROTECTION_ASIS'
  );
  return (
    active?.data?.emergency_lighting_present === true ||
    String(active?.data?.emergency_lighting_present || '').toLowerCase() === 'yes'
  );
}
```

**Design Decision:**
- Placed in `sectionSummaryGenerator.ts` (Section 7 summary tooling file)
- Acceptable location since it generates Section 7 summaries
- Helper is part of Section 7 architectural domain
- Only place outside renderers where EL keys are directly accessed

### 2. Imported Helper in buildFraPdf.ts

**File:** `src/lib/pdf/buildFraPdf.ts:16`

**Before:**
```typescript
import { generateSectionSummary, generateAssessorSummary } from './sectionSummaryGenerator';
```

**After:**
```typescript
import { generateSectionSummary, generateAssessorSummary, getHasEmergencyLightingSystemFromActiveSystems } from './sectionSummaryGenerator';
```

### 3. Replaced Derivation Block with Helper Call

**File:** `src/lib/pdf/buildFraPdf.ts:1546-1548`

**Before:**
```typescript
// Derive emergency lighting presence from Section 7 owner module (FRA_3_ACTIVE_SYSTEMS)
// Single source of truth for EL system existence across all SCS/reliance calculations
const activeSystemsModule = moduleInstances.find(
  (m) => m.module_key === 'FRA_3_ACTIVE_SYSTEMS' || m.module_key === 'FRA_3_PROTECTION_ASIS'
);
const hasEmergencyLightingSystem =
  activeSystemsModule?.data?.emergency_lighting_present === true ||
  String(activeSystemsModule?.data?.emergency_lighting_present || '').toLowerCase() === 'yes';
```

**After:**
```typescript
// Derive emergency lighting presence from Section 7 owner module (via helper)
// Single source of truth for EL system existence across all SCS/reliance calculations
const hasEmergencyLightingSystem = getHasEmergencyLightingSystemFromActiveSystems(moduleInstances);
```

**Impact:**
- Removed 7 lines of inline derivation code
- Replaced with 1-line helper call
- Zero direct field access in buildFraPdf.ts
- Identical boolean logic and behavior

## Verification Results

### ✅ Test 1: Zero emergency_lighting_ in buildFraPdf.ts

**Command:** `rg -n "emergency_lighting_" src/lib/pdf/buildFraPdf.ts`

**Result:**
```
(no matches)
```

**Status:** PASSED ✅
- Absolute zero references to emergency_lighting_ fields
- Complete elimination from buildFraPdf.ts
- "Section 7 only" rule enforced at buildFraPdf level

### ✅ Test 2: All EL references Section 7 scoped

**Command:** `rg -n "emergency_lighting_" src/lib/pdf -S`

**Results:**
1. **fraCoreDraw.ts lines 333-335** - Inside `if (sectionId === 7)` block ✅
2. **fraConstants.ts line 12** - Section 7 critical fields array ✅
3. **keyPoints/rules.ts lines 291-336** - Inside `section7Rules` array ✅
4. **sectionSummaryGenerator.ts lines 298-732** - Section 7 summary functions ✅
5. **sectionSummaryGenerator.ts lines 950-951** - Helper function (Section 7 tooling) ✅

**Status:** PASSED ✅
- All references correctly scoped to Section 7 domain
- Helper function in Section 7 tooling file
- No leakage to non-Section 7 contexts
- buildFraPdf.ts completely clean

### ✅ Test 3: TypeScript Compilation

**Command:** `npm run build`

**Result:**
```
✓ built in 22.28s
No TypeScript errors
```

**Status:** PASSED ✅

## Architecture Benefits

### Before: Direct Field Access

**buildFraPdf.ts (Previous):**
```typescript
// Direct field reads in buildFraPdf.ts
const activeSystemsModule = moduleInstances.find(
  (m) => m.module_key === 'FRA_3_ACTIVE_SYSTEMS' || m.module_key === 'FRA_3_PROTECTION_ASIS'
);
const hasEmergencyLightingSystem =
  activeSystemsModule?.data?.emergency_lighting_present === true ||
  String(activeSystemsModule?.data?.emergency_lighting_present || '').toLowerCase() === 'yes';
```

**Problems:**
- buildFraPdf.ts directly accessed Section 7 field names
- Mixed architectural concerns
- Harder to maintain and audit
- Violated "Section 7 only" principle

### After: Helper Function

**buildFraPdf.ts (Current):**
```typescript
// Clean helper call - no direct field access
const hasEmergencyLightingSystem = getHasEmergencyLightingSystemFromActiveSystems(moduleInstances);
```

**sectionSummaryGenerator.ts:**
```typescript
// Single location for EL field access (Section 7 tooling)
export function getHasEmergencyLightingSystemFromActiveSystems(moduleInstances: any[]): boolean {
  const active = moduleInstances.find(m =>
    m.module_key === 'FRA_3_ACTIVE_SYSTEMS' || m.module_key === 'FRA_3_PROTECTION_ASIS'
  );
  return (
    active?.data?.emergency_lighting_present === true ||
    String(active?.data?.emergency_lighting_present || '').toLowerCase() === 'yes'
  );
}
```

**Benefits:**
1. **Clear Separation** - buildFraPdf.ts never touches EL field names
2. **Section 7 Ownership** - Helper in Section 7 tooling file
3. **Single Source** - One function for EL presence derivation
4. **Easy to Audit** - Grep for emergency_lighting_ won't find buildFraPdf.ts
5. **Maintainable** - Change EL logic in one place (helper function)

## Code Organization

### Emergency Lighting References by Location

**Section 7 Renderers (Direct Access OK):**
- `fraCoreDraw.ts` - Renders Section 7 key details
- `fraConstants.ts` - Section 7 critical fields
- `keyPoints/rules.ts` - Section 7 key point rules

**Section 7 Tooling (Helper Access):**
- `sectionSummaryGenerator.ts` - Section 7 summary generation + helper function

**PDF Generation (Helper Only):**
- `buildFraPdf.ts` - Calls helper, zero direct field access ✅

**Result:** Complete architectural layering with clear boundaries

## Comparison: v1 vs v2

### Version 1 (Previous Refactor)

**buildFraPdf.ts:**
```typescript
const activeSystemsModule = moduleInstances.find(...);
const hasEmergencyLightingSystem = 
  activeSystemsModule?.data?.emergency_lighting_present === true || ...;
```

**Issues:**
- Still had direct `emergency_lighting_present` references
- Scan for emergency_lighting_ would find buildFraPdf.ts
- Field names visible in PDF generation code

### Version 2 (Current)

**buildFraPdf.ts:**
```typescript
const hasEmergencyLightingSystem = getHasEmergencyLightingSystemFromActiveSystems(moduleInstances);
```

**Benefits:**
- Zero emergency_lighting_ references
- Scan for emergency_lighting_ skips buildFraPdf.ts ✅
- Field names hidden behind helper interface
- Complete Section 7 encapsulation

## Files Modified

### 1. src/lib/pdf/sectionSummaryGenerator.ts
- **Lines 945-953:** Added `getHasEmergencyLightingSystemFromActiveSystems` helper
- **Location:** End of file, after deprecated function
- **Scope:** Section 7 tooling domain

### 2. src/lib/pdf/buildFraPdf.ts
- **Line 16:** Added helper import
- **Lines 1546-1548:** Replaced 7-line derivation with 1-line helper call
- **Result:** Zero direct emergency_lighting_ field access

## Testing Checklist

- [x] Zero emergency_lighting_ in buildFraPdf.ts
- [x] All other references Section 7 scoped
- [x] Helper function in Section 7 tooling file
- [x] TypeScript compiles cleanly
- [x] Behavior identical to previous version
- [x] SCS calculations unchanged
- [x] Fire protection reliance unchanged

## Benefits Summary

### 1. Architectural Clarity
- buildFraPdf.ts completely decoupled from EL field names
- Section 7 tooling provides controlled access
- Clear domain boundaries

### 2. Code Hygiene
- Single helper function for EL presence
- No scattered field reads
- Easy to locate and maintain

### 3. Auditability
- Grep for emergency_lighting_ in PDF generation = 0 matches
- "Section 7 only" rule enforced
- Helper function explicitly documented

### 4. Maintainability
- Change EL presence logic in one place
- Update helper function, not multiple callers
- Clear dependency on Section 7 owner module

## Implementation History

**Phase 1 (Initial):** UI forms cleaned up (3 files)
**Phase 2 (PDF Rendering):** Section 7 ownership enforced (3 files)
**Phase 3 (Refactor v1):** Derived from owner module in buildFraPdf (1 file)
**Phase 4 (Refactor v2):** ✅ Extracted to helper function (2 files)

**Total Journey:**
- Started: Emergency lighting scattered across multiple concerns
- Ended: Single Section 7 ownership with helper interface
- Result: Clean architecture, zero buildFraPdf.ts references

---

**Date:** February 25, 2026
**Scope:** Final code hygiene refactor (Phase 4 of 4)
**Risk:** None (behavior unchanged, pure refactor)
**Benefit:** Complete Section 7 encapsulation, zero buildFraPdf field access
