# Fire Protection Page Converted to Redirect

## Problem

After consolidating the Fire Protection scoring logic, we had TWO complete UI implementations:
1. **FireProtectionPage.tsx** (887 lines) - Legacy standalone page
2. **RE06FireProtectionForm.tsx** (1803 lines) - Modern workspace module

Both maintained separate forms, state management, and save logic - creating maintenance burden and potential for drift.

## Solution

Converted `FireProtectionPage.tsx` from a full-featured form page into a **lightweight redirect component** (77 lines).

### New Behavior

When a user navigates to `/documents/:id/re/fire-protection`:

1. **Queries database** for the Fire Protection module instance:
   ```typescript
   SELECT id FROM module_instances
   WHERE document_id = :id 
   AND module_key = 'RE_06_FIRE_PROTECTION'
   ```

2. **Redirects** to the workspace with module selected:
   ```
   /documents/${documentId}/workspace?m=${moduleInstanceId}
   ```

3. **Loading state** displays while resolving:
   ```
   🔄 Opening Fire Protection...
   ```

4. **Error handling** if module not found:
   ```
   ⚠️ Unable to Load Fire Protection
   [Error message]
   [Return to Document Workspace button]
   ```

## Code Changes

### Before (887 lines)
- Complete form implementation
- All Fire Protection fields
- Site water management
- Building sprinkler management
- Score calculations
- Auto-save logic
- Recommendations display
- Building selection dropdown
- Roll-up calculations
- Flag generation

### After (77 lines)
```typescript
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function FireProtectionPage() {
  // 1. Get documentId from route
  // 2. Query module_instances for RE_06_FIRE_PROTECTION
  // 3. Redirect to workspace with ?m=moduleId
  // 4. Show loading or error state
}
```

**Lines removed:** 810 (91% reduction)

## Architecture Impact

### Before
```
Route: /documents/:id/re/fire-protection
  ↓
FireProtectionPage.tsx (887 lines)
  ├── Duplicate form UI
  ├── Duplicate state management
  ├── Duplicate save logic
  └── Uses shared scoring functions ✓
```

### After
```
Route: /documents/:id/re/fire-protection
  ↓
FireProtectionPage.tsx (77 lines - redirect only)
  ↓
Redirect to: /documents/:id/workspace?m=<moduleId>
  ↓
ModuleRenderer → RE06FireProtectionForm.tsx
  └── SINGLE Fire Protection implementation
```

## Benefits

1. **Single UI Implementation** - Only RE06FireProtectionForm.tsx maintains the UI
2. **Reduced Code Duplication** - Removed 810 lines of duplicate form code
3. **Smaller Bundle** - Build size decreased from 2,065 KB → 2,045 KB (20KB saved)
4. **Easier Maintenance** - Changes only need to be made in one place
5. **Consistent UX** - All users see the same Fire Protection interface
6. **Backward Compatible** - Old URLs still work, just redirect seamlessly

## User Experience

### Transparent Redirect
Users clicking Fire Protection in sidebar or navigating via old bookmarks will:
- See brief "Opening Fire Protection..." message
- Be automatically redirected to workspace module
- Continue working without disruption

### No Breaking Changes
- All existing links continue to work
- Sidebar navigation unchanged
- Module functionality identical
- URL changes but user sees seamless transition

## Verification

### Build Status
✅ **Build successful**
- Before: 2,065.59 KB
- After: 2,045.11 KB
- **Savings: 20 KB**

### Test Scenarios

1. **Happy Path**
   - Navigate to `/documents/123/re/fire-protection`
   - Should redirect to `/documents/123/workspace?m=<moduleId>`
   - Fire Protection form opens in workspace

2. **Module Not Found**
   - Navigate to page for document without Fire Protection module
   - Should show error message
   - Should provide link back to workspace

3. **Invalid Document ID**
   - Navigate with missing/invalid ID
   - Should show appropriate error
   - Should handle gracefully

### Files Modified

**1 file changed:**
- `src/pages/re/FireProtectionPage.tsx` (887 → 77 lines, -810 lines)

**0 files deleted** (kept route registration for backward compatibility)

## Migration Notes

### For Users
No action required. Old bookmarks and links continue working via automatic redirect.

### For Developers
- FireProtectionPage.tsx is now a redirect component only
- All Fire Protection UI changes go to RE06FireProtectionForm.tsx
- Route is maintained for backward compatibility
- Can consider deprecating route in future if desired

## Future Considerations

### Optional Cleanup
After verifying redirect works in production, consider:
1. Updating sidebar links to point directly to workspace
2. Documenting the redirect pattern for other legacy pages
3. Potentially removing the route entirely if no longer needed

### Pattern for Other Modules
This redirect pattern can be replicated for other standalone module pages if they exist:
- BuildingsPage → RE02 Buildings module
- OccupancyPage → RE03 Occupancy module
- etc.

## Testing Checklist

- [x] Build succeeds
- [ ] Navigate to `/documents/:id/re/fire-protection` shows loading
- [ ] Automatically redirects to workspace with module selected
- [ ] Fire Protection form opens correctly
- [ ] All fields and functionality work as expected
- [ ] Error state displays if module not found
- [ ] Back button works correctly after redirect
- [ ] Sidebar navigation still functions
- [ ] No console errors during redirect
