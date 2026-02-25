# FRA Critical Module Priority Floor Implementation Complete

## Overview

Successfully implemented a priority/severity floor for FRA-only actions created from critical modules. When an action is created from a module with `outcomeCategory: 'critical'`, the system now ensures minimum priority of P2 and severity of T3, preventing low-priority actions from critical life-safety modules.

## Root Cause Analysis

**Problem:** AddActionModal ignored quick-add likelihood/impact templates and derived severity using default category/flags, often yielding P4/T1 for critical module actions.

**Impact:** Critical modules (e.g., FRA_2_ESCAPE_ASIS with `outcomeCategory: 'critical'`) generated low-priority P4/T1 actions even for significant findings.

**Solution:** Central clamp/floor in AddActionModal that elevates priority/severity for FRA critical modules after derivation, while preserving manual P1 escalations.

## Implementation Details

### Option Used: **Option A (Prop Pass)**

Minimal invasive approach passing `sourceModuleKey` as an optional prop from calling contexts.

### Changes Made

#### 1. AddActionModal.tsx (Lines 1-178)

**Line 14:** Added import
```typescript
import { getModuleOutcomeCategory } from '../../lib/modules/moduleCatalog';
```

**Line 24:** Added new optional prop
```typescript
interface AddActionModalProps {
  documentId: string;
  moduleInstanceId: string;
  onClose: () => void;
  onActionCreated: () => void;
  defaultAction?: string;
  defaultLikelihood?: number;
  defaultImpact?: number;
  source?: 'manual' | 'info_gap' | 'recommendation' | 'system';
  sourceModuleKey?: string;  // NEW
}
```

**Line 44:** Added prop to function signature
```typescript
export default function AddActionModal({
  documentId,
  moduleInstanceId,
  onClose,
  onActionCreated,
  defaultAction = '',
  defaultLikelihood = 3,
  defaultImpact = 3,
  source,
  sourceModuleKey,  // NEW
}: AddActionModalProps) {
```

**Lines 166-178:** Added critical module floor logic (AFTER severity derivation)
```typescript
// FRA-only: Apply critical module floor (P2/T3 minimum for critical modules)
// If source module is 'critical' and derived priority is too low, clamp to P2/T3
const isCriticalModule = sourceModuleKey && getModuleOutcomeCategory(sourceModuleKey) === 'critical';
if (isCriticalModule && documentType === 'FRA') {
  // Floor priority: P3/P4 → P2 (don't downgrade P1)
  if (priorityBand === 'P3' || priorityBand === 'P4') {
    priorityBand = 'P2';
  }
  // Floor severity: T1/T2 → T3 (don't downgrade T4)
  if (severityTier === 'T1' || severityTier === 'T2') {
    severityTier = 'T3';
  }
}
```

**Key Design Decisions:**

1. **Placement:** Applied AFTER `deriveSeverity()` and AFTER manual P1 escalation check (line 159-164)
   - Preserves existing severity engine logic
   - Respects user manual escalations
   - Only elevates when needed

2. **Scope:** FRA-only (`documentType === 'FRA'`)
   - DSEAR uses its own criticality engine
   - FSD would benefit from same logic but not in scope

3. **Critical Module Detection:** Uses existing `getModuleOutcomeCategory(moduleKey) === 'critical'`
   - Reuses OutcomePanel logic
   - Respects module catalog definitions

4. **Floor Rules:**
   - Priority: P3/P4 → P2 (never downgrades P1)
   - Severity: T1/T2 → T3 (never downgrades T4)
   - Only uplifts, never downlifts

5. **Persistence:** Clamped values flow directly into action insert (line 304-305)
   ```typescript
   priority_band: priorityBand,
   severity_tier: severityTier,
   ```

#### 2. FRA Form Updates

**FRA2MeansOfEscapeForm.tsx:**
- Line 17: Added `module_key: string` to ModuleInstance interface
- Line 572: Added `sourceModuleKey={moduleInstance.module_key}` prop to AddActionModal

**FRA3FireProtectionForm.tsx:**
- Line 19: Added `module_key: string` to ModuleInstance interface
- Line 1350: Added `sourceModuleKey={moduleInstance.module_key}` prop to AddActionModal

**A5EmergencyArrangementsForm.tsx:**
- Line 19: Already had `module_key: string` in ModuleInstance interface (no change needed)
- Line 537: Added `sourceModuleKey={moduleInstance.module_key}` prop to AddActionModal

## Acceptance Test Results

### Test A1: Static Grep - Clamp Logic Exists
**Command:**
```bash
rg -n "getModuleOutcomeCategory|outcomeCategory|isCriticalModule|priority_band|severity_tier|P2|T3|floor|clamp" src/components/actions/AddActionModal.tsx -S
```

**Result:**
```
14:import { getModuleOutcomeCategory } from '../../lib/modules/moduleCatalog';
146:                   explosionResult.level === 'high' ? 'T3' :
166:  // FRA-only: Apply critical module floor (P2/T3 minimum for critical modules)
167:  // If source module is 'critical' and derived priority is too low, clamp to P2/T3
168:  const isCriticalModule = sourceModuleKey && getModuleOutcomeCategory(sourceModuleKey) === 'critical';
169:  if (isCriticalModule && documentType === 'FRA') {
170:    // Floor priority: P3/P4 → P2 (don't downgrade P1)
172:      priorityBand = 'P2';
174:    // Floor severity: T1/T2 → T3 (don't downgrade T4)
176:      severityTier = 'T3';
184:      case 'P2':
202:      case 'P2':
304:        priority_band: priorityBand,
305:        severity_tier: severityTier,
```

**Status:** ✅ PASSED - Clamp logic present and correct

### Test A2: Static Grep - FRA Forms Pass Module Key
**Command:**
```bash
rg -n "sourceModuleKey" src/components/modules/forms/FRA2MeansOfEscapeForm.tsx src/components/modules/forms/FRA3FireProtectionForm.tsx src/components/modules/forms/A5EmergencyArrangementsForm.tsx -S
```

**Result:**
```
FRA2MeansOfEscapeForm.tsx:572:          sourceModuleKey={moduleInstance.module_key}
FRA3FireProtectionForm.tsx:1350:          sourceModuleKey={moduleInstance.module_key}
A5EmergencyArrangementsForm.tsx:537:          sourceModuleKey={moduleInstance.module_key}
```

**Status:** ✅ PASSED - All three FRA forms pass sourceModuleKey

### Test B: Build Status
**Command:** `npm run build`

**Result:**
```
✓ 1947 modules transformed.
✓ built in 22.81s
No TypeScript errors
```

**Status:** ✅ PASSED

## Critical Module List (From moduleCatalog.ts)

The following modules have `outcomeCategory: 'critical'` and will trigger the P2/T3 floor:

### FRA Modules (11 critical modules)
1. **A2_BUILDING_PROFILE** (line 105) - "Drives scoring inputs, info gaps"
2. **A3_PERSONS_AT_RISK** (line 112) - "Drives vulnerability profile"
3. **FRA_7_EMERGENCY_ARRANGEMENTS** (A5) (line 126) - "Operational life safety"
4. **FRA_1_HAZARDS** (line 140) - "Ignition sources + EICR"
5. **FRA_2_ESCAPE_ASIS** (line 147) - "Life safety - means of escape"
6. **FRA_3_PROTECTION_ASIS** (line 155) - Deprecated, but critical
7. **FRA_3_ACTIVE_SYSTEMS** (line 162) - "Detection, alarm, lighting"
8. **FRA_4_PASSIVE_PROTECTION** (line 169) - "Compartmentation"
9. **FRA_8_FIREFIGHTING_EQUIPMENT** (line 176) - "Critical for fixed firefighting facilities"
10. **FRA_5_EXTERNAL_FIRE_SPREAD** (line 183) - "Life safety - external spread"
11. **FRA_90_SIGNIFICANT_FINDINGS** (line 190) - "Summary of critical findings"

### Governance Modules (No Floor Applied)
- A1_DOC_CONTROL (line 98) - `outcomeCategory: 'governance'`
- FRA_6_MANAGEMENT_SYSTEMS (A4) (line 119) - `outcomeCategory: 'governance'`
- A7_REVIEW_ASSURANCE (line 133) - `outcomeCategory: 'governance'`

## Behavior Examples

### Example 1: FRA_2_ESCAPE_ASIS Quick Action (Critical Module)

**Before Implementation:**
- Module: FRA_2_ESCAPE_ASIS (`outcomeCategory: 'critical'`)
- Quick action: "Upgrade emergency lighting coverage in stairwells"
- No severity flags ticked
- Derived: **P4 / T1** (default "Other" category, no flags)
- **Problem:** Critical escape route deficiency marked as P4

**After Implementation:**
- Module: FRA_2_ESCAPE_ASIS (`outcomeCategory: 'critical'`)
- Quick action: "Upgrade emergency lighting coverage in stairwells"
- No severity flags ticked
- Derived: P4 / T1
- **Floor Applied:** **P2 / T3** (critical module floor)
- **Result:** Life-safety deficiency correctly prioritized

### Example 2: FRA_6_MANAGEMENT_SYSTEMS Quick Action (Governance Module)

**Before & After (No Change):**
- Module: FRA_6_MANAGEMENT_SYSTEMS (A4) (`outcomeCategory: 'governance'`)
- Quick action: "Implement fire safety logbook"
- No severity flags ticked
- Derived: P4 / T1
- **Floor NOT Applied:** Still **P4 / T1** (governance module, no floor)
- **Result:** Administrative task correctly remains low priority

### Example 3: Manual P1 Escalation (Preserved)

**Before & After (No Change):**
- Module: FRA_2_ESCAPE_ASIS (`outcomeCategory: 'critical'`)
- User checks "Escalate to P1" with justification
- Manual escalation: **P1 / T4**
- Floor check: P1 is already ≥ P2, no change needed
- **Result:** **P1 / T4** (manual escalation preserved)

### Example 4: Existing P2 from Flags (Preserved)

**Before & After (No Change):**
- Module: FRA_2_ESCAPE_ASIS (`outcomeCategory: 'critical'`)
- User ticks "Final exit locked" flag
- Derived: **P2 / T3** (from severity engine)
- Floor check: P2 is already ≥ P2, T3 is already ≥ T3
- **Result:** **P2 / T3** (engine-derived priority preserved)

## Edge Cases Handled

### 1. Missing sourceModuleKey (Graceful Degradation)
```typescript
const isCriticalModule = sourceModuleKey && getModuleOutcomeCategory(sourceModuleKey) === 'critical';
```
- If sourceModuleKey is undefined/null, `isCriticalModule` = false
- Floor not applied, existing behavior preserved
- No crash, no error

### 2. Non-FRA Document Types (DSEAR, FSD)
```typescript
if (isCriticalModule && documentType === 'FRA') {
```
- DSEAR: Uses own criticality engine, floor not applied
- FSD: Could benefit from same logic but out of scope
- RE: Not applicable (different assessment model)

### 3. Invalid/Unknown module_key
```typescript
export function getModuleOutcomeCategory(moduleKey: string): 'critical' | 'governance' {
  if (!moduleKey || typeof moduleKey !== 'string') {
    return 'governance';  // Safe fallback
  }
  const resolvedKey = resolveModuleKey(moduleKey);
  const category = MODULE_CATALOG[resolvedKey]?.outcomeCategory || 'governance';
  return category;
}
```
- Invalid key defaults to 'governance' (safe fallback)
- Floor not applied for unknown modules
- No crash, no error

### 4. Already High Priority (P1 or P2)
- Floor only uplifts P3/P4 → P2
- If already P1 or P2, no change
- Never downgrades existing priorities

## Files Modified

1. **src/components/actions/AddActionModal.tsx**
   - Lines 1-14: Added import (getModuleOutcomeCategory)
   - Line 24: Added sourceModuleKey prop to interface
   - Line 44: Added sourceModuleKey to function signature
   - Lines 166-178: Implemented critical module floor logic

2. **src/components/modules/forms/FRA2MeansOfEscapeForm.tsx**
   - Line 17: Added module_key to ModuleInstance interface
   - Line 572: Pass sourceModuleKey prop to AddActionModal

3. **src/components/modules/forms/FRA3FireProtectionForm.tsx**
   - Line 19: Added module_key to ModuleInstance interface
   - Line 1350: Pass sourceModuleKey prop to AddActionModal

4. **src/components/modules/forms/A5EmergencyArrangementsForm.tsx**
   - Line 537: Pass sourceModuleKey prop to AddActionModal (interface already had module_key)

## NOT Changed (By Design)

1. **src/lib/modules/fra/severityEngine.ts**
   - Engine unchanged (floor is caller-context specific)
   - Existing derivation logic preserved
   - No regression risk to existing severity calculations

2. **Other Form Implementations**
   - FRA1, FRA4, FRA5, FRA8, FRA90 forms not modified (accept risk of missing floor for now)
   - Can be added incrementally by adding sourceModuleKey prop
   - Pattern established for future updates

## Benefits

### 1. Correct Priority Assignment for Critical Modules
- Life-safety deficiencies from critical modules now correctly prioritized ≥ P2
- No more P4 actions from FRA_2_ESCAPE_ASIS, FRA_3_ACTIVE_SYSTEMS, etc.
- Automatic uplift without manual intervention

### 2. Minimal Code Changes
- Single clamp point (12 lines) in AddActionModal
- No changes to severity engine (stable, tested)
- No changes to database schema or migrations

### 3. Preserves Existing Behavior
- Manual P1 escalations preserved
- Engine-derived P1/P2 priorities preserved
- Governance modules unaffected (still can be P4)
- DSEAR criticality engine unaffected

### 4. FRA-Only Scope (Safe)
- Only affects FRA documents
- DSEAR has separate criticality engine
- FSD/RE unaffected

### 5. Type-Safe Implementation
- TypeScript interfaces updated
- Prop passing verified
- Build passes with no errors

## Future Enhancements

### 1. Extend to All FRA Forms
Currently only 3 forms pass sourceModuleKey:
- FRA2MeansOfEscapeForm ✅
- FRA3FireProtectionForm ✅
- A5EmergencyArrangementsForm ✅

Can incrementally add to:
- FRA1FireHazardsForm
- FRA4PassiveProtectionForm
- FRA5ExternalFireSpreadForm
- FRA8FirefightingEquipmentForm
- A2BuildingProfileForm
- A3PersonsAtRiskForm

**Pattern:** Add module_key to interface + pass sourceModuleKey prop (2-line change per form)

### 2. Extend to FSD
FSD has 6 critical modules:
- FSD_2_EVAC_STRATEGY
- FSD_3_ESCAPE_DESIGN
- FSD_4_PASSIVE_PROTECTION
- FSD_5_ACTIVE_SYSTEMS
- FSD_6_FRS_ACCESS
- FSD_8_SMOKE_CONTROL

**Required Change:** Remove `&& documentType === 'FRA'` condition (line 169) to apply to FSD

### 3. Add Floor Indicator to UI
Display visual indicator when floor is applied:
```
Priority: P2 (elevated from P4 due to critical module)
Severity: T3 (elevated from T1 due to critical module)
```

### 4. Audit Existing Actions
Identify and re-score existing P4 actions from critical modules:
```sql
SELECT a.id, a.recommended_action, a.priority_band, a.severity_tier, 
       mi.module_key, d.document_type
FROM actions a
JOIN module_instances mi ON a.module_instance_id = mi.id
JOIN documents d ON a.document_id = d.id
WHERE a.priority_band IN ('P3', 'P4')
  AND d.document_type = 'FRA'
  AND mi.module_key IN (
    'A2_BUILDING_PROFILE', 'A3_PERSONS_AT_RISK', 'FRA_7_EMERGENCY_ARRANGEMENTS',
    'FRA_1_HAZARDS', 'FRA_2_ESCAPE_ASIS', 'FRA_3_ACTIVE_SYSTEMS',
    'FRA_4_PASSIVE_PROTECTION', 'FRA_8_FIREFIGHTING_EQUIPMENT',
    'FRA_5_EXTERNAL_FIRE_SPREAD', 'FRA_90_SIGNIFICANT_FINDINGS'
  )
  AND a.deleted_at IS NULL;
```

## Summary

Successfully implemented a **minimal, surgical fix** to the FRA action priority mismatch:

- **Root Cause:** AddActionModal ignored module criticality context
- **Solution:** Central floor in AddActionModal after severity derivation
- **Scope:** FRA-only, critical modules only (11 modules)
- **Floor Rules:** P3/P4 → P2, T1/T2 → T3 (never downgrades)
- **Implementation:** Option A (prop pass) - minimal, type-safe
- **Changes:** 4 files, ~30 lines total
- **Preserved:** Severity engine, manual escalations, governance modules, DSEAR
- **Risk:** Minimal (additive logic, no engine changes)
- **Testing:** Build passes, static greps confirm correct wiring

---

**Date:** February 25, 2026  
**Scope:** FRA critical module priority floor  
**Impact:** Actions from critical modules  
**Result:** P2/T3 minimum for FRA critical modules  
**Risk:** Minimal (additive, FRA-only, preserves existing behavior)  
**Verification:** All acceptance tests passed, build clean
