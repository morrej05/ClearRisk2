# FRA Section 6 & 11.2 De-duplication COMPLETE

## Overview

Eliminated all overlaps between Section 6 (Means of Escape - physical) and Section 11.2 (Emergency Arrangements - procedural) to enforce strict boundary separation across UI, actions, summaries, and PDF.

**Objective:** No duplicates between physical egress (Section 6) and procedural governance (Section 11.2)
**Result:** Clear separation enforced in forms, quick actions, summaries, key points, and PDF
**Impact:** Users and assessors now have distinct, non-overlapping areas of responsibility

## Boundary Rule (Now Enforced Everywhere)

### Section 6 / FRA_2_ESCAPE_ASIS - PHYSICAL ONLY
- Escape routes, travel distances, exits, stairs
- **Physical** assisted-evacuation provisions: refuges, evac chairs, evac lifts, communication devices
- **Exit/directional wayfinding signage** (BS 5499 escape-route signs)

### Section 11.2 / FRA_7_EMERGENCY_ARRANGEMENTS - PROCEDURAL ONLY
- Emergency plans, drills, training, wardens, responsibilities
- **PEEP PROCESS**: identify vulnerable persons, document PEEPs, buddy system, staff briefing, review
- **Assembly point/muster point signage & communication**

## Changes Made

### 1. SIGNAGE DE-DUPLICATION

#### A. Means of Escape (Section 6) - Exit/Directional Signage Only

**File:** `src/components/modules/forms/FRA2MeansOfEscapeForm.tsx`

**Before:**
```typescript
Exit signage adequacy
Adequate - BS 5499 compliant
Inadequate - missing or poor signage

Quick Add: Upgrade escape signage
```

**After:**
```typescript
Escape-route wayfinding signage adequacy
Adequate - BS 5499 compliant exit/directional signs
Inadequate - missing or poor exit wayfinding

Help text: Exit and directional signs guiding to final exits - quantity, visibility, consistency, illumination

Action: 'Upgrade escape-route wayfinding signage to BS 5499: install exit/directional signs at decision points, ensure consistent direction, provide illuminated or photoluminescent signs where required'

Button: Quick Add: Upgrade escape-route wayfinding signage
```

**Changes:**
- Label explicitly mentions "escape-route wayfinding"
- Options clarified as "exit/directional signs"
- Help text explains these are for guiding to final exits
- Action title specifies "escape-route wayfinding signage"
- NO mention of assembly points

#### B. Emergency Arrangements (Section 11.2) - Assembly/Muster Point Only

**File:** `src/components/modules/forms/A5EmergencyArrangementsForm.tsx`

**Before:**
```typescript
Assembly point(s) defined and signposted?

Action: 'Define suitable assembly point(s) at safe distance from building. Install assembly point signage and ensure location is communicated to all occupants.'

Button: Quick Add: Define assembly points
```

**After:**
```typescript
Assembly point(s) defined and signposted?

Help text: Muster point location defined, communicated, and signposted at safe distance from building

Action: 'Install assembly point signage & communicate muster point: define suitable muster location at safe distance, install assembly point signs, brief all occupants on location'

Button: Quick Add: Install assembly point signage & communicate muster point
```

**Changes:**
- Help text clarifies muster point location + communication
- Action title now "Install assembly point signage & communicate muster point"
- Emphasizes communication alongside physical signage
- NO mention of BS 5499 exit/directional signage

### 2. PEEP DE-DUPLICATION

#### A. Removed PEEP Process from Means of Escape (Section 6)

**File:** `src/components/modules/forms/FRA2MeansOfEscapeForm.tsx`

**Before:**
```typescript
Disabled egress arrangements
Adequate - refuges/evacuation lifts/assistance
Inadequate - no provision

Help text: Consider refuges, evacuation lifts, PEEPs, and assistance arrangements

Action: 'Confirm evacuation assistance arrangements for persons requiring assistance: identify refuge locations, implement PEEP process, provide evacuation chairs/devices, train staff in assistance procedures'

Button: Quick Add: Confirm evacuation assistance arrangements
```

**After:**
```typescript
Assisted evacuation physical provisions
Adequate - refuges/evacuation lifts/equipment provided
Inadequate - no physical provisions

Help text: Physical enablers: refuges, evacuation lifts, evacuation chairs, communication devices

Action: 'Install physical provisions for assisted evacuation: provide refuge areas with 2-way communication, evacuation chairs/devices, evacuation lift (where applicable), visual/tactile wayfinding aids'

Button: Quick Add: Confirm evacuation assistance arrangements
```

**Changes:**
- Label changed from "Disabled egress arrangements" to "Assisted evacuation physical provisions"
- Options explicitly say "equipment provided" vs "physical provisions"
- Help text removed "PEEPs" and lists only physical enablers
- Action removed "implement PEEP process" and "train staff in assistance procedures"
- Action now ONLY covers physical provisions: refuges, chairs, lifts, comms
- NO procedural/governance language

#### B. Enhanced PEEP Process in Emergency Arrangements (Section 11.2)

**File:** `src/components/modules/forms/A5EmergencyArrangementsForm.tsx`

**Before:**
```typescript
Personal Emergency Evacuation Plans (PEEPs) in place?
Yes - documented for those who need them
No - required but not in place

Help text: Required for persons who may need assistance during evacuation

Action: 'Implement Personal Emergency Evacuation Plan (PEEP) process including identification of vulnerable persons, individual risk assessment, buddy system assignment, and documentation of assistance requirements.'

Button: Quick Add: Implement PEEP process
```

**After:**
```typescript
Personal Emergency Evacuation Plans (PEEPs) in place?
Yes - documented for those who need them
No - required but not in place

Help text: Procedural requirement: identify persons needing assistance, document PEEPs, brief staff, review periodically

Action: 'Implement Personal Emergency Evacuation Plan (PEEP) process: identify vulnerable persons, conduct individual risk assessment, assign buddy system, document assistance requirements, brief staff, establish review schedule'

Button: Quick Add: Implement PEEP process
```

**Changes:**
- Help text explicitly says "Procedural requirement"
- Help text outlines the process steps
- Action expanded to include "brief staff" and "establish review schedule"
- Clearly a governance/procedural action, NOT physical

### 3. SUMMARY DE-DUPLICATION

#### Section 6 Summary - Physical Provisions Only

**File:** `src/lib/pdf/sectionSummaryGenerator.ts:257-260`

**Before:**
```typescript
// Disabled egress
if (data.disabled_egress_arrangements === 'inadequate') {
  drivers.push('Provision for disabled persons in emergency egress is inadequate');
}
```

**After:**
```typescript
// Assisted evacuation physical provisions
if (data.disabled_egress_arrangements === 'inadequate') {
  drivers.push('Physical provisions for assisted evacuation are inadequate (refuges, equipment, communications)');
}
```

**Changes:**
- Comment updated to "Assisted evacuation physical provisions"
- Driver text explicitly mentions "Physical provisions"
- Examples given: refuges, equipment, communications
- NO mention of PEEP process or governance

#### Section 11.2 Summary - Already Correct

Section 11.2 (Emergency Arrangements) does not have extracted drivers in the current implementation, so no changes needed. PEEP process remains in Section 11.2 key points.

### 4. KEY POINTS DE-DUPLICATION

#### Section 6 Key Point - Physical Provisions Only

**File:** `src/lib/pdf/keyPoints/rules.ts:206-215`

**Before:**
```typescript
{
  id: 'disabled_egress_inadequate',
  type: 'weakness',
  weight: 75,
  when: (data) => {
    const val = safeGet(data, 'disabled_egress_arrangements');
    return val === 'inadequate' || val === 'missing';
  },
  text: (data) => 'Disabled egress arrangements require improvement',
  evidence: (data) => [{ field: 'disabled_egress_arrangements', value: safeGet(data, 'disabled_egress_arrangements') }],
},
```

**After:**
```typescript
{
  id: 'assisted_evacuation_physical_inadequate',
  type: 'weakness',
  weight: 75,
  when: (data) => {
    const val = safeGet(data, 'disabled_egress_arrangements');
    return val === 'inadequate' || val === 'missing';
  },
  text: (data) => 'Physical provisions for assisted evacuation require improvement (refuges, equipment)',
  evidence: (data) => [{ field: 'disabled_egress_arrangements', value: safeGet(data, 'disabled_egress_arrangements') }],
},
```

**Changes:**
- ID updated from `disabled_egress_inadequate` to `assisted_evacuation_physical_inadequate`
- Text explicitly says "Physical provisions"
- Examples: refuges, equipment
- NO PEEP process mention

#### Section 11 Key Points - Already Correct

**File:** `src/lib/pdf/keyPoints/rules.ts:640-668`

PEEP key points already correctly placed in Section 11 rules:
- `peeps_missing` (weakness): "Personal Emergency Evacuation Plans (PEEPs) not in place"
- `emergency_arrangements_good` (strength): "Emergency arrangements documented with PEEPs in place"

### 5. PDF RENDERING VERIFICATION

**File:** `src/lib/pdf/fra/fraCoreDraw.ts`

**Section 6 (FRA_2_ESCAPE_ASIS):**
- Lines 294-313: Key details for MoE
- Displays `disabled_egress_adequacy` and `disabled_egress` fields
- NO PEEP process wording

**Section 11.2 (A5_EMERGENCY_ARRANGEMENTS / FRA_7_EMERGENCY_ARRANGEMENTS):**
- Lines 230-238: Key details for Emergency Arrangements
- Line 235: `if (data.peeps_in_place) keyDetails.push(['PEEPs in Place', data.peeps_in_place]);`
- PEEP correctly owned by Section 11.2

## Acceptance Test Results

### ✅ Test 1: No PEEP Process in FRA2

**Command:** `rg -n "PEEP process|implement PEEP|PEEPs" src/components/modules/forms/FRA2MeansOfEscapeForm.tsx`

**Result:**
```
(no matches)
```

**Status:** PASSED ✅
- Zero PEEP process references in Means of Escape form
- Physical provisions only

### ✅ Test 2: Assembly Point Signage in Correct Location

**Command:** `rg -n "assembly point signage|muster point" src/components/modules/forms`

**Result:**
```
A5EmergencyArrangementsForm.tsx:281: action: 'Install assembly point signage & communicate muster point...'
A5EmergencyArrangementsForm.tsx:289: Quick Add: Install assembly point signage & communicate muster point
```

**Status:** PASSED ✅
- Assembly/muster point signage ONLY in Emergency Arrangements (Section 11.2)
- NOT in Means of Escape form

### ✅ Test 3: No PEEP Process in PDF Code

**Command:** `rg -n "PEEP process" src/lib/pdf -S`

**Result:**
```
(no matches)
```

**Status:** PASSED ✅
- PDF generation code does not contain "PEEP process" string
- Proper separation maintained

### ✅ Test 4: Escape-Route Signage Wording Correct

**Command:** `rg -n "escape-route wayfinding|Upgrade escape-route" src/components/modules/forms/FRA2MeansOfEscapeForm.tsx`

**Result:**
```
462: action: 'Upgrade escape-route wayfinding signage to BS 5499...'
470: Quick Add: Upgrade escape-route wayfinding signage
```

**Status:** PASSED ✅
- Signage clearly labeled as "escape-route wayfinding"
- BS 5499 exit/directional signs
- NO assembly point mention

### ✅ Test 5: Physical Provisions Language Correct

**Command:** `rg -n "physical provision|assisted evacuation" src/components/modules/forms/FRA2MeansOfEscapeForm.tsx`

**Result:**
```
484: Assisted evacuation physical provisions
495: <option value="inadequate">Inadequate - no physical provisions</option>
508: action: 'Install physical provisions for assisted evacuation...'
```

**Status:** PASSED ✅
- Labels clearly state "physical provisions"
- Action describes physical installations only
- NO procedural/governance language

### ✅ Test 6: TypeScript Compilation

**Command:** `npm run build`

**Result:**
```
✓ built in 19.80s
No TypeScript errors
```

**Status:** PASSED ✅

## Summary of Action Title Changes

### Section 6 (Means of Escape) - Updated Actions

**Signage Action:**
- **Old:** "Upgrade escape signage"
- **New:** "Upgrade escape-route wayfinding signage"
- **Full:** "Upgrade escape-route wayfinding signage to BS 5499: install exit/directional signs at decision points, ensure consistent direction, provide illuminated or photoluminescent signs where required"

**Assisted Evacuation Action:**
- **Old:** "Confirm evacuation assistance arrangements"
- **New:** (Button label unchanged, but action content completely rewritten)
- **Full:** "Install physical provisions for assisted evacuation: provide refuge areas with 2-way communication, evacuation chairs/devices, evacuation lift (where applicable), visual/tactile wayfinding aids"

### Section 11.2 (Emergency Arrangements) - Updated Actions

**Assembly Point Action:**
- **Old:** "Define assembly points"
- **New:** "Install assembly point signage & communicate muster point"
- **Full:** "Install assembly point signage & communicate muster point: define suitable muster location at safe distance, install assembly point signs, brief all occupants on location"

**PEEP Action:**
- **Old:** "Implement PEEP process"
- **New:** (Button label unchanged, but action enhanced)
- **Full:** "Implement Personal Emergency Evacuation Plan (PEEP) process: identify vulnerable persons, conduct individual risk assessment, assign buddy system, document assistance requirements, brief staff, establish review schedule"

## Files Modified

### 1. src/components/modules/forms/FRA2MeansOfEscapeForm.tsx
- **Lines 439-472:** Updated signage section to "escape-route wayfinding" with BS 5499 exit/directional focus
- **Lines 483-517:** Updated disabled egress to "assisted evacuation physical provisions" with physical-only action
- **Impact:** Section 6 now ONLY covers physical escape provisions

### 2. src/components/modules/forms/A5EmergencyArrangementsForm.tsx
- **Lines 257-291:** Enhanced assembly point section with muster point communication emphasis
- **Lines 353-388:** Enhanced PEEP section with explicit procedural language
- **Impact:** Section 11.2 now clearly owns procedural/governance aspects

### 3. src/lib/pdf/sectionSummaryGenerator.ts
- **Lines 257-260:** Updated Section 6 driver to "Physical provisions for assisted evacuation"
- **Impact:** Section 6 summaries avoid governance language

### 4. src/lib/pdf/keyPoints/rules.ts
- **Lines 206-215:** Updated Section 6 key point to "Physical provisions for assisted evacuation require improvement"
- **Impact:** Section 6 key points focus on physical, Section 11 retains PEEP process

## Before vs After Comparison

### Signage Overlap - RESOLVED

**Before:**
- Section 6: "Exit signage" (generic, could include assembly points)
- Section 11.2: "Assembly points defined and signposted" (could overlap with exit signs)

**After:**
- Section 6: "Escape-route wayfinding signage" (explicitly BS 5499 exit/directional signs to final exits)
- Section 11.2: "Assembly point signage & communicate muster point" (explicitly external muster location)

**Result:** Zero overlap - exit wayfinding vs external assembly point clearly separated

### PEEP Overlap - RESOLVED

**Before:**
- Section 6: "implement PEEP process, train staff in assistance procedures" (procedural)
- Section 11.2: "Implement PEEP process" (same action in two places!)

**After:**
- Section 6: "Install physical provisions for assisted evacuation: refuges, evac chairs, evac lift, communication devices" (physical only)
- Section 11.2: "Implement PEEP process: identify, assess, document, brief staff, review" (procedural only)

**Result:** Zero overlap - physical infrastructure vs procedural governance clearly separated

## Benefits

### 1. Clear Boundaries
- Section 6: Physical escape provisions (routes, exits, refuges, equipment, exit signs)
- Section 11.2: Procedural governance (plans, drills, PEEPs, training, assembly point comms)
- No overlap or confusion

### 2. No Duplicate Actions
- Can't create same action from two different sections
- Each section creates distinct, appropriate actions
- Cleaner action registers

### 3. Consistent Language
- "Physical provisions" language in Section 6
- "Procedural requirement" language in Section 11.2
- Summaries, key points, and PDF all align

### 4. Better User Experience
- Assessors know exactly where to record what
- Quick actions are contextually appropriate
- No confusion about which section owns what

### 5. PDF Professionalism
- Section 6 discusses physical escape provisions
- Section 11.2 discusses emergency procedures
- No procedural recommendations appearing in physical section
- Clear narrative separation

## Testing Checklist

- [x] Zero PEEP process references in FRA2MeansOfEscapeForm.tsx
- [x] Assembly point signage only in A5EmergencyArrangementsForm.tsx
- [x] Escape-route wayfinding signage only in FRA2MeansOfEscapeForm.tsx
- [x] Physical provisions language in Section 6
- [x] Procedural language in Section 11.2
- [x] Section 6 summary uses "Physical provisions"
- [x] Section 6 key point uses "Physical provisions"
- [x] Section 11 key points retain PEEP process
- [x] PDF fraCoreDraw.ts has PEEP in A5/FRA_7 only
- [x] TypeScript compiles cleanly
- [x] All acceptance tests pass

---

**Date:** February 25, 2026
**Scope:** FRA de-duplication item #2 (Section 6 vs Section 11.2)
**Impact:** Forms, actions, summaries, key points, PDF rendering
**Result:** Complete separation of physical (S6) vs procedural (S11.2) concerns
**Risk:** None (behavior unchanged for correct usage, prevents misuse)
