# FRA PDF Section 13 Module-Scoped Action Filtering - COMPLETE

## Overview

Refined Section 13 "Significant Findings" action filtering to only show actions from FRA modules, excluding actions from FSD, DSEAR, or other non-FRA modules in combined documents.

## Problem Statement

**Previous Implementation:**
Section 13 was receiving `actionsWithRefs` which included ALL actions across the entire document. In combined documents (e.g., FRA+FSD or FRA+DSEAR), this caused Section 13 to display actions from non-FRA modules.

**Issue:**
- FRA Section 13 showed FSD actions
- FRA Section 13 showed DSEAR actions
- Action counts didn't match FRA-specific summary
- Violated section isolation principles

## Solution

### Step 1: Identified FRA Module Membership

Analyzed `FRA_REPORT_STRUCTURE` to understand that Section 13 should summarize ALL actions from FRA sections (1-13), which includes:

**FRA Sections:**
1. Assessment Details (A1_DOC_CONTROL)
2. Premises & General Information (A2_BUILDING_PROFILE)
3. Occupants & Vulnerability (A3_PERSONS_AT_RISK)
4. Relevant Legislation (A1_DOC_CONTROL)
5. Fire Hazards (FRA_1_HAZARDS)
6. Means of Escape (FRA_2_ESCAPE_ASIS)
7. Fire Detection & Alarm (FRA_3_ACTIVE_SYSTEMS)
8. Passive Fire Protection (FRA_4_PASSIVE_PROTECTION)
9. Firefighting Facilities (FRA_8_FIREFIGHTING_EQUIPMENT)
10. Fire Safety Management (A4_MANAGEMENT_CONTROLS, FRA_6_MANAGEMENT_SYSTEMS, etc.)
11. External Fire Spread (FRA_5_EXTERNAL_FIRE_SPREAD)
12. Significant Findings (FRA_4_SIGNIFICANT_FINDINGS, FRA_90_SIGNIFICANT_FINDINGS)
13. Review & Reassessment

**Excluded Modules:**
- FSD modules (FSD_1_REG_BASIS, FSD_2_EVAC_STRATEGY, etc.)
- DSEAR modules (DSEAR_1_DANGEROUS_SUBSTANCES, DSEAR_2_PROCESS_RELEASES, etc.)
- RE modules (RE01_DOCUMENT_CONTROL, RE02_CONSTRUCTION, etc.)

### Step 2: Built Section-Scoped Action Filter

**File:** `src/lib/pdf/buildFraPdf.ts`

**Location:** Lines 815-818

**Implementation:**

```typescript
// Filter actions to only those belonging to FRA modules (in moduleToSectionMap)
// This excludes actions from FSD, DSEAR, or other non-FRA modules
const fraModuleIds = Array.from(moduleToSectionMap.keys());
const section13Actions = actionsWithRefs.filter(a => fraModuleIds.includes(a.module_instance_id));
```

**How It Works:**

1. **moduleToSectionMap** is built earlier (lines 300-308) and contains ONLY modules from `FRA_REPORT_STRUCTURE`
2. Extract all FRA module IDs: `Array.from(moduleToSectionMap.keys())`
3. Filter `actionsWithRefs` to only actions whose `module_instance_id` is in the FRA module list
4. Result: `section13Actions` contains only FRA-scoped actions

### Step 3: Updated Section 13 Renderer Call

**Before:**
```typescript
yPosition = drawCleanAuditSection13({
  page: cursor.page,
  fra4Module,
  actions: actionsWithRefs,  // ALL actions (FRA + FSD + DSEAR)
  // ...
});
```

**After:**
```typescript
yPosition = drawCleanAuditSection13({
  page: cursor.page,
  fra4Module,
  actions: section13Actions,  // ONLY FRA actions
  // ...
});
```

**Result:**
Section 13 now receives pre-filtered actions that match its scope.

## Technical Details

### Module Mapping Flow

1. **Build moduleToSectionMap** (lines 300-308):
   ```typescript
   const moduleToSectionMap = new Map<string, number>();
   for (const section of FRA_REPORT_STRUCTURE) {
     for (const moduleKey of section.moduleKeys) {
       const module = moduleInstances.find(m => m.module_key === moduleKey);
       if (module) {
         moduleToSectionMap.set(module.id, section.id);
       }
     }
   }
   ```
   - Only includes modules listed in `FRA_REPORT_STRUCTURE`
   - Maps module_instance_id → section_id
   - Excludes FSD/DSEAR/RE modules

2. **Build actionsWithRefs** (lines 312-324):
   ```typescript
   const actionsWithRefs = sortedActions.map((action) => {
     const sectionId = moduleToSectionMap.get(action.module_instance_id);
     const sectionRef = sectionId ? `Section ${getDisplaySectionNumber(sectionId)}` : null;
     return {
       ...action,
       reference_number: action.reference_number,
       section_reference: sectionRef,
       owner_display_name: getDisplayableOwner(action.owner_display_name),
     };
   });
   ```
   - Adds section references to ALL actions
   - FRA actions get section_reference (e.g., "Section 5")
   - Non-FRA actions get section_reference = null

3. **Filter for Section 13** (lines 817-818):
   ```typescript
   const fraModuleIds = Array.from(moduleToSectionMap.keys());
   const section13Actions = actionsWithRefs.filter(a => fraModuleIds.includes(a.module_instance_id));
   ```
   - Uses moduleToSectionMap as the source of truth
   - Only includes actions from FRA modules
   - Preserves all references and mappings from actionsWithRefs

### Status Filtering (Unchanged)

Inside `drawCleanAuditSection13`, the existing status filter remains:

```typescript
const openActions = actions.filter((a) => a.status === 'open' || a.status === 'in_progress');
```

This provides a two-stage filter:
1. **Stage 1 (buildFraPdf.ts):** Module scope filter → only FRA actions
2. **Stage 2 (fraSection13CleanAudit.ts):** Status filter → only open/in_progress

## Testing Scenarios

### Test 1: Pure FRA Document
**Setup:** Document with only FRA modules
**Expected:**
- Section 13 shows all FRA actions (status: open/in_progress)
- Same behavior as before (no regression)
- All section references valid

### Test 2: Combined FRA+FSD Document
**Setup:** Document with FRA and FSD modules, actions in both
**Before Fix:**
- Section 13 showed FRA actions ✓
- Section 13 showed FSD actions ✗ (WRONG)

**After Fix:**
- Section 13 shows ONLY FRA actions ✓
- FSD actions excluded ✓
- Action counts match FRA scope ✓

### Test 3: Combined FRA+DSEAR Document
**Setup:** Document with FRA and DSEAR modules
**Before Fix:**
- Section 13 showed explosion-related actions from DSEAR modules ✗

**After Fix:**
- Section 13 shows ONLY FRA fire safety actions ✓
- DSEAR actions excluded ✓
- Clear separation of fire vs explosion risk ✓

### Test 4: Combined FRA+FSD+DSEAR Document
**Setup:** Document with all three module types
**Before Fix:**
- Section 13 was a mixed bag of all action types ✗

**After Fix:**
- Section 13 shows ONLY FRA actions ✓
- FSD actions excluded ✓
- DSEAR actions excluded ✓
- Each module type's summary section properly scoped ✓

## Verification Points

✅ **Module Scope Correctness:**
- Section 13 actions belong to modules in FRA_REPORT_STRUCTURE
- No actions from FSD modules
- No actions from DSEAR modules
- No actions from RE modules

✅ **Reference Consistency:**
- All Section 13 actions have valid section_reference
- References match Action Register
- References match section-specific action lists

✅ **Count Accuracy:**
- Action count in Section 13 matches FRA summary
- P1/P2/P3 counts match filtered scope
- Executive outcome based on correct action set

✅ **Backward Compatibility:**
- Pure FRA documents work as before
- No changes to Action Register
- No changes to section-specific action rendering
- Status filter still works (open/in_progress only)

## Files Modified

**src/lib/pdf/buildFraPdf.ts**
- Lines 815-818: Added module-scoped filter for Section 13
- Lines 817-818: Build fraModuleIds from moduleToSectionMap
- Line 823: Pass section13Actions instead of actionsWithRefs

## Architecture Benefits

### 1. Proper Isolation
- Each module type's summary section shows only relevant actions
- No cross-contamination between FRA/FSD/DSEAR
- Clear boundaries for combined documents

### 2. Single Source of Truth
- Uses moduleToSectionMap (built from FRA_REPORT_STRUCTURE)
- No duplicate logic for determining FRA vs non-FRA
- Easy to update if FRA_REPORT_STRUCTURE changes

### 3. Preserves References
- Uses actionsWithRefs (already has section mappings)
- Maintains reference numbers
- Maintains owner display names
- No data loss

### 4. Two-Stage Filtering
- Stage 1: Module scope (FRA vs FSD vs DSEAR)
- Stage 2: Status (open vs in_progress vs closed)
- Clear separation of concerns

## Impact

**Before:**
- Combined documents showed incorrect actions in Section 13
- Confusing for users (FSD actions in FRA summary)
- Incorrect action counts
- Misleading executive outcome

**After:**
- Section 13 properly scoped to FRA actions only
- Clear separation in combined documents
- Accurate counts and summaries
- Executive outcome based on correct action set

## Implementation Date

February 25, 2026

---

**Scope:** FRA PDF Section 13 action filtering by module membership
**Impact:** Correct action scoping in combined documents (FRA+FSD+DSEAR)
**Risk:** Low (additive filter, no data changes)
**Benefit:** Eliminates cross-module action contamination
