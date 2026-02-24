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
[PDF Preview] actions loaded: 5
[PDF Preview] actions sources summary: { system: 2, manual: 3 }
[PDF FRA] Creating PDF document and embedding fonts
[PDF] actions sample (before snapshot) [
  { id: '...', source: 'system', ref: 'FRA-2026-001', text: 'Install fire extinguishers...' },
  { id: '...', source: 'manual', ref: 'FRA-2026-002', text: 'Conduct quarterly drills' },
  { id: '...', source: 'system', ref: 'FRA-2026-003', text: 'Upgrade emergency lighting...' }
]
[PDF] actions sample (before register) [
  // Same data structure
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

## Status

✅ Document ID logged before queries
✅ Actions count logged after queries
✅ source field included in draft query select
✅ reference_number added to draft query select (was missing)
✅ Sources summary logged before PDF generation
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
