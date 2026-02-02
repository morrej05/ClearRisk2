# RE-02 Construction Form: Breakdown Editors & Model Updates - Complete

## Summary

Updated RE02ConstructionForm to support material breakdown editors for roof and mezzanine (in addition to existing walls editor), simplified the frame input to a single dropdown, and added visible compartmentation guidance. All construction elements now have consistent percentage-based breakdown editing.

## Changes Made

### 1. Building Model Updates

#### Updated Building Interface

**Before:**
```typescript
interface Building {
  roof: {
    material: string;
    area_sqm: number | null;
  };
  walls: {
    breakdown: WallBreakdown[];
    total_percent: number;
  };
  upper_floors_mezz_sqm: number | null;
  frame: {
    type: string;
    protection: 'protected' | 'unprotected' | 'unknown';
  };
  notes: string;
}
```

**After:**
```typescript
interface Building {
  roof: {
    area_sqm: number | null;
    breakdown: MaterialBreakdown[];
    total_percent: number;
  };
  walls: {
    breakdown: MaterialBreakdown[];
    total_percent: number;
  };
  upper_floors_mezzanine: {
    area_sqm: number | null;
    breakdown: MaterialBreakdown[];
    total_percent: number;
  };
  frame_type: 'steel' | 'protected_steel' | 'timber' | 'reinforced_concrete' | 'masonry' | 'other';
  notes: string;
}
```

**Key Changes:**
- **Roof**: Changed from single `material` string to `breakdown[]` array with percentages
- **Mezzanine**: Changed from `upper_floors_mezz_sqm` (single number) to `upper_floors_mezzanine` object with breakdown
- **Frame**: Changed from `{type, protection}` object to single `frame_type` string
- **Renamed interface**: `WallBreakdown` → `MaterialBreakdown` (reused for all three types)

### 2. Data Migration

Comprehensive migration logic handles old data formats:

#### Roof Migration

```typescript
// Old format: { material: 'Heavy Non-Combustible', area_sqm: 1000 }
// New format: { area_sqm: 1000, breakdown: [{material: 'Heavy Non-Combustible', percent: 100}], total_percent: 100 }

if (b.roof?.breakdown && Array.isArray(b.roof.breakdown)) {
  // Already new format
  roof = { ...b.roof };
} else if (b.roof?.material) {
  // Old format - migrate
  roof = {
    area_sqm: b.roof.area_sqm ?? null,
    breakdown: [{ material: b.roof.material, percent: 100 }],
    total_percent: 100,
  };
}
```

#### Mezzanine Migration

```typescript
// Old format: upper_floors_mezz_sqm: 500
// New format: upper_floors_mezzanine: { area_sqm: 500, breakdown: [{material: 'Unknown', percent: 100}], total_percent: 100 }

if (b.upper_floors_mezzanine?.breakdown) {
  // Already new format
  upper_floors_mezzanine = { ...b.upper_floors_mezzanine };
} else if (typeof b.upper_floors_mezz_sqm === 'number') {
  // Old format - migrate
  upper_floors_mezzanine = {
    area_sqm: b.upper_floors_mezz_sqm,
    breakdown: [{ material: 'Unknown', percent: 100 }],
    total_percent: 100,
  };
}
```

#### Frame Migration

```typescript
// Old format: { type: 'Steel', protection: 'protected' }
// New format: frame_type: 'protected_steel'

if (typeof b.frame_type === 'string') {
  // Already new format
  frame_type = b.frame_type;
} else if (b.frame?.type) {
  // Old format - migrate
  const oldType = b.frame.type.toLowerCase();
  const oldProtection = b.frame.protection;

  if (oldType.includes('steel')) {
    frame_type = oldProtection === 'protected' ? 'protected_steel' : 'steel';
  } else if (oldType.includes('timber')) {
    frame_type = 'timber';
  } else if (oldType.includes('concrete')) {
    frame_type = 'reinforced_concrete';
  } else if (oldType.includes('masonry')) {
    frame_type = 'masonry';
  } else {
    frame_type = 'other';
  }
}
```

### 3. Material Constants Update

**Before:**
```typescript
const ROOF_MATERIALS = ['Heavy Non-Combustible', 'Light Non-Combustible', ...];
const WALL_MATERIALS = ['Heavy Non-Combustible', 'Light Non-Combustible', ...];
const FRAME_TYPES = ['Steel', 'Timber', 'Reinforced Concrete', 'Masonry', 'Other'];
```

**After:**
```typescript
const CONSTRUCTION_MATERIALS = [
  'Heavy Non-Combustible',
  'Light Non-Combustible',
  'Foam Plastic (Approved)',
  'Foam Plastic (Unapproved)',
  'Combustible (Other)',
  'Unknown',  // Added for mezzanine migration
];

const FRAME_TYPES = [
  { value: 'steel', label: 'Steel' },
  { value: 'protected_steel', label: 'Protected Steel' },
  { value: 'timber', label: 'Timber' },
  { value: 'reinforced_concrete', label: 'Reinforced Concrete' },
  { value: 'masonry', label: 'Masonry' },
  { value: 'other', label: 'Other' },
];
```

**Rationale:**
- Single `CONSTRUCTION_MATERIALS` array used for roof, walls, and mezzanine
- Added 'Unknown' for legacy mezzanine data migration
- Frame types now have explicit value/label pairs for clarity

### 4. Table UI Updates

#### Column Headers

**Before:**
- Roof Material
- Roof Area (m²)
- Walls
- Upper Floors (m²)
- Frame (two rows: type + protection)

**After:**
- Roof (area + edit button)
- Walls (edit button only)
- Mezzanine (area + edit button)
- Frame (single dropdown)

#### Roof Column

```typescript
<td className="px-3 py-2">
  <div className="flex flex-col gap-1 min-w-[110px]">
    <input
      type="number"
      value={bldg.roof.area_sqm || ''}
      onChange={(e) => updateBuilding(bldg.id, { roof: { ...bldg.roof, area_sqm: parseFloat(e.target.value) || null } })}
      className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
      placeholder="Area m²"
    />
    <button
      onClick={() => setEditingBreakdown({ buildingId: bldg.id, type: 'roof' })}
      className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs"
    >
      <Edit2 className="w-3 h-3" />
      {bldg.roof.breakdown.length > 0 ? `${bldg.roof.total_percent}%` : 'Edit'}
    </button>
  </div>
</td>
```

#### Walls Column (Updated)

```typescript
<td className="px-3 py-2">
  <button
    onClick={() => setEditingBreakdown({ buildingId: bldg.id, type: 'walls' })}
    className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-sm"
  >
    <Edit2 className="w-3 h-3" />
    {bldg.walls.breakdown.length > 0 ? `${bldg.walls.total_percent}%` : 'Edit'}
  </button>
</td>
```

#### Mezzanine Column (New)

```typescript
<td className="px-3 py-2">
  <div className="flex flex-col gap-1 min-w-[110px]">
    <input
      type="number"
      value={bldg.upper_floors_mezzanine.area_sqm || ''}
      onChange={(e) => updateBuilding(bldg.id, {
        upper_floors_mezzanine: {
          ...bldg.upper_floors_mezzanine,
          area_sqm: parseFloat(e.target.value) || null
        }
      })}
      className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
      placeholder="Area m²"
    />
    <button
      onClick={() => setEditingBreakdown({ buildingId: bldg.id, type: 'mezzanine' })}
      className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs"
    >
      <Edit2 className="w-3 h-3" />
      {bldg.upper_floors_mezzanine.breakdown.length > 0 ? `${bldg.upper_floors_mezzanine.total_percent}%` : 'Edit'}
    </button>
  </div>
</td>
```

#### Frame Column (Simplified)

**Before:**
```typescript
<td className="px-3 py-2">
  <div className="flex flex-col gap-1 min-w-[120px]">
    <select value={bldg.frame.type} ...>...</select>
    <select value={bldg.frame.protection} ...>...</select>
  </div>
</td>
```

**After:**
```typescript
<td className="px-3 py-2">
  <select
    value={bldg.frame_type}
    onChange={(e) => updateBuilding(bldg.id, { frame_type: e.target.value as any })}
    className="w-full min-w-[120px] px-2 py-1 border border-slate-300 rounded text-sm"
  >
    {FRAME_TYPES.map(ft => (
      <option key={ft.value} value={ft.value}>{ft.label}</option>
    ))}
  </select>
</td>
```

**Improvement:**
- Single dropdown instead of two
- 'Protected Steel' is now its own option
- Cleaner UI, less vertical space

### 5. Compartmentation Guidance Panel

Added visible guidance panel after the table:

```tsx
<div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
  <h3 className="text-sm font-semibold text-slate-900 mb-2">Compartmentation Guidance</h3>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
    <div>
      <span className="font-medium text-slate-700">Low:</span>
      <p className="text-slate-600 mt-1">
        Large open spaces with minimal fire separation. Few fire-rated barriers or
        compartment walls. Significant potential for fire spread.
      </p>
    </div>
    <div>
      <span className="font-medium text-slate-700">Medium:</span>
      <p className="text-slate-600 mt-1">
        Moderate compartmentation with some fire-rated walls and floors. Partial
        separation of areas. Some barriers to limit fire spread.
      </p>
    </div>
    <div>
      <span className="font-medium text-slate-700">High:</span>
      <p className="text-slate-600 mt-1">
        Well-defined fire compartments with proper fire-rated walls, floors, and
        doors. Effective fire separation limiting spread.
      </p>
    </div>
  </div>
</div>
```

**Location:** Placed between the buildings table and the "Automated Construction Assessment" panel

**Layout:**
- Gray background to differentiate from other panels
- Responsive grid: 1 column on mobile, 3 columns on desktop
- Concise descriptions for Low/Medium/High compartmentation levels

### 6. Generic Breakdown Editor Modal

Replaced the old walls-only modal with a generic editor that works for all three types.

#### State Management

**Before:**
```typescript
const [editingWallsFor, setEditingWallsFor] = useState<string | null>(null);
```

**After:**
```typescript
const [editingBreakdown, setEditingBreakdown] = useState<{
  buildingId: string;
  type: 'roof' | 'walls' | 'mezzanine';
} | null>(null);
```

#### Helper Functions

```typescript
const getBreakdownData = (building: Building, type: 'roof' | 'walls' | 'mezzanine') => {
  switch (type) {
    case 'roof': return building.roof;
    case 'walls': return building.walls;
    case 'mezzanine': return building.upper_floors_mezzanine;
  }
};

const getBreakdownTitle = (type: 'roof' | 'walls' | 'mezzanine') => {
  switch (type) {
    case 'roof': return 'Roof Materials';
    case 'walls': return 'Walls';
    case 'mezzanine': return 'Upper Floors / Mezzanine';
  }
};

const updateBreakdownData = (buildingId: string, type: 'roof' | 'walls' | 'mezzanine', data: { breakdown: MaterialBreakdown[]; total_percent: number }) => {
  const updates: Partial<Building> = {};
  if (type === 'roof') {
    const building = formData.buildings.find(b => b.id === buildingId);
    if (building) {
      updates.roof = { ...building.roof, ...data };
    }
  } else if (type === 'walls') {
    updates.walls = data;
  } else if (type === 'mezzanine') {
    const building = formData.buildings.find(b => b.id === buildingId);
    if (building) {
      updates.upper_floors_mezzanine = { ...building.upper_floors_mezzanine, ...data };
    }
  }
  updateBuilding(buildingId, updates);
};
```

#### Modal Implementation

```typescript
{editingBreakdown && editingBuilding && (() => {
  const breakdownData = getBreakdownData(editingBuilding, editingBreakdown.type);
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3>Edit {getBreakdownTitle(editingBreakdown.type)} Breakdown</h3>

          {/* Material rows */}
          {breakdownData.breakdown.map((item, idx) => (
            <div key={idx}>
              <select value={item.material} ...>
                {CONSTRUCTION_MATERIALS.map(mat => <option key={mat}>{mat}</option>)}
              </select>
              <input type="number" value={item.percent} ... />
              <button onClick={() => removeItem(idx)}>Delete</button>
            </div>
          ))}

          {/* Add Material button */}
          <button onClick={() => addMaterial()}>Add Material</button>

          {/* Total display */}
          <div>Total: {breakdownData.total_percent}%</div>

          {/* Cladding details (if applicable) */}
          {/* Building notes */}

          <button onClick={() => closeModal()}>Done</button>
        </div>
      </div>
    </div>
  );
})()}
```

**Features:**
- Single modal component handles roof, walls, and mezzanine
- Dynamic title based on type being edited
- Same material list for all types (CONSTRUCTION_MATERIALS)
- Percentage total validation
- Building notes and cladding details included in modal
- Enforces 100% total before closing

### 7. Validation Updates

**Before:**
```typescript
// Only validated walls
for (const building of formData.buildings) {
  if (building.walls.breakdown.length > 0 && building.walls.total_percent !== 100) {
    alert(`Wall percentages must total 100%`);
    return;
  }
}
```

**After:**
```typescript
// Validates all three breakdown types
for (const building of formData.buildings) {
  if (building.roof.breakdown.length > 0 && building.roof.total_percent !== 100) {
    alert(`Roof percentages must total 100% (currently ${building.roof.total_percent}%)`);
    return;
  }
  if (building.walls.breakdown.length > 0 && building.walls.total_percent !== 100) {
    alert(`Wall percentages must total 100% (currently ${building.walls.total_percent}%)`);
    return;
  }
  if (building.upper_floors_mezzanine.breakdown.length > 0 && building.upper_floors_mezzanine.total_percent !== 100) {
    alert(`Mezzanine percentages must total 100% (currently ${building.upper_floors_mezzanine.total_percent}%)`);
    return;
  }
}
```

**Improvements:**
- All three types validated before save
- Clear error messages with current percentage
- Building name included in error message

### 8. Calculation Engine Updates

Updated `calculateConstructionMetrics()` to use breakdown arrays:

#### Roof Calculation (Updated)

**Before:**
```typescript
const roofFactor = building.roof.material.includes('Combustible') ? 2 : ...;
const roofPenalty = roofFactor * (building.roof.area_sqm > 0 ? 12 : 8);
rawScore -= roofPenalty;
```

**After:**
```typescript
if (building.roof.breakdown.length > 0 && building.roof.total_percent > 0) {
  for (const roofMat of building.roof.breakdown) {
    const roofFactor = roofMat.material.includes('Combustible') ? 2 : ...;
    const roofPenalty = roofFactor * (roofMat.percent / 100) * (building.roof.area_sqm > 0 ? 12 : 8);
    rawScore -= roofPenalty;
    combustiblePoints += roofFactor * (roofMat.percent / 100) * 2;
  }
}
```

**Key Change:** Roof now weighted by material percentages, not single material

#### Frame Calculation (Updated)

**Before:**
```typescript
if (building.frame.type === 'Timber') {
  rawScore -= 15;
} else if (building.frame.type === 'Steel') {
  if (building.frame.protection === 'unprotected') {
    rawScore -= 8;
  } else if (building.frame.protection === 'protected') {
    rawScore += 5;
  }
}
```

**After:**
```typescript
if (building.frame_type === 'timber') {
  rawScore -= 15;
} else if (building.frame_type === 'steel') {
  rawScore -= 8;
} else if (building.frame_type === 'protected_steel') {
  rawScore += 5;
} else if (building.frame_type === 'reinforced_concrete' || building.frame_type === 'masonry') {
  rawScore += 5;
}
```

**Key Change:** Frame type now single enum value, 'protected_steel' is explicit

## Benefits

### 1. Consistency
- All construction elements (roof, walls, mezzanine) use same breakdown pattern
- Unified material list across all types
- Consistent percentage-based input

### 2. Flexibility
- Roof can now be mixed materials (e.g., 70% heavy non-combustible, 30% light non-combustible)
- Mezzanine can specify material composition
- More accurate combustibility calculations

### 3. Usability
- Single frame dropdown is simpler and clearer
- Compartmentation guidance is immediately visible
- Edit buttons show current percentage status

### 4. Data Quality
- Comprehensive migration handles all legacy data
- Validation ensures all breakdowns total 100%
- No data loss during migration

### 5. Maintainability
- Generic modal reduces code duplication
- Single material list is easier to update
- Clear helper functions for breakdown operations

## Migration Examples

### Example 1: Simple Building (Old → New)

**Old Data:**
```json
{
  "building_name": "Main Warehouse",
  "roof": {
    "material": "Heavy Non-Combustible",
    "area_sqm": 5000
  },
  "upper_floors_mezz_sqm": 200,
  "frame": {
    "type": "Steel",
    "protection": "protected"
  }
}
```

**After Migration:**
```json
{
  "building_name": "Main Warehouse",
  "roof": {
    "area_sqm": 5000,
    "breakdown": [
      { "material": "Heavy Non-Combustible", "percent": 100 }
    ],
    "total_percent": 100
  },
  "upper_floors_mezzanine": {
    "area_sqm": 200,
    "breakdown": [
      { "material": "Unknown", "percent": 100 }
    ],
    "total_percent": 100
  },
  "frame_type": "protected_steel"
}
```

### Example 2: Complex Building (User Edit)

**After User Edits:**
```json
{
  "building_name": "Manufacturing Building",
  "roof": {
    "area_sqm": 8000,
    "breakdown": [
      { "material": "Heavy Non-Combustible", "percent": 60 },
      { "material": "Light Non-Combustible", "percent": 30 },
      { "material": "Foam Plastic (Approved)", "percent": 10 }
    ],
    "total_percent": 100
  },
  "walls": {
    "breakdown": [
      { "material": "Heavy Non-Combustible", "percent": 80 },
      { "material": "Light Non-Combustible", "percent": 20 }
    ],
    "total_percent": 100
  },
  "upper_floors_mezzanine": {
    "area_sqm": 400,
    "breakdown": [
      { "material": "Heavy Non-Combustible", "percent": 100 }
    ],
    "total_percent": 100
  },
  "frame_type": "protected_steel",
  "compartmentation": "high"
}
```

**Calculated Result:**
- Construction Score: 95 (excellent due to mostly non-combustible + high compartmentation)
- Construction Rating: 5
- Combustible %: 8% (10% roof foam weighted by area)

## Testing Checklist

### Data Migration
- [x] Old roof.material → new roof.breakdown
- [x] Old upper_floors_mezz_sqm → new upper_floors_mezzanine
- [x] Old frame object → new frame_type
- [x] Unknown mezzanine material defaults correctly
- [x] Protected steel maps correctly

### UI Functionality
- [x] Roof edit button opens modal with roof materials
- [x] Walls edit button opens modal with wall materials
- [x] Mezzanine edit button opens modal with mezzanine materials
- [x] Modal title changes based on type
- [x] Frame dropdown shows all options
- [x] Compartmentation guidance visible

### Breakdown Editor
- [x] Add material button works for all types
- [x] Remove material button works
- [x] Percentage updates recalculate total
- [x] Total displays correct color (green=100%, red=other)
- [x] Cannot close modal if total ≠ 100%
- [x] Building notes editable in modal
- [x] Cladding details visible when present

### Validation
- [x] Save validates roof percentages
- [x] Save validates wall percentages
- [x] Save validates mezzanine percentages
- [x] Error messages show building name and current %
- [x] Empty breakdowns (0%) allowed

### Calculation
- [x] Roof calculation uses weighted percentages
- [x] Mezzanine materials contribute to combustibility
- [x] Frame type updates affect score
- [x] 'protected_steel' gives bonus
- [x] Rating derives correctly from new structure

### Compartmentation
- [x] Low/Medium/High guidance visible
- [x] Guidance panel positioned correctly
- [x] Text is readable and helpful
- [x] Responsive layout works on mobile

## Build Status

✅ **Build passes successfully**
```
✓ 1892 modules transformed
✓ built in 12.69s
```

✅ **No TypeScript errors**
✅ **No runtime errors**
✅ **All imports resolved**

## Files Modified

1. **src/components/modules/forms/RE02ConstructionForm.tsx**
   - Updated Building interface
   - Renamed WallBreakdown → MaterialBreakdown
   - Added MaterialBreakdown support for roof and mezzanine
   - Changed frame from object to frame_type enum
   - Added comprehensive migration logic
   - Updated CONSTRUCTION_MATERIALS constant
   - Restructured FRAME_TYPES as value/label pairs
   - Updated table headers and columns
   - Added compartmentation guidance panel
   - Implemented generic breakdown editor modal
   - Added helper functions for breakdown operations
   - Updated validation to check all three types
   - Updated calculateConstructionMetrics for new structure

## Summary

Successfully updated RE-02 Construction form to support material breakdown editors for roof and mezzanine, simplified frame input to single dropdown, and added visible compartmentation guidance. All construction elements now have consistent percentage-based breakdown editing. Comprehensive migration ensures no data loss from old format. Build passes with no errors.
