# RE-06 Fire Protection Sidebar Corruption Fix

## Problem

When RE-06 Fire Protection was selected, the sidebar showed corrupted content with extra items (RE_10_PROCESS_RISK, RE_SUPPORTING_DOCS) and hidden outputs. This happened because Fire Protection was configured as a "dedicated module" with its own standalone page that rendered its own sidebar independently.

## Root Cause

1. **Dedicated Module Setup**: RE_06_FIRE_PROTECTION was in `DEDICATED_MODULE_KEYS`, forcing it to use a separate route instead of rendering in the DocumentWorkspace
2. **Independent Sidebar Rendering**: FireProtectionPage was rendering its own complete layout with ModuleSidebar, loading modules independently
3. **Wrong Filtering Logic**: The dedicated page's sidebar was loading ALL modules from the database without applying MODULE_CATALOG filtering

## Solution

### 1. Module Catalog Order Fixed (`src/lib/modules/moduleCatalog.ts`)

**Changed display order:**
- RE-05 – Exposures (RE_07_NATURAL_HAZARDS): order 5 → **order 4**
- RE-06 – Fire Protection (RE_06_FIRE_PROTECTION): order 4 → **order 5**

**Correct order now:**
1. RE-00 – Summary
2. RE-01 – Document Control
3. RE-02 – Construction
4. RE-03 – Occupancy
5. **RE-05 – Exposures** (moved up)
6. **RE-06 – Fire Protection** (moved down)
7. RE-06 – Utilities & Critical Services
8. RE-07 – Management Systems
9. RE-08 – Loss & Values
10. RE-09 – Recommendations
11. RE-10 – Supporting Documentation

### 2. Removed Dedicated Module Logic (`src/pages/documents/DocumentWorkspace.tsx`)

**Before:**
```typescript
const DEDICATED_MODULE_KEYS = new Set(['RE_06_FIRE_PROTECTION']);
```

**After:**
```typescript
const DEDICATED_MODULE_KEYS = new Set<string>([]);
```

This allows Fire Protection to render in the workspace like all other RE modules.

### 3. Removed Dedicated Route Logic (`src/lib/modules/moduleCatalog.ts`)

**Before:**
```typescript
export function getModuleNavigationPath(...) {
  // RE-06 Fire Protection has a dedicated page route
  if (moduleKey === 'RE_06_FIRE_PROTECTION') {
    return `/documents/${documentId}/re/fire-protection`;
  }
  return `/documents/${documentId}/workspace?m=${moduleInstanceId}`;
}
```

**After:**
```typescript
export function getModuleNavigationPath(...) {
  // All modules use the workspace route with module instance ID
  return `/documents/${documentId}/workspace?m=${moduleInstanceId}`;
}
```

### 4. Simplified FireProtectionPage (`src/pages/re/FireProtectionPage.tsx`)

**Reduced from 244 lines to 23 lines** - now matches BuildingsPage pattern:
- Removed duplicate sidebar rendering
- Removed duplicate module loading
- Removed duplicate header/layout
- Simple "Back to Modules" button + form only

## Result

**Fire Protection now:**
1. ✅ Renders in DocumentWorkspace using the shared parent layout
2. ✅ Uses the same ModuleSidebar component as all other RE modules
3. ✅ Sidebar built from MODULE_CATALOG with proper filtering (`getModuleKeysForDocType('RE')`)
4. ✅ No extra items (RE_10_PROCESS_RISK, RE_SUPPORTING_DOCS) shown
5. ✅ Hidden outputs properly filtered out
6. ✅ Correct module order (Exposures before Fire Protection)

## How Fire Protection Renders

**Rendering chain:**
```
DocumentWorkspace
  └─ ModuleSidebar (shared, filtered by MODULE_CATALOG)
  └─ ModuleRenderer
      └─ RE06FireProtectionForm (wrapper)
          └─ FireProtectionForm (actual 706-line implementation)
```

## Backward Compatibility

The dedicated route `/documents/:id/re/fire-protection` still exists and shows a simplified view (form + back button). However, the primary navigation path is now through the workspace sidebar, ensuring consistent behavior with all other RE modules.
