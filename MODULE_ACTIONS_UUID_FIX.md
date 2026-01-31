# ModuleActions UUID Validation Fix

**Date:** 2026-01-31  
**Status:** ✅ COMPLETE  
**Files Modified:**
- `src/components/modules/ModuleActions.tsx`
- `src/components/modules/forms/RiskEngineeringForm.tsx`

---

## Problem

ModuleActions component was making Supabase queries with `undefined` IDs:
- `documents?select=status&id=eq.undefined`
- `actions?...&module_instance_id=eq.undefined`

This caused:
- 400 Bad Request errors from Supabase
- PostgreSQL 22P02 errors (invalid UUID format)
- Console spam with error messages

**Root Causes:**
1. RiskEngineeringForm was passing entire objects instead of ID strings
2. ModuleActions had no validation to prevent queries with invalid IDs
3. No early return guards in useEffect or fetch functions

---

## Solution

### 1. Added UUID Validation Function

```typescript
const isValidUUID = (id: string | undefined | null): boolean => {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};
```

**Purpose:** Validates that IDs are non-null, non-undefined, and valid UUID format.

---

### 2. Guards in useEffect

**Before:**
```typescript
useEffect(() => {
  fetchActions();
  fetchDocumentStatus();
}, [moduleInstanceId, documentId]);
```

**After:**
```typescript
useEffect(() => {
  if (!isValidUUID(documentId)) {
    console.warn('ModuleActions: Invalid documentId provided:', documentId);
    setIsLoading(false);
    return;
  }
  if (!isValidUUID(moduleInstanceId)) {
    console.warn('ModuleActions: Invalid moduleInstanceId provided:', moduleInstanceId);
    setIsLoading(false);
    return;
  }
  fetchActions();
  fetchDocumentStatus();
}, [moduleInstanceId, documentId]);
```

**Effect:**
- No fetch calls if IDs are invalid
- Explicit console warnings for debugging
- Loading state set to false to prevent spinner

---

### 3. Guards in fetchActions

**Added at start of function:**
```typescript
const fetchActions = async () => {
  if (!isValidUUID(moduleInstanceId)) {
    console.error('ModuleActions.fetchActions: Invalid moduleInstanceId:', moduleInstanceId);
    setIsLoading(false);
    return;
  }
  
  setIsLoading(true);
  // ... rest of fetch logic
};
```

**Effect:**
- No Supabase query if moduleInstanceId is invalid
- Early return prevents API calls with `eq.undefined`

---

### 4. Guards in fetchDocumentStatus

**Added at start of function:**
```typescript
const fetchDocumentStatus = async () => {
  if (!isValidUUID(documentId)) {
    console.error('ModuleActions.fetchDocumentStatus: Invalid documentId:', documentId);
    return;
  }
  
  try {
    // ... rest of fetch logic
  }
};
```

**Effect:**
- No Supabase query if documentId is invalid
- Early return prevents API calls with `eq.undefined`

---

### 5. Visual Error Feedback

**Added early return in render:**
```typescript
const hasValidIds = isValidUUID(documentId) && isValidUUID(moduleInstanceId);

if (!hasValidIds) {
  return (
    <div className="bg-red-50 rounded-lg border border-red-200 p-6 mt-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold text-red-900 mb-1">Invalid Module Configuration</h3>
          <p className="text-sm text-red-700">
            Cannot load actions: Missing or invalid document ID or module instance ID.
          </p>
          <div className="mt-2 text-xs font-mono text-red-600 space-y-1">
            <div>documentId: {documentId || '(missing)'}</div>
            <div>moduleInstanceId: {moduleInstanceId || '(missing)'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Effect:**
- Clear visual indicator when IDs are invalid
- Shows actual values for debugging
- Prevents silent failures

---

### 6. Fixed RiskEngineeringForm Props

**Before (WRONG):**
```tsx
<ModuleActions
  moduleInstance={moduleInstance}
  document={document}
  onUpdate={onSaved}
/>
```

**After (CORRECT):**
```tsx
<ModuleActions
  documentId={document.id}
  moduleInstanceId={moduleInstance.id}
/>
```

**Why This Matters:**
- ModuleActions expects `string` props (`documentId`, `moduleInstanceId`)
- RiskEngineeringForm was passing entire objects
- TypeScript interface mismatch caused `undefined` values
- Removed unused `onUpdate` prop (not in ModuleActions interface)

---

## Testing

### Scenarios Covered

1. **Valid IDs:**
   - ✅ Fetch runs normally
   - ✅ Actions load correctly
   - ✅ Document status loads correctly

2. **Invalid documentId:**
   - ✅ No fetch to `/documents?...&id=eq.undefined`
   - ✅ Console warning logged
   - ✅ Red error panel shown with ID values
   - ✅ Loading state set to false

3. **Invalid moduleInstanceId:**
   - ✅ No fetch to `/actions?...&module_instance_id=eq.undefined`
   - ✅ Console warning logged
   - ✅ Red error panel shown with ID values
   - ✅ Loading state set to false

4. **Both IDs invalid:**
   - ✅ No fetches at all
   - ✅ Red error panel shown
   - ✅ Both IDs displayed for debugging

---

## Acceptance Criteria

All met:

- ✅ No requests to `...id=eq.undefined`
- ✅ No requests to `...module_instance_id=eq.undefined`
- ✅ Console no longer shows 22P02 uuid errors from ModuleActions
- ✅ Invalid IDs show clear error message instead of silent failure
- ✅ Valid IDs work normally without changes

---

## Other Forms Checked

Verified that other forms already pass correct props:

```tsx
// FRA1FireHazardsForm.tsx (CORRECT)
<ModuleActions
  documentId={document.id}
  moduleInstanceId={moduleInstance.id}
/>

// A2BuildingProfileForm.tsx (CORRECT)
<ModuleActions
  key={actionsReloadKey}
  documentId={document.id}
  moduleInstanceId={moduleInstance.id}
/>
```

**Only RiskEngineeringForm had the incorrect pattern.**

---

## Build Status

```bash
npm run build
✓ 1908 modules transformed
✓ built in 16.39s
```

**Result:** ✅ Build successful, no TypeScript errors

---

## Summary

Fixed ModuleActions to:
1. Validate UUIDs before making Supabase queries
2. Show clear error messages when IDs are invalid
3. Prevent all `eq.undefined` API calls

Fixed RiskEngineeringForm to:
1. Pass `document.id` instead of entire `document` object
2. Pass `moduleInstance.id` instead of entire `moduleInstance` object
3. Match ModuleActions TypeScript interface exactly

**No more Supabase 400 errors or UUID parsing errors from ModuleActions.**
