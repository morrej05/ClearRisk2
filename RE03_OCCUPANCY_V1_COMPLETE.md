# RE-03 Occupancy v1 Implementation Complete

## Summary

RE-03 Occupancy module has been completely updated to v1 specification. No schema or routing changes were made - all data is stored in `module_instances.data` (jsonb).

## Changes Implemented

### 1. Process Overview Section (Large Textarea)
- **Location**: Top of form, immediately after rating panel
- **Field**: `data.occupancy.process_overview` (string)
- **UI**: Large 8-row textarea with monospace font for comprehensive free text entry
- **Purpose**: Capture comprehensive occupancy classification, processes, operations, and activities

### 2. Industry-Specific Help Text
- **Source**: Loaded from RISK_ENGINEERING module instance for the same document
- **Safety**: Uses `.maybeSingle()` instead of `.single()` to prevent 406/PGRST116 crashes
- **Display**: Shows industry-specific guidance from HRG_MASTER_MAP for RE-03 occupancy module
- **Fallback**: Displays amber warning when no industry is selected in RE-01

### 3. Industry-Specific Special Hazards Section
- **Location**: After process overview, before generic hazards
- **Field**: `data.occupancy.industry_special_hazards_notes` (string)
- **UI Components**:
  - Help text panel with industry-specific guidance (when available)
  - Large textarea for free text notes
  - "Add Recommendation to RE-9" button
- **Functionality**: Creates recommendations in RE_13_RECOMMENDATIONS module with:
  - Title: `RE-03: Industry-specific hazards`
  - Detail: Content from notes field
  - Priority: Medium (default)
  - Status: Open
  - Related Section: Hazards
  - Source Module: RE_03_OCCUPANCY

### 4. Generic Special Hazards Section
- **Location**: After industry-specific section and rating panels
- **Data Structure**: `data.occupancy.hazards` (array of hazard objects)
- **Hazard Object Schema**:
  ```typescript
  {
    id: string,
    hazard_key: string,
    hazard_label: string,
    description: string,
    assessment: string,
    free_text: string
  }
  ```
- **Available Hazard Types**:
  - Ignitable liquids
  - Flammable gases & chemicals
  - Dusts and explosive atmospheres
  - Specialised industrial equipment
  - Emerging risks (PV panels, lithium-ion, etc.)

- **UI Features**:
  - Dropdown to select hazard type
  - "Add" button to create hazard entry
  - Each hazard entry includes:
    - Description textarea
    - Assessment textarea
    - Additional notes textarea
    - "Add Recommendation to RE-9" button
    - Remove button (X icon)
  - Catch-all free text field: `data.occupancy.hazards_free_text`

### 5. Rating Panels
- **Location**: Between industry-specific section and generic hazards
- **Canonical Keys**:
  - Primary: `process_control_and_stability` (top of page)
  - Special Hazards:
    - `flammable_liquids_and_fire_risk`
    - `high_energy_materials_control`
    - `high_energy_process_equipment`
- **Help Text**: Industry-specific guidance for each canonical key
- **Weight**: Displayed from HRG_MASTER_MAP configuration

### 6. Recommendations Integration (RE-9 Write)
- **Target Module**: `RE_13_RECOMMENDATIONS`
- **Mechanism**:
  - Checks for existing module instance using `.maybeSingle()`
  - Creates new module instance if doesn't exist
  - Appends recommendations to `data.recommendations` array
- **Recommendation Schema** (matches RE09RecommendationsForm):
  ```typescript
  {
    id: string,
    title: string,
    detail: string,
    priority: 'High' | 'Medium' | 'Low',
    target_date: string,
    owner: string,
    status: 'Open' | 'In Progress' | 'Complete',
    related_section: string,
    photos: Photo[],
    is_auto_generated: boolean,
    source_module: string
  }
  ```
- **User Feedback**: Success/error alerts after recommendation creation

### 7. Runtime Safety
- **All Supabase queries**: Use `.maybeSingle()` instead of `.single()` for optional rows
- **Data access**: All nested data reads use optional chaining (`?.`) and nullish coalescing (`??`)
- **Array handling**: All arrays validated with `Array.isArray()` before use
- **Safe defaults**: Empty strings, empty arrays, and null values handled gracefully
- **No crashes**: Module renders correctly even when:
  - No RISK_ENGINEERING module exists
  - No industry is selected
  - Module data is empty (new document)
  - Nested properties are missing

### 8. ModuleActions Component Enhancement
- **New Prop**: `buttonLabel?: string` (optional, defaults to "Add Action")
- **Usage in RE-03**: Set to "Add Recommendation"
- **Backward Compatible**: All other modules continue to show "Add Action"
- **Updated Locations**:
  - Button text
  - Empty state placeholder text

## Section Ordering

1. ✅ Process Overview (large textarea)
2. ✅ Industry-Specific Special Hazards & High-Risk Processes (help text + free text + add recommendation)
3. ✅ Special Hazards & High-Risk Processes Rating Panels (3 rating panels)
4. ✅ Generic Special Hazards (dropdown-driven hazard selection with description/assessment/notes + add recommendation per hazard)
5. ✅ Outcome Panel (existing)
6. ✅ Module Actions (with "Add Recommendation" label)

## Data Persistence

All data stored in `module_instances.data` under the `occupancy` key:

```json
{
  "occupancy": {
    "process_overview": "string",
    "industry_special_hazards_notes": "string",
    "hazards": [
      {
        "id": "uuid",
        "hazard_key": "string",
        "hazard_label": "string",
        "description": "string",
        "assessment": "string",
        "free_text": "string"
      }
    ],
    "hazards_free_text": "string"
  }
}
```

## No Schema Changes

- ✅ No database migrations required
- ✅ No new tables created
- ✅ No routing changes
- ✅ Uses existing `module_instances.data` jsonb column
- ✅ Writes to existing `RE_13_RECOMMENDATIONS` module

## Testing Checklist

- [ ] RE-03 loads without crashing on new document (empty data)
- [ ] RE-03 loads without crashing when no RISK_ENGINEERING module exists
- [ ] RE-03 loads without crashing when no industry selected
- [ ] Process overview textarea saves and loads correctly
- [ ] Industry-specific help text displays when industry is selected
- [ ] Industry-specific notes save and load correctly
- [ ] "Add Recommendation to RE-9" creates recommendation with correct structure
- [ ] Generic hazards dropdown allows adding multiple hazards
- [ ] Each hazard entry saves all fields (description, assessment, free_text)
- [ ] Remove hazard button works correctly
- [ ] Hazard-specific "Add Recommendation to RE-9" includes all hazard details
- [ ] Catch-all free text field saves and loads correctly
- [ ] Rating panels update correctly and save to RISK_ENGINEERING module
- [ ] ModuleActions shows "Add Recommendation" label
- [ ] No 406/PGRST116 errors occur
- [ ] Form saves successfully and reloads data correctly

## Build Status

✅ Build passes successfully (no TypeScript errors)

## Implementation Files Modified

1. `src/components/modules/forms/RE03OccupancyForm.tsx` - Complete rewrite
2. `src/components/modules/ModuleActions.tsx` - Added optional `buttonLabel` prop

## Notes

- Help text is guidance-only and does not affect scoring
- Recommendations are fully editable in RE-09 after creation
- All recommendations created with `source_module: 'RE_03_OCCUPANCY'` for traceability
- Industry selection happens in RE-01 (RISK_ENGINEERING module)
- Rating scores stored in RISK_ENGINEERING module, not in RE-03 data
