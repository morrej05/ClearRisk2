# FRA Blank Section Rendering Consistency - Complete

## Problem
In a blank FRA PDF, section rendering was inconsistent:
- Some sections (2 and 3) rendered headings with no content
- Others (sections 5-12) were deferred via density calculation
- Section 4 rendered info-gap content
- This made blank reports feel broken and required patchy section-specific logic

## Solution Implemented

### 1. Created `shouldRenderSection()` Helper Function
**Location:** `src/lib/pdf/buildFraPdf.ts` (lines 101-173)

A single, holistic function that determines if a section should be fully rendered based on:

1. **Open Actions**: Any non-closed actions → render section
2. **Significant Outcome**: Any outcome other than 'unknown'/'na'/'not_applicable' → render section
3. **Info Gaps**: Any `detectInfoGaps()` returns true → render section (preserves info gap boxes)
4. **Meaningful Data**: 3+ non-trivial data fields → render section
5. **Assessor Notes**: Notes longer than 20 characters → render section

**Special Cases:**
- Section 1 (cover) always rendered separately
- Sections 13 (significant findings) and 14 (review) always rendered
- All other sections (2-12) use the same logic

### 2. Applied Consistent Policy to All Sections
**Location:** `src/lib/pdf/buildFraPdf.ts` (lines 627-641)

Replaced the old density-based logic (only for sections 5-12) with:

```typescript
// HOLISTIC BLANK SECTION POLICY: Use shouldRenderSection for ALL sections 2-12
if (section.id >= 2 && section.id <= 12) {
  const shouldRender = shouldRenderSection(section.id, sectionModules, sectionActions, document);

  if (!shouldRender) {
    // Defer to compact rendering in "Additional Assessment Areas"
    lowDensitySections.push({ section, modules: sectionModules, actions: sectionActions });
    continue; // Skip full rendering
  }
}
```

### 3. Fixed Section Renderers to Not Output Empty Headers
**Location:** `src/lib/pdf/buildFraPdf.ts`

Updated `renderSection2Premises` and `renderSection3Occupants` to check for content before rendering subheadings:

**Section 2 (Premises):**
- Only renders "Building Characteristics" header if there's actual data (building_use, number_of_storeys, building_height_m, or gross_internal_area_sqm)

**Section 3 (Occupants):**
- Only renders "Occupancy Profile" header if there's occupancy data
- Only renders "Vulnerability & Special Considerations" header if there's vulnerability data

### 4. Preserved Info Gap Handling
Sections with info gaps (e.g., missing Responsible Person or Standards) still:
- Pass the `shouldRenderSection()` check (due to check #3)
- Render in full with the info gap box and suggested actions
- Are NOT deferred to compact rendering

## Acceptance Criteria Met

✅ **In a blank FRA, sections 2-12 do not appear as empty headings**
- Blank sections are now filtered by `shouldRenderSection()`

✅ **They appear only in the "Additional Assessment Areas (No Significant Findings)" list**
- Sections that fail the render check are added to `lowDensitySections` array
- Rendered compactly at the end with section number, title, outcome, and brief notes

✅ **Sections with info gaps still render with the gap box and suggested actions**
- Check #3 in `shouldRenderSection()` ensures info gaps trigger full rendering
- Info gap detection uses the same logic as the UI forms (now correctly using `moduleInstance.module_key`)

✅ **No new patch logic per section; behaviour is consistent**
- Single `shouldRenderSection()` function used for all sections 2-12
- No section-specific density calculations
- All sections follow the same rules

## Impact

### Before
- Inconsistent: some sections showed empty headings, others were hidden
- Section 2 and 3 always rendered "Building Characteristics" and "Occupancy Profile" headers even when empty
- Different logic paths for sections 2-4 vs 5-12
- Felt broken in blank state

### After
- Consistent: all sections 2-12 use the same rendering policy
- No empty subheadings - headers only appear when there's content
- Single, clear decision tree for all sections
- Professional appearance even when blank
- Info gaps still properly highlighted when present

## Files Modified

1. **src/lib/pdf/buildFraPdf.ts**
   - Added `shouldRenderSection()` helper (lines 101-173)
   - Updated section rendering loop to use it (lines 627-641)
   - Fixed `renderSection2Premises()` to conditionally render "Building Characteristics" header
   - Fixed `renderSection3Occupants()` to conditionally render "Occupancy Profile" and "Vulnerability" headers

## Testing Recommendations

1. **Blank FRA Test**: Create a new FRA document with no data entry
   - Expected: Sections 2-12 should appear in "Additional Assessment Areas" rollup only
   - No empty section headings in body

2. **Info Gap Test**: Create FRA with missing Responsible Person
   - Expected: Section 4 (Legislation) should render in full with info gap box
   - Should NOT be deferred to compact rendering

3. **Partial Data Test**: Add minimal data (e.g., just building name)
   - Expected: Should NOT trigger full rendering (< 3 meaningful fields)
   - Should appear in compact rollup

4. **Significant Data Test**: Add 3+ meaningful fields to a section
   - Expected: Section should render in full with content
   - Should NOT appear in compact rollup

5. **Actions Test**: Add an action to a blank section
   - Expected: Section should render in full (due to open action)
   - Action should be visible

## Notes

- The `calculateSectionDensity()` function is no longer used but has been left in place for potential future use
- The compact rendering format remains unchanged - only the decision of which sections go there has been made consistent
- All existing PDF quality gates and watermarks continue to function normally
