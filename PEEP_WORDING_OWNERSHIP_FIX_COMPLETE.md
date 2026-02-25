# PEEP Wording Ownership Fix COMPLETE

## Overview

Fixed strict repository-wide PEEP wording ownership to ensure only Section 11.2 (Emergency Arrangements / A5_EMERGENCY_ARRANGEMENTS) owns the "PEEP process" implementation language.

**Objective:** Eliminate "PEEP process" and "implement PEEP" from all non-EA modules
**Result:** Only A5EmergencyArrangementsForm.tsx retains PEEP process ownership
**Impact:** Clear governance ownership - other modules only verify/confirm PEEPs exist

## Changes Made

### 1. A3PersonsAtRiskForm.tsx - Section 3 (Persons at Risk)

**Purpose:** This module identifies WHO needs assistance, not HOW the process works.

#### Change 1: Outcome Reason (Line 66)

**Before:**
```typescript
reason: 'Evacuation assistance required but PEEP process not confirmed',
```

**After:**
```typescript
reason: 'Evacuation assistance required but PEEPs not confirmed as documented',
```

**Rationale:**
- Section 3 identifies persons needing assistance
- Does not own the PEEP process implementation
- Only needs to confirm PEEPs exist/are documented

#### Change 2: Quick Action Description (Line 404)

**Before:**
```typescript
action: 'Implement/confirm PEEP process for those requiring assistance and align to evacuation strategy.',
```

**After:**
```typescript
action: 'Confirm PEEPs are documented for all persons requiring assistance and align to evacuation strategy.',
```

**Rationale:**
- Changed from "Implement/confirm PEEP process" to "Confirm PEEPs are documented"
- Removed governance/process language
- Focus on verification, not implementation

#### Change 3: Quick Action Button Label (Line 412)

**Before:**
```typescript
Quick Add: Implement PEEP process (Critical)
```

**After:**
```typescript
Quick Add: Confirm PEEPs documented (Critical)
```

**Rationale:**
- Button label now matches verification focus
- No governance ownership implied
- Still marked as critical (risk-based priority)

### 2. infoGapQuickActions.ts - Info Gap Helper

**Purpose:** Generate quick actions when information is missing/unknown.

#### Change: PEEP Info Gap Action (Line 102)

**Before:**
```typescript
action: 'Confirm PEEP process and records for persons requiring assistance; implement where absent.',
```

**After:**
```typescript
action: 'Confirm PEEPs exist, are documented for those needing assistance, and records are available.',
```

**Rationale:**
- Info gaps are about missing information, not process implementation
- Changed from "Confirm PEEP process...implement where absent" to pure verification
- "Confirm PEEPs exist...records are available" is fact-finding, not governance
- Removes "implement" entirely - that's Section 11.2's job

## Verification Results

### Command Run

```bash
rg -n "PEEP process|implement PEEP" src -S
```

### Output

```
src/components/modules/forms/A5EmergencyArrangementsForm.tsx:386:                Quick Add: Implement PEEP process
```

### Context (with -C 3)

```
A5EmergencyArrangementsForm.tsx:383-                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
A5EmergencyArrangementsForm.tsx:384-              >
A5EmergencyArrangementsForm.tsx:385-                <Plus className="w-4 h-4" />
A5EmergencyArrangementsForm.tsx:386:                Quick Add: Implement PEEP process
A5EmergencyArrangementsForm.tsx:387-              </button>
A5EmergencyArrangementsForm.tsx:388-            )}
A5EmergencyArrangementsForm.tsx:389-          </div>
```

### ✅ PASSED

**Result:** Only ONE match remaining, and it's in the correct location:
- File: `A5EmergencyArrangementsForm.tsx` (Section 11.2 - Emergency Arrangements)
- Context: Button label for PEEP process quick action
- This is the ONLY module that should own PEEP process implementation

**Full action text (Line 378):**
```typescript
action: 'Implement Personal Emergency Evacuation Plan (PEEP) process: identify vulnerable persons, conduct individual risk assessment, assign buddy system, document assistance requirements, brief staff, establish review schedule'
```

This is correct and expected - Section 11.2 owns the procedural PEEP implementation.

## Files Modified

### 1. src/components/modules/forms/A3PersonsAtRiskForm.tsx
- **Line 66:** Updated outcome reason from "PEEP process not confirmed" to "PEEPs not confirmed as documented"
- **Line 404:** Updated action from "Implement/confirm PEEP process" to "Confirm PEEPs are documented"
- **Line 412:** Updated button from "Implement PEEP process" to "Confirm PEEPs documented"
- **Impact:** Section 3 now only verifies PEEPs exist, doesn't claim process ownership

### 2. src/utils/infoGapQuickActions.ts
- **Line 102:** Updated action from "Confirm PEEP process...implement where absent" to "Confirm PEEPs exist, are documented...records are available"
- **Impact:** Info gap actions focus on fact-finding, not implementation

## Before vs After Summary

### Section 3 (Persons at Risk) - A3PersonsAtRiskForm.tsx

| Aspect | Before | After |
|--------|--------|-------|
| **Outcome Reason** | "PEEP process not confirmed" | "PEEPs not confirmed as documented" |
| **Action Description** | "Implement/confirm PEEP process" | "Confirm PEEPs are documented" |
| **Button Label** | "Implement PEEP process (Critical)" | "Confirm PEEPs documented (Critical)" |
| **Role** | Could be interpreted as owning process | Clearly verification/confirmation only |

### Info Gap Actions - infoGapQuickActions.ts

| Aspect | Before | After |
|--------|--------|-------|
| **Action Text** | "Confirm PEEP process...implement where absent" | "Confirm PEEPs exist...records are available" |
| **Intent** | Mixed: verification + implementation | Pure verification/fact-finding |
| **Ownership** | Ambiguous | Clear non-ownership |

### Section 11.2 (Emergency Arrangements) - A5EmergencyArrangementsForm.tsx

| Aspect | Status |
|--------|--------|
| **Button Label** | "Implement PEEP process" ✅ UNCHANGED |
| **Action Description** | "Implement Personal Emergency Evacuation Plan (PEEP) process: identify, assess, document, brief, review" ✅ UNCHANGED |
| **Role** | SOLE OWNER of PEEP process implementation ✅ CONFIRMED |

## Ownership Boundaries (Now Enforced)

### Section 3 (Persons at Risk) - Identification Role
- **Owns:** Identifying WHO needs assistance (occupancy profile, vulnerable persons)
- **Action Type:** Verification - "Confirm PEEPs are documented"
- **Does NOT Own:** PEEP process implementation or governance

### Section 6 (Means of Escape) - Physical Role
- **Owns:** Physical assisted-evacuation provisions (refuges, evac chairs, lifts, comms)
- **Action Type:** Installation - "Install physical provisions for assisted evacuation"
- **Does NOT Own:** PEEP process or governance

### Section 11.2 (Emergency Arrangements) - Governance Role
- **Owns:** PEEP process implementation and governance
- **Action Type:** Implementation - "Implement PEEP process: identify, assess, document, brief, review"
- **SOLE OWNER** of PEEP process language

### Info Gap Actions - Fact-Finding Role
- **Owns:** Identifying missing information/unknown fields
- **Action Type:** Verification - "Confirm PEEPs exist...records are available"
- **Does NOT Own:** Process implementation - triggers verification only

## Linguistic Changes Summary

### Removed Phrases (from non-EA modules)
- ❌ "PEEP process" (except EA)
- ❌ "implement PEEP" (except EA)
- ❌ "Implement/confirm PEEP process"

### Replacement Phrases (in non-EA modules)
- ✅ "PEEPs documented" / "PEEPs in place (documented)"
- ✅ "Confirm PEEPs are documented"
- ✅ "Confirm PEEPs exist...records are available"
- ✅ "PEEPs not confirmed as documented"

### Preserved Phrases (only in EA module)
- ✅ "Implement PEEP process" (Section 11.2 ONLY)
- ✅ "Personal Emergency Evacuation Plan (PEEP) process" (Section 11.2 ONLY)

## Benefits

### 1. Clear Governance Ownership
- Section 11.2 is the ONLY place that can "implement PEEP process"
- Other modules only verify/confirm PEEPs exist
- No ambiguity about who owns the procedural implementation

### 2. Correct Module Responsibilities
- Section 3: Identifies persons needing assistance, confirms documentation exists
- Section 6: Provides physical provisions (refuges, equipment)
- Section 11.2: Implements PEEP process (identify, assess, document, brief, review)

### 3. Prevents Duplicate Actions
- Can't create "implement PEEP process" action from multiple sections
- Each section creates contextually appropriate actions
- Cleaner action registers with distinct responsibilities

### 4. Linguistic Consistency
- "Confirm" language for verification (Sections 3, info gaps)
- "Install" language for physical provisions (Section 6)
- "Implement" language for process/governance (Section 11.2 only)

### 5. Professional Assessment Workflow
- Assessor identifies persons at risk (Section 3)
- Assessor checks physical provisions (Section 6)
- Assessor evaluates PEEP process governance (Section 11.2)
- Each stage has distinct, appropriate actions

## Testing Checklist

- [x] Zero "PEEP process" references outside EA module
- [x] Zero "implement PEEP" references outside EA module
- [x] A3PersonsAtRiskForm uses "Confirm PEEPs documented"
- [x] infoGapQuickActions uses "Confirm PEEPs exist...records are available"
- [x] A5EmergencyArrangementsForm retains "Implement PEEP process"
- [x] Only ONE match in verification command
- [x] Match is in A5EmergencyArrangementsForm.tsx
- [x] TypeScript compiles cleanly (22.83s)
- [x] All changes are text-only (no logic changes)

## Build Verification

**Command:** `npm run build`

**Result:**
```
✓ 1947 modules transformed.
✓ built in 22.83s
No TypeScript errors
```

**Status:** ✅ PASSED

---

**Date:** February 25, 2026
**Scope:** Repository-wide PEEP wording ownership enforcement
**Impact:** Forms, quick actions, info gap helpers
**Result:** Section 11.2 is sole owner of "PEEP process" implementation language
**Risk:** None (text-only changes, behavior unchanged)
**Verification:** Only 1 match remaining, in correct location (A5EmergencyArrangementsForm.tsx)
