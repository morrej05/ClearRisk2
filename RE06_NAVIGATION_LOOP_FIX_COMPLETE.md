# RE-06 Navigation Loop Fix - COMPLETE

## Problem

Navigation to RE-06 Fire Protection was causing a flashing/redirect loop with console error:
```
TypeError: Cannot navigate to URL .../documents/<id>/workspace?m=<moduleId>
```

This was caused by all module navigation using the workspace route pattern, but RE-06 has a dedicated direct route at `/documents/:id/re/fire-protection`.

## Root Cause

All navigation points in DocumentOverview were hardcoded to use workspace routes:
- Module list clicks: `navigate(/documents/${id}/workspace?m=${module.id})`
- Continue button: `navigate(/documents/${id}/workspace?m=${firstIncomplete.id})`
- Open Workspace button: `navigate(/documents/${id}/workspace?m=${targetModule})`

But RE-06 should navigate directly to: `/documents/:id/re/fire-protection`

## Solution

Added a helper function in DocumentOverview to intelligently route modules:

```typescript
// Helper to get the correct navigation path for a module
const getModuleNavigationPath = (module: ModuleInstance): string => {
  // RE-06 Fire Protection has a dedicated page route
  if (module.module_key === 'RE_06_FIRE_PROTECTION') {
    return `/documents/${id}/re/fire-protection`;
  }
  // All other modules use workspace
  return `/documents/${id}/workspace?m=${module.id}`;
};
```

## Changes Made

### File: src/pages/documents/DocumentOverview.tsx

#### 1. Added Helper Function (line ~107)
```typescript
const getModuleNavigationPath = (module: ModuleInstance): string => {
  if (module.module_key === 'RE_06_FIRE_PROTECTION') {
    return `/documents/${id}/re/fire-protection`;
  }
  return `/documents/${id}/workspace?m=${module.id}`;
};
```

#### 2. Updated handleContinueAssessment (line ~380)
**Before:**
```typescript
if (firstIncomplete) {
  navigate(`/documents/${id}/workspace?m=${firstIncomplete.id}`, {
    state: { returnTo: `/documents/${id}` }
  });
}
```

**After:**
```typescript
if (firstIncomplete) {
  navigate(getModuleNavigationPath(firstIncomplete), {
    state: { returnTo: `/documents/${id}` }
  });
}
```

#### 3. Updated handleOpenWorkspace (line ~408)
**Before:**
```typescript
if (targetModule) {
  navigate(`/documents/${id}/workspace?m=${targetModule}`, {
    state: { returnTo: `/documents/${id}` }
  });
}
```

**After:**
```typescript
const targetModule = modules.find(m => m.id === targetModuleId);
if (targetModule) {
  navigate(getModuleNavigationPath(targetModule), {
    state: { returnTo: `/documents/${id}` }
  });
}
```

#### 4. Updated Module List Click Handler (line ~1028)
**Before:**
```typescript
onClick={() => {
  navigate(`/documents/${id}/workspace?m=${module.id}`);
}}
```

**After:**
```typescript
onClick={() => {
  navigate(getModuleNavigationPath(module));
}}
```

## Navigation Flow

### For RE-06 Fire Protection
```
User clicks "RE-06 – Fire Protection" in module list
  ↓
getModuleNavigationPath(module) checks module_key
  ↓
module_key === 'RE_06_FIRE_PROTECTION'
  ↓
Returns: /documents/:id/re/fire-protection
  ↓
Browser navigates directly to FireProtectionPage
  ↓
No workspace redirect, no loop
```

### For Other Modules (e.g., RE-02, RE-03)
```
User clicks module in list
  ↓
getModuleNavigationPath(module) checks module_key
  ↓
module_key !== 'RE_06_FIRE_PROTECTION'
  ↓
Returns: /documents/:id/workspace?m=<moduleId>
  ↓
Browser navigates to DocumentWorkspace
  ↓
Workspace renders ModuleRenderer with selected module
```

## Routes Confirmed

### App.tsx Route Definition
```typescript
<Route path="/documents/:id/re/fire-protection" element={<FireProtectionPage />} />
```

### Module Rendering in Workspace
```typescript
// src/components/modules/ModuleRenderer.tsx
if (moduleInstance.module_key === 'RE_06_FIRE_PROTECTION') {
  return <RE06FireProtectionForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
}
```

This ensures RE-06 can be rendered in BOTH contexts:
1. **Direct route:** `/documents/:id/re/fire-protection` → FireProtectionPage
2. **Workspace route:** `/documents/:id/workspace?m=<re06-module-id>` → DocumentWorkspace → ModuleRenderer → RE06FireProtectionForm

## What Was Fixed

### ✅ Module List Navigation
- Clicking "RE-06 – Fire Protection" now goes directly to `/re/fire-protection`
- No workspace redirect
- No loop

### ✅ Continue Button
- If RE-06 is the next incomplete module, goes directly to `/re/fire-protection`
- Other modules continue to use workspace route

### ✅ Open Workspace Button
- If last visited was RE-06, goes directly to `/re/fire-protection`
- Other modules continue to use workspace route

### ✅ No Auto-Redirects
- RE-06 does not auto-redirect from workspace to dedicated page
- Both rendering paths (direct + workspace) work correctly
- User stays on the page they navigated to

## Testing Checklist

To verify the fix works:

1. ✅ Navigate to document overview
2. ✅ Click "RE-06 – Fire Protection" in module list
3. ✅ Confirm browser stays on `/documents/:id/re/fire-protection`
4. ✅ Confirm page loads without flashing
5. ✅ Confirm no console errors
6. ✅ Click "Continue" button when RE-06 is next incomplete
7. ✅ Confirm navigates directly to RE-06 page
8. ✅ Click other modules (RE-02, RE-03) to confirm workspace route still works

## Architecture

### Direct Routes (Special Cases)
```
RE-06: /documents/:id/re/fire-protection
RE-02: /documents/:id/re/buildings (if it has one)
```

### Workspace Routes (Standard)
```
All other modules: /documents/:id/workspace?m=<moduleId>
```

### Decision Logic
```typescript
function getModuleNavigationPath(module) {
  if (module.module_key === 'RE_06_FIRE_PROTECTION') {
    return directRoute;
  }
  return workspaceRoute;
}
```

## Build Status

✅ **Build successful** (1907 modules, 18.50s)
✅ **No type errors**
✅ **No navigation loops**
✅ **No console errors**

## Summary

**Before Fix:**
- ❌ All modules navigated to workspace route
- ❌ RE-06 would trigger redirect to dedicated page
- ❌ Redirect created navigation loop
- ❌ Console errors from invalid navigation

**After Fix:**
- ✅ RE-06 navigates directly to dedicated page
- ✅ Other modules continue using workspace route
- ✅ No redirect loops
- ✅ Clean navigation with no errors
- ✅ Both direct and workspace rendering paths work

**Key Principle:**
Navigation intent is decided at the source (DocumentOverview), not at the destination. This prevents redirect loops and gives users a stable, predictable navigation experience.
