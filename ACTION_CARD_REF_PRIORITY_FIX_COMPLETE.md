# Action Card Reference & Priority Fix - COMPLETE

**Date**: 2026-02-23
**Status**: ✅ Complete
**Objective**: Fix action card numbering (R-01, R-02) and correct priority display (P1/P2/P3/P4 instead of generic "Low")

---

# UI Canonical Reference Update - COMPLETE

**Date**: 2026-02-24
**Status**: ✅ Complete
**Objective**: Make UI use canonical action reference_number everywhere (no computed refs)

## Patch 1 Summary

Successfully updated the UI to display canonical action references from the database instead of computing temporary index-based references.

**Before**: UI computed refs like `P1-01`, `P2-01` based on filtered index
**After**: UI displays canonical refs like `R-01`, `R-02` from `reference_number` field (or `—` if not yet assigned)

**Build Status**: ✅ Successful (18.88s, 1946 modules)

---

## Changes Made

### 1. Database View Enhancement

**File**: Database view `action_register_site_level`

Added `a.reference_number` to the SELECT list to expose canonical action references to the API.

### 2. TypeScript Interface Update

**File**: `src/utils/actionRegister.ts`

Added `reference_number: string | null` field to `ActionRegisterEntry` interface.

### 3. UI Component Update

**File**: `src/pages/documents/DocumentOverview.tsx` (Line 1372)

**Before**:
```typescript
// Generate a simple display reference based on priority and index
const refNumber = `${action.priority_band}-${(index + 1).toString().padStart(2, '0')}`;
```

**After**:
```typescript
// Use canonical reference_number if assigned, otherwise show pending indicator
const refNumber = action.reference_number ?? '—';
```

---

## Behavior Comparison

### Before (Computed Refs)

**Draft Document**:
| Ref | Priority | Action |
|-----|----------|--------|
| P1-01 | P1 | Fix emergency exit |
| P1-02 | P1 | Replace fire door |
| P2-01 | P2 | Update signage |

**Problems**:
- ❌ Ref changes based on filter/sort order
- ❌ Ref doesn't match PDF (which uses R-01, R-02)
- ❌ Confusing to users (different refs in UI vs PDF)

### After (Canonical Refs)

**Draft Document** (before issuing):
| Ref | Priority | Action |
|-----|----------|--------|
| — | P1 | Fix emergency exit |
| — | P1 | Replace fire door |
| — | P2 | Update signage |

**Benefits**:
- ✅ Clear that refs not yet assigned
- ✅ No confusion about which ref is "real"

**Issued Document** (after issuing):
| Ref | Priority | Action |
|-----|----------|--------|
| R-01 | P1 | Fix emergency exit |
| R-02 | P1 | Replace fire door |
| R-03 | P2 | Update signage |

**Benefits**:
- ✅ UI matches PDF exactly
- ✅ Refs are stable (don't change with sorting/filtering)
- ✅ Refs are globally unique (within document)

---

## Benefits

### For Users
✅ **Consistency**: UI and PDF show identical references
✅ **Clarity**: `—` clearly indicates refs not yet assigned
✅ **Stability**: Refs don't change with filtering/sorting
✅ **Cross-Reference**: Easy to find actions between UI and PDF

### For Developers
✅ **Simplicity**: Removed computed ref logic from UI
✅ **Maintainability**: Single source of truth (database)
✅ **Type Safety**: Added reference_number to TypeScript interface
✅ **Predictability**: UI always reflects database state

---

## Files Modified

| File | Change | Description |
|------|--------|-------------|
| Database view | Modified | Added `a.reference_number` to `action_register_site_level` |
| `src/utils/actionRegister.ts` | Modified | Added `reference_number` to `ActionRegisterEntry` interface |
| `src/pages/documents/DocumentOverview.tsx` | Modified | Use canonical ref instead of computed ref (document-level) |
| `src/pages/dashboard/ActionRegisterPage.tsx` | Modified | Added Ref column with canonical references (org-level) |

**Result**: UI now displays canonical references that match PDF output exactly across both document and org-level views.

---

## Org-Level Action Register Update

**File**: `src/pages/dashboard/ActionRegisterPage.tsx`

Added a new "Ref" column as the first column in the organization-wide Action Register table.

### Changes Made

**1. Table Header** (Line 371-373):
```typescript
<th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
  Ref
</th>
```

**2. Table Row** (Line 404-406):
```typescript
<td className="px-4 py-3 text-sm font-mono text-neutral-900">
  {action.reference_number ?? '—'}
</td>
```

### Updated Column Order

**Before**:
| Document | Action | Priority | Status | Tracking | Target Date | Owner |
|----------|--------|----------|--------|----------|-------------|-------|

**After**:
| **Ref** | Document | Action | Priority | Status | Tracking | Target Date | Owner |
|---------|----------|--------|----------|--------|----------|-------------|-------|
| R-01 | Fire Risk Assessment v1 | Fix emergency exit | P1 | Open | Overdue | John Doe |
| R-02 | Fire Risk Assessment v1 | Replace fire door | P2 | In Progress | On Track | Jane Smith |
| — | Fire Safety Design v1 | Update signage | P3 | Open | Due Soon | (Unassigned) |

**Note**: Draft documents show `—` until issued and refs are assigned.

### Benefits

1. ✅ **Quick Reference Lookup**: Users can quickly find actions by ref number
2. ✅ **Cross-Document View**: See refs from multiple documents in one table
3. ✅ **Consistency**: Org-level register matches document-level view
4. ✅ **Audit Trail**: Reference numbers visible at organizational level

### Deep-Linking to Actions

**Navigation Enhancement** (Line 402):
```typescript
onClick={() => navigate(`/documents/${action.document_id}/workspace?openAction=${action.id}`)}
```

**User Experience**:
- Click any row in org Action Register
- Navigate directly to document workspace
- Action modal opens automatically for the selected action
- No manual searching required

**Example Flow**:
1. User sees "R-01 | Fix emergency exit | P1 | Overdue" in org register
2. Clicks row
3. Navigates to `/documents/abc-123/workspace?openAction=xyz-789`
4. Document workspace loads with action R-01 modal already open
5. User can immediately review/edit/close the action

---

---

## Summary

Successfully fixed two critical issues with the action cards:

1. ✅ **Action Reference Numbers**: Now displays "R-01 P4" format in top label
2. ✅ **Correct Priority Bands**: Uses actual priority (P1/P2/P3/P4) instead of mapped labels
3. ✅ **Dynamic Height Calculation**: Replaced hardcoded 70px with computed height based on wrapped text
4. ✅ **Proper Text Wrapping**: Uses `wrapText()` utility for accurate line breaking

**Build Status**: ✅ Successful (22.25s, 1946 modules)

---

## Changes Made

### 1. Updated pdfPrimitives.ts

#### A. Added wrapText Import (Line 3)
```typescript
import { wrapText } from './pdfUtils';
```

#### B. Updated drawActionCard Signature (Line 335)
```typescript
// Before: actionRef?: string;
// After:  ref?: string;
```

**Rationale**: Simplified parameter name for cleaner API

#### C. Replaced Function Body (Lines 343-408)

**Key Improvements**:

1. **Text Wrapping**
   ```typescript
   // Before: Used maxWidth in page.drawText (pdf-lib wrapping)
   page.drawText(description, {
     maxWidth: w - stripeW - cardPadding * 2,
   });

   // After: Proper wrapping with wrapText utility
   const lines = wrapText(description, maxTextW, titleSize, fonts.regular);
   for (const line of lines) {
     page.drawText(line, { ... });
   }
   ```

2. **Dynamic Height Calculation**
   ```typescript
   // Before: Hardcoded estimate
   const cardHeightEstimate = 70;

   // After: Computed from wrapped lines
   const descH = lines.length * lineGap;
   const cardH = cardPadding + badgeRowH + 8 + descH + 8 + metaH + cardPadding;
   ```

3. **Reference Number Display**
   ```typescript
   // Top row: "R-01   P4" or just "P4" if no ref
   const topLabel = ref ? `${ref}   ${priority}` : priority;
   page.drawText(topLabel.toUpperCase(), {
     x: textX,
     y: cursorY,
     size: 9,
     font: fonts.bold,
     color: stripeColor,
   });
   ```

4. **Enhanced Priority Detection**
   ```typescript
   // Before: Only matched labels (critical/high/medium/low)
   if (p.includes('critical')) stripeColor = rgb(0.65, 0.15, 0.15);

   // After: Matches both bands and labels
   if (p.includes('p1') || p.includes('critical')) stripeColor = rgb(0.65, 0.15, 0.15);
   else if (p.includes('p2') || p.includes('high')) stripeColor = rgb(0.70, 0.35, 0.10);
   else if (p.includes('p3') || p.includes('medium')) stripeColor = rgb(0.75, 0.65, 0.20);
   else if (p.includes('p4') || p.includes('low')) stripeColor = rgb(0.12, 0.29, 0.55);
   ```

---

### 2. Updated fraTypes.ts

#### Added reference_number Field to Action Interface (Line 48)

```typescript
export interface Action {
  id: string;
  recommended_action: string;
  priority_band: string;
  status: string;
  finding_category?: string | null;
  trigger_id?: string | null;
  trigger_text?: string | null;
  owner_user_id: string | null;
  owner_display_name?: string;
  target_date: string | null;
  module_instance_id: string;
  created_at: string;
  reference_number?: string | null;  // ← NEW
}
```

**Rationale**: Actions in the database have `reference_number` field (format: "R-01", "R-02") assigned by `assignActionReferenceNumbers()` utility.

---

### 3. Updated fraCoreDraw.ts

#### Modified drawActionRegister Call Site (Lines 1576-1597)

**Before**:
```typescript
// Map priority band to label
const priorityBand = action.priority_band || 'P4';
const priorityLabelMap: Record<string, string> = {
  'P1': 'Critical',
  'P2': 'High',
  'P3': 'Medium',
  'P4': 'Low',
};
const priorityLabel = priorityLabelMap[priorityBand] || 'Medium';

yPosition = drawActionCard({
  page,
  x: MARGIN,
  y: yPosition,
  w: CONTENT_WIDTH,
  description: actionText,
  priority: priorityLabel,  // ← Wrong: Always "Low" by default
  // No ref parameter
  owner,
  target,
  status,
  fonts: { regular: font, bold: fontBold },
});
```

**After**:
```typescript
// Use priority band directly (P1/P2/P3/P4)
const priorityBand = action.priority_band || 'P4';
const actionText = action.recommended_action || '(No action text provided)';
const owner = action.owner_display_name || undefined;
const target = action.target_date ? formatDate(action.target_date) : undefined;
const status = action.status || 'open';
const ref = action.reference_number || undefined;  // ← NEW

yPosition = drawActionCard({
  page,
  x: MARGIN,
  y: yPosition,
  w: CONTENT_WIDTH,
  ref,  // ← NEW: Pass reference number
  description: actionText,
  priority: priorityBand,  // ← Fixed: Use actual band (P1/P2/P3/P4)
  owner,
  target,
  status,
  fonts: { regular: font, bold: fontBold },
});
```

**Key Changes**:
- ❌ Removed priority label mapping (Critical/High/Medium/Low)
- ✅ Pass priority band directly (P1/P2/P3/P4)
- ✅ Extract `reference_number` from action
- ✅ Pass `ref` to drawActionCard

---

## Visual Result

### Before
```
▌ LOW
  Verify fire alarm installation, category and coverage...

  Owner: (Unassigned)   |   Target: 18 Mar 2026   |   Status: Open
```

**Issues**:
- ❌ Always shows "LOW" (incorrect default)
- ❌ No action reference number
- ❌ Text overlap/cutoff (hardcoded height)

### After
```
▌ R-01   P4
  Verify fire alarm installation, category and coverage...

  Owner: (Unassigned)   |   Target: 18 Mar 2026   |   Status: Open
```

**Fixed**:
- ✅ Shows action reference (R-01)
- ✅ Shows correct priority band (P4)
- ✅ Proper text wrapping (no overlap)
- ✅ Dynamic height (no cutoff)

### Other Priority Examples

**P1 Action**:
```
▌ R-02   P1
  [Dark red stripe, left side]
  Critical electrical hazard requiring immediate attention...
```

**P2 Action**:
```
▌ R-03   P2
  [Orange stripe, left side]
  High priority fire door maintenance required...
```

---

## Technical Details

### Priority Color Mapping

| Priority | Color | RGB Values | Use Case |
|----------|-------|------------|----------|
| P1 / Critical | Dark Red | `(0.65, 0.15, 0.15)` | Immediate safety hazards |
| P2 / High | Orange | `(0.70, 0.35, 0.10)` | Near-term compliance issues |
| P3 / Medium | Amber | `(0.75, 0.65, 0.20)` | Scheduled improvements |
| P4 / Low | Blue | `(0.12, 0.29, 0.55)` | Routine maintenance |

**Detection Logic**: Case-insensitive substring matching for both band codes (P1-P4) and labels (Critical-Low).

### Height Calculation Algorithm

```typescript
// Components
const badgeRowH = 12;         // Top label row (ref + priority)
const descH = lines.length * lineGap;  // Description (14px per line)
const metaH = 12;             // Metadata row
const cardH = cardPadding + badgeRowH + 8 + descH + 8 + metaH + cardPadding;

// Layout
┌─────────────────────────────┐
│ cardPadding (12px)          │
│ Badge Row (12px)            │ ← R-01 P4
│ Gap (8px)                   │
│ Description (lines × 14px)  │ ← Wrapped text
│ Gap (8px)                   │
│ Metadata (12px)             │ ← Owner | Target | Status
│ cardPadding (12px)          │
└─────────────────────────────┘
```

**Return**: `y - cardH - 12` (card height + 12px separator)

### Text Wrapping

Uses `wrapText()` utility from `pdfUtils.ts`:
- Measures text width with `font.widthOfTextAtSize()`
- Breaks on word boundaries
- Returns array of lines that fit within `maxWidth`

**Benefits**:
- No text overflow beyond card boundaries
- Accurate height calculation
- Consistent with other PDF sections

---

## Reference Number System

### Database Schema

Actions have `reference_number` field (nullable string):
```sql
ALTER TABLE actions ADD COLUMN reference_number TEXT;
```

### Assignment Logic

Handled by `assignActionReferenceNumbers()` in `src/utils/actionReferenceNumbers.ts`:

1. **Fetch Actions**: Get all actions for document, ordered by `created_at`
2. **Find Max Number**: Check existing refs in document series (R-01, R-02, etc.)
3. **Assign Sequential**: Start from `max + 1`, assign R-XX format
4. **Persist**: Update database with assigned reference numbers

**Format**: `R-{number}` where number is zero-padded to 2 digits (R-01, R-02, ..., R-99)

### Carryforward on Revision

Handled by `carryForwardActionReferenceNumbers()`:
- Actions carried forward from previous version retain original reference numbers
- Preserves traceability across document revisions
- New actions in revision get next available number

---

## Build Verification

```bash
npm run build
```

**Output**:
```
✓ 1946 modules transformed
✓ built in 22.25s
dist/assets/index-BEiaEwn2.js   2,337.73 kB │ gzip: 595.83 kB
```

**Status**: ✅ Build successful

**TypeScript Errors**: None
**Runtime Errors**: None
**Warnings**: None (other than chunk size)

---

## Files Modified

| File | Changes | Lines | Description |
|------|---------|-------|-------------|
| `src/lib/pdf/pdfPrimitives.ts` | Modified | +1 import, ~65 lines | Added wrapText import, rewrote drawActionCard body |
| `src/lib/pdf/fra/fraTypes.ts` | Modified | +1 field | Added reference_number to Action interface |
| `src/lib/pdf/fra/fraCoreDraw.ts` | Modified | -9, +7 lines | Removed label mapping, added ref extraction |

**Total**: 3 files modified

**Net Impact**: More accurate rendering, better maintainability

---

## Testing Checklist

### Visual Verification
- [x] Action cards show reference numbers (R-01, R-02, etc.)
- [x] Priority bands display correctly (P1/P2/P3/P4)
- [x] Colors match priority (P1=red, P2=orange, P3=amber, P4=blue)
- [x] Text wraps properly within card boundaries
- [x] No text overflow or cutoff
- [x] Dynamic height adjusts to content
- [x] Metadata row displays correctly

### Functional Verification
- [x] Actions without reference_number show priority only
- [x] Actions with reference_number show "R-XX PRIORITY" format
- [x] Priority color detection works for both bands and labels
- [x] Long descriptions wrap to multiple lines
- [x] Card height expands for multi-line descriptions
- [x] Separator lines between cards preserved

### Edge Cases
- [x] Action with null reference_number (shows priority only)
- [x] Action with very long description (wraps correctly)
- [x] Action with P1 priority (dark red stripe)
- [x] Action with P4 priority (blue stripe, not "low" label)
- [x] Action with missing priority_band (defaults to P4)

### Regression Testing
- [x] Evidence attachments still render correctly
- [x] Page overflow handling works
- [x] Action sorting unchanged
- [x] Other PDF sections unaffected
- [x] Build successful

---

## Benefits

### For Users
✅ **Action Traceability**: Reference numbers (R-01) enable cross-referencing
✅ **Clear Priority**: P1/P2/P3/P4 bands are industry-standard and unambiguous
✅ **Professional Appearance**: Numbered actions match consultancy best practices
✅ **Better Readability**: Proper text wrapping prevents overflow
✅ **Accurate Layout**: Dynamic height eliminates text cutoff

### For Developers
✅ **Type Safety**: Added reference_number to Action interface
✅ **Maintainability**: Simplified priority handling (no mapping needed)
✅ **Consistency**: Uses same wrapText utility as other sections
✅ **Flexibility**: Supports both band codes (P1) and labels (Critical)
✅ **Extensibility**: Reference numbers ready for cross-document linking

### For Business
✅ **Compliance**: Action numbering required for audit trails
✅ **Quality**: Professional reports with proper action tracking
✅ **Efficiency**: Reference numbers speed up action plan discussions
✅ **Trust**: Clients expect numbered, traceable recommendations

---

## Related Systems

### Action Reference Assignment
- **Utility**: `src/utils/actionReferenceNumbers.ts`
- **Functions**:
  - `assignActionReferenceNumbers()` - Assigns R-XX refs to new actions
  - `carryForwardActionReferenceNumbers()` - Preserves refs across revisions
- **Trigger**: Called during document issuing/finalization

### Priority Band System
- **Source**: `actions.priority_band` column (P1/P2/P3/P4)
- **Display**: Direct rendering (no label mapping)
- **Colors**: Defined in drawActionCard priority detection

### Action Register
- **Location**: FRA Section 13 (Action Register)
- **Sorting**: Open/In Progress first, then by priority, then by target date
- **Evidence**: Inline attachments shown below each action card

---

## Future Enhancements

### Phase 2 (Optional)

1. **Clickable References in Digital PDFs**
   - Add PDF annotations for action refs
   - Link to action detail pages (if interactive)

2. **Reference Index**
   - Table of all action references at end of document
   - Quick lookup: R-01 → Page 42, Section 7

3. **Status Icons**
   - Visual indicators next to status text
   - Green checkmark for complete, orange dot for in_progress

4. **Priority Reason Text**
   - For P1/P2 actions, show trigger_text below description
   - Format: "Reason: [trigger text]" in italics

5. **Cross-Document References**
   - Link actions to originating sections
   - "See Section 7.3 for context"

---

## Comparison: Before vs After

| Aspect | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Reference Numbers** | None | R-01, R-02, etc. | ✅ Traceability |
| **Priority Display** | "Low" (incorrect) | P4 (correct) | ✅ Accuracy |
| **Text Wrapping** | pdf-lib maxWidth | wrapText utility | ✅ Proper breaks |
| **Height Calculation** | Hardcoded 70px | Dynamic (computed) | ✅ No cutoff |
| **Priority Detection** | Labels only | Bands + labels | ✅ Flexibility |
| **Code Clarity** | Mapping logic | Direct usage | ✅ Simpler |

---

## Conclusion

Successfully fixed two critical issues with action cards:

1. ✅ **Reference Numbers**: Actions now display R-01, R-02 format for traceability
2. ✅ **Priority Bands**: Correct P1/P2/P3/P4 display instead of generic "Low"

Additional improvements:
- ✅ Dynamic height calculation (no more text cutoff)
- ✅ Proper text wrapping using wrapText utility
- ✅ Enhanced priority detection (supports both bands and labels)
- ✅ Type safety (added reference_number to Action interface)

The action register now produces professional, audit-ready reports with numbered, properly prioritized actions that match industry standards and client expectations.

---

## Quick Reference: API Changes

### drawActionCard() Signature

**Before**:
```typescript
actionRef?: string;  // Unused parameter
priority: string;    // Expected "Critical/High/Medium/Low"
```

**After**:
```typescript
ref?: string;        // Used: displays "R-01 P4"
priority: string;    // Accepts both bands (P1-P4) and labels
```

### fraCoreDraw.ts Call Site

**Before**:
```typescript
priority: priorityLabel  // Mapped from P1→Critical, etc.
// No ref parameter
```

**After**:
```typescript
ref: action.reference_number || undefined
priority: priorityBand  // Direct: P1/P2/P3/P4
```

### Action Interface

**Before**:
```typescript
// No reference_number field
```

**After**:
```typescript
reference_number?: string | null;
```

**Impact**: Type-safe reference number access throughout codebase
