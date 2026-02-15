# BOLT 6 — Trigger IDs + Reasons Implementation Complete

## Overview

Successfully implemented structured trigger IDs and human-readable priority reasons for FRA actions. The severity engine now returns complete context for why each action received its priority, with P1/P2 actions displaying their reasoning in PDF outputs.

## Changes Implemented

### 1. Severity Engine Enhancement ✅

**File: `src/lib/modules/fra/severityEngine.ts`**

- Added `FraSeverityResult` interface with structured output:
  ```typescript
  interface FraSeverityResult {
    tier: FraSeverityTier;
    priority: FraPriority;
    triggerId: string;      // e.g., "MOE-P1-01"
    triggerText: string;    // Human-readable explanation
  }
  ```

- Created new `deriveSeverity()` function that returns full context:
  - **P1 Triggers** (T4 - Material Life Safety Risk):
    - `MOE-P1-01`: Final exit locked or secured preventing escape
    - `MOE-P1-02`: Escape route or final exit obstructed
    - `DA-P1-01`: Sleeping premises with no fire detection
    - `EL-P1-01`: No emergency lighting where power failure could impair escape
    - `MOE-P1-03`: Single escape stair compromised in multi-storey building
    - `COMP-P1-01`: Compartmentation failures in sleeping premises
    - `COMP-P1-03`: High-risk room opens onto escape route without protection

  - **P2 Triggers** (T3 - Significant Deficiency):
    - `DA-P2-01`: No suitable fire detection system
    - `DA-P2-02`: Fire detection coverage incomplete
    - `COMP-P2-01`: Compartmentation deficiencies compromise strategy
    - `MOE-P2-01`: Stair/escape route weaknesses increase smoke spread risk
    - `MGMT-P2-01`: Insufficient evidence of fire safety management

  - **P3 Triggers** (T2 - Improvement Required):
    - `GEN-P3-01`: Management/housekeeping improvements needed

  - **P4 Triggers** (T1 - Minor):
    - `GEN-P4-01`: Good practice recommendation

  - **Manual Escalation**:
    - `MANUAL-P1`: Manually escalated to P1 by assessor

- Deprecated old `deriveSeverityTier()` function (now wraps `deriveSeverity()`)

### 2. Database Schema Update ✅

**Migration: `add_trigger_fields_to_actions`**

Added two new columns to `actions` table:
- `trigger_id` (text, nullable) - Structured trigger identifier
- `trigger_text` (text, nullable) - Human-readable priority explanation
- Created index on `trigger_id` for efficient queries
- Columns are nullable to support gradual migration of legacy actions

### 3. Legacy Action Migration ✅

**File: `src/lib/modules/fra/migrateLegacyFraActions.ts`**

Updated to populate trigger fields:
- Actions with legacy `risk_score`:
  - `triggerId = "LEGACY-SCORE"`
  - `triggerText = "Priority derived from legacy scoring (migrated)."`

- Actions without score but with severity flags:
  - Uses `deriveSeverity()` to get proper trigger context

- Backfill script updated to write trigger fields to database

### 4. Action Creation Modal ✅

**File: `src/components/actions/AddActionModal.tsx`**

- Changed from `deriveSeverityTier()` to `deriveSeverity()`
- Extracts all fields: `tier`, `priority`, `triggerId`, `triggerText`
- Manual P1 escalation sets:
  - `triggerId = "MANUAL-P1"`
  - `triggerText = "Manually escalated to P1 by assessor."`
- Database insert includes `trigger_id` and `trigger_text` fields

### 5. PDF Rendering Enhancement ✅

**Files Updated:**
- `src/lib/pdf/buildFraPdf.ts` ✅
- `src/lib/pdf/buildFsdPdf.ts` ✅
- `src/lib/pdf/buildDsearPdf.ts` ✅
- `src/lib/pdf/buildCombinedPdf.ts` ✅

**Action Interface** - Added trigger fields to all PDF builders:
```typescript
interface Action {
  // ... existing fields
  trigger_id?: string | null;
  trigger_text?: string | null;
}
```

**FRA PDF Rendering** - Added priority reason display:
```typescript
// After action text, for P1/P2 actions only
if ((action.priority_band === 'P1' || action.priority_band === 'P2') && action.trigger_text) {
  page.drawText(`Reason: ${sanitizePdfText(action.trigger_text)}`, {
    size: 9,
    color: rgb(0.6, 0.3, 0.3),  // Reddish brown color
  });
}
```

**Format in PDF:**
```
[P1] 1.2.3 Fire doors wedged open in main staircase
Reason: High-risk room opens onto an escape route without suitable protection.
Owner: John Smith | Target: 2026-03-01 | Status: open
```

### 6. In-Memory Migration ✅

Already implemented in BOLT 5, now updated to include trigger fields:
- `DocumentPreviewPage.tsx`
- `ClientDocumentView.tsx`
- `DocumentOverview.tsx`

All migration points now populate trigger_id and trigger_text.

### 7. Database Backfill Script ✅

**File: `src/scripts/backfillFraSeverity.ts`**

Updated to backfill trigger fields:
- Fetches actions missing `trigger_id`
- Runs `migrateLegacyFraAction()` for each
- Updates database with all four fields:
  - `severity_tier`
  - `priority_band`
  - `trigger_id`
  - `trigger_text`

## Running the Backfill

After deployment, run the database backfill script:

```bash
npx tsx src/scripts/backfillFraSeverity.ts
```

This will:
1. Find all FRA/FSD/DSEAR documents
2. Load building profile for FRA context
3. Migrate actions missing trigger fields
4. Update database records
5. Report statistics

## Example Trigger Outputs

### P1 (Material Life Safety)
```
Action: Replace damaged fire doors in final exit corridor
Priority: P1
Trigger ID: MOE-P1-02
Reason: Escape route or final exit is obstructed, potentially delaying evacuation.
```

### P2 (Significant Deficiency)
```
Action: Install fire detection system in basement storage area
Priority: P2
Trigger ID: DA-P2-02
Reason: Fire detection coverage is incomplete and may delay warning.
```

### P3 (Improvement Required)
```
Action: Implement monthly fire safety inspections
Priority: P3
Trigger ID: GEN-P3-01
Reason: Improvement required to strengthen fire safety management arrangements.
```

### P4 (Good Practice)
```
Action: Consider upgrading signage to photoluminescent type
Priority: P4
Trigger ID: GEN-P4-01
Reason: Good practice recommendation.
```

### Legacy Migrated
```
Action: Repair damaged compartment wall
Priority: P2
Trigger ID: LEGACY-SCORE
Reason: Priority derived from legacy scoring (migrated).
```

## Safety Features

✅ **No data loss**: All legacy columns preserved
✅ **Backward compatible**: Trigger fields are optional
✅ **Idempotent**: Can run backfill multiple times safely
✅ **Defensive**: Handles missing data gracefully
✅ **Auditable**: Clear trigger IDs for tracking priority decisions

## Display Rules

### PDF Output
- **P1 actions**: Show "Reason: {trigger_text}" line in reddish color
- **P2 actions**: Show "Reason: {trigger_text}" line in reddish color
- **P3 actions**: No reason displayed (clutter reduction)
- **P4 actions**: No reason displayed (clutter reduction)
- **trigger_id**: Never shown in client PDFs (internal use only)

### Internal UI (Future Enhancement)
Could add tooltip or "Why?" icon for P1/P2 showing:
- Trigger ID (for support/debugging)
- Trigger text (for clarity)

## Acceptance Criteria Met

✅ New actions store priority + severityTier + triggerId + triggerText
✅ Migrated legacy actions have triggerText populated
✅ FRA PDF shows "Reason" for P1/P2 actions
✅ No L×I fields appear in UI or PDF
✅ Trigger IDs follow consistent naming convention
✅ Build passes successfully
✅ All PDF types updated with trigger fields

## Testing Checklist

1. **Create New Action**
   - [ ] Open AddActionModal
   - [ ] Select various severity flags
   - [ ] Verify correct triggerId/triggerText computed
   - [ ] Save action and check database

2. **Legacy Action Migration**
   - [ ] Run backfill script
   - [ ] Verify actions with risk_score get LEGACY-SCORE trigger
   - [ ] Verify actions without score get proper trigger from engine

3. **PDF Generation**
   - [ ] Generate FRA PDF with P1 actions
   - [ ] Verify "Reason: ..." line appears under P1 actions
   - [ ] Generate FRA PDF with P2 actions
   - [ ] Verify "Reason: ..." line appears under P2 actions
   - [ ] Verify P3/P4 actions don't show reason

4. **Manual Escalation**
   - [ ] Create action
   - [ ] Check "Escalate to P1" checkbox
   - [ ] Verify triggerId = "MANUAL-P1"
   - [ ] Verify triggerText mentions manual escalation

## Next Steps

1. Deploy code changes
2. Run backfill script: `npx tsx src/scripts/backfillFraSeverity.ts`
3. Monitor for issues
4. Optional: Add internal UI tooltip showing trigger context
5. Future: Remove legacy L×I columns (separate cleanup phase)

## Notes

- Trigger IDs use standardized format: `{CATEGORY}-{PRIORITY}-{SEQUENCE}`
- Examples: `MOE-P1-01`, `DA-P2-02`, `GEN-P3-01`
- Trigger text is concise, professional, and defensible
- No numeric scoring or subjective language
- All triggers mapped to specific, objective conditions
- P1/P2 triggers are always safety-critical and evidence-based

---

**Status**: ✅ Complete
**Build**: ✅ Passing
**Migration**: ✅ Ready to run
**PDF Rendering**: ✅ Implemented
**Database**: ✅ Schema updated
