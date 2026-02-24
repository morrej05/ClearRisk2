# PDF Reference Display - Policy B Implementation Complete

## Overview
Implemented Policy B: Ensure action reference numbers are assigned before generating preview PDFs, so all PDFs display database-stored reference numbers without fallback generation.

## Changes Made

### 1. PDF Rendering - Remove Fallback References
**Files Modified:**
- `src/lib/pdf/fra/fraCoreDraw.ts`
- `src/lib/pdf/pdfUtils.ts` (2 functions)

#### Action Card Rendering (fraCoreDraw.ts:1568)
```typescript
// OLD: const ref = action.reference_number ?? '—';
// NEW: const ref = action.reference_number || undefined;
```

Action cards now display:
- **With reference**: `FRA-2026-001 • P4`
- **Without reference**: `P4` only

#### Action Plan Snapshot (pdfUtils.ts:990-1003)
```typescript
// OLD: Always showed ref unconditionally
let displayText = `• ${ref}`;

// NEW: Only include ref if it exists
let displayText = '• ';
if (ref) {
  displayText += ref;
  if (section && section !== 'TBD' && section !== 'unknown' && section !== '') {
    displayText += ` (${section})`;
  }
  displayText += ': ';
}
displayText += actionText;
```

#### Recommendations Section (pdfUtils.ts:1131-1142)
```typescript
// OLD: Always rendered refNum
const refNum = action.reference_number;
page.drawText(refNum, { ... });

// NEW: Only render if refNum exists
const refNum = action.reference_number;
if (refNum) {
  page.drawText(refNum, { ... });
  yPosition -= 20;
}
```

### 2. Preview Page - Assign References Before PDF Generation
**File Modified:** `src/pages/documents/DocumentPreviewPage.tsx`

#### Added Import (line 19)
```typescript
import { assignActionReferenceNumbers } from '../../utils/actionReferenceNumbers';
```

#### Before PDF Generation (lines 287-351)
```typescript
// 1. Assign reference numbers for standard documents (FRA/FSD/DSEAR/Combined)
if (!isReDocument) {
  try {
    await assignActionReferenceNumbers(document.id, document.base_document_id ?? document.id);
    console.log('[PDF Preview] Action reference numbers assigned');
  } catch (refError) {
    console.error('[PDF Preview] Failed to assign reference numbers:', refError);
    // Continue anyway - references may already exist
  }
}

// 2. Refetch actions to include assigned reference_number field
let actions = enrichedActions;
if (!isReDocument) {
  try {
    const { data: actionsData } = await supabase
      .from('actions')
      .select(`
        id,
        recommended_action,
        priority_band,
        status,
        owner_user_id,
        target_date,
        module_instance_id,
        reference_number,  // ← Now included
        created_at
      `)
      .eq('document_id', document.id)
      .eq('organisation_id', organisation.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (actionsData) {
      // Re-enrich with owner display names
      actions = actionsData.map((a: any) => ({
        ...a,
        owner_display_name: a.owner_user_id ? userNameMap.get(a.owner_user_id) : null,
      }));

      console.log('[PDF Preview] Refetched actions with references:', {
        count: actions.length,
        withRefs: actions.filter((a: any) => a.reference_number).length,
      });
    }
  } catch (refetchError) {
    console.error('[PDF Preview] Failed to refetch actions:', refetchError);
    // Use original enrichedActions if refetch fails
  }
}

// 3. Use refreshed actions in pdfOptions
const pdfOptions = {
  document,
  moduleInstances,
  actions,  // ← Now includes reference_number
  actionRatings,
  organisation: { ... },
  renderMode: ...
};
```

## Behavior

### Preview PDF Generation Flow
1. User clicks "Generate PDF" on preview page
2. System calls `assignActionReferenceNumbers()` for document
3. System refetches actions from database (now includes `reference_number`)
4. System builds PDF with refreshed actions
5. PDF displays database reference numbers exactly

### Reference Display
- **Actions with references**: Show full reference (e.g., `FRA-2026-001 • P4`)
- **Actions without references**: Show priority only (e.g., `P4`)
- **No fallback generation**: Zero synthetic R-xx references in any PDF

### Error Handling
- Reference assignment failures are logged but don't block PDF generation
- Action refetch failures fall back to original enriched actions
- PDF generation continues even if references aren't assigned

## Applies To
- FRA reports
- FSD reports
- DSEAR reports
- Combined FRA+FSD reports
- Combined FRA+DSEAR reports

## Does Not Apply To
- RE documents (Risk Engineering uses different reference system)

## Testing Notes
1. Create draft FRA document with actions
2. Click "Preview Draft PDF"
3. Verify actions show references in format `FRA-YYYY-NNN • P4`
4. Check console logs confirm reference assignment and refetch
5. Verify no R-xx fallback references appear anywhere in PDF

## Build Status
✅ Build successful (19.74s)
✅ No TypeScript errors
✅ All changes applied
