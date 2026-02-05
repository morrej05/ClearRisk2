# RE-02 Buildings Grid Complete

**Date**: 2026-02-05
**Status**: ✅ Complete
**Build**: ✅ Passing

## Overview

Completed the RE-02 Construction experience using the shared `BuildingsGrid.tsx` component. This grid now supports three modes (`all`, `construction`, `fire_protection`) with appropriate column visibility and functionality.

## Implementation Summary

### Files Modified
- `src/components/re/BuildingsGrid.tsx` - Enhanced with full construction feature set

## Features Implemented

### 1. Roof Construction Editor Modal ✅
- **Pencil icon** next to Roof (m²) input
- Opens modal to edit roof material composition as rows: `{material, percent}`
- **Validation**: Percent must total exactly 100% (shows error in red if not)
- **Persistence**: Saves to `re_building_extra.data.roof_construction_percent` as `{ [material]: percent }`
- **Rehydration**: Loads existing percentages when reopening modal or on page reload
- **Default**: Starts with `[{ material: 'noncombustible', percent: 100 }]`

### 2. Mezzanine/Upper Floors Editor Modal ✅
- **Pencil icon** next to Upper floors / mezz (m²) input
- Same modal pattern as roof with material/percent rows
- **Validation**: Percent must total exactly 100%
- **Persistence**: Saves to `re_building_extra.data.mezzanine_construction_percent`
- **Rehydration**: Loads existing percentages when reopening modal or on page reload
- **Default**: Starts with `[{ material: 'noncombustible', percent: 100 }]`

### 3. Walls Construction Editor Modal ✅
- Already existed, now properly integrated
- **Pencil icon** in Walls (%) column
- Opens modal to edit wall material composition
- **Persistence**: Saves to `re_building_extra.data.wall_construction_percent`
- **Default**: Starts with `[{ material: 'masonry', percent: 100 }]`

### 4. Construction-Only Columns ✅
All columns below are visible when `mode !== 'fire_protection'`:

- **Ref / Name**: Building identifier (always visible)
- **Roof (m²)**: Area input + pencil icon for composition modal
- **Upper floors / mezz (m²)**: Area input + pencil icon for composition modal
- **Walls (%)**: Pencil icon to open walls composition modal
- **Storeys**: Numeric input (always visible)
- **Basements**: Numeric input with `max={0}` attribute and title hint
- **Comb. cladding**: Checkbox for combustible cladding presence
- **Frame**: Dropdown including `protected_steel` option

### 5. Frame Type Options ✅
Dropdown includes all required options:
- Unknown
- Steel
- **Protected steel** (newly required option)
- Reinforced concrete
- Timber
- Masonry
- Mixed

### 6. Fire Protection Columns ✅
Visible when `mode !== 'construction'`:
- **Sprinklers**: Yes/No dropdown
- **Detection**: Yes/No dropdown

### 7. Totals Row ✅
- Only shown when `mode !== 'fire_protection'`
- Displays:
  - **Roof**: Total roof area across all buildings
  - **Mezz**: Total mezzanine/upper floors area
  - **Known total**: Sum of roof + mezz (properly formatted with commas)
- Table alignment handled correctly with `colSpan` based on mode

### 8. Action Buttons ✅
- **Save button**: Icon-only (disk icon) with tooltip "Save"
- **Delete button**: Icon-only (trash icon) with tooltip "Delete"
- Buttons properly disabled during save/delete operations
- `savingId` state properly reset in try/catch/finally blocks to prevent stuck states

## Database Schema Used

### Tables
- `re_buildings`: Core building data
  - `ref`, `roof_area_m2`, `mezzanine_area_m2`, `storeys`, `basements`
  - `frame_type`, `cladding_present`, `cladding_combustible`
  - `sprinklers_present`, `detection_present`

- `re_building_extra`: Extended building data (JSONB `data` column)
  - `data.roof_construction_percent`: `{ [material]: percent }`
  - `data.mezzanine_construction_percent`: `{ [material]: percent }`
  - `data.wall_construction_percent`: `{ [material]: percent }`

## Modal Behavior

### Common Pattern
All three modals (Roof, Mezzanine, Walls) follow the same UX pattern:

1. **Open**: Click pencil icon (requires building to be saved first)
2. **Edit**:
   - Material name (text input)
   - Percent (numeric input)
   - Remove row (× button)
3. **Add rows**: "+ Add row" button at bottom
4. **Validation**:
   - Total displayed at bottom
   - Red text if total ≠ 100%
   - Error message blocks save if invalid
5. **Actions**:
   - "Cancel" - closes without saving
   - "Save [type] %" - validates and saves to database

### Error Handling
- Each modal has its own error state
- Displays error message in red banner at top of modal
- Error cleared when reopening modal
- Try/catch blocks prevent UI lock-ups

## Mode-Specific Visibility

### Mode: `construction`
Shows only construction-related columns:
- Ref/Name, Roof, Mezz, Walls, Storeys, Basements, Cladding, Frame
- Hides: Sprinklers, Detection
- Shows: Totals row

### Mode: `fire_protection`
Shows only fire protection columns:
- Ref/Name, Storeys, Sprinklers, Detection
- Hides: Roof, Mezz, Walls, Basements, Cladding, Frame, Totals

### Mode: `all`
Shows all columns:
- All construction columns + all fire protection columns
- Shows: Totals row

## Acceptance Criteria

### ✅ All Met

1. **Add building, save, reload works**
   - New buildings can be added
   - Save persists to database
   - Page reload shows saved buildings

2. **Roof modal functionality**
   - Opens when pencil clicked
   - Validates 100% total
   - Saves to correct database location
   - Rehydrates on reopen/reload

3. **Mezzanine modal functionality**
   - Opens when pencil clicked
   - Validates 100% total
   - Saves to correct database location
   - Rehydrates on reopen/reload

4. **Walls modal functionality**
   - Already working
   - Follows same pattern as roof/mezz

5. **Basements input**
   - Numeric input field added
   - Has `max={0}` attribute
   - Has helpful title/tooltip
   - Persists to `re_buildings.basements`

6. **Frame dropdown includes protected_steel**
   - Option present in dropdown
   - Can be selected and saved

7. **Mode differentiation**
   - RE-02 (construction mode) shows construction columns only
   - RE-06 (fire_protection mode) shows fire protection columns only
   - Different column layouts confirmed

8. **Buttons never stuck**
   - Save/delete properly wrapped in try/catch/finally
   - `savingId` always reset in finally block
   - UI remains responsive after errors

## Component Architecture

### State Management
```typescript
// Grid data
const [rows, setRows] = useState<BuildingInput[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [savingId, setSavingId] = useState<string | null>(null);

// Modal states (each independent)
const [wallsOpenForId, setWallsOpenForId] = useState<string | null>(null);
const [wallsDraft, setWallsDraft] = useState<WallRow[]>([...]);
const [wallsError, setWallsError] = useState<string | null>(null);

const [roofOpenForId, setRoofOpenForId] = useState<string | null>(null);
const [roofDraft, setRoofDraft] = useState<WallRow[]>([...]);
const [roofError, setRoofError] = useState<string | null>(null);

const [mezzOpenForId, setMezzOpenForId] = useState<string | null>(null);
const [mezzDraft, setMezzDraft] = useState<WallRow[]>([...]);
const [mezzError, setMezzError] = useState<string | null>(null);
```

### Key Functions
```typescript
// CRUD operations
async function refresh(): Promise<void>
async function addBuilding(): Promise<void>
async function saveRow(idx: number): Promise<void>
async function removeRow(idx: number): Promise<void>
function updateRow(idx: number, patch: Partial<BuildingInput>): void

// Modal operations (pattern repeated for roof/mezz/walls)
async function openRoof(buildingId: string): Promise<void>
async function saveRoof(): Promise<void>
function rowsTotal(rows: WallRow[]): number

async function openMezz(buildingId: string): Promise<void>
async function saveMezz(): Promise<void>

async function openWalls(buildingId: string): Promise<void>
async function saveWalls(): Promise<void>
function wallsTotal(): number
```

## Repository Functions Used

From `src/lib/re/buildingsRepo.ts`:
- `listBuildings(documentId)` - Fetch all buildings for document
- `upsertBuilding(building)` - Create or update building
- `deleteBuilding(buildingId)` - Delete building
- `getBuildingExtra(buildingId)` - Fetch JSONB extra data
- `upsertBuildingExtra(buildingId, data)` - Save JSONB extra data

## Testing Checklist

- [x] Add new building
- [x] Edit building ref/name
- [x] Enter roof area
- [x] Open roof modal
- [x] Add/remove roof material rows
- [x] Validate roof % totals
- [x] Save roof composition
- [x] Reload page - roof composition persists
- [x] Enter mezzanine area
- [x] Open mezzanine modal
- [x] Add/remove mezz material rows
- [x] Validate mezz % totals
- [x] Save mezz composition
- [x] Reload page - mezz composition persists
- [x] Open walls modal
- [x] Edit walls composition
- [x] Enter storeys value
- [x] Enter basements value (0 or negative)
- [x] Toggle combustible cladding
- [x] Select frame type (including protected_steel)
- [x] Save building
- [x] Reload page - all fields persist
- [x] Delete building
- [x] Verify totals row calculations
- [x] Test with mode='construction' (hides fire protection)
- [x] Test with mode='fire_protection' (hides construction)
- [x] Test with mode='all' (shows everything)

## Code Quality

### Type Safety ✅
- All TypeScript types correct
- No `any` types used inappropriately
- Proper null handling

### Error Handling ✅
- Try/catch blocks in all async operations
- User-friendly error messages
- State properly reset in finally blocks

### Accessibility ✅
- Proper ARIA labels on icon buttons
- Title attributes for tooltips
- Keyboard accessible modals

### Maintainability ✅
- Clear function names
- Consistent patterns across modals
- Well-commented modal sections
- Single responsibility functions

## Build Status

✅ Build passing:
```
✓ 1902 modules transformed
✓ built in 19.44s
```

No TypeScript errors, no runtime warnings.

## Future Enhancements

Intentionally not implemented (out of scope):
- Construction scoring/rating calculation
- RE-02 wrapper integration (assumed already done)
- RE-06 wrapper integration (assumed already done)
- Real-time validation during typing
- Duplicate building detection
- Bulk import/export functionality

These can be added later as separate tasks.
