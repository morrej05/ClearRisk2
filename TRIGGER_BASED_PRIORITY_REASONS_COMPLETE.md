# Trigger-Based Priority Reasons - Full Implementation Complete

## Overview

Successfully implemented comprehensive trigger-based priority reasons throughout the FRA system. All actions now include structured trigger metadata (trigger_id + trigger_text), which is stored in the database, displayed in PDFs, and used to explain why specific priorities were assigned.

## Implementation Summary

### ✅ Component Status

| Component | Status | Notes |
|-----------|--------|-------|
| Severity Engine | ✅ Complete | Returns structured FraSeverityResult with trigger metadata |
| AddActionModal | ✅ Complete | Stores trigger_id and trigger_text on action creation |
| Legacy Migration | ✅ Complete | Backfills legacy actions with safe trigger metadata |
| FRA PDF Action Register | ✅ Complete | Displays "Reason: {text}" for P1/P2 actions |
| Executive Summary | ✅ Complete | Shows triggers in parentheses for top 3 issues |
| Database Schema | ✅ Existing | trigger_id and trigger_text columns already present |
| Build | ✅ Passing | All TypeScript compilation successful |

## Changes Made

### 1. Severity Engine - Already Complete ✅

**File: `src/lib/modules/fra/severityEngine.ts`**

The severity engine already returns structured results:

```typescript
export interface FraSeverityResult {
  tier: FraSeverityTier;      // T1, T2, T3, T4
  priority: FraPriority;       // P1, P2, P3, P4
  triggerId: string;           // e.g., "MOE-P1-01"
  triggerText: string;         // Human-readable reason
}

export function deriveSeverity(
  action: FraActionInput,
  ctx: FraContext
): FraSeverityResult {
  // Returns structured result with trigger context
}
```

**Example Triggers:**

**P1 (Material Life Safety Risk):**
- `MOE-P1-01`: "Final exit is locked or secured in a manner that may prevent escape."
- `MOE-P1-02`: "Escape route or final exit is obstructed, potentially delaying evacuation."
- `DA-P1-01`: "Sleeping premises with no suitable fire detection and warning system."
- `EL-P1-01`: "No effective emergency lighting where power failure could impair escape."
- `MOE-P1-03`: "Single escape stair compromised in a building reliant on that stair for evacuation."
- `COMP-P1-01`: "Significant compartmentation failures in sleeping premises affecting smoke/fire spread."
- `COMP-P1-03`: "High-risk room opens onto an escape route without suitable protection."

**P2 (Significant Deficiency):**
- `DA-P2-01`: "No suitable fire detection and warning system to provide timely warning."
- `DA-P2-02`: "Fire detection coverage is incomplete and may delay warning."
- `COMP-P2-01`: "Compartmentation deficiencies likely to compromise the intended strategy."
- `MOE-P2-01`: "Stair/escape route weaknesses increase the potential for smoke spread during evacuation."
- `MGMT-P2-01`: "Insufficient evidence of fire safety management arrangements and review."

**P3 (Improvement Required):**
- `GEN-P3-01`: "Improvement required to strengthen fire safety management arrangements."

**P4 (Good Practice):**
- `GEN-P4-01`: "Good practice recommendation."

**Manual Escalation:**
- `MANUAL-P1`: "Manually escalated to P1 by assessor."

**Legacy Actions:**
- `LEGACY-SCORE`: "Priority derived from legacy scoring (migrated)."

### 2. AddActionModal - Already Complete ✅

**File: `src/components/actions/AddActionModal.tsx`**

Already stores trigger metadata on action creation:

```typescript
// Lines 91-95: Derive trigger metadata
const severityResult = deriveSeverity(actionInput, fraContext);
let priorityBand = severityResult.priority;
let severityTier = severityResult.tier;
let triggerId = severityResult.triggerId;
let triggerText = severityResult.triggerText;

// Lines 98-103: Manual escalation override
if (formData.escalateToP1) {
  priorityBand = 'P1';
  severityTier = 'T4';
  triggerId = 'MANUAL-P1';
  triggerText = 'Manually escalated to P1 by assessor.';
}

// Lines 210-232: Save to database
const actionData = {
  // ... other fields
  priority_band: priorityBand,
  severity_tier: severityTier,
  trigger_id: triggerId,
  trigger_text: triggerText,
  finding_category: formData.category,
  // ... other fields
};
```

**Key Features:**
- ✅ Automatic trigger derivation from severity engine
- ✅ Manual escalation preserves justification
- ✅ trigger_id and trigger_text stored in database
- ✅ No deletion of trigger metadata allowed

### 3. Legacy Migration - Already Complete ✅

**File: `src/lib/modules/fra/migrateLegacyFraActions.ts`**

Safely backfills legacy actions:

```typescript
export function migrateLegacyFraAction(action: any, ctx: FraContext): any {
  // Skip if already migrated
  if (action.severity_tier && action.priority_band && action.trigger_id) {
    return action;
  }

  let result: FraSeverityResult;

  // Use legacy risk_score if available
  const score = action.risk_score ?? null;

  if (score !== null) {
    // Map legacy score bands to tiers
    let tier: FraSeverityTier = 'T2';
    if (score >= 20) tier = 'T4';
    else if (score >= 12) tier = 'T3';
    else if (score >= 6) tier = 'T2';
    else tier = 'T1';

    result = {
      tier,
      priority: mapTierToPriority(tier),
      triggerId: 'LEGACY-SCORE',
      triggerText: 'Priority derived from legacy scoring (migrated).',
    };
  } else {
    // No score available - use severity engine
    const actionInput = buildActionInputFromLegacyFields(action);
    result = deriveSeverity(actionInput, ctx);
  }

  return {
    ...action,
    severity_tier: result.tier,
    priority_band: result.priority,
    trigger_id: result.triggerId,
    trigger_text: result.triggerText,
  };
}
```

**Migration Logic:**
1. **Already Migrated**: Skip if trigger_id exists
2. **Has Legacy Score**: Use `LEGACY-SCORE` trigger
3. **No Score**: Apply severity engine rules
4. **Safe Defaults**: Never leaves actions without triggers

### 4. FRA PDF Action Register - Already Complete ✅

**File: `src/lib/pdf/buildFraPdf.ts` (Lines 1852-1868)**

Displays priority reasons in action register:

```typescript
// Add reason for priority for P1/P2 actions
if ((action.priority_band === 'P1' || action.priority_band === 'P2') && action.trigger_text) {
  yPosition -= 2;
  if (yPosition < MARGIN + 50) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN - 20;
  }
  page.drawText(`Reason: ${sanitizePdfText(action.trigger_text)}`, {
    x: MARGIN + 5,
    y: yPosition,
    size: 9,
    font,
    color: rgb(0.6, 0.3, 0.3),  // Muted red color
  });
  yPosition -= 14;
}
```

**Visual Rendering:**
```
[P1] Final exit doors locked in main staircase
Reason: Final exit is locked or secured in a manner that may prevent escape.
Owner: John Smith | Target: 2026-03-01 | Status: open
─────────────────────────────────────────────────────────────

[P2] Fire detection coverage incomplete in basement
Reason: Fire detection coverage is incomplete and may delay warning.
Owner: Jane Doe | Target: 2026-04-15 | Status: open
─────────────────────────────────────────────────────────────
```

**Formatting:**
- ✅ Shown only for P1 and P2 actions
- ✅ Smaller font size (9pt vs 10pt)
- ✅ Muted red color for visual distinction
- ✅ Slightly indented (consistent with action text)
- ✅ One line only (doesn't wrap)
- ✅ trigger_id NOT shown (internal only)

### 5. Executive Summary Enhancement - NEW ✅

**File: `src/lib/pdf/buildFraPdf.ts` (Lines 804-826)**

Added trigger reasons to "Key Issues Requiring Attention" section:

```typescript
// Add trigger reason for P1/P2 actions in executive summary
if ((action.priority_band === 'P1' || action.priority_band === 'P2') && action.trigger_text) {
  const reasonText = sanitizePdfText(action.trigger_text);
  const truncatedReason = reasonText.length > 80 ? reasonText.substring(0, 77) + '...' : reasonText;

  if (yPosition < MARGIN + 60) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN - 20;
  }

  page.drawText(`(${truncatedReason})`, {
    x: MARGIN + 50,
    y: yPosition,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),  // Neutral gray
  });

  yPosition -= 12;
} else {
  yPosition -= 6;
}
```

**Visual Example:**
```
Key Issues Requiring Attention:

[P1] Final exit doors locked in main staircase
     (Final exit is locked or secured in a manner that may prevent escape.)

[P2] Fire detection coverage incomplete in basement storage
     (Fire detection coverage is incomplete and may delay warning.)

[P2] Compartmentation breach identified in service riser
     (Compartmentation deficiencies likely to compromise the intended strategy.)
```

**Formatting:**
- ✅ Shown in parentheses for subtlety
- ✅ Smaller font (8pt) and gray color
- ✅ Truncated to 80 characters if needed
- ✅ Only for P1/P2 in top 3 issues
- ✅ Maintains professional tone

## Database Schema

**Table: `actions`**

The trigger columns already exist (added in previous migration):

```sql
ALTER TABLE actions ADD COLUMN trigger_id text;
ALTER TABLE actions ADD COLUMN trigger_text text;

COMMENT ON COLUMN actions.trigger_id IS
  'Structured trigger identifier (e.g., MOE-P1-01) referencing specific severity rule';

COMMENT ON COLUMN actions.trigger_text IS
  'Human-readable explanation of why this priority was assigned';
```

**Column Details:**
- `trigger_id`: Structured identifier (e.g., "MOE-P1-01", "LEGACY-SCORE", "MANUAL-P1")
- `trigger_text`: Full explanation text shown in PDFs
- Both nullable for backward compatibility
- Automatically populated for all new actions
- Backfilled for legacy actions via migration function

## Usage Examples

### Example 1: Creating a New Action

**User Actions:**
1. Opens AddActionModal
2. Selects "Means of Escape" category
3. Checks "Final exit locked" trigger
4. Enters action text
5. Submits

**System Behavior:**
```typescript
// Severity engine evaluates
const result = deriveSeverity({
  category: 'MeansOfEscape',
  finalExitLocked: true,
}, { occupancyRisk: 'NonSleeping', storeys: 2 });

// Returns:
{
  tier: 'T4',
  priority: 'P1',
  triggerId: 'MOE-P1-01',
  triggerText: 'Final exit is locked or secured in a manner that may prevent escape.'
}

// Stored in database:
priority_band: 'P1'
severity_tier: 'T4'
trigger_id: 'MOE-P1-01'
trigger_text: 'Final exit is locked or secured in a manner that may prevent escape.'
```

### Example 2: Migrating Legacy Action

**Legacy Action:**
```javascript
{
  id: '123',
  recommended_action: 'Improve fire detection',
  likelihood: 4,
  impact: 5,
  risk_score: 20,  // L4 × I5 = 20
  // No trigger fields
}
```

**After Migration:**
```javascript
{
  id: '123',
  recommended_action: 'Improve fire detection',
  likelihood: 4,  // Preserved
  impact: 5,      // Preserved
  risk_score: 20, // Preserved
  severity_tier: 'T4',  // Mapped from score >= 20
  priority_band: 'P1',  // T4 → P1
  trigger_id: 'LEGACY-SCORE',
  trigger_text: 'Priority derived from legacy scoring (migrated).'
}
```

### Example 3: PDF Rendering

**Executive Summary - Key Issues:**
```
Key Issues Requiring Attention:

[P1] Emergency exit route blocked by stored materials
     (Escape route or final exit is obstructed, potentially delaying evacuation.)

[P1] Fire detection system not operational in sleeping accommodation
     (Sleeping premises with no suitable fire detection and warning system.)

[P2] Compartmentation failures affecting fire spread control
     (Compartmentation deficiencies likely to compromise the intended strategy.)
```

**Action Register:**
```
[P1]
Install emergency lighting throughout escape routes and exits.
Reason: No effective emergency lighting where power failure could impair escape.
Owner: John Smith | Target: 2026-03-15 | Status: open
────────────────────────────────────────────────────────────────────

[P2]
Upgrade fire detection system to provide coverage in basement storage.
Reason: Fire detection coverage is incomplete and may delay warning.
Owner: Jane Doe | Target: 2026-04-30 | Status: open
────────────────────────────────────────────────────────────────────

[P3]
Review and update fire safety management documentation.
Owner: (Unassigned) | Target: 2026-06-01 | Status: open
────────────────────────────────────────────────────────────────────
```

**Note:** P3 and P4 actions do NOT show reason (only P1/P2)

## Trigger ID Naming Convention

**Format:** `{CATEGORY}-{PRIORITY}-{SEQUENCE}`

**Examples:**
- `MOE-P1-01` = Means of Escape, P1, first trigger
- `DA-P2-02` = Detection & Alarm, P2, second trigger
- `COMP-P1-01` = Compartmentation, P1, first trigger
- `MGMT-P2-01` = Management, P2, first trigger

**Special IDs:**
- `LEGACY-SCORE` = Migrated from L×I scoring
- `MANUAL-P1` = Manually escalated by assessor
- `GEN-P3-01` = Generic P3 improvement
- `GEN-P4-01` = Generic P4 good practice

**Category Codes:**
- `MOE` = Means of Escape
- `DA` = Detection & Alarm
- `EL` = Emergency Lighting
- `COMP` = Compartmentation
- `MGMT` = Management
- `GEN` = General/Default

## Benefits

### 1. Professional Clarity
✅ Assessors can instantly see why each priority was assigned
✅ Clients understand the severity without technical jargon
✅ Clear, defensible justification for all priorities

### 2. Consistency
✅ Every P1/P2 action has explicit trigger text
✅ No orphaned priorities without explanation
✅ Standardized language across all reports

### 3. Audit Trail
✅ trigger_id provides traceable reference
✅ Reason preserved even if rules change later
✅ Legacy actions handled with clear migration marker

### 4. No L×I References
✅ trigger_text never mentions Likelihood × Impact
✅ Completely qualitative language
✅ Focuses on risk factors, not numeric scores

### 5. Educational Value
✅ New assessors learn severity triggers
✅ Clients understand fire safety priorities
✅ Demonstrates professional competence

## Testing Checklist

### 1. New Action Creation
- [ ] Create P1 action with critical trigger → trigger_text displays in PDF
- [ ] Create P2 action with deficiency trigger → trigger_text displays in PDF
- [ ] Create P3 action → NO trigger_text in PDF (correct)
- [ ] Create P4 action → NO trigger_text in PDF (correct)
- [ ] Manually escalate to P1 → shows "Manually escalated to P1 by assessor"

### 2. Legacy Migration
- [ ] Migrate action with risk_score 24 → gets LEGACY-SCORE trigger
- [ ] Migrate action with no score → gets derived trigger from engine
- [ ] Migrate action already with trigger_id → unchanged (skip migration)

### 3. PDF Rendering
- [ ] Action Register shows "Reason: {text}" for P1
- [ ] Action Register shows "Reason: {text}" for P2
- [ ] Action Register does NOT show reason for P3/P4
- [ ] Executive Summary top issues show triggers in parentheses for P1/P2
- [ ] Executive Summary does NOT show triggers for P3/P4
- [ ] trigger_id never appears in client PDFs

### 4. Visual Formatting
- [ ] Trigger text in action register is smaller font (9pt)
- [ ] Trigger text is muted red color (distinguishable)
- [ ] Executive summary triggers are gray and in parentheses
- [ ] Text is properly sanitized (no special chars breaking PDF)
- [ ] Long trigger text truncated appropriately (80 chars in exec summary)

### 5. Data Integrity
- [ ] All new actions have trigger_id and trigger_text
- [ ] trigger_text is never null for P1/P2 actions
- [ ] Legacy actions preserve original L/I/Score fields
- [ ] Manual escalations preserve escalation_justification field
- [ ] No trigger_text can be deleted after creation

## Acceptance Criteria

✅ **All new actions contain triggerId + triggerText**
- Verified in AddActionModal.tsx lines 219-220

✅ **Legacy actions display reason**
- Verified in migrateLegacyFraActions.ts with LEGACY-SCORE trigger

✅ **PDF contains no L×I references**
- Confirmed: trigger_text uses only qualitative language
- No "Likelihood × Impact" anywhere in trigger definitions

✅ **P1/P2 actions clearly show why they are prioritised**
- Action Register: "Reason: {trigger_text}" in smaller font
- Executive Summary: Trigger text in parentheses

✅ **No database columns dropped**
- No schema changes made (columns already existed)
- Legacy columns preserved (likelihood, impact, risk_score)

✅ **No schema-breaking changes**
- All changes backward compatible
- Existing triggers preserved
- Migration function handles all cases safely

## Future Enhancements

### 1. Trigger Analytics
- Dashboard showing most common triggers
- Trend analysis of priority reasons over time
- Portfolio-wide trigger frequency reporting

### 2. Custom Triggers
- Allow organizations to define custom triggers
- Jurisdiction-specific trigger library
- Industry-specific trigger sets

### 3. Trigger Recommendations
- AI-suggested triggers based on action text
- Auto-categorization from natural language
- Learning from assessor selections

### 4. Multi-Language Support
- Translated trigger_text for different jurisdictions
- Welsh, Irish, Scottish variations
- International building codes

### 5. Trigger Hierarchy
- Parent/child trigger relationships
- Trigger dependencies and combinations
- Composite trigger logic

---

**Status**: ✅ Complete
**Build**: ✅ Passing
**Database**: ✅ No changes needed (schema already exists)
**PDF Rendering**: ✅ Implemented for both Action Register and Executive Summary
**Legacy Support**: ✅ Safe migration with LEGACY-SCORE marker
**No L×I**: ✅ Confirmed - all trigger text is qualitative
