# FRA Hot Work Deduplication - COMPLETE

## Overview

Removed duplicated hot work control fields from FRA_1_HAZARDS (Section 5) to avoid overlap with A4_MANAGEMENT_CONTROLS (Section 11). Hot work is now captured in the appropriate context:

- **Section 5 (Hazards):** Basic ignition source context only
- **Section 11 (Management):** Detailed permit controls, fire watch, supervision

## Changes Made

### Part 1: FRA1FireHazardsForm.tsx

**Field Group Renamed and Simplified:**

**BEFORE:**
```typescript
hot_work_detail: {
  permit_required: boolean | null,
  fire_watch_during: boolean | null,
  post_work_fire_watch_required: boolean | null,
  post_work_duration_mins: number | null,
  typical_frequency: 'daily'|'weekly'|'monthly'|'rare'|null,
  notes: string
}
```

**AFTER:**
```typescript
hot_work_context: {
  typical_frequency: 'daily'|'weekly'|'monthly'|'rare'|null,
  notes: string
}
```

**UI Section Updated:**

**Title Changed:**
- OLD: "Hot Work Controls (Detail)"
- NEW: "Hot Work (Ignition Source Context)"

**Description Added:**
"Basic context about hot work as an ignition source (detailed controls captured in Management Systems)"

**Fields Removed:**
- Hot work permit system in place?
- Fire watch during hot work?
- Post-work fire watch required?
- Post-work fire watch duration (minutes)

**Fields Kept:**
- Typical frequency of hot work (Daily/Weekly/Monthly/Rare)
- Hot work context notes

**Placeholder Text Updated:**
"Brief context about hot work activities and ignition risk (e.g., 'Welding in workshop', 'Occasional contractors')"

### Part 2: PDF Rendering (fraSections.ts)

**Section 5 PDF Output Updated:**

**Data Access Changed:**
```typescript
// OLD
const hotWork = d.hot_work_detail || {};
const hwPermit = hotWork.permit_required === true ? 'Yes' : ...;
const hwFireWatch = hotWork.fire_watch_during === true ? 'Yes' : ...;
// etc.

// NEW
const hotWorkContext = d.hot_work_context || {};
const hwFreq = norm(hotWorkContext.typical_frequency);
const hwNotes = norm(hotWorkContext.notes);
```

**Heading Updated:**
- OLD: "Hot work, lightning, duct cleaning, DSEAR (screening)"
- NEW: "Hot work context, lightning, duct cleaning, DSEAR (screening)"

**PDF Fields Removed:**
- Hot work permit system
- Fire watch during hot work
- Post-work fire watch
- Post-work fire watch duration

**PDF Fields Kept:**
- Hot work frequency
- Hot work context (notes)

**Example PDF Output:**
```
HOT WORK CONTEXT, LIGHTNING, DUCT CLEANING, DSEAR (SCREENING)

Hot work frequency:                  Monthly
Hot work context:                    Welding in workshop, occasional contractors

Lightning protection present:        Yes
Lightning risk assessment:           Completed
...
```

### Part 3: A4 Management Form (Unchanged)

**No changes to A4ManagementControlsForm.tsx**

The detailed hot work controls remain in Section 11 (Management Systems):
- Hot work permit system in place? (Yes/No/Unknown)
- Fire watch during hot work required? (Yes/No)
- Post-work fire watch duration (minutes)
- Hot work permit comments

This creates a clear separation:
- **FRA1 (Hazards):** Identifies hot work as an ignition source
- **A4 (Management):** Captures the control measures

## Backwards Compatibility

### Legacy Data Handling

**Old field name (`hot_work_detail`) with detailed controls:**
```typescript
// Form state initialization
hot_work_context: moduleInstance.data.hot_work_context || {
  typical_frequency: null,
  notes: '',
}
```

**If legacy data exists:**
- UI: Ignores old detailed fields (permit_required, fire_watch_during, etc.)
- PDF: Safe access with `d.hot_work_context || {}` prevents crashes
- New data stored under `hot_work_context` key

**Migration Strategy:**
- No database migration needed
- Old data (`hot_work_detail`) remains in database but is not displayed
- New data uses `hot_work_context` field
- No data loss occurs

### PDF Rendering Safety

```typescript
const hotWorkContext = d.hot_work_context || {}; // Safe fallback
const hwFreq = norm(hotWorkContext.typical_frequency); // Safe access
const hwNotes = norm(hotWorkContext.notes); // Safe access

const hasHotWorkData = hwFreq || hwNotes; // Only renders if data present
```

## Files Modified

1. **src/components/modules/forms/FRA1FireHazardsForm.tsx**
   - Line 102-105: Changed field group from `hot_work_detail` to `hot_work_context`
   - Lines 817-872: Simplified UI section (removed 5 detailed control fields)

2. **src/lib/pdf/fra/fraSections.ts**
   - Lines 783-820: Updated data access and rendering logic
   - Changed from `hot_work_detail` to `hot_work_context`
   - Removed PDF output for detailed control fields

## Rationale

### Why Remove from Section 5?

**Section 5: Fire Hazards & Ignition Sources**
- Purpose: Identify fire triangle components (ignition, fuel, oxygen)
- Focus: What hazards exist, not how they're controlled
- Hot work is an ignition source, not a control measure

**Section 11: Fire Safety Management**
- Purpose: Capture management systems and procedural controls
- Focus: How risks are managed (permits, supervision, training)
- Hot work permits belong here alongside other PTW systems

### Clear Separation of Concerns

**Hazards Module (FRA1):**
- "We have hot work activities (monthly)"
- "Typical activities: welding in workshop"
- **What** is present as an ignition source

**Management Module (A4):**
- "Hot work permit system: Yes"
- "Fire watch during work: Yes"
- "Post-work fire watch: 60 minutes"
- **How** it's controlled

## User Experience Impact

### Before (Confusing)
- Assessor fills hot work controls in both FRA1 and A4
- Duplication leads to inconsistency
- PDF shows same info in two sections

### After (Clear)
- FRA1: Simple context (frequency, basic notes)
- A4: Detailed controls (permit, fire watch, procedures)
- PDF shows appropriate level of detail in each section
- Clear guidance in UI: "(detailed controls captured in Management Systems)"

## Testing Considerations

### Test 1: Open Existing Document with Old Data
- Expected: UI loads without errors
- Expected: Old `hot_work_detail` data ignored (not displayed)
- Expected: New section shows empty fields (typical_frequency, notes)
- Expected: PDF generates correctly (may show old data if field name overlap)

### Test 2: Fill New Context Fields
- Action: Set frequency to "Monthly"
- Action: Add note: "Welding in workshop area"
- Expected: Data saves under `hot_work_context` key
- Expected: PDF Section 5 shows context info only

### Test 3: Verify A4 Controls Still Work
- Action: Open A4 Management form
- Action: Set hot work permit to "Yes"
- Action: Fill fire watch and post-work duration
- Expected: All A4 fields work normally
- Expected: PDF Section 11.1 shows detailed controls

### Test 4: Backwards Compatibility
- Action: Open document created before this change
- Expected: No crashes
- Expected: UI loads with empty context fields
- Expected: PDF generates (may not show hot work block if no new data)

## Status

✅ **UI Deduplication:** Hot work control fields removed from FRA1
✅ **Renamed Field Group:** `hot_work_detail` → `hot_work_context`
✅ **Simplified UI:** Only frequency + notes in FRA1
✅ **PDF Updated:** Section 5 shows context only (frequency, notes)
✅ **A4 Unchanged:** Detailed controls remain in Section 11
✅ **Backwards Compatible:** Safe data access, no crashes on old data
✅ **Build:** Successful (no TypeScript errors)

## Implementation Date

February 24, 2026

---

**Scope:** Deduplication of hot work controls between Section 5 and Section 11
**Impact:** Clearer separation of hazard identification vs. control measures
**Risk:** Low (backwards compatible, A4 controls unchanged)
**Benefit:** Reduced confusion, clearer assessment structure
