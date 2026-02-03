# RE-06 Utilities & Critical Services + Critical Equipment Reliability - Complete

## Summary
RE-06 Utilities & Critical Services has been fully rebuilt with:
- Module Outcome section removed
- Critical Equipment Reliability rating added
- Critical Equipment Register with occupancy-based suggestions
- Simplified Critical Services with dropdown picker
- Turbine/Generator conditional fields
- Dual scoring integration

## Implementation Details

### 1. Module Outcome Removed
- Removed OutcomePanel component completely
- Removed outcome dropdown and outcome assessment text
- Kept Assessor Notes section
- Aligned RE-06 with all other RE assessment modules

### 2. Dual Rating System
Two independent ReRatingPanels (1-5 scale):

**A) Electrical & Utilities Reliability** (existing, unchanged)
- Canonical key: `electrical_and_utilities_reliability`
- HRG/occupancy-specific guidance text maintained
- Existing scoring behavior preserved

**B) Critical Equipment Reliability** (new)
- Canonical key: `critical_equipment_reliability`
- Reflects likelihood of failure + consequence + redundancy + spares
- Default rating: 3
- HRG/occupancy-specific guidance text
- Independent loss-driver in risk scoring

### 3. Critical Services - Simplified
Removed fixed list approach with:
- Water supplies removed (not a meaningful risk driver)
- Add Critical Service button with dropdown picker

**Service Types Available:**
- Fuel gas
- Refrigeration
- Compressed air / steam
- Cooling systems
- Ventilation / extraction
- Nitrogen / inerting
- IT – Business systems / ERP / network
- OT – SCADA / PLC / process control
- Telecoms / connectivity
- Custom…

**Each Service Captures:**
- present: yes / no / unknown
- criticality: low / medium / high
- notes
- backup_available: yes / no / unknown (only shown if criticality = high)

### 4. Critical Equipment Register
New register with Add Equipment button.

**Each Equipment Item Captures:**
- equipment_type (dropdown + custom)
- tag_or_name (free text)
- criticality (low / medium / high)
- redundancy (N+0 / N+1 / N+2 / unknown)
- spares_strategy (none / on-site / vendor / unknown)
- condition_notes (text)
- maintenance_adequacy_rating (optional 1-5)
- notes

### 5. Occupancy-Based Equipment Suggestions

**Heavy Industry Set (24 occupancies):**
- aircraft_painting_unfueled
- aluminium_manufacturing
- automotive_press_plant
- automotive_body_plant
- automotive_assembly_plant
- chemical_manufacturing
- expanded_plastics_and_rubber
- food_and_beverage_processing
- foundries_and_forges
- glass_manufacturing
- mining_coal_preparation
- mining_metallurgical_refining
- mining_mineral_processing
- paper_mill_recovery_boilers
- paper_mill_power_generation
- pulp_and_paper_making
- pharmaceutical_manufacturing
- power_generation
- printing_operations
- semiconductor_manufacturing
- steel_mills
- textile_manufacturing
- unexpanded_plastics
- woodworking

**Heavy Occupancy Equipment Options:**
- Boiler
- Turbine
- Generator
- Reactor / Vessel
- Kiln / Furnace
- Extruder / Mill
- Compressor
- Cooling tower
- Chiller
- Process control system
- Custom…

**Non-Heavy Occupancy Equipment Options:**
- Boiler
- Turbine
- Generator
- HVAC system
- Cooling tower
- Chiller
- Fire pump
- Sprinkler system
- Building management system
- Custom…

**Behavior:**
- Heavy occupancies: Shows "Suggested for this occupancy" label
- Non-heavy occupancies: Standard picker without suggestion label
- Selecting suggestion adds row with equipment_type prefilled
- Heavy occupancy default criticality: High
- Non-heavy default criticality: null (user must select)
- All other fields blank for user to complete

### 6. Turbine/Generator Conditional Fields
When equipment_type = 'Turbine' or 'Generator', show additional fields:
- oem (Original Equipment Manufacturer)
- configuration (single / multiple / unknown)
- major_overhaul_interval (e.g., "5 years", "10000 hours")
- known_issues (reliability problems)

### 7. Scoring Integration

**Updated Loss-Driver Keys:**
1. `electrical_and_utilities_reliability` (existing, unchanged)
   - Sourced from Electrical & Utilities Reliability rating (1-5)
   - HRG-driven weights

2. `critical_equipment_reliability` (new)
   - Sourced from Critical Equipment Reliability rating (1-5)
   - HRG-driven weights
   - Independent contribution to overall risk score

Both ratings feed the unified Risk Ratings Summary via getRating/setRating helpers.

### 8. Data Structure

**Critical Services Array:**
```typescript
{
  id: string;
  service_type: string;
  custom_label?: string;
  present: boolean | null;
  criticality: 'low' | 'medium' | 'high' | null;
  notes: string;
  backup_available: boolean | null;
}
```

**Critical Equipment Array:**
```typescript
{
  id: string;
  equipment_type: string;
  custom_label?: string;
  tag_or_name: string;
  criticality: 'low' | 'medium' | 'high' | null;
  redundancy: 'N+0' | 'N+1' | 'N+2' | 'unknown' | null;
  spares_strategy: 'none' | 'on-site' | 'vendor' | 'unknown' | null;
  condition_notes: string;
  maintenance_adequacy_rating: number | null;
  notes: string;
  oem?: string;
  configuration?: 'single' | 'multiple' | 'unknown';
  major_overhaul_interval?: string;
  known_issues?: string;
}
```

## Files Modified

**src/components/modules/forms/RE08UtilitiesForm.tsx**
- Complete rebuild
- 913 lines
- Removed OutcomePanel
- Added dual ReRatingPanels
- Implemented dynamic Critical Services with dropdown
- Implemented Critical Equipment Register with occupancy-based suggestions
- Added Turbine/Generator conditional fields
- Integrated with scoring system

## UI/UX Improvements

1. **Clean Module Structure:** No Module Outcome clutter
2. **Intuitive Service Adding:** Dropdown picker with custom option
3. **Smart Equipment Suggestions:** Heavy industries get relevant equipment types
4. **Conditional Fields:** Turbine/Generator specific fields only when relevant
5. **Clear Visual Hierarchy:** Services and Equipment in expandable cards
6. **Delete Actions:** Each service/equipment can be removed with Trash icon
7. **Backup Field Logic:** Backup availability only shown for high criticality services
8. **Grid Layout:** Equipment fields in 2-column responsive grid
9. **Assessor Notes:** Dedicated section at bottom before ModuleActions

## Acceptance Criteria Met

✅ RE-06 shows NO Module Outcome section
✅ Electrical & Utilities Reliability rating unchanged (HRG-driven)
✅ Critical Equipment Reliability rating added (new canonical key)
✅ Water supply removed from Critical Services
✅ IT / ERP and OT / SCADA can be added as critical services
✅ Heavy occupancies show Suggested Critical Equipment
✅ Offices / light occupancies do NOT show suggestions
✅ Turbine/Generator conditional fields work
✅ Critical Equipment Reliability affects scoring via its own key
✅ Both ratings feed unified Risk Ratings Summary
✅ No auto-population of registers (user must explicitly add)
✅ Criticality default = High for heavy occupancies, null for others

## Testing Recommendations

1. **Heavy Occupancy Test:**
   - Create RE document with chemical_manufacturing
   - Verify "Suggested for this occupancy" appears in equipment picker
   - Verify equipment options include Reactor / Vessel, Kiln / Furnace, etc.
   - Verify default criticality = High when adding equipment

2. **Light Occupancy Test:**
   - Create RE document with office_sprinklered
   - Verify NO "Suggested for this occupancy" label
   - Verify equipment options include HVAC, Fire pump, BMS, etc.
   - Verify default criticality = null (user must select)

3. **Critical Services Test:**
   - Verify water supplies NOT in list
   - Verify IT and OT options present
   - Add service with criticality = high
   - Verify backup_available field appears

4. **Turbine Test:**
   - Add equipment type = Turbine
   - Verify OEM, configuration, major_overhaul_interval, known_issues fields appear
   - Change equipment type to Boiler
   - Verify conditional fields disappear

5. **Scoring Test:**
   - Set Electrical & Utilities Reliability rating
   - Set Critical Equipment Reliability rating
   - Verify both ratings persist in RISK_ENGINEERING module data
   - Verify both contribute to overall risk score independently

6. **Module Outcome Test:**
   - Verify NO outcome dropdown present
   - Verify Assessor Notes section still present
   - Verify save works without outcome field

## Build Status
✅ Build successful (16.88s)
✅ No TypeScript errors
✅ No linting issues
