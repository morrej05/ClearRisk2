# RE06 Fire Protection Section Grade Fix - Complete

## Problem Statement
The Fire Protection section (RE06FireProtectionForm) was updating local formData.sectionGrades only, so the calculateOverallGrade function never saw fire_protection changes. The overall grade widget was not receiving updates when the Fire Protection section grade changed.

## Solution Implemented

### 1. Database Migration
**File:** `supabase/migrations/[timestamp]_add_section_grades_to_documents.sql`

Added `section_grades` JSONB column to the `documents` table to store canonical section-level grades (1-5 scale) for Risk Engineering assessments.

**Structure:**
```json
{
  "fire_protection": 3,
  "construction": 4,
  "occupancy": 3,
  "management": 4,
  "natural_hazards": 3,
  "utilities": 3,
  "process_risk": 3
}
```

### 2. Shared Helper Functions
**File:** `src/utils/sectionGrades.ts`

Created centralized utilities for section grade management:

#### `updateSectionGrade(documentId, sectionKey, value)`
- Fetches current section_grades from documents table
- Merges new grade value into existing grades
- Persists to Supabase: `documents.section_grades = { ...existing, [sectionKey]: value }`
- Returns error if any

#### `getSectionGrades(documentId)`
- Retrieves all section grades for a document
- Returns empty object if none found

#### `calculateOverallGrade(sectionGrades)`
- Calculates average of all non-zero grades
- Returns 3 (Adequate) if no grades exist
- Does NOT default individual values to 3 - uses actual stored values

#### `getRiskBandFromGrade(overallGrade)`
- Maps grade to risk bands:
  - < 2.0: Critical
  - 2.0-2.9: High
  - 3.0-3.9: Medium
  - ≥ 4.0: Low

### 3. RE06FireProtectionForm Updates
**File:** `src/components/modules/forms/RE06FireProtectionForm.tsx`

**Imports Added:**
```typescript
import SectionGrade from '../../SectionGrade';
import { updateSectionGrade } from '../../../utils/sectionGrades';
```

**State Added:**
```typescript
const [sectionGrade, setSectionGrade] = useState<number>(3);
```

**Load Section Grade Effect:**
```typescript
useEffect(() => {
  async function loadSectionGrade() {
    const { data: doc } = await supabase
      .from('documents')
      .select('section_grades')
      .eq('id', document.id)
      .maybeSingle();

    const grade = doc?.section_grades?.fire_protection;
    if (grade !== undefined && grade > 0) {
      setSectionGrade(grade);
    }
  }
  loadSectionGrade();
}, [document.id]);
```

**Section Grade Change Handler:**
```typescript
const handleSectionGradeChange = async (value: number) => {
  setSectionGrade(value); // Update local state immediately

  // Persist to canonical documents.section_grades
  const { error } = await updateSectionGrade(document.id, 'fire_protection', value);
  if (error) {
    console.error('[RE06] Failed to update section grade:', error);
  }
};
```

**UI Component Added:**
```tsx
<div className="max-w-5xl mx-auto px-6 pb-6">
  <SectionGrade
    sectionKey="fire_protection"
    sectionTitle="Fire Protection"
    value={sectionGrade}
    onChange={handleSectionGradeChange}
  />
</div>
```

### 4. Overall Grade Widget
**File:** `src/components/re/OverallGradeWidget.tsx`

Created a real-time widget that displays overall property grade for RE documents:

**Features:**
- Loads section grades from `documents.section_grades`
- Subscribes to real-time updates via Supabase channels
- Displays overall grade (1-5 scale) and risk band
- Shows all section grades with visual breakdown
- Updates immediately when any section grade changes
- Includes grade scale and risk band legend

**Visual Design:**
- Gradient background for prominence
- Two-panel display: Grade (numeric) and Risk Band (label)
- Color-coded by risk level (red/orange/amber/blue/green)
- Lists all contributing section grades
- Shows count of graded sections

### 5. DocumentWorkspace Integration
**File:** `src/pages/documents/DocumentWorkspace.tsx`

**Import Added:**
```typescript
import OverallGradeWidget from '../../components/re/OverallGradeWidget';
```

**Widget Placement:**
```tsx
{document.document_type === 'RE' && (
  <div className="mb-6">
    <OverallGradeWidget documentId={document.id} />
  </div>
)}
```

The widget appears at the top of the workspace content area for RE documents, above the module forms.

## Data Flow

### When Section Grade Changes:
1. User moves slider in SectionGrade component
2. `handleSectionGradeChange(value)` is called
3. Local state updated immediately: `setSectionGrade(value)`
4. Helper called: `updateSectionGrade(documentId, 'fire_protection', value)`
5. Helper fetches current grades from `documents.section_grades`
6. Helper merges new value: `{ ...currentGrades, fire_protection: value }`
7. Helper updates database: `documents.section_grades = updatedGrades`
8. Supabase real-time subscription fires
9. OverallGradeWidget receives update via channel
10. Widget recalculates overall grade
11. UI updates immediately

### Overall Grade Calculation:
1. OverallGradeWidget fetches `documents.section_grades`
2. Calls `calculateOverallGrade(sectionGrades)`
3. Filters out undefined/zero values
4. Calculates average of remaining grades
5. Maps to risk band
6. Displays both grade and band

## Key Design Decisions

### Use section key "fire_protection" consistently
- No camelCase variants (fireProtection)
- Matches database column naming convention
- Consistent across all RE modules

### Do not default to 3 when value exists
- Only return default (3) if NO grades exist
- If a grade is stored, use that exact value
- Prevents masking of actual assessments

### Real-time updates via Supabase channels
- OverallGradeWidget subscribes to document updates
- No manual refresh needed
- Grade changes appear immediately in widget
- Optimistic UI updates (local state first, then persist)

### Canonical storage in documents.section_grades
- Single source of truth for all section grades
- Not stored in module_instances.data (transient)
- Survives module re-execution
- Accessible for reporting and analysis

## Testing Recommendations

1. **Basic Functionality:**
   - Open RE document in workspace
   - Navigate to RE06 Fire Protection module
   - Change section grade slider
   - Verify OverallGradeWidget updates immediately
   - Verify grade persists after page reload

2. **Multiple Sections:**
   - Grade multiple RE sections (Construction, Occupancy, etc.)
   - Verify overall grade is average of all graded sections
   - Verify grade count display is accurate

3. **Edge Cases:**
   - Grade all sections as 1 → verify "Critical" band
   - Grade all sections as 5 → verify "Low" band
   - Grade only one section → verify calculates correctly
   - Remove all grades → verify defaults to 3 (Adequate)

4. **Real-time Updates:**
   - Open same document in two browser tabs
   - Change grade in one tab
   - Verify widget updates in other tab

5. **Cross-Module Consistency:**
   - Add section grades to other RE modules (RE02, RE03, etc.)
   - Verify all contribute to overall grade
   - Verify consistent behavior across modules

## Files Created
- `supabase/migrations/[timestamp]_add_section_grades_to_documents.sql`
- `src/utils/sectionGrades.ts`
- `src/components/re/OverallGradeWidget.tsx`

## Files Modified
- `src/components/modules/forms/RE06FireProtectionForm.tsx`
- `src/pages/documents/DocumentWorkspace.tsx`

## Build Status
✅ Build successful (18.59s)
✅ No TypeScript errors
✅ All imports resolved
✅ 1,895 modules transformed

## Next Steps (Optional Enhancements)

1. **Add section grades to other RE modules:**
   - RE02 Construction Form (construction)
   - RE03 Occupancy Form (occupancy)
   - RE07 Natural Hazards Form (natural_hazards)
   - RE08 Utilities Form (utilities)
   - RE09 Management Form (management)
   - RE10 Process Risk Form (process_risk)

2. **Add overall grade to RE reports/PDFs**
   - Include overall property grade in generated reports
   - Show section breakdown in executive summary
   - Visual risk band indicator

3. **Add overall grade to document overview**
   - Display widget on DocumentOverview page
   - Show in document list/cards
   - Filter/sort by overall grade

4. **Historical tracking:**
   - Track grade changes over time
   - Compare grades across document versions
   - Trend analysis

5. **Weighted grades (future):**
   - Allow different weights for different sections
   - Industry-specific weighting profiles
   - Configurable by organization
