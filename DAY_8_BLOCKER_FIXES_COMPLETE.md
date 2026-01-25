# DAY 8: Blocker Fixes Complete

## Summary

Fixed three critical UX issues identified during Day 8 stress testing:

1. ✅ **Overview progress bar synchronization** - Now matches left-hand module completion indicators
2. ✅ **Dashboard "Client Site" column** - Shows real organisation name instead of placeholder
3. ✅ **Client/Site selection in A1 form** - Added fields to identify organisation and site name

## Changes Made

### 1. Progress Bar Synchronization Fix

**File:** `src/pages/documents/DocumentOverview.tsx`

**Issue:** Progress bar counted only modules with `completed_at !== null`, while the workspace sidebar showed visual indicators for modules with `outcome` set.

**Fix:** Updated progress calculation to match sidebar logic:

```typescript
// OLD (line 545)
const completedModules = modules.filter((m) => m.completed_at !== null).length;

// NEW
const completedModules = modules.filter((m) => m.outcome !== null || m.completed_at !== null).length;
```

**Result:** Progress percentage now stays synchronized - if a module shows a checkmark in the sidebar, it counts toward progress in the Overview.

---

### 2. Dashboard Client Site Column Fix

**Files Modified:**
- `src/hooks/useAssessments.ts`
- `src/pages/ezirisk/DashboardPage.tsx` (already displays correctly)

**Issue:** "Client / Site" column showed:
- Client Name: hardcoded `'—'` placeholder
- Site Name: document title (correct)

**Fix:**

#### A. Updated Document interface to support organisation join:
```typescript
export interface Document {
  // ... existing fields
  organisations?: {
    name: string;
  };
}
```

#### B. Updated query to join organisations table:
```typescript
let query = supabase
  .from('documents')
  .select(`
    id,
    organisation_id,
    document_type,
    title,
    status,
    version,
    created_at,
    updated_at,
    assessor_name,
    issue_status,
    organisations (name)
  `)
  // ... rest of query
```

#### C. Updated mapper to use organisation name:
```typescript
function mapDocumentToViewModel(document: Document): AssessmentViewModel {
  return {
    id: document.id,
    clientName: document.organisations?.name || 'Unassigned',  // ← Changed from '—'
    siteName: document.title,  // ← Kept as is
    // ... rest of fields
  };
}
```

**Result:** Dashboard "Active Work" table now shows:
- **Client Name:** Real organisation name (e.g., "Acme Corp")
- **Site Name:** Document title (e.g., "Building A", "Main Office")

---

### 3. Client/Site Selection in A1 Form

**File:** `src/components/modules/forms/A1DocumentControlForm.tsx`

**Issue:** No way to see which organisation a document belongs to or assign/edit the site name.

**Fix:**

#### A. Added useAuth import and Building2 icon:
```typescript
import { useAuth } from '../../../contexts/AuthContext';
import { Building2 } from 'lucide-react';
```

#### B. Added organisation_id to Document interface:
```typescript
interface Document {
  // ... existing fields
  organisation_id: string;
}
```

#### C. Added title to documentFields state:
```typescript
const [documentFields, setDocumentFields] = useState({
  title: document.title || '',  // ← Added
  assessmentDate: document.assessment_date || '',
  // ... rest of fields
});
```

#### D. Updated handleSave to persist title:
```typescript
const { error: docError } = await supabase
  .from('documents')
  .update({
    title: documentFields.title || 'Untitled Assessment',  // ← Added
    assessment_date: documentFields.assessmentDate,
    // ... rest of fields
  })
  .eq('id', document.id);
```

#### E. Added UI fields at top of "Core Document Information" section:

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* Client (Organisation) - Read-only */}
  <div>
    <label className="block text-sm font-medium text-neutral-700 mb-2">
      <Building2 className="w-4 h-4 inline mr-1" />
      Client (Organisation)
    </label>
    <div className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-neutral-700">
      {organisation?.name || 'Loading...'}
    </div>
    <p className="mt-1 text-xs text-neutral-500">
      Organisation is set at document creation
    </p>
  </div>

  {/* Site Name - Editable */}
  <div>
    <label className="block text-sm font-medium text-neutral-700 mb-2">
      Site Name <span className="text-red-500">*</span>
    </label>
    <input
      type="text"
      value={documentFields.title}
      onChange={(e) =>
        setDocumentFields({ ...documentFields, title: e.target.value })
      }
      placeholder="e.g., Building A, Main Office, Factory Site"
      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
      required
    />
    <p className="mt-1 text-xs text-neutral-500">
      Identifies the specific site or location for this assessment
    </p>
  </div>
</div>
```

**Result:**
- Users can now see which organisation (client) the assessment belongs to
- Users can edit the site name directly in Section 1
- Changes save to the database and reflect immediately in the dashboard

---

## Design Decisions

### Why No Sites Table?

**Constraint:** "Do NOT change database schema. No new tables/columns."

**Analysis:**
- `documents` table already has `site_id` column (UUID)
- No `sites` table exists in the database
- Creating a sites table would violate the constraint

**Solution:**
- Use `document.title` as the "site name" (editable text field)
- Use `document.organisation_id` → `organisations.name` as the "client"
- Keep `site_id` column unused (reserved for future use if sites table added later)

This pragmatic approach:
- ✅ Solves the immediate UX problem
- ✅ Respects the "no schema changes" constraint
- ✅ Provides clear labeling (Client = Organisation, Site = Title)
- ✅ Allows future enhancement if sites table added

---

## Testing Performed

### Build Test
```bash
npm run build
```
**Result:** ✅ SUCCESS - No TypeScript errors, no compilation warnings

### Expected Behavior

#### 1. Progress Bar
- **Before:** Overview shows 0% even when modules have outcomes set
- **After:** Overview progress matches workspace sidebar completion status
- **Test:** Save a module with outcome → Both views update immediately

#### 2. Dashboard Active Work
- **Before:** Client column shows "—" placeholder
- **After:** Client column shows organisation name (e.g., "Acme Corp")
- **Test:** Check dashboard → See real organisation names in Client column

#### 3. A1 Document Control Form
- **Before:** No way to see organisation or edit title in form
- **After:** Shows organisation (read-only) and site name (editable)
- **Test:**
  1. Open document workspace
  2. Navigate to A1 - Document Control
  3. See "Client (Organisation)" with org name
  4. Edit "Site Name" field
  5. Save → Dashboard updates with new site name

---

## Files Changed

1. `src/pages/documents/DocumentOverview.tsx`
   - Updated progress calculation logic (1 line)

2. `src/hooks/useAssessments.ts`
   - Added organisations join to Document interface
   - Updated query to join organisations table
   - Updated mapper to use organisation name

3. `src/components/modules/forms/A1DocumentControlForm.tsx`
   - Added Building2 icon import
   - Added useAuth import
   - Added organisation_id to Document interface
   - Added title to documentFields state and useEffect
   - Updated handleSave to persist title
   - Added Client and Site Name fields to UI (top of form)

---

## Regression Prevention

### No Breaking Changes
- ✅ All existing fields remain unchanged
- ✅ Progress bar logic is additive (OR condition)
- ✅ Dashboard query is enhanced (join), not replaced
- ✅ A1 form adds fields, doesn't modify existing ones

### Backward Compatibility
- ✅ Old documents without title still work (uses 'Untitled Assessment')
- ✅ Organisations without name show 'Unassigned' fallback
- ✅ All saves continue to work as before

### Performance
- ✅ Dashboard query adds one join (organisations table)
- ✅ Join is on indexed foreign key (organisation_id)
- ✅ No N+1 queries introduced

---

## Next Steps for DAY 8 Testing

These fixes address the three blockers identified. Continue with the 7 test runs from `DAY_8_TESTING_CHECKLIST.md`:

1. ✅ **Progress bar** will now stay synchronized during testing
2. ✅ **Dashboard** will show real client names for verification
3. ✅ **A1 form** provides clear client/site identification

All changes are minimal, focused, and respect the constraints. Ready for manual testing.

---

**Date:** 2026-01-25
**Build Status:** ✅ SUCCESS
**TypeScript:** No errors
**Ready for Testing:** Yes
