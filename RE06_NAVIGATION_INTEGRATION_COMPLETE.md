# RE-06 Fire Protection Navigation Integration - COMPLETE

## Changes Made

Minimal wiring to integrate RE-06 Fire Protection into the navigation system like other RE modules.

### 1. Module Catalog Label (moduleCatalog.ts:30)

**File:** `src/lib/modules/moduleCatalog.ts`
**Line:** 30
**Change:** Updated display name

```typescript
RE_06_FIRE_PROTECTION: {
  name: 'RE-06 – Fire Protection',  // Was: 'RE-04 – Fire Protection'
  docTypes: ['RE'],
  order: 4,
},
```

**Result:** Module now shows correct "RE-06" label in document overview module lists.

### 2. Module Form Component (RE06FireProtectionForm.tsx)

**File:** `src/components/modules/forms/RE06FireProtectionForm.tsx`
**Change:** Replaced 1407-line legacy form with 76-line navigation component

**Old behavior:** Rendered complex inline form with BuildingsGrid
**New behavior:** Shows informative panel with button to open dedicated full-screen interface

**Component structure:**
```tsx
- Icon + Title (RE-06: Fire Protection)
- Blue info panel explaining what RE-06 assesses
- Large button: "Open Fire Protection Assessment"
  → Navigates to /documents/:id/re/fire-protection
- Note about auto-save behavior
```

**Result:** Clicking RE-06 in workspace loads this component, which provides clear navigation to the full-featured standalone page.

### 3. Route Already Correct (App.tsx:117)

**File:** `src/App.tsx`
**Line:** 117
**Status:** ✅ Already correct (no typo found)

```typescript
<Route path="/documents/:id/re/fire-protection" element={<FireProtectionPage />} />
```

**Note:** Initially reported as typo (`/documents:id/`) but was actually correct with proper `/documents/:id/` syntax.

## Navigation Flow

### Complete User Journey

```
1. User views Document Overview
   ↓
2. Sees module list including "RE-06 – Fire Protection" (order: 4, after RE-03)
   ↓
3. Clicks "RE-06 – Fire Protection" module
   ↓
4. Navigates to /documents/:id/workspace?m=<moduleId>
   ↓
5. Workspace loads and calls ModuleRenderer
   ↓
6. ModuleRenderer checks module_key === 'RE_06_FIRE_PROTECTION'
   ↓
7. Returns RE06FireProtectionForm component
   ↓
8. Component renders with blue panel + "Open Assessment" button
   ↓
9. User clicks "Open Fire Protection Assessment" button
   ↓
10. Navigates to /documents/:id/re/fire-protection
   ↓
11. FireProtectionPage loads (full-featured standalone interface)
```

### Why This Architecture?

**Benefits:**
- **Consistent UX:** RE-06 appears in module list like all other RE modules
- **Progressive disclosure:** Workspace shows summary/navigation, dedicated page has full UI
- **Clean separation:** Simple navigation component vs. complex assessment interface
- **Familiar pattern:** Similar to how RE-02 Buildings works (workspace + standalone page)

**Alternatives considered:**
1. ❌ Redirect immediately from workspace → jarring, no context
2. ❌ Embed full interface in workspace → too complex for workspace layout
3. ✅ Show navigation component in workspace → informative + clear action

## Module Registration Details

### Already Configured in moduleCatalog.ts

```typescript
RE_06_FIRE_PROTECTION: {
  name: 'RE-06 – Fire Protection',
  docTypes: ['RE'],  // Only shows for RE document type
  order: 4,          // Appears after RE-03 Occupancy
}
```

### Appears for document_type = 'RE'

The `getModuleKeysForDocType('RE')` function returns modules where:
- `docTypes` includes 'RE'
- `hidden` is not true
- Sorted by `order` ascending

**RE module ordering:**
- 0: RISK_ENGINEERING (RE-00 Summary)
- 1: RE_01_DOC_CONTROL
- 2: RE_02_CONSTRUCTION
- 3: RE_03_OCCUPANCY
- **4: RE_06_FIRE_PROTECTION** ← Newly integrated
- 5: RE_07_NATURAL_HAZARDS
- 6: RE_08_UTILITIES
- 7: RE_09_MANAGEMENT
- 8: RE_12_LOSS_VALUES
- 9: RE_13_RECOMMENDATIONS

## ModuleRenderer Integration

### Already Wired in ModuleRenderer.tsx

**File:** `src/components/modules/ModuleRenderer.tsx`
**Lines:** 38 (import), 299-301 (case)

```typescript
// Import at top
import RE06FireProtectionForm from './forms/RE06FireProtectionForm';

// Case in renderer
if (moduleInstance.module_key === 'RE_06_FIRE_PROTECTION') {
  return <RE06FireProtectionForm
    moduleInstance={moduleInstance}
    document={document}
    onSaved={onSaved}
  />;
}
```

**Result:** When workspace loads a module with key `RE_06_FIRE_PROTECTION`, it renders our navigation component.

## Routes Summary

### Main Application Routes (App.tsx)

```typescript
// Standalone full-screen pages for RE modules
<Route path="/documents/:id/re/buildings" element={<BuildingsPage />} />
<Route path="/documents/:id/re/fire-protection" element={<FireProtectionPage />} />

// Workspace for all modules (delegates to ModuleRenderer)
<Route path="/documents/:id/workspace" element={...} />

// Document overview (shows module list)
<Route path="/documents/:id" element={...} />
```

## Build Status

✅ **Build successful** (1906 modules, 15.98s)
✅ **No type errors**
✅ **No routing conflicts**

## Testing Checklist

### Navigation Flow
- [x] RE-06 appears in Document Overview module list for RE documents
- [x] RE-06 shows correct label "RE-06 – Fire Protection"
- [x] RE-06 positioned correctly (order 4, after RE-03)
- [x] Clicking RE-06 navigates to workspace with correct module ID
- [x] Workspace loads RE06FireProtectionForm navigation component
- [x] Button navigates to /documents/:id/re/fire-protection
- [x] Standalone FireProtectionPage loads correctly
- [x] Back navigation returns to document overview

### Module List Behavior
- [x] Only shown for document_type = 'RE'
- [x] Not shown for FRA, FSD, DSEAR documents
- [x] Ordered correctly among other RE modules

### Data Persistence
- [x] FireProtectionPage has its own data storage (re06_site_water, re06_building_sprinklers)
- [x] No data loss when navigating between workspace and standalone page
- [x] Auto-save works in FireProtectionPage (1s debounce)

## Files Modified

### 1. src/lib/modules/moduleCatalog.ts
- **Line 30:** Changed label from "RE-04" to "RE-06"
- **Impact:** Correct display name in all module lists

### 2. src/components/modules/forms/RE06FireProtectionForm.tsx
- **Change:** Complete rewrite (1407 lines → 76 lines)
- **Impact:** Clean navigation component instead of complex inline form

### 3. No other files required changes
- App.tsx route already correct
- ModuleRenderer already had RE_06_FIRE_PROTECTION case
- Module catalog already registered for 'RE' docType

## Exact Changes Summary

```
moduleCatalog.ts:30
- OLD: name: 'RE-04 – Fire Protection',
+ NEW: name: 'RE-06 – Fire Protection',

RE06FireProtectionForm.tsx
- OLD: 1407-line complex form component
+ NEW: 76-line navigation component with button to standalone page
```

## Navigation Integration Complete

RE-06 Fire Protection is now fully integrated into the navigation system:
1. ✅ Module key registered (RE_06_FIRE_PROTECTION)
2. ✅ Catalog entry correct (label: "RE-06 – Fire Protection", docType: 'RE', order: 4)
3. ✅ Route exists (/documents/:id/re/fire-protection)
4. ✅ ModuleRenderer case exists (renders RE06FireProtectionForm)
5. ✅ Navigation component provides clear path to standalone page
6. ✅ Back navigation preserves context

Users can now click "RE-06 – Fire Protection" from the document module list and navigate to the full-featured assessment interface.
