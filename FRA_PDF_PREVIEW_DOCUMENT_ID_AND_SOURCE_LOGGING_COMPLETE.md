# FRA PDF Preview Document ID and Source Logging - COMPLETE

## Problem
Need to verify that the correct `document_id` is being used for PDF generation and that `action.source` is properly included in the payload to enable system-title shortening.

## Solution
Added comprehensive logging at key points in the PDF generation pipeline to prove:
1. The correct document ID is being queried
2. Actions are being loaded with the correct count
3. The `source` field is present in the payload
4. System actions can be identified by source='system'

## Changes Made

### 1. DocumentPreviewPage.tsx - Issued Documents Branch (Line 150-159)

```typescript
console.log('[PDF Preview] generating for document id:', id);
const { data: actionsData } = await supabase
  .from('actions')
  .select(`*`)  // ✅ Already includes source via select('*')
  .eq('document_id', id)
  .eq('organisation_id', organisation.id)
  .is('deleted_at', null);

console.log('[PDF Preview] actions loaded:', actionsData?.length ?? 0);
actions = actionsData || [];
```

**Logs:**
- Document ID being used for the query
- Number of actions loaded

### 2. DocumentPreviewPage.tsx - Draft Documents Branch (Line 171-192)

```typescript
console.log('[PDF Preview] generating for document id:', id);
const { data: actionsData, error: actionsError } = await supabase
  .from('actions')
  .select(`
    id,
    reference_number,  // ✅ Added (was missing)
    source,            // ✅ Already present
    recommended_action,
    priority_band,
    status,
    owner_user_id,
    target_date,
    module_instance_id,
    created_at
  `)
  .eq('document_id', id)
  .eq('organisation_id', organisation.id)
  .is('deleted_at', null)
  .order('created_at', { ascending: true });

if (actionsError) throw actionsError;
console.log('[PDF Preview] actions loaded:', actionsData?.length ?? 0);
```

**Changes:**
- Added `reference_number` to select list (was missing)
- `source` already present from previous fix
- Added document ID logging
- Added actions count logging

### 3. DocumentPreviewPage.tsx - Actions Sources Summary (Line 360-362)

Added before `pdfOptions` is created:

```typescript
console.log('[PDF Preview] actions sources summary:',
  (actions || []).reduce((acc:any,a:any)=>{ const k=a.source||'null'; acc[k]=(acc[k]||0)+1; return acc; }, {})
);

const pdfOptions = {
  document,
  moduleInstances,
  actions,  // ✅ Contains source field
  actionRatings,
  ...
};
```

**This log shows:**
- How many actions of each source type are present
- Example: `{ system: 2, manual: 1, library: 3, null: 0 }`

## Logging Flow

```
┌──────────────────────────────────────────────┐
│ User clicks "Generate PDF"                   │
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ [PDF Preview] generating for document id:    │
│ e58f9b2e-4d3a-4a7f-9c1e-2f8a6b4c5d7e       │
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ Query actions from database                  │
│ WHERE document_id = <id>                     │
│ SELECT ... source ... ✅                     │
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ [PDF Preview] actions loaded: 5              │
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ [PDF Preview] actions sources summary:       │
│ { system: 2, manual: 3 }                     │
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ pdfOptions created with actions array ✅     │
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ buildFraPdf(pdfOptions)                      │
│ → [PDF] actions sample (before snapshot)    │
│ → [PDF] actions sample (before register)    │
└──────────────────────────────────────────────┘
```

## Expected Console Output

When generating a PDF for a document with system-generated actions:

```
[PDF Preview] generating for document id: e58f9b2e-4d3a-4a7f-9c1e-2f8a6b4c5d7e
[PDF Preview] actions loaded: 10
[PDF Preview] actions sources summary: { manual: 8, system: 2 }
[PDF FRA] Creating PDF document and embedding fonts
[PDF] actions sample (before snapshot) [
  { id: '...', source: 'system', ref: 'FRA-2026-001', text: 'Install fire extinguishers...' },
  { id: '...', source: 'manual', ref: 'FRA-2026-002', text: 'Conduct quarterly drills' },
  { id: '...', source: 'system', ref: 'FRA-2026-003', text: 'Upgrade emergency lighting...' }
]
[PDF] actions source counts (before snapshot): { manual: 8, system: 2 }
[PDF] first 10 action sources: [
  { ref: 'FRA-2026-001', source: 'system' },
  { ref: 'FRA-2026-002', source: 'manual' },
  { ref: 'FRA-2026-003', source: 'system' },
  { ref: 'FRA-2026-004', source: 'manual' },
  { ref: 'FRA-2026-005', source: 'manual' },
  { ref: 'FRA-2026-006', source: 'manual' },
  { ref: 'FRA-2026-007', source: 'manual' },
  { ref: 'FRA-2026-008', source: 'manual' },
  { ref: 'FRA-2026-009', source: 'manual' },
  { ref: 'FRA-2026-010', source: 'manual' }
]
[PDF] actions sample (before register) [
  { id: '...', source: 'system', ref: 'FRA-2026-001', text: 'Install fire extinguishers...' },
  { id: '...', source: 'manual', ref: 'FRA-2026-002', text: 'Conduct quarterly drills' },
  { id: '...', source: 'system', ref: 'FRA-2026-003', text: 'Upgrade emergency lighting...' }
]
[PDF] actions source counts (before register): { manual: 8, system: 2 }
[PDF] first 10 action sources: [
  { ref: 'FRA-2026-001', source: 'system' },
  { ref: 'FRA-2026-002', source: 'manual' },
  { ref: 'FRA-2026-003', source: 'system' },
  { ref: 'FRA-2026-004', source: 'manual' },
  { ref: 'FRA-2026-005', source: 'manual' },
  { ref: 'FRA-2026-006', source: 'manual' },
  { ref: 'FRA-2026-007', source: 'manual' },
  { ref: 'FRA-2026-008', source: 'manual' },
  { ref: 'FRA-2026-009', source: 'manual' },
  { ref: 'FRA-2026-010', source: 'manual' }
]
```

## Verification Steps

### 1. Verify Document ID
**Expected:** Console shows the same document ID as shown in the URL
```
URL: /documents/preview/e58f9b2e-4d3a-4a7f-9c1e-2f8a6b4c5d7e
Log: [PDF Preview] generating for document id: e58f9b2e-4d3a-4a7f-9c1e-2f8a6b4c5d7e
```

### 2. Verify Actions Count
**Expected:** Console shows count matching database query:
```sql
SELECT COUNT(*) FROM actions
WHERE document_id = 'e58f9b2e-4d3a-4a7f-9c1e-2f8a6b4c5d7e'
AND deleted_at IS NULL;
-- Result: 5

Console: [PDF Preview] actions loaded: 5 ✅
```

### 3. Verify Source Field Present
**Expected:** Console shows breakdown of action sources:
```
[PDF Preview] actions sources summary: { system: 2, manual: 3 }
```

This matches:
```sql
SELECT source, COUNT(*) FROM actions
WHERE document_id = 'e58f9b2e-4d3a-4a7f-9c1e-2f8a6b4c5d7e'
AND deleted_at IS NULL
GROUP BY source;

-- Result:
-- system | 2
-- manual | 3
```

### 4. Verify Source in PDF Generation
**Expected:** Later logs from buildFraPdf show `source` field:
```
[PDF] actions sample (before snapshot) [
  { id: '...', source: 'system', ... }  ✅
]
```

## Benefits

1. **Debugging confidence** - Can verify the correct document is being queried
2. **Source field verification** - Confirms `source` is present in the payload
3. **Data integrity** - Can compare console counts to direct SQL queries
4. **Troubleshooting** - If shortening doesn't work, can check if source='system'

## Related Changes

- `ACTION_SOURCE_END_TO_END_COMPLETE.md` - Ensures source is selected in queries
- `ACTION_SNAPSHOT_SYSTEM_TITLE_SHORTENING_COMPLETE.md` - Uses source to shorten titles

## Additional Logging in buildFraPdf.ts

### 4. Before drawActionPlanSnapshot (Line 514-524)

Added comprehensive source logging before the action snapshot:

```typescript
console.log('[PDF] actions source counts (before snapshot):',
  (actionsForPdf || []).reduce((acc: any, a: any) => {
    const k = (a.source ?? 'null') as string;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {})
);

console.log('[PDF] first 10 action sources:',
  (actionsForPdf || []).slice(0, 10).map((a: any) => ({ ref: a.reference_number, source: a.source }))
);
```

### 5. Before drawActionRegister (Line 987-997)

Added identical logging before the action register:

```typescript
console.log('[PDF] actions source counts (before register):',
  (actions || []).reduce((acc: any, a: any) => {
    const k = (a.source ?? 'null') as string;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {})
);

console.log('[PDF] first 10 action sources:',
  (actions || []).slice(0, 10).map((a: any) => ({ ref: a.reference_number, source: a.source }))
);
```

**What These Show:**
- Source distribution breakdown (e.g., `{ manual: 8, system: 2 }`)
- First 10 actions with their reference numbers and sources
- Confirms data flows correctly from query → PDF generation

## Status

✅ Document ID logged before queries (DocumentPreviewPage.tsx)
✅ Actions count logged after queries (DocumentPreviewPage.tsx)
✅ source field included in draft query select (DocumentPreviewPage.tsx)
✅ reference_number added to draft query select (DocumentPreviewPage.tsx)
✅ Sources summary logged before PDF generation (DocumentPreviewPage.tsx)
✅ Source counts logged before snapshot (buildFraPdf.ts line 514-520)
✅ Source counts logged before register (buildFraPdf.ts line 987-993)
✅ First 10 sources logged in both places (buildFraPdf.ts)
✅ Build successful
✅ Ready to test

## Testing

1. Open a document in preview mode
2. Click "Generate PDF"
3. Open browser console
4. Verify logs show:
   - Correct document ID
   - Correct actions count
   - Sources summary including "system: X"
5. Compare to SQL query results to confirm accuracy
