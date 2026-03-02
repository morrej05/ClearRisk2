# DSEAR Action Triggers Implementation

## Summary
Made the "Critical Triggers" section in the Add Action modal document-type aware. The modal now shows different trigger options based on whether the document is a Fire Risk Assessment (FRA) or DSEAR (Dangerous Substances and Explosive Atmospheres Regulations) assessment.

## Changes Made

### 1. Added DSEAR Trigger Constants
**File:** `src/components/actions/AddActionModal.tsx`

Added a new constant `DSEAR_TRIGGERS` containing 9 DSEAR-specific triggers:

- **HAC (Hazardous Area Classification)**
  - No HAC completed/available (Critical)
  - Zone 0/20 present (Critical)
  - Zone 1/21 present (High)

- **Equipment**
  - Ex equipment suitability not confirmed (High)

- **Controls**
  - Hot work controls inadequate (High)
  - Static bonding/earthing missing (High)
  - Ventilation inadequate (Moderate)

- **Management**
  - Dangerous substances register/SDS incomplete (Moderate)
  - Combustible dust accumulation/housekeeping inadequate (Moderate)

### 2. Updated Form State
Extended the form state to include all DSEAR trigger fields:
- `noHac`
- `zone0_20Present`
- `zone1_21Present`
- `exEquipNotConfirmed`
- `hotWorkControlsWeak`
- `staticBondingMissing`
- `ventilationInadequate`
- `dsrIncomplete`
- `dustHousekeeping`

### 3. Document-Type Aware Trigger Display
The trigger section now checks `documentType` and displays:
- **For DSEAR documents:** All 9 DSEAR triggers (always visible, not category-filtered)
- **For FRA documents:** Existing FRA triggers filtered by Finding Category (unchanged behavior)

### 4. DSEAR Priority Derivation
Implemented manual trigger-based priority derivation for DSEAR actions:

| Trigger Level | Priority | Tier | Triggers |
|--------------|----------|------|----------|
| Critical | P1 | T4 | noHac, zone0_20Present |
| High | P2 | T3 | zone1_21Present, exEquipNotConfirmed, hotWorkControlsWeak, staticBondingMissing |
| Moderate | P3 | T2 | ventilationInadequate, dsrIncomplete, dustHousekeeping |
| Low | P4 | T1 | No triggers selected |

## Behavior

### In DSEAR Documents
1. User opens Add Action modal
2. System detects `document_type === 'DSEAR'`
3. Critical Triggers section displays all 9 DSEAR triggers
4. User checks applicable triggers
5. Priority is automatically calculated based on highest severity trigger checked
6. User can still manually escalate to P1 if needed

### In FRA Documents
- Behavior unchanged
- FRA triggers continue to be filtered by Finding Category
- Existing severity engine logic applies

## Database Persistence
- No database schema changes required
- Trigger information is stored in existing action fields:
  - `trigger_id`: e.g., "EX-MANUAL-CRITICAL"
  - `trigger_text`: Human-readable description
  - `priority_band`: P1-P4
  - `severity_tier`: T1-T4

## Testing Checklist
- [ ] Create DSEAR document and verify DSEAR triggers appear
- [ ] Create FRA document and verify FRA triggers appear (unchanged)
- [ ] Check that DSEAR trigger selection correctly influences priority
- [ ] Verify manual P1 escalation still works for DSEAR
- [ ] Confirm action creation saves trigger information correctly
