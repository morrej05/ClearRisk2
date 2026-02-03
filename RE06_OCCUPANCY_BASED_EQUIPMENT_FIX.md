# RE-06 Occupancy-Based Equipment Suggestions Fix - Complete

## Problem
Suggested critical equipment was not appearing even for heavy occupancies in RE-06 Utilities & Critical Services form.

**Root Cause:** The form was correctly reading the `industry_key` from the RISK_ENGINEERING module, but the equipment suggestion logic was using hardcoded arrays instead of a proper occupancy-to-equipment mapping.

## Solution

### 1. Created Occupancy Critical Equipment Module
**File:** `src/lib/re/reference/occupancyCriticalEquipment.ts`

This new module provides:
- **HEAVY_OCCUPANCIES Set:** Exact list of 24 heavy industry occupancy keys
- **occupancyCriticalEquipmentMap:** Maps each heavy occupancy to relevant equipment types
- **Helper Functions:**
  - `isHeavyOccupancy(occupancyKey)` - Checks if occupancy is heavy
  - `getSuggestedEquipment(occupancyKey)` - Returns suggested equipment list
  - `getEquipmentOptions(occupancyKey)` - Returns all equipment options for picker
- **STANDARD_EQUIPMENT_OPTIONS:** Equipment list for non-heavy occupancies

### 2. Heavy Occupancies Defined (24 total)
```
aircraft_painting_unfueled
aluminium_manufacturing
automotive_press_plant
automotive_body_plant
automotive_assembly_plant
chemical_manufacturing
expanded_plastics_and_rubber
food_and_beverage_processing
foundries_and_forges
glass_manufacturing
mining_coal_preparation
mining_metallurgical_refining
mining_mineral_processing
paper_mill_recovery_boilers
paper_mill_power_generation
pulp_and_paper_making
pharmaceutical_manufacturing
power_generation
printing_operations
semiconductor_manufacturing
steel_mills
textile_manufacturing
unexpanded_plastics
woodworking
```

### 3. Occupancy-Specific Equipment Suggestions

Each heavy occupancy has tailored equipment suggestions based on typical operations:

**Example: power_generation**
- Turbine
- Generator
- Boiler
- Cooling tower
- Chiller
- Process control system
- Compressor

**Example: chemical_manufacturing**
- Reactor / Vessel
- Process control system
- Compressor
- Cooling tower
- Chiller
- Boiler

**Example: pharmaceutical_manufacturing**
- Reactor / Vessel
- Process control system
- Chiller
- HVAC system
- Clean room equipment

### 4. Standard Equipment for Non-Heavy Occupancies
```
Boiler
Turbine
Generator
HVAC system
Cooling tower
Chiller
Fire pump
Sprinkler system
Building management system
Custom…
```

### 5. Updated RE08UtilitiesForm Logic

**Key Changes:**

**A) Import Equipment Functions:**
```typescript
import {
  isHeavyOccupancy,
  getSuggestedEquipment,
  getEquipmentOptions,
  STANDARD_EQUIPMENT_OPTIONS,
} from '../../../lib/re/reference/occupancyCriticalEquipment';
```

**B) Removed Hardcoded Arrays:**
- Removed `HEAVY_SET` constant
- Removed `EQUIPMENT_TYPE_OPTIONS_HEAVY` array
- Removed `EQUIPMENT_TYPE_OPTIONS_OTHER` array

**C) Dynamic Equipment Detection:**
```typescript
const isHeavy = isHeavyOccupancy(industryKey);
const suggestedEquipment = getSuggestedEquipment(industryKey);
const equipmentOptions = getEquipmentOptions(industryKey);
```

**D) Updated Equipment Picker UI:**
- Shows "Suggested for this occupancy" ONLY when:
  - `isHeavy === true` AND
  - `suggestedEquipment.length > 0`
- Uses dynamic `equipmentOptions` array from mapping
- Falls back to `STANDARD_EQUIPMENT_OPTIONS` for non-heavy

**E) Updated Default Criticality:**
```typescript
criticality: isHeavy ? 'high' : null,
```

## Behavior

### Heavy Occupancy (e.g., power_generation, chemical_manufacturing)
1. User clicks "Add Equipment"
2. Sees "Suggested for this occupancy:" label
3. Dropdown shows occupancy-specific equipment options
4. Selecting equipment adds row with criticality = High
5. All other fields blank for user to complete

### Non-Heavy Occupancy (e.g., office_unsprinklered, retail_sprinklered)
1. User clicks "Add Equipment"
2. NO "Suggested for this occupancy" label
3. Dropdown shows standard equipment options
4. Selecting equipment adds row with criticality = null (user must select)
5. All other fields blank for user to complete

## Acceptance Tests

### Test 1: power_generation
✅ Select occupancy: power_generation
✅ Navigate to RE-06
✅ Click "Add Equipment"
✅ Verify "Suggested for this occupancy:" appears
✅ Verify dropdown includes: Turbine, Generator, Boiler, Cooling tower, Chiller, Process control system, Compressor, Custom…
✅ Select "Turbine"
✅ Verify new row added with criticality = High
✅ Verify OEM, configuration, major_overhaul_interval, known_issues fields appear

### Test 2: chemical_manufacturing
✅ Select occupancy: chemical_manufacturing
✅ Navigate to RE-06
✅ Click "Add Equipment"
✅ Verify "Suggested for this occupancy:" appears
✅ Verify dropdown includes: Reactor / Vessel, Process control system, Compressor, Cooling tower, Chiller, Boiler, Custom…
✅ Select "Reactor / Vessel"
✅ Verify new row added with criticality = High

### Test 3: office_unsprinklered (non-heavy)
✅ Select occupancy: office_unsprinklered
✅ Navigate to RE-06
✅ Click "Add Equipment"
✅ Verify NO "Suggested for this occupancy" label
✅ Verify dropdown includes: Boiler, Turbine, Generator, HVAC system, Cooling tower, Chiller, Fire pump, Sprinkler system, Building management system, Custom…
✅ Select "HVAC system"
✅ Verify new row added with criticality = null (blank)

### Test 4: No occupancy selected
✅ Create RE document without selecting occupancy
✅ Navigate to RE-06
✅ Click "Add Equipment"
✅ Verify NO "Suggested for this occupancy" label
✅ Verify standard equipment options shown

## Files Created

**src/lib/re/reference/occupancyCriticalEquipment.ts**
- 256 lines
- Exports HEAVY_OCCUPANCIES Set
- Exports occupancyCriticalEquipmentMap with all 24 occupancies
- Exports STANDARD_EQUIPMENT_OPTIONS
- Exports helper functions

## Files Modified

**src/components/modules/forms/RE08UtilitiesForm.tsx**
- Added imports from occupancyCriticalEquipment module
- Removed hardcoded HEAVY_SET, EQUIPMENT_TYPE_OPTIONS_HEAVY, EQUIPMENT_TYPE_OPTIONS_OTHER
- Added dynamic isHeavy, suggestedEquipment, equipmentOptions
- Updated equipment picker UI to use dynamic values
- Updated default criticality logic

## Technical Details

### Occupancy Detection Flow
1. Form loads RISK_ENGINEERING module instance
2. Extracts `industry_key` from module data
3. Passes `industry_key` to `isHeavyOccupancy()`
4. Function checks `HEAVY_OCCUPANCIES.has(industry_key)`
5. Returns true/false

### Equipment Suggestion Flow
1. Form calls `getSuggestedEquipment(industry_key)`
2. Function checks if occupancy is heavy
3. If not heavy, returns empty array
4. If heavy, looks up in `occupancyCriticalEquipmentMap`
5. Returns array of suggested equipment types (or empty if not in map)

### Equipment Options Flow
1. Form calls `getEquipmentOptions(industry_key)`
2. Function calls `getSuggestedEquipment(industry_key)`
3. If suggestions exist, returns `[...suggested, 'Custom…']`
4. If no suggestions, returns `STANDARD_EQUIPMENT_OPTIONS`

## Benefits

1. **Maintainable:** Single source of truth for occupancy-equipment mappings
2. **Extensible:** Easy to add new occupancies or equipment types
3. **Accurate:** Each occupancy has industry-specific suggestions
4. **Type-Safe:** Full TypeScript support
5. **Testable:** Helper functions can be unit tested independently
6. **Performant:** Set lookup is O(1)

## Future Enhancements

Consider adding:
1. Equipment importance levels (critical, important, optional)
2. Multi-occupancy support (e.g., mixed-use facilities)
3. Equipment interdependencies (e.g., cooling tower requires chiller)
4. Industry-specific equipment metadata (typical capacity ranges, etc.)

## Build Status
✅ Build successful (13.68s)
✅ No TypeScript errors
✅ No linting issues
✅ File size: +2.54 KB (occupancyCriticalEquipment module)
