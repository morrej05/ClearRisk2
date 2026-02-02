# RE-02 Construction Form: Mezzanine-Specific Materials - Complete

## Summary

Updated the RE02ConstructionForm breakdown editor to use mezzanine-specific material options when editing upper floors/mezzanine construction. The modal now shows contextually appropriate materials based on whether you're editing roof, walls, or mezzanine.

## Changes Made

### 1. Added MEZZANINE_MATERIALS Constant

**Location:** `src/components/modules/forms/RE02ConstructionForm.tsx:78-85`

```typescript
const MEZZANINE_MATERIALS = [
  'Reinforced Concrete',
  'Composite Steel Deck + Concrete',
  'Protected Steel Mezzanine',
  'Unprotected Steel Mezzanine',
  'Timber Floor / Timber Mezzanine',
  'Unknown',
];
```

**Rationale:**
- Mezzanine/upper floors have different typical construction materials than roofs/walls
- These 6 materials represent the common types of mezzanine construction in industrial/commercial buildings
- 'Unknown' provides fallback for legacy data or uncertain cases

### 2. Added getMaterialOptionsForType Helper Function

**Location:** `src/components/modules/forms/RE02ConstructionForm.tsx:96-99`

```typescript
function getMaterialOptionsForType(type: 'roof' | 'walls' | 'mezzanine'): string[] {
  if (type === 'mezzanine') return MEZZANINE_MATERIALS;
  return CONSTRUCTION_MATERIALS;
}
```

**Purpose:**
- Centralized logic for determining which material list to use
- Returns mezzanine-specific materials when editing mezzanine
- Returns standard construction materials for roof and walls
- Type-safe with explicit parameter type

### 3. Updated Material Dropdown in Modal

**Location:** `src/components/modules/forms/RE02ConstructionForm.tsx:804-806`

**Before:**
```typescript
{CONSTRUCTION_MATERIALS.map(mat => (
  <option key={mat} value={mat}>{mat}</option>
))}
```

**After:**
```typescript
{getMaterialOptionsForType(editingBreakdown.type).map(mat => (
  <option key={mat} value={mat}>{mat}</option>
))}
```

**Effect:**
- When editing **roof** → Shows: Heavy Non-Combustible, Light Non-Combustible, Foam Plastic (Approved), etc.
- When editing **walls** → Shows: Heavy Non-Combustible, Light Non-Combustible, Foam Plastic (Approved), etc.
- When editing **mezzanine** → Shows: Reinforced Concrete, Composite Steel Deck + Concrete, Protected Steel Mezzanine, etc.

### 4. Updated "Add Material" Default

**Location:** `src/components/modules/forms/RE02ConstructionForm.tsx:848`

**Before:**
```typescript
{ material: CONSTRUCTION_MATERIALS[0], percent: 0 }
```

**After:**
```typescript
{ material: getMaterialOptionsForType(editingBreakdown.type)[0], percent: 0 }
```

**Effect:**
- When adding material to **roof** → Defaults to 'Heavy Non-Combustible'
- When adding material to **walls** → Defaults to 'Heavy Non-Combustible'
- When adding material to **mezzanine** → Defaults to 'Reinforced Concrete'

## User Experience Flow

### Editing Mezzanine Materials

**Step 1:** User clicks "Edit" button in Mezzanine column
```
┌─────────────────────┐
│ Mezzanine           │
├─────────────────────┤
│ Area m²: [500    ] │
│ [Edit] (0%)        │ ← User clicks here
└─────────────────────┘
```

**Step 2:** Modal opens with title "Edit Upper Floors / Mezzanine Breakdown"

**Step 3:** User clicks "Add Material" button

**Step 4:** New row appears with mezzanine-specific dropdown
```
Material: [Reinforced Concrete ▼]  Percent: [0]

Options shown:
- Reinforced Concrete
- Composite Steel Deck + Concrete
- Protected Steel Mezzanine
- Unprotected Steel Mezzanine
- Timber Floor / Timber Mezzanine
- Unknown
```

**Step 5:** User selects material and enters percentage
```
Material: [Composite Steel Deck + Concrete ▼]  Percent: [100]
```

**Step 6:** User clicks "Done" (validates total = 100%)

**Step 7:** Table shows updated status
```
┌─────────────────────┐
│ Mezzanine           │
├─────────────────────┤
│ Area m²: [500    ] │
│ [Edit] (100%)      │ ← Shows percentage
└─────────────────────┘
```

### Comparison: Roof vs Walls vs Mezzanine

| Type | Edit Button Location | Material Options | Default Material |
|------|---------------------|------------------|------------------|
| **Roof** | Roof column | Heavy Non-Combustible, Light Non-Combustible, Foam Plastic (Approved), Foam Plastic (Unapproved), Combustible (Other), Unknown | Heavy Non-Combustible |
| **Walls** | Walls column | Heavy Non-Combustible, Light Non-Combustible, Foam Plastic (Approved), Foam Plastic (Unapproved), Combustible (Other), Unknown | Heavy Non-Combustible |
| **Mezzanine** | Mezzanine column | Reinforced Concrete, Composite Steel Deck + Concrete, Protected Steel Mezzanine, Unprotected Steel Mezzanine, Timber Floor / Timber Mezzanine, Unknown | Reinforced Concrete |

## Material Definitions

### Mezzanine Materials

1. **Reinforced Concrete**
   - Cast-in-place or precast concrete floors
   - Non-combustible, high fire resistance
   - Typical in heavy industrial buildings

2. **Composite Steel Deck + Concrete**
   - Metal deck with concrete topping
   - Non-combustible, good fire resistance
   - Common in modern commercial/industrial construction

3. **Protected Steel Mezzanine**
   - Steel structure with fire protection (intumescent coating, board, sprayed)
   - Non-combustible, protected against collapse
   - Required in many building codes

4. **Unprotected Steel Mezzanine**
   - Bare steel structure without fire protection
   - Non-combustible but vulnerable to fire
   - Higher risk, lower construction rating

5. **Timber Floor / Timber Mezzanine**
   - Wood construction (joists, beams, decking)
   - Combustible material
   - Higher fire risk, requires careful assessment

6. **Unknown**
   - Fallback for legacy data or uncertain cases
   - Used during migration from old format
   - Should be updated with actual material when known

## Technical Implementation

### Type Safety

The helper function uses TypeScript's type system to ensure correctness:

```typescript
function getMaterialOptionsForType(type: 'roof' | 'walls' | 'mezzanine'): string[] {
  // ...
}
```

- **Parameter:** Literal union type restricts to exactly 'roof', 'walls', or 'mezzanine'
- **Return:** String array with material names
- **Compile-time safety:** TypeScript ensures correct usage at all call sites

### Modal Context Awareness

The modal component automatically adapts based on `editingBreakdown.type`:

```typescript
{editingBreakdown && editingBuilding && (() => {
  const breakdownData = getBreakdownData(editingBuilding, editingBreakdown.type);

  // Modal title changes
  <h3>Edit {getBreakdownTitle(editingBreakdown.type)} Breakdown</h3>

  // Material options change
  {getMaterialOptionsForType(editingBreakdown.type).map(mat => (
    <option key={mat} value={mat}>{mat}</option>
  ))}

  // Default material changes
  { material: getMaterialOptionsForType(editingBreakdown.type)[0], percent: 0 }
})()}
```

**Benefits:**
- Single modal component handles all three types
- No code duplication
- Contextually appropriate options
- Consistent user experience

## Migration Compatibility

### Legacy Data Handling

When old data is loaded with `upper_floors_mezz_sqm: 500`, it's migrated to:

```json
{
  "upper_floors_mezzanine": {
    "area_sqm": 500,
    "breakdown": [
      { "material": "Unknown", "percent": 100 }
    ],
    "total_percent": 100
  }
}
```

**Note:** 'Unknown' is included in MEZZANINE_MATERIALS specifically to handle this migration case.

### User Update Flow

1. User opens legacy assessment
2. Migration sets mezzanine material to 'Unknown'
3. User clicks Edit on mezzanine
4. Modal shows mezzanine-specific options (including 'Unknown')
5. User can update to correct material (e.g., 'Reinforced Concrete')
6. Data is now accurately captured

## Testing Scenarios

### Scenario 1: New Building - Mezzanine with Mixed Materials

**Input:**
- Add building
- Set mezzanine area: 1000 m²
- Click Edit on mezzanine
- Add material: Reinforced Concrete, 70%
- Add material: Composite Steel Deck + Concrete, 30%
- Done

**Expected Result:**
```json
{
  "upper_floors_mezzanine": {
    "area_sqm": 1000,
    "breakdown": [
      { "material": "Reinforced Concrete", "percent": 70 },
      { "material": "Composite Steel Deck + Concrete", "percent": 30 }
    ],
    "total_percent": 100
  }
}
```

**Button shows:** "Edit (100%)" in green

### Scenario 2: Edit Roof vs Mezzanine - Different Options

**Roof Edit:**
1. Click Edit in Roof column
2. Add Material → Dropdown shows: Heavy Non-Combustible, Light Non-Combustible, Foam Plastic (Approved), etc.

**Mezzanine Edit:**
1. Click Edit in Mezzanine column
2. Add Material → Dropdown shows: Reinforced Concrete, Composite Steel Deck + Concrete, Protected Steel Mezzanine, etc.

**Verification:**
- Same modal UI
- Different material lists
- Different default materials

### Scenario 3: Legacy Data Update

**Initial State (migrated):**
```json
{
  "upper_floors_mezzanine": {
    "area_sqm": 500,
    "breakdown": [{ "material": "Unknown", "percent": 100 }]
  }
}
```

**User Actions:**
1. Open assessment
2. Click Edit on mezzanine
3. See existing row: Material = "Unknown", Percent = 100
4. Change dropdown to "Protected Steel Mezzanine"
5. Click Done

**Final State:**
```json
{
  "upper_floors_mezzanine": {
    "area_sqm": 500,
    "breakdown": [{ "material": "Protected Steel Mezzanine", "percent": 100 }]
  }
}
```

## Benefits

### 1. Contextual Accuracy
- Engineers see only relevant material options
- Reduces confusion and selection errors
- Matches industry terminology for each building element

### 2. Data Quality
- More accurate mezzanine material capture
- Enables better fire risk calculations
- Supports structural integrity assessments

### 3. Professional Presentation
- Shows domain knowledge of construction types
- Mezzanine materials match engineering practice
- Appropriate terminology for insurance risk assessment

### 4. Maintainability
- Single helper function controls material lists
- Easy to add new material types in future
- Clear separation of concerns

### 5. User Experience
- Consistent modal behavior across all types
- Appropriate defaults for each type
- No unnecessary options cluttering dropdowns

## Future Enhancements

### Possible Extensions

1. **Material-Specific Guidance**
   - Add tooltip for each mezzanine material explaining fire characteristics
   - Help text on when to select protected vs unprotected steel

2. **Combustibility Calculations**
   - Update `calculateConstructionMetrics()` to weight mezzanine materials
   - Different penalties for timber vs steel vs concrete

3. **Visual Indicators**
   - Color-code materials by combustibility
   - Red = combustible, Yellow = unprotected, Green = protected

4. **Material Validation**
   - Warn if timber mezzanine in high-risk building
   - Suggest protected steel if fire load is high

## Code Files Modified

**File:** `src/components/modules/forms/RE02ConstructionForm.tsx`

**Lines Changed:**
- **78-85:** Added MEZZANINE_MATERIALS constant
- **96-99:** Added getMaterialOptionsForType helper function
- **804:** Updated material dropdown to use helper
- **848:** Updated "Add Material" default to use helper

**Total Changes:** 4 locations, ~15 lines of code

## Build Status

✅ **Build passes successfully**
```
✓ 1892 modules transformed
✓ built in 13.98s
```

✅ **No TypeScript errors**
✅ **No runtime errors**
✅ **Type safety maintained**

## Summary

Successfully added mezzanine-specific material options to the RE02 Construction Form breakdown editor. When users click "Edit" in the Mezzanine column, they now see 6 contextually appropriate material options (Reinforced Concrete, Composite Steel Deck + Concrete, etc.) instead of the generic roof/wall materials. The implementation uses a helper function to maintain a single modal component while providing type-specific material lists. Default material when adding a new mezzanine row is now "Reinforced Concrete" instead of "Heavy Non-Combustible".
