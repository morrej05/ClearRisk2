# FRA Detail Blocks (Hot Work, Lightning, Duct Cleaning, DSEAR) - COMPLETE

## Overview

Added 4 new detail capture blocks to existing FRA modules for enhanced fire risk assessment documentation:
1. **Hot Work Controls** (detail: fire watch, post-work watch, permit system)
2. **Lightning Protection** (risk assessment and protection systems)
3. **Duct & Extract Cleaning** (ventilation systems and cleaning regimes)
4. **DSEAR Screening** (flammable substances and explosive atmospheres)

All changes are **additive only** and **fully backwards compatible**.

## Implementation Summary

### Part 1: UI Forms (Data Capture)

#### FRA1FireHazardsForm.tsx
**File:** `src/components/modules/forms/FRA1FireHazardsForm.tsx`

**New Field Groups Added to State:**

```typescript
hot_work_detail: {
  permit_required: boolean | null,
  fire_watch_during: boolean | null,
  post_work_fire_watch_required: boolean | null,
  post_work_duration_mins: number | null,
  typical_frequency: 'daily'|'weekly'|'monthly'|'rare'|null,
  notes: string
}

lightning: {
  lightning_protection_present: 'yes'|'no'|'unknown'|null,
  lightning_risk_assessment_completed: 'yes'|'no'|'unknown'|null,
  assessment_date: string | null,
  notes: string
}

duct_cleaning: {
  ducts_present: 'yes'|'no'|'unknown'|null,
  dust_grease_risk: 'low'|'medium'|'high'|'unknown'|null,
  cleaning_frequency: 'weekly'|'monthly'|'quarterly'|'annually'|'ad-hoc'|'unknown'|null,
  last_cleaned: string | null,
  notes: string
}

dsear_screen: {
  flammables_present: 'yes'|'no'|'unknown'|null,
  explosive_atmospheres_possible: 'yes'|'no'|'unknown'|null,
  dsear_assessment_status: 'completed'|'not completed'|'unknown'|null,
  assessor: string | null,
  notes: string
}
```

**UI Sections Added:**
- 4 new white card sections inserted before "Additional Hazard Notes"
- Each section has clear labels, dropdowns, conditional fields, and notes textarea
- Conditional visibility (e.g., duct cleaning details only show if ducts_present === 'yes')

#### A4ManagementControlsForm.tsx
**File:** `src/components/modules/forms/A4ManagementControlsForm.tsx`

**New Fields Added to State:**

```typescript
ptw_hot_work_fire_watch_required: boolean | null,
ptw_hot_work_post_watch_mins: number | null,
ptw_hot_work_comments: string
```

**UI Enhancement:**
- Conditional detail block appears when `ptw_hot_work === 'yes'`
- Shows fire watch requirements, post-work duration, and comments
- Appears as a bordered sub-section within the PTW section

### Part 2: PDF Output

#### Section 5: Fire Hazards (renderSection5FireHazards)
**File:** `src/lib/pdf/fra/fraSections.ts` (lines 783-854)

**New Rendering Block:**
```typescript
// Group 6: Hot work, Lightning, Duct cleaning, DSEAR (screening)
```

**Output Format:**
- Single grouped subheading: "Hot work, lightning, duct cleaning, DSEAR (screening)"
- Compact 2-column layout using existing `drawFact` helper
- Only renders if any of the 4 blocks have data
- Each sub-block (hot work, lightning, duct, DSEAR) renders its fields conditionally

**Example Output:**
```
HOT WORK, LIGHTNING, DUCT CLEANING, DSEAR (SCREENING)

Hot work permit system:             Yes
Fire watch during hot work:         Yes
Post-work fire watch:                Yes
Post-work fire watch duration:       60 minutes
Hot work frequency:                  Monthly
Hot work notes:                      [notes text]

Lightning protection present:        Yes
Lightning risk assessment:           Completed
Assessment date:                     March 2024

Extract ductwork present:            Yes
Dust/grease accumulation risk:       Medium
Duct cleaning frequency:             Quarterly
Last cleaned:                        January 2026

Flammable substances present:        Yes
Explosive atmospheres possible:      No
DSEAR assessment status:             Completed
DSEAR assessor:                      John Smith
```

#### Section 11.1: Management Systems (renderSection11Management)
**File:** `src/lib/pdf/fra/fraSections.ts` (lines 1130-1181)

**New Rendering Block:**
```typescript
// Hot work permit controls (detail) - if available
```

**Output Format:**
- Appears immediately after management systems module content
- Small subheading in grey: "Hot work permit controls (detail)"
- 2-3 line compact block using `drawKeyValueRow`
- Only renders if A4 hot work detail fields are populated

**Example Output:**
```
Hot work permit controls (detail)

Fire watch during hot work:         Yes
Post-work fire watch duration:       60 minutes
Comments:                            Permit system includes pre-work risk assessment and post-work inspection
```

## Backwards Compatibility

### Safe Data Access
All PDF rendering uses optional chaining and null-safe defaults:

```typescript
const hotWork = d.hot_work_detail || {};
const hwPermit = hotWork.permit_required === true ? 'Yes' : 
                 hotWork.permit_required === false ? 'No' : '';
```

### Empty State Handling
- Older documents without these fields: UI loads with null/empty defaults
- PDF generation: Sections don't render if no data present
- No crashes, no "undefined" errors

### Form State Initialization
```typescript
hot_work_detail: moduleInstance.data.hot_work_detail || {
  permit_required: null,
  fire_watch_during: null,
  // ... defaults
},
```

## Field Defaults

All fields default to `null` or empty string, allowing "Not stated" as a valid option:

- **Boolean fields:** `null` → displayed as "Not stated" option in dropdowns
- **String fields:** `''` → empty text input
- **Number fields:** `null` → empty number input
- **Select fields:** `null` → "Not stated" option

## UI Patterns Used

### Boolean Dropdowns
```tsx
<select
  value={formData.hot_work_detail.permit_required === null ? '' : 
         formData.hot_work_detail.permit_required ? 'yes' : 'no'}
  onChange={(e) => setFormData({
    ...formData,
    hot_work_detail: {
      ...formData.hot_work_detail,
      permit_required: e.target.value === '' ? null : e.target.value === 'yes'
    }
  })}
>
  <option value="">Not stated</option>
  <option value="yes">Yes</option>
  <option value="no">No</option>
</select>
```

### Conditional Rendering
```tsx
{formData.hot_work_detail.post_work_fire_watch_required && (
  <div>
    <label>Post-work fire watch duration (minutes)</label>
    <input type="number" ... />
  </div>
)}
```

### Nested Object Updates
```tsx
onChange={(e) => setFormData({
  ...formData,
  lightning: {
    ...formData.lightning,
    lightning_protection_present: e.target.value || null
  }
})}
```

## PDF Rendering Logic

### Title Case Formatter
```typescript
const titleCase = (s: string) =>
  s.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
```

Applied to all enum values (e.g., "weekly" → "Weekly", "unknown" → "Unknown")

### Conditional Block Rendering
```typescript
const hasHotWorkData = hwPermit || hwFireWatch || hwPostWatch || hwPostMins || hwFreq || hwNotes;

if (hasHotWorkData) {
  // render hot work block
}
```

Only renders blocks if at least one field has data.

### Key-Value Row Helper
Uses existing `drawKeyValueRow` with consistent parameters:
- Label size: 9pt (bold)
- Value size: 10pt (regular)
- Line height: 12px
- Label width: 210px (wide enough for long labels)
- Gap: 14px

## Testing Checklist

### Backwards Compatibility Tests

**Test 1: Open Older FRA Document**
- ✅ Action: Open FRA created before this change
- ✅ Expected: UI loads without errors
- ✅ Expected: New sections show with all fields as "Not stated"
- ✅ Expected: PDF generates without new blocks (no data present)

**Test 2: Save Without Filling New Fields**
- ✅ Action: Open form, change other fields, save without touching new sections
- ✅ Expected: Save succeeds
- ✅ Expected: Data preserved correctly
- ✅ Expected: PDF still doesn't show new blocks

### New Data Tests

**Test 3: Fill Hot Work Detail (FRA1)**
- Action: Fill hot work section in FRA1 form
- Values:
  - Permit required: Yes
  - Fire watch during: Yes
  - Post-work fire watch: Yes
  - Post-work duration: 60 minutes
  - Frequency: Monthly
  - Notes: "Contractor supervision required"
- Expected: All values save
- Expected: PDF Section 5 shows hot work block with all values

**Test 4: Fill Lightning Protection**
- Action: Fill lightning section
- Values:
  - Protection present: Yes
  - Risk assessment completed: Yes
  - Assessment date: "March 2024"
  - Notes: "Last tested January 2026"
- Expected: PDF shows lightning block in Section 5

**Test 5: Fill Duct Cleaning (Conditional)**
- Action: Set ducts_present to "No"
- Expected: Additional duct fields hidden
- Action: Set ducts_present to "Yes"
- Expected: Additional fields appear (risk, frequency, last cleaned)
- Action: Fill all fields
- Expected: PDF shows complete duct block

**Test 6: Fill DSEAR Screening (Conditional)**
- Action: Set flammables_present to "No" and explosive_atmospheres to "No"
- Expected: Assessment status and assessor fields hidden
- Action: Set flammables_present to "Yes"
- Expected: Assessment status and assessor fields appear
- Action: Fill all fields
- Expected: PDF shows complete DSEAR block

**Test 7: Fill A4 Hot Work Permit Detail**
- Action: Set ptw_hot_work to "No" in A4 form
- Expected: Hot work detail section hidden
- Action: Set ptw_hot_work to "Yes"
- Expected: Hot work detail section appears
- Action: Fill:
  - Fire watch required: Yes
  - Post-work duration: 60 minutes
  - Comments: "Permit includes pre-work checklist"
- Expected: PDF Section 11.1 shows hot work permit detail block

### Mixed Data Tests

**Test 8: Fill Only Some Blocks**
- Action: Fill hot work and lightning, leave duct and DSEAR empty
- Expected: PDF Section 5 shows only hot work and lightning
- Expected: No blank/empty rows for duct or DSEAR

**Test 9: Fill Only Notes Fields**
- Action: Leave enum fields as "Not stated", fill only notes
- Expected: PDF shows notes rows
- Expected: Enum fields with "Not stated" don't render

## Integration Points

### Module Keys Used
- `FRA_1_HAZARDS` - Fire hazards module (Section 5)
- `A4_MANAGEMENT_CONTROLS` - Management systems (Section 11.1)

### No New Module Keys
All fields added to existing module instances under `data` object.

### Save Logic
Uses existing `sanitizeModuleInstancePayload` from `modulePayloadSanitizer.ts` - no changes needed.

### No Action Logic Changes
- No changes to action generation
- No changes to action sorting
- No changes to action reference numbers
- No changes to evidence linking

### No Section Mapping Changes
- Hot work, lightning, duct, DSEAR render in existing Section 5
- Hot work permit detail renders in existing Section 11.1
- No new sections created

## Field Label Reference

### Hot Work Controls (FRA1)
- "Hot work permit system in place?"
- "Fire watch during hot work?"
- "Post-work fire watch required?"
- "Post-work fire watch duration (minutes)"
- "Typical frequency of hot work" → Daily/Weekly/Monthly/Rare
- "Hot work notes"

### Lightning Protection (FRA1)
- "Lightning protection present?" → Yes/No/Unknown
- "Lightning risk assessment completed?" → Yes/No/Unknown
- "Assessment date (if known)"
- "Lightning protection notes"

### Duct & Extract Cleaning (FRA1)
- "Extract ductwork present?" → Yes/No/Unknown
- "Dust / grease accumulation risk" → Low/Medium/High/Unknown (conditional)
- "Cleaning frequency" → Weekly/Monthly/Quarterly/Annually/Ad-hoc/Unknown (conditional)
- "Last cleaned (if known)" (conditional)
- "Duct cleaning notes"

### DSEAR Screening (FRA1)
- "Flammable substances present?" → Yes/No/Unknown
- "Explosive atmospheres possible?" → Yes/No/Unknown
- "DSEAR assessment status" → Completed/Not completed/Unknown (conditional)
- "Assessor / responsible person" (conditional)
- "DSEAR screening notes"

### Hot Work Permit Detail (A4)
- "Fire watch during hot work required?" → Yes/No/Not stated
- "Post-work fire watch duration (minutes)"
- "Hot work permit comments"

## Professional Presentation

### PDF Layout
- Clear subheadings in uppercase grey text
- Consistent 2-column key-value format
- Proper spacing between groups
- No orphan headings (block only renders if data present)

### UI Layout
- Clean white card sections
- Professional labels with proper capitalization
- Helper text where appropriate
- Conditional field visibility for better UX

## Files Modified

### UI Forms
1. `src/components/modules/forms/FRA1FireHazardsForm.tsx` (lines 80-130, 821-1331)
   - Added 4 new field groups to state
   - Added 4 new UI sections before "Additional Hazard Notes"

2. `src/components/modules/forms/A4ManagementControlsForm.tsx` (lines 71-73, 409-469)
   - Added 3 hot work detail fields to state
   - Added conditional detail block after ptw_hot_work field

### PDF Rendering
3. `src/lib/pdf/fra/fraSections.ts` (lines 783-854, 1130-1181)
   - Added Group 6 block in renderSection5FireHazards
   - Added hot work permit detail block in renderSection11Management

## Status

✅ **UI Forms:** 4 new detail sections added (FRA1) + 1 detail block (A4)
✅ **PDF Section 5:** Combined detail block rendering (hot work, lightning, duct, DSEAR)
✅ **PDF Section 11.1:** Hot work permit detail block rendering
✅ **Backwards Compatible:** All fields default to null, safe access patterns used
✅ **Build:** Successful (no TypeScript errors)
✅ **Ready:** For testing with new and existing FRA documents

## Implementation Date

February 24, 2026

---

**Scope:** Additive only, fully backwards compatible
**Impact:** Enhanced FRA detail capture for hot work, lightning, duct cleaning, DSEAR
**Risk:** Low (no existing logic changed)
**Test Required:** UI data entry, PDF generation, backwards compatibility
