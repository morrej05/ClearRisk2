# Combined Survey Creation Implementation Complete

## Objective
Enable users to create surveys with multiple modules (FRA + FSD) selected at creation time.
Store enabled_modules in the database and show appropriate navigation and headers.

## Status: ✅ COMPLETE

All combined survey creation changes implemented. Users can now select both FRA and FSD when creating a new document.

---

## Changes Made

### 1. Database Schema (Already Existed)

#### Migration: `20260125105152_add_enabled_modules_to_documents.sql`

**Column Added:**
```sql
ALTER TABLE documents ADD COLUMN enabled_modules TEXT[];
```

**Features:**
- Array of enabled module types: `['FRA']`, `['FSD']`, `['DSEAR']`, or `['FRA', 'FSD']`
- Constraint ensures only valid module names: `FRA`, `FSD`, `DSEAR`
- GIN index for efficient array queries
- Backfilled from existing `document_type` column for backward compatibility

**Helper Functions:**
```sql
-- Get active modules for a document
get_document_modules(doc_row documents) → TEXT[]

-- Check if document has specific module
document_has_module(doc_row documents, module_name TEXT) → BOOLEAN
```

**Backward Compatibility:**
- `document_type` column retained (not removed)
- Falls back to `document_type` if `enabled_modules` is NULL
- Existing documents automatically backfilled

---

### 2. Create Document UI Updated

#### File: `src/components/documents/CreateDocumentModal.tsx`

**Before:**
- Dropdown selector for single document type
- Options: FRA, FSD, DSEAR (one choice)

**After:**
- Checkbox group for module selection
- Can select multiple modules (FRA + FSD)
- At least one module required
- Professional plan gating for FSD and DSEAR

**Form State Change:**
```typescript
// Before
const [formData, setFormData] = useState({
  documentType: 'FRA',  // single value
  // ...
});

// After
const [formData, setFormData] = useState({
  enabledModules: ['FRA'] as string[],  // array of modules
  // ...
});
```

**UI Structure:**
```tsx
<label className="flex items-start gap-3 px-4 py-3 border-2 ...">
  <input
    type="checkbox"
    checked={formData.enabledModules.includes('FRA')}
    onChange={() => handleModuleToggle('FRA')}
  />
  <div className="flex-1">
    <span className="text-sm font-medium">Fire Risk Assessment (FRA)</span>
    <p className="text-xs text-neutral-600">Regulatory compliance assessment under RRO</p>
  </div>
</label>
```

**Module Toggle Logic:**
```typescript
const handleModuleToggle = (moduleType: string) => {
  setFormData((prev) => {
    const isCurrentlyEnabled = prev.enabledModules.includes(moduleType);

    if (isCurrentlyEnabled) {
      // Prevent unchecking the last module
      const newModules = prev.enabledModules.filter((m) => m !== moduleType);
      return {
        ...prev,
        enabledModules: newModules.length > 0 ? newModules : prev.enabledModules,
      };
    } else {
      return {
        ...prev,
        enabledModules: [...prev.enabledModules, moduleType],
      };
    }
  });
};
```

**Validation:**
```typescript
if (formData.enabledModules.length === 0) {
  alert('Please select at least one assessment type.');
  return;
}
```

---

### 3. Document Creation Logic Updated

**Primary Document Type Logic:**
```typescript
const enabledModules = formData.enabledModules;
const primaryDocumentType = enabledModules.includes('FRA') ? 'FRA' :
                            enabledModules.includes('FSD') ? 'FSD' :
                            enabledModules.includes('DSEAR') ? 'DSEAR' : 'FRA';

const documentData = {
  organisation_id: organisation.id,
  document_type: primaryDocumentType,       // backward compatibility
  enabled_modules: enabledModules,           // new array field
  title: formData.title.trim(),
  // ...
};
```

**Module Instance Creation:**
```typescript
// Before: Single module skeleton
const moduleKeys = MODULE_SKELETONS['FRA'] || [];

// After: Merge all selected module skeletons
const allModuleKeys = new Set<string>();
enabledModules.forEach((moduleType) => {
  const skeleton = MODULE_SKELETONS[moduleType as keyof typeof MODULE_SKELETONS] || [];
  skeleton.forEach((key) => allModuleKeys.add(key));
});

const moduleInstances = Array.from(allModuleKeys).map((moduleKey) => ({
  organisation_id: organisation.id,
  document_id: document.id,
  module_key: moduleKey,
  module_scope: 'document',
  outcome: null,
  assessor_notes: '',
  data: {},
}));
```

**Module Deduplication:**
- Shared modules (A1, A2, A3) appear only once
- FRA-specific modules included when FRA selected
- FSD-specific modules included when FSD selected
- Combined: All modules from both skeletons, no duplicates

**Example Combined Module List:**
```
Combined FRA + FSD:
- A1_DOC_CONTROL (shared)
- A2_BUILDING_PROFILE (shared)
- A3_PERSONS_AT_RISK (shared)
- A4_MANAGEMENT_CONTROLS (FRA)
- A5_EMERGENCY_ARRANGEMENTS (FRA)
- FRA_1_HAZARDS (FRA)
- FRA_2_ESCAPE_ASIS (FRA)
- FRA_3_PROTECTION_ASIS (FRA)
- FRA_4_SIGNIFICANT_FINDINGS (FRA)
- FRA_5_EXTERNAL_FIRE_SPREAD (FRA)
- FSD_1_REG_BASIS (FSD)
- FSD_2_EVAC_STRATEGY (FSD)
- FSD_3_ESCAPE_DESIGN (FSD)
- FSD_4_PASSIVE_PROTECTION (FSD)
- FSD_5_ACTIVE_SYSTEMS (FSD)
- FSD_6_FRS_ACCESS (FSD)
- FSD_7_DRAWINGS (FSD)
- FSD_8_SMOKE_CONTROL (FSD)
- FSD_9_CONSTRUCTION_PHASE (FSD)
```

---

### 4. Navigation Visibility

**Automatic Filtering:**
Navigation automatically shows correct modules because:
1. Only module instances for selected modules are created in database
2. Navigation renders all module instances for the document
3. No additional filtering needed in UI code

**Result:**
- FRA-only document → Shows only FRA modules in navigation
- FSD-only document → Shows only FSD modules in navigation
- Combined document → Shows all FRA + FSD modules in navigation
- Shared sections appear once (not duplicated)

---

### 5. Document Type Labels Updated

#### File: `src/pages/documents/DocumentWorkspace.tsx`

**Helper Function:**
```typescript
const getDocumentTypeLabel = (document: Document): string => {
  const enabledModules = document.enabled_modules || [document.document_type];

  if (enabledModules.length > 1) {
    const labels = enabledModules.map((mod) => {
      if (mod === 'FRA') return 'Fire Risk Assessment';
      if (mod === 'FSD') return 'Fire Strategy Document';
      if (mod === 'DSEAR') return 'Explosive Atmospheres';
      return mod;
    });
    return labels.join(' + ');
  }

  if (enabledModules.includes('FRA')) return 'Fire Risk Assessment';
  if (enabledModules.includes('FSD')) return 'Fire Strategy Document';
  if (enabledModules.includes('DSEAR')) return 'Explosive Atmospheres';
  return document.document_type;
};
```

**Display:**
```tsx
<p className="text-xs text-neutral-500">
  {getDocumentTypeLabel(document)} • v{document.version} • {document.status}
</p>
```

**Examples:**
- FRA-only: `"Fire Risk Assessment • v1 • draft"`
- FSD-only: `"Fire Strategy Document • v1 • draft"`
- Combined: `"Fire Risk Assessment + Fire Strategy Document • v1 • draft"`

---

### 6. TypeScript Interfaces Updated

**Document Interface:**
```typescript
interface Document {
  id: string;
  document_type: string;          // kept for backward compatibility
  enabled_modules?: string[];     // new field
  title: string;
  // ... other fields
}
```

**Updated In:**
- `src/pages/documents/DocumentWorkspace.tsx`
- `src/pages/documents/DocumentOverview.tsx`
- `src/lib/pdf/buildCombinedPdf.ts` (already updated in Day 4)

---

## User Experience Flow

### Creating FRA-Only Document

1. Click "Create New Document"
2. Check "Fire Risk Assessment (FRA)" (default checked)
3. Fill in title and metadata
4. Click "Create Document"
5. **Result:**
   - `enabled_modules = ['FRA']`
   - `document_type = 'FRA'`
   - FRA modules created
   - Header: "Fire Risk Assessment"

### Creating FSD-Only Document (Professional Plan)

1. Click "Create New Document"
2. Uncheck "Fire Risk Assessment (FRA)"
3. Check "Fire Strategy Document (FSD)"
4. Fill in title and metadata
5. Click "Create Document"
6. **Result:**
   - `enabled_modules = ['FSD']`
   - `document_type = 'FSD'`
   - FSD modules created
   - Header: "Fire Strategy Document"

### Creating Combined FRA + FSD Document (Professional Plan)

1. Click "Create New Document"
2. Check both:
   - ✓ Fire Risk Assessment (FRA)
   - ✓ Fire Strategy Document (FSD)
3. Fill in title and metadata
4. Click "Create Document"
5. **Result:**
   - `enabled_modules = ['FRA', 'FSD']`
   - `document_type = 'FRA'` (primary type for backward compatibility)
   - All FRA + FSD modules created (merged, deduplicated)
   - Header: "Fire Risk Assessment + Fire Strategy Document"
   - Navigation shows both FRA and FSD sections
   - Shared sections (A1, A2, A3) appear once

---

## Testing Scenarios

### Test 1: FRA-Only Creation
1. Create FRA-only document
2. ✅ **Expected:**
   - enabled_modules = ['FRA']
   - Only FRA modules in navigation
   - Header: "Fire Risk Assessment"
   - Existing behavior preserved

### Test 2: FSD-Only Creation (Professional Plan)
1. Create FSD-only document
2. ✅ **Expected:**
   - enabled_modules = ['FSD']
   - Only FSD modules in navigation
   - Header: "Fire Strategy Document"
   - Works same as before

### Test 3: Combined FRA + FSD Creation
1. Check both FRA and FSD
2. Create document
3. ✅ **Expected:**
   - enabled_modules = ['FRA', 'FSD']
   - Navigation shows:
     - Common sections (A1, A2, A3) once
     - All FRA-specific modules
     - All FSD-specific modules
   - Header: "Fire Risk Assessment + Fire Strategy Document"
   - Can complete both FRA and FSD modules
   - Report preview shows combined output (from Day 4)

### Test 4: At Least One Module Required
1. Create document
2. Uncheck FRA (the last checked module)
3. ✅ **Expected:**
   - Checkbox remains checked
   - Cannot proceed with zero modules
   - Validation message: "Please select at least one assessment type."

### Test 5: Professional Plan Gating
1. Without Professional plan
2. Try to check FSD or DSEAR
3. ✅ **Expected:**
   - Checkboxes disabled
   - "Pro" badge shown
   - Upgrade prompt displayed
   - FRA checkbox still works

### Test 6: Existing Documents Backward Compatible
1. Open existing FRA document (created before this feature)
2. ✅ **Expected:**
   - enabled_modules auto-backfilled or falls back to document_type
   - Navigation works correctly
   - Header shows correct label
   - No breaking changes

---

## Key Design Decisions

### 1. Why Keep `document_type` Column?
- **Backward compatibility** with existing code
- Allows gradual migration
- Fallback for documents without `enabled_modules`
- No breaking changes to existing queries

### 2. Why Use Set for Module Deduplication?
- Shared modules (A1, A2, A3) used by both FRA and FSD
- Set ensures each module appears exactly once
- Prevents duplicate module instances
- Cleaner navigation (no repeated sections)

### 3. Why Primary Document Type = FRA for Combined?
- Need single value for `document_type` (for backward compatibility)
- FRA chosen as primary since it's typically the regulatory requirement
- FSD is often supplementary to FRA
- Doesn't affect functionality (enabled_modules is source of truth)

### 4. Why Checkbox UI Instead of Multi-Select Dropdown?
- **Better UX:** Clear visual indication of what's selected
- **Easier to understand:** Can see all options at once
- **Better for mobile:** Larger touch targets
- **Extensible:** Easy to add descriptions under each option
- **Clear gating:** Professional plan badges visible inline

### 5. Why Validate at Least One Module?
- Document must have at least one module to be useful
- Prevents empty/invalid documents
- Clear error message guides user
- Enforced in UI and would be enforced in backend (if needed)

---

## Files Created/Modified

### Modified:
```
src/components/documents/CreateDocumentModal.tsx
  - Replaced dropdown with checkbox group
  - Added handleModuleToggle function
  - Updated form state (documentType → enabledModules)
  - Updated submission logic to merge module skeletons
  - Added validation for at least one module

src/pages/documents/DocumentWorkspace.tsx
  - Added getDocumentTypeLabel helper function
  - Updated Document interface (added enabled_modules)
  - Updated header to use getDocumentTypeLabel

src/pages/documents/DocumentOverview.tsx
  - Updated Document interface (added enabled_modules)
```

### Unchanged (Automatically Work):
```
Navigation rendering (already uses module instances)
Module ordering (sortModulesByOrder already handles any modules)
Report generation (Day 4 already handles enabled_modules)
PDF builders (Day 4 already handles combined documents)
```

---

## Database State

### Single-Module Document (FRA-only):
```json
{
  "id": "abc-123",
  "document_type": "FRA",
  "enabled_modules": ["FRA"],
  "title": "Site A Fire Risk Assessment"
}
```

### Single-Module Document (FSD-only):
```json
{
  "id": "def-456",
  "document_type": "FSD",
  "enabled_modules": ["FSD"],
  "title": "Site B Fire Strategy"
}
```

### Combined Document (FRA + FSD):
```json
{
  "id": "ghi-789",
  "document_type": "FRA",
  "enabled_modules": ["FRA", "FSD"],
  "title": "Site C Combined Fire Assessment"
}
```

### Legacy Document (Before This Feature):
```json
{
  "id": "old-001",
  "document_type": "FRA",
  "enabled_modules": null,  // will be backfilled or fall back to document_type
  "title": "Old Site FRA"
}
```

---

## Integration with Day 4 (Combined Report Output)

Combined survey creation (this feature) + Combined report output (Day 4) work together:

1. **Creation:** User selects FRA + FSD → Document created with `enabled_modules = ['FRA', 'FSD']`
2. **Editing:** User completes both FRA and FSD modules
3. **Preview:** Report preview detects `enabled_modules` → Shows "Combined FRA + FSD" output mode
4. **Issue:** Issue process generates combined PDF (Day 4 logic)
5. **Download:** Compliance pack includes combined PDF

**Full Flow:**
```
Create combined document
  ↓
Complete modules (both FRA and FSD)
  ↓
Preview report (combined output selected by default)
  ↓
Issue document (combined PDF generated)
  ↓
Download compliance pack (combined PDF included)
```

---

## Backward Compatibility Guaranteed

### Existing Code Continues to Work:
✅ Queries using `document_type` still work
✅ Reports using `document_type` fall back correctly
✅ Navigation renders correct modules (via module instances)
✅ Existing issued documents unchanged
✅ No data migration required for existing documents
✅ Helper functions provide fallback logic

### Graceful Degradation:
- If `enabled_modules` is NULL → Falls back to `document_type`
- If `enabled_modules` is empty → Falls back to `document_type`
- If `document_type` doesn't match enabled_modules → enabled_modules takes precedence

---

## Professional Plan Features

### Gated Behind Professional Plan:
- Fire Strategy Document (FSD) module selection
- Explosive Atmospheres (DSEAR) module selection
- Combined FRA + FSD documents

### Available on All Plans:
- Fire Risk Assessment (FRA) module selection
- FRA-only documents

### Upgrade Prompt:
When user tries to select FSD or DSEAR without Professional plan:
- Clear "Pro" badge on checkbox
- Upgrade prompt displayed
- Direct link to upgrade page
- Checkbox disabled but visible

---

## Summary

✅ **Database:** enabled_modules column added and backfilled
✅ **UI:** Checkbox group replaces dropdown
✅ **Creation Logic:** Merges module skeletons for combined documents
✅ **Navigation:** Automatically shows correct modules (via instances)
✅ **Headers:** Combined label shown for multi-module documents
✅ **Validation:** At least one module required
✅ **Professional Plan:** FSD and DSEAR properly gated
✅ **Backward Compatible:** All existing code works unchanged
✅ **Build Succeeds:** No TypeScript errors

**Combined survey creation is production-ready and fully functional!**

---

## End of Combined Survey Creation Implementation
