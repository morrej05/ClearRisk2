# Action Plan Snapshot: Ultra-Short Titles (70 Character Hard Cap) - COMPLETE

## Overview

Added a new helper function `deriveSystemSnapshotTitle` with a 70-character hard cap for system actions displayed in the Action Plan Snapshot. This ensures clean, scannable action titles regardless of punctuation or sentence structure.

## Implementation

### New Function Added
**File:** `src/lib/pdf/pdfUtils.ts` (lines 118-141)

```typescript
/**
 * Derive ultra-short title for system actions in Action Plan Snapshot.
 * Hard cap at 70 characters for snapshot readability and clean scanning.
 * Manual actions are returned unchanged.
 */
export function deriveSystemSnapshotTitle(action: { recommended_action?: string; source?: string }): string {
  const text = String(action?.recommended_action || '').trim();
  if (!text) return '(No action text provided)';

  const src = String(action?.source || '').toLowerCase();
  if (src !== 'system') return text;

  // Remove common filler starts (optional but helps)
  let t = text
    .replace(/^(urgent|immediate)\s*[:\-]\s*/i, '')
    .replace(/^confirm (requirement )?for\s+/i, '')
    .replace(/^provide\s+/i, '')
    .trim();

  // Hard cap for snapshot readability
  const max = 70;
  if (t.length > max) t = t.slice(0, max - 1).trimEnd() + '…';
  return t;
}
```

### Usage Updated
**File:** `src/lib/pdf/pdfUtils.ts` (line 1123)

**Before:**
```typescript
const actionTitle = deriveSystemActionTitle(action);
```

**After:**
```typescript
const actionTitle = deriveSystemSnapshotTitle(action);
```

## Function Separation Strategy

### `deriveSystemSnapshotTitle` (NEW - 70 chars)
- **Purpose:** Ultra-short titles for Action Plan Snapshot
- **Max Length:** 70 characters (hard cap)
- **Used In:** `drawActionPlanSnapshot` (Executive Summary section)
- **Philosophy:** Aggressive truncation for clean scanning

### `deriveSystemActionTitle` (EXISTING - 95 chars)
- **Purpose:** Concise but complete titles for Action Register
- **Max Length:** 95 characters (after intelligent parsing)
- **Used In:** `drawActionRegister` (full register at end of document)
- **Philosophy:** Smart clause extraction for readability

## Benefits

### Before This Change
- System actions could overflow in snapshot
- Titles cut off mid-word
- Hard to scan quickly

### After This Change
- Clean 70-character truncation
- Scannable action titles
- Snapshot remains compact and professional

## Status

✅ New `deriveSystemSnapshotTitle` function created (70-char hard cap)
✅ Action Plan Snapshot updated to use snapshot-specific function
✅ Action Register preserved with `deriveSystemActionTitle` (95-char)
✅ Manual actions unchanged in both contexts
✅ Build successful
✅ Ready to test

## Implementation Date

February 24, 2026
