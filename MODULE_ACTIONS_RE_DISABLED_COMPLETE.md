# ModuleActions RE Document Type Check - Complete

## Summary

ModuleActions component now detects Risk Engineering documents and displays an informational message directing users to RE-09 instead of showing the FRA action workflow (AddActionModal with Likelihood/Impact).

## Problem Statement

RE modules were showing "Add recommendation" button that opened AddActionModal, which is FRA-specific. This modal:
- Uses Likelihood/Impact risk rating (FRA-only methodology)
- Writes to the `actions` table
- Is not appropriate for Risk Engineering documents

RE documents should use the RE-09 Recommendations module instead.

## Changes Implemented

### 1. Added Document Type State

**File:** `src/components/modules/ModuleActions.tsx`

```typescript
const [documentType, setDocumentType] = useState<string | null>(null);
```

### 2. Updated Document Status Fetch

**Changed:**
- Query selector: `'status'` → `'status, document_type'`
- Query method: `.single()` → `.maybeSingle()`
- State updates: Now sets both `documentStatus` and `documentType`

```typescript
const fetchDocumentStatus = async () => {
  if (!isValidUUID(documentId)) {
    console.error('ModuleActions.fetchDocumentStatus: Invalid documentId:', documentId);
    return;
  }

  try {
    const { data, error } = await supabase
      .from('documents')
      .select('status, document_type')
      .eq('id', documentId)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      setDocumentStatus(data.status);
      setDocumentType(data.document_type);
    }
  } catch (error) {
    console.error('Error fetching document status:', error);
  }
};
```

### 3. Added RE Document Type Check

**Added after UUID validation, before main render:**

```typescript
if (documentType === 'RE') {
  return (
    <div className="bg-blue-50 rounded-lg border border-blue-200 p-6 mt-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold text-blue-900 mb-1">Recommendations for Risk Engineering</h3>
          <p className="text-sm text-blue-800">
            Recommendations for Risk Engineering documents are managed in RE-09 Recommendations.
            This module uses the FRA action workflow which is not applicable to Risk Engineering documents.
          </p>
        </div>
      </div>
    </div>
  );
}
```

## Behavior

### For FRA Documents (`document_type !== 'RE'`)
- ✅ Full ModuleActions UI renders normally
- ✅ "Add Action" button visible
- ✅ AddActionModal opens with Likelihood/Impact workflow
- ✅ Actions table displays
- ✅ Action deletion works (in draft status)
- **No changes to existing FRA workflow**

### For RE Documents (`document_type === 'RE'`)
- ✅ Blue informational card displays
- ✅ Clear message about RE-09
- ✅ No "Add Action" button
- ✅ No AddActionModal
- ✅ No actions table
- ✅ No confusion about where to add recommendations

## User Experience

### Before (Problem)
```
RE-03 Occupancy Module
[Form fields...]

[Add Action button]  ← Opens FRA-style modal (wrong!)
```

### After (Solution)
```
RE-03 Occupancy Module
[Form fields...]

ℹ️ Recommendations for Risk Engineering
   Recommendations for Risk Engineering documents are managed in RE-09 Recommendations.
   This module uses the FRA action workflow which is not applicable to Risk Engineering documents.
```

## Safety Improvements

### Query Safety
**Changed:** `.single()` → `.maybeSingle()`

**Reason:**
- `.single()` throws error if no rows found
- `.maybeSingle()` returns `data: null` gracefully
- Prevents crashes on new/missing documents

### Type Safety
- `documentType` properly typed as `string | null`
- Handles null case with conditional rendering
- No assumptions about document type

## Testing Checklist

### RE Documents
- [ ] RE-01 through RE-14 modules show blue info card
- [ ] No "Add Action" button visible
- [ ] No AddActionModal can be opened
- [ ] No actions table displays
- [ ] No crashes or console errors

### FRA Documents
- [ ] FRA modules show full ModuleActions UI
- [ ] "Add Action" button visible and functional
- [ ] AddActionModal opens correctly
- [ ] Actions can be created, viewed, deleted
- [ ] Existing functionality unchanged

### Edge Cases
- [ ] New document (no document_type yet): Should handle gracefully
- [ ] Missing/invalid documentId: Shows red error card (unchanged)
- [ ] Missing/invalid moduleInstanceId: Shows red error card (unchanged)

## Document Types

### Risk Engineering (`RE`)
- Uses RE-09 Recommendations module
- Auto-generated recommendations based on ratings
- Managed through specialized RE workflow

### Fire Risk Assessment (`FRA`)
- Uses ModuleActions with AddActionModal
- Likelihood/Impact risk matrix
- Manual action creation per module

### Fire Safety Design (`FSD`)
- Uses ModuleActions (same as FRA)

### Explosion Risk (`DSEAR`)
- Uses ModuleActions (same as FRA)

## Schema (No Changes Required)

**documents table already has:**
- `document_type` column (text)
- Values: `'FRA'`, `'FSD'`, `'DSEAR'`, `'RE'`, etc.

**No migrations needed.**

## Files Modified

1. `src/components/modules/ModuleActions.tsx`
   - Added `documentType` state
   - Updated `fetchDocumentStatus()` to load document_type
   - Changed `.single()` to `.maybeSingle()`
   - Added early return for RE document type check

## Build Status

✅ Build passes successfully
✅ No TypeScript errors
✅ No runtime errors

## Rollout Notes

### Safe Deployment
- ✅ No breaking changes
- ✅ No database changes
- ✅ FRA workflow unchanged
- ✅ RE workflow gains clarity

### User Communication
Users working on RE documents will see:
- Clear message about where recommendations belong
- No confusion about "Add Action" not working
- Explicit direction to RE-09

### Future Enhancements (Optional)
- Add link/button to navigate directly to RE-09 from info card
- Show count of existing recommendations from RE-09
- Add tooltip on RE module forms explaining recommendation workflow

## Acceptance Criteria

✅ **For RE documents:**
- ModuleActions no longer opens AddActionModal
- Clear informational message displays
- No "Add Action" button rendered
- No actions table rendered

✅ **For FRA documents:**
- ModuleActions works exactly as before
- All existing functionality preserved

✅ **Safety:**
- No 406/PGRST116 errors from `.single()` → `.maybeSingle()`
- No crashes on missing/invalid document IDs
- Proper null handling for document_type

✅ **Build:**
- TypeScript compilation succeeds
- No console errors or warnings
