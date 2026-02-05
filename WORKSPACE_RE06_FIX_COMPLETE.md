# Workspace RE-06 Navigation Fix - Complete

## Problem
Workspace was always redirecting to RE-06 Fire Protection, causing users to "lose all modules" when navigating to `/documents/:id/workspace`.

## Root Cause
The previous fix redirected ANY time RE-06 was found, including when localStorage contained RE-06 as the last visited module. This broke the normal workspace flow.

## Solution: Dedicated Module Management System

### 1. Helper Functions (DocumentWorkspace.tsx lines 17-26)
```typescript
// Modules with dedicated routes that should NOT be rendered in workspace
const DEDICATED_MODULE_KEYS = new Set(['RE_06_FIRE_PROTECTION']);

function isDedicatedModule(moduleKey: string): boolean {
  return DEDICATED_MODULE_KEYS.has(moduleKey);
}

function pickFirstWorkspaceModule(modules: ModuleInstance[]): ModuleInstance | null {
  return modules.find(m => !isDedicatedModule(m.module_key)) ?? null;
}
```

### 2. Module Selection Logic (DocumentWorkspace.tsx lines 205-274)

#### Case A: URL has `?m=<moduleId>` (explicit navigation)
- If module is dedicated → redirect to dedicated page
- If module is workspace-compatible → render in workspace
- If module is invalid → fall through to Case B

#### Case B: No `?m=` in URL (default behavior)
- Read last module from localStorage
- If last module is dedicated:
  - Clear it from localStorage
  - Pick first workspace module instead
- If last module is workspace-compatible → use it
- If no last module → pick first workspace module
- Update URL with `?m=<moduleId>` (replace mode)

### 3. Module Selection Handler (DocumentWorkspace.tsx lines 385-407)
```typescript
const handleModuleSelect = (moduleId: string) => {
  const targetModule = modules.find(m => m.id === moduleId);
  if (!targetModule) return;

  // Dedicated modules: navigate to their dedicated route
  if (isDedicatedModule(targetModule.module_key) && id) {
    navigate(getModuleNavigationPath(id, targetModule.module_key, targetModule.id));
    setIsMobileMenuOpen(false);
    // DO NOT save dedicated modules to localStorage
    return;
  }

  // Workspace modules: update state and URL
  setSelectedModuleId(moduleId);
  setSearchParams({ m: moduleId });
  setIsMobileMenuOpen(false);

  // Save workspace module to localStorage (safe - verified not dedicated)
  if (id) {
    localStorage.setItem(`ezirisk:lastModule:${id}`, moduleId);
  }
};
```

## Behavior Matrix

| Scenario | URL | localStorage | Result |
|----------|-----|--------------|--------|
| Click RE-06 in sidebar | - | - | Navigate to `/documents/:id/re/fire-protection` |
| Navigate to `/workspace` | no `?m=` | RE-01 | Load RE-01 in workspace |
| Navigate to `/workspace` | no `?m=` | RE-06 | **Clear localStorage, load first workspace module** |
| Navigate to `/workspace?m=<re06-id>` | RE-06 ID | - | Redirect to `/documents/:id/re/fire-protection` |
| Navigate to `/workspace?m=<re01-id>` | RE-01 ID | - | Load RE-01 in workspace |
| Click RE-01 in workspace sidebar | - | - | Update URL to `?m=<re01-id>`, save to localStorage |
| Click RE-06 in workspace sidebar | - | - | Navigate to `/documents/:id/re/fire-protection`, **DO NOT save to localStorage** |

## Key Rules

1. **Dedicated modules NEVER saved to localStorage**
   - handleModuleSelect explicitly skips localStorage.setItem for dedicated modules
   - Module selection useEffect clears localStorage if it finds a dedicated module

2. **Workspace always opens a workspace-compatible module**
   - If localStorage has RE-06, it's ignored and cleared
   - First non-dedicated module is selected instead

3. **Explicit RE-06 navigation via ?m= redirects**
   - `/workspace?m=<re06-id>` → redirect to `/re/fire-protection`
   - Prevents RE-06 from ever rendering in workspace

4. **No localStorage pollution**
   - Only workspace-compatible modules are persisted
   - RE-06 can never "stick" in localStorage

## Files Modified
- `src/pages/documents/DocumentWorkspace.tsx` (lines 17-26, 205-274, 385-407)

## Testing Checklist
✅ Navigate to `/documents/:id/workspace` - opens first workspace module (RE-01)
✅ Click RE-06 in sidebar - navigates to `/documents/:id/re/fire-protection`
✅ Click back from RE-06 page - returns to document overview
✅ Click "Workspace" quick link - opens last workspace module (not RE-06)
✅ Navigate to `/workspace?m=<re06-id>` - redirects to dedicated page
✅ localStorage never contains RE-06 module ID after any navigation
✅ All other modules (RE-01 through RE-09) work normally in workspace
