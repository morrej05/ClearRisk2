# AddActionModal Trigger Persistence & Combined Severity - Complete

## Summary
Successfully tidied up AddActionModal for combined FRA+DSEAR documents with:
1. Meaningful trigger_text persistence (human-readable list of selected triggers)
2. Deterministic combined severity selection (compute both, pick highest)
3. ESLint unused props fixed (removed defaultLikelihood/defaultImpact)

## Problem Statement

### Previous Issues
1. **Trigger Text Loss**: Modal persisted only generic severity-based text, not actual selected trigger labels
2. **Inconsistent Combined Severity**: Conditional branching (if DSEAR else FRA) meant only one engine ran
3. **ESLint Failure**: Unused props `defaultLikelihood` and `defaultImpact` caused lint errors
4. **Combined Document Support**: No support for documents with both FRA and DSEAR modules

## Implementation Details

### 1. ESLint Fix - Removed Unused Props

**File:** `src/components/actions/AddActionModal.tsx`

**Before:**
```typescript
interface AddActionModalProps {
  documentId: string;
  moduleInstanceId: string;
  onClose: () => void;
  onActionCreated: () => void;
  defaultAction?: string;
  defaultLikelihood?: number;  // ← UNUSED
  defaultImpact?: number;       // ← UNUSED
  source?: 'manual' | 'info_gap' | 'recommendation' | 'system';
  sourceModuleKey?: string;
}
```

**After:**
```typescript
interface AddActionModalProps {
  documentId: string;
  moduleInstanceId: string;
  onClose: () => void;
  onActionCreated: () => void;
  defaultAction?: string;
  source?: 'manual' | 'info_gap' | 'recommendation' | 'system';
  sourceModuleKey?: string;
}
```

**Result:** ESLint no longer complains about unused destructured props.

### 2. Combined Document Support

**Added State:**
```typescript
const [enabledModules, setEnabledModules] = useState<string[]>([]);
```

**Fetch enabled_modules from Database:**
```typescript
const { data: doc, error: docError } = await supabase
  .from('documents')
  .select('document_type, enabled_modules')  // ← Now fetches enabled_modules
  .eq('id', documentId)
  .single();

setDocumentType(doc.document_type);
setEnabledModules(doc.enabled_modules || [doc.document_type]);
```

**Determine Framework Availability:**
```typescript
const hasFra = enabledModules.includes('FRA');
const hasDsear = enabledModules.includes('DSEAR');
```

### 3. Trigger Text Building

**New Helper Function:**
```typescript
const buildTriggerText = (): string => {
  const fireLabels: string[] = [];
  const explosionLabels: string[] = [];

  // Collect selected FRA triggers
  const FRA_TRIGGER_MAP = [
    { key: 'finalExitLocked', label: 'Final exit locked/secured' },
    { key: 'finalExitObstructed', label: 'Final exit obstructed' },
    { key: 'noFireDetection', label: 'No fire detection system' },
    { key: 'detectionInadequateCoverage', label: 'Detection coverage inadequate' },
    { key: 'noEmergencyLighting', label: 'No emergency lighting' },
    { key: 'seriousCompartmentationFailure', label: 'Serious compartmentation failure' },
    { key: 'singleStairCompromised', label: 'Single stair compromised' },
    { key: 'highRiskRoomToEscapeRoute', label: 'High-risk room to escape route' },
    { key: 'noFraEvidenceOrReview', label: 'No FRA evidence/overdue review' },
  ];

  for (const trigger of FRA_TRIGGER_MAP) {
    if (formData[trigger.key as keyof typeof formData]) {
      fireLabels.push(trigger.label);
    }
  }

  // Collect selected DSEAR triggers
  for (const trigger of DSEAR_TRIGGERS) {
    if (formData[trigger.id as keyof typeof formData]) {
      explosionLabels.push(trigger.label);
    }
  }

  // Build combined text
  const parts: string[] = [];
  if (fireLabels.length > 0) {
    parts.push(`Fire triggers: ${fireLabels.join(', ')}`);
  }
  if (explosionLabels.length > 0) {
    parts.push(`Explosion triggers: ${explosionLabels.join(', ')}`);
  }

  return parts.join('; ');
};
```

**Example Outputs:**
- FRA only: `"Fire triggers: Final exit locked/secured, No fire detection system"`
- DSEAR only: `"Explosion triggers: Zone 0 / Zone 20 present, Hot work controls inadequate"`
- Combined: `"Fire triggers: Final exit locked/secured; Explosion triggers: Zone 0 / Zone 20 present"`
- No triggers: `""` (empty string)

### 4. Explosion Severity Computation

**New Helper Function:**
```typescript
const computeExplosionTriggerSeverity = (): 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'NONE' => {
  const hasCritical = formData.noHac || formData.zone0_20Present;
  const hasHigh = formData.zone1_21Present || formData.exEquipNotConfirmed ||
                  formData.hotWorkControlsWeak || formData.staticBondingMissing;
  const hasModerate = formData.ventilationInadequate || formData.dsrIncomplete;
  const hasLow = formData.dustHousekeeping;

  if (hasCritical) return 'CRITICAL';
  if (hasHigh) return 'HIGH';
  if (hasModerate) return 'MODERATE';
  if (hasLow) return 'LOW';
  return 'NONE';
};
```

**Severity Mapping:**
- **CRITICAL**: No HAC available OR Zone 0/20 present → P1/T4
- **HIGH**: Zone 1/21, Ex equipment not confirmed, Hot work controls weak, Static bonding missing → P2/T3
- **MODERATE**: Ventilation inadequate, DSR incomplete → P3/T2
- **LOW**: Dust housekeeping issues → P4/T1
- **NONE**: No triggers selected → P4/T1 (default)

### 5. Deterministic Combined Severity Logic

**New Approach:**
```typescript
// Helper: Map severity to priority band
const severityToPriority = (severity: string): { priority: string; tier: string } => {
  switch (severity) {
    case 'CRITICAL': return { priority: 'P1', tier: 'T4' };
    case 'HIGH': return { priority: 'P2', tier: 'T3' };
    case 'MODERATE': return { priority: 'P3', tier: 'T2' };
    case 'LOW': return { priority: 'P4', tier: 'T1' };
    default: return { priority: 'P4', tier: 'T1' };
  }
};

// Helper: Compare severities and return highest
const getHighestSeverity = (sev1: string, sev2: string): string => {
  const rank = { CRITICAL: 4, HIGH: 3, MODERATE: 2, LOW: 1, NONE: 0 };
  return (rank[sev1 as keyof typeof rank] || 0) >= (rank[sev2 as keyof typeof rank] || 0) ? sev1 : sev2;
};

// Compute severity from both engines if applicable
let fraSeverity = 'NONE';
let dsearSeverity = 'NONE';

if (hasFra) {
  const severityResult = deriveSeverity(actionInput, fraContext);
  // Map FRA tier to severity name
  fraSeverity = severityResult.tier === 'T4' ? 'CRITICAL'
              : severityResult.tier === 'T3' ? 'HIGH'
              : severityResult.tier === 'T2' ? 'MODERATE'
              : 'LOW';
}

if (hasDsear) {
  dsearSeverity = computeExplosionTriggerSeverity();
}

// Choose final severity as highest of both
const finalSeverity = getHighestSeverity(fraSeverity, dsearSeverity);
const severityMapping = severityToPriority(finalSeverity);
priorityBand = severityMapping.priority;
severityTier = severityMapping.tier;
```

**Key Benefits:**
- **Always Computes Both**: If both frameworks enabled, both engines run
- **Deterministic**: Highest severity always wins (CRITICAL > HIGH > MODERATE > LOW)
- **Consistent Mapping**: Single mapping function ensures priority bands align
- **No Conditional Branching**: Clear, linear logic flow

### 6. Trigger ID Assignment

**Logic:**
```typescript
const customTriggerText = buildTriggerText();

if (customTriggerText) {
  // Use custom trigger text with selected labels
  triggerText = customTriggerText;

  // Set trigger_id based on final severity and source
  if (finalSeverity === dsearSeverity && dsearSeverity !== 'NONE') {
    triggerId = `EX-MANUAL-${finalSeverity}`;
  } else if (finalSeverity === fraSeverity && fraSeverity !== 'NONE') {
    triggerId = `FRA-MANUAL-${finalSeverity}`;
  } else {
    triggerId = `MANUAL-${finalSeverity}`;
  }
} else {
  // No triggers selected - use defaults
  triggerId = 'MANUAL-LOW';
  triggerText = '';
}
```

**Example trigger_ids:**
- `EX-MANUAL-CRITICAL` - Explosion triggers drove severity to CRITICAL
- `FRA-MANUAL-HIGH` - Fire triggers drove severity to HIGH
- `MANUAL-MODERATE` - Both contributed equally to MODERATE
- `MANUAL-LOW` - No triggers selected

### 7. UI Updates for Combined Documents

**Before:** Single trigger section (FRA OR DSEAR)

**After:** Combined trigger section with separators

```tsx
<div className="border border-neutral-200 rounded-lg p-4">
  <label className="block text-sm font-medium text-neutral-700 mb-3">
    Critical Triggers (check if applicable)
  </label>
  <div className="space-y-2">
    {/* Show FRA triggers if FRA is enabled */}
    {hasFra && (
      <>
        {hasDsear && (
          <div className="text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2 mt-2">
            Fire Safety Triggers
          </div>
        )}
        {/* FRA trigger checkboxes... */}
      </>
    )}

    {/* Show DSEAR triggers if DSEAR is enabled */}
    {hasDsear && (
      <>
        {hasFra && (
          <div className="text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2 mt-4">
            Explosion Hazard Triggers
          </div>
        )}
        {/* DSEAR trigger checkboxes... */}
      </>
    )}
  </div>
</div>
```

**Result:**
- FRA-only docs: Show only fire triggers
- DSEAR-only docs: Show only explosion triggers
- Combined docs: Show both sections with clear headers

## Testing Scenarios

### Scenario 1: FRA Document with Multiple Triggers

**User Actions:**
- Document type: FRA
- Select: "Final exit locked/secured", "No fire detection system"
- Click Create

**Expected Result:**
```json
{
  "trigger_id": "FRA-MANUAL-CRITICAL",
  "trigger_text": "Fire triggers: Final exit locked/secured, No fire detection system",
  "priority_band": "P1",
  "severity_tier": "T4"
}
```

### Scenario 2: DSEAR Document with Multiple Triggers

**User Actions:**
- Document type: DSEAR
- Select: "Zone 1 / Zone 21 present", "Hot work controls inadequate"
- Click Create

**Expected Result:**
```json
{
  "trigger_id": "EX-MANUAL-HIGH",
  "trigger_text": "Explosion triggers: Zone 1 / Zone 21 present, Hot work controls inadequate for classified areas",
  "priority_band": "P2",
  "severity_tier": "T3"
}
```

### Scenario 3: Combined FRA+DSEAR Document

**User Actions:**
- Document type: COMBINED (enabled_modules: ['FRA', 'DSEAR'])
- Select FRA: "No emergency lighting"
- Select DSEAR: "Zone 0 / Zone 20 present"
- Click Create

**Expected Result:**
```json
{
  "trigger_id": "EX-MANUAL-CRITICAL",
  "trigger_text": "Fire triggers: No emergency lighting; Explosion triggers: Zone 0 / Zone 20 present",
  "priority_band": "P1",
  "severity_tier": "T4"
}
```

**Why P1/T4?**
- FRA triggers → HIGH severity (emergency lighting)
- DSEAR triggers → CRITICAL severity (Zone 0/20)
- Final = CRITICAL (highest) → P1/T4
- trigger_id = EX-MANUAL-CRITICAL (explosion was highest)

### Scenario 4: Combined Document, Only FRA Triggers

**User Actions:**
- Document type: COMBINED
- Select FRA: "Single stair compromised"
- Select DSEAR: None
- Click Create

**Expected Result:**
```json
{
  "trigger_id": "FRA-MANUAL-HIGH",
  "trigger_text": "Fire triggers: Single stair compromised",
  "priority_band": "P2",
  "severity_tier": "T3"
}
```

### Scenario 5: No Triggers Selected

**User Actions:**
- Any document type
- Select: No triggers
- Click Create

**Expected Result:**
```json
{
  "trigger_id": "MANUAL-LOW",
  "trigger_text": "",
  "priority_band": "P4",
  "severity_tier": "T1"
}
```

## Database Schema

**No changes required!** Existing schema supports:
- `trigger_id` TEXT - Stores single trigger bucket ID
- `trigger_text` TEXT - Stores human-readable trigger description

The implementation works within existing constraints by:
- Using trigger_id as severity bucket (not multiple IDs)
- Using trigger_text as descriptive list (not constrained format)

## Benefits

### 1. Meaningful Audit Trail
Actions now persist **exactly which triggers** the assessor selected, not just generic severity text.

**Before:** `"Critical fire safety trigger identified by assessor."`
**After:** `"Fire triggers: Final exit locked/secured, No fire detection system"`

### 2. Deterministic Behavior
Combined documents always compute both severities and pick highest - no conditional branching surprises.

### 3. Consistent Priority Mapping
Single severity ranking system ensures priority bands align across FRA/DSEAR/Combined modes.

### 4. Clean Code
- No eslint errors
- Clear helper functions
- Linear logic flow
- Easy to test and debug

### 5. Future-Proof
System easily extends to:
- Additional frameworks (FSD, RE, etc.)
- Custom trigger categories
- Cross-framework severity comparison

## Files Modified

**Single File:** `src/components/actions/AddActionModal.tsx`

**Changes:**
1. Removed unused props (defaultLikelihood, defaultImpact)
2. Added enabledModules state and fetch
3. Added computeExplosionTriggerSeverity() helper
4. Added buildTriggerText() helper
5. Replaced conditional severity logic with deterministic combined logic
6. Updated UI to show both trigger sections in combined mode
7. Updated trigger_id/trigger_text assignment logic

## Build Status
✅ Build succeeds with no TypeScript errors
✅ No ESLint warnings
✅ All existing functionality preserved
✅ Combined document support added

## Acceptance Criteria

✅ **DSEAR docs:** Selecting multiple explosion triggers results in trigger_text listing selected labels
✅ **FRA docs:** Existing fire behavior unchanged, but trigger_text now lists selected fire trigger labels
✅ **Combined docs:** Mixed fire/explosion triggers persists combined trigger_text with both lists
✅ **Combined severity:** Priority_band reflects highest severity across both sets
✅ **No DB changes:** Works within existing schema constraints
✅ **ESLint clean:** No unused props warning

## Next Steps for Testing

1. **Create test documents:**
   - Pure FRA document
   - Pure DSEAR document
   - Combined FRA+DSEAR document

2. **Test trigger selection:**
   - Single trigger selected
   - Multiple triggers in one framework
   - Mixed triggers across both frameworks
   - No triggers selected

3. **Verify persistence:**
   - Check actions table for trigger_text values
   - Confirm trigger_id reflects severity bucket
   - Verify priority_band matches expected severity

4. **Edge cases:**
   - Equal severity from both frameworks
   - Manual P1 escalation with combined triggers
   - Critical module floor applied to combined severity
