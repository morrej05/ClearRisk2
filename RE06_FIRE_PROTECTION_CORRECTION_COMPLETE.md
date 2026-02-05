# RE-06 Fire Protection Correction - COMPLETE

## Critical Issue Fixed

RE-06 was incorrectly rendering BuildingsGrid, which is the **editable CRUD table owned by RE-02 Construction**. This violated the architectural boundary where:
- **RE-02 Construction** owns the canonical Buildings model (re02_buildings table)
- **RE-06 Fire Protection** must ONLY read buildings and assess sprinkler systems per building

## Architecture Corrected

### Data Model Separation

**RE-02 Construction (Owns Buildings)**
```
re02_buildings
├── id (uuid, PK)
├── document_id (FK to documents)
├── ref (text) - Building name/reference
├── description (text)
├── footprint_m2 (numeric)
├── storeys (integer)
└── data (jsonb) - Construction details
```

**RE-06 Fire Protection (Reads Buildings, Assesses Sprinklers)**
```
re06_site_water
├── id (uuid, PK)
├── document_id (FK to documents)
├── data (jsonb) - Water supply details
├── water_score_1_5 (integer)
└── comments (text)

re06_building_sprinklers
├── id (uuid, PK)
├── document_id (FK to documents)
├── building_id (FK to re02_buildings)
├── data (jsonb) - Sprinkler coverage, standards, etc.
├── sprinkler_score_1_5 (integer)
├── final_active_score_1_5 (integer)
└── comments (text)
```

### UI Responsibilities

**RE-02 Construction**
- ✅ Create/Edit/Delete Buildings
- ✅ Edit building properties (name, area, storeys)
- ✅ Construction materials and ratings
- ✅ Owns BuildingsGrid component

**RE-06 Fire Protection**
- ✅ READ buildings from RE-02 (read-only list)
- ✅ Assess site water supply (re06_site_water)
- ✅ Assess sprinklers per building (re06_building_sprinklers)
- ✅ Calculate final active scores
- ❌ CANNOT create/edit/delete buildings
- ❌ CANNOT edit building master attributes

## Implementation

### Files Created

**src/components/re/FireProtectionForm.tsx (new)**
- Reusable fire protection assessment form
- Reads buildings from re02_buildings (via listBuildings)
- Manages re06_site_water and re06_building_sprinklers
- Layout: Site Water (top) + Building Selector (left) + Sprinkler Form (right) + Site Rollup (bottom)
- No building CRUD operations

### Files Modified

**src/components/modules/forms/RE06FireProtectionForm.tsx**
```tsx
// BEFORE: Used BuildingsGrid (WRONG - allows building edits)
return <BuildingsGrid documentId={document.id} mode="fire_protection" onAfterSave={onSaved} />;

// AFTER: Uses FireProtectionForm (CORRECT - read-only buildings)
return <FireProtectionForm documentId={document.id} onSaved={onSaved} />;
```

**src/pages/re/FireProtectionPage.tsx**
```tsx
// BEFORE: 760 lines of inline form logic
export default function FireProtectionPage() {
  // ... massive inline implementation
}

// AFTER: Clean wrapper around shared component (60 lines)
export default function FireProtectionPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header>...</header>
      <FireProtectionForm documentId={documentId} />
    </div>
  );
}
```

## UI Structure

### Top: Site Water & Fire Pumps
```
┌─────────────────────────────────────────────────────────────┐
│ 💧 Site Water & Fire Pumps                 Water Score: ■■■□□ 3/5 │
├─────────────────────────────────────────────────────────────┤
│ Water Reliability: [Unknown ▼]  Supply Type: [____________] │
│ Pumps Present: [No ▼]           Pump Arrangement: [Unknown ▼] │
│ Power Resilience: [Unknown ▼]   Testing Regime: [Unknown ▼] │
│ Key Weaknesses: [__________________________________]         │
│ Comments: [_________________________________________]        │
└─────────────────────────────────────────────────────────────┘
```

### Left: Read-Only Building Selector
```
┌───────────────────────┐
│ 🏢 Buildings          │
├───────────────────────┤
│ ┌───────────────────┐ │
│ │ Building A        │ │  ← Click to select
│ │ Warehouse         │ │  ← Description (read-only)
│ │ 5,000 m²          │ │  ← Area (read-only)
│ │         Final 4/5 │ │  ← Score indicator
│ └───────────────────┘ │
│ ┌───────────────────┐ │
│ │ Building B        │ │
│ │ Office Block      │ │
│ │ 3,200 m²          │ │
│ │         Final 3/5 │ │
│ └───────────────────┘ │
└───────────────────────┘
```

### Right: Building Sprinkler Assessment
```
┌─────────────────────────────────────────────────────────────┐
│ Building A - Sprinklers               Final Active Score: 4/5 │
│ Warehouse • Area: 5,000 m²            Sprinkler: 4/5 • Water: 3/5 │
├─────────────────────────────────────────────────────────────┤
│ Coverage Required (%): [100]  Coverage Installed (%): [95]  │
│ Sprinkler Standard: [BS EN 12845]  Hazard Class: [OH2]      │
│ Maintenance Status: [Good ▼]  Sprinkler Adequacy: [Adequate ▼] │
│ Comments: [_________________________________________]        │
└─────────────────────────────────────────────────────────────┘
```

### Bottom: Site Roll-up
```
┌─────────────────────────────────────────────────────────────┐
│ 📈 Site Fire Protection Roll-up                             │
│ Area-weighted average across buildings where sprinklers are required │
├─────────────────────────────────────────────────────────────┤
│ Average Score: 3.8/5  Buildings Assessed: 12  Total Area: 45,000 m² │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Loading Buildings (Read-Only)
```typescript
// RE-06 reads from canonical RE-02 table
const buildings = await listBuildings(documentId);
// Returns: re02_buildings records

// Buildings are displayed in selector
// User CANNOT add/edit/delete
```

### Assessing Sprinklers
```typescript
// For each building, ensure sprinkler record exists
const sprinklers = await ensureBuildingSprinklersForAllBuildings(
  documentId,
  buildingIds
);
// Creates/retrieves: re06_building_sprinklers records

// User selects building → loads its sprinkler record
// User edits sprinkler data → saves to re06_building_sprinklers
// Building attributes remain unchanged
```

### Scoring Logic
```typescript
// Water score (site-level)
const waterScore = calculateWaterScore(siteWaterData); // 1-5

// Sprinkler score (per building)
const sprinklerScore = calculateSprinklerScore(buildingSprinklerData); // 1-5

// Final active score (min of water and sprinkler)
const finalActiveScore = Math.min(waterScore, sprinklerScore); // 1-5

// Site rollup (area-weighted average)
const siteRollup = calculateSiteRollup(buildingSprinklers, buildings);
```

## Navigation

### From Module List (Document Overview)
```
User clicks "RE-06 – Fire Protection"
  ↓
DocumentWorkspace renders RE06FireProtectionForm
  ↓
RE06FireProtectionForm renders FireProtectionForm
  ↓
FireProtectionForm loads:
  - Buildings from RE-02 (read-only)
  - Site water from re06_site_water
  - Building sprinklers from re06_building_sprinklers
```

### From Direct URL
```
User navigates to /documents/:id/re/fire-protection
  ↓
Route renders FireProtectionPage
  ↓
FireProtectionPage renders:
  - Header with back button
  - FireProtectionForm (same component)
```

## Key Constraints Enforced

### ✅ Buildings are Read-Only in RE-06
- No "Add Building" button
- No "Delete Building" button
- No editing of building name/ref
- No editing of building area
- No editing of building storeys
- Buildings list populated from RE-02's canonical table

### ✅ Sprinkler Assessment is Isolated
- Stored in re06_building_sprinklers (keyed by document_id + building_id)
- Coverage required/installed percentages
- Sprinkler standards and hazard classes
- Maintenance status and adequacy ratings
- Comments specific to sprinkler system

### ✅ Scoring is Computed, Not Stored in Buildings
- Water score: calculated from site water data
- Sprinkler score: calculated from sprinkler system data
- Final active score: min(water, sprinkler) per building
- Site rollup: area-weighted average across assessed buildings

## What Users See

### Creating Buildings
```
User wants to add a new building
  ↓
Must navigate to RE-02 Construction
  ↓
Click "Add Building" in BuildingsGrid
  ↓
Enter building details (name, area, storeys, construction)
  ↓
Building saved to re02_buildings
  ↓
Building now appears in RE-06 building selector (read-only)
```

### Assessing Fire Protection
```
User navigates to RE-06 Fire Protection
  ↓
Top section: Enter site water supply details
  ↓
Left section: Select a building from read-only list
  ↓
Right section: Assess sprinkler system for selected building
  ↓
Bottom section: View site-level rollup statistics
  ↓
Data autosaves to re06_site_water and re06_building_sprinklers
```

## Build Status

✅ **Build successful** (1907 modules, 13.85s)
✅ **No type errors**
✅ **No architectural violations**

## Summary

**Before Fix:**
- ❌ RE-06 used BuildingsGrid (allows building edits)
- ❌ Violated data ownership boundary
- ❌ User could accidentally edit building master data from RE-06
- ❌ Duplicate/conflicting implementations

**After Fix:**
- ✅ RE-06 uses FireProtectionForm (read-only buildings)
- ✅ Respects RE-02 as owner of canonical Buildings table
- ✅ User can only assess sprinklers, not edit buildings
- ✅ Single shared implementation for consistency

**Architecture:**
- RE-02 Construction: Owns re02_buildings (CRUD)
- RE-06 Fire Protection: Reads re02_buildings (read-only), writes re06_* tables
- Clear separation of concerns
- No data model confusion
- Correct UI constraints
