# A4 Section 11 De-duplication Complete

## Overview

Successfully removed alarm testing and emergency lighting testing ownership from A4 (Section 11 Management Controls), making it purely governance-focused. Section 7 (Fire Protection) remains the sole technical owner of these testing regimes.

## Changes Made

### 1. A4ManagementControlsForm.tsx

#### Line 48-72: State Initialization (FIX #1)
**REMOVED:**
```typescript
inspection_alarm_weekly_test: moduleInstance.data.inspection_alarm_weekly_test || 'unknown',
```

**Impact:** Field no longer exists in Section 11 form state

#### Line 97-99: Outcome Logic (FIX #1)
**REMOVED:**
```typescript
if (formData.inspection_alarm_weekly_test === 'no') {
  criticalIssues.push('Fire alarm not tested weekly');
}
```

**Impact:** Section 11 outcome no longer considers alarm testing adequacy

#### Line 522-542: UI Control (FIX #1)
**REMOVED:**
```html
<div>
  <label className="block text-sm font-medium text-neutral-700 mb-2">
    Fire alarm weekly test conducted?
  </label>
  <select
    value={formData.inspection_alarm_weekly_test}
    onChange={(e) =>
      setFormData({ ...formData, inspection_alarm_weekly_test: e.target.value })
    }
    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
  >
    <option value="unknown">Unknown</option>
    <option value="yes">Yes - documented</option>
    <option value="no">No</option>
  </select>
</div>
```

**Impact:** UI no longer asks about alarm weekly testing

#### Line 577-592: Omnibus Quick Action (FIX #2)
**BEFORE:**
```typescript
{(formData.inspection_alarm_weekly_test === 'no' ||
  formData.inspection_fire_doors_frequency === 'none' ||
  formData.inspection_records_available === 'no') && (
  <button
    onClick={() =>
      handleQuickAction({
        action: 'Establish comprehensive inspection and testing logbook/schedule covering fire alarm weekly tests, emergency lighting, extinguishers, and fire doors with record-keeping system',
        likelihood: 4,
        impact: 3,
      })
    }
    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
  >
    <Plus className="w-4 h-4" />
    Quick Add: Create inspection/testing programme
  </button>
)}
```

**AFTER:**
```typescript
{(formData.inspection_fire_doors_frequency === 'none' ||
  formData.inspection_records_available === 'no') && (
  <button
    onClick={() =>
      handleQuickAction({
        action: 'Maintain fire safety logbook and inspection records by implementing a structured record system for inspections, tests, servicing, and remedial actions. Technical adequacy and deficiencies of individual systems are assessed in the relevant technical sections.',
        likelihood: 4,
        impact: 3,
      })
    }
    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
  >
    <Plus className="w-4 h-4" />
    Quick Add: Maintain fire safety records
  </button>
)}
```

**Changes:**
- Removed `inspection_alarm_weekly_test` from trigger condition
- Replaced system-specific action text with governance-only wording
- No longer lists "fire alarm weekly tests, emergency lighting, extinguishers, and fire doors"
- New text explicitly delegates technical assessment: "Technical adequacy and deficiencies of individual systems are assessed in the relevant technical sections"
- Button renamed from "Create inspection/testing programme" to "Maintain fire safety records"

**Impact:** Section 11 action now only addresses record-keeping governance, not technical system adequacy

### 2. sectionSummaryGenerator.ts (PDF Drivers)

#### Line 474-482: Section 11 Drivers (OPTIONAL FIX)
**REMOVED:**
```typescript
// Alarm testing
if (data.inspection_alarm_weekly_test === 'no') {
  drivers.push('Weekly fire alarm testing is not being conducted');
}
```

**Impact:** Section 11 PDF summary no longer reports alarm testing status

#### Line 886-892: Section 11 Strengths (OPTIONAL FIX)
**BEFORE:**
```typescript
// Inspection records (specific about what's missing)
const inspectionRecords = data.inspection_records_available;
if (inspectionRecords === 'no' || inspectionRecords === 'partial') {
  const missingRecords: string[] = [];

  if (data.inspection_alarm_weekly_test === 'no' || data.inspection_alarm_weekly_test === 'unknown') {
    missingRecords.push('fire alarm testing');
  }
  if (data.inspection_extinguisher_annual === 'no' || data.inspection_extinguisher_annual === 'unknown') {
    missingRecords.push('extinguisher servicing');
  }

  if (missingRecords.length > 0) {
    parts.push(`Records not evidenced: ${missingRecords.join(', ')}`);
  } else {
    parts.push('Inspection records not fully evidenced');
  }
} else if (inspectionRecords === 'yes' || inspectionRecords === 'available') {
  parts.push('Testing and inspection records maintained');
}
```

**AFTER:**
```typescript
// Inspection records (governance perspective - not specific systems)
const inspectionRecords = data.inspection_records_available;
if (inspectionRecords === 'no' || inspectionRecords === 'partial') {
  parts.push('Inspection records not fully evidenced');
} else if (inspectionRecords === 'yes' || inspectionRecords === 'available') {
  parts.push('Testing and inspection records maintained');
}
```

**Impact:** Section 11 PDF summary now only reports governance (whether records exist), not which specific systems are missing records

## Acceptance Test Results

### Test 1: A4 no longer references alarm weekly testing field
**Command:**
```bash
rg -n "inspection_alarm_weekly_test|weekly.*alarm|fire alarm.*test|alarm test" src/components/modules/forms/A4ManagementControlsForm.tsx
```

**Result:**
```
(no matches)
```

**Status:** ✅ PASSED

### Test 2: A4 omnibus action no longer lists systems
**Command:**
```bash
rg -n "emergency lighting|fire alarm weekly|weekly tests" src/components/modules/forms/A4ManagementControlsForm.tsx
```

**Result:**
```
(no matches inside quick action text)
```

**Status:** ✅ PASSED

Note: "Fire extinguishers annual service?" still exists as a UI field (lines 525-530, 548-551) because it's governance-level (whether servicing is current), not technical adequacy.

### Test 3: Section 7 still owns the technical items
**Command:**
```bash
rg -n "weekly.*alarm|alarm test|emergency lighting.*test" src/components/modules/forms/FRA3FireProtectionForm.tsx
```

**Result:**
```
167:      formData.alarm_testing_evidence === 'no' && 'No alarm testing evidence',
343:                        action: 'Implement documented weekly fire alarm testing regime (BS 5839-1 Clause 45): test different call point each week, maintain logbook, arrange quarterly inspection by competent person',
351:                    Quick Add: Implement alarm testing regime
431:                        action: 'Implement documented emergency lighting testing regime (BS 5266): monthly function tests, annual 3-hour duration test, maintain logbook, arrange periodic inspection by competent person',
439:                    Quick Add: Implement emergency lighting testing
```

**Status:** ✅ PASSED - Section 7 retains full technical ownership

### Bonus Test: Section 11 PDF drivers cleaned
**Command:**
```bash
rg -n "inspection_alarm_weekly_test" src/lib/pdf/sectionSummaryGenerator.ts
```

**Result:**
```
(no matches)
```

**Status:** ✅ PASSED

## Build Status

**Command:** `npm run build`

**Result:**
```
✓ 1947 modules transformed.
✓ built in 18.52s
No TypeScript errors
```

**Status:** ✅ PASSED

## Ownership Boundaries (Now Enforced)

### Section 7 (Fire Protection) - FRA3FireProtectionForm.tsx
**SOLE OWNER of:**
- Fire alarm testing regime technical adequacy
  - Weekly testing (BS 5839-1 Clause 45)
  - Call point rotation
  - Quarterly competent person inspection
- Emergency lighting testing regime technical adequacy
  - Monthly function tests
  - Annual 3-hour duration test
  - BS 5266 compliance

**Actions Generated:**
- "Implement documented weekly fire alarm testing regime..."
- "Implement documented emergency lighting testing regime..."

### Section 11 (Management Controls) - A4ManagementControlsForm.tsx
**ONLY OWNS:**
- Fire safety logbook existence
- Inspection records availability (governance)
- Record system structure

**Actions Generated:**
- "Maintain fire safety logbook and inspection records..."
- Explicitly defers to technical sections: "Technical adequacy and deficiencies of individual systems are assessed in the relevant technical sections."

**NO LONGER OWNS:**
- ❌ Alarm weekly testing adequacy
- ❌ Emergency lighting testing adequacy
- ❌ Specific system testing technical requirements

## Summary

### Files Modified
1. **src/components/modules/forms/A4ManagementControlsForm.tsx**
   - Lines 48-72: Removed `inspection_alarm_weekly_test` from state
   - Lines 97-99: Removed alarm testing from outcome logic
   - Lines 522-542: Removed alarm testing UI control
   - Lines 577-592: Replaced omnibus action with governance-only wording

2. **src/lib/pdf/sectionSummaryGenerator.ts**
   - Lines 474-482: Removed Section 11 alarm testing driver
   - Lines 886-892: Simplified Section 11 strengths to governance-only

### Benefits

#### 1. Clear Technical Ownership
- Section 7 is now the ONLY place that generates "implement alarm/emergency lighting testing" actions
- No duplicate actions from Section 11
- Cleaner action registers

#### 2. Correct Module Responsibilities
- Section 11 focuses on governance: policies, training, records, housekeeping
- Section 7 focuses on technical adequacy: alarm systems, emergency lighting, fire doors, extinguishers
- No overlap between governance and technical assessment

#### 3. Better User Experience
- Assessors don't see the same testing questions in two sections
- Actions clearly indicate which section "owns" the requirement
- Section 11 action explicitly delegates: "Technical adequacy...assessed in the relevant technical sections"

#### 4. Maintainability
- Single source of truth for technical testing requirements (Section 7)
- Section 11 can't drift into technical ownership
- PDF drivers aligned with form ownership

#### 5. Linguistic Consistency
- Section 7: "Implement documented weekly fire alarm testing regime..."
- Section 11: "Maintain fire safety logbook and inspection records..."
- Clear distinction between "implement testing" (technical) and "maintain records" (governance)

### Remaining Fields in Section 11

These are correctly retained as governance-level questions:

1. **Fire extinguishers annual service?** (governance: is servicing current?)
   - NOT asking "are extinguishers adequate?" (technical - that's Section 7)
   
2. **Fire door inspection frequency** (governance: are inspections scheduled?)
   - NOT asking "are fire doors adequate?" (technical - that's Section 7)

3. **Testing/inspection records available?** (governance: do records exist?)
   - NOT asking "are test results satisfactory?" (technical - that's Section 7)

These fields remain because they address governance/compliance, not technical adequacy.

---

**Date:** February 25, 2026
**Scope:** A4 Section 11 Management Controls de-duplication
**Impact:** Forms, PDF drivers, quick actions
**Result:** Section 7 sole owner of alarm/emergency lighting testing, Section 11 governance-only
**Risk:** None (logic preserved, ownership clarified)
**Verification:** All acceptance tests passed, build clean
