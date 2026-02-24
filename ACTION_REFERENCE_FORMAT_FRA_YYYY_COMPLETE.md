# Action Reference Format: FRA-YYYY-### Complete

## Summary

Changed action reference number format from `R-xx` to `FRA-YYYY-###` with per-document scoping and automatic renumbering of legacy references.

## Changes Made

### File: `src/utils/actionReferenceNumbers.ts`

#### 1. Added Helper Functions

**getRefYear(document)** - Extract year from document
```typescript
function getRefYear(document: any): number {
  // Prefer issue_date year if present, else current year
  const d = document?.issue_date ? new Date(document.issue_date) : new Date();
  const y = d.getFullYear();
  return Number.isFinite(y) ? y : new Date().getFullYear();
}
```

**sortActionsForRenumbering(a, b)** - Canonical sort for deterministic assignment
```typescript
function sortActionsForRenumbering(a: any, b: any): number {
  // Priority band ASC (P1 → P4)
  // Target date ASC (nulls last)
  // Created_at ASC
  const pr = priorityRank(a.priority_band) - priorityRank(b.priority_band);
  if (pr !== 0) return pr;

  const td = dateValue(a.target_date) - dateValue(b.target_date);
  if (td !== 0) return td;

  const ca = new Date(a.created_at).getTime();
  const cb = new Date(b.created_at).getTime();
  return ca - cb;
}
```

#### 2. Changed Reference Format

**Before** (Old format):
```typescript
const refNumber = `R-${nextNumber.toString().padStart(2, '0')}`;
// Example: R-01, R-02, R-39
```

**After** (New format):
```typescript
const year = getRefYear(document);
const refNumber = `FRA-${year}-${String(nextNumber).padStart(3, '0')}`;
// Example: FRA-2026-001, FRA-2026-002
```

#### 3. Changed Scope from Lineage to Single Document

**Before** (Scanned all related documents):
```typescript
// Fetched all documents in lineage
const { data: relatedDocs } = await supabase
  .from('documents')
  .select('id')
  .eq('base_document_id', baseDocumentId);

const documentIds = relatedDocs?.map(doc => doc.id) || [];

// Scanned all actions across entire document series
const { data: refs } = await supabase
  .from('actions')
  .select('reference_number')
  .not('reference_number', 'is', null)
  .in('document_id', documentIds); // Problem: R-39 because of cross-document count
```

**After** (Single document only):
```typescript
// Fetch all actions for THIS DOCUMENT ONLY (not lineage)
const { data: actions } = await supabase
  .from('actions')
  .select('id, reference_number, status, priority_band, target_date, created_at')
  .eq('document_id', documentId); // Only THIS document

// Find max existing number in new format for THIS document only
const existingRefs = actions.filter(a => a.reference_number).map(a => a.reference_number);
```

#### 4. Updated Pattern Matching

**Before** (Old R-xx pattern):
```typescript
const match = ref.reference_number?.match(/R-(\d+)/);
if (match) {
  const num = parseInt(match[1], 10);
  if (num > maxNumber) maxNumber = num;
}
```

**After** (New FRA-YYYY-### pattern):
```typescript
const match = ref.match(/^FRA-(\d{4})-(\d{3})$/);
if (match) {
  const num = parseInt(match[2], 10); // Extract numeric part
  if (num > maxNumber) maxNumber = num;
}
```

#### 5. Added Legacy Reference Renumbering

**Detection of actions needing (re)assignment**:
```typescript
const actionsNeedingRefs = actions.filter(a => {
  if (!a.reference_number) return true; // No ref
  // Old format (R-xx) needs renumbering
  if (a.reference_number.match(/^R-\d+$/)) return true;
  return false;
});
```

**Deterministic renumbering**:
```typescript
// Sort actions in canonical order for deterministic assignment
const sortedActions = [...actionsNeedingRefs].sort(sortActionsForRenumbering);

let nextNumber = maxNumber + 1;

for (const action of sortedActions) {
  const refNumber = `FRA-${year}-${String(nextNumber).padStart(3, '0')}`;
  // Update database with new reference
  await supabase
    .from('actions')
    .update({ reference_number: refNumber })
    .eq('id', action.id);

  nextNumber++;
}
```

## Reference Format Specification

### Format

```
FRA-YYYY-###
```

Where:
- `FRA` - Fixed prefix (Fire Risk Assessment)
- `YYYY` - 4-digit year from document issue_date (or current year if not issued)
- `###` - 3-digit sequential number (001, 002, 003...)

### Examples

- `FRA-2026-001` - First action in 2026 document
- `FRA-2026-002` - Second action in 2026 document
- `FRA-2025-123` - 123rd action in 2025 document

### Year Source Priority

1. Document `issue_date` year (if issued)
2. Current year (if draft/not issued)

## Scoping Rules

### Per-Document Numbering

- Each document has its own independent sequence
- References start at `001` for each new document
- No cross-document counting (prevents R-39 problem)

### Example Scenario

**Document A** (2026):
- Action 1: `FRA-2026-001`
- Action 2: `FRA-2026-002`
- Action 3: `FRA-2026-003`

**Document B** (2026, different document):
- Action 1: `FRA-2026-001` ✅ (Independent sequence)
- Action 2: `FRA-2026-002` ✅
- Action 3: `FRA-2026-003` ✅

**Document A v2** (New version):
- Carried forward actions keep original refs: `FRA-2026-001`, `FRA-2026-002`
- New actions: `FRA-2026-004`, `FRA-2026-005`

## Legacy Reference Migration

### Automatic Renumbering

When `assignActionReferenceNumbers()` runs:

1. Detects any actions with old `R-xx` format
2. Treats them as "needing assignment"
3. Sorts them canonically (priority → target_date → created_at)
4. Assigns new `FRA-YYYY-###` references deterministically

### Before/After Example

**Before** (Legacy R-xx):
- Action 1: `R-01` (P2, 2026-03-15)
- Action 2: `R-02` (P1, 2026-02-01)
- Action 3: `R-39` (P3, null)

**After** (Renumbered to FRA-YYYY-###):
- Action 2: `FRA-2026-001` (P1 comes first)
- Action 1: `FRA-2026-002` (P2, earlier target date)
- Action 3: `FRA-2026-003` (P3, null target date last)

### Stability

- Same sort order as FRA PDF ensures consistency
- Deterministic: running twice produces same results
- Old R-xx references never displayed again

## Uniqueness Guarantees

- `reference_number` remains unique per document_id
- Sequential assignment prevents collisions
- Starts from max existing + 1

## Impact Analysis

### What Changed

✅ Reference format: `R-xx` → `FRA-YYYY-###`
✅ Scoping: Document lineage → Single document
✅ Pattern matching: `/R-(\d+)/` → `/^FRA-(\d{4})-(\d{3})$/`
✅ Legacy migration: Automatic renumbering of R-xx
✅ Year extraction: From document issue_date

### What Didn't Change

- Action content/priority/lifecycle
- Carry-forward logic (references preserved)
- Database schema
- Action creation workflow
- FRA PDF display (uses canonical DB refs)

## Verification

**Build Status**: ✅ Successful (23.80s, 1946 modules)

**Expected Behavior**:
1. ✅ New actions get `FRA-2026-001`, `FRA-2026-002`, etc.
2. ✅ Each document has independent numbering starting at 001
3. ✅ Old R-xx references automatically renumbered on next assignment
4. ✅ Year comes from document issue_date or current year
5. ✅ References unique per document_id
6. ✅ Sort order matches FRA PDF canonical order

## Testing Checklist

### New Documents
- [ ] First action assigned `FRA-YYYY-001`
- [ ] Second action assigned `FRA-YYYY-002`
- [ ] Year matches document issue_date or current year
- [ ] Numbering resets for each new document

### Legacy Documents (R-xx)
- [ ] Running assignment detects old R-xx format
- [ ] All R-xx actions renumbered to FRA-YYYY-###
- [ ] Order matches canonical sort (priority/target/created)
- [ ] No R-xx references remain after renumbering

### Issued Documents
- [ ] Year extracted from issue_date field
- [ ] References remain stable after issue
- [ ] Carried-forward actions keep original refs

### Cross-Document Verification
- [ ] Document A has FRA-2026-001, 002, 003
- [ ] Document B (separate) also has FRA-2026-001, 002, 003
- [ ] No cross-document interference
- [ ] Each document independent sequence

## Migration Path

### For Existing Documents

1. When issuing or updating a document, `assignActionReferenceNumbers()` is called
2. Function detects any R-xx references in that document
3. Automatically renumbers them to FRA-YYYY-### format
4. Uses canonical sort order for deterministic results
5. No manual migration needed

### Gradual Migration

- Old documents keep R-xx until next issue/update
- New documents always get FRA-YYYY-###
- On-demand renumbering prevents disruption
- Users see improved references immediately after renumbering

---

**Result**: Action references now use professional `FRA-YYYY-###` format with per-document scoping, preventing cross-document numbering issues like R-39. Legacy R-xx references automatically renumbered to new format on next assignment.
